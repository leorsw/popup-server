const express = require('express');
const webpush = require('web-push');
const bodyParser = require('body-parser');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();

// 1. הגדרת CORS נקייה ללא מחרוזות רגישות קשיחות בקוד
const corsOptions = {
  origin: [
    'https://leorsw.github.io',
    'http://localhost:3000',
    'http://127.0.0.1:5500'
  ],
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'x-custom-auth', 'x-subscribe-code']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(bodyParser.json());

// 2. אתחול Supabase
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';

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
}

app.get('/', (req, res) => res.send('AI Push Backend + Supabase is running!'));

// 3b. אימות לניהול: מפתח ה-API (לסקריפטים) או קוד ההרשמה (לדפדפן)
const subscribeCode = process.env.SUBSCRIBE_CODE || '';
function requireManagementAuth(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.headers['x-custom-auth'];
  const expectedApiKey = process.env.API_SECRET_KEY;
  if (expectedApiKey && apiKey === expectedApiKey) return next();
  const code = req.headers['x-subscribe-code'] || (req.body && req.body.code);
  if (subscribeCode && code === subscribeCode) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

// 3c. Keepalive פתוח לשמירה על הפרויקט ער — קריאת DB קטנה, בלי מידע רגיש
app.get('/api/keepalive', async (req, res) => {
  try {
    const { error } = await supabase.from('subscriptions').select('id').limit(1);
    if (error) return res.status(500).json({ ok: false, error: error.message });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

// 4. שמירת / עדכון מנוי כולל שם מכשיר
app.post('/api/subscribe', async (req, res) => {
  const bodyData = req.body || {};

  // שער קוד סודי — נכשל סגור אם הקוד לא הוגדר בשרת
  if (!subscribeCode) {
    return res.status(503).json({ error: 'Subscribe code not configured' });
  }
  if (!bodyData.code || bodyData.code !== subscribeCode) {
    return res.status(403).json({ error: 'Invalid subscribe code' });
  }

  const subscription = bodyData.subscription || bodyData;
  const deviceName = bodyData.deviceName || 'מכשיר נייד';

  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Invalid subscription data' });
  }

  const { error } = await supabase
    .from('subscriptions')
    .upsert(
      {
        endpoint: subscription.endpoint,
        keys: subscription.keys,
        device_name: deviceName
      },
      { onConflict: 'endpoint' }
    );

  if (error) {
    console.error('Error saving subscription:', error);
    return res.status(500).json({ error: error.message });
  }

  res.status(201).json({ success: true });
});

// 5. שליפת מכשירים מחוברים
app.get('/api/devices', requireManagementAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*');

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const devices = (data || []).map((sub, index) => ({
      id: sub.id || sub.endpoint,
      endpoint: sub.endpoint,
      name: sub.device_name || `מכשיר ${index + 1}`,
      createdAt: sub.created_at || new Date().toISOString()
    }));

    res.json({ devices });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 6. עדכון שם מכשיר
app.post('/api/update-device-name', requireManagementAuth, async (req, res) => {
  const { endpoint, deviceName } = req.body;

  if (!endpoint || !deviceName) {
    return res.status(400).json({ error: 'Missing endpoint or deviceName' });
  }

  const { error } = await supabase
    .from('subscriptions')
    .update({ device_name: deviceName })
    .eq('endpoint', endpoint);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ success: true });
});

// 7. ניתוק מכשיר
app.delete('/api/unsubscribe', requireManagementAuth, async (req, res) => {
  const { endpoint } = req.body;

  if (!endpoint) {
    return res.status(400).json({ error: 'Endpoint is required' });
  }

  const { error } = await supabase
    .from('subscriptions')
    .delete()
    .eq('endpoint', endpoint);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json({ success: true });
});

// 8. שליחת התראה מאובטחת
app.post('/api/ai-notify', async (req, res) => {
  // אימות מול הכותרת הרגילה x-api-key או מול משתנה סביבה ייעודי
  const apiKey = req.headers['x-api-key'] || req.headers['x-custom-auth'];
  const expectedApiKey = process.env.API_SECRET_KEY;

  if (!expectedApiKey || apiKey !== expectedApiKey) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing API Key' });
  }

  const { title, message, body, url } = req.body;

  const { data: dbSubscriptions, error } = await supabase
    .from('subscriptions')
    .select('*');

  if (error || !dbSubscriptions || dbSubscriptions.length === 0) {
    return res.status(400).json({ error: 'No subscribers found' });
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
    try {
      await webpush.sendNotification({ endpoint: row.endpoint, keys: row.keys }, payload);
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        await supabase.from('subscriptions').delete().eq('endpoint', row.endpoint);
      }
    }
  });

  await Promise.all(notifications);
  res.status(200).json({ success: true, sentTo: dbSubscriptions.length });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
