// Firebase Cloud Messaging & Web Push Service Worker
/* eslint-disable no-restricted-globals */

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle Background Web Push / FCM
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let notificationData = {
    title: 'Gemini Companion Reminder',
    body: 'You have an upcoming commitment or reflection reminder.',
    icon: '/assets/icon.png',
    badge: '/assets/icon.png',
    tag: 'gemini-reminder',
    data: {},
  };

  try {
    const json = event.data.json();
    if (json.notification) {
      notificationData.title = json.notification.title || notificationData.title;
      notificationData.body = json.notification.body || notificationData.body;
      notificationData.icon = json.notification.icon || notificationData.icon;
    }
    if (json.data) {
      notificationData.data = json.data;
      if (json.data.title) notificationData.title = json.data.title;
      if (json.data.message || json.data.body) notificationData.body = json.data.message || json.data.body;
      if (json.data.notificationId) notificationData.tag = `notif_${json.data.notificationId}`;
    }
  } catch (err) {
    notificationData.body = event.data.text();
  }

  const options = {
    body: notificationData.body,
    icon: notificationData.icon,
    badge: notificationData.badge,
    tag: notificationData.tag,
    data: notificationData.data,
    renotify: true,
    requireInteraction: notificationData.data?.priority === 'urgent',
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'snooze', title: 'Snooze 10m' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(notificationData.title, options)
  );
});

// Handle Notification Click Actions
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const clickedAction = event.action;
  const notifData = event.notification.data || {};

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if available
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          client.postMessage({
            type: 'NOTIFICATION_CLICKED',
            action: clickedAction,
            data: notifData,
          });
          return client.focus();
        }
      }
      // Or open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});
