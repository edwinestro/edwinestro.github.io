const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');

const DATA_FILE = path.resolve(__dirname, 'data.json');
function readData(){ try{ return JSON.parse(fs.readFileSync(DATA_FILE,'utf8')); }catch(e){ return {posts:[], likes:{}, subscribers:{}} }}
function writeData(d){ fs.writeFileSync(DATA_FILE, JSON.stringify(d,null,2),'utf8'); }

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.get('/api/ping', (req,res)=> res.json({ok:true}));

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
