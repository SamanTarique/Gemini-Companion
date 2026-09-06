import { 
  PriorityLevel, 
  TaskCategory, 
  TaskItem, 
  ScheduleBlock, 
  DailyPlan, 
  GeminiToolCall, 
  ProposedChangeItem,
  CommandCenterContext
} from '../types';

export interface CreateTaskParams {
  title: string;
  priority?: PriorityLevel;
  category?: TaskCategory;
  dueDate?: string;
  dueTime?: string;
  estimatedMinutes?: number;
  description?: string;
}

export interface UpdateTaskParams {
  taskId: string;
  updates: Partial<CreateTaskParams>;
}

export interface DeleteTaskParams {
  taskId: string;
  taskTitle?: string;
}

export interface CompleteTaskParams {
  taskId: string;
  taskTitle?: string;
  completed?: boolean;
}

export interface GetTasksParams {
  filter?: 'all' | 'pending' | 'completed' | 'urgent';
  search?: string;
}

export interface GenerateDailyPlanParams {
  focusGoal?: string;
  energyPacing?: 'morning_heavy' | 'balanced' | 'afternoon_heavy';
}

export interface ReschedulePlanParams {
  disruptionReason: string;
  targetTaskTitle?: string;
  afterEventTitle?: string;
  newBlocks?: ScheduleBlock[];
}

/**
 * Validation Suite for Gemini-Generated Tool Parameters
 */
export function validateToolParams(
  tool: string,
  params: any
): { isValid: boolean; error?: string } {
  if (!params || typeof params !== 'object') {
    return { isValid: false, error: 'Parameters must be an object' };
  }

  switch (tool) {
    case 'createEvent': {
      if (!params.title || typeof params.title !== 'string' || params.title.trim().length === 0) {
        return { isValid: false, error: 'Event title is required and must be non-empty' };
      }
      if (!params.startDate && !params.date) {
        return { isValid: false, error: 'Event date is required' };
      }
      return { isValid: true };
    }

    case 'updateEvent': {
      if (!params.eventId || typeof params.eventId !== 'string') {
        return { isValid: false, error: 'eventId is required for updateEvent' };
      }
      return { isValid: true };
    }

    case 'deleteEvent': {
      if (!params.eventId || typeof params.eventId !== 'string') {
        return { isValid: false, error: 'eventId is required for deleteEvent' };
      }
      return { isValid: true };
    }

    case 'createTask': {
      if (!params.title || typeof params.title !== 'string' || params.title.trim().length === 0) {
        return { isValid: false, error: 'Task title is required and must be non-empty' };
      }
      if (params.priority && !['low', 'medium', 'high', 'critical'].includes(params.priority)) {
        params.priority = 'medium';
      }
      if (params.category && !['work', 'personal', 'urgent', 'health', 'learning', 'errand'].includes(params.category)) {
        params.category = 'work';
      }
      if (params.estimatedMinutes && (typeof params.estimatedMinutes !== 'number' || params.estimatedMinutes <= 0)) {
        params.estimatedMinutes = 25;
      }
      return { isValid: true };
    }

    case 'updateTask': {
      if (!params.taskId || typeof params.taskId !== 'string') {
        return { isValid: false, error: 'taskId is required for updateTask' };
      }
      if (!params.updates || typeof params.updates !== 'object') {
        return { isValid: false, error: 'updates payload is required' };
      }
      return { isValid: true };
    }

    case 'deleteTask': {
      if (!params.taskId || typeof params.taskId !== 'string') {
        return { isValid: false, error: 'taskId is required for deleteTask' };
      }
      return { isValid: true };
    }

    case 'completeTask': {
      if (!params.taskId || typeof params.taskId !== 'string') {
        return { isValid: false, error: 'taskId is required for completeTask' };
      }
      return { isValid: true };
    }

    case 'generateDailyPlan': {
      return { isValid: true };
    }

    case 'reschedulePlan': {
      if (!params.disruptionReason && !params.targetTaskTitle) {
        return { isValid: false, error: 'A disruption reason or target item is required to reschedule' };
      }
      return { isValid: true };
    }

    case 'getTasks':
    case 'getTodayContext':
      return { isValid: true };

    default:
      return { isValid: false, error: `Unrecognized tool name: ${tool}` };
  }
}

/**
 * Action Safety Classifier
 * Determines if user confirmation is strictly required before execution.
 */
export function classifyToolCallsSafety(
  toolCalls: GeminiToolCall[],
  rescheduledBlocks?: ScheduleBlock[]
): {
  requiresConfirmation: boolean;
  proposedChanges: ProposedChangeItem[];
  reason: string;
} {
  const proposedChanges: ProposedChangeItem[] = [];
  let requiresConfirmation = false;
  const reasons: string[] = [];

  // Count items of each type
  const createCalls = toolCalls.filter((c) => c.tool === 'createTask' || c.tool === 'createEvent');
  const deleteCalls = toolCalls.filter((c) => c.tool === 'deleteTask' || c.tool === 'deleteEvent');
  const updateCalls = toolCalls.filter((c) => c.tool === 'updateTask' || c.tool === 'updateEvent');
  const planCalls = toolCalls.filter((c) => c.tool === 'generateDailyPlan' || c.tool === 'reschedulePlan');

  // Rule 1: Any deletion ALWAYS requires confirmation
  if (deleteCalls.length > 0) {
    requiresConfirmation = true;
    reasons.push(`Deleting ${deleteCalls.length} item(s)`);
  }

  // Rule 2: Creating multiple items (> 1) requires confirmation
  if (createCalls.length > 1) {
    requiresConfirmation = true;
    reasons.push(`Creating ${createCalls.length} items`);
  }

  // Rule 3: Major rescheduling or plan generation requires confirmation
  if (planCalls.length > 0 || (rescheduledBlocks && rescheduledBlocks.length > 0)) {
    requiresConfirmation = true;
    reasons.push('Reorganizing schedule blocks');
  }

  // Rule 4: Changing multiple items (> 1 updates) requires confirmation
  if (updateCalls.length > 1) {
    requiresConfirmation = true;
    reasons.push(`Updating ${updateCalls.length} items`);
  }

  // Build the proposed change items for the UI
  for (const call of toolCalls) {
    const p = call.params || {};
    if (call.tool === 'deleteTask' || call.tool === 'deleteEvent') {
      proposedChanges.push({
        id: `prop_${call.id}`,
        toolCallId: call.id,
        tool: call.tool,
        type: 'delete',
        title: call.tool === 'deleteEvent' ? `Delete Event: "${p.eventTitle || p.eventId}"` : `Delete Task: "${p.taskTitle || p.taskId}"`,
        details: 'Permanently removes this item from your schedule',
        params: p,
      });
    } else if (call.tool === 'createTask') {
      proposedChanges.push({
        id: `prop_${call.id}`,
        toolCallId: call.id,
        tool: call.tool,
        type: 'create',
        title: `Add Task: "${p.title}"`,
        details: `Priority: ${p.priority || 'medium'} • ~${p.estimatedMinutes || 25}m ${p.dueDate ? `• Due: ${p.dueDate}` : ''}`,
        params: p,
        isEditable: true,
      });
    } else if (call.tool === 'createEvent') {
      proposedChanges.push({
        id: `prop_${call.id}`,
        toolCallId: call.id,
        tool: call.tool,
        type: 'create',
        title: `Add Event: "${p.title}"`,
        details: `Date: ${p.startDate || p.date || 'Today'} • ${p.startTime || '09:00'} - ${p.endTime || '10:00'} ${p.location ? `• ${p.location}` : ''}`,
        params: p,
        isEditable: true,
      });
    } else if (call.tool === 'updateTask' || call.tool === 'updateEvent') {
      proposedChanges.push({
        id: `prop_${call.id}`,
        toolCallId: call.id,
        tool: call.tool,
        type: 'update',
        title: call.tool === 'updateEvent' ? `Update Event` : `Update Task`,
        details: `Fields to update: ${Object.keys(p.updates || {}).join(', ')}`,
        params: p,
        isEditable: true,
      });
    } else if (call.tool === 'reschedulePlan' || call.tool === 'generateDailyPlan') {
      proposedChanges.push({
        id: `prop_${call.id}`,
        toolCallId: call.id,
        tool: call.tool,
        type: 'reschedule',
        title: call.tool === 'generateDailyPlan' ? 'Generate Full Daily Plan' : 'Reschedule Timeline',
        details: p.disruptionReason || 'Adjust today’s time-blocked schedule blocks',
        params: p,
      });
    }
  }

  // Also include proposed schedule blocks if returned
  if (rescheduledBlocks && rescheduledBlocks.length > 0 && !proposedChanges.some(p => p.type === 'reschedule')) {
    proposedChanges.push({
      id: `prop_blocks_${Date.now()}`,
      toolCallId: 'blocks_reschedule',
      tool: 'reschedulePlan',
      type: 'reschedule',
      title: `Update Timeline (${rescheduledBlocks.length} Blocks)`,
      details: 'Re-sequences your focus sessions and meetings',
      params: { blocks: rescheduledBlocks },
    });
  }

  return {
    requiresConfirmation,
    proposedChanges,
    reason: reasons.join(' • ') || 'Review proposed changes',
  };
}

/**
 * Execution Handlers Interface
 */
export interface ToolExecutionHandlers {
  onAddTask: (task: Omit<TaskItem, 'id' | 'createdAt' | 'userId'>) => Promise<void>;
  onUpdateTask: (taskId: string, updates: Partial<TaskItem>) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onCompleteTask: (taskId: string) => Promise<void>;
  onSavePlan: (plan: DailyPlan) => Promise<void>;
  onCreateEvent?: (event: any) => Promise<void>;
  onUpdateEvent?: (eventId: string, updates: any, recurrenceMode?: any, occurrenceDate?: string) => Promise<void>;
  onDeleteEvent?: (eventId: string, recurrenceMode?: any, occurrenceDate?: string) => Promise<void>;
}

/**
 * Tool Dispatcher
 * Executes validated tool calls against Firestore handlers.
 * Throws if backend operation fails, ensuring we NEVER falsely claim success.
 */
export async function executeSingleToolCall(
  call: GeminiToolCall,
  handlers: ToolExecutionHandlers,
  context: CommandCenterContext
): Promise<{ success: boolean; message: string }> {
  const validation = validateToolParams(call.tool, call.params);
  if (!validation.isValid) {
    throw new Error(`Validation failed for tool ${call.tool}: ${validation.error}`);
  }

  const p = call.params;

  switch (call.tool) {
    case 'createEvent': {
      if (!handlers.onCreateEvent) {
        throw new Error('Event creation is not configured');
      }
      await handlers.onCreateEvent({
        title: p.title.trim(),
        description: p.description || '',
        startDate: p.startDate || p.date,
        startTime: p.startTime || '09:00',
        endDate: p.endDate || p.startDate || p.date,
        endTime: p.endTime || '10:00',
        priority: p.priority || 'medium',
        location: p.location || '',
        repeat: p.repeat || { frequency: 'none' },
        reminders: p.reminders || [15],
      });
      return { success: true, message: `Created event "${p.title}"` };
    }

    case 'updateEvent': {
      if (!handlers.onUpdateEvent) {
        throw new Error('Event update is not configured');
      }
      await handlers.onUpdateEvent(p.eventId, p.updates || {}, p.recurrenceMode, p.occurrenceDate);
      return { success: true, message: `Updated event` };
    }

    case 'deleteEvent': {
      if (!handlers.onDeleteEvent) {
        throw new Error('Event deletion is not configured');
      }
      await handlers.onDeleteEvent(p.eventId, p.recurrenceMode, p.occurrenceDate);
      return { success: true, message: `Deleted event` };
    }

    case 'createTask': {
      await handlers.onAddTask({
        title: p.title.trim(),
        priority: p.priority || 'medium',
        category: p.category || 'work',
        dueDate: p.dueDate,
        dueTime: p.dueTime,
        estimatedMinutes: p.estimatedMinutes || 25,
        description: p.description,
        completed: false,
        source: 'manual',
      });
      return { success: true, message: `Created task "${p.title}"` };
    }

    case 'updateTask': {
      await handlers.onUpdateTask(p.taskId, p.updates || {});
      return { success: true, message: `Updated task` };
    }

    case 'deleteTask': {
      await handlers.onDeleteTask(p.taskId);
      return { success: true, message: `Deleted task "${p.taskTitle || p.taskId}"` };
    }

    case 'completeTask': {
      await handlers.onCompleteTask(p.taskId);
      return { success: true, message: `Marked task as completed` };
    }

    case 'reschedulePlan': {
      if (p.newBlocks && Array.isArray(p.newBlocks)) {
        const todayStr = new Date().toISOString().split('T')[0];
        const newPlan: DailyPlan = {
          id: context.currentPlan?.id || `plan_${Date.now()}`,
          userId: '', // populated in onSavePlan
          dateStr: context.currentPlan?.dateStr || todayStr,
          summary: p.disruptionReason ? `Adapted: ${p.disruptionReason}` : 'Updated schedule sequence.',
          energyStrategy: 'Dynamically adapted by Gemini Companion.',
          blocks: p.newBlocks,
          totalFocusMinutes: p.newBlocks.reduce((acc: number, b: ScheduleBlock) => acc + (b.type === 'focus' || b.type === 'task' ? 45 : 0), 0),
          totalBreakMinutes: p.newBlocks.reduce((acc: number, b: ScheduleBlock) => acc + (b.type === 'break' ? 15 : 0), 0),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await handlers.onSavePlan(newPlan);
        return { success: true, message: 'Updated today’s time-blocked schedule' };
      }
      return { success: true, message: 'Schedule evaluated' };
    }

    case 'getTasks':
    case 'getTodayContext':
    case 'generateDailyPlan':
      return { success: true, message: 'Handled by application context' };

    default:
      throw new Error(`Unsupported tool execution: ${call.tool}`);
  }
}
