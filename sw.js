self.addEventListener('push', function(event) {
  let data = { title: 'התראה חדשה', message: 'קיבלת הודעה חדשה' };

  if (event.data) {
    try {
      // ניסיון לפענח כ-JSON
      data = event.data.json();
    } catch (e) {
      // אם זה טקסט רגיל ולא JSON
      data = { title: 'התראה חדשה', message: event.data.text() };
    }
  }

  const options = {
    body: data.message || data.body,
    icon: 'icon.png', // או כתובת מלאה לתמונה
    badge: 'icon.png'
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});
