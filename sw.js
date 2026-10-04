// sw.js

// פונקציית עזר לשמירת הודעה ב-IndexedDB
function saveMessageToIndexedDB(data) {
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

self.addEventListener('push', (event) => {
  let data = { title: 'התראה חדשה', body: '' };

  if (event.data) {
    try {
      const json = event.data.json();
      data = json.payload || json;
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const payloadData = {
    title: data.title || 'התראה חדשה',
    body: data.body || '',
    timestamp: data.timestamp || Date.now()
  };

  event.waitUntil(
    Promise.all([
      // 1. שמירה במסד הנתונים שזמין גם באייפון
      saveMessageToIndexedDB(payloadData),
      
      // 2. הצגת ההתראה במסך האייפון
      self.registration.showNotification(payloadData.title, {
        body: payloadData.body,
        icon: '/icon.png',
        data: payloadData
      }),

      // 3. ניסיון שליחה בזמן אמת אם האפליקציה פתוחה
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'PUSH_NOTIFICATION_RECEIVED',
            payload: payloadData
          });
        });
      })
    ])
  );
});

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
