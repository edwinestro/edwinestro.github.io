const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

const { getLeaderboard, submitScore } = require('./leaderboardStore');
const { publishLeaderboardToGitHub } = require('./githubPublisher');

const LEADERBOARD_XLSX = path.resolve(__dirname, 'leaderboard.xlsx');

const DATA_FILE = path.resolve(__dirname, 'data.json');
function readData(){ try{ return JSON.parse(fs.readFileSync(DATA_FILE,'utf8')); }catch(e){ return {posts:[], likes:{}, subscribers:{}} }}
function writeData(d){ fs.writeFileSync(DATA_FILE, JSON.stringify(d,null,2),'utf8'); }

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'https://edwinestro.github.io',
  'https://ashy-glacier-0eaccc510.azurestaticapps.net',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

const app = express();

// Security headers via helmet
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allow cross-origin for static files
  contentSecurityPolicy: false // CSP handled by Azure Static Web Apps
}));

// Global rate limiter (100 requests per minute per IP)
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { ok: false, error: 'Too many requests, please try again later' }
});
app.use('/api/', globalLimiter);

// CORS with restricted origins
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.) in dev
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS policy: origin not allowed'), false);
  },
  credentials: true
}));

app.use(bodyParser.json());

app.get('/api/ping', (req,res)=> res.json({ok:true}));

// Leaderboards (Excel-backed)
app.get('/api/leaderboard', async (req,res)=>{
  try {
    const game = req.query.game || 'thermal-drift';
    const limit = req.query.limit || 10;
    const data = await getLeaderboard(game, limit);
    res.json({ ok:true, ...data });
  } catch (e) {
    res.status(400).json({ ok:false, error: String(e && e.message ? e.message : e) });
  }
});

const leaderboardLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

app.post('/api/leaderboard', leaderboardLimiter, async (req,res)=>{
  try {
    const { game, name, score } = req.body || {};
    const data = await submitScore({ game, name, score });

    // Optional: sync to GitHub repo when someone achieves #1.
    // Enable by setting env var GITHUB_SYNC_ON_WIN=1 and providing GitHub env vars.
    const syncEnabled = String(process.env.GITHUB_SYNC_ON_WIN || '').toLowerCase() === '1'
      || String(process.env.GITHUB_SYNC_ON_WIN || '').toLowerCase() === 'true';

    const submittedScore = Number(score);
    const rank1 = (data.entries && data.entries[0]) ? data.entries[0] : null;
    const isWin = rank1 && Number(rank1.score) === Math.floor(submittedScore);

    if (syncEnabled && isWin && fs.existsSync(LEADERBOARD_XLSX)) {
      try {
        await publishLeaderboardToGitHub({
          game: data.game || game || 'thermal-drift',
          best: data.best,
          entries: data.entries,
          xlsxPathOnDisk: LEADERBOARD_XLSX,
        });
      } catch (e) {
        // Don't fail the submission if GitHub publish fails.
        console.warn('GitHub sync failed:', e && e.message ? e.message : e);
      }
    }

    res.json({ ok:true, ...data });
  } catch (e) {
    res.status(400).json({ ok:false, error: String(e && e.message ? e.message : e) });
  }
});

app.get('/api/leaderboard.xlsx', (req,res)=>{
  if (!fs.existsSync(LEADERBOARD_XLSX)) {
    return res.status(404).json({ ok:false, error: 'leaderboard.xlsx not found yet' });
  }
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="leaderboard.xlsx"');
  res.sendFile(LEADERBOARD_XLSX);
});

app.get('/api/posts', (req,res)=>{
  const d = readData();
  res.json(d.posts || []);
});

app.get('/api/likes', (req,res)=>{
  const d = readData();
  res.json(d.likes || {});
});

app.post('/api/like', (req,res)=>{
  const { postId, userId } = req.body;
  if(!postId || !userId) return res.status(400).json({error:'missing'});
  const d = readData(); d.likes = d.likes || {};
  d.likes[postId] = d.likes[postId] || [];
  if(!d.likes[postId].includes(userId)) d.likes[postId].push(userId);
  writeData(d);
  res.json({ok:true, count:d.likes[postId].length});
});

app.post('/api/unlike', (req,res)=>{
  const { postId, userId } = req.body;
  if(!postId || !userId) return res.status(400).json({error:'missing'});
  const d = readData(); d.likes = d.likes || {};
  d.likes[postId] = (d.likes[postId]||[]).filter(u=>u!==userId);
  writeData(d);
  res.json({ok:true, count:(d.likes[postId]||[]).length});
});

app.post('/api/subscribe', (req,res)=>{
  const { userId, name, email } = req.body;
  if(!userId) return res.status(400).json({error:'missing userId'});
  const d = readData(); d.subscribers = d.subscribers || {};
  d.subscribers[userId] = { name, email, at: new Date().toISOString() };
  writeData(d);
  res.json({ok:true});
});

// Serve static files for convenience if run in server folder
app.use('/', express.static(path.resolve(__dirname, '..')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log('API server listening on', PORT));
