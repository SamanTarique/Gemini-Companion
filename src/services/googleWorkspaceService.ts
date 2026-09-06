import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, getGoogleAccessToken, connectGoogleWorkspace, sanitizeFirestorePayload } from '../lib/firebase';
import { GoogleIntegrationMetadata, CalendarEvent, GmailDetectedItem, PriorityLevel } from '../types';

export interface GoogleCalendarItemRaw {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end?: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  htmlLink?: string;
  status?: string;
}

export interface GmailMessageSummary {
  id: string;
  threadId?: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
}

/**
 * Load saved integration metadata from Firestore
 */
export async function getGoogleIntegrationMetadata(userId: string): Promise<GoogleIntegrationMetadata | null> {
  try {
    const docRef = doc(db, 'users', userId, 'integrations', 'google');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as GoogleIntegrationMetadata;
    }
    return null;
  } catch (err) {
    console.error('Failed to load Google integration metadata:', err);
    return null;
  }
}

/**
 * Save or update integration metadata in Firestore
 */
export async function saveGoogleIntegrationMetadata(
  userId: string,
  metadata: Partial<GoogleIntegrationMetadata>
): Promise<void> {
  try {
    const docRef = doc(db, 'users', userId, 'integrations', 'google');
    const clean = sanitizeFirestorePayload({
      ...metadata,
      lastSyncedAt: Date.now(),
    });
    await setDoc(docRef, clean, { merge: true });
  } catch (err) {
    console.error('Failed to save Google integration metadata:', err);
  }
}

/**
 * Ensure an active Google OAuth Access Token exists; if missing, triggers popup auth.
 */
export async function ensureGoogleToken(): Promise<string> {
  const existing = getGoogleAccessToken();
  if (existing) {
    return existing;
  }
  const newToken = await connectGoogleWorkspace();
  if (!newToken) {
    throw new Error('Google authentication was cancelled or failed to grant permissions.');
  }
  return newToken;
}

/**
 * Fetch calendar events from Google Calendar API through server proxy
 */
export async function fetchGoogleCalendarEvents(params?: {
  timeMin?: string;
  timeMax?: string;
}): Promise<CalendarEvent[]> {
  const token = await ensureGoogleToken();

  const queryParams = new URLSearchParams();
  if (params?.timeMin) queryParams.set('timeMin', params.timeMin);
  if (params?.timeMax) queryParams.set('timeMax', params.timeMax);

  const res = await fetch(`/api/google/calendar/events?${queryParams.toString()}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      throw new Error('Google authorization expired. Please reconnect Google Calendar in Settings.');
    }
    throw new Error(data.error || 'Failed to fetch Google Calendar events');
  }

  const result = await res.json();
  return result.events || [];
}

/**
 * Create or sync an event to Google Calendar through server proxy
 */
export async function createGoogleCalendarEvent(eventData: {
  title: string;
  description?: string;
  location?: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  timezone: string;
}): Promise<any> {
  const token = await ensureGoogleToken();

  const res = await fetch('/api/google/calendar/events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(eventData),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to export event to Google Calendar');
  }

  return await res.json();
}

/**
 * Fetch relevant emails from Gmail through server proxy
 */
export async function fetchGmailMessages(params?: {
  query?: string;
  maxResults?: number;
}): Promise<GmailMessageSummary[]> {
  const token = await ensureGoogleToken();

  const queryParams = new URLSearchParams();
  if (params?.query) queryParams.set('q', params.query);
  if (params?.maxResults) queryParams.set('maxResults', String(params.maxResults));

  const res = await fetch(`/api/google/gmail/messages?${queryParams.toString()}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      throw new Error('Google authorization expired. Please reconnect Gmail in Settings.');
    }
    throw new Error(data.error || 'Failed to fetch Gmail messages');
  }

  const result = await res.json();
  return result.messages || [];
}

/**
 * Detect commitments, tasks, and deadlines from email summaries using Gemini AI
 */
export async function detectCommitmentsFromEmails(
  messages: GmailMessageSummary[],
  timezone: string
): Promise<GmailDetectedItem[]> {
  if (!messages || messages.length === 0) {
    return [];
  }

  const res = await fetch('/api/google/gmail/detect-commitments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages,
      timezone,
    }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to analyze emails for commitments');
  }

  const result = await res.json();
  return result.detectedItems || [];
}
