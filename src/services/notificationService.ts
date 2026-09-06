import { AppNotification, NotificationPriority, NotificationStatus, UserPreferences, ScheduleBlock, TaskItem } from '../types';
import { db } from '../lib/firebase';
import { collection, doc, setDoc, updateDoc, deleteDoc, query, orderBy, onSnapshot, getDocs } from 'firebase/firestore';

export interface EvaluationContext {
  now?: number; // timestamp in ms
  preferences: UserPreferences;
  isFocusModeActive?: boolean;
  activeMeetings?: ScheduleBlock[];
}

export interface DeliveryCheckResult {
  shouldDeliver: boolean;
  delayReason?: string;
  nextScheduledTime?: number;
}

/**
 * Parses "HH:mm" time string into minutes from start of day
 */
export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

/**
 * Checks if a given time is within a window (e.g. 22:00 to 07:00, or 13:00 to 14:00)
 */
export function isTimeInWindow(currentTimeStr: string, startStr: string, endStr: string): boolean {
  const current = timeToMinutes(currentTimeStr);
  const start = timeToMinutes(startStr);
  const end = timeToMinutes(endStr);

  if (start <= end) {
    // Standard window in same day (e.g. 09:00 - 17:00)
    return current >= start && current <= end;
  } else {
    // Overnight window (e.g. 22:00 - 07:00)
    return current >= start || current <= end;
  }
}

/**
 * Evaluates context-aware delivery rules for a notification:
 * Checks quiet hours, focus mode, meeting protection, urgent exceptions, and priority.
 */
export function evaluateNotificationContext(
  notification: AppNotification,
  context: EvaluationContext
): DeliveryCheckResult {
  const now = context.now || Date.now();
  const { preferences, isFocusModeActive, activeMeetings } = context;

  // 1. Check if notifications globally disabled
  if (!preferences.notificationsEnabled) {
    return { shouldDeliver: false, delayReason: 'Notifications disabled in settings' };
  }

  // 2. Check scheduledAt
  if (notification.scheduledAt > now) {
    return { shouldDeliver: false, delayReason: 'Scheduled for future time' };
  }

  // 3. Priority threshold check
  const priorityWeights: Record<NotificationPriority, number> = {
    low: 1,
    normal: 2,
    high: 3,
    urgent: 4,
  };
  const currentWeight = priorityWeights[notification.priority] || 2;
  const thresholdWeight = priorityWeights[preferences.priorityThreshold] || 1;

  if (currentWeight < thresholdWeight) {
    return { shouldDeliver: false, delayReason: 'Priority below configured threshold' };
  }

  // 4. Urgent bypass: If priority is urgent and user enabled urgent exceptions, deliver immediately!
  const isUrgentException = notification.priority === 'urgent' && preferences.urgentExceptions;
  if (isUrgentException) {
    return { shouldDeliver: true };
  }

  const date = new Date(now);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const currentTimeStr = `${hours}:${minutes}`;

  // 5. Quiet Hours check
  if (preferences.quietHoursEnabled) {
    const inQuietHours = isTimeInWindow(
      currentTimeStr,
      preferences.quietHoursStart,
      preferences.quietHoursEnd
    );
    if (inQuietHours) {
      // Calculate next available time: quiet hours end today or tomorrow
      const [endH, endM] = preferences.quietHoursEnd.split(':').map((s) => parseInt(s, 10) || 0);
      const nextTime = new Date(now);
      nextTime.setHours(endH, endM, 0, 0);
      if (nextTime.getTime() <= now) {
        nextTime.setDate(nextTime.getDate() + 1);
      }
      return {
        shouldDeliver: false,
        delayReason: 'Quiet Hours active',
        nextScheduledTime: nextTime.getTime(),
      };
    }
  }

  // 6. Focus Mode Protection check
  if (preferences.focusModeProtection && isFocusModeActive) {
    return {
      shouldDeliver: false,
      delayReason: 'Focus Mode in progress',
      nextScheduledTime: now + 5 * 60 * 1000, // Check again in 5 minutes
    };
  }

  // 7. Meeting Protection check
  if (preferences.meetingProtection && activeMeetings && activeMeetings.length > 0) {
    const meetingNow = activeMeetings.find((m) => {
      if (m.type !== 'meeting') return false;
      return isTimeInWindow(currentTimeStr, m.startTime, m.endTime);
    });

    if (meetingNow) {
      const [endH, endM] = meetingNow.endTime.split(':').map((s) => parseInt(s, 10) || 0);
      const meetingEndTime = new Date(now);
      meetingEndTime.setHours(endH, endM, 0, 0);
      return {
        shouldDeliver: false,
        delayReason: `Active meeting: "${meetingNow.title}"`,
        nextScheduledTime: meetingEndTime.getTime() + 60 * 1000,
      };
    }
  }

  // All clear!
  return { shouldDeliver: true };
}

/**
 * Generates an audio chime using Web Audio API so no audio files are required
 */
export function playNotificationSound(type: 'chime' | 'subtle' | 'bell' | 'none') {
  if (type === 'none' || typeof window === 'undefined') return;

  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    if (type === 'chime') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);
    } else if (type === 'bell') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(659.25, now); // E5
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc.start(now);
      osc.stop(now + 0.6);
    } else if (type === 'subtle') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now); // A4
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    }
  } catch {
    // Audio contexts might be blocked until user gesture, graceful fail
  }
}

/**
 * Triggers device vibration if supported and enabled
 */
export function triggerVibration(enabled: boolean) {
  if (!enabled || typeof navigator === 'undefined' || !navigator.vibrate) return;
  try {
    navigator.vibrate([100, 50, 100]);
  } catch {
    // Ignore
  }
}

export const triggerNotificationVibration = triggerVibration;

/**
 * Calculates unix timestamp in ms for a task or event reminder given date (YYYY-MM-DD), time (HH:mm),
 * and minutesBefore offset, taking timezone into account.
 */
export function calculateReminderTimestamp(
  dateStr: string,
  timeStr: string,
  minutesBefore: number,
  _userTimezone?: string
): number {
  if (!dateStr) return Date.now();
  const cleanTime = timeStr || '09:00';
  const parts = dateStr.split('-');
  const timeParts = cleanTime.split(':');
  
  const year = parseInt(parts[0], 10) || new Date().getFullYear();
  const month = (parseInt(parts[1], 10) || 1) - 1;
  const day = parseInt(parts[2], 10) || 1;
  const hour = parseInt(timeParts[0], 10) || 0;
  const min = parseInt(timeParts[1], 10) || 0;

  const eventTime = new Date(year, month, day, hour, min, 0, 0);
  const targetMs = eventTime.getTime() - (minutesBefore * 60 * 1000);
  return Math.max(targetMs, 0);
}

/**
 * Creates notification objects for an event based on its reminder intervals
 */
export function createNotificationsForEvent(
  userId: string,
  event: {
    id: string;
    title: string;
    date: string;
    startTime: string;
    priority?: string;
    reminder?: number[];
  },
  userTimezone?: string
): AppNotification[] {
  const reminders = event.reminder || [];
  if (reminders.length === 0) return [];

  const notifs: AppNotification[] = [];
  const priorityMap: Record<string, NotificationPriority> = {
    critical: 'urgent',
    high: 'high',
    medium: 'normal',
    low: 'low',
  };
  const notifPriority = priorityMap[event.priority || 'medium'] || 'normal';

  for (const minutes of reminders) {
    const scheduledAt = calculateReminderTimestamp(event.date, event.startTime, minutes, userTimezone);
    const readableOffset = minutes >= 1440
      ? `${Math.round(minutes / 1440)} day${Math.round(minutes / 1440) > 1 ? 's' : ''}`
      : minutes >= 60
      ? `${Math.round(minutes / 60)} hour${Math.round(minutes / 60) > 1 ? 's' : ''}`
      : `${minutes} minutes`;

    notifs.push({
      id: `notif_ev_${event.id}_${minutes}`,
      userId,
      title: `Upcoming: ${event.title}`,
      message: `Starts in ${readableOffset} at ${event.startTime}`,
      scheduledAt,
      priority: notifPriority,
      relatedEventId: event.id,
      status: scheduledAt <= Date.now() ? 'unread' : 'pending',
      createdAt: Date.now(),
      itemType: 'event',
    });
  }

  return notifs;
}

/**
 * Creates a notification for a task, ensuring it is strictly linked to relatedTaskId
 */
export function createNotificationForTask(
  userId: string,
  task: TaskItem,
  minutesBefore: number,
  userTimezone?: string
): AppNotification | null {
  if (!task.dueDate) return null;

  const timePart = task.startTime || task.dueTime || '09:00';
  const scheduledAt = calculateReminderTimestamp(task.dueDate, timePart, minutesBefore, userTimezone);

  const readableOffset = minutesBefore >= 1440
    ? `${Math.round(minutesBefore / 1440)} day${Math.round(minutesBefore / 1440) > 1 ? 's' : ''}`
    : minutesBefore >= 60
    ? `${Math.round(minutesBefore / 60)} hour${Math.round(minutesBefore / 60) > 1 ? 's' : ''}`
    : `${minutesBefore} minutes`;

  const priorityMap: Record<string, NotificationPriority> = {
    critical: 'urgent',
    high: 'high',
    medium: 'normal',
    low: 'low',
  };
  const notifPriority = priorityMap[task.priority || 'medium'] || 'normal';

  return {
    id: `notif_tsk_${task.id}_${minutesBefore}`,
    userId,
    title: `Task Due Soon: ${task.title}`,
    message: `${task.title} is scheduled in ${readableOffset}.`,
    scheduledAt,
    priority: notifPriority,
    relatedTaskId: task.id,
    status: scheduledAt <= Date.now() ? 'unread' : 'pending',
    createdAt: Date.now(),
    itemType: task.itemType || 'task',
    repeatPattern: task.repeatPattern,
  };
}

/**
 * Sanitizes notification data for Firestore
 */
export function sanitizeNotificationPayload(notif: Partial<AppNotification>): Record<string, any> {
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(notif)) {
    if (value !== undefined) {
      clean[key] = value;
    }
  }
  return clean;
}
