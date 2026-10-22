const express = require('express');
const webpush = require('web-push');
const bodyParser = require('body-parser');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();

// 1. הגדרת CORS
const corsOptions = {
  origin: [
    'https://leorsw.github.io',
    'http://localhost:3000',
    'http://127.0.0.1:5500'
  ],
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'let-it-bleed-1969']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(bodyParser.json());

// 2. אתחול Supabase
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️ WARNING: SUPABASE_URL or SUPABASE_KEY is missing in Environment Variables!');
}

const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder-key'
);

// 3. הגדרת VAPID
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

// 4. שמירת / עדכון מנוי
app.post('/api/subscribe', async (req, res) => {
  const { subscription, deviceName } = req.body.subscription ? req.body : { subscription: req.body, deviceName: null };

  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Invalid subscription data' });
  }

  const { data, error } = await supabase
    .from('subscriptions')
    .upsert(
      {
        endpoint: subscription.endpoint,
        keys: subscription.keys,
        device_name: deviceName || 'מכשיר נייד'
      },
      { onConflict: 'endpoint' }
    );

  if (error) {
    console.error('Error saving subscription to Supabase:', error);
    return res.status(500).json({ error: error.message });
  }

  console.log('Subscription saved successfully');
  res.status(201).json({ success: true });
});

// 5. שליפת רשימת מכשירים מחוברים
app.get('/api/devices', async (req, res) => {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('id, endpoint, device_name, created_at');

  if (error) {
    console.error('Error fetching devices:', error);
    return res.status(500).json({ error: error.message });
  }

  const devices = (data || []).map((sub, index) => ({
    id: sub.id || sub.endpoint,
    endpoint: sub.endpoint,
    name: sub.device_name || `מכשיר ${index + 1}`,
    createdAt: sub.created_at
  }));

  res.json({ devices });
});

// 6. עדכון שם מכשיר
app.post('/api/update-device-name', async (req, res) => {
  const { endpoint, deviceName } = req.body;

  if (!endpoint || !deviceName) {
    return res.status(400).json({ error: 'Missing endpoint or deviceName' });
  }

  const { error } = await supabase
    .from('subscriptions')
    .update({ device_name: deviceName })
    .eq('endpoint', endpoint);

  if (error) {
    console.error('Error updating device name:', error);
    return res.status(500).json({ error: error.message });
  }

  res.json({ success: true });
});

// 7. ניתוק / מחיקת מכשיר
app.delete('/api/unsubscribe', async (req, res) => {
  const { endpoint } = req.body;

  if (!endpoint) {
    return res.status(400).json({ error: 'Endpoint is required' });
  }

  const { error } = await supabase
    .from('subscriptions')
    .delete()
    .eq('endpoint', endpoint);

  if (error) {
    console.error('Error deleting subscription:', error);
    return res.status(500).json({ error: error.message });
  }

  console.log('Device disconnected successfully:', endpoint);
  res.json({ success: true, message: 'Device disconnected successfully' });
});

// 8. שליחת התראה (מאובטח ב-API Key)
app.post('/api/ai-notify', async (req, res) => {
  const apiKey = req.headers['let-it-bleed-1969'] || req.headers['x-api-key'];
  const expectedApiKey = process.env.API_SECRET_KEY;

  if (!expectedApiKey || apiKey !== expectedApiKey) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing API Key' });
  }

  const { title, message, body, url } = req.body;

  const { data: dbSubscriptions, error } = await supabase
    .from('subscriptions')
    .select('*');

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  if (!dbSubscriptions || dbSubscriptions.length === 0) {
    return res.status(400).json({ error: 'No subscribed clients found in database.' });
  }

  const contentText = body || message || '';

  const payload = JSON.stringify({
    title: title || 'עדכון מסוכן ה-AI',
    body: contentText,
    message: contentText,
    url: url || './',
    timestamp: Date.now()
  });

  const notifications = dbSubscriptions.map(async (row) => {
    const subFormat = {
      endpoint: row.endpoint,
      keys: row.keys
    };

    try {
      await webpush.sendNotification(subFormat, payload);
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        await supabase
          .from('subscriptions')
          .delete()
          .eq('endpoint', row.endpoint);
      }
    }
  });

  await Promise.all(notifications);
  res.status(200).json({ success: true, sentTo: dbSubscriptions.length });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port
