import { CalendarEvent, CalendarOccurrence, RepeatRule } from '../types';

/**
 * Format a Date object to 'YYYY-MM-DD'
 */
export function formatDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse 'YYYY-MM-DD' to Date object at local midnight
 */
export function parseDateKey(str: string): Date {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Check if a date string is between start and end inclusive
 */
export function isDateInRange(dateStr: string, startStr: string, endStr: string): boolean {
  return dateStr >= startStr && dateStr <= endStr;
}

/**
 * Generates all occurrences for a list of calendar events within [startStr, endStr]
 */
export function expandEventOccurrences(
  events: CalendarEvent[],
  startStr: string,
  endStr: string
): CalendarOccurrence[] {
  const occurrences: CalendarOccurrence[] = [];
  const rangeStart = parseDateKey(startStr);
  const rangeEnd = parseDateKey(endStr);

  for (const event of events) {
    const eventDate = parseDateKey(event.date);
    const repeat = event.repeat || { frequency: 'none' };
    const exceptions = new Set(repeat.exceptions || []);

    // 1. Non-recurring event
    if (!repeat.frequency || repeat.frequency === 'none') {
      if (isDateInRange(event.date, startStr, endStr)) {
        occurrences.push({
          occurrenceId: event.id,
          originalEvent: event,
          eventId: event.id,
          title: event.title,
          description: event.description,
          date: event.date,
          startTime: event.startTime,
          endTime: event.endTime,
          location: event.location,
          priority: event.priority,
          reminder: event.reminder || [],
          color: event.color,
          isRecurringInstance: false,
        });
      }
      continue;
    }

    // 2. Recurring event expansion
    const interval = Math.max(1, repeat.interval || 1);
    const untilDate = repeat.untilDate ? parseDateKey(repeat.untilDate) : null;
    const maxCount = repeat.count || 500; // Safety cap
    let occurrenceCount = 0;

    // Determine target day(s) of week for weekly recurrence
    const defaultDay = eventDate.getDay();
    const daysOfWeek = (repeat.daysOfWeek && repeat.daysOfWeek.length > 0)
      ? repeat.daysOfWeek
      : [defaultDay];

    // Day of month for monthly
    const dayOfMonth = repeat.dayOfMonth || eventDate.getDate();

    // Iterate through calendar dates from eventDate up to rangeEnd
    // For performance, advance by step where possible
    let current = new Date(eventDate);

    while (current <= rangeEnd && occurrenceCount < maxCount) {
      if (untilDate && current > untilDate) {
        break;
      }

      const currentDateStr = formatDateKey(current);
      const isPastRangeStart = current >= rangeStart;

      let isMatch = false;

      switch (repeat.frequency) {
        case 'daily': {
          const diffDays = Math.round((current.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays >= 0 && diffDays % interval === 0) {
            isMatch = true;
          }
          break;
        }

        case 'weekdays': {
          const day = current.getDay();
          // Monday=1 through Friday=5
          if (day >= 1 && day <= 5) {
            isMatch = true;
          }
          break;
        }

        case 'weekly': {
          const day = current.getDay();
          if (daysOfWeek.includes(day)) {
            // Check interval of weeks
            const diffDays = Math.round((current.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24));
            const diffWeeks = Math.floor(diffDays / 7);
            if (diffWeeks >= 0 && diffWeeks % interval === 0) {
              isMatch = true;
            }
          }
          break;
        }

        case 'monthly': {
          const currentMonthDay = current.getDate();
          if (currentMonthDay === dayOfMonth) {
            const diffMonths = (current.getFullYear() - eventDate.getFullYear()) * 12 + (current.getMonth() - eventDate.getMonth());
            if (diffMonths >= 0 && diffMonths % interval === 0) {
              isMatch = true;
            }
          }
          break;
        }

        case 'yearly': {
          if (current.getMonth() === eventDate.getMonth() && current.getDate() === eventDate.getDate()) {
            const diffYears = current.getFullYear() - eventDate.getFullYear();
            if (diffYears >= 0 && diffYears % interval === 0) {
              isMatch = true;
            }
          }
          break;
        }

        case 'custom': {
          const day = current.getDay();
          if (daysOfWeek.includes(day)) {
            const diffDays = Math.round((current.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24));
            const diffWeeks = Math.floor(diffDays / 7);
            if (diffWeeks >= 0 && diffWeeks % interval === 0) {
              isMatch = true;
            }
          }
          break;
        }
      }

      if (isMatch) {
        occurrenceCount++;

        // Only emit if within active query window and not an exception
        if (isPastRangeStart && !exceptions.has(currentDateStr)) {
          occurrences.push({
            occurrenceId: `${event.id}_${currentDateStr}`,
            originalEvent: event,
            eventId: event.id,
            title: event.title,
            description: event.description,
            date: currentDateStr,
            startTime: event.startTime,
            endTime: event.endTime,
            location: event.location,
            priority: event.priority,
            reminder: event.reminder || [],
            color: event.color,
            isRecurringInstance: true,
            seriesId: event.id,
          });
        }
      }

      // Advance by 1 day
      current.setDate(current.getDate() + 1);
    }
  }

  // Sort occurrences chronologically
  return occurrences.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.startTime.localeCompare(b.startTime);
  });
}

/**
 * Returns a human-readable repeat description
 */
export function getRepeatDescription(repeat?: RepeatRule): string {
  if (!repeat || !repeat.frequency || repeat.frequency === 'none') {
    return 'Does not repeat';
  }

  const daysNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  switch (repeat.frequency) {
    case 'daily':
      return repeat.interval && repeat.interval > 1 ? `Every ${repeat.interval} days` : 'Daily';
    case 'weekdays':
      return 'Every weekday (Mon - Fri)';
    case 'weekly': {
      if (repeat.daysOfWeek && repeat.daysOfWeek.length > 0) {
        const names = repeat.daysOfWeek.map((d) => daysNames[d]).join(', ');
        return repeat.interval && repeat.interval > 1 ? `Every ${repeat.interval} weeks on ${names}` : `Weekly on ${names}`;
      }
      return repeat.interval && repeat.interval > 1 ? `Every ${repeat.interval} weeks` : 'Weekly';
    }
    case 'monthly':
      return `Monthly on day ${repeat.dayOfMonth || 'the same day'}`;
    case 'yearly':
      return 'Yearly';
    case 'custom':
      return 'Custom recurrence';
    default:
      return 'Recurring';
  }
}
