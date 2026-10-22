const express = require('express');
const webpush = require('web-push');
const bodyParser = require('body-parser');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();

// 1. הגדרת CORS מדויקת
const corsOptions = {
  origin: [
    'https://leorsw.github.io', // ה-Origin התקני של GitHub Pages
    'http://localhost:3000',
    'http://127.0.0.1:5500'
  ],
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'let-it-bleed-1969']
};

app.use(cors(corsOptions));

// טיפול מפורש בבקשות Preflight
app.options('*', cors(corsOptions));

app.use(bodyParser.json());

// 2. אתחול לקוח Supabase
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️ WARNING: SUPABASE_URL or SUPABASE_KEY is missing in Environment Variables!');
}

const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder-key'
);

// 3. הגדרת מפתחות VAPID
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

// 4. שמירת Subscription חדש במסד הנתונים
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

// 5. שליפת רשימת המכשירים/המנויים המחוברים
app.get('/api/devices', async (req, res) => {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('id, endpoint, created_at');

  if (error) {
    console.error('Error fetching devices:', error);
    return res.status(500).json({ error: error.message });
  }

  const devices = (data || []).map((sub, index) => ({
    id: sub.id || sub.endpoint,
    endpoint: sub.endpoint,
    name: `מכשיר ${index + 1}`,
    createdAt: sub.created_at
  }));

  res.json({ devices });
});

// 6. ניתוק/מחיקת מכשיר לפי Endpoint
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
    console.error('Error deleting subscription from Supabase:', error);
    return res.status(500).json({ error: error.message });
  }

  console.log('Device disconnected successfully:', endpoint);
  res.json({ success: true, message: 'Device disconnected successfully' });
});

// 7. שליחת התראה לכל המנויים (מאובטח ב-API Key)
app.post('/api/ai-notify', async (req, res) => {
  // express הופך headers ל-lowercase אוטומטית
  const apiKey = req.headers['let-it-bleed-1969'] || req.headers['x-api-key'];
  const expectedApiKey = process.env.API_SECRET_KEY;

  console.log(`[AUTH CHECK] Received Key: "${apiKey}" | Expected Key Exists: ${!!expectedApiKey}`);

  if (!expectedApiKey) {
    console.error('❌ API_SECRET_KEY is missing in Render environment variables!');
    return res.status(500).json({ error: 'Server misconfiguration: API_SECRET_KEY is not set' });
  }

  if (apiKey !== expectedApiKey) {
    console.warn(`❌ Unauthorized access attempt. Received key does not match API_SECRET_KEY.`);
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing API Key' });
  }

  const { title, message, body, url } = req.body;

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

  // תמיכה כפולה ב-body וב-message לתאימות מלאה מול ה-Service Worker
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
