const fs=require('fs');
const js=fs.readFileSync('Projects/games/taskrunner/game.js','utf8');
const api=fs.readFileSync('api/leaderboard/index.js','utf8');
let archive='';
try { archive=fs.readFileSync('api/archive/index.js','utf8'); } catch(e) { console.log('api/archive/index.js not found'); }
const gameCats=[...js.matchAll(/LB_CATEGORIES:\s*\[([^\]]+)\]/g)].map(function(m){return m[1]});
const apiValid=[...api.matchAll(/VALID\s*=\s*\[([^\]]+)\]/g)].map(function(m){return m[1]});
const archiveExtra=archive ? [...archive.matchAll(/LB_CATEGORIES_EXTRA\s*=\s*\[([^\]]+)\]/g)].map(function(m){return m[1]}) : [];
console.log('Game categories:', gameCats[0] || 'NOT FOUND');
console.log('API valid categories:', apiValid[0] || 'NOT FOUND');
console.log('Archive extra categories:', archiveExtra[0] || 'NOT FOUND');
