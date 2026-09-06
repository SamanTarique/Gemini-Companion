import { LiveSearchResult, TaskItem, CalendarEvent, UserPreferences } from '../types';

export interface LiveSearchParams {
  query: string;
  includeUserContext?: boolean;
  tasks?: TaskItem[];
  events?: CalendarEvent[];
  preferences?: UserPreferences;
  timezone?: string;
  userLocation?: { lat: number; lng: number; displayName?: string } | null;
  language?: string;
}

/**
 * Execute an AI Live Search with Google Search Grounding, real routing, and context integration
 */
export async function executeLiveSearch(params: LiveSearchParams): Promise<LiveSearchResult> {
  const query = params.query.trim();
  if (!query) {
    throw new Error('Search query is required.');
  }

  // Sanitize context: pass only relevant high-level metadata without sensitive internal fields
  let contextPayload: any = undefined;
  if (params.includeUserContext) {
    contextPayload = {
      tasks: (params.tasks || []).slice(0, 15).map((t) => ({
        title: t.title,
        priority: t.priority,
        category: t.category,
        dueDate: t.dueDate,
        dueTime: t.dueTime,
      })),
      events: (params.events || []).slice(0, 10).map((e) => ({
        title: e.title,
        date: e.date,
        startTime: e.startTime,
        endTime: e.endTime,
        location: e.location,
      })),
      preferences: {
        locationCity: params.userLocation?.displayName || params.preferences?.locationCity || '',
        energyPacing: params.preferences?.energyPacing || 'balanced',
        workdayStart: params.preferences?.workdayStart || '09:00',
        workdayEnd: params.preferences?.workdayEnd || '18:00',
        language: params.language || params.preferences?.language || 'auto',
      },
      timezone: params.timezone || 'UTC',
    };
  }

  const res = await fetch('/api/gemini/live-search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      includeUserContext: !!params.includeUserContext,
      userContext: contextPayload,
      userCoordinates: params.userLocation ? {
        lat: params.userLocation.lat,
        lng: params.userLocation.lng,
        displayName: params.userLocation.displayName,
      } : null,
      language: params.language || params.preferences?.language || 'auto',
    }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Search failed with status ${res.status}`);
  }

  const data = await res.json();
  return {
    query,
    answer: data.answer || '',
    sources: data.sources || [],
    searchQueries: data.searchQueries || [],
    suggestedActions: data.suggestedActions || [],
    contextUsed: data.contextUsed,
    routeInfo: data.routeInfo,
    requiresLocationPermission: data.requiresLocationPermission,
    timestamp: Date.now(),
  };
}
