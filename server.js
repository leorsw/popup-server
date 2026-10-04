const express = require('express');
const webpush = require('web-push');
const bodyParser = require('body-parser');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();

// הגדרת CORS
app.use(cors({
  origin: [
    'https://leorsw.github.io/popup-server/', // החלף ב-Username שלך ב-GitHub
    'http://localhost:3000'
  ]
}));

app.use(bodyParser.json());

// 1. חיבור ל-Supabase מתוך משתני סביבה
const publicVapidKey = process.env.VAPID_PUBLIC_KEY;
const privateVapidKey = process.env.VAPID_PRIVATE_KEY;

if (publicVapidKey && privateVapidKey) {
  try {
    webpush.setVapidDetails(
      'mailto:your-email@example.com',
      publicVapidKey,
      privateVapidKey
    );
    console.log('VAPID configured successfully');
  } catch (error) {
    console.error('Failed to set VAPID details:', error.message);
  }
} else {
  console.warn('VAPID keys are missing or not set properly.');
}

app.get('/', (req, res) => res.send('AI Push Backend + Supabase is running!'));

// 3. שמירת Subscription חדש במסד הנתונים
app.post('/api/subscribe', async (req, res) => {
  const subscription = req.body;

  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Invalid subscription data' });
  }

  // upsert: מכניס מנוי חדש, ואם ה-endpoint כבר קיים - מעדכן אותו
  const { data, error } = await supabase
    .from('subscriptions')
    .upsert(
      {
        endpoint: subscription.endpoint,
        keys: subscription.keys
      },
      { onConflict: 'endpoint' }
    );

  if (error) {
    console.error('Error saving subscription to Supabase:', error);
    return res.status(500).json({ error: error.message });
  }

  console.log('Subscription saved successfully to DB');
  res.status(201).json({ success: true });
});

// 4. שליחת התראה לכל המנויים הרשומים במסד הנתונים
app.post('/api/ai-notify', async (req, res) => {
  const { title, message, url } = req.body;

  // שליפת כל המנויים מ-Supabase
  const { data: dbSubscriptions, error } = await supabase
    .from('subscriptions')
    .select('*');

  if (error) {
    console.error('Error fetching subscriptions:', error);
    return res.status(500).json({ error: error.message });
  }

  if (!dbSubscriptions || dbSubscriptions.length === 0) {
    return res.status(400).json({ error: 'No subscribed clients found in database.' });
  }

  const payload = JSON.stringify({
    title: title || 'עדכון מסוכן ה-AI',
    message: message || '',
    url: url || './'
  });

  // שליחת ההתראה לכל המכשירים
  const notifications = dbSubscriptions.map(async (row) => {
    const subFormat = {
      endpoint: row.endpoint,
      keys: row.keys
    };

    try {
      await webpush.sendNotification(subFormat, payload);
    } catch (err) {
      console.error('Push error for endpoint:', row.endpoint, err.statusCode);
      // אם המנוי פג תוקף או הוסר מהמכשיר (410/404), מוחקים אותו מ-Supabase
      if (err.statusCode === 410 || err.statusCode === 404) {
        await supabase
          .from('subscriptions')
          .delete()
          .eq('endpoint', row.endpoint);
        console.log('Removed expired subscription from DB:', row.endpoint);
      }
    }
  });

  await Promise.all(notifications);
  res.status(200).json({ success: true, sentTo: dbSubscriptions.length });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
