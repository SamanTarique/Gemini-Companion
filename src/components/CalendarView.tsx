import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  MapPin,
  Repeat,
  Bell,
  AlertCircle,
  Sparkles,
  Trash2,
  Edit3,
  CheckCircle2,
  Filter,
  Layers,
  ArrowRight,
  ListTodo,
  Zap,
  Coffee,
  X,
  Check,
  CalendarDays,
  CalendarRange,
  CalendarCheck,
  Navigation,
  CloudSun
} from 'lucide-react';
import {
  CalendarEvent,
  CalendarOccurrence,
  CalendarViewMode,
  PriorityLevel,
  RepeatFrequency,
  RepeatRule,
  TaskItem,
  UserPreferences,
  WeatherData,
  TravelEstimate
} from '../types';
import {
  expandEventOccurrences,
  formatDateKey,
  parseDateKey,
  getRepeatDescription
} from '../services/recurrenceService';
import { detectTravelConflict, computeDepartureTime } from '../services/travelService';

interface CalendarViewProps {
  initialDate?: string;
  events: CalendarEvent[];
  tasks: TaskItem[];
  userPreferences?: UserPreferences;
  weather?: WeatherData | null;
  travelEstimates?: TravelEstimate[];
  onCreateEvent: (event: Omit<CalendarEvent, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  onUpdateEvent: (
    eventId: string,
    updates: Partial<CalendarEvent>,
    recurrenceMode?: 'this' | 'future' | 'all',
    occurrenceDate?: string
  ) => Promise<void>;
  onDeleteEvent: (
    eventId: string,
    recurrenceMode?: 'this' | 'future' | 'all',
    occurrenceDate?: string
  ) => Promise<void>;
  onStartFocus?: (title: string, taskId?: string) => void;
  onNavigateToTasks?: () => void;
}

const PRIORITIES: { id: PriorityLevel; label: string; bg: string; text: string; border: string }[] = [
  { id: 'critical', label: 'Critical', bg: 'bg-rose-500/10', text: 'text-rose-300', border: 'border-rose-500/30' },
  { id: 'high', label: 'High', bg: 'bg-amber-500/10', text: 'text-amber-300', border: 'border-amber-500/30' },
  { id: 'medium', label: 'Medium', bg: 'bg-blue-500/10', text: 'text-blue-300', border: 'border-blue-500/30' },
  { id: 'low', label: 'Low', bg: 'bg-zinc-800/80', text: 'text-zinc-400', border: 'border-zinc-700' },
];

const REMINDER_OPTIONS = [
  { value: 0, label: 'At start of event' },
  { value: 5, label: '5 minutes before' },
  { value: 10, label: '10 minutes before' },
  { value: 15, label: '15 minutes before' },
  { value: 30, label: '30 minutes before' },
  { value: 60, label: '1 hour before' },
  { value: 120, label: '2 hours before' },
  { value: 1440, label: '1 day before' },
];

export const CalendarView: React.FC<CalendarViewProps> = ({
  initialDate,
  events,
  tasks,
  userPreferences,
  weather,
  travelEstimates,
  onCreateEvent,
  onUpdateEvent,
  onDeleteEvent,
  onStartFocus,
  onNavigateToTasks,
}) => {
  // Current view anchor date (defaults to initialDate or today)
  const [currentDate, setCurrentDate] = useState<Date>(
    initialDate ? parseDateKey(initialDate) : new Date()
  );

  React.useEffect(() => {
    if (initialDate) {
      setCurrentDate(parseDateKey(initialDate));
    }
  }, [initialDate]);

  const [viewMode, setViewMode] = useState<CalendarViewMode>(
    (userPreferences?.defaultCalendarView as CalendarViewMode) || 'month'
  );

  // Natural Language Event Input state
  const [nlInput, setNlInput] = useState('');
  const [isNlParsing, setIsNlParsing] = useState(false);
  const [nlConfirmation, setNlConfirmation] = useState<{
    parsed: any;
    summary: string;
  } | null>(null);

  // Selected item modal & details
  const [selectedOccurrence, setSelectedOccurrence] = useState<CalendarOccurrence | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit / Delete recurrence choice modal
  const [recurrenceActionPrompt, setRecurrenceActionPrompt] = useState<{
    action: 'edit' | 'delete';
    occurrence: CalendarOccurrence;
  } | null>(null);

  // New/Edit Event Form State
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formDate, setFormDate] = useState(formatDateKey(new Date()));
  const [formStartTime, setFormStartTime] = useState('09:00');
  const [formEndTime, setFormEndTime] = useState('10:00');
  const [formLocation, setFormLocation] = useState('');
  const [formPriority, setFormPriority] = useState<PriorityLevel>('medium');
  const [formFrequency, setFormFrequency] = useState<RepeatFrequency>('none');
  const [formDaysOfWeek, setFormDaysOfWeek] = useState<number[]>([1]);
  const [formInterval, setFormInterval] = useState<number>(1);
  const [formReminders, setFormReminders] = useState<number[]>([
    userPreferences?.defaultReminderMinutesBefore || 15,
  ]);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editingRecurrenceMode, setEditingRecurrenceMode] = useState<'this' | 'future' | 'all'>('all');

  // Filter & preferences
  const firstDayOfWeek = userPreferences?.firstDayOfWeek ?? (userPreferences?.weekStartsOn === 'sunday' ? 0 : 1);
  const is24h = userPreferences?.timeFormat === '24h';

  // Format time display based on 12h/24h preference
  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    if (is24h) return timeStr;
    const [h, m] = timeStr.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 === 0 ? 12 : h % 12;
    return `${displayH}:${String(m).padStart(2, '0')} ${period}`;
  };

  // Determine current window start & end for expanding recurrence
  const { windowStartStr, windowEndStr, dateTitle } = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    if (viewMode === 'month') {
      // Month range plus 7 padding days before and after
      const firstOfMonth = new Date(year, month, 1);
      const lastOfMonth = new Date(year, month + 1, 0);

      const start = new Date(firstOfMonth);
      start.setDate(start.getDate() - 7);

      const end = new Date(lastOfMonth);
      end.setDate(end.getDate() + 7);

      const title = currentDate.toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
      });

      return {
        windowStartStr: formatDateKey(start),
        windowEndStr: formatDateKey(end),
        dateTitle: title,
      };
    } else if (viewMode === 'week') {
      // Week range: find starting day based on firstDayOfWeek
      const start = new Date(currentDate);
      const currentDay = start.getDay();
      const diff = (currentDay < firstDayOfWeek ? 7 : 0) + currentDay - firstDayOfWeek;
      start.setDate(start.getDate() - diff);

      const end = new Date(start);
      end.setDate(end.getDate() + 6);

      const startLabel = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const endLabel = end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

      return {
        windowStartStr: formatDateKey(start),
        windowEndStr: formatDateKey(end),
        dateTitle: `${startLabel} – ${endLabel}`,
      };
    } else {
      // Day range
      const dayStr = formatDateKey(currentDate);
      const title = currentDate.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
      return {
        windowStartStr: dayStr,
        windowEndStr: dayStr,
        dateTitle: title,
      };
    }
  }, [currentDate, viewMode, firstDayOfWeek]);

  // Expand recurring occurrences within window
  const activeOccurrences = useMemo(() => {
    return expandEventOccurrences(events, windowStartStr, windowEndStr);
  }, [events, windowStartStr, windowEndStr]);

  // Precompute travel conflicts for occurrences with locations
  const travelConflictsMap = useMemo(() => {
    const map = new Map<string, { hasConflict: boolean; details?: string }>();
    const buffer = userPreferences?.travelBufferMinutes ?? 15;

    for (const occ of activeOccurrences) {
      if (occ.location) {
        const sameDay = events.filter((e) => e.date === occ.date);
        const conflict = detectTravelConflict({
          targetEvent: occ.originalEvent,
          sameDayEvents: sameDay,
          travelMinutes: 20,
          bufferMinutes: buffer,
        });
        if (conflict.hasConflict) {
          map.set(occ.occurrenceId, conflict);
        }
      }
    }
    return map;
  }, [activeOccurrences, events, userPreferences?.travelBufferMinutes]);

  // Group occurrences and tasks by date
  const occurrencesByDate = useMemo(() => {
    const map = new Map<string, CalendarOccurrence[]>();
    for (const occ of activeOccurrences) {
      if (!map.has(occ.date)) {
        map.set(occ.date, []);
      }
      map.get(occ.date)!.push(occ);
    }
    return map;
  }, [activeOccurrences]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, TaskItem[]>();
    for (const task of tasks) {
      const dateKey = task.dueDate || (task.itemType === 'deadline' && task.dueDate) ? task.dueDate : undefined;
      if (dateKey) {
        if (!map.has(dateKey)) {
          map.set(dateKey, []);
        }
        map.get(dateKey)!.push(task);
      }
    }
    return map;
  }, [tasks]);

  // Navigation handlers
  const handlePrev = () => {
    const next = new Date(currentDate);
    if (viewMode === 'month') {
      next.setMonth(next.getMonth() - 1);
    } else if (viewMode === 'week') {
      next.setDate(next.getDate() - 7);
    } else {
      next.setDate(next.getDate() - 1);
    }
    setCurrentDate(next);
  };

  const handleNext = () => {
    const next = new Date(currentDate);
    if (viewMode === 'month') {
      next.setMonth(next.getMonth() + 1);
    } else if (viewMode === 'week') {
      next.setDate(next.getDate() + 7);
    } else {
      next.setDate(next.getDate() + 1);
    }
    setCurrentDate(next);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Open Create Modal for specific date/time
  const openCreateForDate = (dateStr: string, timeStr = '09:00') => {
    setEditingEventId(null);
    setFormTitle('');
    setFormDescription('');
    setFormDate(dateStr);
    setFormStartTime(timeStr);
    const [h, m] = timeStr.split(':').map(Number);
    const endH = String((h + 1) % 24).padStart(2, '0');
    setFormEndTime(`${endH}:${String(m).padStart(2, '0')}`);
    setFormLocation('');
    setFormPriority('medium');
    setFormFrequency('none');
    setFormDaysOfWeek([parseDateKey(dateStr).getDay()]);
    setFormInterval(1);
    setFormReminders([userPreferences?.defaultReminderMinutesBefore || 15]);
    setShowCreateModal(true);
  };

  // Open Edit Modal for an occurrence
  const openEditOccurrence = (occurrence: CalendarOccurrence, recurrenceMode: 'this' | 'future' | 'all' = 'all') => {
    setEditingEventId(occurrence.eventId);
    setEditingRecurrenceMode(recurrenceMode);
    setFormTitle(occurrence.title);
    setFormDescription(occurrence.description || '');
    setFormDate(occurrence.date);
    setFormStartTime(occurrence.startTime);
    setFormEndTime(occurrence.endTime);
    setFormLocation(occurrence.location || '');
    setFormPriority(occurrence.priority);
    const origRepeat = occurrence.originalEvent.repeat || { frequency: 'none' };
    setFormFrequency(origRepeat.frequency || 'none');
    setFormDaysOfWeek(origRepeat.daysOfWeek || [parseDateKey(occurrence.date).getDay()]);
    setFormInterval(origRepeat.interval || 1);
    setFormReminders(occurrence.reminder || [15]);
    setSelectedOccurrence(null);
    setRecurrenceActionPrompt(null);
    setShowCreateModal(true);
  };

  // Natural Language Event Parser
  const handleParseNl = async () => {
    if (!nlInput.trim() || isNlParsing) return;
    try {
      setIsNlParsing(true);
      const res = await fetch('/api/gemini/parse-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: nlInput.trim(),
          currentDate: formatDateKey(new Date()),
          currentTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
          timezone: userPreferences?.timezone || 'UTC',
          defaultReminder: userPreferences?.defaultReminderMinutesBefore || 15,
        }),
      });

      if (!res.ok) throw new Error('Failed to parse event');
      const data = await res.json();

      if (data.requiresConfirmation) {
        setNlConfirmation({
          parsed: data,
          summary: data.confirmationSummary || `${data.title} on ${data.date} at ${data.startTime}`,
        });
      } else {
        // Direct creation without ambiguity
        await executeCreateParsedEvent(data);
        setNlInput('');
      }
    } catch (err) {
      console.error('NL Parse error:', err);
    } finally {
      setIsNlParsing(false);
    }
  };

  const executeCreateParsedEvent = async (parsed: any) => {
    try {
      setIsSubmitting(true);
      await onCreateEvent({
        title: parsed.title,
        description: parsed.description || '',
        date: parsed.date || formatDateKey(new Date()),
        startTime: parsed.startTime || '09:00',
        endTime: parsed.endTime || '10:00',
        location: parsed.location || '',
        priority: parsed.priority || 'medium',
        repeat: parsed.repeat || { frequency: 'none' },
        reminder: parsed.reminder || [15],
      });
      setNlConfirmation(null);
      setNlInput('');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Create or Update Event Form
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    try {
      setIsSubmitting(true);
      const repeatRule: RepeatRule = {
        frequency: formFrequency,
        interval: formInterval,
        daysOfWeek: formFrequency === 'weekly' || formFrequency === 'custom' ? formDaysOfWeek : undefined,
        dayOfMonth: formFrequency === 'monthly' ? parseInt(formDate.split('-')[2], 10) : undefined,
      };

      if (editingEventId) {
        await onUpdateEvent(
          editingEventId,
          {
            title: formTitle.trim(),
            description: formDescription.trim(),
            date: formDate,
            startTime: formStartTime,
            endTime: formEndTime,
            location: formLocation.trim(),
            priority: formPriority,
            repeat: repeatRule,
            reminder: formReminders,
          },
          editingRecurrenceMode,
          formDate
        );
      } else {
        await onCreateEvent({
          title: formTitle.trim(),
          description: formDescription.trim(),
          date: formDate,
          startTime: formStartTime,
          endTime: formEndTime,
          location: formLocation.trim(),
          priority: formPriority,
          repeat: repeatRule,
          reminder: formReminders,
        });
      }

      setShowCreateModal(false);
      setEditingEventId(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete occurrence handler
  const handleDeleteOccurrenceConfirm = async (mode: 'this' | 'future' | 'all') => {
    if (!recurrenceActionPrompt) return;
    try {
      setIsSubmitting(true);
      await onDeleteEvent(
        recurrenceActionPrompt.occurrence.eventId,
        mode,
        recurrenceActionPrompt.occurrence.date
      );
      setRecurrenceActionPrompt(null);
      setSelectedOccurrence(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Days of week header names according to firstDayOfWeek
  const dayNames = useMemo(() => {
    const base = [
      { id: 0, short: 'Sun', full: 'Sunday' },
      { id: 1, short: 'Mon', full: 'Monday' },
      { id: 2, short: 'Tue', full: 'Tuesday' },
      { id: 3, short: 'Wed', full: 'Wednesday' },
      { id: 4, short: 'Thu', full: 'Thursday' },
      { id: 5, short: 'Fri', full: 'Friday' },
      { id: 6, short: 'Sat', full: 'Saturday' },
    ];
    if (firstDayOfWeek === 1) {
      return [...base.slice(1), base[0]];
    }
    return base;
  }, [firstDayOfWeek]);

  // Generate Month View Matrix
  const monthMatrix = useMemo(() => {
    if (viewMode !== 'month') return [];
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstOfMonth = new Date(year, month, 1);
    const lastOfMonth = new Date(year, month + 1, 0);

    const firstDayIndex = firstOfMonth.getDay();
    // Offset based on firstDayOfWeek
    const offset = (firstDayIndex - firstDayOfWeek + 7) % 7;

    const days: Array<{
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
    }> = [];

    const todayStr = formatDateKey(new Date());

    // Leading days from previous month
    const prevMonthLast = new Date(year, month, 0);
    for (let i = offset - 1; i >= 0; i--) {
      const d = new Date(prevMonthLast);
      d.setDate(d.getDate() - i);
      const str = formatDateKey(d);
      days.push({
        dateStr: str,
        dayNumber: d.getDate(),
        isCurrentMonth: false,
        isToday: str === todayStr,
      });
    }

    // Current month days
    for (let i = 1; i <= lastOfMonth.getDate(); i++) {
      const d = new Date(year, month, i);
      const str = formatDateKey(d);
      days.push({
        dateStr: str,
        dayNumber: i,
        isCurrentMonth: true,
        isToday: str === todayStr,
      });
    }

    // Trailing days to fill 5 or 6 weeks (multiple of 7)
    const totalSlots = Math.ceil(days.length / 7) * 7;
    const remaining = totalSlots - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      const str = formatDateKey(d);
      days.push({
        dateStr: str,
        dayNumber: i,
        isCurrentMonth: false,
        isToday: str === todayStr,
      });
    }

    return days;
  }, [currentDate, viewMode, firstDayOfWeek]);

  // Generate Week View Days
  const weekDays = useMemo(() => {
    if (viewMode !== 'week') return [];
    const start = parseDateKey(windowStartStr);
    const todayStr = formatDateKey(new Date());
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const str = formatDateKey(d);
      days.push({
        dateStr: str,
        dateObj: d,
        isToday: str === todayStr,
        dayName: d.toLocaleDateString(undefined, { weekday: 'short' }),
        dayNumber: d.getDate(),
      });
    }
    return days;
  }, [viewMode, windowStartStr]);

  // Hourly slots for Week & Day views
  const hours = useMemo(() => {
    return Array.from({ length: 24 }, (_, i) => i);
  }, []);

  return (
    <div className="flex flex-col h-full bg-[#0A0A0A] text-zinc-100 overflow-hidden">
      {/* 1. Header Toolbar */}
      <div className="p-4 sm:p-5 border-b border-zinc-800/80 bg-zinc-950/40 shrink-0 flex flex-wrap items-center justify-between gap-4">
        {/* Left: Navigation and Title */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl p-0.5 shadow-sm">
            <button
              onClick={handlePrev}
              className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-100 transition-colors"
              title="Previous"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleToday}
              className="px-2.5 py-1 text-xs font-medium text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors"
            >
              Today
            </button>
            <button
              onClick={handleNext}
              className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-100 transition-colors"
              title="Next"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <h2 className="text-base sm:text-lg font-semibold tracking-tight text-zinc-100">
            {dateTitle}
          </h2>
        </div>

        {/* Right: View Switcher & Actions */}
        <div className="flex items-center gap-2.5">
          {/* View Mode Switcher */}
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl p-1 text-xs">
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1 rounded-lg transition-colors font-medium ${
                viewMode === 'month'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1 rounded-lg transition-colors font-medium ${
                viewMode === 'week'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setViewMode('day')}
              className={`px-3 py-1 rounded-lg transition-colors font-medium ${
                viewMode === 'day'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Day
            </button>
          </div>

          {/* New Event Button */}
          <button
            onClick={() => openCreateForDate(formatDateKey(currentDate))}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs sm:text-sm shadow-md transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>New Event</span>
          </button>
        </div>
      </div>

      {/* 2. Natural Language AI Event Creator Bar */}
      <div className="px-4 py-2.5 bg-zinc-900/40 border-b border-zinc-800/80 shrink-0">
        <div className="flex items-center gap-2 max-w-4xl">
          <div className="relative flex-1">
            <Sparkles className="w-3.5 h-3.5 text-blue-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={nlInput}
              onChange={(e) => setNlInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleParseNl();
              }}
              placeholder='Try "Every Monday I have class at 9 AM" or "Meeting tomorrow at 3 PM with Sarah"'
              className="w-full bg-zinc-900/80 border border-zinc-800/90 rounded-xl pl-8 pr-3 py-1.5 text-xs sm:text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-blue-500/60"
            />
          </div>
          <button
            onClick={handleParseNl}
            disabled={!nlInput.trim() || isNlParsing}
            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 rounded-xl text-xs font-medium text-zinc-200 border border-zinc-700 transition-colors flex items-center gap-1 shrink-0"
          >
            {isNlParsing ? (
              <span className="animate-spin text-blue-400">⏳</span>
            ) : (
              <Sparkles className="w-3 h-3 text-blue-400" />
            )}
            <span>Schedule</span>
          </button>
        </div>

        {/* Natural Language Ambiguity / Confirmation Card */}
        {nlConfirmation && (
          <div className="mt-2 p-3 bg-zinc-900 border border-blue-500/40 rounded-xl max-w-xl flex items-start justify-between gap-3 shadow-xl">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-blue-400 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Confirm Event Details</span>
              </div>
              <p className="text-xs text-zinc-300 font-medium whitespace-pre-line font-mono bg-black/40 p-2 rounded-lg border border-zinc-800">
                {nlConfirmation.summary}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 pt-1">
              <button
                onClick={() => setNlConfirmation(null)}
                className="px-2.5 py-1 text-xs text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => executeCreateParsedEvent(nlConfirmation.parsed)}
                disabled={isSubmitting}
                className="px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow transition-colors flex items-center gap-1"
              >
                <Check className="w-3 h-3" />
                <span>Confirm</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. Main Calendar Views */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        {/* ===================== MONTH VIEW ===================== */}
        {viewMode === 'month' && (
          <div className="min-w-[760px] h-full flex flex-col">
            {/* Day of Week Headers */}
            <div className="grid grid-cols-7 border-b border-zinc-800/80 bg-zinc-950/60 sticky top-0 z-10">
              {dayNames.map((d) => (
                <div
                  key={d.id}
                  className="py-2.5 px-3 text-center text-xs font-semibold text-zinc-400 tracking-wider uppercase"
                >
                  {d.short}
                </div>
              ))}
            </div>

            {/* Calendar Cells Grid */}
            <div className="grid grid-cols-7 flex-1 auto-rows-fr divide-x divide-y divide-zinc-800/60 border-b border-zinc-800/60">
              {monthMatrix.map((cell) => {
                const dayOccurrences = occurrencesByDate.get(cell.dateStr) || [];
                const dayTasks = tasksByDate.get(cell.dateStr) || [];
                const hasItems = dayOccurrences.length > 0 || dayTasks.length > 0;

                return (
                  <div
                    key={cell.dateStr}
                    onClick={() => openCreateForDate(cell.dateStr)}
                    className={`min-h-[110px] p-2 flex flex-col justify-between transition-colors group cursor-pointer hover:bg-zinc-900/50 ${
                      cell.isCurrentMonth ? 'bg-[#0B0B0B]' : 'bg-zinc-950/60 text-zinc-600'
                    } ${cell.isToday ? 'ring-1 ring-inset ring-blue-500/40 bg-blue-950/10' : ''}`}
                  >
                    {/* Day Number Header */}
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className={`inline-flex items-center justify-center text-xs font-semibold rounded-full w-6 h-6 ${
                          cell.isToday
                            ? 'bg-blue-600 text-white font-bold'
                            : cell.isCurrentMonth
                            ? 'text-zinc-300 group-hover:text-white'
                            : 'text-zinc-600'
                        }`}
                      >
                        {cell.dayNumber}
                      </span>

                      {/* Quick Add Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openCreateForDate(cell.dateStr);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded transition-opacity"
                        title="Add event"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Chips for Events & Tasks */}
                    <div className="flex-1 space-y-1 overflow-y-auto no-scrollbar max-h-24">
                      {/* Events */}
                      {dayOccurrences.slice(0, 3).map((occ) => (
                        <div
                          key={occ.occurrenceId}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedOccurrence(occ);
                          }}
                          className={`px-1.5 py-0.5 rounded text-[11px] font-medium truncate flex items-center gap-1 cursor-pointer transition-transform hover:scale-[1.02] border ${
                            occ.priority === 'critical'
                              ? 'bg-rose-500/20 text-rose-200 border-rose-500/40'
                              : occ.priority === 'high'
                              ? 'bg-amber-500/20 text-amber-200 border-amber-500/40'
                              : 'bg-blue-600/20 text-blue-200 border-blue-500/40'
                          }`}
                          title={`${occ.title} (${occ.startTime} - ${occ.endTime})`}
                        >
                          {occ.isRecurringInstance && (
                            <Repeat className="w-2.5 h-2.5 shrink-0 opacity-75" />
                          )}
                          <span className="font-mono opacity-80 shrink-0 text-[10px]">
                            {occ.startTime}
                          </span>
                          <span className="truncate">{occ.title}</span>
                        </div>
                      ))}

                      {/* Tasks / Deadlines */}
                      {dayTasks.slice(0, 2).map((t) => (
                        <div
                          key={t.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onNavigateToTasks) onNavigateToTasks();
                          }}
                          className={`px-1.5 py-0.5 rounded text-[10px] truncate flex items-center gap-1 border ${
                            t.itemType === 'deadline'
                              ? 'bg-rose-950/40 text-rose-300 border-rose-800/60'
                              : 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60'
                          }`}
                          title={`Task: ${t.title}`}
                        >
                          <ListTodo className="w-2.5 h-2.5 shrink-0" />
                          <span className="truncate">{t.title}</span>
                        </div>
                      ))}

                      {/* More items indicator */}
                      {dayOccurrences.length + dayTasks.length > 5 && (
                        <div className="text-[10px] text-zinc-500 font-medium pl-1">
                          +{dayOccurrences.length + dayTasks.length - 5} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ===================== WEEK VIEW ===================== */}
        {viewMode === 'week' && (
          <div className="min-w-[840px] flex flex-col">
            {/* Week Days Header */}
            <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-zinc-800/80 bg-zinc-950/60 sticky top-0 z-20">
              <div className="p-2 border-r border-zinc-800/60 text-center text-xs text-zinc-600 font-mono">
                GMT
              </div>
              {weekDays.map((d) => (
                <div
                  key={d.dateStr}
                  className={`p-2.5 text-center border-r border-zinc-800/60 ${
                    d.isToday ? 'bg-blue-950/20' : ''
                  }`}
                >
                  <div className="text-[11px] font-medium text-zinc-400 uppercase">{d.dayName}</div>
                  <div
                    className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold mt-0.5 ${
                      d.isToday ? 'bg-blue-600 text-white font-bold' : 'text-zinc-200'
                    }`}
                  >
                    {d.dayNumber}
                  </div>
                </div>
              ))}
            </div>

            {/* Time Grid (24 hours) */}
            <div className="grid grid-cols-[60px_repeat(7,1fr)] divide-y divide-zinc-800/40">
              {hours.map((hour) => {
                const hourStr = String(hour).padStart(2, '0');
                const displayTime = is24h
                  ? `${hourStr}:00`
                  : `${hour % 12 === 0 ? 12 : hour % 12} ${hour >= 12 ? 'PM' : 'AM'}`;

                return (
                  <React.Fragment key={hour}>
                    {/* Gutter hour label */}
                    <div className="p-2 text-right pr-3 text-[11px] text-zinc-500 font-mono border-r border-zinc-800/60 select-none">
                      {displayTime}
                    </div>

                    {/* 7 columns for each day of week */}
                    {weekDays.map((d) => {
                      // Filter events matching this hour
                      const cellOccurrences = (occurrencesByDate.get(d.dateStr) || []).filter((occ) => {
                        const [occH] = occ.startTime.split(':').map(Number);
                        return occH === hour;
                      });

                      return (
                        <div
                          key={`${d.dateStr}_${hour}`}
                          onClick={() => openCreateForDate(d.dateStr, `${hourStr}:00`)}
                          className={`min-h-[52px] p-1 border-r border-zinc-800/40 relative group cursor-pointer hover:bg-zinc-900/40 transition-colors ${
                            d.isToday ? 'bg-blue-950/5' : ''
                          }`}
                        >
                          {cellOccurrences.map((occ) => (
                            <div
                              key={occ.occurrenceId}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedOccurrence(occ);
                              }}
                              className={`p-1.5 rounded-lg text-xs font-medium border mb-1 cursor-pointer transition-transform hover:scale-[1.01] shadow-sm ${
                                occ.priority === 'critical'
                                  ? 'bg-rose-500/20 text-rose-200 border-rose-500/40'
                                  : occ.priority === 'high'
                                  ? 'bg-amber-500/20 text-amber-200 border-amber-500/40'
                                  : 'bg-blue-600/20 text-blue-200 border-blue-500/40'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-semibold truncate">{occ.title}</span>
                                {occ.isRecurringInstance && (
                                  <Repeat className="w-2.5 h-2.5 opacity-70 shrink-0" />
                                )}
                              </div>
                              <div className="text-[10px] opacity-75 font-mono">
                                {occ.startTime} - {occ.endTime}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}

        {/* ===================== DAY VIEW ===================== */}
        {viewMode === 'day' && (
          <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
            {/* Day Summary Card */}
            <div className="p-4 rounded-2xl bg-zinc-900/70 border border-zinc-800 flex items-center justify-between">
              <div>
                <span className="text-xs text-blue-400 font-semibold uppercase tracking-wider">
                  Timeline Agenda
                </span>
                <h3 className="text-lg font-bold text-zinc-100">{dateTitle}</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {(occurrencesByDate.get(formatDateKey(currentDate)) || []).length} scheduled events &bull;{' '}
                  {(tasksByDate.get(formatDateKey(currentDate)) || []).length} tasks due
                </p>
              </div>

              <button
                onClick={() => openCreateForDate(formatDateKey(currentDate))}
                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium flex items-center gap-1 shadow"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Event</span>
              </button>
            </div>

            {/* Timeline hour blocks */}
            <div className="divide-y divide-zinc-800/60 border border-zinc-800 rounded-2xl overflow-hidden bg-[#0C0C0C]">
              {hours.map((hour) => {
                const hourStr = String(hour).padStart(2, '0');
                const displayTime = is24h
                  ? `${hourStr}:00`
                  : `${hour % 12 === 0 ? 12 : hour % 12} ${hour >= 12 ? 'PM' : 'AM'}`;
                const dateKey = formatDateKey(currentDate);
                const hourOccurrences = (occurrencesByDate.get(dateKey) || []).filter((occ) => {
                  const [occH] = occ.startTime.split(':').map(Number);
                  return occH === hour;
                });

                return (
                  <div
                    key={hour}
                    onClick={() => openCreateForDate(dateKey, `${hourStr}:00`)}
                    className="min-h-[64px] p-3 flex items-start gap-4 hover:bg-zinc-900/40 transition-colors cursor-pointer group"
                  >
                    <div className="w-16 text-right text-xs font-mono text-zinc-500 shrink-0 pt-1">
                      {displayTime}
                    </div>

                    <div className="flex-1 space-y-2">
                      {hourOccurrences.map((occ) => (
                        <div
                          key={occ.occurrenceId}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedOccurrence(occ);
                          }}
                          className={`p-3 rounded-xl border flex items-center justify-between gap-3 shadow-md hover:brightness-110 transition-all ${
                            occ.priority === 'critical'
                              ? 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                              : occ.priority === 'high'
                              ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                              : 'bg-blue-600/10 border-blue-500/30 text-blue-200'
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm text-zinc-100">{occ.title}</span>
                              {occ.isRecurringInstance && (
                                <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">
                                  <Repeat className="w-2.5 h-2.5" />
                                  <span>Repeating</span>
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-zinc-400">
                              <span className="flex items-center gap-1 font-mono">
                                <Clock className="w-3 h-3" />
                                {occ.startTime} - {occ.endTime}
                              </span>
                              {occ.location && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  {occ.location}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {onStartFocus && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onStartFocus(occ.title);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs flex items-center gap-1 transition-colors"
                              >
                                <Zap className="w-3 h-3 text-amber-400" />
                                <span>Focus</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ))}

                      {hourOccurrences.length === 0 && (
                        <div className="h-6 flex items-center text-xs text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity">
                          + Click to schedule at {displayTime}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 4. Event Detail Modal / Slideover */}
      {selectedOccurrence && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${
                      PRIORITIES.find((p) => p.id === selectedOccurrence.priority)?.bg || ''
                    } ${PRIORITIES.find((p) => p.id === selectedOccurrence.priority)?.text || ''} ${
                      PRIORITIES.find((p) => p.id === selectedOccurrence.priority)?.border || ''
                    }`}
                  >
                    {selectedOccurrence.priority}
                  </span>
                  {selectedOccurrence.isRecurringInstance && (
                    <span className="flex items-center gap-1 text-[10px] text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-full">
                      <Repeat className="w-3 h-3 text-blue-400" />
                      <span>{getRepeatDescription(selectedOccurrence.originalEvent.repeat)}</span>
                    </span>
                  )}
                </div>
                <h3 className="text-xl font-bold text-zinc-100">{selectedOccurrence.title}</h3>
              </div>

              <button
                onClick={() => setSelectedOccurrence(null)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Description */}
            {selectedOccurrence.description && (
              <p className="text-sm text-zinc-300 bg-zinc-950/60 p-3 rounded-xl border border-zinc-800">
                {selectedOccurrence.description}
              </p>
            )}

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs text-zinc-300">
              <div className="p-2.5 rounded-xl bg-zinc-950/40 border border-zinc-800 flex items-center gap-2.5">
                <CalendarIcon className="w-4 h-4 text-blue-400 shrink-0" />
                <div>
                  <div className="text-zinc-500 text-[10px]">Date</div>
                  <div className="font-medium">{selectedOccurrence.date}</div>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-zinc-950/40 border border-zinc-800 flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-blue-400 shrink-0" />
                <div>
                  <div className="text-zinc-500 text-[10px]">Time</div>
                  <div className="font-medium">
                    {formatTime(selectedOccurrence.startTime)} - {formatTime(selectedOccurrence.endTime)}
                  </div>
                </div>
              </div>

              {selectedOccurrence.location && (
                <div className="col-span-2 p-3.5 rounded-2xl bg-zinc-950/70 border border-zinc-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Navigation className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-semibold text-zinc-200">Travel & Location Logistics</span>
                    </div>
                    <span className="text-[10px] text-zinc-400 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-md font-mono">
                      {userPreferences?.travelBufferMinutes ?? 15}m buffer
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-zinc-300">
                    <MapPin className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                    <span className="font-medium text-zinc-200">{selectedOccurrence.location}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                    <div className="p-2 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
                      <div className="text-zinc-500 text-[10px]">Est. Travel Time</div>
                      <div className="font-medium text-zinc-200 mt-0.5">~20 min transit</div>
                    </div>
                    <div className="p-2 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
                      <div className="text-zinc-500 text-[10px]">Suggested Departure</div>
                      <div className="font-medium text-amber-300 font-mono mt-0.5">
                        {computeDepartureTime(
                          selectedOccurrence.startTime,
                          20 + (userPreferences?.travelBufferMinutes ?? 15)
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Travel Conflict Alert if detected */}
                  {travelConflictsMap.has(selectedOccurrence.occurrenceId) && (
                    <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-rose-200">Schedule & Travel Conflict</div>
                        <p className="text-[11px] text-rose-300/90 leading-relaxed mt-0.5">
                          {travelConflictsMap.get(selectedOccurrence.occurrenceId)?.details}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Weather context for travel if today */}
                  {weather && selectedOccurrence.date === formatDateKey(new Date()) && (
                    <div className="p-2 rounded-xl bg-blue-950/20 border border-blue-900/40 text-[11px] text-blue-300 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <CloudSun className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <span>Today's Weather: {weather.condition} ({weather.tempC}°C)</span>
                      </span>
                      {weather.advisory && (
                        <span className="text-amber-400 font-medium ml-2">⚠️ {weather.advisory}</span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {selectedOccurrence.reminder && selectedOccurrence.reminder.length > 0 && (
                <div className="p-2.5 rounded-xl bg-zinc-950/40 border border-zinc-800 flex items-center gap-2.5 col-span-2">
                  <Bell className="w-4 h-4 text-amber-400 shrink-0" />
                  <div>
                    <div className="text-zinc-500 text-[10px]">Reminders</div>
                    <div className="font-medium">
                      {selectedOccurrence.reminder
                        .map((m) => (m === 0 ? 'At start' : `${m}m before`))
                        .join(', ')}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center justify-between gap-3 border-t border-zinc-800/80">
              {/* Delete Button */}
              <button
                onClick={() => {
                  if (selectedOccurrence.isRecurringInstance) {
                    setRecurrenceActionPrompt({ action: 'delete', occurrence: selectedOccurrence });
                  } else {
                    onDeleteEvent(selectedOccurrence.eventId);
                    setSelectedOccurrence(null);
                  }
                }}
                className="px-3 py-1.5 rounded-xl text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 border border-rose-900/40 transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>

              {/* Edit & Focus Buttons */}
              <div className="flex items-center gap-2">
                {onStartFocus && (
                  <button
                    onClick={() => {
                      onStartFocus(selectedOccurrence.title);
                      setSelectedOccurrence(null);
                    }}
                    className="px-3 py-1.5 rounded-xl text-xs font-medium text-amber-300 hover:bg-amber-950/30 border border-amber-900/40 transition-colors flex items-center gap-1.5"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Focus</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    if (selectedOccurrence.isRecurringInstance) {
                      setRecurrenceActionPrompt({ action: 'edit', occurrence: selectedOccurrence });
                    } else {
                      openEditOccurrence(selectedOccurrence, 'all');
                    }
                  }}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 shadow transition-colors flex items-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Event</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Recurrence Choice Dialog (Edit/Delete Occurrence, Future, or All) */}
      {recurrenceActionPrompt && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in duration-150">
            <div className="space-y-1">
              <h4 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <Repeat className="w-4 h-4 text-blue-400" />
                <span>
                  {recurrenceActionPrompt.action === 'edit'
                    ? 'Edit Recurring Event'
                    : 'Delete Recurring Event'}
                </span>
              </h4>
              <p className="text-xs text-zinc-400">
                "{recurrenceActionPrompt.occurrence.title}" is part of a recurring series. What would
                you like to {recurrenceActionPrompt.action}?
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <button
                onClick={() => {
                  if (recurrenceActionPrompt.action === 'edit') {
                    openEditOccurrence(recurrenceActionPrompt.occurrence, 'this');
                  } else {
                    handleDeleteOccurrenceConfirm('this');
                  }
                }}
                className="w-full text-left p-3 rounded-xl bg-zinc-950/60 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 transition-colors"
              >
                <div className="text-xs font-semibold text-zinc-200">This occurrence only</div>
                <div className="text-[11px] text-zinc-500">
                  Only affects {recurrenceActionPrompt.occurrence.date}
                </div>
              </button>

              <button
                onClick={() => {
                  if (recurrenceActionPrompt.action === 'edit') {
                    openEditOccurrence(recurrenceActionPrompt.occurrence, 'future');
                  } else {
                    handleDeleteOccurrenceConfirm('future');
                  }
                }}
                className="w-full text-left p-3 rounded-xl bg-zinc-950/60 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 transition-colors"
              >
                <div className="text-xs font-semibold text-zinc-200">This and future occurrences</div>
                <div className="text-[11px] text-zinc-500">
                  Affects this date and all subsequent repeats
                </div>
              </button>

              <button
                onClick={() => {
                  if (recurrenceActionPrompt.action === 'edit') {
                    openEditOccurrence(recurrenceActionPrompt.occurrence, 'all');
                  } else {
                    handleDeleteOccurrenceConfirm('all');
                  }
                }}
                className="w-full text-left p-3 rounded-xl bg-zinc-950/60 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 transition-colors"
              >
                <div className="text-xs font-semibold text-zinc-200">All occurrences</div>
                <div className="text-[11px] text-zinc-500">
                  Updates the entire recurring series
                </div>
              </button>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setRecurrenceActionPrompt(null)}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Create / Edit Event Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-blue-500" />
                <span>{editingEventId ? 'Edit Event' : 'Create New Event'}</span>
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">
                  Event Title *
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Team Sync, Class, Dentist Appointment"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Date & Times */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs sm:text-sm text-zinc-100 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">
                    Start Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs sm:text-sm text-zinc-100 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">End Time *</label>
                  <input
                    type="time"
                    required
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs sm:text-sm text-zinc-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Repeat Frequency */}
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">Repeat</label>
                <select
                  value={formFrequency}
                  onChange={(e) => setFormFrequency(e.target.value as RepeatFrequency)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-zinc-100 focus:outline-none focus:border-blue-500"
                >
                  <option value="none">Does not repeat</option>
                  <option value="daily">Daily</option>
                  <option value="weekdays">Every weekday (Monday to Friday)</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                  <option value="custom">Custom repeat...</option>
                </select>
              </div>

              {/* Weekly Days Selection */}
              {(formFrequency === 'weekly' || formFrequency === 'custom') && (
                <div className="space-y-1.5 bg-zinc-950/60 p-3 rounded-xl border border-zinc-800">
                  <div className="text-[11px] font-semibold text-zinc-400">Repeats on days:</div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[
                      { id: 1, label: 'M' },
                      { id: 2, label: 'T' },
                      { id: 3, label: 'W' },
                      { id: 4, label: 'T' },
                      { id: 5, label: 'F' },
                      { id: 6, label: 'S' },
                      { id: 0, label: 'S' },
                    ].map((day) => {
                      const isSelected = formDaysOfWeek.includes(day.id);
                      return (
                        <button
                          key={day.id}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              if (formDaysOfWeek.length > 1) {
                                setFormDaysOfWeek(formDaysOfWeek.filter((d) => d !== day.id));
                              }
                            } else {
                              setFormDaysOfWeek([...formDaysOfWeek, day.id]);
                            }
                          }}
                          className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors ${
                            isSelected
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                          }`}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Priority & Location */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">Priority</label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value as PriorityLevel)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-zinc-100 focus:outline-none focus:border-blue-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">
                    Location (Optional)
                  </label>
                  <input
                    type="text"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    placeholder="e.g. Room 302, Coffee Shop, Zoom"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-zinc-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Reminder Selection */}
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">
                  Reminder Alert
                </label>
                <select
                  value={formReminders[0] ?? 15}
                  onChange={(e) => setFormReminders([parseInt(e.target.value, 10)])}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-zinc-100 focus:outline-none focus:border-blue-500"
                >
                  {REMINDER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">
                  Description / Notes
                </label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Additional context or agenda..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-zinc-100 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 rounded-xl hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !formTitle.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium rounded-xl shadow transition-colors flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{editingEventId ? 'Save Changes' : 'Create Event'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
