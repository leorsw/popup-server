const express = require('express');
const webpush = require('web-push');
const bodyParser = require('body-parser');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();

// 1. הגדרת CORS מקיפה
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
  const bodyData = req.body || {};
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
    console.error('Error saving subscription to Supabase:', error);
    return res.status(500).json({ error: error.message });
  }

  console.log('Subscription saved successfully');
  res.status(201).json({ success: true });
});

// 5. שליפת רשימת מכשירים בצורה מאובטחת
app.get('/api/devices', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*');

    if (error) {
      console.error('Supabase fetch error:', error);
      return res.status(500).json({ error: error.message });
    }

    const devices = (data || []).map((sub, index) => ({
      id: sub.id || sub.endpoint,
      endpoint: sub.endpoint,
      name: sub.device
