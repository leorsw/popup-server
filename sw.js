self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'התראה חדשה';
  const options = {
    body: data.body || data.message || '',
    // כתובת היעד חייבת להיות כתובת ה-PWA שלך ב-GitHub Pages ולא ב-Render!
    data: { url: data.url || 'https://leorsw.github.io/popup-server/' },
    icon: './icon.png'
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );

  event.waitUntil(saveMessageToDB(data));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  // כאן מוגדרת הכתובת שתפתח בלחיצה על הפוש
  const targetUrl = event.notification.data.url || 'https://leorsw.github.io/popup-server/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});


// פונקציית עזר לשמירת הודעות ב-IndexedDB מתוך ה-Service Worker
async function saveMessageToDB(data) {
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
        title: data.title || 'התראה',
        body: data.body || data.message || '',
        timestamp: data.timestamp || Date.now()
      });

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };

    request.onerror = () => reject(request.error);
  });
}
