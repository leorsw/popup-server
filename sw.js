// אירוע התקנה - מדלג על המתנה ומשתלט מיד
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// אירוע אקטיבציה - תופס שליטה על כל הלשוניות הפתוחות
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// קבלת התראת Push מהשרת
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
  const bodyText = data.message || data.body || '';

  const options = {
    body: bodyText,
    icon: './icon.png',
    badge: './badge.png',
    data: { url: data.url || './' }
  };

  // 1. הצגת התראת פופ-אפ במערכת ההפעלה/בדפדפן
  const notificationPromise = self.registration.showNotification(title, options);

  // 2. שידור תוכן ההודעה ל-index.html בזמן אמת (כולל חלונות שעדיין בלתי נשלטים)
  const messageClientsPromise = self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  }).then((clients) => {
    clients.forEach((client) => {
      client.postMessage({
        type: 'PUSH_NOTIFICATION_RECEIVED',
        payload: {
          title: title,
          body: bodyText,
          timestamp: Date.now()
        }
      });
    });
  });

  event.waitUntil(Promise.all([notificationPromise, messageClientsPromise]));
});

// טיפול בלחיצה על ההתראה (פתיחה/מיקוד בלשונית)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || './';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let client of windowClients) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});
