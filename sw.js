// אירוע התקנה - מאפשר ל-Service Worker להתחיל לפעול מיד
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// אירוע אקטיבציה - תופס שליטה על הלשוניות הפתוחות מיידית
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// 1. קבלת התראת Push מהשרת
self.addEventListener('push', (event) => {
  let data = { title: 'התראה חדשה', message: '' };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'התראה חדשה', message: event.data.text() };
    }
  }

  const title = data.title || 'התראה חדשה';
  const options = {
    body: data.message || data.body || '',
    icon: './icon.png',
    badge: './badge.png',
    data: { url: data.url || './' }
  };

  // הצגת ההתראה במסך הדפדפן / מערכת ההפעלה
  const notificationPromise = self.registration.showNotification(title, options);

  // העברת תוכן ההודעה בזמן אמת ל-index.html (אם העמוד פתוח בדפדפן)
  const messageClientsPromise = self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    clients.forEach((client) => {
      client.postMessage({
        type: 'PUSH_NOTIFICATION_RECEIVED',
        payload: {
          title: title,
          body: options.body,
          timestamp: Date.now()
        }
      });
    });
  });

  event.waitUntil(Promise.all([notificationPromise, messageClientsPromise]));
});

// 2. טיפול בלחיצה על ההתראה (פתיחת הדף/מיקוד בלשונית)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || './';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // אם הדף כבר פתוח - מביא אותו לקדמת המסך
      for (let client of windowClients) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // אם הדף לא פתוח - פותח לשונית חדשה
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});
