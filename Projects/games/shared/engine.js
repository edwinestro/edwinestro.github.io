/**
 * engine.js — Shared game engine utilities
 * 
 * Used by: taskrunner, thermal-drift, frost-signal, oneAIGame, attract-ion, science-lab-5-2
 * 
 * Provides:
 *  - Canvas setup with DPR, resize, double-buffer
 *  - Game loop with dt clamp
 *  - Input manager (mouse, touch, keyboard)
 *  - Object pool (O(1) swap-remove)
 *  - Math utilities (lerp, clamp, dist, randRange)
 *  - Leaderboard API client (Azure Table Storage)
 *  - Particle burst helper
 */

// ─── MATH ───────────────────────────────────────────────
export function lerp(a, b, t) { return a + (b - a) * t; }
export function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
export function dist(ax, ay, bx, by) { return Math.hypot(bx - ax, by - ay); }
export function randRange(lo, hi) { return lo + Math.random() * (hi - lo); }

// ─── CANVAS SETUP ───────────────────────────────────────
export function setupCanvas(canvasId, opts = {}) {
  const cvs = typeof canvasId === 'string' ? document.getElementById(canvasId) : canvasId;
  const get2dContext = (target) =>
    target.getContext('2d', { alpha: false, desynchronized: true }) ||
    target.getContext('2d', { alpha: false }) ||
    target.getContext('2d');
  const ctx = get2dContext(cvs);
  const dblBuf = opts.doubleBuffer !== false;
  let buf, bctx;
  if (dblBuf) {
    buf = document.createElement('canvas');
    bctx = get2dContext(buf);
  }
  let W = 0, H = 0;
  let resizeQueued = false;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cvs.width = W * dpr; cvs.height = H * dpr;
    cvs.style.width = W + 'px'; cvs.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (dblBuf) {
      buf.width = W * dpr; buf.height = H * dpr;
      bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }
  function queueResize() {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(() => {
      resizeQueued = false;
      resize();
    });
  }
  window.addEventListener('resize', queueResize, { passive: true });
  resize();

  return {
    cvs, ctx,
    buf: buf || null,
    bctx: bctx || null,
    get W() { return W; },
    get H() { return H; },
    resize,
    composite() { if (dblBuf) ctx.drawImage(buf, 0, 0); },
  };
}

// ─── INPUT MANAGER ──────────────────────────────────────
export function createInput(canvas) {
  const mouse = { x: 0, y: 0, down: false, clicked: false };
  const keys = {};
  let _pending = false;
  const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

  canvas.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
  canvas.addEventListener('mousedown', () => { mouse.down = true; _pending = true; });
  canvas.addEventListener('mouseup', () => { mouse.down = false; });
  canvas.addEventListener('touchstart', e => {
    const t = e.touches[0];
    mouse.x = t.clientX; mouse.y = t.clientY;
    mouse.down = true; _pending = true;
  }, { passive: true });
  canvas.addEventListener('touchmove', e => {
    const t = e.touches[0];
    mouse.x = t.clientX; mouse.y = t.clientY;
  }, { passive: true });
  canvas.addEventListener('touchend', () => { mouse.down = false; }, { passive: true });
  window.addEventListener('keydown', e => { keys[e.key] = true; });
  window.addEventListener('keyup', e => { keys[e.key] = false; });

  return {
    mouse, keys, isTouchDevice,
    consumeClick() { mouse.clicked = _pending; _pending = false; },
  };
}

// ─── GAME LOOP ──────────────────────────────────────────
export function createGameLoop(updateFn, dtCap = 0.05) {
  let lastTime = performance.now();
  let gameTime = 0;
  let running = true;
  let rafId = 0;

  function loop(timestamp) {
    if (!running) return;
    rafId = requestAnimationFrame(loop);
    if (document.hidden) {
      lastTime = timestamp;
      return;
    }
    const rawDt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;
    const dt = Math.min(rawDt, dtCap);
    gameTime += dt;
    updateFn(dt, gameTime);
  }

  const handleVisibilityChange = () => {
    if (!running || document.hidden) return;
    lastTime = performance.now();
  };

  document.addEventListener('visibilitychange', handleVisibilityChange, { passive: true });
  rafId = requestAnimationFrame(loop);

  return {
    get time() { return gameTime; },
    stop() { running = false; if (rafId) cancelAnimationFrame(rafId); },
    start() {
      if (!running) {
        running = true;
        lastTime = performance.now();
        rafId = requestAnimationFrame(loop);
      }
    },
    destroy() {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    },
  };
}

// ─── OBJECT POOL ────────────────────────────────────────
export class Pool {
  constructor(factory, reset, cap = 600) {
    this._f = factory; this._r = reset; this._cap = cap;
    this.active = []; this._free = [];
    for (let i = 0; i < 32; i++) this._free.push(this._f());
  }
  spawn(init) {
    if (this.active.length >= this._cap) return null;
    const obj = this._free.length ? this._free.pop() : this._f();
    init(obj);
    this.active.push(obj);
    return obj;
  }
  update(dt, updater) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      if (!updater(this.active[i], dt)) {
        this._r(this.active[i]);
        this._free.push(this.active[i]);
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
  get count() { return this.active.length; }
}

// ─── LEADERBOARD API (Azure Table Storage) ──────────────
export const LeaderboardAPI = {
  async check() {
    try {
      const r = await fetch('/.auth/me');
      if (!r.ok) return { authenticated: false, name: 'Player' };
      const d = await r.json();
      const p = d.clientPrincipal;
      return p && p.userId
        ? { authenticated: true, name: p.userDetails || 'Player', userId: p.userId }
        : { authenticated: false, name: 'Player' };
    } catch { return { authenticated: false, name: 'Player' }; }
  },

  async load(gameId, category = 'stability') {
    try {
      const r = await fetch(`/api/leaderboard?game=${gameId}&category=${category}`);
      if (!r.ok) return [];
      const d = await r.json();
      return d.ok ? (d.entries || []) : [];
    } catch { return []; }
  },

  async save(gameId, archive) {
    try {
      const r = await fetch(`/api/archive?game=${gameId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game: gameId, archive }),
        redirect: 'error',
      });
      return r.ok;
    } catch { return false; }
  },

  async loadArchive(gameId) {
    try {
      const r = await fetch(`/api/archive?game=${gameId}`);
      if (!r.ok) return null;
      const d = await r.json();
      return d.ok ? d.archive : null;
    } catch { return null; }
  },

  buildHistoryEntry(fields) {
    return {
      timestamp: Date.now(),
      score: fields.score || 0,
      victory: fields.victory || false,
      discoveries: fields.discoveries || 0,
      resonance: fields.resonance || 0,
      stability: fields.stability || fields.score || 0,
      rupturesResolved: fields.rupturesResolved || 0,
      beaconsPlaced: 0,
      pulsesUsed: 0,
      anchorsUsed: 0,
      runDuration: fields.runDuration || 0,
      autonomyRatio: fields.autonomyRatio || 0,
      seedLabel: (fields.seedLabel || '').slice(0, 20),
      modifierLabels: [],
      archiveTier: fields.archiveTier || 0,
    };
  },
};

// ─── ROUNDRECT POLYFILL ─────────────────────────────────
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
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
