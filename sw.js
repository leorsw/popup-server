self.addEventListener('push', function(event) {
    let notificationData = { title: 'הודעה חדשה', body: '' };

    if (event.data) {
        try {
            // מנסה לקרוא כמו JSON תקין
            notificationData = event.data.json();
        } catch (e) {
            // אם זה נכשל ומדובר בטקסט רגיל
            notificationData.body = event.data.text();
        }
    }

    const options = {
        body: notificationData.body,
        icon: 'icon.png'
    };

    event.waitUntil(
        self.registration.showNotification(notificationData.title, options)
    );
});
