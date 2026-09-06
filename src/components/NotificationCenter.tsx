import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  X, 
  Clock, 
  Check, 
  Trash2, 
  AlertCircle, 
  AlertTriangle, 
  Sparkles, 
  Calendar, 
  ListTodo, 
  ExternalLink, 
  RotateCcw,
  CheckCheck,
  Plus,
  Moon,
  Zap,
  Info,
  Volume2,
  Send,
  Loader2,
  ShieldCheck,
  BellRing
} from 'lucide-react';
import { 
  AppNotification, 
  NotificationPriority, 
  ScheduleItemType, 
  TaskItem, 
  CalendarEvent,
  UserPreferences 
} from '../types';
import { 
  getNotificationPermissionState, 
  requestPushNotificationPermission, 
  PushPermissionStatus 
} from '../services/fcmService';

export interface RecommendedReminder {
  id?: string;
  title: string;
  message: string;
  scheduledAt: number;
  priority: NotificationPriority;
  relatedTaskId?: string;
  relatedEventId?: string;
  itemType: ScheduleItemType;
  minutesBefore: number;
  reason?: string;
}

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  tasks?: TaskItem[];
  events?: CalendarEvent[];
  preferences?: UserPreferences;
  onMarkAsRead: (id: string) => Promise<void>;
  onMarkAllAsRead: () => Promise<void>;
  onSnooze: (id: string, customMinutes?: number) => Promise<void>;
  onDismiss: (id: string) => Promise<void>;
  onClearDismissed?: () => Promise<void>;
  onNavigateToItem?: (taskId?: string, eventId?: string) => void;
  onCreateCustomReminder?: (data: {
    title: string;
    message: string;
    scheduledAt: number;
    priority: NotificationPriority;
    itemType?: ScheduleItemType;
    relatedTaskId?: string;
    relatedEventId?: string;
  }) => Promise<void>;
  onTestNotification?: () => void;
  snoozeDurationMinutes: number;
  quietHoursActive?: boolean;
  focusModeActive?: boolean;
}

type NotificationTab = 'unread' | 'today' | 'earlier';

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  isOpen,
  onClose,
  notifications,
  tasks = [],
  events = [],
  preferences,
  onMarkAsRead,
  onMarkAllAsRead,
  onSnooze,
  onDismiss,
  onClearDismissed,
  onNavigateToItem,
  onCreateCustomReminder,
  onTestNotification,
  snoozeDurationMinutes,
  quietHoursActive,
  focusModeActive,
}) => {
  const [activeTab, setActiveTab] = useState<NotificationTab>('unread');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [pushPermission, setPushPermission] = useState<PushPermissionStatus>('default');

  // AI Recommendation State
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);
  const [recommendations, setRecommendations] = useState<RecommendedReminder[]>([]);
  const [showRecommendations, setShowRecommendations] = useState(false);

  // New Reminder Form State
  const [newTitle, setNewTitle] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().slice(0, 10));
  const [newTime, setNewTime] = useState(() => {
    const d = new Date(Date.now() + 15 * 60 * 1000);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });
  const [newPriority, setNewPriority] = useState<NotificationPriority>('normal');
  const [newItemType, setNewItemType] = useState<ScheduleItemType>('task');
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPushPermission(getNotificationPermissionState());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Filter notifications into sections
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endOfToday = startOfToday + 24 * 60 * 60 * 1000;

  const unreadList = notifications.filter(
    (n) => n.status === 'unread' || n.status === 'pending'
  );

  const todayList = notifications.filter((n) => {
    const time = n.scheduledAt || n.createdAt;
    return time >= startOfToday && time < endOfToday && n.status !== 'dismissed';
  });

  const earlierList = notifications.filter((n) => {
    const time = n.scheduledAt || n.createdAt;
    return time < startOfToday && n.status !== 'dismissed';
  });

  let currentList = unreadList;
  if (activeTab === 'today') currentList = todayList;
  if (activeTab === 'earlier') currentList = earlierList;

  const handleRequestPermission = async () => {
    const result = await requestPushNotificationPermission();
    setPushPermission(result);
  };

  const handleFetchAiRecommendations = async () => {
    try {
      setIsLoadingRecommendations(true);
      setShowRecommendations(true);

      const resp = await fetch('/api/notifications/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tasks,
          events,
          preferences,
          userTimezone: preferences?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });

      if (!resp.ok) throw new Error('Failed to fetch recommendations');
      const data = await resp.json();
      setRecommendations(data.recommendations || []);
    } catch (err) {
      console.warn('AI Recommendations notice:', err);
    } finally {
      setIsLoadingRecommendations(false);
    }
  };

  const handleScheduleRecommendation = async (rec: RecommendedReminder) => {
    if (!onCreateCustomReminder) return;
    await onCreateCustomReminder({
      title: rec.title,
      message: rec.message,
      scheduledAt: rec.scheduledAt,
      priority: rec.priority,
      itemType: rec.itemType,
      relatedTaskId: rec.relatedTaskId,
      relatedEventId: rec.relatedEventId,
    });
    setRecommendations((prev) => prev.filter((r) => r !== rec));
  };

  const handleScheduleAllRecommendations = async () => {
    if (!onCreateCustomReminder) return;
    for (const rec of recommendations) {
      await onCreateCustomReminder({
        title: rec.title,
        message: rec.message,
        scheduledAt: rec.scheduledAt,
        priority: rec.priority,
        itemType: rec.itemType,
        relatedTaskId: rec.relatedTaskId,
        relatedEventId: rec.relatedEventId,
      });
    }
    setRecommendations([]);
    setShowRecommendations(false);
  };

  const handleCreateReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !onCreateCustomReminder) return;

    try {
      setIsSubmitting(true);
      const [h, m] = newTime.split(':').map((s) => parseInt(s, 10) || 0);
      const scheduledDate = new Date(`${newDate}T00:00:00`);
      scheduledDate.setHours(h, m, 0, 0);

      // Default linking to first available task/event if none explicitly chosen
      const effectiveTaskId = selectedTaskId || (tasks.length > 0 ? tasks[0].id : undefined);
      const effectiveEventId = selectedEventId || (events.length > 0 && !effectiveTaskId ? events[0].id : undefined);

      await onCreateCustomReminder({
        title: newTitle.trim(),
        message: newMessage.trim() || 'Scheduled smart reminder',
        scheduledAt: scheduledDate.getTime(),
        priority: newPriority,
        itemType: newItemType,
        relatedTaskId: effectiveTaskId,
        relatedEventId: effectiveEventId,
      });

      setNewTitle('');
      setNewMessage('');
      setShowCreateForm(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPriorityBadge = (priority: NotificationPriority) => {
    switch (priority) {
      case 'urgent':
        return (
          <span 
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-300 border border-rose-500/30 text-[11px] font-semibold"
            aria-label="Priority: Urgent"
          >
            <AlertTriangle className="w-3 h-3 text-rose-400" />
            <span>Urgent</span>
          </span>
        );
      case 'high':
        return (
          <span 
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[11px] font-semibold"
            aria-label="Priority: High"
          >
            <AlertCircle className="w-3 h-3 text-amber-400" />
            <span>High</span>
          </span>
        );
      case 'normal':
        return (
          <span 
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-300 border border-blue-500/30 text-[11px] font-medium"
            aria-label="Priority: Normal"
          >
            <Info className="w-3 h-3 text-blue-400" />
            <span>Normal</span>
          </span>
        );
      case 'low':
      default:
        return (
          <span 
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-400 border border-zinc-700 text-[11px] font-medium"
            aria-label="Priority: Low"
          >
            <span>Low</span>
          </span>
        );
    }
  };

  const formatScheduledTime = (timestamp: number) => {
    const d = new Date(timestamp);
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isToday = d.getTime() >= startOfToday && d.getTime() < endOfToday;
    if (isToday) return `Today at ${timeStr}`;
    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${timeStr}`;
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-xs animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-label="Smart Notification Center"
    >
      <div className="w-full max-w-md h-full bg-[#0E0E0E] border-l border-zinc-800 flex flex-col shadow-2xl relative">
        {/* Top Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-100 tracking-tight">Notification Center</h2>
              <p className="text-xs text-zinc-400">Context-aware reminders &amp; schedule alerts</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {onTestNotification && (
              <button
                id="btn-test-notification"
                onClick={onTestNotification}
                className="p-2 rounded-xl text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 transition-colors"
                title="Send test alert sound &amp; banner"
                aria-label="Send test alert"
              >
                <Volume2 className="w-4 h-4" />
              </button>
            )}

            <button
              id="btn-close-notifications"
              onClick={onClose}
              className="p-2 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400"
              aria-label="Close notification center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Browser Push Permission Banner */}
        {pushPermission !== 'granted' && pushPermission !== 'unsupported' && (
          <div className="px-4 py-2.5 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-b border-amber-500/20 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <BellRing className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-zinc-300">
                {pushPermission === 'denied' 
                  ? 'Push notifications are blocked in your browser settings.' 
                  : 'Enable desktop push alerts for instant reminders.'}
              </span>
            </div>
            {pushPermission === 'default' && (
              <button
                id="btn-enable-push"
                onClick={handleRequestPermission}
                className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-semibold rounded-lg text-xs shrink-0 transition-colors"
              >
                Enable
              </button>
            )}
          </div>
        )}

        {/* Status Indicators Banner (Quiet hours / Focus mode) */}
        {(quietHoursActive || focusModeActive) && (
          <div className="px-4 py-2 bg-zinc-900 border-b border-zinc-800 flex items-center gap-2 text-xs">
            {quietHoursActive && (
              <span className="inline-flex items-center gap-1 text-indigo-300 font-medium">
                <Moon className="w-3.5 h-3.5" />
                <span>Quiet Hours Active</span>
              </span>
            )}
            {focusModeActive && (
              <span className="inline-flex items-center gap-1 text-amber-300 font-medium">
                <Zap className="w-3.5 h-3.5" />
                <span>Focus Mode Guard Active</span>
              </span>
            )}
          </div>
        )}

        {/* AI Recommendations Quick Prompt */}
        <div className="px-4 py-2 bg-zinc-950/80 border-b border-zinc-800/60 flex items-center justify-between text-xs">
          <button
            id="btn-ai-recommend-reminders"
            onClick={handleFetchAiRecommendations}
            disabled={isLoadingRecommendations}
            className="flex items-center gap-1.5 text-amber-400 hover:text-amber-300 font-medium transition-colors"
          >
            {isLoadingRecommendations ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>AI Reminder Recommendations</span>
          </button>

          {recommendations.length > 0 && (
            <button
              onClick={() => setShowRecommendations(!showRecommendations)}
              className="text-zinc-400 hover:text-zinc-200 text-[11px]"
            >
              {showRecommendations ? 'Hide Suggestions' : `Show (${recommendations.length})`}
            </button>
          )}
        </div>

        {/* AI Recommendations List Card */}
        {showRecommendations && recommendations.length > 0 && (
          <div className="p-3 bg-zinc-900/90 border-b border-amber-500/20 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-zinc-200 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Suggested Reminders ({recommendations.length})</span>
              </span>
              <button
                onClick={handleScheduleAllRecommendations}
                className="px-2 py-0.5 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-semibold rounded text-[11px] transition-colors"
              >
                Schedule All
              </button>
            </div>

            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {recommendations.map((rec, idx) => (
                <div
                  key={idx}
                  className="p-2 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between gap-2"
                >
                  <div>
                    <p className="font-medium text-zinc-100">{rec.title}</p>
                    <p className="text-[11px] text-zinc-400">{rec.message}</p>
                  </div>
                  <button
                    onClick={() => handleScheduleRecommendation(rec)}
                    className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-amber-300 rounded text-[10px] font-medium shrink-0 transition-colors"
                  >
                    Set
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab Selection & Actions Bar */}
        <div className="px-4 pt-3 pb-2 border-b border-zinc-800/80 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 bg-zinc-900/80 p-1 rounded-xl border border-zinc-800" role="tablist">
            <button
              id="tab-notif-unread"
              role="tab"
              aria-selected={activeTab === 'unread'}
              onClick={() => setActiveTab('unread')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'unread'
                  ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                  : 'text-zinc-400 hover:text-zinc-200'
              } focus:outline-none`}
            >
              <span>Unread</span>
              {unreadList.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 text-[10px]">
                  {unreadList.length}
                </span>
              )}
            </button>

            <button
              id="tab-notif-today"
              role="tab"
              aria-selected={activeTab === 'today'}
              onClick={() => setActiveTab('today')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'today'
                  ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                  : 'text-zinc-400 hover:text-zinc-200'
              } focus:outline-none`}
            >
              <span>Today</span>
              {todayList.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-300 text-[10px]">
                  {todayList.length}
                </span>
              )}
            </button>

            <button
              id="tab-notif-earlier"
              role="tab"
              aria-selected={activeTab === 'earlier'}
              onClick={() => setActiveTab('earlier')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'earlier'
                  ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                  : 'text-zinc-400 hover:text-zinc-200'
              } focus:outline-none`}
            >
              <span>Earlier</span>
              {earlierList.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-300 text-[10px]">
                  {earlierList.length}
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            {unreadList.length > 0 && (
              <button
                id="btn-mark-all-read"
                onClick={() => onMarkAllAsRead()}
                className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors text-xs"
                title="Mark all as read"
                aria-label="Mark all notifications as read"
              >
                <CheckCheck className="w-4 h-4" />
              </button>
            )}

            <button
              id="btn-toggle-create-reminder"
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium rounded-lg border border-zinc-700 transition-colors"
              title="Add custom reminder"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Reminder</span>
            </button>
          </div>
        </div>

        {/* Custom Reminder Creation Drawer */}
        {showCreateForm && (
          <form onSubmit={handleCreateReminder} className="p-4 bg-zinc-900/90 border-b border-zinc-800 space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>New Linked Reminder</span>
              </span>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="text-zinc-400 hover:text-zinc-200 text-xs"
              >
                Cancel
              </button>
            </div>

            <div>
              <input
                id="custom-reminder-title"
                type="text"
                placeholder="Reminder title (e.g. Call client, Finalize budget)"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                required
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Link to Task or Event */}
            {tasks.length > 0 && (
              <div>
                <label className="block text-[10px] text-zinc-400 mb-1">Link to Task</label>
                <select
                  id="custom-reminder-task-link"
                  value={selectedTaskId}
                  onChange={(e) => {
                    setSelectedTaskId(e.target.value);
                    if (e.target.value) {
                      const t = tasks.find((item) => item.id === e.target.value);
                      if (t && !newTitle) setNewTitle(`Reminder: ${t.title}`);
                    }
                  }}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-400"
                >
                  <option value="">Select task to link...</option>
                  {tasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title} {t.dueDate ? `(Due ${t.dueDate})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-zinc-400 mb-1">Date</label>
                <input
                  id="custom-reminder-date"
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-[10px] text-zinc-400 mb-1">Time</label>
                <input
                  id="custom-reminder-time"
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] text-zinc-400 mb-1">Priority</label>
                <select
                  id="custom-reminder-priority"
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value as NotificationPriority)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-400"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-zinc-400 mb-1">Type</label>
                <select
                  id="custom-reminder-type"
                  value={newItemType}
                  onChange={(e) => setNewItemType(e.target.value as ScheduleItemType)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-400"
                >
                  <option value="task">Task</option>
                  <option value="event">Event</option>
                  <option value="deadline">Deadline</option>
                  <option value="routine">Routine</option>
                  <option value="break">Break</option>
                  <option value="focus">Focus Session</option>
                </select>
              </div>
            </div>

            <button
              id="btn-submit-reminder"
              type="submit"
              disabled={isSubmitting || !newTitle.trim()}
              className="w-full py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-zinc-950 font-semibold text-xs rounded-xl transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Set Reminder'}
            </button>
          </form>
        )}

        {/* Notifications Scroll List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {currentList.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 space-y-2">
              <div className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-500">
                <CheckCheck className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-zinc-300">All caught up!</h3>
              <p className="text-xs text-zinc-500 max-w-xs">
                {activeTab === 'unread'
                  ? 'No unread notifications right now. Context-aware alerts will appear here.'
                  : `No notifications found in ${activeTab}.`}
              </p>
            </div>
          ) : (
            currentList.map((notif) => {
              const isUnread = notif.status === 'unread' || notif.status === 'pending';

              return (
                <article
                  key={notif.id}
                  id={`notif-item-${notif.id}`}
                  className={`p-3.5 rounded-2xl border transition-all space-y-2.5 relative ${
                    isUnread
                      ? 'bg-zinc-900/90 border-amber-500/30 shadow-md'
                      : 'bg-zinc-900/40 border-zinc-800 text-zinc-300'
                  }`}
                  aria-labelledby={`notif-title-${notif.id}`}
                >
                  {/* Priority & Time Header */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {getPriorityBadge(notif.priority)}
                      {notif.itemType && (
                        <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">
                          {notif.itemType}
                        </span>
                      )}
                    </div>

                    <span className="text-[11px] text-zinc-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-zinc-500" />
                      <span>{formatScheduledTime(notif.scheduledAt)}</span>
                    </span>
                  </div>

                  {/* Title & Message */}
                  <div>
                    <h4 
                      id={`notif-title-${notif.id}`}
                      className={`text-sm font-semibold tracking-tight ${
                        isUnread ? 'text-zinc-100' : 'text-zinc-300'
                      }`}
                    >
                      {notif.title}
                    </h4>
                    {notif.message && (
                      <p className="text-xs text-zinc-400 mt-1 line-clamp-2">
                        {notif.message}
                      </p>
                    )}
                  </div>

                  {/* Delayed Reason Flag if held by protection rules */}
                  {notif.delayedReason && (
                    <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 shrink-0" />
                      <span>Held back: {notif.delayedReason}</span>
                    </div>
                  )}

                  {/* Action Controls */}
                  <div className="flex items-center justify-between pt-1 border-t border-zinc-800/60 text-xs">
                    <div className="flex items-center gap-2">
                      {/* Mark read/unread */}
                      <button
                        type="button"
                        id={`btn-read-${notif.id}`}
                        onClick={() => onMarkAsRead(notif.id)}
                        className="text-zinc-400 hover:text-amber-400 flex items-center gap-1 transition-colors"
                        title={isUnread ? 'Mark as read' : 'Mark as unread'}
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{isUnread ? 'Read' : 'Mark unread'}</span>
                      </button>

                      {/* Snooze */}
                      <button
                        type="button"
                        id={`btn-snooze-${notif.id}`}
                        onClick={() => onSnooze(notif.id, snoozeDurationMinutes)}
                        className="text-zinc-400 hover:text-zinc-200 flex items-center gap-1 transition-colors"
                        title={`Snooze for ${snoozeDurationMinutes} minutes`}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Snooze ({snoozeDurationMinutes}m)</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Navigate to linked task/event */}
                      {(notif.relatedTaskId || notif.relatedEventId) && onNavigateToItem && (
                        <button
                          type="button"
                          id={`btn-open-linked-${notif.id}`}
                          onClick={() => {
                            onNavigateToItem(notif.relatedTaskId, notif.relatedEventId);
                            onClose();
                          }}
                          className="text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors font-medium"
                          title="Open related task or event"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>View</span>
                        </button>
                      )}

                      {/* Dismiss */}
                      <button
                        type="button"
                        id={`btn-dismiss-${notif.id}`}
                        onClick={() => onDismiss(notif.id)}
                        className="text-zinc-500 hover:text-rose-400 p-1 rounded-md transition-colors"
                        title="Dismiss notification"
                        aria-label="Dismiss notification"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
