const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let W, H;
function resize(){
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// Player
const car = {
  x: W/2, y: H*0.75, angle: -Math.PI/2, speed:0,
  width: 28, length: 46, color:'#9ff1ff'
}

let keys = {};
window.addEventListener('keydown', e=>{ keys[e.key]=true; if(e.key==='r'){ reset(); } });
window.addEventListener('keyup', e=>{ keys[e.key]=false; });

let gameOver = false;
let level = 1;
const baseSurvive = 5; // seconds to survive first level (changed per request)
let levelTimer = baseSurvive;
let enemies = [];
const highKey = 'td-highscore';
let highscore = parseInt(localStorage.getItem(highKey) || '0', 10) || 0;
let coins = [];
let coinsCount = 0;
let lastCoinSpawn = 0;
let boostActive = false;
let boostTimer = 0;
let boostMultiplier = 1;
let started = false; // require user gesture to start (and request fullscreen)

function spawnEnemy(){
  const side = Math.floor(Math.random()*4);
  let x = W/2, y = H/2;
  if(side===0){ x = -30; y = 40 + Math.random()*(H-80); }
  if(side===1){ x = W+30; y = 40 + Math.random()*(H-80); }
  if(side===2){ x = 40 + Math.random()*(W-80); y = -30; }
  if(side===3){ x = 40 + Math.random()*(W-80); y = H+30; }
  // speed in pixels/second
  const speed = 60 + (level-1)*30 + Math.random()*30;
  const hits = 10; // bullets required to destroy
  enemies.push({x,y,r:14, speed, hits});
}

function resetEnemies(){ enemies = []; spawnEnemy(); }

let particles = [];
let bullets = [];
let fireAccumulator = 0;
const fireRate = 10; // shots per second
const bulletSpeed = 800; // pixels per second
const moveSpeedBase = 220; // pixels per second for WASD movement
function spawnFrost(x,y,intensity){
  // intensity 0..1
  const count = Math.ceil(2 + intensity*6);
  for(let i=0;i<count;i++){
    particles.push({
      x,y, vx:(Math.random()-0.5)*2 + (car.vx||0), vy:(Math.random()-0.5)*2 + (car.vy||0),
      life: 40+Math.random()*40, alpha:0.05+intensity*0.4, r:1+Math.random()*3
    });
  }
}

function updateParticles(elapsed){
  for(let i=particles.length-1;i>=0;i--){
    const p = particles[i];
    p.x += p.vx * elapsed; p.y += p.vy * elapsed; p.life -= 60*elapsed; p.alpha *= Math.pow(0.995, 60*elapsed);
    if(p.life<=0) particles.splice(i,1);
  }
  // slight float for coins
  for(let i=0;i<coins.length;i++){
    const c = coins[i]; c.y += Math.sin((performance.now()+c.seed)/600)*0.02;
  }
  // update bullets using elapsed seconds
  for(let i=bullets.length-1;i>=0;i--){
    const b = bullets[i]; 
    b.x += b.vx * elapsed; b.y += b.vy * elapsed; b.life -= elapsed;
    if(b.life <= 0 || b.x < -50 || b.x > W+50 || b.y < -50 || b.y > H+50) bullets.splice(i,1);
  }
  // firing: continuous fire at fireRate when started
  if(started && !gameOver){
    fireAccumulator += elapsed;
    const interval = 1 / fireRate;
    while(fireAccumulator >= interval){
      fireAccumulator -= interval;
      // spawn bullet at front of car
        const bx = car.x + Math.cos(car.angle) * (car.length/2 + 6);
        const by = car.y + Math.sin(car.angle) * (car.length/2 + 6);
        const bvx = Math.cos(car.angle) * bulletSpeed;
        const bvy = Math.sin(car.angle) * bulletSpeed;
        const br = car.length * 1.5; // radius = 1.5 * ship length (very large)
        bullets.push({x:bx,y:by,vx:bvx,vy:bvy,life:2,r:br});
    }
  }
}

function drawParticles(){
  ctx.save();
  particles.forEach(p=>{
    ctx.fillStyle = `rgba(200,255,255,${p.alpha})`;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
  });
  ctx.restore();
}

function drawCoins(){
  coins.forEach(c=>{
    ctx.save(); ctx.beginPath(); ctx.fillStyle='gold'; ctx.arc(c.x,c.y,c.r,0,Math.PI*2); ctx.fill(); ctx.strokeStyle='rgba(200,150,0,0.9)'; ctx.stroke(); ctx.restore();
  });
}

function drawBullets(){
  ctx.save(); ctx.fillStyle='rgba(180,240,255,0.95)';
  bullets.forEach(b=>{ ctx.beginPath(); ctx.arc(b.x,b.y,(b.r||3),0,Math.PI*2); ctx.fill(); });
  ctx.restore();
}

function drawTrack(){
  // simple horizon and markings
  // background gradient
  const grad = ctx.createLinearGradient(0,0,0,H);
  grad.addColorStop(0,'#001426'); grad.addColorStop(1,'#02122a');
  ctx.fillStyle = grad; ctx.fillRect(0,0,W,H);

  // center frost shimmer
  ctx.save(); ctx.globalCompositeOperation='lighter';
  const g2 = ctx.createLinearGradient(0,H*0.55,W,H);
  g2.addColorStop(0,'rgba(80,180,255,0.03)'); g2.addColorStop(1,'rgba(80,180,255,0)');
  ctx.fillStyle = g2; ctx.fillRect(0,H*0.55,W,H*0.45);
  ctx.restore();

  // laser borders (glowing red laser walls)
  const wallThickness = 14;
  function drawLaser(x,y,w,h,angle){
    ctx.save();
    ctx.translate(x,y);
    if(angle) ctx.rotate(angle);
    const lg = ctx.createLinearGradient(0,0,w,0);
    lg.addColorStop(0,'rgba(255,40,40,0.12)'); lg.addColorStop(0.5,'rgba(255,80,80,0.95)'); lg.addColorStop(1,'rgba(255,40,40,0.12)');
    ctx.fillStyle = lg; ctx.fillRect(0,-h/2,w,h);
    // outer glow
    ctx.shadowColor = 'rgba(255,60,60,0.9)'; ctx.shadowBlur = 20;
    ctx.fillRect(0,-h/2,w,h);
    ctx.shadowBlur = 0;
    ctx.restore();
  }
  // top
  drawLaser(W/2, 0, W, wallThickness, 0);
  // bottom
  drawLaser(W/2, H, W, wallThickness, 0);
  // left
  drawLaser(0, H/2, H, wallThickness, Math.PI/2);
  // right
  drawLaser(W, H/2, H, wallThickness, Math.PI/2);
}

function drawCar(){
  ctx.save();
  ctx.translate(car.x,car.y);
  ctx.rotate(car.angle);
  // shadow
  ctx.fillStyle='rgba(0,0,0,0.35)'; ctx.fillRect(-car.length/2+6, -car.width/2+8, car.length, car.width);
  // engine flame when boosting
  if(boostActive){
    const flameLen = 18 * boostMultiplier;
    const g = ctx.createLinearGradient(-car.length/2-2,0,-car.length/2-flameLen,0);
    g.addColorStop(0,'rgba(255,200,80,0.18)'); g.addColorStop(0.5,'rgba(255,160,40,0.6)'); g.addColorStop(1,'rgba(255,80,20,0.95)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(-car.length/2-6,0,flameLen/3,car.width,0,0,Math.PI*2); ctx.fill();
  }
  // body with subtle gradient
  const bodyGrad = ctx.createLinearGradient(-car.length/2, -car.width/2, car.length/2, car.width/2);
  bodyGrad.addColorStop(0,'#68f0ff'); bodyGrad.addColorStop(1,'#9ff1ff');
  ctx.fillStyle = bodyGrad; ctx.strokeStyle = '#042a3d'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(-car.length/2, -car.width/2); ctx.lineTo(car.length/2,0); ctx.lineTo(-car.length/2, car.width/2); ctx.closePath(); ctx.fill(); ctx.stroke();
  // cockpit
  ctx.fillStyle='rgba(10,30,60,0.6)'; ctx.beginPath(); ctx.ellipse(car.length*0.1,0,8,6,0,0,Math.PI*2); ctx.fill();
  ctx.restore();
}

function physics(dt){
  // controls
  // acceleration/brake: only change speed when user presses keys
  if(keys['ArrowUp']){ car.speed += 0.12 * dt; }
  else if(keys['ArrowDown']){ car.speed -= 0.08 * dt; }
  // friction — reduce speed toward zero but do not invert sign
  const friction = 0.02 * dt;
  if(car.speed > 0){ car.speed -= friction; if(car.speed < 0) car.speed = 0; }
  if(car.speed < 0){ car.speed = 0; }
  // steering: easier at low speed, harder at high speed
  const steer = (keys['ArrowLeft']? -0.035:0) + (keys['ArrowRight']? 0.035:0);
  const speedNorm = Math.min(1, Math.abs(car.speed)/6);
  const steerFactor = 1 + (1 - speedNorm); // 2 at slow, 1 at fast
  car.angle += steer * steerFactor;
  // gentle rightward glide bias (airplane tendency)
  const glideTarget = 0; // point to the right
  const glideStrength = 0.002 + 0.001 * Math.min(3, Math.abs(car.speed));
  car.angle += (glideTarget - car.angle) * glideStrength;
  // velocity (apply boost multiplier if active)
  const effSpeed = car.speed * (boostActive ? boostMultiplier : 1);
  car.vx = Math.cos(car.angle) * effSpeed;
  car.vy = Math.sin(car.angle) * effSpeed;
  car.x += car.vx * dt;
  car.y += car.vy * dt;
  // border lose: touching outside canvas kills you
  if(car.x < 0 || car.x > W || car.y < 0 || car.y > H){ gameOver = true; }
  // boost timer decay (seconds)
  if(boostActive){ boostTimer -= dt/60; if(boostTimer <= 0){ boostActive = false; boostMultiplier = 1; boostTimer = 0; } }
}

function reset(){ car.x=W/2; car.y=H*0.75; car.angle=-Math.PI/2; car.speed=0; particles=[]; gameOver=false; level=1; levelTimer=baseSurvive; resetEnemies(); coins=[]; coinsCount=0; lastCoinSpawn=0; boostActive=false; boostTimer=0; boostMultiplier=1; }
// don't auto-start; wait for user gesture
reset();

let last = performance.now();
function loop(now){
  const elapsed = (now - last)/1000; // seconds
  const dt = Math.min(1, (now-last)/16); last=now;
  // movement via WASD when started (static unless user moves)
  if(started && !gameOver){
    const mult = boostActive ? boostMultiplier : 1;
    const moveDist = moveSpeedBase * mult * elapsed;
    let moved = false;
    if(keys['w'] || keys['W']){ car.y -= moveDist; moved = true; }
    if(keys['s'] || keys['S']){ car.y += moveDist; moved = true; }
    if(keys['a'] || keys['A']){ car.x -= moveDist; moved = true; }
    if(keys['d'] || keys['D']){ car.x += moveDist; moved = true; }
    // set displayed speed for HUD (0 when not moving)
    car.speed = moved ? Math.round(moveSpeedBase * mult / 10) : 0;
  }
  updateParticles();

  // draw
  drawTrack();
  // spawn frost based on speed (higher speed -> more frost behind)
  const intensity = Math.min(1, Math.abs(car.speed)/8);
  const spawnX = car.x - Math.cos(car.angle)*20;
  const spawnY = car.y - Math.sin(car.angle)*20;
  if(Math.random() < 0.9) spawnFrost(spawnX, spawnY, intensity);

  drawParticles();
  drawCoins();
  // draw enemies
  enemies.forEach(en=>{
    // move towards car if game active
    if(!gameOver){
      const dx = car.x - en.x, dy = car.y - en.y;
      const dist = Math.sqrt(dx*dx + dy*dy) || 1;
      en.x += (dx/dist) * en.speed * elapsed;
      en.y += (dy/dist) * en.speed * elapsed;
    }
    ctx.save(); ctx.beginPath(); ctx.fillStyle='rgba(255,120,120,0.95)'; ctx.arc(en.x,en.y,en.r,0,Math.PI*2); ctx.fill(); ctx.restore();
  });
  // bullet <-> enemy collision: bullets reduce enemy.hits, enemy dies after hits<=0
  for(let i=enemies.length-1;i>=0;i--){
    const en = enemies[i];
    for(let j=bullets.length-1;j>=0;j--){
      const b = bullets[j];
      const dx = en.x - b.x, dy = en.y - b.y;
      if(Math.sqrt(dx*dx+dy*dy) < en.r + (b.r||3)){
        bullets.splice(j,1);
        en.hits -= 1;
        if(en.hits <= 0){
          enemies.splice(i,1);
        }
        break;
      }
    }
  }
  drawCar();

  // frost veil that builds up near center as speed increases
  ctx.save();
  ctx.globalCompositeOperation='overlay';
  const frostAlpha = 0.02 + intensity * 0.18;
  ctx.fillStyle = `rgba(200,245,255,${frostAlpha})`;
  ctx.fillRect(0,0,W,H);
  ctx.restore();

  // HUD
  ctx.save(); ctx.fillStyle='#c8fbff'; ctx.font='18px monospace'; ctx.fillText(`Speed: ${Math.round(car.speed*10)}`, 12, 26);
  ctx.fillText(`Level: ${level}`, 12, 50);
  ctx.fillText(`Survive: ${Math.max(0,Math.ceil(levelTimer))}s`, 12, 74);
  ctx.fillText(`Best: ${highscore}`, 12, 98);
  ctx.fillText(`Coins: ${coinsCount}`, 12, 122);
  if(boostActive) ctx.fillText(`Boost: ${Math.max(0,Math.ceil(boostTimer))}s`, 12, 146);
  ctx.restore();

  // update level timer
  if(!gameOver){
    levelTimer -= elapsed;
    if(levelTimer <= 0){
      // Level completed: increase level, reset timer to constant, spawn another enemy
      level += 1;
      levelTimer = baseSurvive; // constant 5s per level
      spawnEnemy();
      if(level > highscore){ highscore = level; localStorage.setItem(highKey, highscore); }
    }
  }

  // coin spawning (every ~6s) limited to 4 on screen
  if(started && !gameOver){
    lastCoinSpawn += elapsed;
    if(lastCoinSpawn > 6 && coins.length < 4){
      if(Math.random() < 0.6){ coins.push({x:40 + Math.random()*(W-80), y:40 + Math.random()*(H-80), r:8, seed: Math.random()*1000}); lastCoinSpawn = 0; }
    }
  }

  // check collisions: enemy with car -> lose
  enemies.forEach(en=>{
    const dx = car.x - en.x, dy = car.y - en.y;
    if(Math.sqrt(dx*dx+dy*dy) < en.r + 10){ explode(car.x,car.y); gameOver = true; }
  });

  // check coins collection
  for(let i=coins.length-1;i>=0;i--){
    const c = coins[i];
    const dx = car.x - c.x, dy = car.y - c.y;
    if(Math.sqrt(dx*dx+dy*dy) < c.r + 10){ coins.splice(i,1); coinsCount += 1; }
  }

// explosion helper
function explode(x,y){
  for(let i=0;i<60;i++){
    const a = Math.random()*Math.PI*2; const s = 2 + Math.random()*6;
    particles.push({x,y,vx:Math.cos(a)*s, vy:Math.sin(a)*s, life:20+Math.random()*40, alpha:0.9, r:2+Math.random()*3});
  }
}

  // when game over overlay
  if(gameOver){
    ctx.save(); ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#ffdddd'; ctx.font='28px monospace'; ctx.textAlign='center';
    ctx.fillText('Game Over — press R to restart', W/2, H/2);
    ctx.restore();
    // store highscore if player beat it by reaching higher level
    if(level > highscore){ highscore = level; localStorage.setItem(highKey, highscore); }
  }

  // draw start overlay if not started
  if(!started){
    ctx.save(); ctx.fillStyle='rgba(0,0,0,0.45)'; ctx.fillRect(0,0,W,H); ctx.fillStyle='#dff7ff'; ctx.font='28px monospace'; ctx.textAlign='center';
    ctx.fillText('Click or press any key to start (fullscreen)', W/2, H/2);
    ctx.restore();
  }

  requestAnimationFrame(loop);
}

// Start on first user gesture — request fullscreen and begin
function startGame(){
  if(started) return; started = true;
  const el = document.documentElement;
  if(el.requestFullscreen){ el.requestFullscreen().catch(()=>{}); }
  last = performance.now();
}

window.addEventListener('keydown', (e)=>{
  // start on any key
  if(!started) startGame();
  // R to reset still supported
  if(e.key==='r'){ reset(); }
  // spacebar to boost
  if(e.code === 'Space'){
    e.preventDefault();
    if(!boostActive && coinsCount >= 5 && !gameOver){
      const used = coinsCount; coinsCount = 0; coins = [];
      boostTimer = 2 * (used/5);
      if(boostTimer < 2) boostTimer = 2;
      boostMultiplier = 1 + (used/5);
      boostActive = true;
    }
  }
});
window.addEventListener('mousedown', ()=>{ if(!started) startGame(); });

requestAnimationFrame(loop);
