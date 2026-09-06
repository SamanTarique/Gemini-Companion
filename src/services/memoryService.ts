import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  getDocs, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { db, sanitizeFirestorePayload } from '../lib/firebase';
import { JournalEntry, JournalMemory, UserPreferences } from '../types';

/**
 * In-flight memory deduplication cache to prevent duplicate memory creation on retries
 */
const inFlightMemoryIds = new Set<string>();

/**
 * Validates a generated memory object before Firestore persistence.
 * Ensures required fields are never undefined or malformed.
 */
function validateMemoryObject(memory: any): boolean {
  if (!memory || typeof memory !== 'object') return false;
  if (typeof memory.id !== 'string' || !memory.id.trim()) return false;
  if (typeof memory.userId !== 'string' || !memory.userId.trim()) return false;
  if (typeof memory.entryId !== 'string' || !memory.entryId.trim()) return false;
  if (typeof memory.title !== 'string' || !memory.title.trim()) return false;
  if (typeof memory.content !== 'string' || !memory.content.trim()) return false;
  if (typeof memory.summary !== 'string' || !memory.summary.trim()) return false;
  if (typeof memory.createdAt !== 'number' || isNaN(memory.createdAt) || memory.createdAt <= 0) return false;
  if (!Array.isArray(memory.embedding) || memory.embedding.length === 0) return false;
  
  // Strict check: reject if any property value is undefined
  for (const key of Object.keys(memory)) {
    if (memory[key] === undefined) return false;
  }
  return true;
}

/**
 * Long-Term AI Memory Service
 * Implements Long-Context Memory Directive (Section 15):
 * - Stores each complete journal entry as one memory unit (never split into chunks).
 * - Generates one embedding per complete entry.
 * - Stores the embedding with original entry metadata.
 * - Retrieves relevant entries using cosine similarity or direct full-history context.
 * - Strictly isolated by authenticated Firebase UID.
 */

export async function generateAndStoreMemory(params: {
  entry: JournalEntry;
  userId: string;
  preferences?: UserPreferences;
}): Promise<JournalMemory | null> {
  const { entry, userId, preferences } = params;

  if (!userId || typeof userId !== 'string') {
    return null;
  }

  // Respect user AI memory preference
  if (preferences && (preferences.aiMemoryEnabled === false || preferences.permissionAiMemory === false)) {
    return null;
  }

  // Check if content exists
  const textToEmbed = entry.content?.trim() || entry.messages.map((m) => m.content).join('\n');
  if (!textToEmbed || textToEmbed.trim().length === 0) {
    return null;
  }

  // Prevent duplicate concurrent memory creation for this entry
  const dedupeKey = `${userId}_${entry.id}`;
  if (inFlightMemoryIds.has(dedupeKey)) {
    return null;
  }
  inFlightMemoryIds.add(dedupeKey);

  try {
    // Derive clean, non-undefined summary with safe fallback
    const safeSummary = (typeof entry.summary === 'string' && entry.summary.trim())
      ? entry.summary.trim()
      : (textToEmbed.slice(0, 250).trim() || 'Journal reflection');

    const res = await fetch('/api/memory/embed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userId}`,
      },
      body: JSON.stringify({
        entryId: entry.id,
        title: entry.title || 'Journal Reflection',
        content: textToEmbed,
        mood: entry.mood || 'reflective',
        tags: Array.isArray(entry.tags) ? entry.tags : [],
        summary: safeSummary,
        createdAt: entry.createdAt || Date.now(),
      }),
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json().catch(() => ({}));
    const embedding = Array.isArray(data.embedding) ? data.embedding : [];
    if (embedding.length === 0) {
      return null;
    }

    const memoryId = `mem_${entry.id}`;
    const memoryDocRef = doc(db, 'users', userId, 'memories', memoryId);

    const memory: JournalMemory = {
      id: memoryId,
      userId,
      entryId: entry.id,
      title: (typeof entry.title === 'string' && entry.title.trim()) ? entry.title.trim().slice(0, 250) : 'Journal Reflection',
      content: textToEmbed,
      summary: safeSummary,
      mood: entry.mood || 'reflective',
      tags: Array.isArray(entry.tags) ? entry.tags : [],
      createdAt: (typeof entry.createdAt === 'number' && entry.createdAt > 0) ? entry.createdAt : Date.now(),
      embedding,
    };

    // Strict undefined stripping & deep sanitization before writing to Firestore
    const cleanMemory = sanitizeFirestorePayload(memory);

    // Validate memory object fields before Firestore write
    if (!validateMemoryObject(cleanMemory)) {
      console.warn('Memory validation failed before Firestore write. Skipping.');
      return null;
    }

    await setDoc(memoryDocRef, cleanMemory, { merge: true });
    return memory;
  } catch (error) {
    console.error('Error generating or storing memory unit:', error);
    return null;
  } finally {
    inFlightMemoryIds.delete(dedupeKey);
  }
}

/**
 * Retrieves relevant complete journal memories for a prompt or question.
 * If total history is small (<= 25 items), prefers direct full-history context.
 * Otherwise, performs semantic cosine similarity retrieval.
 */
export async function retrieveRelevantMemories(params: {
  queryText: string;
  userId: string;
  allMemories?: JournalMemory[];
  topK?: number;
}): Promise<JournalMemory[]> {
  const { queryText, userId, allMemories = [], topK = 4 } = params;
  if (!queryText.trim() || allMemories.length === 0) {
    return [];
  }

  // If user history is small enough to fit comfortably in Gemini's context window,
  // return direct full history (up to 15 recent entries) sorted by creation
  if (allMemories.length <= 15) {
    return allMemories.slice(0, 15);
  }

  try {
    const res = await fetch('/api/memory/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userId}`,
      },
      body: JSON.stringify({
        query: queryText,
        candidateMemories: allMemories.map((m) => ({
          id: m.id,
          entryId: m.entryId,
          title: m.title,
          content: m.content,
          summary: m.summary,
          mood: m.mood,
          tags: m.tags,
          createdAt: m.createdAt,
          embedding: m.embedding,
        })),
        topK,
      }),
    });

    if (!res.ok) {
      // Fallback: return most recent entries
      return allMemories.slice(0, topK);
    }

    const data = await res.json();
    return Array.isArray(data.memories) ? data.memories : allMemories.slice(0, topK);
  } catch (err) {
    console.warn('Memory search fallback to recent:', err);
    return allMemories.slice(0, topK);
  }
}

/**
 * Convenient wrapper to fetch memories and semantically retrieve relevant ones
 */
export async function searchSemanticMemories(params: {
  query: string;
  userId: string;
  topK?: number;
  minSimilarity?: number;
}): Promise<JournalMemory[]> {
  try {
    const all = await fetchUserMemories(params.userId);
    return await retrieveRelevantMemories({
      queryText: params.query,
      userId: params.userId,
      allMemories: all,
      topK: params.topK || 4,
    });
  } catch (e) {
    console.warn('Error in searchSemanticMemories:', e);
    return [];
  }
}

/**
 * Fetch all stored memories for the user from Firestore.
 */
export async function fetchUserMemories(userId: string): Promise<JournalMemory[]> {
  const memoriesRef = collection(db, 'users', userId, 'memories');
  const q = query(memoriesRef, orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  const list: JournalMemory[] = [];
  snapshot.forEach((docSnap) => {
    const d = docSnap.data();
    list.push({
      id: docSnap.id,
      userId,
      entryId: d.entryId || docSnap.id,
      title: d.title || 'Untitled Memory',
      content: d.content || '',
      summary: d.summary,
      mood: d.mood,
      tags: Array.isArray(d.tags) ? d.tags : [],
      createdAt: d.createdAt || Date.now(),
      embedding: Array.isArray(d.embedding) ? d.embedding : undefined,
    });
  });
  return list;
}

/**
 * Delete a specific memory item.
 */
export async function deleteMemoryItem(userId: string, memoryId: string): Promise<void> {
  const docRef = doc(db, 'users', userId, 'memories', memoryId);
  await deleteDoc(docRef);
}

/**
 * Clear all stored memories for the user.
 */
export async function clearAllUserMemories(userId: string): Promise<void> {
  const memories = await fetchUserMemories(userId);
  for (const mem of memories) {
    await deleteDoc(doc(db, 'users', userId, 'memories', mem.id));
  }
}
