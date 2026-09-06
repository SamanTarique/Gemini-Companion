import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  onSnapshot 
} from 'firebase/firestore';
import { auth, db, sanitizeFirestorePayload } from './lib/firebase';
import { 
  JournalEntry, 
  ExtractedTask, 
  ExtractedEvent,
  MoodType, 
  ActiveNavTab, 
  TaskItem, 
  DailyPlan, 
  FocusSession, 
  DailyReview, 
  UserPreferences, 
  DEFAULT_USER_PREFERENCES,
  AppNotification,
  WeatherData, 
  PriorityLevel,
  CalendarEvent,
  SuggestedAction,
  GmailDetectedItem
} from './types';
import { LandingPage } from './components/LandingPage';
import { Sidebar } from './components/Sidebar';
import { TopHeader } from './components/TopHeader';
import { CommandCenterHome } from './components/CommandCenterHome';
import { LiveSearchView } from './components/LiveSearchView';
import { CalendarView } from './components/CalendarView';
import { TasksManager } from './components/TasksManager';
import { DailyPlannerView } from './components/DailyPlannerView';
import { FocusTimerView } from './components/FocusTimerView';
import { JournalEditor } from './components/JournalEditor';
import { HistoryList } from './components/HistoryList';
import { ExtractedScheduleView } from './components/ExtractedScheduleView';
import { InsightsView } from './components/InsightsView';
import { ChatImportView } from './components/ChatImportView';
import { SettingsView } from './components/SettingsView';
import { NotificationCenter } from './components/NotificationCenter';
import { NotificationToast } from './components/NotificationToast';
import { SettingsModal } from './components/SettingsModal';
import { ThreatModelModal } from './components/ThreatModelModal';
import { DeleteDataModal } from './components/DeleteDataModal';
import { 
  evaluateNotificationContext, 
  playNotificationSound, 
  triggerNotificationVibration,
  createNotificationsForEvent,
  calculateReminderTimestamp,
  createNotificationForTask
} from './services/notificationService';
import { 
  registerPushServiceWorker, 
  deliverNativeBrowserNotification 
} from './services/fcmService';
import { parseDateKey, formatDateKey } from './services/recurrenceService';
import { WifiOff, PanelLeft } from 'lucide-react';

// User IANA timezone detected once
const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

function createBlankEntry(userId: string): JournalEntry {
  return {
    id: `entry_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    userId,
    title: '',
    content: '',
    mood: 'reflective',
    tags: ['reflection'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
    extractedTasks: [],
    extractedEvents: [],
    extractedDeadlines: [],
    timezone: detectedTimezone,
    summary: '',
  };
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<ActiveNavTab>('home');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Firestore Data Collections
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [currentEntry, setCurrentEntry] = useState<JournalEntry | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [plans, setPlans] = useState<DailyPlan[]>([]);
  const [focusSessions, setFocusSessions] = useState<FocusSession[]>([]);
  const [dailyReviews, setDailyReviews] = useState<DailyReview[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [calendarTargetDate, setCalendarTargetDate] = useState<string | undefined>();
  const [preferences, setPreferences] = useState<UserPreferences>({
    ...DEFAULT_USER_PREFERENCES,
    timezone: detectedTimezone,
  });

  // Notifications state
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);
  const [activeToast, setActiveToast] = useState<AppNotification | null>(null);

  // Weather state
  const [weather, setWeather] = useState<WeatherData | null>(null);

  // Status & error states
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modals state
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showThreatModel, setShowThreatModel] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Focus Timer active task pass-through
  const [focusTaskTitle, setFocusTaskTitle] = useState<string | undefined>();
  const [focusTaskId, setFocusTaskId] = useState<string | undefined>();

  // Connectivity state tracking
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Global Keyboard Shortcut: Ctrl+B or Cmd+B to toggle sidebar anywhere
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setIsSidebarOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 1. Listen for Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      if (currentUser) {
        setCurrentEntry(createBlankEntry(currentUser.uid));
      } else {
        setCurrentEntry(null);
        setEntries([]);
        setTasks([]);
        setPlans([]);
        setFocusSessions([]);
        setDailyReviews([]);
        setCalendarEvents([]);
        setNotifications([]);
      }
    });

    return () => unsubscribe();
  }, []);

  // 2. Fetch Weather
  const fetchWeather = useCallback(async (city?: string, lat?: number, lng?: number) => {
    try {
      let queryParam = '';
      if (typeof lat === 'number' && typeof lng === 'number') {
        queryParam = `lat=${lat}&lng=${lng}${city ? `&city=${encodeURIComponent(city)}` : ''}`;
      } else if (city && city.trim()) {
        queryParam = `city=${encodeURIComponent(city.trim())}`;
      } else {
        return;
      }
      const res = await fetch(`/api/weather?${queryParam}`);
      if (res.ok) {
        const data = await res.json();
        setWeather(data);
      }
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    if (user) {
      if (preferences.locationCity) {
        fetchWeather(preferences.locationCity);
      } else if (typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            fetchWeather(undefined, pos.coords.latitude, pos.coords.longitude);
          },
          () => {
            // User denied or unavailable - no fake default city
          },
          { timeout: 5000, maximumAge: 60000 }
        );
      }
    }
  }, [user, preferences.locationCity, fetchWeather]);

  // 3. Set up Real-time Firestore Listeners with Security Isolation
  useEffect(() => {
    if (!user) return;

    // A. Entries Listener (Sorted by updatedAt desc)
    const entriesRef = collection(db, 'users', user.uid, 'entries');
    const entriesQuery = query(entriesRef, orderBy('updatedAt', 'desc'));
    const unsubEntries = onSnapshot(
      entriesQuery,
      (snapshot) => {
        const loadedEntries: JournalEntry[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          loadedEntries.push({
            id: docSnap.id,
            userId: user.uid,
            title: d.title || 'Untitled Reflection',
            content: d.content || '',
            mood: d.mood || 'reflective',
            summary: d.summary,
            sentiment: d.sentiment,
            tags: Array.isArray(d.tags) ? d.tags : [],
            createdAt: d.createdAt || Date.now(),
            updatedAt: d.updatedAt || Date.now(),
            messages: Array.isArray(d.messages) ? d.messages : [],
            extractedTasks: Array.isArray(d.extractedTasks) ? d.extractedTasks : [],
            extractedEvents: Array.isArray(d.extractedEvents) ? d.extractedEvents : [],
            extractedDeadlines: Array.isArray(d.extractedDeadlines) ? d.extractedDeadlines : [],
            timezone: d.timezone || detectedTimezone,
          });
        });
        setEntries(loadedEntries);
        setCurrentEntry((prev) => {
          if (!prev) return loadedEntries[0] || null;
          const matching = loadedEntries.find((e) => e.id === prev.id);
          if (matching) return matching;
          // If current was a blank untouched entry and entries exist, pick the latest
          if (prev.messages.length === 0 && !prev.title.trim() && !prev.content.trim() && loadedEntries.length > 0) {
            return loadedEntries[0];
          }
          return prev;
        });
      },
      (err) => {
        console.warn('[Firestore] Entries listener caught error:', err.message);
      }
    );

    // B. Tasks Listener
    const tasksRef = collection(db, 'users', user.uid, 'tasks');
    const tasksQuery = query(tasksRef, orderBy('createdAt', 'desc'));
    const unsubTasks = onSnapshot(
      tasksQuery,
      (snapshot) => {
        const loadedTasks: TaskItem[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          loadedTasks.push({
            id: docSnap.id,
            userId: user.uid,
            title: d.title || 'Untitled Task',
            description: d.description,
            priority: d.priority || 'medium',
            category: d.category || 'work',
            itemType: d.itemType,
            dueDate: d.dueDate,
            dueTime: d.dueTime,
            startTime: d.startTime,
            endTime: d.endTime,
            repeatPattern: d.repeatPattern,
            repeatDays: d.repeatDays,
            reminderMinutesBefore: d.reminderMinutesBefore,
            location: d.location,
            estimatedMinutes: d.estimatedMinutes || 25,
            completed: !!d.completed,
            completedAt: d.completedAt,
            createdAt: d.createdAt || Date.now(),
            source: d.source || 'manual',
            subtasks: Array.isArray(d.subtasks) ? d.subtasks : undefined,
          });
        });
        setTasks(loadedTasks);
      },
      (err) => {
        console.warn('[Firestore] Tasks listener caught error:', err.message);
      }
    );

    // C. Daily Plans Listener
    const plansRef = collection(db, 'users', user.uid, 'plans');
    const plansQuery = query(plansRef, orderBy('updatedAt', 'desc'));
    const unsubPlans = onSnapshot(
      plansQuery,
      (snapshot) => {
        const loadedPlans: DailyPlan[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          loadedPlans.push({
            id: docSnap.id,
            userId: user.uid,
            dateStr: d.dateStr || '',
            blocks: Array.isArray(d.blocks) ? d.blocks : [],
            summary: d.summary || '',
            energyStrategy: d.energyStrategy || '',
            totalFocusMinutes: d.totalFocusMinutes || 0,
            totalBreakMinutes: d.totalBreakMinutes || 0,
            createdAt: d.createdAt || Date.now(),
            updatedAt: d.updatedAt || Date.now(),
          });
        });
        setPlans(loadedPlans);
      },
      (err) => {
        console.warn('[Firestore] Plans listener caught error:', err.message);
      }
    );

    // D. Focus Sessions Listener
    const focusRef = collection(db, 'users', user.uid, 'focusSessions');
    const focusQuery = query(focusRef, orderBy('completedAt', 'desc'));
    const unsubFocus = onSnapshot(
      focusQuery,
      (snapshot) => {
        const loadedFocus: FocusSession[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          loadedFocus.push({
            id: docSnap.id,
            userId: user.uid,
            durationMinutes: d.durationMinutes || 25,
            taskTitle: d.taskTitle,
            taskId: d.taskId,
            interrupted: !!d.interrupted,
            notes: d.notes,
            completedAt: d.completedAt || Date.now(),
          });
        });
        setFocusSessions(loadedFocus);
      },
      (err) => {
        console.warn('[Firestore] Focus listener caught error:', err.message);
      }
    );

    // E. Daily Reviews Listener
    const insightsRef = collection(db, 'users', user.uid, 'insights');
    const insightsQuery = query(insightsRef, orderBy('createdAt', 'desc'));
    const unsubInsights = onSnapshot(
      insightsQuery,
      (snapshot) => {
        const loadedReviews: DailyReview[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          loadedReviews.push({
            id: docSnap.id,
            userId: user.uid,
            dateStr: d.dateStr || '',
            type: d.type || 'morning_brief',
            headline: d.headline || '',
            summary: d.summary || '',
            highlights: Array.isArray(d.highlights) ? d.highlights : [],
            recommendations: Array.isArray(d.recommendations) ? d.recommendations : [],
            productivityScore: d.productivityScore,
            createdAt: d.createdAt || Date.now(),
          });
        });
        setDailyReviews(loadedReviews);
      },
      (err) => {
        console.warn('[Firestore] Insights listener caught error:', err.message);
      }
    );

    // F. Preferences Listener (syncs both 'settings' and 'main')
    const prefDocRef = doc(db, 'users', user.uid, 'preferences', 'settings');
    const unsubPrefs = onSnapshot(
      prefDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const d = docSnap.data();
          setPreferences((prev) => ({
            ...prev,
            ...d,
          }));
        }
      },
      (err) => {
        console.warn('[Firestore] Preferences listener caught error:', err.message);
      }
    );

    // G. Notifications Listener
    const notifsRef = collection(db, 'users', user.uid, 'notifications');
    const notifsQuery = query(notifsRef, orderBy('createdAt', 'desc'));
    const unsubNotifs = onSnapshot(
      notifsQuery,
      (snapshot) => {
        const loadedNotifs: AppNotification[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          loadedNotifs.push({
            id: docSnap.id,
            userId: user.uid,
            title: d.title || 'Notification',
            message: d.message || '',
            scheduledAt: d.scheduledAt || Date.now(),
            priority: d.priority || 'normal',
            status: d.status || 'unread',
            createdAt: d.createdAt || Date.now(),
            relatedTaskId: d.relatedTaskId,
            relatedEventId: d.relatedEventId,
            readAt: d.readAt,
            snoozedUntil: d.snoozedUntil,
            originalScheduledAt: d.originalScheduledAt,
            delayedReason: d.delayedReason,
            itemType: d.itemType,
            repeatPattern: d.repeatPattern,
          });
        });
        setNotifications(loadedNotifs);
      },
      (err) => {
        console.warn('[Firestore] Notifications listener caught error:', err.message);
      }
    );

    // H. Calendar Events Listener
    const eventsRef = collection(db, 'users', user.uid, 'events');
    const eventsQuery = query(eventsRef, orderBy('date', 'asc'));
    const unsubEvents = onSnapshot(
      eventsQuery,
      (snapshot) => {
        const loadedEvents: CalendarEvent[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          loadedEvents.push({
            id: docSnap.id,
            userId: user.uid,
            title: d.title || '',
            description: d.description || '',
            date: d.date || '',
            startTime: d.startTime || '09:00',
            endTime: d.endTime || '10:00',
            location: d.location || '',
            priority: d.priority || 'medium',
            repeat: d.repeat || { frequency: 'none' },
            reminder: Array.isArray(d.reminder) ? d.reminder : (Array.isArray(d.reminders) ? d.reminders : [15]),
            color: d.color,
            createdAt: d.createdAt || Date.now(),
            updatedAt: d.updatedAt || Date.now(),
          });
        });
        setCalendarEvents(loadedEvents);
      },
      (err) => {
        console.warn('[Firestore] Calendar events listener caught error:', err.message);
      }
    );

    return () => {
      unsubEntries();
      unsubTasks();
      unsubPlans();
      unsubFocus();
      unsubInsights();
      unsubPrefs();
      unsubNotifs();
      unsubEvents();
    };
  }, [user]);

  // Task Operations
  const handleAddTask = async (taskData: Omit<TaskItem, 'id' | 'createdAt' | 'userId'> & { userId?: string }) => {
    if (!user) return;
    const cleanTitle = (taskData.title || '').trim().toLowerCase();
    if (!cleanTitle) return;

    // Prevent duplicate uncompleted tasks with same title and date
    const isDuplicate = tasks.some(
      (t) =>
        !t.completed &&
        t.title.trim().toLowerCase() === cleanTitle &&
        (t.dueDate || '') === (taskData.dueDate || '')
    );
    if (isDuplicate) return;

    const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const taskDocRef = doc(db, 'users', user.uid, 'tasks', taskId);
    const sanitized = sanitizeFirestorePayload<TaskItem>({
      ...taskData,
      id: taskId,
      userId: user.uid,
      createdAt: Date.now(),
    });
    await setDoc(taskDocRef, sanitized);
  };

  const handleQuickAddTask = async (title: string, priority: PriorityLevel = 'medium') => {
    await handleAddTask({
      title,
      priority,
      category: 'work',
      estimatedMinutes: 25,
      completed: false,
      source: 'manual',
    });
  };

  const handleToggleTask = async (taskId: string) => {
    if (!user) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const taskDocRef = doc(db, 'users', user.uid, 'tasks', taskId);
    const updatedCompleted = !task.completed;
    await setDoc(
      taskDocRef,
      sanitizeFirestorePayload({
        completed: updatedCompleted,
        completedAt: updatedCompleted ? Date.now() : null,
      }),
      { merge: true }
    );

    // Auto-update or dismiss pending reminders for completed task
    const relatedNotifs = notifications.filter((n) => n.relatedTaskId === taskId);
    for (const notif of relatedNotifs) {
      if (updatedCompleted) {
        await setDoc(
          doc(db, 'users', user.uid, 'notifications', notif.id),
          { status: 'dismissed' },
          { merge: true }
        );
      } else if (notif.scheduledAt > Date.now()) {
        await setDoc(
          doc(db, 'users', user.uid, 'notifications', notif.id),
          { status: 'pending' },
          { merge: true }
        );
      }
    }
  };

  const handleUpdateTask = async (taskId: string, updates: Partial<TaskItem>) => {
    if (!user) return;
    const taskDocRef = doc(db, 'users', user.uid, 'tasks', taskId);
    await setDoc(taskDocRef, sanitizeFirestorePayload(updates), { merge: true });

    // Synchronize linked reminders if schedule, title, or reminder offset changed
    const existingTask = tasks.find((t) => t.id === taskId);
    if (existingTask) {
      const mergedTask = { ...existingTask, ...updates } as TaskItem;
      const relatedNotifs = notifications.filter((n) => n.relatedTaskId === taskId);

      for (const notif of relatedNotifs) {
        const reminderMin = mergedTask.reminderMinutesBefore ?? preferences.defaultReminderMinutesBefore ?? 15;
        const timePart = mergedTask.startTime || mergedTask.dueTime || '09:00';
        let targetTimeMs = notif.scheduledAt;

        if (mergedTask.dueDate) {
          targetTimeMs = calculateReminderTimestamp(
            mergedTask.dueDate,
            timePart,
            reminderMin,
            preferences.timezone
          );
        }

        await setDoc(
          doc(db, 'users', user.uid, 'notifications', notif.id),
          sanitizeFirestorePayload({
            title: `Upcoming: ${mergedTask.title}`,
            message: `${mergedTask.title} is scheduled in ${reminderMin} minutes.`,
            scheduledAt: targetTimeMs,
            priority: mergedTask.priority === 'critical' ? 'urgent' : mergedTask.priority === 'high' ? 'high' : 'normal',
            status: targetTimeMs <= Date.now() ? 'unread' : 'pending',
            updatedAt: Date.now(),
          }),
          { merge: true }
        );
      }
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!user) return;
    await deleteDoc(doc(db, 'users', user.uid, 'tasks', taskId));

    // Cancel and delete all pending reminders for this task
    const relatedNotifs = notifications.filter((n) => n.relatedTaskId === taskId);
    for (const notif of relatedNotifs) {
      await deleteDoc(doc(db, 'users', user.uid, 'notifications', notif.id));
    }
  };

  // Calendar Event Operations
  const handleCreateEvent = async (
    eventData: Omit<CalendarEvent, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ) => {
    if (!user) return;
    const cleanTitle = (eventData.title || '').trim().toLowerCase();
    if (!cleanTitle) return;

    // Prevent duplicate event creation on identical date, start time, and title
    const isDuplicate = calendarEvents.some(
      (e) =>
        e.date === eventData.date &&
        e.startTime === eventData.startTime &&
        e.title.trim().toLowerCase() === cleanTitle
    );
    if (isDuplicate) return;

    const eventId = `event_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newEvent: CalendarEvent = {
      ...eventData,
      id: eventId,
      userId: user.uid,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const eventDoc = doc(db, 'users', user.uid, 'events', eventId);
    await setDoc(eventDoc, sanitizeFirestorePayload(newEvent));

    // Auto-generate reminders if notifications and event reminders are set
    if (newEvent.reminder && newEvent.reminder.length > 0 && preferences.notificationsEnabled) {
      const notifs = createNotificationsForEvent(user.uid, newEvent, preferences.timezone);
      for (const n of notifs) {
        const notifDoc = doc(db, 'users', user.uid, 'notifications', n.id);
        await setDoc(notifDoc, sanitizeFirestorePayload(n));
      }
    }
  };

  const handleUpdateEvent = async (
    eventId: string,
    updates: Partial<CalendarEvent>,
    recurrenceMode?: 'this' | 'future' | 'all',
    occurrenceDate?: string
  ) => {
    if (!user) return;
    const existing = calendarEvents.find((e) => e.id === eventId);
    if (!existing) return;

    if (recurrenceMode === 'this' && occurrenceDate && existing.repeat && existing.repeat.frequency !== 'none') {
      const currentExceptions = existing.repeat.exceptions || [];
      if (!currentExceptions.includes(occurrenceDate)) {
        const updatedExceptions = [...currentExceptions, occurrenceDate];
        const origDoc = doc(db, 'users', user.uid, 'events', eventId);
        await setDoc(
          origDoc,
          sanitizeFirestorePayload({
            repeat: {
              ...existing.repeat,
              exceptions: updatedExceptions,
            },
            updatedAt: Date.now(),
          }),
          { merge: true }
        );
      }

      const standaloneId = `event_override_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const standaloneEvent: CalendarEvent = {
        ...existing,
        ...updates,
        id: standaloneId,
        userId: user.uid,
        date: updates.date || occurrenceDate,
        repeat: { frequency: 'none' },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const newDoc = doc(db, 'users', user.uid, 'events', standaloneId);
      await setDoc(newDoc, sanitizeFirestorePayload(standaloneEvent));
    } else if (recurrenceMode === 'future' && occurrenceDate && existing.repeat && existing.repeat.frequency !== 'none') {
      const origDate = parseDateKey(occurrenceDate);
      origDate.setDate(origDate.getDate() - 1);
      const untilStr = formatDateKey(origDate);

      const origDoc = doc(db, 'users', user.uid, 'events', eventId);
      await setDoc(
        origDoc,
        sanitizeFirestorePayload({
          repeat: {
            ...existing.repeat,
            until: untilStr,
          },
          updatedAt: Date.now(),
        }),
        { merge: true }
      );

      const futureId = `event_series_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const newFutureEvent: CalendarEvent = {
        ...existing,
        ...updates,
        id: futureId,
        userId: user.uid,
        date: updates.date || occurrenceDate,
        repeat: updates.repeat || existing.repeat,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const futureDoc = doc(db, 'users', user.uid, 'events', futureId);
      await setDoc(futureDoc, sanitizeFirestorePayload(newFutureEvent));
    } else {
      const eventDoc = doc(db, 'users', user.uid, 'events', eventId);
      await setDoc(
        eventDoc,
        sanitizeFirestorePayload({
          ...updates,
          updatedAt: Date.now(),
        }),
        { merge: true }
      );
    }
  };

  const handleDeleteEvent = async (
    eventId: string,
    recurrenceMode?: 'this' | 'future' | 'all',
    occurrenceDate?: string
  ) => {
    if (!user) return;
    const existing = calendarEvents.find((e) => e.id === eventId);
    if (!existing) return;

    if (recurrenceMode === 'this' && occurrenceDate && existing.repeat && existing.repeat.frequency !== 'none') {
      const currentExceptions = existing.repeat.exceptions || [];
      if (!currentExceptions.includes(occurrenceDate)) {
        const updatedExceptions = [...currentExceptions, occurrenceDate];
        const eventDoc = doc(db, 'users', user.uid, 'events', eventId);
        await setDoc(
          eventDoc,
          sanitizeFirestorePayload({
            repeat: {
              ...existing.repeat,
              exceptions: updatedExceptions,
            },
            updatedAt: Date.now(),
          }),
          { merge: true }
        );
      }
    } else if (recurrenceMode === 'future' && occurrenceDate && existing.repeat && existing.repeat.frequency !== 'none') {
      const origDate = parseDateKey(occurrenceDate);
      origDate.setDate(origDate.getDate() - 1);
      const untilStr = formatDateKey(origDate);

      const eventDoc = doc(db, 'users', user.uid, 'events', eventId);
      await setDoc(
        eventDoc,
        sanitizeFirestorePayload({
          repeat: {
            ...existing.repeat,
            until: untilStr,
          },
          updatedAt: Date.now(),
        }),
        { merge: true }
      );
    } else {
      await deleteDoc(doc(db, 'users', user.uid, 'events', eventId));
      // Delete all pending reminders for this deleted event
      const relatedNotifs = notifications.filter((n) => n.relatedEventId === eventId);
      for (const n of relatedNotifs) {
        await deleteDoc(doc(db, 'users', user.uid, 'notifications', n.id));
      }
    }
  };

  const handleApproveSuggestedAction = async (action: SuggestedAction) => {
    if (!user) return;
    if (action.type === 'event') {
      const today = new Date().toISOString().split('T')[0];
      await handleCreateEvent({
        title: action.title,
        description: action.description || (action.reason ? `Extracted from search: ${action.reason}` : ''),
        date: action.date || today,
        startTime: action.startTime || '09:00',
        endTime: action.endTime || '10:00',
        priority: action.priority || 'medium',
        repeat: { frequency: 'none' },
        reminder: [15],
      });
    } else {
      await handleAddTask({
        title: action.title,
        description: action.description || action.reason,
        dueDate: action.date,
        dueTime: action.startTime,
        priority: action.priority || 'medium',
        category: action.category || 'work',
        estimatedMinutes: 25,
        completed: false,
        source: 'live_search',
      });
    }
  };

  const handleApproveGmailCommitment = async (item: GmailDetectedItem) => {
    if (!user) return;
    if (item.type === 'event') {
      const today = new Date().toISOString().split('T')[0];
      await handleCreateEvent({
        title: item.title,
        description: item.description || `Extracted from email (${item.sourceEmail.from}: "${item.sourceEmail.subject}")`,
        date: item.date || today,
        startTime: item.startTime || '09:00',
        endTime: item.endTime || '10:00',
        priority: item.priority || 'medium',
        repeat: { frequency: 'none' },
        reminder: [15],
      });
    } else {
      await handleAddTask({
        title: item.title,
        description: item.description || `From email: ${item.sourceEmail.subject}`,
        dueDate: item.date,
        dueTime: item.startTime,
        priority: item.priority || 'medium',
        category: 'work',
        estimatedMinutes: 25,
        completed: false,
        source: 'gmail',
      });
    }
  };

  const handleImportGoogleCalendarEvents = async (importedEvents: CalendarEvent[]) => {
    if (!user) return;
    for (const ev of importedEvents) {
      // Find matching existing event by ID or by same date, startTime, and title
      const existing = calendarEvents.find(
        (e) =>
          e.id === ev.id ||
          (e.date === ev.date &&
            e.startTime === ev.startTime &&
            e.title.trim().toLowerCase() === ev.title.trim().toLowerCase())
      );
      const targetId = existing ? existing.id : ev.id;
      const eventDoc = doc(db, 'users', user.uid, 'events', targetId);
      await setDoc(
        eventDoc,
        sanitizeFirestorePayload({
          ...ev,
          id: targetId,
          userId: user.uid,
          updatedAt: Date.now(),
        }),
        { merge: true }
      );
    }
  };

  const handleNavigateToCalendar = (dateStr?: string) => {
    if (dateStr) setCalendarTargetDate(dateStr);
    setActiveTab('calendar');
  };

  const handleClearCompletedTasks = async () => {
    if (!user) return;
    const completed = tasks.filter((t) => t.completed);
    for (const t of completed) {
      await deleteDoc(doc(db, 'users', user.uid, 'tasks', t.id));
      const relatedNotifs = notifications.filter((n) => n.relatedTaskId === t.id);
      for (const n of relatedNotifs) {
        await deleteDoc(doc(db, 'users', user.uid, 'notifications', n.id));
      }
    }
  };

  const handleClearAllTasks = async () => {
    if (!user) return;
    for (const t of tasks) {
      await deleteDoc(doc(db, 'users', user.uid, 'tasks', t.id));
    }
  };

  const handleImportExtractedTasks = async (
    newTasks: (Omit<TaskItem, 'id' | 'createdAt' | 'userId'> & { userId?: string })[]
  ) => {
    for (const t of newTasks) {
      // Prevent duplicates by title check
      const isDuplicate = tasks.some(
        (existing) => existing.title.trim().toLowerCase() === t.title.trim().toLowerCase()
      );
      if (!isDuplicate) {
        await handleAddTask(t);
      }
    }
  };

  // Plan Operations
  const handleSavePlan = async (plan: DailyPlan) => {
    if (!user) return;
    const planId = plan.id || `plan_${Date.now()}`;
    const planDocRef = doc(db, 'users', user.uid, 'plans', planId);
    const sanitized = sanitizeFirestorePayload<DailyPlan>({
      ...plan,
      id: planId,
      userId: user.uid,
      updatedAt: Date.now(),
    });
    await setDoc(planDocRef, sanitized, { merge: true });
  };

  const handleClearPlan = async () => {
    if (!user) return;
    for (const p of plans) {
      await deleteDoc(doc(db, 'users', user.uid, 'plans', p.id));
    }
  };

  // Focus Session Operations
  const handleLogFocusSession = async (sessionData: Omit<FocusSession, 'id' | 'completedAt'>) => {
    if (!user) return;
    const sessionId = `focus_${Date.now()}`;
    const sessionDocRef = doc(db, 'users', user.uid, 'focusSessions', sessionId);
    const sanitized = sanitizeFirestorePayload<FocusSession>({
      ...sessionData,
      id: sessionId,
      userId: user.uid,
      completedAt: Date.now(),
    });
    await setDoc(sessionDocRef, sanitized);
  };

  // Daily Review Operations
  const handleSaveDailyReview = async (review: DailyReview) => {
    if (!user) return;
    const reviewId = review.id || `review_${Date.now()}`;
    const reviewDocRef = doc(db, 'users', user.uid, 'insights', reviewId);
    const sanitized = sanitizeFirestorePayload<DailyReview>({
      ...review,
      id: reviewId,
      userId: user.uid,
      createdAt: Date.now(),
    });
    await setDoc(reviewDocRef, sanitized);
  };

  const handleDeleteDailyReview = async (reviewId: string) => {
    if (!user) return;
    await deleteDoc(doc(db, 'users', user.uid, 'insights', reviewId));
  };

  // Preferences Operations
  const handleUpdatePreferences = async (updates: Partial<UserPreferences>) => {
    if (!user) return;
    const prefSettingsRef = doc(db, 'users', user.uid, 'preferences', 'settings');
    const prefMainRef = doc(db, 'users', user.uid, 'preferences', 'main');
    const updated = { ...preferences, ...updates };
    setPreferences(updated);
    await setDoc(prefSettingsRef, sanitizeFirestorePayload(updated), { merge: true });
    await setDoc(prefMainRef, sanitizeFirestorePayload(updated), { merge: true });
    if (updates.locationCity) {
      fetchWeather(updates.locationCity);
    }
  };

  // Notification Operations
  const handleMarkNotificationAsRead = async (notificationId: string) => {
    if (!user) return;
    const notifRef = doc(db, 'users', user.uid, 'notifications', notificationId);
    await setDoc(notifRef, { status: 'read', readAt: Date.now() }, { merge: true });
  };

  const handleMarkAllNotificationsAsRead = async () => {
    if (!user) return;
    const unread = notifications.filter((n) => n.status === 'unread' || n.status === 'pending');
    for (const n of unread) {
      const notifRef = doc(db, 'users', user.uid, 'notifications', n.id);
      await setDoc(notifRef, { status: 'read', readAt: Date.now() }, { merge: true });
    }
  };

  const handleSnoozeNotification = async (notificationId: string, customMinutes?: number) => {
    if (!user) return;
    const minutes = customMinutes || preferences.snoozeDurationMinutes || 10;
    const snoozedUntil = Date.now() + minutes * 60 * 1000;
    const notifRef = doc(db, 'users', user.uid, 'notifications', notificationId);
    await setDoc(notifRef, { 
      status: 'snoozed', 
      snoozedUntil 
    }, { merge: true });
    if (activeToast?.id === notificationId) {
      setActiveToast(null);
    }
  };

  const handleDismissNotification = async (notificationId: string) => {
    if (!user) return;
    const notifRef = doc(db, 'users', user.uid, 'notifications', notificationId);
    await setDoc(notifRef, { status: 'dismissed' }, { merge: true });
    if (activeToast?.id === notificationId) {
      setActiveToast(null);
    }
  };

  const handleCreateNotification = async (
    data: Omit<AppNotification, 'id' | 'createdAt' | 'userId'>
  ) => {
    if (!user) return;
    try {
      // Backend validation & sanitization
      let sanitizedData: any = data;
      try {
        const resp = await fetch('/api/notifications/verify-and-schedule', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${user.uid}`,
          },
          body: JSON.stringify(data),
        });
        if (resp.ok) {
          const json = await resp.json();
          if (json.sanitized) {
            sanitizedData = json.sanitized;
          }
        }
      } catch (networkErr) {
        // Fallback to client sanitization for offline resilience
      }

      const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const notifRef = doc(db, 'users', user.uid, 'notifications', notifId);
      const sanitized = sanitizeFirestorePayload<AppNotification>({
        ...sanitizedData,
        id: notifId,
        userId: user.uid,
        createdAt: Date.now(),
      });
      await setDoc(notifRef, sanitized);
    } catch (err) {
      console.warn('Failed to schedule notification:', err);
    }
  };

  const handleClearDismissedNotifications = async () => {
    if (!user) return;
    const dismissed = notifications.filter((n) => n.status === 'dismissed');
    for (const n of dismissed) {
      await deleteDoc(doc(db, 'users', user.uid, 'notifications', n.id));
    }
  };

  const handleTestNotification = () => {
    playNotificationSound(preferences.soundPreference);
    triggerNotificationVibration(preferences.vibrationPreference);
    const testNotif: AppNotification = {
      id: `test_${Date.now()}`,
      userId: user?.uid || 'guest',
      title: 'Reminder System Ready',
      message: 'Push alerts, audio chimes, and smart delivery rules are functioning.',
      scheduledAt: Date.now(),
      priority: 'high',
      status: 'unread',
      createdAt: Date.now(),
      itemType: 'focus',
      deliveredAt: Date.now(),
      deliveryConfirmed: true,
    };
    setActiveToast(testNotif);
    deliverNativeBrowserNotification(testNotif, (taskId, eventId) => {
      if (taskId) setActiveTab('tasks');
      else if (eventId) setActiveTab('calendar');
    });
  };

  // Register push service worker
  useEffect(() => {
    registerPushServiceWorker();
  }, []);

  // Background Evaluation Loop for Notifications
  const announcedNotifIds = React.useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user || !preferences.notificationsEnabled) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const currentActivePlan = plans[0] || null;

      notifications.forEach((notif) => {
        const isPending = notif.status === 'pending';
        const isSnoozeExpired = notif.status === 'snoozed' && notif.snoozedUntil && now >= notif.snoozedUntil;
        const isDue = notif.scheduledAt <= now;

        if ((isPending || isSnoozeExpired) && isDue && !announcedNotifIds.current.has(notif.id)) {
          const evalResult = evaluateNotificationContext(notif, {
            now,
            preferences,
            isFocusModeActive: activeTab === 'focus',
            activeMeetings: currentActivePlan?.blocks || [],
          });

          if (evalResult.shouldDeliver) {
            announcedNotifIds.current.add(notif.id);
            playNotificationSound(preferences.soundPreference);
            triggerNotificationVibration(preferences.vibrationPreference);
            setActiveToast(notif);

            // Confirmed push delivery
            deliverNativeBrowserNotification(notif, (taskId, eventId) => {
              if (taskId) setActiveTab('tasks');
              else if (eventId) setActiveTab('calendar');
            }).then((result) => {
              const notifRef = doc(db, 'users', user.uid, 'notifications', notif.id);
              setDoc(
                notifRef,
                sanitizeFirestorePayload({
                  status: 'unread',
                  readAt: null,
                  deliveredAt: Date.now(),
                  deliveryConfirmed: result.delivered,
                }),
                { merge: true }
              );
            });
          } else if (evalResult.delayReason && notif.delayedReason !== evalResult.delayReason) {
            const notifRef = doc(db, 'users', user.uid, 'notifications', notif.id);
            setDoc(notifRef, sanitizeFirestorePayload({ delayedReason: evalResult.delayReason }), { merge: true });
          }
        }
      });
    }, 15000);

    return () => clearInterval(interval);
  }, [user, notifications, preferences, plans, activeTab]);

  // Automatic smart reminder generation for scheduled tasks and deadlines
  useEffect(() => {
    if (!user || !preferences.notificationsEnabled) return;

    tasks.forEach((task) => {
      if (task.completed) return;

      const reminderMin =
        task.reminderMinutesBefore ??
        (preferences.deadlineRemindersEnabled ? preferences.defaultReminderMinutesBefore : undefined);
      if (reminderMin === undefined) return;

      const notifExisting = notifications.find((n) => n.relatedTaskId === task.id);
      if (notifExisting) return;

      let targetTimeMs: number | null = null;
      if (task.dueDate) {
        const timePart = task.startTime || task.dueTime || '09:00';
        const dateObj = new Date(`${task.dueDate}T${timePart}:00`);
        if (!isNaN(dateObj.getTime())) {
          targetTimeMs = dateObj.getTime() - reminderMin * 60 * 1000;
        }
      }

      if (targetTimeMs && targetTimeMs > Date.now() - 3600000) {
        handleCreateNotification({
          title: `Upcoming: ${task.title}`,
          message: `${task.title} is scheduled in ${reminderMin} minutes.`,
          scheduledAt: targetTimeMs,
          priority: task.priority === 'critical' ? 'urgent' : task.priority === 'high' ? 'high' : 'normal',
          status: targetTimeMs <= Date.now() ? 'unread' : 'pending',
          relatedTaskId: task.id,
          itemType: task.itemType || 'task',
          repeatPattern: task.repeatPattern,
        });
      }
    });
  }, [user, tasks, notifications, preferences]);

  // Journal Operations
  const handleUpdateEntry = useCallback((updated: Partial<JournalEntry>) => {
    setCurrentEntry((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        ...updated,
        updatedAt: Date.now(),
      };
    });
    setSaveStatus('idle');
  }, []);

  const handleSaveEntry = async (entryOverride?: JournalEntry) => {
    if (!user) return;
    const entryToSave = entryOverride || currentEntry;
    if (!entryToSave) return;

    if (!entryToSave.title.trim() && !entryToSave.content.trim() && entryToSave.messages.length === 0) {
      return;
    }

    try {
      setSaveStatus('saving');
      setErrorMessage(null);
      if (entryOverride) {
        setCurrentEntry(entryOverride);
      }

      const entryDocRef = doc(db, 'users', user.uid, 'entries', entryToSave.id);
      const sanitized = sanitizeFirestorePayload<JournalEntry>({
        ...entryToSave,
        userId: user.uid,
        updatedAt: Date.now(),
        timezone: preferences.timezone || detectedTimezone,
      });

      await setDoc(entryDocRef, sanitized, { merge: true });
      setSaveStatus('saved');
    } catch (err: any) {
      setSaveStatus('error');
      setErrorMessage(err?.message || 'Database write error');
    }
  };

  const handleNewEntry = () => {
    if (!user) return;
    const fresh = createBlankEntry(user.uid);
    setCurrentEntry(fresh);
    setSaveStatus('idle');
    setActiveTab('journal');
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'entries', entryId));
      if (currentEntry?.id === entryId) {
        handleNewEntry();
      }
    } catch (err: any) {
      alert(`Failed to delete entry: ${err.message}`);
    }
  };

  const handleClearAllEntries = async () => {
    if (!user) return;
    for (const e of entries) {
      await deleteDoc(doc(db, 'users', user.uid, 'entries', e.id));
    }
    handleNewEntry();
  };

  const handleToggleEntryTask = async (taskId: string) => {
    if (!currentEntry) return;
    const updatedTasks = (currentEntry.extractedTasks || []).map((t) =>
      t.id === taskId ? { ...t, completed: !t.completed } : t
    );
    handleUpdateEntry({ extractedTasks: updatedTasks });
  };

  // Launch Focus Mode with specific task
  const handleStartFocus = (taskTitle?: string, taskId?: string) => {
    setFocusTaskTitle(taskTitle);
    setFocusTaskId(taskId);
    setActiveTab('focus');
  };

  // Open Journal with preloaded thought prompt
  const handleOpenJournalWithPrompt = (prompt: string) => {
    if (!currentEntry) {
      if (user) setCurrentEntry(createBlankEntry(user.uid));
    }
    handleUpdateEntry({
      content: currentEntry?.content ? `${currentEntry.content}\n\n${prompt}` : prompt,
      title: currentEntry?.title || prompt.slice(0, 40),
    });
    setActiveTab('journal');
  };

  // Memoized combined events from journal and calendar
  const allJournalEvents = useMemo(() => {
    const journalExtracted = entries.flatMap((e) => e.extractedEvents || []);
    const calConverted: ExtractedEvent[] = calendarEvents.map((ce) => ({
      id: ce.id,
      title: ce.title,
      dateTime: `${ce.date} ${ce.startTime}`,
      location: ce.location,
    }));
    return [...journalExtracted, ...calConverted];
  }, [entries, calendarEvents]);

  // Loading Screen during Firebase Auth initialization
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-zinc-800 border-t-amber-400 rounded-full animate-spin" />
          <p className="text-xs font-medium text-zinc-500 font-mono tracking-wider uppercase">
            Initializing secure session...
          </p>
        </div>
      </div>
    );
  }

  // Unauthenticated Landing View
  if (!user) {
    return (
      <>
        <LandingPage onOpenThreatModel={() => setShowThreatModel(true)} />
        <ThreatModelModal
          isOpen={showThreatModel}
          onClose={() => setShowThreatModel(false)}
        />
      </>
    );
  }

  const latestPlan = plans[0] || null;
  const allJournalDeadlines = entries.flatMap((e) => e.extractedDeadlines || []);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-zinc-100 flex overflow-hidden selection:bg-zinc-800 selection:text-zinc-100 font-sans">
      {/* ChatGPT-style Left Sidebar */}
      <Sidebar
        user={user}
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab)}
        entries={entries}
        currentEntryId={currentEntry?.id || null}
        onSelectEntry={(entry) => {
          setCurrentEntry(entry);
          setSaveStatus('saved');
          setActiveTab('journal');
        }}
        onNewChat={handleNewEntry}
        onDeleteEntry={handleDeleteEntry}
        onClearAllEntries={handleClearAllEntries}
        onOpenSettings={() => setActiveTab('settings')}
        onOpenThreatModel={() => setShowThreatModel(true)}
        onOpenDeleteData={() => setShowDeleteModal(true)}
        isOpen={isSidebarOpen}
        onToggleOpen={() => setIsSidebarOpen((prev) => !prev)}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Right Content Panel with responsive sidebar clearance */}
      <div className={`flex-1 flex flex-col min-w-0 h-screen overflow-hidden transition-all duration-300 ease-in-out ${
        isSidebarOpen ? 'lg:pl-64 sm:lg:pl-72' : 'lg:pl-16'
      }`}>
        {/* Top Header */}
        <TopHeader
          activeTab={activeTab}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
          onNewChat={handleNewEntry}
          onOpenSettings={() => setActiveTab('settings')}
          onOpenThreatModel={() => setShowThreatModel(true)}
          userTimezone={preferences.timezone || detectedTimezone}
          unreadNotificationCount={notifications.filter((n) => n.status === 'unread').length}
          onOpenNotifications={() => setIsNotificationCenterOpen(true)}
        />

        {/* Offline Status Warning Bar */}
        {!isOnline && (
          <div
            role="status"
            aria-live="polite"
            className="bg-amber-950/80 border-b border-amber-500/30 px-4 py-2 text-center text-xs font-medium text-amber-200 flex items-center justify-center gap-2"
          >
            <WifiOff className="w-3.5 h-3.5 shrink-0 text-amber-400" />
            <span>You are currently working offline. Changes will automatically sync with Cloud Firestore when your connection is restored.</span>
          </div>
        )}

        {/* Scrollable View Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 no-scrollbar">
          <div className="max-w-6xl mx-auto w-full">
            {activeTab === 'home' && (
              <CommandCenterHome
                userName={user.displayName || 'Friend'}
                userTimezone={preferences.timezone || detectedTimezone}
                tasks={tasks}
                currentPlan={latestPlan}
                events={allJournalEvents}
                calendarEvents={calendarEvents}
                deadlines={allJournalDeadlines}
                preferences={preferences}
                weather={weather}
                onRefreshWeather={() => fetchWeather(preferences.locationCity)}
                onNavigateTab={(tab) => setActiveTab(tab)}
                onStartFocus={handleStartFocus}
                onToggleTask={handleToggleTask}
                onAddTask={handleAddTask}
                onUpdateTask={handleUpdateTask}
                onDeleteTask={handleDeleteTask}
                onSavePlan={handleSavePlan}
                onCreateEvent={handleCreateEvent}
                onUpdateEvent={handleUpdateEvent}
                onDeleteEvent={handleDeleteEvent}
                onOpenJournalWithPrompt={handleOpenJournalWithPrompt}
                dailyReviews={dailyReviews}
              />
            )}

            {activeTab === 'search' && (
              <LiveSearchView
                tasks={tasks}
                events={calendarEvents}
                preferences={preferences}
                onApproveAction={handleApproveSuggestedAction}
              />
            )}

            {activeTab === 'calendar' && (
              <div className="h-[calc(100vh-6rem)] rounded-2xl border border-zinc-800/80 overflow-hidden shadow-2xl">
                <CalendarView
                  initialDate={calendarTargetDate}
                  events={calendarEvents}
                  tasks={tasks}
                  userPreferences={preferences}
                  onCreateEvent={handleCreateEvent}
                  onUpdateEvent={handleUpdateEvent}
                  onDeleteEvent={handleDeleteEvent}
                  onStartFocus={handleStartFocus}
                  onNavigateToTasks={() => setActiveTab('tasks')}
                />
              </div>
            )}

            {activeTab === 'tasks' && (
              <TasksManager
                tasks={tasks}
                onAddTask={handleAddTask}
                onToggleTask={handleToggleTask}
                onUpdateTask={handleUpdateTask}
                onDeleteTask={handleDeleteTask}
                onClearCompletedTasks={handleClearCompletedTasks}
                onClearAllTasks={handleClearAllTasks}
                onStartFocus={handleStartFocus}
                onNavigateToCalendar={handleNavigateToCalendar}
              />
            )}

            {activeTab === 'planner' && (
              <DailyPlannerView
                currentPlan={latestPlan}
                tasks={tasks}
                events={allJournalEvents}
                userTimezone={preferences.timezone || detectedTimezone}
                userPreferences={preferences}
                onSavePlan={handleSavePlan}
                onClearPlan={handleClearPlan}
                onStartFocus={handleStartFocus}
                dailyReviews={dailyReviews}
              />
            )}

            {activeTab === 'focus' && (
              <FocusTimerView
                initialTaskTitle={focusTaskTitle}
                initialTaskId={focusTaskId}
                tasks={tasks}
                onLogFocusSession={handleLogFocusSession}
                onCompleteTask={handleToggleTask}
                onExitFocus={() => setActiveTab('home')}
              />
            )}

            {activeTab === 'journal' && (
              <div className="animate-fadeIn">
                {currentEntry && (
                  <JournalEditor
                    currentEntry={currentEntry}
                    onUpdateEntry={handleUpdateEntry}
                    onSaveEntry={handleSaveEntry}
                    onNewEntry={handleNewEntry}
                    onNavigateTab={(tab) => setActiveTab(tab)}
                    onImportTasks={(extractedList) => {
                      handleImportExtractedTasks(
                        extractedList.map((t) => ({
                          title: t.title,
                          priority: t.priority || 'medium',
                          category: (t as any).category || 'work',
                          dueDate: t.dueDate,
                          dueTime: (t as any).dueTime,
                          estimatedMinutes: t.estimatedMinutes || 25,
                          completed: false,
                          source: 'journal_extracted',
                          sourceEntryId: (t as any).sourceEntryId || currentEntry.id,
                          journalEntryId: (t as any).journalEntryId || currentEntry.id,
                        }))
                      );
                    }}
                    onAddCalendarEvent={handleCreateEvent}
                    onUpdateCalendarEvent={handleUpdateEvent}
                    onDeleteCalendarEvent={handleDeleteEvent}
                    onAddTask={handleAddTask}
                    onUpdateTask={handleUpdateTask}
                    onDeleteTask={handleDeleteTask}
                    onSavePlan={handleSavePlan}
                    onStartFocus={handleStartFocus}
                    currentPlan={latestPlan}
                    existingTasks={tasks}
                    existingEvents={calendarEvents}
                    saveStatus={saveStatus}
                    errorMessage={errorMessage}
                    userTimezone={preferences.timezone || detectedTimezone}
                    userPreferences={preferences}
                  />
                )}
              </div>
            )}

            {activeTab === 'history' && (
              <div className="animate-fadeIn p-4 sm:p-6 max-w-6xl mx-auto w-full">
                <HistoryList
                  entries={entries}
                  currentEntryId={currentEntry?.id || null}
                  onSelectEntry={(entry) => {
                    setCurrentEntry(entry);
                    setSaveStatus('saved');
                    setActiveTab('journal');
                  }}
                  onDeleteEntry={handleDeleteEntry}
                />
              </div>
            )}

            {activeTab === 'insights' && (
              <InsightsView
                tasks={tasks}
                calendarEvents={calendarEvents}
                focusSessions={focusSessions}
                entries={entries}
                dailyReviews={dailyReviews}
                userTimezone={preferences.timezone || detectedTimezone}
                preferences={preferences}
                weather={weather}
                onSaveDailyReview={handleSaveDailyReview}
                onUpdateTask={handleUpdateTask}
                onNavigateTab={(tab) => setActiveTab(tab)}
                onPlanDay={() => setActiveTab('planner')}
                onDeleteDailyReview={handleDeleteDailyReview}
              />
            )}

            {activeTab === 'import' && (
              <ChatImportView
                userTimezone={preferences.timezone || detectedTimezone}
                onImportExtractedTasks={handleImportExtractedTasks}
                onNavigateTab={(tab) => setActiveTab(tab)}
              />
            )}

            {activeTab === 'settings' && (
              <div className="animate-fadeIn">
                <SettingsView
                  preferences={preferences}
                  onUpdatePreferences={handleUpdatePreferences}
                  entries={entries}
                  tasks={tasks}
                  plans={plans}
                  focusSessions={focusSessions}
                  userId={user?.uid}
                  onOpenThreatModel={() => setShowThreatModel(true)}
                  onOpenDeleteDataModal={() => setShowDeleteModal(true)}
                  onImportCalendarEvents={handleImportGoogleCalendarEvents}
                  onApproveCommitment={handleApproveGmailCommitment}
                />
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Modals */}
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        preferences={preferences}
        onUpdatePreferences={handleUpdatePreferences}
        entries={entries}
        tasks={tasks}
        plans={plans}
        focusSessions={focusSessions}
        onOpenThreatModel={() => setShowThreatModel(true)}
        onOpenDeleteDataModal={() => setShowDeleteModal(true)}
      />

      <ThreatModelModal
        isOpen={showThreatModel}
        onClose={() => setShowThreatModel(false)}
      />

      <DeleteDataModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        userId={user.uid}
        onDataDeleted={() => {
          setEntries([]);
          setTasks([]);
          setPlans([]);
          setCalendarEvents([]);
          setFocusSessions([]);
          setDailyReviews([]);
          setNotifications([]);
          handleNewEntry();
        }}
      />

      {/* Notification Center Slide-over Drawer */}
      <NotificationCenter
        isOpen={isNotificationCenterOpen}
        onClose={() => setIsNotificationCenterOpen(false)}
        notifications={notifications}
        tasks={tasks}
        events={calendarEvents}
        preferences={preferences}
        onMarkAsRead={handleMarkNotificationAsRead}
        onMarkAllAsRead={handleMarkAllNotificationsAsRead}
        onSnooze={handleSnoozeNotification}
        onDismiss={handleDismissNotification}
        onClearDismissed={handleClearDismissedNotifications}
        onTestNotification={handleTestNotification}
        snoozeDurationMinutes={preferences.snoozeDurationMinutes || 10}
        quietHoursActive={preferences.quietHoursEnabled}
        focusModeActive={activeTab === 'focus'}
        onNavigateToItem={(taskId, eventId) => {
          setIsNotificationCenterOpen(false);
          if (taskId) {
            setActiveTab('tasks');
          } else if (eventId) {
            setActiveTab('calendar');
          } else {
            setActiveTab('planner');
          }
        }}
        onCreateCustomReminder={(data) =>
          handleCreateNotification({
            ...data,
            status: data.scheduledAt <= Date.now() ? 'unread' : 'pending',
          })
        }
      />

      {/* Floating Notification Toast */}
      {activeToast && (
        <NotificationToast
          notification={activeToast}
          onDismiss={() => setActiveToast(null)}
          onMarkAsRead={(id) => {
            handleMarkNotificationAsRead(id);
            setActiveToast(null);
          }}
          onSnooze={(id, minutes) => {
            handleSnoozeNotification(id, minutes);
            setActiveToast(null);
          }}
          snoozeMinutes={preferences.snoozeDurationMinutes || 10}
          onOpenItem={(taskId, eventId) => {
            setActiveToast(null);
            if (taskId) {
              setActiveTab('tasks');
            } else if (eventId) {
              setActiveTab('calendar');
            } else {
              setActiveTab('planner');
            }
          }}
        />
      )}

      {/* Floating Quick-Open Menu Button (always easily accessible in fullscreen or on any device) */}
      {!isSidebarOpen && (
        <button
          id="floating-sidebar-open-btn"
          onClick={() => setIsSidebarOpen(true)}
          className="fixed bottom-5 left-5 z-40 p-2.5 bg-zinc-900/95 hover:bg-zinc-800 text-amber-400 hover:text-amber-300 border border-zinc-700/90 rounded-2xl shadow-2xl backdrop-blur-md transition-all flex items-center gap-2 text-xs font-semibold hover:scale-105 group"
          title="Open side menu (Ctrl+B)"
          aria-label="Open side menu"
        >
          <PanelLeft className="w-4 h-4 group-hover:scale-110 transition-transform" />
          <span className="text-zinc-200 group-hover:text-white">Menu</span>
        </button>
      )}
    </div>
  );
}
