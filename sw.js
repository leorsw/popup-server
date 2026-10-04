// sw.js

// פונקציה אמינה לכתיבה ל-IndexedDB
function saveToDB(data) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('PushMessagesDB', 1);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('messages')) {
        db.createObjectStore('messages', { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = (event) => {
      const db = event.target.result;
      const tx = db.transaction('messages', 'readwrite');
      const store = tx.objectStore('messages');
      store.add({
        title: data.title || 'התראה חדשה',
        body: data.body || '',
        timestamp: data.timestamp || Date.now()
      });
      tx.oncomplete = () => resolve();
    };

    request.onerror = (err) => reject(err);
  });
}

// קבלת הפוש ושמירתו מיד במסד הנתונים
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

  const payloadData = {
    title: payload.title || 'התראה חדשה',
    body: payload.body || payload.message || '',
    timestamp: payload.timestamp || Date.now()
  };

  event.waitUntil(
    Promise.all([
      saveToDB(payloadData),
      self.registration.showNotification(payloadData.title, {
        body: payloadData.body,
        icon: '/icon.png',
        data: payloadData
      })
    ])
  );
});

// בלחיצה על ההתראה - שמירה מחדש ליתר ביטחון ופתיחת/מיקוד האפליקציה
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};

  event.waitUntil(
    saveToDB(data).then(() => {
      return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow('/');
        }
      });
    })
  );
});

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
