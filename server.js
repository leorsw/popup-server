const express = require('express');
const bodyParser = require('body-parser');
const webpush = require('web-push');

// 1. ייבוא חבילת cors
const cors = require('cors');

const app = express();

// 2. הפעלת CORS - חייב להיות בתחילת הקובץ לפני הגדרת ה-Routes
app.use(cors({
  origin: [
    'https://YOUR_USERNAME.github.io', // כתובת ה-PWA שלך ב-GitHub Pages
    'http://localhost:3000'              // בדיקה מקומית (אופציונלי)
  ]
}));

app.use(bodyParser.json());

// --- לאחר מכן מגיעים ה-Endpoints של השרת ---

app.post('/api/subscribe', (req, res) => {
  // קוד הרשאה
});

app.post('/api/ai-notify', (req, res) => {
  // קוד שליחת התראה
});

app.listen(3000, () => console.log('Server running...'));
