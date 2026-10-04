// sw.js

self.addEventListener('push', (event) => {
  let payload = { title: 'התראה חדשה', body: '' };

  if (event.data) {
    try {
      const json = event.data.json();
      payload = json.payload || json;
    } catch (e) {
      payload.body = event.data.text();
    }
  }

  const title = payload.title || 'התראה חדשה';
  const options = {
    body: payload.body || '',
    icon: '/icon.png',
    data: {
      title: title,
      body: payload.body || '',
      timestamp: payload.timestamp || Date.now()
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// 📌 חלק קריטי: לחיצה על ההתראה מעבירה את הנתונים ב-URL ל-PWA
self.addEventListener('notificationclick', (event) => {
  event.notification.close(); // סגירת ההתראה במסך

  const notificationData = event.notification.data || {};
  const title = encodeURIComponent(notificationData.title || '');
  const body = encodeURIComponent(notificationData.body || '');
  const timestamp = notificationData.timestamp || Date.now();

  // יצירת כתובת URL שכוללת את כל פרטי ההודעה
  const targetUrl = new URL(`/?title=${title}&body=${body}&ts=${timestamp}`, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // אם האפליקציה כבר פתוחה ברקע - ניקח אותה ונפנה אותה ל-URL עם הפרמטרים
      for (const client of clientList) {
        if ('navigate' in client && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // אם האפליקציה סגורה - נפתח חלון חדש עם ה-URL והנתונים
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
