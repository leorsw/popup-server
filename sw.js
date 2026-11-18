const CACHE_NAME = 'ai-push-v2'; // שינוי הגרסה מאלץ רענון מטמון

// התקנת ה-Service Worker ומחיקת מטמון ישן
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('מוחק מטמון ישן:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// קבלת התראת Push מהשרת ושמירתה ב-IndexedDB
self.addEventListener('push', (event) => {
  let data = { title: 'התראה חדשה', body: 'קיבלת הודעה מהסוכן' };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  // שמירה ב-IndexedDB
  const promiseChain = new Promise((resolve, reject) => {
    const request = indexedDB.open('PushMessagesDB', 1);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('messages')) {
        db.createObjectStore('messages', { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = (e) => {
      const db = e.target.result;
      const tx = db.transaction('messages', 'readwrite');
      const store = tx.objectStore('messages');
      store.add({
        title: data.title,
        body: data.body,
        timestamp: new Date().toISOString()
      });

      tx.oncomplete = () => {
        resolve();
      };
    };

    request.onerror = () => resolve(); // ממשיכים גם אם השמירה נכשלה
  }).then(() => {
    return self.registration.showNotification(data.title, {
      body: data.body,
      icon: 'icon.png',
      badge: 'icon.png'
    });
  });

  event.waitUntil(promiseChain);
});

// לחיצה על ההתראה
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // כתובת היעד המדויקת של האפליקציה ב-GitHub Pages
  const targetUrl = self.location.origin + '/popup-server/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // אם הלשונית כבר פתוחה - התמקד בה
      for (const client of clientList) {
        if (client.url.includes('/popup-server/') && 'focus' in client) {
          return client.focus();
        }
      }
      // אם הלשונית אינה פתוחה - פתח את הכתובת הנכונה
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
