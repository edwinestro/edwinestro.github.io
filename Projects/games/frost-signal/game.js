(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const statShards = document.getElementById('statShards');
  const statHealth = document.getElementById('statHealth');
  const statTime = document.getElementById('statTime');

  const overlay = document.getElementById('overlay');
  const overlayKicker = document.getElementById('overlayKicker');
  const overlayTitle = document.getElementById('overlayTitle');
  const overlayCopy = document.getElementById('overlayCopy');
  const overlayHint = document.getElementById('overlayHint');

  const btnStart = document.getElementById('btnStart');
  const btnRestart = document.getElementById('btnRestart');
  const btnPause = document.getElementById('btnPause');
  const btnReset = document.getElementById('btnReset');

  // Leaderboard UI (MVP)
  const leaderboardEl = document.getElementById('leaderboard');
  const lbList = document.getElementById('lbList');
  const lbForm = document.getElementById('lbForm');
  const lbName = document.getElementById('lbName');
  const lbSubmit = document.getElementById('lbSubmit');
  const lbStatus = document.getElementById('lbStatus');

  const LB_GAME = 'frost-signal';
  // Configure in prod via query param, e.g. ?lb=https://YOUR-RENDER-URL
  const LB_BASE = new URLSearchParams(location.search).get('lb') || '';
  const LB_LIMIT = 10;

  const lbEnabled = () => Boolean(LB_BASE);
  const setLbStatus = (msg) => {
    if (lbStatus) lbStatus.textContent = msg || '';
  };

  const renderLeaderboardRows = (rows) => {
    if (!lbList) return;
    lbList.replaceChildren();

    if (!rows || !rows.length) {
      const li = document.createElement('li');
      li.textContent = 'No scores yet.';
      lbList.appendChild(li);
      return;
    }

    for (const r of rows) {
      const li = document.createElement('li');
      const left = document.createElement('span');
      left.className = 'lb-name';
      left.textContent = r.name || 'anon';
      const right = document.createElement('span');
      right.className = 'lb-score';
      right.textContent = String(r.score ?? 0);
      li.appendChild(left);
      li.appendChild(right);
      lbList.appendChild(li);
    }
  };

  async function fetchLeaderboard() {
    if (!leaderboardEl) return;
    leaderboardEl.hidden = false;

    const saved = localStorage.getItem('frostSignal.playerName');
    if (lbName && saved) lbName.value = saved;

    if (!lbEnabled()) {
      renderLeaderboardRows([]);
      setLbStatus('Leaderboard is not configured yet. Add ?lb=https://YOUR-RENDER-URL');
      return;
    }

    setLbStatus('Loading leaderboard…');
    try {
      const url = `${LB_BASE.replace(/\/$/, '')}/api/leaderboard?game=${encodeURIComponent(LB_GAME)}&limit=${LB_LIMIT}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      renderLeaderboardRows(data.leaderboard || []);
      setLbStatus('');
    } catch (e) {
      renderLeaderboardRows([]);
      setLbStatus(`Leaderboard offline: ${e?.message || e}`);
    }
  }

  async function submitScore(name, score) {
    if (!lbEnabled()) {
      setLbStatus('Missing API URL. Add ?lb=https://YOUR-RENDER-URL');
      return;
    }

    const safeName = String(name || '').trim().slice(0, 16);
    if (!safeName) {
      setLbStatus('Enter a name.');
      return;
    }

    setLbStatus('Submitting…');
    if (lbSubmit) lbSubmit.disabled = true;

    try {
      const url = `${LB_BASE.replace(/\/$/, '')}/api/submit-score`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: safeName, score: Number(score) || 0, game: LB_GAME }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      localStorage.setItem('frostSignal.playerName', safeName);
      setLbStatus('Score submitted!');
      await fetchLeaderboard();
    } catch (e) {
      setLbStatus(`Submit failed: ${e?.message || e}`);
    } finally {
      if (lbSubmit) lbSubmit.disabled = false;
    }
  }

  const targetShards = 12;
  const roundSeconds = 60;

  const keys = Object.create(null);
  const pad = { up: false, down: false, left: false, right: false };

  const rnd = (min, max) => min + Math.random() * (max - min);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  const state = {
    dpr: 1,
    w: 960,
    h: 540,
    running: false,
    paused: false,
    ended: false,
    tLeft: roundSeconds,
    shards: 0,
    health: 3,
    lastHitAt: -999,
    time: 0,
    player: { x: 0, y: 0, r: 13, speed: 230 },
    shardsList: [],
    hazards: [],
    particles: [],
  };

  function resize() {
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

    if (!state.running && !state.ended) {
      state.player.x = w * 0.5;
      state.player.y = h * 0.62;
    }
  }

  function resetRound() {
    state.running = false;
    state.paused = false;
    state.ended = false;
    state.tLeft = roundSeconds;
    state.shards = 0;
    state.health = 3;
    state.time = 0;
    state.lastHitAt = -999;

    state.player.x = state.w * 0.5;
    state.player.y = state.h * 0.62;

    state.shardsList = [];
    state.hazards = [];
    state.particles = [];

    for (let i = 0; i < 6; i++) spawnShard();
    for (let i = 0; i < 3; i++) spawnHazard();

    updateHUD();

    overlay.hidden = false;
    overlayKicker.textContent = 'Trust Layer Arcade';
    overlayTitle.textContent = 'Ready?';
    overlayCopy.innerHTML = 'Move with <strong>WASD</strong> or <strong>Arrow Keys</strong>. On mobile use the controls.';
    overlayHint.textContent = 'Tip: short moves keep you safe.';
    btnStart.hidden = false;
    btnRestart.hidden = true;
    btnPause.textContent = 'Pause';

    // Show leaderboard on the start overlay (MVP engagement)
    fetchLeaderboard();
  }

  function startRound() {
    if (state.running) return;
    state.running = true;
    state.paused = false;
    state.ended = false;
    overlay.hidden = true;
    state.time = performance.now();
  }

  function endRound(win) {
    state.running = false;
    state.paused = false;
    state.ended = true;

    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(
          {
            type: 'lab:result',
            game: 'frost-signal',
            result: win ? 'win' : 'lose',
          },
          '*'
        );
      }
    } catch {
      // ignore cross-frame errors
    }

    overlay.hidden = false;
    overlayKicker.textContent = win ? 'Trust Verified' : 'Integrity Compromised';
    overlayTitle.textContent = win ? 'You Win' : 'You Lose';
    overlayCopy.textContent = win
      ? `You secured ${targetShards} shards with ${state.health} integrity remaining.`
      : `You collected ${state.shards} shard(s). Try again and keep moving.`;
    overlayHint.textContent = win
      ? 'Next: beat your time by moving cleaner.'
      : 'Tip: avoid corners; move diagonally to escape.';

    btnStart.hidden = true;
    btnRestart.hidden = false;
    btnPause.textContent = 'Pause';
  }

  function updateHUD() {
    statShards.textContent = `Shards: ${state.shards} / ${targetShards}`;
    statHealth.textContent = `Integrity: ${state.health}`;
    statTime.textContent = `Time: ${state.tLeft.toFixed(1)}s`;
  }

  function spawnShard() {
    const r = 10;
    state.shardsList.push({
      x: rnd(40, state.w - 40),
      y: rnd(70, state.h - 60),
      r,
      pulse: rnd(0, Math.PI * 2),
    });
  }

  function spawnHazard() {
    const r = rnd(12, 18);
    const side = Math.floor(rnd(0, 4));
    let x = 0;
    let y = 0;
    if (side === 0) { x = -r; y = rnd(0, state.h); }
    if (side === 1) { x = state.w + r; y = rnd(0, state.h); }
    if (side === 2) { x = rnd(0, state.w); y = -r; }
    if (side === 3) { x = rnd(0, state.w); y = state.h + r; }

    state.hazards.push({
      x,
      y,
      r,
      speed: rnd(95, 150),
      wobble: rnd(0, Math.PI * 2),
    });
  }

  function dist(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function burst(x, y, color, count = 18) {
    for (let i = 0; i < count; i++) {
      const ang = rnd(0, Math.PI * 2);
      const sp = rnd(70, 220);
      state.particles.push({
        x,
        y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp,
        life: 0,
        max: rnd(0.28, 0.75),
        color,
      });
    }

    // Show leaderboard on end overlay.
    fetchLeaderboard();
  }

  if (lbForm) {
    lbForm.addEventListener('submit', (e) => {
      e.preventDefault();
      // MVP: “points eaten” = shards collected
      submitScore(lbName?.value, state.shards);
    });
  }

  function inputDir() {
    const up = keys.ArrowUp || keys.w || pad.up;
    const down = keys.ArrowDown || keys.s || pad.down;
    const left = keys.ArrowLeft || keys.a || pad.left;
    const right = keys.ArrowRight || keys.d || pad.right;

    let dx = 0;
    let dy = 0;
    if (up) dy -= 1;
    if (down) dy += 1;
    if (left) dx -= 1;
    if (right) dx += 1;

    if (dx !== 0 && dy !== 0) {
      const inv = 1 / Math.sqrt(2);
      dx *= inv;
      dy *= inv;
    }

    return { dx, dy };
  }

  function update(dt) {
    if (!state.running || state.paused) return;

    state.tLeft = Math.max(0, state.tLeft - dt);
    if (state.tLeft <= 0) {
      endRound(false);
      return;
    }

    const { dx, dy } = inputDir();
    state.player.x = clamp(state.player.x + dx * state.player.speed * dt, 18, state.w - 18);
    state.player.y = clamp(state.player.y + dy * state.player.speed * dt, 18, state.h - 18);

    // Collect shards
    for (let i = state.shardsList.length - 1; i >= 0; i--) {
      const s = state.shardsList[i];
      s.pulse += dt * 4;
      if (dist(state.player, s) <= state.player.r + s.r + 2) {
        state.shardsList.splice(i, 1);
        state.shards += 1;
        burst(s.x, s.y, 'rgba(138,255,168,0.95)', 26);
        if (state.shards < targetShards) {
          if (state.shardsList.length < 5) spawnShard();
          if (state.shards % 3 === 0 && state.hazards.length < 7) spawnHazard();
        }
      }
    }

    if (state.shards >= targetShards) {
      endRound(true);
      return;
    }

    // Hazards move toward player
    const now = performance.now();
    for (const h of state.hazards) {
      h.wobble += dt * 2.2;
      const tx = state.player.x + Math.cos(h.wobble) * 18;
      const ty = state.player.y + Math.sin(h.wobble * 1.2) * 18;
      const dxh = tx - h.x;
      const dyh = ty - h.y;
      const d = Math.max(1, Math.sqrt(dxh * dxh + dyh * dyh));
      h.x += (dxh / d) * h.speed * dt;
      h.y += (dyh / d) * h.speed * dt;

      const hitWindow = now - state.lastHitAt;
      const invuln = hitWindow < 650;
      if (!invuln && dist(state.player, h) <= state.player.r + h.r) {
        state.lastHitAt = now;
        state.health -= 1;
        burst(state.player.x, state.player.y, 'rgba(255,93,122,0.95)', 34);
        if (state.health <= 0) {
          endRound(false);
          return;
        }
      }
    }

    // Particles
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
      if (p.life >= p.max) state.particles.splice(i, 1);
    }

    updateHUD();
  }

  function drawBackground() {
    const w = state.w;
    const h = state.h;

    const g = ctx.createRadialGradient(w * 0.5, h * 0.55, 10, w * 0.5, h * 0.55, Math.max(w, h) * 0.8);
    g.addColorStop(0, 'rgba(120, 203, 255, 0.00)');
    g.addColorStop(0.45, 'rgba(48, 135, 220, 0.18)');
    g.addColorStop(1, 'rgba(10, 25, 50, 0.65)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Soft grid
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.strokeStyle = 'rgba(127,216,255,0.9)';
    ctx.lineWidth = 1;
    const step = 42;
    for (let x = 0; x < w; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, state.w, state.h);
    drawBackground();

    // Shards
    for (const s of state.shardsList) {
      const pulse = 0.6 + 0.4 * Math.sin(s.pulse);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(138,255,168,${0.7 * pulse})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r + 5 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(104,240,255,${0.45 + 0.25 * pulse})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r * 0.75, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Hazards
    for (const h of state.hazards) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,93,122,0.18)';
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.r + 10, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255,93,122,0.75)';
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Player (with invulnerability blink)
    const invuln = performance.now() - state.lastHitAt < 650;
    const blink = invuln ? (Math.floor(performance.now() / 80) % 2 === 0) : false;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    if (!blink) {
      ctx.fillStyle = 'rgba(127,216,255,0.22)';
      ctx.beginPath();
      ctx.arc(state.player.x, state.player.y, state.player.r + 12, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(127,216,255,0.85)';
      ctx.beginPath();
      ctx.arc(state.player.x, state.player.y, state.player.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath();
      ctx.arc(state.player.x - 4, state.player.y - 4, 3.1, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // Particles
    for (const p of state.particles) {
      const t = 1 - p.life / p.max;
      ctx.fillStyle = p.color.replace('0.95', String(0.95 * t));
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.2 + 2.8 * (1 - t), 0, Math.PI * 2);
      ctx.fill();
    }

    // Status hint
    ctx.save();
    ctx.font = '14px "Share Tech Mono", "Courier New", monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('Goal: 12 shards • Avoid pulses', 14, state.h - 14);
    ctx.restore();

    if (state.paused) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, 0, state.w, state.h);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '26px "Share Tech Mono", "Courier New", monospace';
      ctx.fillText('PAUSED', state.w / 2, state.h / 2);
      ctx.restore();
    }
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.04, (now - last) / 1000);
    last = now;

    update(dt);
    draw();

    requestAnimationFrame(loop);
  }

  // Events
  window.addEventListener('resize', resize);

  window.addEventListener('keydown', (e) => {
    const k = e.key;
    keys[k] = true;

    if (k === 'r' || k === 'R') resetRound();
    if (k === 'Enter' && !state.running && !state.ended) startRound();

    if (k === 'Escape') {
      if (state.running) {
        state.paused = !state.paused;
        btnPause.textContent = state.paused ? 'Resume' : 'Pause';
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    keys[e.key] = false;
  });

  btnStart.addEventListener('click', startRound);
  btnRestart.addEventListener('click', resetRound);

  btnPause.addEventListener('click', () => {
    if (!state.running) return;
    state.paused = !state.paused;
    btnPause.textContent = state.paused ? 'Resume' : 'Pause';
  });

  btnReset.addEventListener('click', resetRound);

  // Mobile pad
  for (const el of document.querySelectorAll('.pad')) {
    const dir = el.getAttribute('data-dir');

    const on = () => { pad[dir] = true; };
    const off = () => { pad[dir] = false; };

    el.addEventListener('pointerdown', (e) => { e.preventDefault(); on(); });
    el.addEventListener('pointerup', (e) => { e.preventDefault(); off(); });
    el.addEventListener('pointercancel', off);
    el.addEventListener('pointerleave', off);
  }

  // Boot
  resize();
  resetRound();
  requestAnimationFrame(loop);
})();
