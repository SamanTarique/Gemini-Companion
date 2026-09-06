import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  User,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  query,
  getDocs,
  writeBatch,
  doc,
  deleteDoc,
  getDocFromServer,
} from 'firebase/firestore';
import firebaseConfigJson from '../../firebase-applet-config.json';

interface FirebaseAppletConfig {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  storageBucket: string;
  messagingSenderId: string;
  measurementId?: string;
  oAuthClientId?: string;
  recaptchaSiteKey?: string;
  firestoreDatabaseId?: string;
}

const configData = firebaseConfigJson as FirebaseAppletConfig;

const firebaseConfig = {
  projectId: configData.projectId,
  appId: configData.appId,
  apiKey: configData.apiKey,
  authDomain: configData.authDomain,
  firestoreDatabaseId: configData.firestoreDatabaseId || 'ai-studio-remixogeminicomp-e8810829-7216-4c77-a026-0db295a4961f',
  storageBucket: configData.storageBucket,
  messagingSenderId: configData.messagingSenderId,
};

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Configure local session persistence (survives tab closure and browser refresh)
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.warn('Firebase Auth browserLocalPersistence notice:', err);
  });
}

export const db = getFirestore(
  app,
  firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
    ? firebaseConfig.firestoreDatabaseId
    : undefined
);

/**
 * Primary Google Sign-In Provider (Authentication only).
 * Uses strictly standard identity scopes (openid, profile, email).
 * Because this requests only standard non-sensitive scopes, Google does NOT trigger
 * the unverified app warning ("Google hasn't verified this app") during login.
 */
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

/**
 * Dedicated Google Workspace Provider for incremental authorization.
 * Used exclusively when the user explicitly requests Google Calendar & Gmail integration.
 */
export const googleWorkspaceProvider = new GoogleAuthProvider();
googleWorkspaceProvider.setCustomParameters({
  prompt: 'consent',
  access_type: 'offline',
});
googleWorkspaceProvider.addScope('https://www.googleapis.com/auth/calendar.events');
googleWorkspaceProvider.addScope('https://www.googleapis.com/auth/gmail.readonly');

// In-memory OAuth access token store (Never stored in localStorage or persistent storage)
let inMemoryGoogleAccessToken: string | null = null;

export function setGoogleAccessToken(token: string | null) {
  inMemoryGoogleAccessToken = token;
}

export function getGoogleAccessToken(): string | null {
  return inMemoryGoogleAccessToken;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate connection to Firestore on boot
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection().catch(() => {});

/**
 * Sign in with Google Popup
 */
export async function signInWithGoogle(): Promise<{ user: User; accessToken: string | null }> {
  const result = await signInWithPopup(auth, googleProvider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const token = credential?.accessToken || null;
  if (token) {
    setGoogleAccessToken(token);
  }
  return { user: result.user, accessToken: token };
}

/**
 * Re-authenticate / Connect Google Workspace to acquire OAuth Access Token for Calendar & Gmail
 * Triggers the incremental consent prompt specifically for calendar and email scopes.
 */
export async function connectGoogleWorkspace(): Promise<string | null> {
  const result = await signInWithPopup(auth, googleWorkspaceProvider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const token = credential?.accessToken || null;
  if (token) {
    setGoogleAccessToken(token);
  }
  return token;
}

/**
 * Format Firebase Auth errors into clear, actionable, and user-friendly messages.
 */
export function formatAuthError(error: any): { title: string; message: string; code?: string; actionHint?: string } {
  if (!error) {
    return {
      title: 'Authentication Error',
      message: 'An unknown authentication error occurred. Please try again.',
    };
  }

  const code = error?.code || '';
  const rawMessage = error?.message || '';

  switch (code) {
    case 'auth/popup-closed-by-user':
      return {
        title: 'Sign-In Cancelled',
        message: 'The Google authentication popup window was closed before signing in was completed.',
        code,
        actionHint: 'Click "Continue with Google" again to retry.',
      };
    case 'auth/popup-blocked':
      return {
        title: 'Popup Blocked by Browser',
        message: 'Your browser prevented the Google Sign-In window from opening.',
        code,
        actionHint: 'Please allow popups for this site in your browser address bar and try again.',
      };
    case 'auth/cancelled-popup-request':
      return {
        title: 'Sign-In In Progress',
        message: 'The previous sign-in attempt was interrupted by a new request.',
        code,
      };
    case 'auth/unauthorized-domain': {
      const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'current domain';
      return {
        title: 'Unauthorized Authentication Domain',
        message: `The domain "${currentHost}" is not listed in your Firebase project's authorized domains.`,
        code,
        actionHint: `Add "${currentHost}" in Firebase Console -> Authentication -> Settings -> Authorized domains.`,
      };
    }
    case 'auth/operation-not-allowed':
      return {
        title: 'Google Sign-In Disabled',
        message: 'The Google Sign-In provider is currently disabled in your Firebase project.',
        code,
        actionHint: 'Enable Google under Firebase Console -> Authentication -> Sign-in method.',
      };
    case 'auth/network-request-failed':
      return {
        title: 'Network Connection Error',
        message: 'Could not communicate with Google identity servers. Please verify your internet connection.',
        code,
        actionHint: 'Check your network connection and retry.',
      };
    case 'auth/user-disabled':
      return {
        title: 'Account Disabled',
        message: 'This user account has been disabled in the Firebase Authentication console.',
        code,
      };
    case 'auth/account-exists-with-different-credential':
      return {
        title: 'Account Exists',
        message: 'An account already exists with the same email address using another credential.',
        code,
      };
    default:
      return {
        title: 'Authentication Failed',
        message: rawMessage || 'Could not complete sign-in with Google. Please try again.',
        code: code || undefined,
      };
  }
}

/**
 * Sign out current user
 */
export async function signOutCurrentUser(): Promise<void> {
  setGoogleAccessToken(null);
  await signOut(auth);
}

/**
 * Get current Firebase ID Token for authenticating backend API requests
 */
export async function getCurrentUserToken(): Promise<string | null> {
  if (!auth.currentUser) return null;
  return await auth.currentUser.getIdToken();
}

/**
 * Strict undefined-stripping utility (Zero-Crash Payload Hygiene)
 * Strips any undefined fields recursively before sending objects to Firestore.
 */
export function sanitizeFirestorePayload<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return null as unknown as T;
  }
  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) => sanitizeFirestorePayload(item)) as unknown as T;
  }
  if (typeof obj === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = sanitizeFirestorePayload(value);
      }
    }
    return cleaned as T;
  }
  return obj;
}

/**
 * Comprehensive User Data Purge
 * Deletes all user documents in /users/{userId} and subcollections
 */
export async function deleteUserAllData(userId: string): Promise<void> {
  if (!userId) throw new Error('User ID is required for data deletion');

  // Subcollections to clear
  const subcollections = [
    'entries',
    'interactions',
    'schedules',
    'tasks',
    'plans',
    'focusSessions',
    'insights',
    'preferences',
    'events',
    'notifications',
    'memories',
    'integrations',
  ];

  for (const subcol of subcollections) {
    try {
      const colRef = collection(db, 'users', userId, subcol);
      const snapshot = await getDocs(query(colRef));
      if (!snapshot.empty) {
        const batch = writeBatch(db);
        snapshot.docs.forEach((docSnap) => {
          batch.delete(docSnap.ref);
        });
        await batch.commit();
      }
    } catch {
      // Continue cleanup
    }
  }

  // Delete root user document if exists
  try {
    const userDocRef = doc(db, 'users', userId);
    await deleteDoc(userDocRef);
  } catch {
    // Complete deletion flow
  }
}
