import React, { useState } from 'react';
import { 
  Plus, 
  Check, 
  Trash2, 
  Sparkles, 
  Clock, 
  Tag, 
  Filter, 
  Search, 
  Calendar, 
  ChevronDown, 
  ChevronUp, 
  RotateCw,
  AlertCircle,
  Brain,
  ListTodo,
  CheckCircle2,
  Layers,
  ArrowRight,
  BellRing,
  Coffee,
  Zap,
  Repeat,
  MapPin
} from 'lucide-react';
import { TaskItem, TaskCategory, PriorityLevel, TaskSubtask, ScheduleItemType, RepeatPattern } from '../types';

interface TasksManagerProps {
  tasks: TaskItem[];
  onAddTask: (task: Omit<TaskItem, 'id' | 'createdAt'>) => Promise<void>;
  onToggleTask: (taskId: string) => Promise<void>;
  onUpdateTask: (taskId: string, updates: Partial<TaskItem>) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onClearCompletedTasks?: () => Promise<void>;
  onClearAllTasks?: () => Promise<void>;
  onStartFocus: (taskTitle: string, taskId: string) => void;
  onNavigateToCalendar?: (dateStr?: string) => void;
  defaultReminderMinutes?: number;
}

const CATEGORIES: { id: TaskCategory; label: string }[] = [
  { id: 'work', label: 'Work' },
  { id: 'personal', label: 'Personal' },
  { id: 'urgent', label: 'Urgent' },
  { id: 'health', label: 'Health' },
  { id: 'learning', label: 'Learning' },
  { id: 'errand', label: 'Errand' },
];

const PRIORITIES: { id: PriorityLevel; label: string; color: string }[] = [
  { id: 'critical', label: 'Critical', color: 'bg-rose-500/10 text-rose-300 border-rose-500/30' },
  { id: 'high', label: 'High', color: 'bg-amber-500/10 text-amber-300 border-amber-500/30' },
  { id: 'medium', label: 'Medium', color: 'bg-blue-500/10 text-blue-300 border-blue-500/30' },
  { id: 'low', label: 'Low', color: 'bg-zinc-800 text-zinc-400 border-zinc-700' },
];

const ITEM_TYPES: { id: ScheduleItemType; label: string; icon: any }[] = [
  { id: 'task', label: 'Task', icon: ListTodo },
  { id: 'event', label: 'Event', icon: Calendar },
  { id: 'deadline', label: 'Deadline', icon: AlertCircle },
  { id: 'routine', label: 'Routine', icon: Repeat },
  { id: 'break', label: 'Break', icon: Coffee },
  { id: 'focus', label: 'Focus Session', icon: Zap },
];

export const TasksManager: React.FC<TasksManagerProps> = ({
  tasks,
  onAddTask,
  onToggleTask,
  onUpdateTask,
  onDeleteTask,
  onClearCompletedTasks,
  onClearAllTasks,
  onStartFocus,
  onNavigateToCalendar,
  defaultReminderMinutes = 15,
}) => {
  // Add task form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [itemType, setItemType] = useState<ScheduleItemType>('task');
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState<PriorityLevel>('medium');
  const [newCategory, setNewCategory] = useState<TaskCategory>('work');
  const [newDueDate, setNewDueDate] = useState('');
  const [newDueTime, setNewDueTime] = useState('');
  const [newStartTime, setNewStartTime] = useState('');
  const [newEndTime, setNewEndTime] = useState('');
  const [newEstMinutes, setNewEstMinutes] = useState<number>(30);
  const [newRepeatPattern, setNewRepeatPattern] = useState<RepeatPattern>('none');
  const [newReminderMinutes, setNewReminderMinutes] = useState<number>(defaultReminderMinutes);
  const [newLocation, setNewLocation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'completed'>('pending');

  // AI Breakdown loading state per taskId
  const [breakingDownTaskId, setBreakingDownTaskId] = useState<string | null>(null);
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set());

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      setIsSubmitting(true);
      await onAddTask({
        userId: '',
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
        itemType,
        priority: newPriority,
        category: newCategory,
        dueDate: newDueDate.trim() || undefined,
        dueTime: newDueTime.trim() || undefined,
        startTime: newStartTime.trim() || undefined,
        endTime: newEndTime.trim() || undefined,
        estimatedMinutes: newEstMinutes || 25,
        repeatPattern: newRepeatPattern !== 'none' ? newRepeatPattern : undefined,
        reminderMinutesBefore: newReminderMinutes,
        location: newLocation.trim() || undefined,
        completed: false,
        source: 'manual',
      });

      setNewTitle('');
      setNewDescription('');
      setNewLocation('');
      setShowAddForm(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleExpand = (taskId: string) => {
    const next = new Set(expandedTaskIds);
    if (next.has(taskId)) next.delete(taskId);
    else next.add(taskId);
    setExpandedTaskIds(next);
  };

  // AI Task Breakdown with Gemini
  const handleBreakdownTask = async (task: TaskItem) => {
    try {
      setBreakingDownTaskId(task.id);
      const res = await fetch('/api/gemini/breakdown-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskTitle: task.title,
          taskDescription: task.description,
        }),
      });

      if (!res.ok) throw new Error('AI Breakdown request failed');
      const data = await res.json();

      if (Array.isArray(data.subtasks)) {
        await onUpdateTask(task.id, {
          subtasks: data.subtasks,
        });
        // Auto expand to show subtasks
        setExpandedTaskIds((prev) => new Set([...prev, task.id]));
      }
    } catch (err: any) {
      alert(`AI Task breakdown failed: ${err.message}`);
    } finally {
      setBreakingDownTaskId(null);
    }
  };

  // Toggle individual subtask
  const handleToggleSubtask = async (task: TaskItem, subtaskId: string) => {
    if (!task.subtasks) return;
    const updated = task.subtasks.map((st) =>
      st.id === subtaskId ? { ...st, completed: !st.completed } : st
    );
    await onUpdateTask(task.id, { subtasks: updated });
  };

  // Filtering
  const filteredTasks = tasks.filter((t) => {
    const matchesSearch =
      searchQuery.trim() === '' ||
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesType = filterType === 'all' || (t.itemType || 'task') === filterType;
    const matchesCategory = filterCategory === 'all' || t.category === filterCategory;
    const matchesPriority = filterPriority === 'all' || t.priority === filterPriority;
    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'pending' && !t.completed) ||
      (filterStatus === 'completed' && t.completed);

    return matchesSearch && matchesType && matchesCategory && matchesPriority && matchesStatus;
  });

  const pendingCount = tasks.filter((t) => !t.completed).length;
  const completedCount = tasks.filter((t) => t.completed).length;

  return (
    <div className="space-y-6 text-zinc-100 animate-fadeIn">
      {/* Top Header & Add Task Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ListTodo className="w-5 h-5 text-zinc-300" />
            <h2 className="text-2xl sm:text-3xl font-semibold text-zinc-100 tracking-tight">
              Schedule &amp; Tasks
            </h2>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Create events, deadlines, routines, breaks, focus sessions, and smart tasks with custom timing and reminders.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {completedCount > 0 && onClearCompletedTasks && (
            <button
              onClick={() => {
                if (window.confirm(`Clear ${completedCount} completed item(s)?`)) {
                  onClearCompletedTasks();
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-rose-400 border border-zinc-800 text-xs font-medium transition-colors"
              title="Remove completed items"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear completed ({completedCount})</span>
            </button>
          )}

          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-100 hover:bg-white text-black font-semibold text-xs transition-all shadow-md active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>{showAddForm ? 'Close Form' : 'Add Schedule Item'}</span>
          </button>
        </div>
      </div>

      {/* Add Item Collapsible Form */}
      {showAddForm && (
        <form
          onSubmit={handleCreateTask}
          className="p-6 bg-[#0F0F0F] border border-zinc-800 rounded-3xl space-y-4 shadow-xl animate-fadeIn"
        >
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <h3 className="text-base font-semibold text-zinc-100 tracking-tight">
              Add Flexible Schedule Item
            </h3>
            <span className="text-xs text-zinc-400">Custom timing • Reminders • Repeat patterns</span>
          </div>

          {/* Item Type Selector */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
              Item Type
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {ITEM_TYPES.map((type) => {
                const Icon = type.icon;
                const isSelected = itemType === type.id;
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setItemType(type.id)}
                    className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl border text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{type.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                Title *
              </label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder={
                  itemType === 'event'
                    ? 'e.g., Client Architecture Review'
                    : itemType === 'deadline'
                    ? 'e.g., Q3 Tax Filings Deadline'
                    : itemType === 'routine'
                    ? 'e.g., Morning Journaling & Meditation'
                    : itemType === 'break'
                    ? 'e.g., Afternoon Walk & Hydration'
                    : itemType === 'focus'
                    ? 'e.g., Deep Coding Session on Engine'
                    : 'e.g., Prepare quarterly presentation'
                }
                required
                className="w-full px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                Description / Context (Optional)
              </label>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Add agenda, deliverables, links, or notes..."
                rows={2}
                className="w-full px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
              />
            </div>

            {/* Custom Date & Time Configuration */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-300 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                  {itemType === 'deadline' ? 'Due Time' : 'Start Time'}
                </label>
                <input
                  type="time"
                  value={itemType === 'deadline' ? newDueTime : newStartTime}
                  onChange={(e) =>
                    itemType === 'deadline'
                      ? setNewDueTime(e.target.value)
                      : setNewStartTime(e.target.value)
                  }
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-300 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                  {itemType === 'event' ? 'End Time' : 'Duration (min)'}
                </label>
                {itemType === 'event' ? (
                  <input
                    type="time"
                    value={newEndTime}
                    onChange={(e) => setNewEndTime(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-300 focus:outline-none"
                  />
                ) : (
                  <input
                    type="number"
                    min={5}
                    max={480}
                    step={5}
                    value={newEstMinutes}
                    onChange={(e) => setNewEstMinutes(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-300 focus:outline-none"
                  />
                )}
              </div>
            </div>

            {/* Custom Priority, Repeat Pattern, Reminder, and Category */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                  Priority
                </label>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value as PriorityLevel)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-300 focus:outline-none"
                >
                  {PRIORITIES.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                  Repeat Pattern
                </label>
                <select
                  value={newRepeatPattern}
                  onChange={(e) => setNewRepeatPattern(e.target.value as RepeatPattern)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-300 focus:outline-none"
                >
                  <option value="none">Does not repeat</option>
                  <option value="daily">Daily</option>
                  <option value="weekdays">Weekdays (Mon-Fri)</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                  Reminder Time
                </label>
                <select
                  value={newReminderMinutes}
                  onChange={(e) => setNewReminderMinutes(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-300 focus:outline-none"
                >
                  <option value={0}>At time of event</option>
                  <option value={5}>5 minutes before</option>
                  <option value={10}>10 minutes before</option>
                  <option value={15}>15 minutes before (Default)</option>
                  <option value={30}>30 minutes before</option>
                  <option value={60}>1 hour before</option>
                  <option value={120}>2 hours before</option>
                  <option value={1440}>1 day before</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                  Category
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as TaskCategory)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-300 focus:outline-none"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Optional Location for meetings/events */}
            {itemType === 'event' && (
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                  Location / Meeting Link (Optional)
                </label>
                <input
                  type="text"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  placeholder="e.g., Room 402 or https://meet.google.com/xyz"
                  className="w-full px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 rounded-xl text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-900 hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !newTitle.trim()}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-zinc-100 hover:bg-white text-black disabled:opacity-50"
            >
              {isSubmitting ? 'Adding...' : 'Save Schedule Item'}
            </button>
          </div>
        </form>
      )}

      {/* Filter & Search Bar */}
      <div className="p-4 bg-[#0F0F0F] border border-zinc-800 rounded-2xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search schedule items or context..."
              className="w-full pl-9 pr-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700"
            />
          </div>

          {/* Status filter tabs */}
          <div className="inline-flex p-1 bg-zinc-900 rounded-xl border border-zinc-800 shrink-0">
            <button
              onClick={() => setFilterStatus('pending')}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-all ${
                filterStatus === 'pending' ? 'bg-zinc-800 text-zinc-100 shadow-xs' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Pending ({pendingCount})
            </button>
            <button
              onClick={() => setFilterStatus('completed')}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-all ${
                filterStatus === 'completed' ? 'bg-zinc-800 text-zinc-100 shadow-xs' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Completed ({completedCount})
            </button>
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1 text-xs font-medium rounded-lg transition-all ${
                filterStatus === 'all' ? 'bg-zinc-800 text-zinc-100 shadow-xs' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              All ({tasks.length})
            </button>
          </div>
        </div>

        {/* Item Types Filter pills */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-800/80 text-xs">
          <span className="text-zinc-500 text-[10px] uppercase tracking-wider">Type:</span>
          <button
            onClick={() => setFilterType('all')}
            className={`px-2.5 py-0.5 rounded-full text-[11px] border transition-all ${
              filterType === 'all' ? 'bg-zinc-100 text-black font-bold border-zinc-100' : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-800'
            }`}
          >
            All
          </button>
          {ITEM_TYPES.map((type) => (
            <button
              key={type.id}
              onClick={() => setFilterType(type.id)}
              className={`px-2.5 py-0.5 rounded-full text-[11px] border transition-all ${
                filterType === type.id ? 'bg-amber-400 text-zinc-950 font-bold border-amber-400' : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-800'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>

        {/* Categories & Priority Filter pills */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-800/80 text-xs">
          <span className="text-zinc-500 text-[10px] uppercase tracking-wider">Category:</span>
          <button
            onClick={() => setFilterCategory('all')}
            className={`px-2.5 py-0.5 rounded-full text-[11px] border transition-all ${
              filterCategory === 'all' ? 'bg-zinc-100 text-black font-bold border-zinc-100' : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-800'
            }`}
          >
            All
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setFilterCategory(cat.id)}
              className={`px-2.5 py-0.5 rounded-full text-[11px] border transition-all ${
                filterCategory === cat.id ? 'bg-zinc-100 text-black font-bold border-zinc-100' : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Task List */}
      <div className="space-y-3">
        {filteredTasks.length === 0 ? (
          <div className="p-12 text-center bg-[#0F0F0F] border border-zinc-800 rounded-3xl space-y-3">
            <CheckCircle2 className="w-8 h-8 text-zinc-600 mx-auto" />
            <h4 className="text-lg font-semibold text-zinc-300 tracking-tight">
              No tasks match your criteria
            </h4>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              {tasks.length === 0
                ? 'Your task list is empty. Add your first task or let Gemini extract one from your journal reflections.'
                : 'Try adjusting your search filters.'}
            </p>
          </div>
        ) : (
          filteredTasks.map((task) => {
            const isExpanded = expandedTaskIds.has(task.id);
            const isBreakingDown = breakingDownTaskId === task.id;
            const subtasksCount = task.subtasks?.length || 0;
            const completedSubtasks = task.subtasks?.filter((s) => s.completed).length || 0;

            const priorityConfig = PRIORITIES.find((p) => p.id === task.priority) || PRIORITIES[2];

            return (
              <div
                key={task.id}
                className={`p-5 rounded-3xl border transition-all ${
                  task.completed
                    ? 'bg-zinc-900/30 border-zinc-800/60 opacity-60'
                    : 'bg-[#0F0F0F] border-zinc-800 hover:border-zinc-700 shadow-md'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Checkbox and Task Title */}
                  <div className="flex items-start gap-3 flex-1">
                    <button
                      onClick={() => onToggleTask(task.id)}
                      className={`w-5 h-5 mt-0.5 rounded-lg border flex items-center justify-center transition-all shrink-0 ${
                        task.completed
                          ? 'bg-emerald-600 border-emerald-500 text-white'
                          : 'border-zinc-700 hover:border-zinc-500 bg-zinc-900'
                      }`}
                    >
                      {task.completed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </button>

                    <div className="space-y-1 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {task.itemType && (
                          <span className="px-2 py-0.5 rounded-md bg-zinc-800 border border-zinc-700 text-amber-300 text-[10px] uppercase tracking-wider font-semibold">
                            {task.itemType}
                          </span>
                        )}
                        <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wider ${priorityConfig.color}`}>
                          {task.priority}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-400 text-[10px] uppercase tracking-wider">
                          {task.category}
                        </span>
                        {task.estimatedMinutes && (
                          <span className="text-[11px] text-zinc-500 flex items-center gap-1 font-mono">
                            <Clock className="w-3 h-3" />
                            {task.estimatedMinutes}m
                          </span>
                        )}
                        {(task.startTime || task.dueTime) && (
                          <span className="text-[11px] text-zinc-400 flex items-center gap-1 font-mono">
                            <Clock className="w-3 h-3 text-amber-500" />
                            {task.startTime ? `${task.startTime}${task.endTime ? ` - ${task.endTime}` : ''}` : task.dueTime}
                          </span>
                        )}
                        {task.dueDate && (
                          <button
                            type="button"
                            onClick={() => onNavigateToCalendar && onNavigateToCalendar(task.dueDate)}
                            className={`text-[11px] font-mono flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors ${
                              onNavigateToCalendar 
                                ? 'text-blue-400 hover:text-blue-300 hover:bg-blue-950/40 bg-blue-950/20 border border-blue-900/30' 
                                : 'text-zinc-500'
                            }`}
                            title={onNavigateToCalendar ? 'Open date in Calendar' : undefined}
                          >
                            <Calendar className="w-3 h-3 text-blue-400" />
                            <span>{task.dueDate}</span>
                          </button>
                        )}
                        {task.repeatPattern && task.repeatPattern !== 'none' && (
                          <span className="text-[10px] text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <Repeat className="w-3 h-3" />
                            <span className="capitalize">{task.repeatPattern}</span>
                          </span>
                        )}
                        {task.reminderMinutesBefore !== undefined && (
                          <span className="text-[10px] text-amber-400/90 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md flex items-center gap-1" title="Notification reminder set">
                            <BellRing className="w-3 h-3" />
                            <span>{task.reminderMinutesBefore === 0 ? 'On time' : `${task.reminderMinutesBefore}m before`}</span>
                          </span>
                        )}
                        {task.location && (
                          <span className="text-[10px] text-zinc-400 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-zinc-500" />
                            <span>{task.location}</span>
                          </span>
                        )}
                      </div>

                      <h4 className={`text-base font-medium tracking-tight ${task.completed ? 'line-through text-zinc-500' : 'text-zinc-100'}`}>
                        {task.title}
                      </h4>

                      {task.description && (
                        <p className="text-xs text-zinc-400 font-sans leading-relaxed">
                          {task.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions Right */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {!task.completed && (
                      <button
                        onClick={() => onStartFocus(task.title, task.id)}
                        className="px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-emerald-400 text-xs font-medium flex items-center gap-1 transition-colors"
                        title="Focus on this task"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Focus</span>
                      </button>
                    )}

                    {!task.completed && (
                      <button
                        onClick={() => handleBreakdownTask(task)}
                        disabled={isBreakingDown}
                        className="px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-amber-300 text-xs font-medium flex items-center gap-1 transition-colors disabled:opacity-50"
                        title="Break down into subtasks using Gemini"
                      >
                        <Sparkles className={`w-3.5 h-3.5 text-amber-400 ${isBreakingDown ? 'animate-spin' : ''}`} />
                        <span className="hidden md:inline">AI Breakdown</span>
                      </button>
                    )}

                    {subtasksCount > 0 && (
                      <button
                        onClick={() => toggleExpand(task.id)}
                        className="p-1.5 text-zinc-400 hover:text-zinc-200 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl"
                        title="Toggle subtasks view"
                      >
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    )}

                    <button
                      onClick={() => onDeleteTask(task.id)}
                      className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-950/30 rounded-xl transition-colors"
                      title="Delete task"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Subtasks Progress & Expandable List */}
                {subtasksCount > 0 && (
                  <div className="mt-3 pt-3 border-t border-zinc-800/60">
                    <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
                      <span className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                        <Layers className="w-3.5 h-3.5 text-amber-400" />
                        Subtasks ({completedSubtasks}/{subtasksCount})
                      </span>
                      <span className="font-mono text-[10px] text-zinc-500">
                        {Math.round((completedSubtasks / subtasksCount) * 100)}% done
                      </span>
                    </div>

                    {isExpanded && (
                      <div className="space-y-2 pl-3 border-l-2 border-zinc-800 mt-2">
                        {task.subtasks?.map((subtask) => (
                          <div
                            key={subtask.id}
                            onClick={() => handleToggleSubtask(task, subtask.id)}
                            className="flex items-center justify-between p-2 rounded-xl bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800/80 cursor-pointer transition-colors"
                          >
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                                  subtask.completed
                                    ? 'bg-emerald-600 border-emerald-500 text-white'
                                    : 'border-zinc-700 bg-zinc-900'
                                }`}
                              >
                                {subtask.completed && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                              <span className={`text-xs ${subtask.completed ? 'line-through text-zinc-500' : 'text-zinc-200'}`}>
                                {subtask.title}
                              </span>
                            </div>

                            {subtask.estimatedMinutes && (
                              <span className="text-[10px] text-zinc-500 font-mono">
                                ~{subtask.estimatedMinutes}m
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
