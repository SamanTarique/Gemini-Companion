import { TravelEstimate, CalendarEvent } from '../types';

/**
 * Travel Service
 * Queries the secure backend for travel duration, routes, and conflicts.
 * Checks for schedule conflicts when travel buffer encroaches on adjacent items.
 */

export async function estimateTravel(params: {
  origin?: string;
  destination: string;
  eventStartTime?: string;
  precedingEventEndTime?: string;
  travelBufferMinutes?: number;
  mode?: 'driving' | 'transit' | 'walking' | 'bicycling';
  userTimezone?: string;
}): Promise<TravelEstimate> {
  const response = await fetch('/api/travel/estimate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    return {
      origin: params.origin || 'Current Location',
      destination: params.destination,
      durationMinutes: 0,
      bufferMinutes: params.travelBufferMinutes || 15,
      totalEstimatedMinutes: params.travelBufferMinutes || 15,
      distanceKm: 0,
      distanceText: 'Unavailable',
      mode: params.mode || 'driving',
      hasConflict: false,
      liveRoutingAvailable: false,
      error: errData.error || 'Live routing unavailable',
    };
  }

  return response.json();
}

/**
 * Helper to compute departure time given start time string ("HH:mm") and total minutes needed.
 */
export function computeDepartureTime(startTimeStr: string, totalMinutesNeeded: number): string {
  const [h, m] = startTimeStr.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return startTimeStr;

  let totalMins = h * 60 + m - totalMinutesNeeded;
  if (totalMins < 0) totalMins += 24 * 60; // wrap day if needed

  const depHours = Math.floor(totalMins / 60) % 24;
  const depMins = totalMins % 60;
  return `${depHours.toString().padStart(2, '0')}:${depMins.toString().padStart(2, '0')}`;
}

/**
 * Checks if travel to an event causes a schedule conflict with preceding events on the same day.
 */
export function detectTravelConflict(params: {
  targetEvent: CalendarEvent;
  sameDayEvents: CalendarEvent[];
  travelMinutes: number;
  bufferMinutes: number;
}): { hasConflict: boolean; details?: string; precedingEvent?: CalendarEvent } {
  const { targetEvent, sameDayEvents, travelMinutes, bufferMinutes } = params;
  if (!targetEvent.startTime || !targetEvent.location) {
    return { hasConflict: false };
  }

  const [targetH, targetM] = targetEvent.startTime.split(':').map(Number);
  const targetStartTotal = targetH * 60 + targetM;
  const totalNeeded = travelMinutes + bufferMinutes;
  const requiredDepartureTotal = targetStartTotal - totalNeeded;

  // Find the event that ends closest before targetEvent
  const precedingEvents = sameDayEvents
    .filter((e) => e.id !== targetEvent.id && e.endTime)
    .map((e) => {
      const [eh, em] = e.endTime.split(':').map(Number);
      return { event: e, endTotal: eh * 60 + em };
    })
    .filter((item) => item.endTotal <= targetStartTotal)
    .sort((a, b) => b.endTotal - a.endTotal);

  if (precedingEvents.length === 0) {
    return { hasConflict: false };
  }

  const closest = precedingEvents[0];
  if (closest.endTotal > requiredDepartureTotal) {
    const deficit = closest.endTotal - requiredDepartureTotal;
    return {
      hasConflict: true,
      precedingEvent: closest.event,
      details: `Travel to "${targetEvent.title}" requires ${travelMinutes}m travel + ${bufferMinutes}m buffer (departure by ${computeDepartureTime(targetEvent.startTime, totalNeeded)}), but "${closest.event.title}" ends at ${closest.event.endTime}. Schedule conflict of ~${deficit}m.`,
    };
  }

  return { hasConflict: false };
}
