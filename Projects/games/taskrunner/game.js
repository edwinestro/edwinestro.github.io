/**
 * TASKRUNNER — Entity Evolution Game
 * 
 * Mechanics drawn from 14 sibling games:
 *   Attract-ion → orbital drag physics, stability hold
 *   AGI Breeder  → trait allocation, risk management
 *   Frost Signal → signal classification, shrinking windows, streaks
 *   Thermal Drift→ physics movement, frost accumulation
 *   Unsupervised → beacon placement, combo chaining, field stability
 *   I3D23        → collection, threat avoidance
 *   Science Lab  → knowledge unlock quiz
 *   Lepton       → particle tracks, pair visuals
 *   AGI 3D       → entity breathing, glow
 *
 * QA Layers (flicker / perf safety):
 *   L0  Frame budget  — cap particles to maintain 60 fps
 *   L1  Double-buffer  — off-screen canvas composited each frame
 *   L2  Delta clamp    — skip huge dt spikes (tab switch, etc.)
 *   L3  Object pool    — pre-allocate, recycle; zero GC pressure
 *   L4  Adaptive quality— drop glow/trails if FPS < 45
 */

'use strict';

// ─── POLYFILLS ──────────────────────────────────────────
// roundRect polyfill for iOS WebKit / older Edge
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, radii) {
    const r = typeof radii === 'number' ? radii : (Array.isArray(radii) ? radii[0] : 0);
    this.moveTo(x + r, y);
    this.lineTo(x + w - r, y);
    this.arcTo(x + w, y, x + w, y + r, r);
    this.lineTo(x + w, y + h - r);
    this.arcTo(x + w, y + h, x + w - r, y + h, r);
    this.lineTo(x + r, y + h);
    this.arcTo(x, y + h, x, y + h - r, r);
    this.lineTo(x, y + r);
    this.arcTo(x, y, x + r, y, r);
  };
}

// ─── DEVICE DETECTION ───────────────────────────────────
const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

// ─── QA PERF LAYER (LPX-inspired deterministic engine) ──
const QA = {
  TARGET_FPS: 60,
  FRAME_MS: 1000 / 60,
  FIXED_DT: 1 / 60,         // LPX: deterministic fixed timestep
  MAX_DT: 0.05,             // L2: clamp to 50 ms
  MAX_STEPS: 3,             // LPX: max simulation steps per frame (prevents spiral of death)
  PARTICLE_BUDGET: 600,     // L0: hard ceiling
  FPS_SAMPLES: 60,
  fpsBuf: [],
  fps: 60,
  quality: 1,               // 1 = full, 0.5 = reduced
  accumulator: 0,           // LPX: fixed-step accumulator
  interpolation: 0,         // LPX: render interpolation factor

  // ── L5: Frame-time histogram for audit ──
  frameHisto: new Uint32Array(8),
  frameCount: 0,
  jankCount: 0,
  worstDt: 0,

  // ── L6: Draw call counter ──
  drawCalls: 0,
  drawCallsPerFrame: 0,

  // ── L7: Pool health ──
  poolPressure: 0,

  // ── L8: Pipeline stage budgets (LPX explicit pipeline) ──
  stageTimes: { input: 0, update: 0, physics: 0, render: 0, composite: 0 },
  _stageStart: 0,
  stageBegin() { this._stageStart = performance.now(); },
  stageEnd(name) { this.stageTimes[name] = performance.now() - this._stageStart; },         // 0-1, how full the pools are

  tick(dt) {
    this.fpsBuf.push(1 / Math.max(dt, 0.001));
    if (this.fpsBuf.length > this.FPS_SAMPLES) this.fpsBuf.shift();
    this.fps = this.fpsBuf.reduce((a, b) => a + b, 0) / this.fpsBuf.length;
    // L4: adaptive quality
    this.quality = this.fps < 40 ? 0.5 : this.fps < 50 ? 0.75 : 1;

    // L5: histogram
    const ms = dt * 1000;
    this.frameCount++;
    if (dt > this.worstDt) this.worstDt = dt;
    if (ms < 8) this.frameHisto[0]++;
    else if (ms < 12) this.frameHisto[1]++;
    else if (ms < 16) this.frameHisto[2]++;
    else if (ms < 20) this.frameHisto[3]++;
    else if (ms < 33) this.frameHisto[4]++;
    else if (ms < 50) { this.frameHisto[5]++; this.jankCount++; }
    else if (ms < 100) { this.frameHisto[6]++; this.jankCount++; }
    else { this.frameHisto[7]++; this.jankCount++; }

    // L6: reset draw counter
    this.drawCallsPerFrame = this.drawCalls;
    this.drawCalls = 0;

    // L7: pool pressure
    const totalActive = ambientPool.active.length + fxPool.active.length;
    this.poolPressure = totalActive / this.PARTICLE_BUDGET;
  },
  canSpawn(currentCount) {
    return currentCount < this.PARTICLE_BUDGET * this.quality;
  },

  // Self-test: returns audit report object (callable from console)
  audit() {
    const jankPct = this.frameCount > 0 ? (this.jankCount / this.frameCount * 100).toFixed(1) : 0;
    const bucketLabels = ['<8ms', '<12ms', '<16ms', '<20ms', '<33ms', '<50ms', '<100ms', '100ms+'];
    const histo = {};
    for (let i = 0; i < bucketLabels.length; i++) {
      histo[bucketLabels[i]] = this.frameHisto[i];
    }
    return {
      avgFps: Math.round(this.fps),
      qualityLevel: this.quality,
      totalFrames: this.frameCount,
      jankFrames: this.jankCount,
      jankPercent: parseFloat(jankPct),
      worstFrameMs: Math.round(this.worstDt * 1000),
      drawCallsLastFrame: this.drawCallsPerFrame,
      poolPressure: Math.round(this.poolPressure * 100) + '%',
      ambientActive: ambientPool.active.length,
      fxActive: fxPool.active.length,
      frameHistogram: histo,
      grade: parseFloat(jankPct) < 1 ? 'A' :
             parseFloat(jankPct) < 3 ? 'B' :
             parseFloat(jankPct) < 8 ? 'C' : 'D',
      pipeline: { ...this.stageTimes },
      fixedStepsPerFrame: Math.round(this.accumulator / this.FIXED_DT),
    };
  }
};
// Expose for console debugging
window.QA_AUDIT = () => { const r = QA.audit(); console.table(r); return r; };

// ─── CANVAS SETUP (L1: double-buffer) ────────────────────
const cvs = document.getElementById('game');
const ctx = cvs.getContext('2d', { alpha: false });
// Off-screen buffer
const buf = document.createElement('canvas');
const bctx = buf.getContext('2d', { alpha: false });

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth, h = window.innerHeight;
  cvs.width = buf.width = w * dpr;
  cvs.height = buf.height = h * dpr;
  cvs.style.width = w + 'px';
  cvs.style.height = h + 'px';
  bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  W = w; H = h;
}
let W = 0, H = 0;
window.addEventListener('resize', () => { resize(); initStars(); });
resize();

// ─── OBJECT POOL (L3) ───────────────────────────────────
class Pool {
  constructor(factory, reset, cap = 800) {
    this._f = factory; this._r = reset; this._cap = cap;
    this.active = []; this._free = [];
    for (let i = 0; i < 64; i++) this._free.push(this._f());
  }
  spawn(init) {
    if (this.active.length >= this._cap) return null;
    if (!QA.canSpawn(this.active.length)) return null;
    let obj = this._free.length ? this._free.pop() : this._f();
    init(obj);
    this.active.push(obj);
    return obj;
  }
  // LPX: swap-remove instead of splice (O(1) instead of O(n))
  update(dt, updater) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      if (!updater(this.active[i], dt)) {
        this._r(this.active[i]);
        this._free.push(this.active[i]);
        // swap with last element instead of splice
        const last = this.active.length - 1;
        if (i < last) this.active[i] = this.active[last];
        this.active.length = last;
      }
    }
  }
  clear() {
    for (const o of this.active) { this._r(o); this._free.push(o); }
    this.active.length = 0;
  }
}

// ─── PARTICLE SYSTEMS ───────────────────────────────────
const ambientPool = new Pool(
  () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, r: 1, color: '#4fc3f7', alpha: 1 }),
  (p) => { p.life = 0; p.alpha = 0; },
  400
);
const fxPool = new Pool(
  () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, r: 2, color: '#fff', alpha: 1 }),
  (p) => { p.life = 0; p.alpha = 0; },
  300
);

function spawnAmbient(count) {
  for (let i = 0; i < count; i++) {
    ambientPool.spawn(p => {
      p.x = Math.random() * W;
      p.y = Math.random() * H;
      p.vx = (Math.random() - 0.5) * 12;
      p.vy = (Math.random() - 0.5) * 12;
      p.r = 0.5 + Math.random() * 1.5;
      p.life = 0;
      p.maxLife = 4 + Math.random() * 6;
      p.alpha = 0;
      const hues = ['#4fc3f7', '#ab47bc', '#66bb6a', '#fdd835', '#ff7043'];
      p.color = hues[Math.floor(Math.random() * hues.length)];
    });
  }
}

function burstFx(x, y, count, color, speed = 80) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
    const spd = speed * (0.4 + Math.random() * 0.6);
    fxPool.spawn(p => {
      p.x = x; p.y = y;
      p.vx = Math.cos(angle) * spd;
      p.vy = Math.sin(angle) * spd;
      p.r = 1.5 + Math.random() * 2.5;
      p.life = 0;
      p.maxLife = 0.4 + Math.random() * 0.5;
      p.color = color;
      p.alpha = 1;
    });
  }
}

function updateParticles(pool, dt) {
  pool.update(dt, (p, dt2) => {
    p.life += dt2;
    if (p.life >= p.maxLife) return false;
    p.x += p.vx * dt2;
    p.y += p.vy * dt2;
    p.vx *= 0.98;
    p.vy *= 0.98;
    const t = p.life / p.maxLife;
    p.alpha = t < 0.15 ? t / 0.15 : 1 - ((t - 0.15) / 0.85);
    return true;
  });
}

// LPX: batched particle rendering — group by color, single beginPath per batch
function drawParticles(c, pool) {
  if (pool.active.length === 0) return;
  // Group particles by color for batched draw
  const batches = {};
  const glowBatch = [];
  for (const p of pool.active) {
    if (p.alpha < 0.01) continue;
    if (!batches[p.color]) batches[p.color] = [];
    batches[p.color].push(p);
    if (QA.quality >= 0.9 && p.r > 1.2) glowBatch.push(p);
  }
  // Draw each color batch with single fillStyle set
  for (const color in batches) {
    c.fillStyle = color;
    const particles = batches[color];
    for (const p of particles) {
      c.globalAlpha = p.alpha * QA.quality;
      c.beginPath();
      c.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      c.fill();
    }
    QA.drawCalls++;
  }
  // Glow pass (reduced draw calls — batch all glows)
  if (glowBatch.length > 0) {
    for (const p of glowBatch) {
      c.globalAlpha = p.alpha * 0.15;
      c.fillStyle = p.color;
      c.beginPath();
      c.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2);
      c.fill();
    }
    QA.drawCalls++;
  }
  c.globalAlpha = 1;
}

// ─── ENTITY VISUAL (breathing, orbiting, gaze) ──────────
const entity = {
  x: 0, y: 0,
  baseR: 20,
  breathPhase: 0,
  pulsePhase: 0,
  satellites: [],
  gazeX: 0, gazeY: 0,
  tier: 1,
  tierColors: ['#4fc3f7', '#66bb6a', '#fdd835', '#ff7043', '#ab47bc'],

  init() {
    this.x = W / 2; this.y = H / 2;
    this.satellites = [];
    for (let i = 0; i < 3; i++) {
      this.satellites.push({ angle: (Math.PI * 2 / 3) * i, dist: 38, r: 3, speed: 0.8 + Math.random() * 0.4 });
    }
  },

  update(dt) {
    this.breathPhase += dt * 1.8;
    this.pulsePhase += dt * 3.5;
    // smooth gaze follow
    this.gazeX += (mouse.x - this.gazeX) * 2 * dt;
    this.gazeY += (mouse.y - this.gazeY) * 2 * dt;
    for (const sat of this.satellites) {
      sat.angle += sat.speed * dt;
    }
    // spawn ambient trail
    if (Math.random() < 0.3 * QA.quality) {
      const a = Math.random() * Math.PI * 2;
      const d = this.baseR + 10 + Math.random() * 20;
      ambientPool.spawn(p => {
        p.x = this.x + Math.cos(a) * d;
        p.y = this.y + Math.sin(a) * d;
        p.vx = Math.cos(a) * 5;
        p.vy = Math.sin(a) * 5;
        p.r = 0.5 + Math.random();
        p.life = 0;
        p.maxLife = 1.5 + Math.random() * 2;
        p.color = this.tierColors[this.tier - 1];
      });
    }
  },

  draw(c) {
    const col = this.tierColors[this.tier - 1];
    const breath = 1 + Math.sin(this.breathPhase) * 0.08;
    const pulse = 1 + Math.sin(this.pulsePhase) * 0.03;
    const r = this.baseR * breath * pulse * (1 + (this.tier - 1) * 0.12);

    // outer glow
    if (QA.quality >= 0.75) {
      const grad = c.createRadialGradient(this.x, this.y, r * 0.5, this.x, this.y, r * 3);
      grad.addColorStop(0, col + '30');
      grad.addColorStop(1, 'transparent');
      c.fillStyle = grad;
      c.beginPath();
      c.arc(this.x, this.y, r * 3, 0, Math.PI * 2);
      c.fill();
    }

    // core orb
    const coreGrad = c.createRadialGradient(this.x - r * 0.2, this.y - r * 0.2, 0, this.x, this.y, r);
    coreGrad.addColorStop(0, '#fff');
    coreGrad.addColorStop(0.4, col);
    coreGrad.addColorStop(1, col + '40');
    c.fillStyle = coreGrad;
    c.beginPath();
    c.arc(this.x, this.y, r, 0, Math.PI * 2);
    c.fill();

    // inner ring
    c.strokeStyle = col;
    c.lineWidth = 1.5;
    c.globalAlpha = 0.4 + Math.sin(this.breathPhase * 2) * 0.2;
    c.beginPath();
    c.arc(this.x, this.y, r * 1.4, 0, Math.PI * 2);
    c.stroke();
    c.globalAlpha = 1;

    // gaze indicator (eye dot)
    const gazeDx = this.gazeX - this.x, gazeDy = this.gazeY - this.y;
    const gazeAngle = Math.atan2(gazeDy, gazeDx);
    const gazeDist = Math.min(r * 0.35, Math.hypot(gazeDx, gazeDy) * 0.1);
    c.fillStyle = '#fff';
    c.beginPath();
    c.arc(this.x + Math.cos(gazeAngle) * gazeDist, this.y + Math.sin(gazeAngle) * gazeDist, r * 0.18, 0, Math.PI * 2);
    c.fill();

    // satellites
    for (const sat of this.satellites) {
      const sx = this.x + Math.cos(sat.angle) * sat.dist * breath;
      const sy = this.y + Math.sin(sat.angle) * sat.dist * breath;
      c.fillStyle = col;
      c.globalAlpha = 0.7;
      c.beginPath();
      c.arc(sx, sy, sat.r, 0, Math.PI * 2);
      c.fill();
      c.globalAlpha = 1;
    }
  }
};

// ─── INPUT ──────────────────────────────────────────────
const mouse = { x: W / 2, y: H / 2, down: false, clicked: false };
const keys = {};
let _pendingClick = false;

cvs.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
cvs.addEventListener('mousedown', () => { mouse.down = true; _pendingClick = true; });
cvs.addEventListener('mouseup', () => { mouse.down = false; });
cvs.addEventListener('touchstart', e => {
  const t = e.touches[0];
  mouse.x = t.clientX; mouse.y = t.clientY;
  mouse.down = true; _pendingClick = true;
}, { passive: true });
cvs.addEventListener('touchmove', e => {
  const t = e.touches[0];
  mouse.x = t.clientX; mouse.y = t.clientY;
}, { passive: true });
cvs.addEventListener('touchend', () => { mouse.down = false; }, { passive: true });
window.addEventListener('keydown', e => { keys[e.key] = true; });
window.addEventListener('keyup', e => { keys[e.key] = false; });

// ─── GAME STATE ─────────────────────────────────────────
const TIERS = [
  { name: 'Spark',    xpReq: 0 },
  { name: 'Flicker',  xpReq: 300 },
  { name: 'Blaze',    xpReq: 800 },
  { name: 'Radiance', xpReq: 1600 },
  { name: 'Nova',     xpReq: 3000 },
];

const TASKS = [
  // Tier 1
  { id: 'orbital',    name: 'Orbital Hold',      tier: 1, time: 20, desc: 'Drag the electron into orbit and hold it stable.' },
  { id: 'classify',   name: 'Signal Classify',    tier: 1, time: 18, desc: 'Classify incoming signals before they expire.' },
  { id: 'collect',    name: 'Photon Harvest',     tier: 1, time: 22, desc: 'Collect drifting photons. Avoid red disruptors.' },
  // Tier 2
  { id: 'allocate',   name: 'Trait Allocate',     tier: 2, time: 25, desc: 'Distribute trait points to match target profile.' },
  { id: 'beacon',     name: 'Beacon Anchor',      tier: 2, time: 20, desc: 'Place beacons to stabilize the energy field.' },
  { id: 'drift',      name: 'Thermal Drift',      tier: 2, time: 24, desc: 'Navigate with thrust physics. Collect frost crystals.' },
  // Tier 3
  { id: 'classify2',  name: 'Signal Storm',       tier: 3, time: 16, desc: 'Faster signals, tighter windows. Triple-classify.' },
  { id: 'orbital2',   name: 'Multi-Orbit',        tier: 3, time: 25, desc: 'Hold 3 electrons in concentric orbits simultaneously.' },
  { id: 'quiz',       name: 'Knowledge Probe',    tier: 3, time: 30, desc: 'Answer pattern questions to unlock knowledge cores.' },
  // Tier 4
  { id: 'collect2',   name: 'Lepton Sweep',       tier: 4, time: 18, desc: 'Collect particle tracks. Physics curves matter.' },
  { id: 'beacon2',    name: 'Field Cascade',      tier: 4, time: 22, desc: 'Chain beacon combos to prevent field ruptures.' },
  { id: 'allocate2',  name: 'Risk Balance',       tier: 4, time: 20, desc: 'Allocate with hidden risk — overshoot = penalty.' },
  // Tier 5
  { id: 'gauntlet',   name: 'The Gauntlet',       tier: 5, time: 40, desc: 'All mechanics combined. Survive and score.' },
  { id: 'evolve',     name: 'Final Evolution',    tier: 5, time: 35, desc: 'Master every trait. Become Nova.' },
  { id: 'freerun',    name: 'Endless Run',        tier: 5, time: 0,  desc: 'No time limit. Push your score into infinity.' },
];

const state = {
  phase: 'title',   // title, hub, briefing, playing, result
  xp: 0,
  tier: 1,
  score: 0,
  streak: 0,
  bestXP: 0,
  bestStreak: 0,
  runs: 0,
  integrity: 5,
  maxIntegrity: 5,
  completedTasks: new Set(),
  currentTask: null,
  taskTimer: 0,
  taskScore: 0,
  taskData: {},      // per-task state
  sessionStart: 0,   // timestamp when run started
  sessionTime: 0,    // cumulative seconds played this run
  longestSession: 0, // best session time ever (seconds)
  highestTasks: 0,   // most tasks completed in a single run
};

function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem('taskrunner_save'));
    if (s) {
      state.bestXP = s.bestXP || 0;
      state.runs = s.runs || 0;
      state.longestSession = s.longestSession || 0;
      state.highestTasks = s.highestTasks || 0;
      state.bestStreak = s.bestStreak || 0;
    }
  } catch(e) { /* ignore */ }
}
function save() {
  try {
    localStorage.setItem('taskrunner_save', JSON.stringify({
      bestXP: state.bestXP,
      runs: state.runs,
      longestSession: state.longestSession,
      highestTasks: state.highestTasks,
      bestStreak: state.bestStreak,
    }));
  } catch(e) { /* ignore */ }
}

// ─── DOM HELPERS ────────────────────────────────────────
const $ = id => document.getElementById(id);
function showPanel(id) {
  for (const p of document.querySelectorAll('.panel')) p.classList.add('hidden');
  if (id) $(id).classList.remove('hidden');
}
function buildPips() {
  const c = $('integrity-pips');
  c.innerHTML = '';
  for (let i = 0; i < state.maxIntegrity; i++) {
    const d = document.createElement('div');
    d.className = 'pip' + (i >= state.integrity ? ' lost' : '');
    c.appendChild(d);
  }
}
function updateHUD() {
  $('hud-xp').textContent = state.xp;
  $('hud-tier').textContent = state.tier;
  $('hud-streak').textContent = state.streak;
  $('hud-score').textContent = state.taskScore;
  const t = state.currentTask;
  if (t && t.time > 0) {
    const remaining = Math.max(0, t.time - state.taskTimer);
    $('hud-time').textContent = remaining.toFixed(1) + 's';
    $('hud-time').className = 'hud-value' + (remaining < 5 ? ' warn' : '');
  } else {
    $('hud-time').textContent = '∞';
  }
  buildPips();
}

// ─── BACKGROUND GRID / STARS ────────────────────────────
const stars = [];
function initStars() {
  stars.length = 0;
  for (let i = 0; i < 80; i++) {
    stars.push({
      x: Math.random() * W,
      y: Math.random() * H,
      r: 0.3 + Math.random() * 1.2,
      twinkle: Math.random() * Math.PI * 2,
      speed: 0.5 + Math.random() * 1.5,
    });
  }
}
initStars();

function drawBackground(c, time) {
  // dark gradient
  const bg = c.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#06060e');
  bg.addColorStop(1, '#0c0c1e');
  c.fillStyle = bg;
  c.fillRect(0, 0, W, H);

  // subtle grid
  if (QA.quality >= 0.75) {
    c.strokeStyle = 'rgba(79,195,247,0.03)';
    c.lineWidth = 0.5;
    const gs = 60;
    const ox = (time * 5) % gs;
    for (let x = -gs + ox; x < W + gs; x += gs) {
      c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke();
    }
    for (let y = -gs + ox; y < H + gs; y += gs) {
      c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke();
    }
  }

  // stars
  const starDt = 1/60; // fixed visual rate for stars (frame-rate independent enough)
  for (const s of stars) {
    s.twinkle += s.speed * starDt;
    const a = 0.3 + Math.sin(s.twinkle) * 0.3;
    c.globalAlpha = a;
    c.fillStyle = '#fff';
    c.beginPath();
    c.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    c.fill();
  }
  c.globalAlpha = 1;
}

// ─── EASING / UTIL ──────────────────────────────────────
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function dist(ax, ay, bx, by) { return Math.hypot(bx - ax, by - ay); }
function randRange(lo, hi) { return lo + Math.random() * (hi - lo); }
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

// ═══════════════════════════════════════════════════════
// TASK IMPLEMENTATIONS
// Each task has: setup(), update(dt), draw(c), cleanup()
// ═══════════════════════════════════════════════════════

const tasks = {};

// ─── ORBITAL HOLD (Attract-ion mechanic) ────────────────
function createOrbitalTask() {
  return {
  setup(isMulti) {
    const d = state.taskData;
    d.nucleusX = W / 2;
    d.nucleusY = H / 2;
    d.orbitR = 90;
    d.bandW = 22;
    d.electrons = [];
    const count = isMulti ? 3 : 1;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / count) * i;
      d.electrons.push({
        x: W / 2 + Math.cos(angle) * (d.orbitR + 40),
        y: H / 2 + Math.sin(angle) * (d.orbitR + 40),
        vx: 0, vy: 0,
        dragging: false,
        holdTime: 0,
        holdReq: isMulti ? 3.5 : 5.0,
        stable: false,
        color: ['#4fc3f7', '#66bb6a', '#fdd835'][i],
        orbitR: d.orbitR + i * 35,
      });
    }
    d.stabilitySmooth = 0;
    d.draggingIdx = -1;
    d.ringPulse = 0;
  },
  update(dt) {
    const d = state.taskData;
    d.ringPulse += dt * 2;

    for (let i = 0; i < d.electrons.length; i++) {
      const e = d.electrons[i];
      const r = e.orbitR;

      // spring toward orbit if not dragging
      if (e.dragging) {
        e.x = lerp(e.x, mouse.x, 8 * dt);
        e.y = lerp(e.y, mouse.y, 8 * dt);
        e.vx = e.vy = 0;
      } else {
        // orbital angular velocity
        const angle = Math.atan2(e.y - d.nucleusY, e.x - d.nucleusX);
        const dFromCenter = dist(e.x, e.y, d.nucleusX, d.nucleusY);
        const springF = (dFromCenter - r) * 1.8;
        e.vx += (-Math.cos(angle) * springF - Math.sin(angle) * 50) * dt;
        e.vy += (-Math.sin(angle) * springF + Math.cos(angle) * 50) * dt;
        e.vx *= 0.96;
        e.vy *= 0.96;
        e.x += e.vx * dt;
        e.y += e.vy * dt;
      }

      // stability check
      const dist2 = dist(e.x, e.y, d.nucleusX, d.nucleusY);
      const inBand = Math.abs(dist2 - r) < d.bandW;
      if (inBand) {
        e.holdTime = Math.min(e.holdTime + dt, e.holdReq);
        if (e.holdTime >= e.holdReq && !e.stable) {
          e.stable = true;
          burstFx(e.x, e.y, 20, e.color, 60);
          state.taskScore += 200;
        }
      } else {
        e.holdTime = Math.max(0, e.holdTime - dt * 2);
      }
    }

    // drag control
    if (mouse.clicked) {
      for (let i = 0; i < d.electrons.length; i++) {
        if (dist(mouse.x, mouse.y, d.electrons[i].x, d.electrons[i].y) < 25) {
          d.draggingIdx = i;
          d.electrons[i].dragging = true;
          break;
        }
      }
    }
    if (!mouse.down && d.draggingIdx >= 0) {
      d.electrons[d.draggingIdx].dragging = false;
      d.draggingIdx = -1;
    }

    // overall stability
    const allStable = d.electrons.every(e => e.stable);
    d.stabilitySmooth = lerp(d.stabilitySmooth, allStable ? 1 : 0, 2 * dt);
    if (allStable) return 'complete';
  },
  draw(c) {
    const d = state.taskData;

    // nucleus glow
    const ng = c.createRadialGradient(d.nucleusX, d.nucleusY, 5, d.nucleusX, d.nucleusY, 35);
    ng.addColorStop(0, '#ff7043cc');
    ng.addColorStop(1, 'transparent');
    c.fillStyle = ng;
    c.beginPath();
    c.arc(d.nucleusX, d.nucleusY, 35, 0, Math.PI * 2);
    c.fill();

    // nucleus core
    c.fillStyle = '#ff7043';
    c.beginPath();
    c.arc(d.nucleusX, d.nucleusY, 8, 0, Math.PI * 2);
    c.fill();

    for (const e of d.electrons) {
      // orbit band
      const pulse = 1 + Math.sin(d.ringPulse) * 0.02;
      c.strokeStyle = e.color + '30';
      c.lineWidth = d.bandW * 2;
      c.beginPath();
      c.arc(d.nucleusX, d.nucleusY, e.orbitR * pulse, 0, Math.PI * 2);
      c.stroke();

      // orbit center line
      c.strokeStyle = e.color + '60';
      c.lineWidth = 1;
      c.beginPath();
      c.arc(d.nucleusX, d.nucleusY, e.orbitR * pulse, 0, Math.PI * 2);
      c.stroke();

      // hold progress arc
      const holdPct = e.holdTime / e.holdReq;
      if (holdPct > 0) {
        c.strokeStyle = e.color;
        c.lineWidth = 3;
        c.beginPath();
        c.arc(d.nucleusX, d.nucleusY, e.orbitR * pulse, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * holdPct);
        c.stroke();
      }

      // electron
      c.fillStyle = e.color;
      c.shadowColor = e.color;
      c.shadowBlur = QA.quality >= 0.75 ? 12 : 0;
      c.beginPath();
      c.arc(e.x, e.y, e.stable ? 8 : 6, 0, Math.PI * 2);
      c.fill();
      c.shadowBlur = 0;

      if (e.stable) {
        c.strokeStyle = e.color;
        c.lineWidth = 2;
        c.globalAlpha = 0.5 + Math.sin(d.ringPulse * 3) * 0.3;
        c.beginPath();
        c.arc(e.x, e.y, 14, 0, Math.PI * 2);
        c.stroke();
        c.globalAlpha = 1;
      }
    }

    // stability meter
    const barW = 160, barH = 8;
    const bx = W / 2 - barW / 2, by = H - 60;
    c.fillStyle = '#222';
    c.fillRect(bx, by, barW, barH);
    const avHold = d.electrons.reduce((s, e) => s + e.holdTime / e.holdReq, 0) / d.electrons.length;
    c.fillStyle = avHold > 0.8 ? '#66bb6a' : '#4fc3f7';
    c.fillRect(bx, by, barW * avHold, barH);
    c.fillStyle = '#888';
    c.font = '11px system-ui';
    c.textAlign = 'center';
    c.fillText('Orbital Stability', W / 2, by - 6);
  },
  cleanup() { state.taskData = {}; }
  };
}
tasks.orbital = createOrbitalTask();
tasks.orbital2 = createOrbitalTask();

// ─── SIGNAL CLASSIFY (Frost Signal / OneAI mechanic) ─────
function createClassifyTask() {
  return {
  setup(isStorm) {
    const d = state.taskData;
    d.signals = [];
    d.spawnTimer = 0;
    d.spawnRate = isStorm ? 1.2 : 2.0;
    d.windowTime = isStorm ? 4 : 6;
    d.types = ['Filter', 'Analyze', 'Quarantine'];
    d.typeColors = ['#4fc3f7', '#66bb6a', '#ff7043'];
    d.roundsSpawned = 0;
    d.maxSignals = isStorm ? 5 : 3;
    d.isStorm = isStorm;
  },
  update(dt) {
    const d = state.taskData;
    d.spawnTimer += dt;

    // spawn new signals
    if (d.spawnTimer >= d.spawnRate && d.signals.length < d.maxSignals) {
      d.spawnTimer = 0;
      const type = Math.floor(Math.random() * 3);
      // shrink window over time
      const window = Math.max(2.5, d.windowTime - d.roundsSpawned * 0.15);
      d.signals.push({
        x: 80 + Math.random() * (W - 160),
        y: 80 + Math.random() * (H - 200),
        type,
        timer: 0,
        window,
        answered: false,
        correct: false,
        fadeOut: 0,
        pulsePhase: Math.random() * Math.PI * 2,
        // visual hint: shape rotation
        rotation: 0,
        shapeType: type, // 0=circle, 1=diamond, 2=triangle
      });
      d.roundsSpawned++;
    }

    // update signals
    for (let i = d.signals.length - 1; i >= 0; i--) {
      const s = d.signals[i];
      s.timer += dt;
      s.rotation += dt * (1 + s.type * 0.5);
      s.pulsePhase += dt * 3;

      if (s.answered) {
        s.fadeOut += dt;
        if (s.fadeOut > 0.6) {
          d.signals.splice(i, 1);
        }
      } else if (s.timer >= s.window) {
        // missed
        state.integrity--;
        burstFx(s.x, s.y, 12, '#ff3333', 40);
        s.answered = true;
        s.correct = false;
        state.streak = 0;
        if (state.integrity <= 0) return 'fail';
      }
    }

    // click to classify
    if (mouse.clicked) {
      for (const s of d.signals) {
        if (s.answered) continue;
        if (dist(mouse.x, mouse.y, s.x, s.y) < 35) {
          // cycle through types on click
          if (s._selectedType === undefined) s._selectedType = 0;
          else s._selectedType = (s._selectedType + 1) % 3;

          // auto-submit on matching type
          if (s._selectedType === s.type) {
            s.answered = true;
            s.correct = true;
            state.taskScore += 120 + Math.floor(state.streak * 25);
            state.streak++;
            burstFx(s.x, s.y, 15, d.typeColors[s.type], 50);
          }
          break;
        }
      }
    }

    // keyboard shortcuts 1-2-3
    for (let k = 1; k <= 3; k++) {
      if (keys['' + k]) {
        keys['' + k] = false;
        // classify nearest unanswered signal
        let nearest = null, bestD = Infinity;
        for (const s of d.signals) {
          if (s.answered) continue;
          const dd = dist(mouse.x, mouse.y, s.x, s.y);
          if (dd < bestD) { bestD = dd; nearest = s; }
        }
        if (nearest) {
          nearest.answered = true;
          nearest.correct = (k - 1) === nearest.type;
          if (nearest.correct) {
            state.taskScore += 120 + Math.floor(state.streak * 25);
            state.streak++;
            burstFx(nearest.x, nearest.y, 15, d.typeColors[nearest.type], 50);
          } else {
            state.integrity--;
            state.streak = 0;
            burstFx(nearest.x, nearest.y, 12, '#ff3333', 40);
            if (state.integrity <= 0) return 'fail';
          }
        }
      }
    }

    if (state.taskScore >= (d.isStorm ? 1500 : 800)) return 'complete';
  },
  draw(c) {
    const d = state.taskData;

    // legend
    c.font = '12px system-ui';
    for (let i = 0; i < 3; i++) {
      c.fillStyle = d.typeColors[i];
      c.fillText(`[${i + 1}] ${d.types[i]}`, 20, H - 50 + i * 18);
    }

    for (const s of d.signals) {
      const life = s.timer / s.window;
      const alpha = s.answered ? Math.max(0, 1 - s.fadeOut / 0.6) : 1;
      c.globalAlpha = alpha;

      // urgency ring
      const urgency = Math.min(1, life);
      const ringR = 30 + Math.sin(s.pulsePhase) * 3;

      // draw countdown ring
      c.strokeStyle = urgency > 0.7 ? '#ff3333' : urgency > 0.4 ? '#fdd835' : '#4fc3f780';
      c.lineWidth = 3;
      c.beginPath();
      c.arc(s.x, s.y, ringR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - life));
      c.stroke();

      // signal shape
      c.fillStyle = d.typeColors[s.type];
      c.save();
      c.translate(s.x, s.y);
      c.rotate(s.rotation);

      if (s.shapeType === 0) {
        // circle
        c.beginPath();
        c.arc(0, 0, 12, 0, Math.PI * 2);
        c.fill();
      } else if (s.shapeType === 1) {
        // diamond
        c.beginPath();
        c.moveTo(0, -14); c.lineTo(14, 0); c.lineTo(0, 14); c.lineTo(-14, 0);
        c.closePath();
        c.fill();
      } else {
        // triangle
        c.beginPath();
        c.moveTo(0, -14); c.lineTo(12, 10); c.lineTo(-12, 10);
        c.closePath();
        c.fill();
      }
      c.restore();

      // selected type indicator with color feedback
      if (s._selectedType !== undefined && !s.answered) {
        c.fillStyle = d.typeColors[s._selectedType];
        c.font = 'bold 11px system-ui';
        c.textAlign = 'center';
        c.fillText(d.types[s._selectedType], s.x, s.y + ringR + 16);
      }

      // glow
      if (QA.quality >= 0.75 && !s.answered) {
        c.shadowColor = d.typeColors[s.type];
        c.shadowBlur = 10 + Math.sin(s.pulsePhase) * 5;
        c.beginPath();
        c.arc(s.x, s.y, 2, 0, Math.PI * 2);
        c.fill();
        c.shadowBlur = 0;
      }
    }
    c.globalAlpha = 1;
    c.textAlign = 'start';
  },
  cleanup() { state.taskData = {}; }
  };
}
tasks.classify = createClassifyTask();
tasks.classify2 = createClassifyTask();

// ─── PHOTON HARVEST (Collect mechanic from I3D23 + Lepton)
function createCollectTask() {
  return {
  setup(isLepton) {
    const d = state.taskData;
    d.player = { x: W / 2, y: H / 2, r: 12, vx: 0, vy: 0, speed: isLepton ? 280 : 220 };
    d.photons = [];
    d.disruptors = [];
    d.spawnTimer = 0;
    d.isLepton = isLepton;
    d.collected = 0;
    d.target = isLepton ? 25 : 15;
    d.trailPoints = [];

    // spawn initial photons
    for (let i = 0; i < 8; i++) {
      d.photons.push(makePhoton(d.isLepton));
    }
    // spawn disruptors
    for (let i = 0; i < (isLepton ? 4 : 2); i++) {
      d.disruptors.push(makeDisruptor());
    }
  },
  update(dt) {
    const d = state.taskData;
    const p = d.player;

    // movement (WASD, arrows, or mobile joystick)
    let ax = mobileState.joyX || 0, ay = mobileState.joyY || 0;
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) ax -= 1;
    if (keys['ArrowRight'] || keys['d'] || keys['D']) ax += 1;
    if (keys['ArrowUp'] || keys['w'] || keys['W']) ay -= 1;
    if (keys['ArrowDown'] || keys['s'] || keys['S']) ay += 1;

    // also move toward click/touch
    if (mouse.down) {
      const dx = mouse.x - p.x, dy = mouse.y - p.y;
      const dd = Math.hypot(dx, dy);
      if (dd > 10) { ax += dx / dd; ay += dy / dd; }
    }

    const mag = Math.hypot(ax, ay);
    if (mag > 0) { ax /= mag; ay /= mag; }
    p.vx += ax * p.speed * 3 * dt;
    p.vy += ay * p.speed * 3 * dt;
    p.vx *= 0.9;
    p.vy *= 0.9;
    p.x = clamp(p.x + p.vx * dt, p.r, W - p.r);
    p.y = clamp(p.y + p.vy * dt, p.r, H - p.r);

    // trail
    if (QA.quality >= 0.75 && Math.hypot(p.vx, p.vy) > 20) {
      d.trailPoints.push({ x: p.x, y: p.y, life: 0.4 });
    }
    for (let i = d.trailPoints.length - 1; i >= 0; i--) {
      d.trailPoints[i].life -= dt;
      if (d.trailPoints[i].life <= 0) d.trailPoints.splice(i, 1);
    }

    // spawn more photons
    d.spawnTimer += dt;
    if (d.spawnTimer > 2 && d.photons.length < 10) {
      d.spawnTimer = 0;
      d.photons.push(makePhoton(d.isLepton));
    }

    // photon movement (curved if lepton)
    for (const ph of d.photons) {
      if (d.isLepton) {
        ph.angle += ph.angVel * dt;
        ph.x += Math.cos(ph.angle) * ph.speed * dt;
        ph.y += Math.sin(ph.angle) * ph.speed * dt;
      } else {
        ph.x += ph.vx * dt;
        ph.y += ph.vy * dt;
      }
      // wrap
      if (ph.x < -20) ph.x = W + 20;
      if (ph.x > W + 20) ph.x = -20;
      if (ph.y < -20) ph.y = H + 20;
      if (ph.y > H + 20) ph.y = -20;
      ph.pulse += dt * 4;
    }

    // disruptor movement
    for (const dr of d.disruptors) {
      dr.angle += dr.angVel * dt;
      dr.x += Math.cos(dr.angle) * dr.speed * dt;
      dr.y += Math.sin(dr.angle) * dr.speed * dt;
      if (dr.x < 0 || dr.x > W) dr.angle = Math.PI - dr.angle;
      if (dr.y < 0 || dr.y > H) dr.angle = -dr.angle;
      dr.x = clamp(dr.x, 0, W);
      dr.y = clamp(dr.y, 0, H);
      dr.pulse += dt * 5;
    }

    // collect photons
    for (let i = d.photons.length - 1; i >= 0; i--) {
      if (dist(p.x, p.y, d.photons[i].x, d.photons[i].y) < p.r + 8) {
        burstFx(d.photons[i].x, d.photons[i].y, 10, d.photons[i].color, 40);
        d.photons.splice(i, 1);
        d.collected++;
        state.taskScore += 50 + state.streak * 10;
        state.streak++;
      }
    }

    // hit disruptors
    for (const dr of d.disruptors) {
      if (dist(p.x, p.y, dr.x, dr.y) < p.r + dr.r) {
        state.integrity--;
        state.streak = 0;
        burstFx(p.x, p.y, 15, '#ff3333', 60);
        p.x = W / 2; p.y = H / 2;
        p.vx = p.vy = 0;
        if (state.integrity <= 0) return 'fail';
        break;
      }
    }

    if (d.collected >= d.target) return 'complete';
  },
  draw(c) {
    const d = state.taskData;

    // trail
    for (const t of d.trailPoints) {
      c.globalAlpha = t.life;
      c.fillStyle = '#4fc3f7';
      c.beginPath();
      c.arc(t.x, t.y, 4 * t.life, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;

    // photons
    for (const ph of d.photons) {
      const pr = 6 + Math.sin(ph.pulse) * 2;
      c.fillStyle = ph.color;
      c.shadowColor = ph.color;
      c.shadowBlur = QA.quality >= 0.75 ? 10 : 0;
      c.beginPath();
      c.arc(ph.x, ph.y, pr, 0, Math.PI * 2);
      c.fill();

      // lepton track
      if (d.isLepton && QA.quality >= 0.5) {
        c.strokeStyle = ph.color + '40';
        c.lineWidth = 1;
        c.beginPath();
        for (let t = 0; t < 30; t++) {
          const a = ph.angle - ph.angVel * t * 0.05;
          const tx = ph.x - Math.cos(a) * ph.speed * t * 0.05;
          const ty = ph.y - Math.sin(a) * ph.speed * t * 0.05;
          t === 0 ? c.moveTo(tx, ty) : c.lineTo(tx, ty);
        }
        c.stroke();
      }
      c.shadowBlur = 0;
    }

    // disruptors
    for (const dr of d.disruptors) {
      const pr = dr.r + Math.sin(dr.pulse) * 2;
      c.fillStyle = '#ff3333';
      c.globalAlpha = 0.7;
      c.beginPath();
      c.arc(dr.x, dr.y, pr, 0, Math.PI * 2);
      c.fill();
      // spikes
      c.strokeStyle = '#ff3333';
      c.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI * 2 / 6) * i + dr.pulse * 0.5;
        c.beginPath();
        c.moveTo(dr.x + Math.cos(a) * pr, dr.y + Math.sin(a) * pr);
        c.lineTo(dr.x + Math.cos(a) * (pr + 8), dr.y + Math.sin(a) * (pr + 8));
        c.stroke();
      }
      c.globalAlpha = 1;
    }

    // player
    const p = d.player;
    c.fillStyle = '#4fc3f7';
    c.shadowColor = '#4fc3f7';
    c.shadowBlur = QA.quality >= 0.75 ? 15 : 0;
    c.beginPath();
    c.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    c.fill();
    c.shadowBlur = 0;

    // collection counter
    c.fillStyle = '#888';
    c.font = '14px system-ui';
    c.textAlign = 'center';
    c.fillText(`Collected: ${d.collected} / ${d.target}`, W / 2, H - 30);
    c.textAlign = 'start';
  },
  cleanup() { state.taskData = {}; }
  };
}
tasks.collect = createCollectTask();
tasks.collect2 = createCollectTask();

function makePhoton(isLepton) {
  const colors = ['#4fc3f7', '#66bb6a', '#fdd835', '#ab47bc', '#81d4fa'];
  return {
    x: Math.random() * W,
    y: Math.random() * H,
    vx: (Math.random() - 0.5) * 40,
    vy: (Math.random() - 0.5) * 40,
    angle: Math.random() * Math.PI * 2,
    angVel: (Math.random() - 0.5) * 2,
    speed: 30 + Math.random() * 40,
    pulse: Math.random() * Math.PI * 2,
    color: colors[Math.floor(Math.random() * colors.length)],
  };
}
function makeDisruptor() {
  return {
    x: Math.random() * W,
    y: Math.random() * H,
    r: 10,
    angle: Math.random() * Math.PI * 2,
    angVel: (Math.random() - 0.5) * 1.5,
    speed: 40 + Math.random() * 30,
    pulse: 0,
  };
}

// ─── TRAIT ALLOCATE (AGI Breeder mechanic) ───────────────
function createAllocateTask() {
  return {
  setup(isRisk) {
    const d = state.taskData;
    d.traits = ['Capability', 'Alignment', 'Resilience', 'Creativity', 'Awareness'];
    d.targets = d.traits.map(() => Math.floor(Math.random() * 80) + 10);
    d.current = d.traits.map(() => 0);
    d.totalPts = d.targets.reduce((a, b) => a + b, 0);
    d.ptsLeft = d.totalPts;
    d.isRisk = isRisk;
    d.riskPenalty = 0;
    d.submitted = false;
    d.traitColors = ['#4fc3f7', '#66bb6a', '#fdd835', '#ff7043', '#ab47bc'];

    // build DOM rows
    const container = $('trait-rows');
    container.innerHTML = '';
    for (let i = 0; i < d.traits.length; i++) {
      const row = document.createElement('div');
      row.className = 'trait-row';
      row.innerHTML = `
        <span class="trait-label">${d.traits[i]}</span>
        <div class="trait-bar-bg" data-idx="${i}">
          <div class="trait-bar-fill" style="width:0%;background:${d.traitColors[i]}"></div>
          <div class="trait-bar-target" style="left:${d.targets[i]}%"></div>
        </div>
      `;
      container.appendChild(row);
    }

    // click handler
    d._clickHandler = (e) => {
      const bar = e.target.closest('.trait-bar-bg');
      if (!bar) return;
      const idx = parseInt(bar.dataset.idx);
      const rect = bar.getBoundingClientRect();
      const pct = clamp((e.clientX - rect.left) / rect.width * 100, 0, 100);
      const newVal = Math.round(pct);
      const diff = newVal - d.current[idx];
      if (diff > d.ptsLeft && diff > 0) return;
      d.current[idx] = newVal;
      d.ptsLeft = d.totalPts - d.current.reduce((a, b) => a + b, 0);
      bar.querySelector('.trait-bar-fill').style.width = newVal + '%';
      $('alloc-pts').textContent = Math.max(0, d.ptsLeft);
      // accuracy
      const acc = computeAllocAccuracy(d);
      $('alloc-acc').textContent = Math.round(acc * 100) + '%';
    };
    document.addEventListener('click', d._clickHandler);

    $('alloc-pts').textContent = d.ptsLeft;
    $('alloc-acc').textContent = '0%';
    showPanel('allocate-overlay');
    $('hud').classList.remove('hidden');
  },
  update(dt) {
    const d = state.taskData;
    if (d.submitted) {
      const acc = computeAllocAccuracy(d);
      state.taskScore = Math.round(acc * 500);
      if (d.isRisk) {
        // penalty for overshoot
        for (let i = 0; i < d.traits.length; i++) {
          if (d.current[i] > d.targets[i] + 10) {
            state.taskScore = Math.max(0, state.taskScore - 50);
            state.integrity--;
          }
        }
      }
      if (acc > 0.7) {
        burstFx(W / 2, H / 2, 25, '#66bb6a', 80);
        return 'complete';
      } else {
        return 'fail';
      }
    }
  },
  draw(c) {
    // drawn via DOM overlay; just draw entity in background
  },
  cleanup() {
    const d = state.taskData;
    if (d._clickHandler) document.removeEventListener('click', d._clickHandler);
    $('allocate-overlay').classList.add('hidden');
    state.taskData = {};
  }
  };
}
tasks.allocate = createAllocateTask();
tasks.allocate2 = createAllocateTask();

function computeAllocAccuracy(d) {
  let totalDiff = 0;
  for (let i = 0; i < d.traits.length; i++) {
    totalDiff += Math.abs(d.current[i] - d.targets[i]);
  }
  const maxDiff = d.traits.length * 100;
  return 1 - totalDiff / maxDiff;
}

// Submit button for allocate
$('btn-alloc-submit').addEventListener('click', () => {
  state.taskData.submitted = true;
});

// ─── BEACON ANCHOR (Unsupervised AGI 3D mechanic) ───────
function createBeaconTask() {
  return {
  setup(isCascade) {
    const d = state.taskData;
    d.field = { stability: 50, maxStability: 100 };
    d.beacons = [];
    d.ripples = [];
    d.ruptures = [];
    d.isCascade = isCascade;
    d.fieldPulse = 0;
    d.ruptureCooldown = 0;
    d.targetStability = 90;
    d.holdTimer = 0;
    d.holdReq = isCascade ? 6 : 4;
    d.fieldNoise = [];
    // pre-compute field noise seed
    for (let i = 0; i < 20; i++) {
      d.fieldNoise.push({ x: Math.random() * W, y: Math.random() * H, phase: Math.random() * Math.PI * 2, r: 30 + Math.random() * 50 });
    }
  },
  update(dt) {
    const d = state.taskData;
    d.fieldPulse += dt;

    // field decay
    d.field.stability -= dt * (d.isCascade ? 8 : 5);

    // spawn ruptures
    d.ruptureCooldown -= dt;
    if (d.ruptureCooldown <= 0 && d.ruptures.length < (d.isCascade ? 3 : 2)) {
      d.ruptureCooldown = 2 + Math.random() * 2;
      d.ruptures.push({
        x: 60 + Math.random() * (W - 120),
        y: 60 + Math.random() * (H - 120),
        r: 15,
        growRate: d.isCascade ? 12 : 8,
        life: 0,
        maxLife: 5,
      });
    }

    // grow ruptures
    for (let i = d.ruptures.length - 1; i >= 0; i--) {
      const rup = d.ruptures[i];
      rup.life += dt;
      rup.r += rup.growRate * dt;
      d.field.stability -= rup.growRate * 0.3 * dt;
      if (rup.life > rup.maxLife) d.ruptures.splice(i, 1);
    }

    // place beacon on click
    if (mouse.clicked && d.beacons.length < 20) {
      const bx = mouse.x, by = mouse.y;
      d.beacons.push({ x: bx, y: by, life: 0, maxLife: 4, r: 6, strength: 20 });
      burstFx(bx, by, 8, '#4fc3f7', 30);

      // check for rupture coverage (combo)
      for (let i = d.ruptures.length - 1; i >= 0; i--) {
        if (dist(bx, by, d.ruptures[i].x, d.ruptures[i].y) < d.ruptures[i].r + 30) {
          d.field.stability = Math.min(d.field.maxStability, d.field.stability + 15);
          burstFx(d.ruptures[i].x, d.ruptures[i].y, 15, '#66bb6a', 50);
          d.ruptures.splice(i, 1);
          state.taskScore += 100;
          state.streak++;
        }
      }

      // ripple
      d.ripples.push({ x: bx, y: by, r: 5, maxR: 80, life: 0 });
    }

    // beacon decay + stabilize
    for (let i = d.beacons.length - 1; i >= 0; i--) {
      const b = d.beacons[i];
      b.life += dt;
      d.field.stability = Math.min(d.field.maxStability, d.field.stability + b.strength * 0.1 * dt);
      if (b.life > b.maxLife) d.beacons.splice(i, 1);
    }

    // ripples
    for (let i = d.ripples.length - 1; i >= 0; i--) {
      d.ripples[i].life += dt;
      d.ripples[i].r += 60 * dt;
      if (d.ripples[i].r >= d.ripples[i].maxR) d.ripples.splice(i, 1);
    }

    // field noise animation
    for (const n of d.fieldNoise) {
      n.phase += dt * 1.5;
    }

    d.field.stability = clamp(d.field.stability, 0, d.field.maxStability);

    if (d.field.stability <= 0) {
      state.integrity--;
      if (state.integrity <= 0) return 'fail';
      d.field.stability = 30;
    }

    // win: hold above target
    if (d.field.stability >= d.targetStability) {
      d.holdTimer += dt;
      if (d.holdTimer >= d.holdReq) {
        state.taskScore += 300;
        return 'complete';
      }
    } else {
      d.holdTimer = Math.max(0, d.holdTimer - dt * 0.5);
    }
  },
  draw(c) {
    const d = state.taskData;

    // field noise blobs
    for (const n of d.fieldNoise) {
      const a = 0.03 + Math.sin(n.phase) * 0.02;
      c.globalAlpha = a;
      c.fillStyle = d.field.stability > d.targetStability ? '#66bb6a' : '#4fc3f7';
      c.beginPath();
      c.arc(n.x, n.y, n.r + Math.sin(n.phase) * 10, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;

    // ruptures
    for (const rup of d.ruptures) {
      c.strokeStyle = '#ff3333';
      c.lineWidth = 2;
      c.globalAlpha = 0.6 + Math.sin(d.fieldPulse * 5) * 0.2;
      c.beginPath();
      c.arc(rup.x, rup.y, rup.r, 0, Math.PI * 2);
      c.stroke();

      // inner distortion
      c.fillStyle = '#ff333320';
      c.beginPath();
      c.arc(rup.x, rup.y, rup.r, 0, Math.PI * 2);
      c.fill();
      c.globalAlpha = 1;
    }

    // ripples
    for (const rip of d.ripples) {
      const a = 1 - rip.r / rip.maxR;
      c.strokeStyle = '#4fc3f7';
      c.globalAlpha = a * 0.5;
      c.lineWidth = 2;
      c.beginPath();
      c.arc(rip.x, rip.y, rip.r, 0, Math.PI * 2);
      c.stroke();
    }
    c.globalAlpha = 1;

    // beacons
    for (const b of d.beacons) {
      const fade = 1 - b.life / b.maxLife;
      c.fillStyle = '#4fc3f7';
      c.globalAlpha = fade;
      c.shadowColor = '#4fc3f7';
      c.shadowBlur = QA.quality >= 0.75 ? 8 : 0;
      c.beginPath();
      c.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      c.fill();
      c.shadowBlur = 0;

      // anchor ring
      c.strokeStyle = '#4fc3f7';
      c.lineWidth = 1;
      c.beginPath();
      c.arc(b.x, b.y, b.r * 3 * fade, 0, Math.PI * 2);
      c.stroke();
    }
    c.globalAlpha = 1;

    // stability bar
    const barW = 200, barH = 10;
    const bx = W / 2 - barW / 2, by = H - 50;
    c.fillStyle = '#222';
    c.fillRect(bx, by, barW, barH);
    const pct = d.field.stability / d.field.maxStability;
    c.fillStyle = pct > 0.8 ? '#66bb6a' : pct > 0.4 ? '#fdd835' : '#ff3333';
    c.fillRect(bx, by, barW * pct, barH);

    // target line
    const tx = bx + barW * (d.targetStability / d.field.maxStability);
    c.strokeStyle = '#fff';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(tx, by - 3);
    c.lineTo(tx, by + barH + 3);
    c.stroke();

    // hold timer
    c.fillStyle = '#888';
    c.font = '11px system-ui';
    c.textAlign = 'center';
    c.fillText(`Stability: ${Math.round(d.field.stability)}% — Hold above ${d.targetStability}% (${d.holdTimer.toFixed(1)}/${d.holdReq}s)`, W / 2, by - 8);
    c.textAlign = 'start';
  },
  cleanup() { state.taskData = {}; }
  };
}
tasks.beacon = createBeaconTask();
tasks.beacon2 = createBeaconTask();

// ─── THERMAL DRIFT (physics ship mechanic) ──────────────
tasks.drift = {
  setup() {
    const d = state.taskData;
    d.ship = { x: W / 2, y: H / 2, angle: -Math.PI / 2, speed: 0, vx: 0, vy: 0 };
    d.crystals = [];
    d.collected = 0;
    d.target = 12;
    d.thrustTrail = [];

    for (let i = 0; i < 8; i++) {
      d.crystals.push({
        x: 50 + Math.random() * (W - 100),
        y: 50 + Math.random() * (H - 100),
        r: 6,
        pulse: Math.random() * Math.PI * 2,
        color: '#81d4fa',
      });
    }
  },
  update(dt) {
    const d = state.taskData;
    const s = d.ship;

    // rotate (keyboard + mobile joystick)
    if (keys['ArrowLeft'] || keys['a'] || keys['A'] || mobileState.joyX < -0.3) s.angle -= 3 * dt;
    if (keys['ArrowRight'] || keys['d'] || keys['D'] || mobileState.joyX > 0.3) s.angle += 3 * dt;

    // thrust (keyboard + mouse + mobile button)
    const thrusting = keys['ArrowUp'] || keys['w'] || keys['W'] || mouse.down || mobileState.thrusting || mobileState.joyY < -0.3;
    if (thrusting) {
      s.vx += Math.cos(s.angle) * 200 * dt;
      s.vy += Math.sin(s.angle) * 200 * dt;

      // thrust particles (capped to prevent unbounded growth)
      if (QA.quality >= 0.5 && d.thrustTrail.length < 80) {
        d.thrustTrail.push({
          x: s.x - Math.cos(s.angle) * 15,
          y: s.y - Math.sin(s.angle) * 15,
          vx: -Math.cos(s.angle) * 60 + (Math.random() - 0.5) * 30,
          vy: -Math.sin(s.angle) * 60 + (Math.random() - 0.5) * 30,
          life: 0.3 + Math.random() * 0.2,
        });
      }
    }

    // friction
    s.vx *= 0.985;
    s.vy *= 0.985;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.speed = Math.hypot(s.vx, s.vy);

    // wrap
    if (s.x < -20) s.x = W + 20;
    if (s.x > W + 20) s.x = -20;
    if (s.y < -20) s.y = H + 20;
    if (s.y > H + 20) s.y = -20;

    // thrust trail decay
    for (let i = d.thrustTrail.length - 1; i >= 0; i--) {
      const t = d.thrustTrail[i];
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.life -= dt;
      if (t.life <= 0) d.thrustTrail.splice(i, 1);
    }

    // crystals
    for (const cr of d.crystals) cr.pulse += dt * 3;
    for (let i = d.crystals.length - 1; i >= 0; i--) {
      if (dist(s.x, s.y, d.crystals[i].x, d.crystals[i].y) < 20) {
        burstFx(d.crystals[i].x, d.crystals[i].y, 12, '#81d4fa', 40);
        d.crystals.splice(i, 1);
        d.collected++;
        state.taskScore += 80;
        state.streak++;
        // spawn replacement
        if (d.crystals.length < 5) {
          d.crystals.push({
            x: 50 + Math.random() * (W - 100),
            y: 50 + Math.random() * (H - 100),
            r: 6, pulse: 0, color: '#81d4fa',
          });
        }
      }
    }

    if (d.collected >= d.target) return 'complete';
  },
  draw(c) {
    const d = state.taskData;
    const s = d.ship;

    // thrust trail
    for (const t of d.thrustTrail) {
      c.globalAlpha = t.life * 2;
      c.fillStyle = '#ff7043';
      c.beginPath();
      c.arc(t.x, t.y, 2 + t.life * 3, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;

    // crystals
    for (const cr of d.crystals) {
      const pr = cr.r + Math.sin(cr.pulse) * 2;
      c.fillStyle = cr.color;
      c.shadowColor = cr.color;
      c.shadowBlur = QA.quality >= 0.75 ? 10 : 0;

      // hexagonal crystal shape
      c.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI * 2 / 6) * i + cr.pulse * 0.3;
        const method = i === 0 ? 'moveTo' : 'lineTo';
        c[method](cr.x + Math.cos(a) * pr, cr.y + Math.sin(a) * pr);
      }
      c.closePath();
      c.fill();
      c.shadowBlur = 0;
    }

    // ship
    c.save();
    c.translate(s.x, s.y);
    c.rotate(s.angle);

    // ship body (triangle)
    c.fillStyle = '#4fc3f7';
    c.shadowColor = '#4fc3f7';
    c.shadowBlur = QA.quality >= 0.75 ? 12 : 0;
    c.beginPath();
    c.moveTo(16, 0);
    c.lineTo(-10, -9);
    c.lineTo(-6, 0);
    c.lineTo(-10, 9);
    c.closePath();
    c.fill();
    c.shadowBlur = 0;

    c.restore();

    // speed readout
    c.fillStyle = '#888';
    c.font = '11px system-ui';
    c.textAlign = 'center';
    c.fillText(`Crystals: ${d.collected}/${d.target}  Speed: ${Math.round(s.speed)}`, W / 2, H - 30);
    c.textAlign = 'start';
  },
  cleanup() { state.taskData = {}; }
};

// ─── KNOWLEDGE QUIZ (Science Lab mechanic) ──────────────
tasks.quiz = {
  setup() {
    const d = state.taskData;
    d.questions = generateQuestions(8);
    d.current = 0;
    d.answered = 0;
    d.correct = 0;
    d.showResult = 0;
    d.selectedAnswer = -1;
    d.orbs = [];
    for (let i = 0; i < d.questions.length; i++) {
      const angle = (Math.PI * 2 / d.questions.length) * i;
      d.orbs.push({
        x: W / 2 + Math.cos(angle) * 140,
        y: H / 2 + Math.sin(angle) * 140,
        state: 'locked', // locked, active, correct, wrong
        pulse: Math.random() * Math.PI * 2,
      });
    }
    d.orbs[0].state = 'active';
  },
  update(dt) {
    const d = state.taskData;

    // animate orbs
    for (const orb of d.orbs) orb.pulse += dt * 2;

    if (d.showResult > 0) {
      d.showResult -= dt;
      if (d.showResult <= 0) {
        d.current++;
        if (d.current >= d.questions.length) {
          state.taskScore = d.correct * 100;
          return d.correct >= 5 ? 'complete' : 'fail';
        }
        d.orbs[d.current].state = 'active';
        d.selectedAnswer = -1;
      }
      return;
    }

    // click answers (mapped to canvas quadrants around entity)
    if (mouse.clicked) {
      const q = d.questions[d.current];
      for (let i = 0; i < q.options.length; i++) {
        const ox = W / 2 + (i % 2 === 0 ? -120 : 120);
        const oy = H / 2 + (i < 2 ? -60 : 60) + 30;
        if (dist(mouse.x, mouse.y, ox, oy) < 50) {
          d.selectedAnswer = i;
          const correct = i === q.answer;
          d.orbs[d.current].state = correct ? 'correct' : 'wrong';
          if (correct) {
            d.correct++;
            state.streak++;
            burstFx(ox, oy, 15, '#66bb6a', 50);
          } else {
            state.streak = 0;
            burstFx(ox, oy, 10, '#ff3333', 30);
          }
          d.showResult = 1.2;
          break;
        }
      }
    }

    // also keyboard 1-4
    for (let k = 1; k <= 4; k++) {
      if (keys['' + k]) {
        keys['' + k] = false;
        const q = d.questions[d.current];
        const i = k - 1;
        if (i < q.options.length) {
          d.selectedAnswer = i;
          const correct = i === q.answer;
          d.orbs[d.current].state = correct ? 'correct' : 'wrong';
          if (correct) {
            d.correct++;
            state.streak++;
            burstFx(W / 2, H / 2, 15, '#66bb6a', 50);
          } else {
            state.streak = 0;
            burstFx(W / 2, H / 2, 10, '#ff3333', 30);
          }
          d.showResult = 1.2;
        }
      }
    }
  },
  draw(c) {
    const d = state.taskData;
    const q = d.questions[d.current];

    // knowledge orbs ring
    for (let i = 0; i < d.orbs.length; i++) {
      const orb = d.orbs[i];
      const r = 8 + Math.sin(orb.pulse) * 2;
      c.fillStyle = orb.state === 'correct' ? '#66bb6a' :
                    orb.state === 'wrong' ? '#ff3333' :
                    orb.state === 'active' ? '#fdd835' : '#333';
      c.globalAlpha = orb.state === 'locked' ? 0.3 : 0.9;
      c.beginPath();
      c.arc(orb.x, orb.y, r, 0, Math.PI * 2);
      c.fill();

      if (orb.state === 'active') {
        c.strokeStyle = '#fdd835';
        c.lineWidth = 1.5;
        c.beginPath();
        c.arc(orb.x, orb.y, r + 5, 0, Math.PI * 2);
        c.stroke();
      }
    }
    c.globalAlpha = 1;

    // question text
    c.fillStyle = '#e0e0e0';
    c.font = '16px system-ui';
    c.textAlign = 'center';
    c.fillText(q.question, W / 2, H / 2 - 100);

    // progress
    c.fillStyle = '#666';
    c.font = '11px system-ui';
    c.fillText(`Question ${d.current + 1} of ${d.questions.length}`, W / 2, H / 2 - 120);

    // answer boxes
    for (let i = 0; i < q.options.length; i++) {
      const ox = W / 2 + (i % 2 === 0 ? -120 : 120);
      const oy = H / 2 + (i < 2 ? -60 : 60) + 30;

      const selected = d.selectedAnswer === i;
      const isAnswer = i === q.answer;
      const showing = d.showResult > 0;

      c.fillStyle = showing && isAnswer ? '#66bb6a30' :
                    showing && selected && !isAnswer ? '#ff333330' :
                    'rgba(255,255,255,0.05)';
      c.strokeStyle = showing && isAnswer ? '#66bb6a' :
                      showing && selected ? '#ff3333' : '#4fc3f740';
      c.lineWidth = 1.5;

      // rounded rect
      const bw = 100, bh = 36;
      c.beginPath();
      c.roundRect(ox - bw / 2, oy - bh / 2, bw, bh, 6);
      c.fill();
      c.stroke();

      c.fillStyle = '#e0e0e0';
      c.font = '13px system-ui';
      c.fillText(`[${i + 1}] ${q.options[i]}`, ox, oy + 4);
    }

    c.textAlign = 'start';

    // score
    c.fillStyle = '#888';
    c.font = '12px system-ui';
    c.fillText(`Correct: ${d.correct}/${d.answered + d.current}`, 20, H - 30);
  },
  cleanup() { state.taskData = {}; }
};

function generateQuestions(n) {
  const bank = [
    { question: 'Which force binds electrons to nuclei?', options: ['Gravity', 'Electromagnetic', 'Strong Nuclear', 'Weak Nuclear'], answer: 1 },
    { question: 'What is the charge of an electron?', options: ['+1', '-1', '0', '+2'], answer: 1 },
    { question: 'Which particle has no charge?', options: ['Proton', 'Electron', 'Neutron', 'Positron'], answer: 2 },
    { question: 'What letter represents the speed of light?', options: ['v', 's', 'c', 'l'], answer: 2 },
    { question: 'Photons are carriers of which force?', options: ['Gravity', 'Strong', 'Electromagnetic', 'Higgs'], answer: 2 },
    { question: 'How many quarks in a proton?', options: ['1', '2', '3', '4'], answer: 2 },
    { question: 'What is an atom\'s smallest unit?', options: ['Molecule', 'Quark', 'Cell', 'Atom'], answer: 1 },
    { question: 'Which element has atomic number 1?', options: ['Helium', 'Hydrogen', 'Lithium', 'Carbon'], answer: 1 },
    { question: 'Antimatter of an electron is called?', options: ['Neutron', 'Muon', 'Positron', 'Photon'], answer: 2 },
    { question: 'Leptons include which particle?', options: ['Proton', 'Neutron', 'Electron', 'Pion'], answer: 2 },
    { question: 'What does E=mc² describe?', options: ['Momentum', 'Energy-mass', 'Acceleration', 'Entropy'], answer: 1 },
    { question: 'Which orbital shape is spherical?', options: ['p', 'd', 's', 'f'], answer: 2 },
  ];
  // shuffle and pick n
  const shuffled = bank.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, shuffled.length));
}

// ─── GAUNTLET / EVOLVE / FREERUN (mixed mechanics) ──────
tasks.gauntlet = tasks.evolve = tasks.freerun = {
  setup() {
    // combines collect + beacon + classify in alternating phases
    const d = state.taskData;
    d.phase = 0; // 0=collect, 1=classify, 2=beacon, loops
    d.phaseTimer = 0;
    d.phaseDuration = 10;
    d.totalScore = 0;

    // init first sub-phase
    tasks.collect.setup(false);
  },
  update(dt) {
    const d = state.taskData;
    d.phaseTimer += dt;

    const subTasks = [tasks.collect, tasks.classify, tasks.beacon];
    const result = subTasks[d.phase % 3].update(dt);

    if (result === 'complete' || d.phaseTimer >= d.phaseDuration) {
      d.totalScore += state.taskScore;
      burstFx(W / 2, H / 2, 25, '#fdd835', 80);

      subTasks[d.phase % 3].cleanup();
      d.phase++;
      d.phaseTimer = 0;
      state.taskScore = 0;

      if (d.phase >= 3) {
        state.taskScore = d.totalScore;
        return 'complete';
      }

      // init next sub-phase
      const nextPhase = d.phase % 3;
      if (nextPhase === 0) tasks.collect.setup(false);
      else if (nextPhase === 1) tasks.classify.setup(false);
      else tasks.beacon.setup(false);
    }

    if (result === 'fail') return 'fail';
  },
  draw(c) {
    const d = state.taskData;
    const subTasks = [tasks.collect, tasks.classify, tasks.beacon];
    subTasks[d.phase % 3].draw(c);

    // phase indicator
    c.fillStyle = '#888';
    c.font = '12px system-ui';
    c.textAlign = 'center';
    const phaseNames = ['Collect', 'Classify', 'Stabilize'];
    c.fillText(`Phase ${d.phase + 1}/3: ${phaseNames[d.phase % 3]}`, W / 2, 60);
    c.textAlign = 'start';
  },
  cleanup() {
    const d = state.taskData;
    const subTasks = [tasks.collect, tasks.classify, tasks.beacon];
    try { subTasks[d.phase % 3].cleanup(); } catch(e) {}
    state.taskData = {};
  }
};

// ═══════════════════════════════════════════════════════
// MAIN GAME FLOW
// ═══════════════════════════════════════════════════════

function startGame() {
  state.phase = 'hub';
  state.xp = 0;
  state.tier = 1;
  state.score = 0;
  state.streak = 0;
  state.integrity = state.maxIntegrity;
  state.completedTasks = new Set();
  state.currentTask = null;
  state.runs++;
  state.sessionStart = Date.now();
  state.sessionTime = 0;
  entity.init();
  entity.tier = 1;
  spawnAmbient(40);
  showHub();
}

function showHub() {
  state.phase = 'hub';
  $('hud').classList.add('hidden');

  // compute tier
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (state.xp >= TIERS[i].xpReq) { state.tier = i + 1; break; }
  }
  entity.tier = state.tier;

  $('hub-entity-name').textContent = TIERS[state.tier - 1].name;
  $('hub-xp').textContent = state.xp;
  $('hub-tier').textContent = state.tier;
  $('hub-tasks').textContent = state.completedTasks.size + '/' + TASKS.length;

  // evo bar
  const tierIdx = Math.min(state.tier, TIERS.length - 1);
  const nextTier = TIERS[tierIdx];
  const prevTier = TIERS[state.tier - 1];
  const tierRange = nextTier.xpReq - prevTier.xpReq;
  const pct = state.tier >= TIERS.length ? 100 :
    tierRange > 0 ? ((state.xp - prevTier.xpReq) / tierRange) * 100 : 0;
  $('evo-fill').style.width = Math.min(100, pct) + '%';

  // task list
  const list = $('task-list');
  list.innerHTML = '';
  for (const t of TASKS) {
    const card = document.createElement('div');
    const locked = t.tier > state.tier;
    const done = state.completedTasks.has(t.id);
    card.className = 'task-card' + (locked ? ' locked' : '') + (done ? ' completed' : '');
    card.innerHTML = `
      <div class="task-tier">Tier ${t.tier} ${done ? '✓' : locked ? '🔒' : ''}</div>
      <div class="task-name">${t.name}</div>
      <div class="task-desc">${t.desc}</div>
    `;
    if (!locked) {
      card.addEventListener('click', () => showBriefing(t));
    }
    list.appendChild(card);
  }

  showPanel('hub-panel');
}

function showBriefing(task) {
  state.currentTask = task;
  $('brief-name').textContent = task.name;
  $('brief-desc').textContent = task.desc;
  $('brief-time').textContent = task.time > 0 ? task.time + 's' : '∞';
  $('brief-diff').textContent = '★'.repeat(task.tier);
  showPanel('brief-panel');
}

function launchTask() {
  const task = state.currentTask;
  state.phase = 'playing';
  state.taskTimer = 0;
  state.taskScore = 0;
  state.integrity = state.maxIntegrity;
  state.taskData = {};

  showPanel(null);
  $('hud').classList.remove('hidden');

  // dispatch to task handler
  const id = task.id;
  const handler = getTaskHandler(id);
  const isAdvanced = id.endsWith('2');
  handler.setup(isAdvanced);

  // show appropriate mobile controls
  updateMobileControls();
}

function getTaskHandler(id) {
  // strip trailing 2 for shared implementations
  const base = id.replace(/2$/, '');
  return tasks[base] || tasks.collect; // fallback
}

function finishTask(outcome) {
  state.phase = 'result';
  const xpGain = outcome === 'complete'
    ? 100 + state.taskScore + state.streak * 10
    : Math.floor(state.taskScore * 0.3);

  state.xp += xpGain;
  if (state.xp > state.bestXP) state.bestXP = state.xp;

  // Track session time (seconds since run started)
  state.sessionTime = Math.floor((Date.now() - state.sessionStart) / 1000);
  if (state.sessionTime > state.longestSession) state.longestSession = state.sessionTime;

  // Track best streak
  if (state.streak > state.bestStreak) state.bestStreak = state.streak;

  if (outcome === 'complete') {
    state.completedTasks.add(state.currentTask.id);
    burstFx(W / 2, H / 2, 30, '#66bb6a', 100);
  }

  // Track highest tasks completed in a single run
  if (state.completedTasks.size > state.highestTasks) {
    state.highestTasks = state.completedTasks.size;
  }

  // cleanup task handler
  const handler = getTaskHandler(state.currentTask.id);
  handler.cleanup();

  save();

  $('result-title').textContent = outcome === 'complete' ? 'Task Complete!' : 'Task Failed';
  $('result-msg').textContent = outcome === 'complete'
    ? 'Well done. Your entity grows stronger.'
    : 'The entity falters. Try again.';
  $('result-score').textContent = state.taskScore;
  $('result-xp').textContent = '+' + xpGain;
  $('result-streak').textContent = state.streak;
  showPanel('result-panel');
  $('hud').classList.add('hidden');
  hideMobileControls();

  // async cloud save (non-blocking)
  saveToCloud();
}

// ─── DOM EVENT WIRING ───────────────────────────────────
$('btn-start').addEventListener('click', startGame);
$('btn-launch').addEventListener('click', launchTask);
$('btn-back').addEventListener('click', showHub);
$('btn-continue').addEventListener('click', showHub);
$('btn-leaderboard').addEventListener('click', () => showLeaderboard());
$('btn-lb-close').addEventListener('click', showHub);

// ─── MOBILE CONTROLS ───────────────────────────────────
const mobileClassify = $('mobile-classify');
const mobileJoystick = $('mobile-joystick');
const joystickKnob = $('joystick-knob');
const joystickRing = mobileJoystick?.querySelector('.joystick-ring');
const mobileState = { joyX: 0, joyY: 0, thrusting: false, joyActive: false };

// Classify buttons (for signal tasks on touch)
if (mobileClassify) {
  mobileClassify.querySelectorAll('.mobile-btn').forEach(btn => {
    btn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const type = parseInt(btn.dataset.type);
      keys['' + (type + 1)] = true;
      setTimeout(() => { keys['' + (type + 1)] = false; }, 100);
    }, { passive: false });
  });
}

// Joystick (for drift + collect tasks on touch)
if (joystickRing) {
  let joyRect = null;
  joystickRing.addEventListener('touchstart', (e) => {
    e.preventDefault();
    mobileState.joyActive = true;
    joyRect = joystickRing.getBoundingClientRect();
    handleJoyMove(e.touches[0]);
  }, { passive: false });
  joystickRing.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (mobileState.joyActive && joyRect) handleJoyMove(e.touches[0]);
  }, { passive: false });
  const endJoy = () => {
    mobileState.joyActive = false;
    mobileState.joyX = 0; mobileState.joyY = 0;
    if (joystickKnob) joystickKnob.style.transform = 'translate(-50%, -50%)';
  };
  joystickRing.addEventListener('touchend', endJoy);
  joystickRing.addEventListener('touchcancel', endJoy);

  function handleJoyMove(touch) {
    const cx = joyRect.left + joyRect.width / 2;
    const cy = joyRect.top + joyRect.height / 2;
    const dx = touch.clientX - cx;
    const dy = touch.clientY - cy;
    const maxDist = joyRect.width / 2 - 18;
    const dist = Math.min(Math.hypot(dx, dy), maxDist);
    const angle = Math.atan2(dy, dx);
    mobileState.joyX = (dist / maxDist) * Math.cos(angle);
    mobileState.joyY = (dist / maxDist) * Math.sin(angle);
    if (joystickKnob) {
      joystickKnob.style.transform = `translate(calc(-50% + ${mobileState.joyX * maxDist}px), calc(-50% + ${mobileState.joyY * maxDist}px))`;
    }
  }
}

// Thrust button
const thrustBtn = $('btn-thrust');
if (thrustBtn) {
  thrustBtn.addEventListener('touchstart', (e) => { e.preventDefault(); mobileState.thrusting = true; }, { passive: false });
  thrustBtn.addEventListener('touchend', () => { mobileState.thrusting = false; });
  thrustBtn.addEventListener('touchcancel', () => { mobileState.thrusting = false; });
}

// Show/hide mobile controls based on active task
function updateMobileControls() {
  if (!isTouchDevice) return;
  const taskId = state.currentTask?.id || '';
  const isClassify = taskId.startsWith('classify');
  const isDrift = taskId === 'drift';
  const isCollect = taskId.startsWith('collect');
  const isGauntlet = taskId === 'gauntlet' || taskId === 'evolve' || taskId === 'freerun';

  if (mobileClassify) mobileClassify.classList.toggle('hidden', !(isClassify || isGauntlet));
  if (mobileJoystick) mobileJoystick.classList.toggle('hidden', !(isDrift || isCollect || isGauntlet));
}

function hideMobileControls() {
  if (mobileClassify) mobileClassify.classList.add('hidden');
  if (mobileJoystick) mobileJoystick.classList.add('hidden');
  mobileState.thrusting = false;
  mobileState.joyX = 0;
  mobileState.joyY = 0;
}

// ─── LEADERBOARD TAB WIRING ─────────────────────────────
document.querySelectorAll('.lb-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.lb-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    loadLeaderboard(tab.dataset.cat);
  });
});

// ─── API INTEGRATION (Azure Table Storage) ──────────────
const API = {
  GAME_ID: 'taskrunner',
  LB_CATEGORIES: ['xp', 'tasks', 'streak', 'time'],

  async loadArchive() {
    try {
      const res = await fetch(`/api/archive?game=${this.GAME_ID}`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.ok ? data.archive : null;
    } catch { return null; }
  },

  async saveArchive(archive) {
    try {
      const res = await fetch(`/api/archive?game=${this.GAME_ID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game: this.GAME_ID, archive }),
      });
      return res.ok;
    } catch { return false; }
  },

  async loadLeaderboard(category) {
    try {
      const res = await fetch(`/api/leaderboard?game=${this.GAME_ID}&category=${category}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.ok ? (data.entries || []) : [];
    } catch { return []; }
  },

  buildArchive() {
    // Map TASKRUNNER metrics to archive fields the API understands:
    //   stability   → XP (for lb-taskrunner-xp)
    //   discoveries → tasks completed (for lb-taskrunner-tasks)
    //   resonance   → best streak (for lb-taskrunner-streak)
    //   autonomyRatio → tier reached (for lb-taskrunner-tier)
    //   runDuration → session time in seconds (for "longest time lived")
    const sessionSec = Math.floor((Date.now() - (state.sessionStart || Date.now())) / 1000);
    return {
      totalRuns: state.runs,
      wins: state.completedTasks.size > 0 ? 1 : 0,
      bestScore: state.bestXP,
      bestResonance: state.bestStreak,
      totalDiscoveries: state.highestTasks,
      totalRunDuration: state.longestSession,
      archiveTier: state.tier,
      history: [{
        timestamp: Date.now(),
        score: state.xp,
        victory: state.completedTasks.size > 0,
        discoveries: state.completedTasks.size,
        resonance: state.streak,
        stability: state.xp,
        rupturesResolved: state.completedTasks.size,
        beaconsPlaced: 0,
        pulsesUsed: 0,
        anchorsUsed: 0,
        runDuration: sessionSec,
        autonomyRatio: state.tier,
        seedLabel: TIERS[state.tier - 1]?.name || 'Spark',
        modifierLabels: [],
        archiveTier: state.tier,
      }],
    };
  }
};

async function showLeaderboard(cat) {
  showPanel('lb-panel');
  const category = cat || 'xp';
  currentLbCat = category;
  document.querySelectorAll('.lb-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.cat === category);
  });
  await loadLeaderboard(category);
}

async function loadLeaderboard(category) {
  currentLbCat = category;
  const container = $('lb-entries');
  container.innerHTML = '<p class="lb-loading">Loading...</p>';
  const entries = await API.loadLeaderboard(category);
  if (entries.length === 0) {
    container.innerHTML = '<p class="lb-loading">No entries yet. Be the first!</p>';
    return;
  }
  container.innerHTML = entries.map((e, i) => {
    const val = e.metric || 0;
    const display = currentLbCat === 'time' ? formatTime(val) : val;
    return `
    <div class="lb-row">
      <span class="lb-rank">#${i + 1}</span>
      <span class="lb-name">${escapeHtml(e.playerName || 'Player')}</span>
      <span class="lb-score">${display}</span>
    </div>`;
  }).join('');
}

let currentLbCat = 'xp';

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function escapeHtml(text) {
  const d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
}

// Save to cloud on session end
async function saveToCloud() {
  if (state.xp <= 0) return;
  const archive = API.buildArchive();
  const saved = await API.saveArchive(archive);
  if (!saved) {
    // Graceful fallback — already saved to localStorage
    console.warn('Cloud save failed, data preserved locally');
  }
}

// Load cloud data on start
async function loadFromCloud() {
  const archive = await API.loadArchive();
  if (archive) {
    // Merge cloud bests with local (take whichever is higher)
    if ((archive.bestScore || 0) > state.bestXP) {
      state.bestXP = archive.bestScore;
      $('title-best').textContent = state.bestXP;
    }
    if ((archive.totalRuns || 0) > state.runs) {
      state.runs = archive.totalRuns;
      $('title-runs').textContent = state.runs;
    }
    if ((archive.totalRunDuration || 0) > state.longestSession) {
      state.longestSession = archive.totalRunDuration;
    }
    if ((archive.totalDiscoveries || 0) > state.highestTasks) {
      state.highestTasks = archive.totalDiscoveries;
    }
    if ((archive.bestResonance || 0) > state.bestStreak) {
      state.bestStreak = archive.bestResonance;
    }
    save(); // persist merged bests to localStorage
  }
}

// ─── MAIN LOOP ──────────────────────────────────────────
let lastTime = 0;
let gameTime = 0;

function gameLoop(timestamp) {
  requestAnimationFrame(gameLoop);

  const rawDt = (timestamp - lastTime) / 1000;
  lastTime = timestamp;
  const dt = Math.min(rawDt, QA.MAX_DT); // L2: clamp
  gameTime += dt;

  QA.tick(dt);

  // — UPDATE —
  // Per-frame click capture: consume pending click exactly once
  mouse.clicked = _pendingClick;
  _pendingClick = false;

  updateParticles(ambientPool, dt);
  updateParticles(fxPool, dt);
  entity.update(dt);

  if (state.phase === 'playing') {
    state.taskTimer += dt;
    const task = state.currentTask;

    // time limit
    if (task.time > 0 && state.taskTimer >= task.time) {
      finishTask(state.taskScore > 0 ? 'complete' : 'fail');
    } else {
      const handler = getTaskHandler(task.id);
      const result = handler.update(dt);
      if (result === 'complete') finishTask('complete');
      else if (result === 'fail') finishTask('fail');
    }
    updateHUD();
  }

  // — DRAW to buffer (L1) —
  drawBackground(bctx, gameTime);
  drawParticles(bctx, ambientPool);

  // entity always visible except during allocate task
  const isAllocateTask = state.phase === 'playing' && state.currentTask?.id?.startsWith('allocate');
  if (!isAllocateTask) {
    entity.draw(bctx);
  }

  // task-specific draw
  if (state.phase === 'playing') {
    const handler = getTaskHandler(state.currentTask.id);
    handler.draw(bctx);
  }

  drawParticles(bctx, fxPool);

  // QA overlay (enhanced diagnostic — always visible at low FPS, togglable via Q key)
  if (QA.fps < 45 || keys['q'] || keys['Q']) {
    const qx = 8, qy = H - 60;
    bctx.fillStyle = 'rgba(0,0,0,0.6)';
    bctx.fillRect(qx - 4, qy - 12, 210, 56);
    bctx.font = '10px monospace';
    bctx.fillStyle = QA.fps < 40 ? '#ff3333' : QA.fps < 55 ? '#fdd835' : '#66bb6a';
    bctx.fillText(`FPS: ${Math.round(QA.fps)} | Q: ${QA.quality} | Grade: ${QA.audit().grade}`, qx, qy);
    bctx.fillStyle = '#888';
    bctx.fillText(`Particles: ${ambientPool.active.length + fxPool.active.length}/${QA.PARTICLE_BUDGET} | Pool: ${Math.round(QA.poolPressure * 100)}%`, qx, qy + 14);
    bctx.fillText(`Jank: ${QA.jankCount}/${QA.frameCount} (${QA.frameCount > 0 ? (QA.jankCount/QA.frameCount*100).toFixed(1) : 0}%) | Worst: ${Math.round(QA.worstDt*1000)}ms`, qx, qy + 28);
    bctx.fillText(`L0:Budget L1:DblBuf L2:DtClamp L3:Pool L4:Adapt L5:Histo`, qx, qy + 42);
  }

  // — COMPOSITE buffer → screen —
  ctx.drawImage(buf, 0, 0);

  // Reset clicked flag (safety net — already reset above, but ensures no double-fire)
  // mouse.clicked is ephemeral per frame
}



// ─── INIT ───────────────────────────────────────────────
loadSave();
$('title-best').textContent = state.bestXP;
$('title-runs').textContent = state.runs;
entity.init();
spawnAmbient(30);
initStars();
lastTime = performance.now();
requestAnimationFrame(gameLoop);

// Load cloud data (non-blocking)
loadFromCloud();
