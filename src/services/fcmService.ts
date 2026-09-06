import { AppNotification } from '../types';

export type PushPermissionStatus = 'granted' | 'denied' | 'default' | 'unsupported';

export interface PushNotificationResult {
  delivered: boolean;
  permission: PushPermissionStatus;
  error?: string;
}

/**
 * Checks if Notification API and Service Worker are supported in the current environment
 */
export function isPushNotificationSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'Notification' in window;
}

/**
 * Gets the current Notification permission state safely
 */
export function getNotificationPermissionState(): PushPermissionStatus {
  if (!isPushNotificationSupported()) {
    return 'unsupported';
  }
  try {
    return Notification.permission as PushPermissionStatus;
  } catch {
    return 'unsupported';
  }
}

/**
 * Requests browser notification permission clearly, handling iframe sandbox restrictions gracefully
 */
export async function requestPushNotificationPermission(): Promise<PushPermissionStatus> {
  if (!isPushNotificationSupported()) {
    return 'unsupported';
  }

  try {
    const result = await Notification.requestPermission();
    return result as PushPermissionStatus;
  } catch (err: any) {
    console.warn('[PushNotification] Permission request rejected or blocked by browser/iframe environment:', err);
    // In sandboxed iframes without allow-modals or allow-top-navigation, requestPermission throws or rejects
    return getNotificationPermissionState();
  }
}

/**
 * Registers the background service worker if supported
 */
export async function registerPushServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  // Gracefully skip service worker registration inside cross-origin / sandboxed iframes
  try {
    if (window.self !== window.top) {
      return null;
    }
  } catch {
    // Cross-origin window access throws, indicating sandboxed or framed environment
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/',
    });
    return registration;
  } catch (err) {
    console.warn('[PushNotification] Service worker registration notice:', err);
    return null;
  }
}

/**
 * Shows a native system/browser notification with confirmed delivery status.
 * Never claims delivery unless confirmed.
 */
export async function deliverNativeBrowserNotification(
  notification: AppNotification,
  onOpenItem?: (taskId?: string, eventId?: string) => void
): Promise<PushNotificationResult> {
  if (!isPushNotificationSupported()) {
    return { delivered: false, permission: 'unsupported', error: 'Notification API not supported' };
  }

  const permission = getNotificationPermissionState();
  if (permission !== 'granted') {
    return { delivered: false, permission, error: `Permission is ${permission}` };
  }

  try {
    // Attempt through ServiceWorkerRegistration first if active for true background notification
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        if (registration && registration.showNotification) {
          await registration.showNotification(notification.title, {
            body: notification.message || 'Upcoming reminder from Gemini Companion',
            icon: '/assets/icon.png',
            badge: '/assets/icon.png',
            tag: `notif_${notification.id}`,
            data: {
              notificationId: notification.id,
              taskId: notification.relatedTaskId,
              eventId: notification.relatedEventId,
              itemType: notification.itemType,
            },
            requireInteraction: notification.priority === 'urgent',
          });
          return { delivered: true, permission: 'granted' };
        }
      } catch (swErr) {
        // Fallback to standard window.Notification below
      }
    }

    // Standard Window Notification
    const nativeNotif = new Notification(notification.title, {
      body: notification.message || 'Upcoming reminder from Gemini Companion',
      icon: '/assets/icon.png',
      badge: '/assets/icon.png',
      tag: `notif_${notification.id}`,
      requireInteraction: notification.priority === 'urgent',
    });

    nativeNotif.onclick = () => {
      window.focus();
      nativeNotif.close();
      if (onOpenItem && (notification.relatedTaskId || notification.relatedEventId)) {
        onOpenItem(notification.relatedTaskId, notification.relatedEventId);
      }
    };

    return { delivered: true, permission: 'granted' };
  } catch (err: any) {
    console.warn('[PushNotification] Delivery failed:', err);
    return { delivered: false, permission, error: err?.message || 'Failed to display notification' };
  }
}
