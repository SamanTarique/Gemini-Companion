import { 
  TaskItem, 
  DailyPlan, 
  ExtractedEvent, 
  ExtractedDeadline, 
  UserPreferences, 
  CommandCenterContext,
  WeatherData,
  TravelEstimate,
  JournalMemory,
} from '../types';

/**
 * Context Service
 * Extracts and prepares scheduling, task, atmospheric weather, travel, and relevant memory context for Gemini.
 * Strictly avoids transmitting raw credentials or unconsented data.
 */
export function buildTodayContext(params: {
  tasks: TaskItem[];
  currentPlan: DailyPlan | null;
  events?: ExtractedEvent[];
  deadlines?: ExtractedDeadline[];
  preferences?: Partial<UserPreferences>;
  timezone?: string;
  weather?: WeatherData | null;
  travelEstimates?: TravelEstimate[];
  retrievedMemories?: JournalMemory[];
}): CommandCenterContext {
  const {
    tasks,
    currentPlan,
    events = [],
    deadlines = [],
    preferences = {},
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    weather = null,
    travelEstimates = [],
    retrievedMemories = [],
  } = params;

  const now = new Date();
  const timeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const dateFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  // Only extract safe task properties
  const safeTasks = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    priority: t.priority,
    category: t.category,
    dueDate: t.dueDate,
    dueTime: t.dueTime,
    estimatedMinutes: t.estimatedMinutes || 25,
    completed: !!t.completed,
  }));

  // Only extract safe event properties
  const safeEvents = events.map((e) => ({
    id: e.id,
    title: e.title,
    dateTime: e.dateTime,
    location: e.location,
  }));

  // Only extract safe deadline properties
  const safeDeadlines = deadlines.map((d) => ({
    id: d.id,
    title: d.title,
    deadline: d.deadline,
    priority: d.priority,
  }));

  // Only extract schedule blocks for the active plan
  const safePlan = currentPlan
    ? {
        id: currentPlan.id,
        dateStr: currentPlan.dateStr,
        summary: currentPlan.summary,
        blocks: (currentPlan.blocks || []).map((b) => ({
          id: b.id,
          title: b.title,
          startTime: b.startTime,
          endTime: b.endTime,
          type: b.type,
          priority: b.priority,
          taskId: b.taskId,
          completed: !!b.completed,
          description: b.description,
        })),
      }
    : null;

  return {
    currentDateTime: now.toISOString(),
    currentTime: timeFormatter.format(now),
    currentDate: dateFormatter.format(now),
    timezone,
    tasks: safeTasks,
    events: safeEvents,
    deadlines: safeDeadlines,
    currentPlan: safePlan,
    userPreferences: {
      workdayStart: preferences.workdayStart || '09:00',
      workdayEnd: preferences.workdayEnd || '18:00',
      energyPacing: preferences.energyPacing || 'balanced',
      focusDurationMinutes: preferences.focusDurationMinutes || 25,
      breakDurationMinutes: preferences.breakDurationMinutes || 5,
    },
    weather,
    travelEstimates,
    retrievedMemories,
  };
}
