(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const elSpeed = document.getElementById('speed');
  const elDistance = document.getElementById('distance');
  const elHigh = document.getElementById('highscore');
  const elShards = document.getElementById('shards');
  const elFreeze = document.getElementById('freeze');
  const elDoom = document.getElementById('doom');
  const elUpgrade = document.getElementById('upgrade');
  const elBrake = document.getElementById('brake');

  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlayTitle');
  const overlayCopy = document.getElementById('overlayCopy');
  const overlayHint = document.getElementById('overlayHint');
  const btnStart = document.getElementById('btnStart');
  const btnHow = document.getElementById('btnHow');
  const lbStatus = document.getElementById('lbStatus');
  const lbList = document.getElementById('lbList');
  const lbSubmit = document.getElementById('lbSubmit');
  const lbName = document.getElementById('lbName');
  const lbBtn = document.getElementById('lbBtn');
  const lbHint = document.getElementById('lbHint');
  const restartBtn = document.getElementById('restart-btn');
  const pauseBtn = document.getElementById('pause-btn');
  const brakeBtn = document.getElementById('brake-btn');
  const brakeTouchBtn = document.getElementById('brake-touch');
  const joy = document.getElementById('joy');
  const joyKnob = document.getElementById('joyKnob');
  const revLBtn = document.getElementById('revL-btn');
  const revRBtn = document.getElementById('revR-btn');

  const keys = Object.create(null);
  const input = {
    turn: 0,      // -1..1 (left..right)
    throttle: 0,  // 0..1 (forward)
    revL: false,
    revR: false,
    joyActive: false,
  };

  const rnd = (min,max)=> min + Math.random()*(max-min);
  const clamp = (v,lo,hi)=> Math.max(lo, Math.min(hi, v));
  const lerp = (a,b,t)=> a + (b-a)*t;

  // Global feel tuning
  // - PACE slows motion + progression (not cooldowns) for a calmer game.
  // - BASE_GRIP makes the ship easier to control even before shards.
  const PACE = 0.5;
  const PACE_INV = 1 / PACE;
  const BASE_GRIP = 0.42;

  // Difficulty shaping (easier): fewer enemies and slower spawns.
  const ENEMY_CAP = 6;
  const ENEMY_SPAWN_SLOW = 2.0; // additional multiplier on spawn delay

  // Telemetry nodes (optional)
  const tel = {
    fps: document.getElementById('t-fps'),
    dt: document.getElementById('t-dt'),
    time: document.getElementById('t-time'),
    paused: document.getElementById('t-paused'),
    pos: document.getElementById('t-pos'),
    doom: document.getElementById('t-doom'),
    enemies: document.getElementById('t-enemies'),
    cap: document.getElementById('t-cap'),
    spawn: document.getElementById('t-spawn'),
    vx: document.getElementById('t-vx'),
    vy: document.getElementById('t-vy'),
    ang: document.getElementById('t-ang'),
    angVel: document.getElementById('t-angvel'),
    up: document.getElementById('t-up'),
    shots: document.getElementById('t-shots'),
    hits: document.getElementById('t-hits'),
    acc: document.getElementById('t-acc'),
    kills: document.getElementById('t-kills'),
    brake: document.getElementById('t-brake'),
    hand: document.getElementById('t-hand'),
    freeze: document.getElementById('t-freeze'),
  };

  const hiKey = 'td-best-distance';
  let best = parseFloat(localStorage.getItem(hiKey) || '0') || 0;

  // --- Sound (WebAudio) ---
  const sound = (() => {
    const mutedKey = 'td-muted';
    let muted = (localStorage.getItem(mutedKey) || '0') === '1';

    /** @type {AudioContext|null} */
    let ac = null;
    /** @type {GainNode|null} */
    let master = null;

    const last = {
      thrust: 0,
      revL: 0,
      revR: 0,
      spawn: 0,
      ice: 0,
      crash: 0,
    };

    const now = () => (ac ? ac.currentTime : 0);
    const rnd = (a, b) => a + Math.random() * (b - a);
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

    function ensure(){
      if (muted) return false;
      if (ac) return true;
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return false;
      ac = new Ctx();
      master = ac.createGain();
      master.gain.value = 0.55;
      master.connect(ac.destination);
      return true;
    }

    function setMuted(v){
      muted = !!v;
      localStorage.setItem(mutedKey, muted ? '1' : '0');
      if (muted && master) master.gain.value = 0;
      if (!muted && master) master.gain.value = 0.55;
    }

    function toggleMuted(){
      setMuted(!muted);
      if (!muted) ensure();
      // tiny feedback blip
      if (!muted) uiBlip();
    }

    function envGain(g, t0, a, d){
      g.gain.cancelScheduledValues(t0);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, a), t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(0.02, d));
    }

    function tone({ type='sine', f=440, f2=null, dur=0.12, gain=0.12, det=0, pan=0, glide=0 } = {}){
      if (!ensure() || !ac || !master) return;
      const t0 = now();
      const osc = ac.createOscillator();
      const g = ac.createGain();
      const p = ac.createStereoPanner ? ac.createStereoPanner() : null;
      osc.type = type;
      osc.detune.value = det;
      osc.frequency.setValueAtTime(f, t0);
      if (f2 !== null) {
        const tt = t0 + (glide > 0 ? glide : dur);
        osc.frequency.exponentialRampToValueAtTime(Math.max(40, f2), tt);
      }
      envGain(g, t0, gain, dur);
      if (p) {
        p.pan.setValueAtTime(pan, t0);
        osc.connect(g);
        g.connect(p);
        p.connect(master);
      } else {
        osc.connect(g);
        g.connect(master);
      }
      osc.start(t0);
      osc.stop(t0 + Math.max(0.03, dur + 0.02));
    }

    function noise({ dur=0.12, gain=0.08, pan=0, hp=400, lp=6000 } = {}){
      if (!ensure() || !ac || !master) return;
      const t0 = now();
      const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const src = ac.createBufferSource();
      src.buffer = buf;
      const g = ac.createGain();
      const hpF = ac.createBiquadFilter();
      const lpF = ac.createBiquadFilter();
      hpF.type = 'highpass';
      hpF.frequency.value = hp;
      lpF.type = 'lowpass';
      lpF.frequency.value = lp;
      const p = ac.createStereoPanner ? ac.createStereoPanner() : null;
      envGain(g, t0, gain, dur);
      src.connect(hpF);
      hpF.connect(lpF);
      lpF.connect(g);
      if (p) {
        p.pan.setValueAtTime(pan, t0);
        g.connect(p);
        p.connect(master);
      } else {
        g.connect(master);
      }
      src.start(t0);
      src.stop(t0 + Math.max(0.03, dur + 0.02));
    }

    // --- Event SFX (intentionally "made-up") ---
    function uiBlip(){
      tone({ type: pick(['triangle','sine']), f: rnd(420, 660), f2: rnd(180, 260), dur: rnd(0.06, 0.11), gain: 0.06 });
    }

    function startJingle(){
      const base = pick([196, 220, 247]);
      tone({ type:'triangle', f: base*2, f2: base*3.2, dur: 0.16, gain: 0.08 });
      setTimeout(()=> tone({ type:'sine', f: base*3.0, f2: base*2.0, dur: 0.10, gain: 0.06 }), 90);
      setTimeout(()=> noise({ dur: 0.09, gain: 0.04, hp: 1200, lp: 9000 }), 130);
    }

    function thrustHiss(intensity=1){
      if (!ensure()) return;
      const t = performance.now();
      if (t - last.thrust < 120) return;
      last.thrust = t;
      const g = 0.02 + 0.03 * Math.min(1, intensity);
      noise({ dur: rnd(0.06, 0.11), gain: g, hp: rnd(800, 1400), lp: rnd(5000, 9000), pan: rnd(-0.08, 0.08) });
      if (Math.random() < 0.22) {
        tone({ type:'sawtooth', f: rnd(120, 220), f2: rnd(50, 90), dur: rnd(0.06, 0.10), gain: 0.015 });
      }
    }

    function reverseKick(side){
      if (!ensure()) return;
      const t = performance.now();
      const key = side < 0 ? 'revL' : 'revR';
      if (t - last[key] < 90) return;
      last[key] = t;
      const pan = side < 0 ? -0.22 : 0.22;
      tone({ type: pick(['square','triangle']), f: rnd(140, 220), f2: rnd(70, 110), dur: rnd(0.07, 0.12), gain: 0.05, pan });
      noise({ dur: rnd(0.05, 0.09), gain: 0.035, hp: rnd(900, 1600), lp: rnd(4200, 7000), pan });
    }

    function icePickup(){
      if (!ensure()) return;
      const t = performance.now();
      if (t - last.ice < 120) return;
      last.ice = t;
      tone({ type:'sine', f: rnd(720, 980), f2: rnd(1200, 1600), dur: rnd(0.06, 0.10), gain: 0.055, det: rnd(-9, 9) });
      tone({ type:'triangle', f: rnd(320, 480), f2: rnd(820, 1100), dur: rnd(0.08, 0.12), gain: 0.03, det: rnd(-12, 12) });
    }

    function iceEat(){
      if (!ensure()) return;
      tone({ type:'sawtooth', f: rnd(520, 740), f2: rnd(160, 240), dur: 0.16, gain: 0.055 });
      noise({ dur: 0.14, gain: 0.06, hp: 500, lp: 4500 });
      setTimeout(()=> tone({ type:'sine', f: rnd(1400, 1900), f2: rnd(600, 820), dur: 0.11, gain: 0.04 }), 70);
    }

    function enemySpawn(){
      if (!ensure()) return;
      const t = performance.now();
      if (t - last.spawn < 350) return;
      last.spawn = t;
      tone({ type:'sine', f: rnd(90, 130), f2: rnd(220, 360), dur: 0.18, gain: 0.03, det: rnd(-20, 20) });
      if (Math.random() < 0.35) tone({ type:'triangle', f: rnd(420, 620), f2: rnd(240, 320), dur: 0.10, gain: 0.02, pan: rnd(-0.2, 0.2) });
    }

    function crash(){
      if (!ensure()) return;
      const t = performance.now();
      if (t - last.crash < 600) return;
      last.crash = t;
      noise({ dur: 0.25, gain: 0.12, hp: 80, lp: 2400 });
      tone({ type:'square', f: rnd(160, 260), f2: rnd(40, 70), dur: 0.22, gain: 0.07 });
      setTimeout(()=> tone({ type:'sine', f: rnd(980, 1400), f2: rnd(120, 180), dur: 0.16, gain: 0.03 }), 60);
    }

    return {
      ensure,
      toggleMuted,
      _isMuted: () => muted,
      startJingle,
      thrustHiss,
      reverseKick,
      icePickup,
      iceEat,
      enemySpawn,
      crash,
    };
  })();

  const apiBase = (()=>{
    // Priority:
    // 1) ?api=https://your-server.example.com
    // 2) localStorage td-api
    // 3) local dev default -> http://127.0.0.1:3000
    const params = new URLSearchParams(window.location.search);
    const fromQuery = (params.get('api') || '').trim();
    if (fromQuery) {
      localStorage.setItem('td-api', fromQuery);
      return fromQuery.replace(/\/$/, '');
    }
    const fromStorage = (localStorage.getItem('td-api') || '').trim();
    if (fromStorage) return fromStorage.replace(/\/$/, '');

    const host = window.location.hostname;
    const isLocal = host === 'localhost' || host === '127.0.0.1';
    return isLocal ? 'http://127.0.0.1:3000' : '';
  })();

  async function apiGetLeaderboard(){
    if(!apiBase) throw new Error('leaderboard unavailable');
    const url = `${apiBase}/api/leaderboard?game=thermal-drift&limit=10`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    const data = await res.json().catch(()=> ({}));
    if(!res.ok || data.ok === false) throw new Error(data.error || 'leaderboard error');
    return data;
  }

  async function apiSubmitLeaderboard(name, score){
    if(!apiBase) throw new Error('leaderboard unavailable');
    const res = await fetch(`${apiBase}/api/leaderboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ game: 'thermal-drift', name, score }),
    });
    const data = await res.json().catch(()=> ({}));
    if(!res.ok || data.ok === false) throw new Error(data.error || 'submit error');
    return data;
  }

  function renderLeaderboard(entries){
    if(!lbList) return;
    while(lbList.firstChild) lbList.removeChild(lbList.firstChild);
    const list = Array.isArray(entries) ? entries : [];
    if(list.length === 0){
      const li = document.createElement('li');
      li.textContent = 'No scores yet. Be the first.';
      lbList.appendChild(li);
      return;
    }
    for(const e of list){
      const li = document.createElement('li');
      const name = (e && e.name) ? String(e.name) : 'anon';
      const score = (e && Number.isFinite(Number(e.score))) ? Math.floor(Number(e.score)) : 0;
      li.innerHTML = `<span class="meta">#${e.rank || ''}</span> <strong>${escapeHtml(name)}</strong> — <span class="score">${score}m</span>`;
      lbList.appendChild(li);
    }
  }

  function escapeHtml(s){
    return String(s)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  async function refreshLeaderboardUI(finalScore){
    if(lbSubmit) lbSubmit.hidden = true;
    if(lbHint) lbHint.textContent = '';
    if(lbStatus) lbStatus.textContent = 'Loading…';

    try {
      const data = await apiGetLeaderboard();
      const entries = data.entries || [];
      renderLeaderboard(entries);

      const bestScore = Number.isFinite(Number(data.best)) ? Number(data.best) : 0;
      const isNewBest = finalScore > 0 && finalScore >= bestScore;
      if(lbStatus){
        lbStatus.textContent = isNewBest
          ? `New best detected: ${finalScore}m (current #1 was ${Math.floor(bestScore)}m).`
          : `Top score: ${Math.floor(bestScore)}m`;
      }
      if(lbSubmit) lbSubmit.hidden = !isNewBest;
      if(isNewBest && lbName){
        lbName.value = (localStorage.getItem('td-name') || '').slice(0,32);
        setTimeout(()=> lbName.focus?.(), 50);
      }
    } catch (e) {
      renderLeaderboard([]);
      if(lbStatus){
        lbStatus.textContent = apiBase
          ? `Leaderboard offline: ${String(e && e.message ? e.message : e)} (run the "Start Leaderboard API (Excel)" task).`
          : 'Leaderboard is disabled on this host.';
      }
    }
  }

  const state = {
    dpr: 1,
    w: 960,
    h: 540,
    worldW: 960 * 4,
    worldH: 540 * 4,
    started: false,
    paused: false,
    over: false,
    time: 0,
    distance: 0,
    doom: 0, // 0..1
    shardsHeld: 0,          // progress toward burst/upgrade (0..2, resets at 3)
    freezeTime: 0,          // visual frost veil + slow (if any)
    enemyFrozenTime: 0,     // hard-freeze (0 speed)
    freezeStrength: 0.35,
    handlingTime: 0,
    upgraded: false,
    coneUnlocked: false,
    nextShot: 0,
    brakeCooldown: 0,
    runTime: 0,
    shotsFired: 0,
    hits: 0,
    kills: 0,
    lastShardSpawn: 0,
    nextEnemyAt: 0,
    camShake: 0,
    player: {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      ang: -Math.PI/2,
      angVel: 0,
      r: 14,
      thrust: 0,
    },
    enemies: [],
    bullets: [],
    shards: [],
    particles: [],
    trails: [],

    // Background FX (Render-ish blocks)
    fxTick: 0,
    fxBlocks: [],
  };

  function makeFxBlocks(){
    const w = state.w, h = state.h;
    const blocks = [];
    const count = 9;
    for(let i=0;i<count;i++){
      const bw = rnd(w*0.08, w*0.28);
      const bh = rnd(10, 26);
      const x = rnd(-w*0.1, w*0.95);
      const y = rnd(0, h);
      const col = Math.random() < 0.6 ? 'rgba(140,60,255,' : 'rgba(104,240,255,';
      blocks.push({
        x, y, w: bw, h: bh,
        a: rnd(0.04, 0.12),
        col,
        stripe: Math.random() < 0.65,
      });
    }
    const pillars = 4;
    for(let i=0;i<pillars;i++){
      blocks.push({
        x: rnd(0, w),
        y: rnd(-h*0.2, h*0.1),
        w: rnd(8, 18),
        h: rnd(h*0.25, h*0.8),
        a: rnd(0.02, 0.06),
        col: 'rgba(255,255,255,',
        stripe: false,
      });
    }
    return blocks;
  }

  function resize(){
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    state.dpr = dpr;

    const rect = canvas.getBoundingClientRect();
    const w = Math.max(320, Math.floor(rect.width));
    const h = Math.max(240, Math.floor(rect.height));

    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    state.w = w;
    state.h = h;

    // World is 4× larger than the viewport; the camera follows the player.
    state.worldW = w * 4;
    state.worldH = h * 4;

    if(!state.started){
      state.player.x = state.worldW*0.5;
      state.player.y = state.worldH*0.5;
    } else {
      state.player.x = clamp(state.player.x, 40, state.worldW-40);
      state.player.y = clamp(state.player.y, 40, state.worldH-40);
    }
  }
  window.addEventListener('resize', resize);

  function resetRound(){
    state.started = false;
    state.paused = false;
    state.over = false;
    state.time = 0;
    state.distance = 0;
    state.doom = 0;
    state.shardsHeld = 0;
    state.freezeTime = 0;
    state.enemyFrozenTime = 0;
    state.handlingTime = 0;
    state.upgraded = false;
    state.coneUnlocked = false;
    state.nextShot = 0;
    state.brakeCooldown = 0;
    state.runTime = 0;
    state.shotsFired = 0;
    state.hits = 0;
    state.kills = 0;
    state.lastShardSpawn = 0;
    state.nextEnemyAt = 0;
    state.camShake = 0;
    state.enemies = [];
    state.bullets = [];
    state.shards = [];
    state.particles = [];
    state.trails = [];

    state.player.x = state.worldW*0.5;
    state.player.y = state.worldH*0.5;
    state.player.vx = 0;
    state.player.vy = 0;
    state.player.ang = -Math.PI/2;
    state.player.angVel = 0;
    state.player.thrust = 0;

    // Pre-seed a few shards to teach the mechanic.
    for(let i=0;i<3;i++) spawnShard(true);
    // Easier opening: fewer enemies.
    for(let i=0;i<1;i++) spawnEnemy(true);

    updateHud();
    showOverlay('Eat ice. Outrun intent.',
      'Kamikaze ships are vectoring in. They don\'t stop.\nCollect ice shards for better handling.\nCollect 3 shards to freeze enemies and upgrade your ship.\nSpace = brake (90% slow) with a 5s cooldown.',
      'Tip: drift tight; cash in 3 shards when boxed in.');

    // Show leaderboard immediately (not only after dying).
    refreshLeaderboardUI(0);
  }

  function showOverlay(title, copy, hint){
    overlayTitle.textContent = title;
    overlayCopy.textContent = copy;
    overlayHint.textContent = hint;
    overlay.hidden = false;
  }

  function hideOverlay(){
    overlay.hidden = true;
  }

  function startGame(){
    if(state.started) return;
    state.started = true;
    state.paused = false;
    state.over = false;
    hideOverlay();

    // Optional fullscreen (gesture chain) — ignore failures.
    const el = document.documentElement;
    el.requestFullscreen?.().catch(()=>{});

    sound.ensure();
    sound.startJingle();

    state.time = performance.now();
  }

  function togglePause(){
    if(!state.started || state.over) return;
    state.paused = !state.paused;
    pauseBtn.textContent = state.paused ? 'Resume' : 'Pause';
    if(state.paused){
      showOverlay('Paused', 'Breathe. Recenter. The doom waits for nobody.', 'Press Esc to resume.');
    } else {
      hideOverlay();
    }
  }

  function endGame(){
    if(state.over) return;
    state.over = true;
    state.paused = false;

    if(state.distance > best){
      best = state.distance;
      localStorage.setItem(hiKey, String(best.toFixed(0)));
    }

    try {
      if(window.parent && window.parent !== window){
        window.parent.postMessage({ type:'lab:result', game:'thermal-drift', result:'lose' }, '*');
      }
    } catch(e) {}

    showOverlay('Integrity compromised.',
      `You drifted ${Math.floor(state.distance)}m before impact.`,
      'Press R to restart.');

    refreshLeaderboardUI(Math.floor(state.distance));

    sound.crash();
  }

  function spawnEnemy(initial=false){
    const vw = state.w, vh = state.h;
    const camX = state.player.x - vw*0.5;
    const camY = state.player.y - vh*0.5;
    const side = Math.floor(rnd(0,4));
    let x = state.player.x, y = state.player.y;
    const pad = 60;
    if(side===0){ x = camX - pad; y = camY + rnd(40, vh-40); }
    if(side===1){ x = camX + vw + pad; y = camY + rnd(40, vh-40); }
    if(side===2){ x = camX + rnd(40, vw-40); y = camY - pad; }
    if(side===3){ x = camX + rnd(40, vw-40); y = camY + vh + pad; }

    x = clamp(x, 40, state.worldW-40);
    y = clamp(y, 40, state.worldH-40);

    const base = (initial ? 110 : 140) * PACE;
    const doomBoost = (220 * state.doom) * PACE;
    const speed = base + doomBoost + rnd(-18, 36);
    const size = initial ? rnd(12, 15) : rnd(12, 18);

    state.enemies.push({
      x, y,
      vx: 0,
      vy: 0,
      r: size,
      sp: speed,
      ang: Math.atan2(state.player.y-y, state.player.x-x),
      seed: Math.random()*1000,
      hp: 10,
      debilTime: 0,
      hitFreezeTime: 0,
    });

    if (!initial) sound.enemySpawn();
  }

  function spawnShard(initial=false){
    const r = initial ? 10 : 9;
    const w = state.worldW, h = state.worldH;
    const p = state.player;
    const ang = rnd(0, Math.PI*2);
    const dist = initial ? rnd(120, 380) : rnd(220, 820);
    const x = clamp(p.x + Math.cos(ang)*dist, 50, w-50);
    const y = clamp(p.y + Math.sin(ang)*dist, 70, h-60);
    state.shards.push({
      x,
      y,
      r,
      pulse: rnd(0, Math.PI*2),
      seed: Math.random()*1000,
    });
  }

  function burst(x,y,color,count=22, power=1){
    for(let i=0;i<count;i++){
      const a = rnd(0, Math.PI*2);
      const s = rnd(70, 260) * power;
      state.particles.push({ x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s, life: 0, max: rnd(0.25, 0.8), color });
    }
  }

  function brakeBurst(){
    if(!state.started || state.over) return;
    if(state.brakeCooldown > 0) return;
    const p = state.player;
    // Instant 90% speed reduction.
    p.vx *= 0.1;
    p.vy *= 0.1;
    p.angVel *= 0.45;
    state.brakeCooldown = 5.0;
    state.camShake = Math.max(state.camShake, 2.5);
    burst(p.x, p.y, 'rgba(255,80,140,0.95)', 10, 0.55);
    burst(p.x, p.y, 'rgba(104,240,255,0.95)', 10, 0.55);
  }

  function triggerShardBurstUpgrade(){
    // Freeze enemies for a while + upgrade ship.
    const burstTime = 4.8;
    state.enemyFrozenTime = Math.max(state.enemyFrozenTime, burstTime);
    state.freezeTime = Math.max(state.freezeTime, burstTime);
    state.camShake = Math.max(state.camShake, 7);
    burst(state.player.x, state.player.y, 'rgba(104,240,255,0.95)', 42, 1.2);
    burst(state.player.x, state.player.y, 'rgba(140,60,255,0.95)', 34, 1.0);
    if(!state.upgraded){
      state.upgraded = true;
      state.nextShot = 0;
      // Reuse the bigger "ice eat" sound as a vibe hit.
      sound.iceEat();
      setTimeout(()=> sound.startJingle(), 90);
    } else {
      sound.iceEat();
    }
  }

  function unlockConeShot(){
    if(state.coneUnlocked) return;
    state.coneUnlocked = true;
    state.nextShot = 0;
    state.camShake = Math.max(state.camShake, 6);
    burst(state.player.x, state.player.y, 'rgba(154,230,255,0.95)', 38, 1.05);
    burst(state.player.x, state.player.y, 'rgba(255,80,140,0.95)', 22, 0.85);
    // Quick celebratory sound without adding new assets.
    sound.startJingle();
  }

  function updateHud(){
    const speed = Math.hypot(state.player.vx, state.player.vy);
    elSpeed.textContent = `Speed: ${Math.floor(speed)}`;
    elDistance.textContent = `Distance: ${Math.floor(state.distance)} m`;
    elHigh.textContent = `Best: ${Math.floor(best)} m`;
    let iceLabel = 'Ice: —';
    if(!state.upgraded) iceLabel = `Ice: ${state.shardsHeld}/3`;
    else if(!state.coneUnlocked) iceLabel = `Ice: ${state.shardsHeld}/3`;
    elShards.textContent = iceLabel;
    const ft = Math.max(0, Math.max(state.freezeTime, state.enemyFrozenTime));
    elFreeze.textContent = `Freeze: ${ft.toFixed(1)}s`;
    elDoom.textContent = `Doom: ${Math.floor(state.doom*100)}%`;
    if(elUpgrade) elUpgrade.textContent = state.coneUnlocked ? 'Upgrade: CONE' : (state.upgraded ? 'Upgrade: ONLINE' : 'Upgrade: —');
    if(elBrake) elBrake.textContent = state.brakeCooldown > 0 ? `Brake: ${state.brakeCooldown.toFixed(1)}s` : 'Brake: ready';

    const brakeDisabled = state.brakeCooldown > 0;
    if(brakeBtn) brakeBtn.disabled = brakeDisabled;
    if(brakeTouchBtn) brakeTouchBtn.disabled = brakeDisabled;
  }

  function update(dt){
    if(!state.started || state.over || state.paused) return;
  state.runTime += dt;

    state.time += dt;

    // Doom ramps up over time: slower global tempo.
    state.doom = clamp(state.doom + dt*0.012*PACE, 0, 1);

    // Freeze decay.
    if(state.freezeTime > 0) state.freezeTime = Math.max(0, state.freezeTime - dt);
    if(state.enemyFrozenTime > 0) state.enemyFrozenTime = Math.max(0, state.enemyFrozenTime - dt);
    if(state.handlingTime > 0) state.handlingTime = Math.max(0, state.handlingTime - dt);
    if(state.brakeCooldown > 0) state.brakeCooldown = Math.max(0, state.brakeCooldown - dt);

    const hardFrozen = state.enemyFrozenTime > 0;
    const freezeActive = (state.freezeTime > 0) || hardFrozen;
    const freezeFactor = hardFrozen ? 0 : (state.freezeTime > 0 ? state.freezeStrength : 1);
    const freezeGlow = freezeActive ? (0.35 + 0.65*Math.min(1, state.freezeTime/3)) : 0;

    // Controls:
    // - Joystick provides analog turn (-1..1) + throttle (0..1).
    // - Keyboard still works as a fallback.
    const kbLeft = keys.ArrowLeft || keys.a || keys.A;
    const kbRight = keys.ArrowRight || keys.d || keys.D;
    const kbUp = keys.ArrowUp || keys.w || keys.W;

    const p = state.player;
    const turn = input.joyActive ? input.turn : ((kbLeft ? -1 : 0) + (kbRight ? 1 : 0));
    const throttle = input.joyActive ? input.throttle : (kbUp ? 1 : 0);

    const shardHandling = state.handlingTime > 0 ? (0.55 + 0.45*Math.min(1, state.handlingTime/3)) : 0;
    const handling = clamp(BASE_GRIP + shardHandling*0.9, 0, 1);
    const turnRate = (3.4 + 0.6*state.doom);
    const targetTurn = clamp(turn, -1, 1) * turnRate * (1 + 0.70*handling);
    p.angVel = lerp(p.angVel, targetTurn, 0.18 + 0.12*handling);
    p.ang += p.angVel * dt;

    p.thrust = lerp(p.thrust, clamp(throttle, 0, 1), throttle > 0 ? 0.18 : 0.10);

    // Thrust accelerates; drift + mild friction.
    const acc = 580 * PACE;
    const maxSp = 460 * PACE;
    const ax = Math.cos(p.ang) * acc * p.thrust;
    const ay = Math.sin(p.ang) * acc * p.thrust;
    p.vx += ax * dt;
    p.vy += ay * dt;

    // Reverse thrusters (differential braking): two rear thrusters, left/right.
    // Pressing one gives reverse force + yaw torque.
    const revL = input.revL || keys.q || keys.Q;
    const revR = input.revR || keys.e || keys.E;
    if(revL || revR){
      const fx = Math.cos(p.ang);
      const fy = Math.sin(p.ang);
      const rx = Math.cos(p.ang + Math.PI/2);
      const ry = Math.sin(p.ang + Math.PI/2);

      const rear = 18;
      const side = 10;
      const backAcc = 520 * PACE;
      const torqueGain = 0.00006;

      const applyThruster = (sideSign)=>{
        const Fx = -fx * backAcc;
        const Fy = -fy * backAcc;
        p.vx += Fx * dt;
        p.vy += Fy * dt;

        // Thruster position relative to center of mass.
        const rpx = -fx*rear + rx*(side*sideSign);
        const rpy = -fy*rear + ry*(side*sideSign);
        const torque = (rpx*Fy - rpy*Fx);
        p.angVel += torque * torqueGain * dt * 60;

        // FX: small frost burst at the thruster outlet.
        if(Math.random() < 0.55){
          const ox = p.x + rpx;
          const oy = p.y + rpy;
          burst(ox, oy, 'rgba(180,255,255,0.95)', 5, 0.55);
        }
      };
      if(revL) {
        applyThruster(-1);
        sound.reverseKick(-1);
      }
      if(revR) {
        applyThruster(1);
        sound.reverseKick(1);
      }
    }

    // Friction: more forgiving baseline grip.
    const fr = (throttle > 0.05)
      ? (0.983 - 0.006*handling)
      : (0.968 - 0.010*handling);
    p.vx *= Math.pow(fr, dt*60);
    p.vy *= Math.pow(fr, dt*60);

    // Reduce sideways slip when handling is boosted.
    if(handling > 0){
      const fx = Math.cos(p.ang);
      const fy = Math.sin(p.ang);
      const sx = -fy;
      const sy = fx;
      const vSide = p.vx*sx + p.vy*sy;
      const damp = Math.pow(0.74, dt*60) * (0.92 - 0.24*handling);
      const newVSide = vSide * damp;
      const dSide = newVSide - vSide;
      p.vx += sx * dSide;
      p.vy += sy * dSide;
    }

    // Cap speed.
    const sp = Math.hypot(p.vx, p.vy);
    if(sp > maxSp){
      const s = maxSp / sp;
      p.vx *= s;
      p.vy *= s;
    }

    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // Keep inside world; edge scrape = death (doom wall).
    if(p.x < 10 || p.x > state.worldW - 10 || p.y < 10 || p.y > state.worldH - 10){
      state.camShake = Math.max(state.camShake, 10);
      burst(p.x, p.y, 'rgba(255,80,140,0.95)', 60, 1.2);
      endGame();
      return;
    }

    // Distance is pure velocity integration (feels like drifting longer = more score).
    state.distance += (Math.hypot(p.vx, p.vy) * dt) * 0.12;

    // Shards spawn.
    state.lastShardSpawn += dt;
    const shardInterval = lerp(3.6, 2.4, state.doom) * PACE_INV;
    if(state.lastShardSpawn >= shardInterval && state.shards.length < 6){
      state.lastShardSpawn = 0;
      spawnShard(false);
    }

    // Enemy spawning rate increases with doom.
    state.nextEnemyAt -= dt;
    if(state.nextEnemyAt <= 0){
      if(state.enemies.length < ENEMY_CAP) spawnEnemy(false);
      const base = 1.55;
      const min = 0.45;
      state.nextEnemyAt = Math.max(min, base - state.doom*1.1) * PACE_INV * ENEMY_SPAWN_SLOW;
    }

    // Trails (ship thruster + drift).
    if(Math.random() < (0.55 + 0.35*p.thrust)){
      const bx = p.x - Math.cos(p.ang)*22;
      const by = p.y - Math.sin(p.ang)*22;
      const sideJ = (Math.random()-0.5)*10;
      const ox = -Math.sin(p.ang) * sideJ;
      const oy = Math.cos(p.ang) * sideJ;
      state.trails.push({
        x: bx + ox,
        y: by + oy,
        vx: -p.vx*0.15 + (Math.random()-0.5)*50,
        vy: -p.vy*0.15 + (Math.random()-0.5)*50,
        life: 0,
        max: rnd(0.22, 0.55),
        a: (0.12 + 0.32*p.thrust) * (freezeActive ? 1.25 : 1.0),
        cold: freezeGlow,
      });
    }

    if (p.thrust > 0.25) sound.thrustHiss(p.thrust);

    // Auto-shoot (upgrade): permanent forward fire.
    if(state.upgraded){
      state.nextShot -= dt;
      const fireRate = 9.0; // shots/sec
      if(state.nextShot <= 0){
        state.nextShot = 1 / fireRate;
        const fx = Math.cos(p.ang);
        const fy = Math.sin(p.ang);
        const nose = 28;
        const speed = 920 * PACE;

        const spawnBullet = (angOffset)=>{
          const a = p.ang + angOffset;
          const bx = Math.cos(a);
          const by = Math.sin(a);
          state.bullets.push({
            x: p.x + bx*nose,
            y: p.y + by*nose,
            vx: bx*speed + p.vx*0.35,
            vy: by*speed + p.vy*0.35,
            life: 0,
            max: 0.85,
          });
          state.shotsFired += 1;
        };

        if(state.coneUnlocked){
          // Cone shot: a small spread fan.
          const spread = 0.22; // radians (~12.6deg)
          spawnBullet(-spread);
          spawnBullet(-spread*0.5);
          spawnBullet(0);
          spawnBullet(spread*0.5);
          spawnBullet(spread);
        } else {
          spawnBullet(0);
        }
      }
    }

    // Move enemies toward player (kamikaze ships).
    for(const e of state.enemies){
      if(e.hitFreezeTime > 0) e.hitFreezeTime = Math.max(0, e.hitFreezeTime - dt);
      const hitFrozen = e.hitFreezeTime > 0;
      if(hardFrozen || hitFrozen){
        e.vx = 0;
        e.vy = 0;
        // No wobble, no aim update, no angle changes while frozen.
        continue;
      }

      const wob = Math.sin((state.time*3.1 + e.seed) * 0.9) * (14 + 14*state.doom);
      const tx = p.x + Math.cos(state.time*1.3 + e.seed) * 10;
      const ty = p.y + Math.sin(state.time*1.1 + e.seed) * 10;
      const dx = (tx - e.x);
      const dy = (ty - e.y);
      const d = Math.max(1, Math.hypot(dx, dy));
      const dirX = dx/d;
      const dirY = dy/d;
      if(e.debilTime > 0) e.debilTime = Math.max(0, e.debilTime - dt);
      const debil = e.debilTime > 0 ? 0.55 : 1;
      const spd = e.sp * freezeFactor * debil;
      e.vx = lerp(e.vx, dirX*spd, 0.08);
      e.vy = lerp(e.vy, dirY*spd, 0.08);
      e.x += (e.vx + (-dirY*wob)*0.0025) * dt;
      e.y += (e.vy + (dirX*wob)*0.0025) * dt;
      e.ang = Math.atan2(e.vy, e.vx);
    }

    // Cull enemies far off-screen (relative to camera).
    {
      const camX = p.x - state.w*0.5;
      const camY = p.y - state.h*0.5;
      state.enemies = state.enemies.filter(e => e.x > camX-260 && e.x < camX+state.w+260 && e.y > camY-260 && e.y < camY+state.h+260);
    }

    // Particles update.
    for(let i=state.particles.length-1;i>=0;i--){
      const pr = state.particles[i];
      pr.life += dt;
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.vx *= Math.pow(0.96, dt*60);
      pr.vy *= Math.pow(0.96, dt*60);
      if(pr.life >= pr.max) state.particles.splice(i,1);
    }
    for(let i=state.trails.length-1;i>=0;i--){
      const t = state.trails[i];
      t.life += dt;
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.vx *= Math.pow(0.92, dt*60);
      t.vy *= Math.pow(0.92, dt*60);
      if(t.life >= t.max) state.trails.splice(i,1);
    }

    // Bullets update + hit enemies.
    for(let i=state.bullets.length-1;i>=0;i--){
      const b = state.bullets[i];
      b.life += dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if(b.life >= b.max || b.x < -80 || b.x > state.worldW+80 || b.y < -80 || b.y > state.worldH+80){
        state.bullets.splice(i,1);
        continue;
      }

      // Hit check
      for(let j=state.enemies.length-1;j>=0;j--){
        const e = state.enemies[j];
        if(Math.hypot(b.x - e.x, b.y - e.y) < e.r + 6){
          state.bullets.splice(i,1);
          e.hp = (e.hp ?? 10) - 1;
          e.debilTime = Math.max(e.debilTime || 0, 1.35);
          e.hitFreezeTime = Math.max(e.hitFreezeTime || 0, 0.85);
          burst(b.x, b.y, 'rgba(154,230,255,0.95)', 10, 0.65);
          state.hits += 1;
          if(e.hp <= 0){
            burst(e.x, e.y, 'rgba(255,80,140,0.95)', 26, 0.95);
            burst(e.x, e.y, 'rgba(104,240,255,0.95)', 22, 0.95);
            state.enemies.splice(j,1);
            // small reward without changing the core scoring loop
            state.distance += 6;
            state.kills += 1;
          }
          break;
        }
      }
    }

    // Shards float + collect.
    for(let i=state.shards.length-1;i>=0;i--){
      const s = state.shards[i];
      s.pulse += dt*4;
      s.y += Math.sin((performance.now()+s.seed)/520) * 0.03;
      const dd = Math.hypot(p.x - s.x, p.y - s.y);
      if(dd < p.r + s.r + 6){
        state.shards.splice(i,1);
        if(!state.coneUnlocked){
          state.shardsHeld = Math.min(3, state.shardsHeld + 1);
        }
        state.handlingTime = Math.max(state.handlingTime, 3.2);
        burst(s.x, s.y, 'rgba(138,255,168,0.95)', 18, 0.95);
        burst(s.x, s.y, 'rgba(104,240,255,0.95)', 20, 0.95);
        sound.icePickup();

        if(state.shardsHeld >= 3){
          state.shardsHeld = 0;
          if(!state.upgraded) triggerShardBurstUpgrade();
          else if(!state.coneUnlocked) unlockConeShot();
        }
      }
    }

    // Collision: enemy hits player -> game over.
    for(const e of state.enemies){
      if(Math.hypot(p.x - e.x, p.y - e.y) < p.r + e.r + 6){
        state.camShake = Math.max(state.camShake, 14);
        burst(p.x, p.y, 'rgba(255,80,140,0.95)', 70, 1.25);
        burst(p.x, p.y, 'rgba(104,240,255,0.95)', 40, 1.05);
        endGame();
        return;
      }
    }

    // Shake decay.
    state.camShake = Math.max(0, state.camShake - dt*18);

    updateHud();
  }

  function updateTelemetry(dt){
    if(!tel.fps) return;
    const fps = dt > 0 ? (1 / dt) : 0;
    const p = state.player;
    tel.fps.textContent = fps ? fps.toFixed(0) : '—';
    if(tel.dt) tel.dt.textContent = `${(dt*1000).toFixed(1)}ms`;
    if(tel.time) tel.time.textContent = `${state.runTime.toFixed(1)}s`;
    if(tel.paused) tel.paused.textContent = state.paused ? 'yes' : 'no';
    if(tel.pos) tel.pos.textContent = `${Math.floor(p.x)},${Math.floor(p.y)}`;
    if(tel.doom) tel.doom.textContent = `${Math.floor(state.doom*100)}%`;
    if(tel.enemies) tel.enemies.textContent = String(state.enemies.length);
    if(tel.cap) tel.cap.textContent = String(ENEMY_CAP);
    if(tel.spawn) tel.spawn.textContent = `${Math.max(0, state.nextEnemyAt).toFixed(2)}s`;
    if(tel.vx) tel.vx.textContent = p.vx.toFixed(1);
    if(tel.vy) tel.vy.textContent = p.vy.toFixed(1);
    if(tel.ang) tel.ang.textContent = `${(p.ang * 180 / Math.PI).toFixed(0)}°`;
    if(tel.angVel) tel.angVel.textContent = p.angVel.toFixed(2);
    if(tel.up) tel.up.textContent = state.coneUnlocked ? 'CONE' : (state.upgraded ? 'ON' : 'OFF');
    if(tel.shots) tel.shots.textContent = String(state.shotsFired);
    if(tel.hits) tel.hits.textContent = String(state.hits);
    if(tel.kills) tel.kills.textContent = String(state.kills);
    if(tel.acc) {
      const acc = state.shotsFired > 0 ? (state.hits / state.shotsFired) : 0;
      tel.acc.textContent = state.shotsFired > 0 ? `${Math.floor(acc*100)}%` : '—';
    }
    if(tel.brake) tel.brake.textContent = state.brakeCooldown > 0 ? `${state.brakeCooldown.toFixed(1)}s` : 'ready';
    if(tel.hand) tel.hand.textContent = state.handlingTime > 0 ? `${state.handlingTime.toFixed(1)}s` : '0.0s';
    if(tel.freeze) {
      const ft = Math.max(state.freezeTime, state.enemyFrozenTime);
      tel.freeze.textContent = ft > 0 ? `${ft.toFixed(1)}s` : '0.0s';
    }
  }

  function drawBackground(){
    const w = state.w, h = state.h;
    const g = ctx.createRadialGradient(w*0.5, h*0.6, 20, w*0.5, h*0.6, Math.max(w,h)*0.9);
    g.addColorStop(0, 'rgba(120, 203, 255, 0.00)');
    g.addColorStop(0.45, 'rgba(48, 135, 220, 0.20)');
    g.addColorStop(1, 'rgba(10, 14, 24, 0.88)');
    ctx.fillStyle = g;
    ctx.fillRect(0,0,w,h);

    // Subtle grid / scanlines (scrolls with world camera).
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.strokeStyle = 'rgba(127,216,255,0.9)';
    ctx.lineWidth = 1;
    const step = 46;
    const camX = state.player.x - w*0.5;
    const camY = state.player.y - h*0.5;
    const ox = ((-camX) % step + step) % step;
    const oy = ((-camY) % step + step) % step;
    for(let x=ox;x<w;x+=step){
      ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke();
    }
    for(let y=oy;y<h;y+=step){
      ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke();
    }
    ctx.restore();

    // Render-inspired block glitches (very subtle).
    const tick = Math.floor(performance.now() / 600);
    if(tick !== state.fxTick || state.fxBlocks.length === 0){
      state.fxTick = tick;
      state.fxBlocks = makeFxBlocks();
    }

    const doom = state.doom;
    const freezeBoost = state.freezeTime > 0 ? 0.25 : 0;
    const intensity = Math.min(1, 0.25 + doom*0.8 + freezeBoost);

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for(const b of state.fxBlocks){
      const a = b.a * intensity;
      ctx.fillStyle = `${b.col}${a})`;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      if(b.stripe){
        ctx.fillStyle = `rgba(255,255,255,${a*0.55})`;
        ctx.fillRect(b.x + b.w*0.62, b.y, b.w*0.07, b.h);
        ctx.fillRect(b.x + b.w*0.78, b.y, b.w*0.04, b.h);
      }
    }
    ctx.restore();

    // Doom vignette grows.
    if(doom > 0){
      ctx.save();
      const vg = ctx.createRadialGradient(w*0.5, h*0.55, Math.min(w,h)*0.12, w*0.5, h*0.55, Math.max(w,h)*0.65);
      vg.addColorStop(0, `rgba(0,0,0,${0.0 + doom*0.05})`);
      vg.addColorStop(1, `rgba(0,0,0,${0.10 + doom*0.34})`);
      ctx.fillStyle = vg;
      ctx.fillRect(0,0,w,h);
      ctx.restore();
    }
  }

  function drawShard(s){
    const camX = state.player.x - state.w*0.5;
    const camY = state.player.y - state.h*0.5;
    const sx = s.x - camX;
    const sy = s.y - camY;
    if(sx < -80 || sx > state.w+80 || sy < -80 || sy > state.h+80) return;
    const pulse = 0.7 + 0.3*Math.sin(s.pulse);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const r = s.r;
    // Glow
    ctx.fillStyle = `rgba(104,240,255,${0.18 + 0.25*pulse})`;
    ctx.beginPath(); ctx.arc(sx, sy, r+10*pulse, 0, Math.PI*2); ctx.fill();
    // Crystal
    ctx.translate(sx, sy);
    ctx.rotate((performance.now()+s.seed)*0.001);
    const grad = ctx.createLinearGradient(-r, -r, r, r);
    grad.addColorStop(0, 'rgba(180,255,255,0.95)');
    grad.addColorStop(1, 'rgba(104,240,255,0.75)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, -r*1.6);
    ctx.lineTo(r*0.9, 0);
    ctx.lineTo(0, r*1.6);
    ctx.lineTo(-r*0.9, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawEnemyShip(e){
    const camX = state.player.x - state.w*0.5;
    const camY = state.player.y - state.h*0.5;
    const sx = e.x - camX;
    const sy = e.y - camY;
    if(sx < -160 || sx > state.w+160 || sy < -160 || sy > state.h+160) return;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(e.ang);
    ctx.globalCompositeOperation = 'lighter';

    const r = e.r;
    // Threat glow
    const frozen = (state.enemyFrozenTime > 0) || (e.hitFreezeTime > 0);
    ctx.fillStyle = frozen ? 'rgba(104,240,255,0.18)' : 'rgba(255,80,140,0.16)';
    ctx.beginPath(); ctx.arc(0,0,r+12,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = frozen ? 'rgba(154,230,255,0.72)' : 'rgba(255,93,122,0.72)';
    ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.fill();

    // Ship silhouette
    const body = ctx.createLinearGradient(-r*1.2, -r, r*1.4, r);
    body.addColorStop(0, frozen ? 'rgba(200,245,255,0.95)' : 'rgba(255,120,160,0.95)');
    body.addColorStop(1, frozen ? 'rgba(104,240,255,0.70)' : 'rgba(255,60,110,0.70)');
    ctx.fillStyle = body;
    ctx.strokeStyle = 'rgba(20,10,18,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(r*1.55, 0);
    ctx.lineTo(-r*1.2, -r*0.85);
    ctx.lineTo(-r*0.85, 0);
    ctx.lineTo(-r*1.2, r*0.85);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Nose spark
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.arc(r*1.15, 0, 2.5, 0, Math.PI*2); ctx.fill();

    // HP ring (10 HP)
    const hp = clamp((e.hp ?? 10) / 10, 0, 1);
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.arc(0, 0, r+9, 0, Math.PI*2); ctx.stroke();
    ctx.strokeStyle = `rgba(104,240,255,${0.55 + 0.25*hp})`;
    ctx.beginPath(); ctx.arc(0, 0, r+9, -Math.PI/2, -Math.PI/2 + hp*Math.PI*2); ctx.stroke();
    ctx.restore();

    // Ice-lock overlay
    if(frozen){
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const a = 0.12 + 0.18*Math.min(1, (e.hitFreezeTime || state.enemyFrozenTime) / 1.2);
      ctx.fillStyle = `rgba(200,245,255,${a})`;
      ctx.beginPath();
      ctx.arc(0,0,r+8,0,Math.PI*2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  function drawPlayer(){
    const p = state.player;
    const w = state.w, h = state.h;

    // Camera shake.
    const shake = state.camShake;
    const sx = shake ? (Math.random()-0.5)*shake : 0;
    const sy = shake ? (Math.random()-0.5)*shake : 0;

    ctx.save();
    ctx.translate(sx, sy);

    const camX = p.x - w*0.5;
    const camY = p.y - h*0.5;

    // Trails
    for(const t of state.trails){
      const k = 1 - (t.life / t.max);
      const a = t.a * k;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const col = t.cold ? `rgba(104,240,255,${a})` : `rgba(154,230,255,${a})`;
      ctx.fillStyle = col;
      const tx = t.x - camX;
      const ty = t.y - camY;
      if(tx > -80 && tx < w+80 && ty > -80 && ty < h+80){
        ctx.beginPath();
        ctx.arc(tx, ty, 3 + 10*(1-k), 0, Math.PI*2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Player ship
    ctx.save();
    // Player stays centered; world scrolls.
    ctx.translate(w*0.5, h*0.5);

    // Tilt based on angular velocity (Gen-Z "drift attitude")
    const tilt = clamp(p.angVel * 0.22, -0.45, 0.45);
    ctx.rotate(p.ang + tilt);
    ctx.globalCompositeOperation = 'lighter';

    // Glow shell
    const glow = ctx.createRadialGradient(0,0,6,0,0,48);
    glow.addColorStop(0, 'rgba(127,216,255,0.22)');
    glow.addColorStop(1, 'rgba(127,216,255,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(0,0,48,0,Math.PI*2); ctx.fill();

    // Hull gradient
    const hull = ctx.createLinearGradient(-22, -12, 26, 12);
    hull.addColorStop(0, 'rgba(104,240,255,0.95)');
    hull.addColorStop(1, 'rgba(127,216,255,0.72)');
    ctx.fillStyle = hull;
    ctx.strokeStyle = 'rgba(2,18,34,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(26, 0);
    ctx.lineTo(-18, -12);
    ctx.lineTo(-10, 0);
    ctx.lineTo(-18, 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Cockpit
    ctx.fillStyle = 'rgba(10,30,60,0.72)';
    ctx.beginPath(); ctx.ellipse(6, 0, 7.5, 5.2, 0, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.arc(4, -2.4, 1.8, 0, Math.PI*2); ctx.fill();

    // Thruster flame
    if(p.thrust > 0.05){
      const flameLen = 18 + 26*p.thrust;
      const g = ctx.createLinearGradient(-18,0,-18-flameLen,0);
      g.addColorStop(0,'rgba(255,200,80,0.18)');
      g.addColorStop(0.55,'rgba(255,140,80,0.70)');
      g.addColorStop(1,'rgba(255,80,140,0.95)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(-20-flameLen*0.55, 0, flameLen*0.55, 8 + 10*p.thrust, 0, 0, Math.PI*2);
      ctx.fill();
    }

    ctx.restore();

    // Particles
    for(const pr of state.particles){
      const t = 1 - (pr.life / pr.max);
      const alpha = 0.95 * t;
      ctx.fillStyle = pr.color.replace('0.95', String(alpha));
      const px = pr.x - camX;
      const py = pr.y - camY;
      if(px > -120 && px < w+120 && py > -120 && py < h+120){
        ctx.beginPath();
        ctx.arc(px, py, 2.2 + 3.4*(1-t), 0, Math.PI*2);
        ctx.fill();
      }
    }

    // Foreground frost veil when freeze active
    if(state.freezeTime > 0){
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const a = Math.min(0.22, 0.08 + state.freezeTime*0.02);
      ctx.fillStyle = `rgba(200,245,255,${a})`;
      ctx.fillRect(0,0,w,h);
      ctx.restore();
    }

    ctx.restore();
  }

  function draw(){
    ctx.clearRect(0,0,state.w,state.h);
    drawBackground();

    // Shards
    for(const s of state.shards) drawShard(s);

    // Enemies
    for(const e of state.enemies) drawEnemyShip(e);

    // Bullets
    if(state.bullets.length){
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for(const b of state.bullets){
        const k = 1 - (b.life / b.max);
        const camX = state.player.x - state.w*0.5;
        const camY = state.player.y - state.h*0.5;
        const sx = b.x - camX;
        const sy = b.y - camY;
        if(sx < -80 || sx > state.w+80 || sy < -80 || sy > state.h+80) continue;
        ctx.fillStyle = `rgba(154,230,255,${0.12 + 0.35*k})`;
        ctx.beginPath();
        ctx.arc(sx, sy, 3.2, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = `rgba(255,255,255,${0.14 + 0.45*k})`;
        ctx.beginPath();
        ctx.arc(sx, sy, 1.5, 0, Math.PI*2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Player + trails + particles
    drawPlayer();
  }

  let last = performance.now();
  function frame(now){
    const dt = Math.min(0.04, (now - last) / 1000);
    last = now;
    update(dt);
    draw();
    updateTelemetry(dt);
    requestAnimationFrame(frame);
  }

  // Input
  window.addEventListener('keydown', (e)=>{
    keys[e.key] = true;

    if(e.key === 'm' || e.key === 'M'){
      e.preventDefault();
      sound.toggleMuted();
      return;
    }

    if(e.key === 'Escape'){
      e.preventDefault();
      togglePause();
    }
    if(e.key === 'r' || e.key === 'R'){
      resetRound();
      return;
    }
    if(!state.started && !state.over) startGame();

    if(e.code === 'Space'){
      e.preventDefault();
      brakeBurst();
    }
  });
  window.addEventListener('keyup', (e)=>{ keys[e.key] = false; });

  btnStart?.addEventListener('click', startGame);
  btnHow?.addEventListener('click', ()=>{
    showOverlay('How it works',
      '1) Kamikaze ships lock onto you.\n2) Collect ice shards for handling.\n3) Collect 3 shards to freeze enemies + upgrade.\n4) After upgrade, you auto-shoot forward (enemies have 10 HP).\n5) Collect 3 more shards to unlock cone shot.\n6) Space = brake (90% slow) with a 5s cooldown.\n7) Survive. The doom ramps forever.',
      'Tip: tap brake to dodge collisions, not to camp.');
  });

  restartBtn?.addEventListener('click', resetRound);
  pauseBtn?.addEventListener('click', togglePause);
  brakeBtn?.addEventListener('click', brakeBurst);

  // Mute button
  const muteBtn = document.getElementById('mute-btn');
  const updateMuteLabel = () => { if(muteBtn) muteBtn.textContent = sound._isMuted?.() ? 'Sound: OFF' : 'Sound: ON'; };
  muteBtn?.addEventListener('click', () => { sound.toggleMuted(); updateMuteLabel(); });

  brakeTouchBtn?.addEventListener('pointerdown', (e)=>{ e.preventDefault(); if(!state.started && !state.over) startGame(); brakeBurst(); });
  brakeTouchBtn?.addEventListener('click', (e)=>{ e.preventDefault(); if(!state.started && !state.over) startGame(); brakeBurst(); });

  lbSubmit?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    if(!state.over) return;
    const name = (lbName?.value || '').trim();
    const score = Math.floor(state.distance);
    if(!name){
      if(lbHint) lbHint.textContent = 'Type a name first.';
      lbName?.focus?.();
      return;
    }

    localStorage.setItem('td-name', name);
    if(lbBtn) lbBtn.disabled = true;
    if(lbHint) lbHint.textContent = 'Saving…';
    try {
      const data = await apiSubmitLeaderboard(name, score);
      if(lbHint) lbHint.textContent = 'Saved.';
      renderLeaderboard(data.entries || []);
      if(lbStatus) lbStatus.textContent = `Top score: ${Math.floor(Number(data.best) || score)}m`;
      if(lbSubmit) lbSubmit.hidden = true;
    } catch (err) {
      if(lbHint) lbHint.textContent = `Save failed: ${String(err && err.message ? err.message : err)}`;
    } finally {
      if(lbBtn) lbBtn.disabled = false;
    }
  });

  // Touch: reverse thruster buttons
  const bindHold = (el, onDown, onUp) => {
    if(!el) return;
    const down = (e)=>{ e.preventDefault(); if(!state.started && !state.over) startGame(); onDown(); };
    const up = (e)=>{ e.preventDefault(); onUp(); };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', up);
  };
  bindHold(revLBtn, ()=>{ input.revL = true; }, ()=>{ input.revL = false; });
  bindHold(revRBtn, ()=>{ input.revR = true; }, ()=>{ input.revR = false; });

  // Touch: joystick (analog throttle + steer)
  if(joy && joyKnob){
    const joyState = { id: null, cx: 0, cy: 0, r: 56 };

    const setJoy = (dx, dy) => {
      const r = joyState.r;
      const mag = Math.hypot(dx, dy) || 1;
      const k = mag > r ? (r / mag) : 1;
      const x = dx * k;
      const y = dy * k;

      joyKnob.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;

      // Map: X => turn (-1..1), Y up => throttle (0..1)
      input.turn = clamp(x / r, -1, 1);
      input.throttle = clamp((-y) / r, 0, 1);
    };

    const resetJoy = () => {
      input.joyActive = false;
      input.turn = 0;
      input.throttle = 0;
      joyKnob.style.transform = 'translate(-50%,-50%)';
    };

    joy.addEventListener('pointerdown', (e)=>{
      e.preventDefault();
      if(!state.started && !state.over) startGame();
      input.joyActive = true;
      joyState.id = e.pointerId;
      const rect = joy.getBoundingClientRect();
      joyState.cx = rect.left + rect.width/2;
      joyState.cy = rect.top + rect.height/2;
      joy.setPointerCapture?.(e.pointerId);
      setJoy(e.clientX - joyState.cx, e.clientY - joyState.cy);
    });
    joy.addEventListener('pointermove', (e)=>{
      if(!input.joyActive || joyState.id !== e.pointerId) return;
      e.preventDefault();
      setJoy(e.clientX - joyState.cx, e.clientY - joyState.cy);
    });
    const joyUp = (e)=>{
      if(joyState.id !== e.pointerId) return;
      e.preventDefault();
      joyState.id = null;
      resetJoy();
    };
    joy.addEventListener('pointerup', joyUp);
    joy.addEventListener('pointercancel', joyUp);
    joy.addEventListener('pointerleave', (e)=>{
      if(input.joyActive && joyState.id === e.pointerId) joyUp(e);
    });
  }

  // Click to start (gesture)
  window.addEventListener('mousedown', ()=>{ if(!state.started && !state.over) startGame(); });

  // Boot
  resize();
  resetRound();
  requestAnimationFrame(frame);
})();

  // (legacy code removed; Thermal Drift now runs via the IIFE above)
