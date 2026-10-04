self.addEventListener('push', (event) => {
  let data = { title: 'התראה חדשה', message: '' };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.message = event.data.text();
    }
  }

  const title = data.title || 'התראה חדשה';
  const options = {
    body: data.message || data.body || '',
    icon: '/icon.png', // תמונה במידה וקיימת
    badge: '/badge.png',
    data: { url: data.url || './' }
  };

  // 1. הופעת ההתראה במסך
  const notificationPromise = self.registration.showNotification(title, options);

  // 2. העברת תוכן ההודעה ל-index.html אם העמוד פתוח בדפדפן
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
    const options = {
        body: notificationData.body,
        icon: 'icon.png'
    };

    event.waitUntil(
        self.registration.showNotification(notificationData.title, options)
    );
});
