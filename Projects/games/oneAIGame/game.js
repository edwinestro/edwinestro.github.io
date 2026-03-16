(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const statPhase = document.getElementById('statPhase');
  const statScore = document.getElementById('statScore');
  const statIntegrity = document.getElementById('statIntegrity');
  const statTime = document.getElementById('statTime');
  const statRound = document.getElementById('statRound');
  const statStreak = document.getElementById('statStreak');

  const overlay = document.getElementById('overlay');
  const overlayKicker = document.getElementById('overlayKicker');
  const overlayTitle = document.getElementById('overlayTitle');
  const overlayCopy = document.getElementById('overlayCopy');
  const overlayScore = document.getElementById('overlayScore');
  const overlayHint = document.getElementById('overlayHint');
  const btnOverlayStart = document.getElementById('btnOverlayStart');
  const btnOverlayRestart = document.getElementById('btnOverlayRestart');

  const btnStart = document.getElementById('btnStart');
  const btnPause = document.getElementById('btnPause');
  const btnReset = document.getElementById('btnReset');

  const knowledgeStatus = document.getElementById('knowledgeStatus');
  const knowledgeLog = document.getElementById('knowledgeLog');
  const structureSteps = Array.from(document.querySelectorAll('#structureSteps li'));

  const rnd = (min, max) => min + Math.random() * (max - min);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  const directives = [
    { key: '1', label: 'Filter', color: '#63e6ff' },
    { key: '2', label: 'Analyze', color: '#8d7bff' },
    { key: '3', label: 'Quarantine', color: '#7cffb6' },
  ];

  const signalTypes = [
    { name: 'Low-Noise', color: '#63e6ff', directive: 0 },
    { name: 'Adaptive', color: '#ffc857', directive: 1 },
    { name: 'Unstable', color: '#ff6b8f', directive: 2 },
  ];

  const knowledgeEntries = [
    {
      title: 'Signal Taxonomy',
      detail: 'Low-noise → Filter, Adaptive → Analyze, Unstable → Quarantine.',
    },
    {
      title: 'AI Confidence',
      detail: 'Suggestions are ~60–80% accurate. Verify before committing.',
    },
    {
      title: 'Integrity Rule',
      detail: 'Missed or wrong directives reduce integrity immediately.',
    },
    {
      title: 'Time Compression',
      detail: 'Decision windows shorten as rounds advance.',
    },
    {
      title: 'Streak Logic',
      detail: 'Perfect rounds stack streak bonuses for accelerated scoring.',
    },
    {
      title: 'Target Objective',
      detail: 'Reach the stabilization score before the clock expires.',
    },
  ];

  const state = {
    dpr: 1,
    w: 960,
    h: 540,
    running: false,
    paused: false,
    ended: false,
    phase: 'briefing',
    phaseTimer: 0,
    totalTime: 90,
    totalLeft: 90,
    round: 1,
    score: 0,
    integrity: 5,
    streak: 0,
    insight: 0,
    targetScore: 2500,
    selectedNode: null,
    nodes: [],
    signals: [],
    resolveFlash: 0,
    knowledgeLog: [],
  };

  const keys = Object.create(null);

  function buildGrid() {
    const cols = 4;
    const rows = 3;
    const padding = 90;
    const gridW = state.w - padding * 2;
    const gridH = state.h - padding * 2;
    const cellW = gridW / (cols - 1);
    const cellH = gridH / (rows - 1);

    state.nodes = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        state.nodes.push({
          x: padding + x * cellW,
          y: padding + y * cellH,
          r: 22,
        });
      }
    }
  }

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
    buildGrid();
  }

  function resetGame() {
    state.running = false;
    state.paused = false;
    state.ended = false;
    state.phase = 'briefing';
    state.totalLeft = state.totalTime;
    state.round = 1;
    state.score = 0;
    state.integrity = 5;
    state.streak = 0;
    state.insight = 0;
    state.selectedNode = null;
    state.signals = [];
    state.resolveFlash = 0;
    btnPause.textContent = 'Pause';

    seedKnowledge();

    updateHUD();
    showOverlay('Directive Grid', 'Plan your first move',
      'You are the stability director. Assign directives quickly to protect integrity and reach the stabilization score.',
      'Scoring is shown below. Target: 2500 before time runs out.');
  }

  function showOverlay(kicker, title, copy, hint) {
    overlay.hidden = false;
    overlayKicker.textContent = kicker;
    overlayTitle.textContent = title;
    overlayCopy.textContent = copy;
    overlayHint.textContent = hint;
    if (overlayScore) overlayScore.hidden = false;
    btnOverlayStart.hidden = false;
    btnOverlayRestart.hidden = true;
  }

  function hideOverlay() {
    overlay.hidden = true;
  }

  function startGame() {
    if (state.running) return;
    state.running = true;
    state.paused = false;
    state.ended = false;
    state.phase = 'decide';
    state.totalLeft = state.totalTime;
    state.round = 1;
    state.score = 0;
    state.integrity = 5;
    state.streak = 0;
    beginRound();
    hideOverlay();
  }

  function beginRound() {
    state.phase = 'decide';
    state.phaseTimer = Math.max(4, 9 - state.round * 0.25);
    state.signals = [];
    state.selectedNode = null;
    updateKnowledgeStatus('Scanning signals…');

    const available = state.nodes.map((_, idx) => idx);
    const signalCount = clamp(3 + Math.floor(state.round / 2), 3, 6);

    for (let i = 0; i < signalCount; i++) {
      const nodeIndex = available.splice(Math.floor(rnd(0, available.length)), 1)[0];
      const typeIndex = Math.floor(rnd(0, signalTypes.length));
      const suggestionAccurate = Math.random() < 0.6 + state.round * 0.02;
      const suggestion = suggestionAccurate ? signalTypes[typeIndex].directive : Math.floor(rnd(0, directives.length));
      state.signals.push({
        nodeIndex,
        typeIndex,
        suggestion,
        assigned: null,
        resolved: false,
      });
    }
  }

  function resolveRound() {
    const decisionRemaining = Math.max(0, state.phaseTimer);
    state.phase = 'resolve';
    state.phaseTimer = 1.2;

    let correct = 0;
    let incorrect = 0;
    let missed = 0;

    for (const sig of state.signals) {
      const required = signalTypes[sig.typeIndex].directive;
      if (sig.assigned === null) {
        missed += 1;
      } else if (sig.assigned === required) {
        correct += 1;
      } else {
        incorrect += 1;
      }
      sig.resolved = true;
    }

    if (incorrect === 0 && missed === 0 && correct > 0) {
      state.streak += correct;
    } else if (incorrect > 0 || missed > 0) {
      state.streak = 0;
    }

    const timeBonus = Math.floor(decisionRemaining * 18 + 20);
    state.score += correct * (120 + timeBonus) + state.streak * 25;
    state.score -= incorrect * 50;

    const insightGain = Math.max(0, correct * 2 - incorrect);
    state.insight += insightGain;
    if (insightGain > 0) {
      pushKnowledge(`Insight +${insightGain} • Total ${state.insight}`);
    } else {
      updateKnowledgeStatus('No new insight');
    }

    const integrityLoss = incorrect + missed;
    state.integrity = Math.max(0, state.integrity - integrityLoss);

    if (state.integrity <= 0) {
      endGame(false);
      return;
    }

    if (state.score >= state.targetScore) {
      endGame(true);
      return;
    }

    state.round += 1;
    state.resolveFlash = 0.6;
  }

  function endGame(win) {
    state.running = false;
    state.paused = false;
    state.ended = true;
    btnPause.textContent = 'Pause';

    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(
          {
            type: 'lab:result',
            game: 'one-ai',
            result: win ? 'win' : 'lose',
            score: Math.round(state.score),
          },
          '*'
        );
      }
    } catch {
      // ignore cross-frame errors
    }

    overlay.hidden = false;
    overlayKicker.textContent = win ? 'Directive Verified' : 'Grid Compromised';
    overlayTitle.textContent = win ? 'You Stabilized the Grid' : 'System Overrun';
    overlayCopy.textContent = win
      ? `Score ${Math.round(state.score)}. Integrity ${state.integrity}. Insight ${state.insight}. Outstanding planning.`
      : `Score ${Math.round(state.score)}. Integrity depleted. Insight ${state.insight}. Refine your directives.`;
    overlayHint.textContent = win
      ? 'Try again and beat your efficiency.'
      : 'Tip: override bad suggestions quickly.';
    if (overlayScore) overlayScore.hidden = true;

    btnOverlayStart.hidden = true;
    btnOverlayRestart.hidden = false;
  }

  function updateHUD() {
    statPhase.textContent = `Phase: ${state.phase === 'decide' ? 'Decision' : state.phase === 'resolve' ? 'Resolve' : 'Briefing'}`;
    statScore.textContent = `Score: ${Math.round(state.score)}`;
    statIntegrity.textContent = `Integrity: ${state.integrity}`;
    statTime.textContent = `Time: ${state.totalLeft.toFixed(1)}s`;
    statRound.textContent = `Round: ${state.round}`;
    statStreak.textContent = `Streak: ${state.streak}`;
    updateStructureStep();
  }

  function updateKnowledgeStatus(text) {
    if (knowledgeStatus) knowledgeStatus.textContent = text;
  }

  function seedKnowledge() {
    state.knowledgeLog = [];
    for (let i = 0; i < 3; i++) {
      const entry = knowledgeEntries[i % knowledgeEntries.length];
      state.knowledgeLog.unshift(entry);
    }
    renderKnowledgeLog();
    updateKnowledgeStatus('Knowledge seeded');
  }

  function pushKnowledge(statusText) {
    const entry = knowledgeEntries[Math.floor(rnd(0, knowledgeEntries.length))];
    state.knowledgeLog.unshift(entry);
    if (state.knowledgeLog.length > 4) state.knowledgeLog.pop();
    renderKnowledgeLog();
    updateKnowledgeStatus(statusText);
  }

  function renderKnowledgeLog() {
    if (!knowledgeLog) return;
    knowledgeLog.replaceChildren();
    for (const entry of state.knowledgeLog) {
      const li = document.createElement('li');
      const title = document.createElement('strong');
      title.textContent = entry.title;
      const body = document.createElement('span');
      body.textContent = entry.detail;
      li.appendChild(title);
      li.appendChild(body);
      knowledgeLog.appendChild(li);
    }
  }

  function updateStructureStep() {
    if (!structureSteps.length) return;
    let activeIndex = 0;
    if (state.phase === 'decide') activeIndex = 1;
    if (state.phase === 'resolve') activeIndex = 2;
    if (state.phase === 'resolve' && state.phaseTimer < 0.4) activeIndex = 3;
    structureSteps.forEach((step, index) => {
      step.classList.toggle('is-active', index === activeIndex);
    });
  }

  function update(dt) {
    if (!state.running || state.paused || state.ended) return;

    state.totalLeft = Math.max(0, state.totalLeft - dt);
    if (state.totalLeft <= 0) {
      endGame(state.score >= state.targetScore);
      return;
    }

    state.phaseTimer -= dt;
    if (state.phase === 'decide') {
      if (state.phaseTimer <= 0) {
        resolveRound();
      }
    } else if (state.phase === 'resolve') {
      state.resolveFlash = Math.max(0, state.resolveFlash - dt);
      if (state.phaseTimer <= 0) {
        beginRound();
      }
    }

    updateHUD();
  }

  function pickNodeAt(x, y) {
    let hit = null;
    for (let i = 0; i < state.nodes.length; i++) {
      const n = state.nodes[i];
      const dx = x - n.x;
      const dy = y - n.y;
      if (Math.sqrt(dx * dx + dy * dy) <= n.r + 8) {
        hit = i;
        break;
      }
    }
    return hit;
  }

  function assignDirective(index) {
    if (!state.running || state.paused || state.phase !== 'decide') return;
    if (state.selectedNode === null) return;
    const sig = state.signals.find((s) => s.nodeIndex === state.selectedNode);
    if (!sig) return;
    sig.assigned = index;
  }

  function executeEarly() {
    if (!state.running || state.paused || state.phase !== 'decide') return;
    resolveRound();
  }

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, state.w, state.h);
    g.addColorStop(0, '#0d1823');
    g.addColorStop(1, '#0a1218');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, state.w, state.h);

    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = '#63e6ff';
    ctx.lineWidth = 1;
    for (const n of state.nodes) {
      for (const m of state.nodes) {
        if (Math.abs(n.x - m.x) <= 260 && Math.abs(n.y - m.y) <= 180) {
          ctx.beginPath();
          ctx.moveTo(n.x, n.y);
          ctx.lineTo(m.x, m.y);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  function drawNodes() {
    for (let i = 0; i < state.nodes.length; i++) {
      const node = state.nodes[i];
      const selected = state.selectedNode === i;
      ctx.save();
      ctx.fillStyle = selected ? 'rgba(99,230,255,0.3)' : 'rgba(20,34,48,0.8)';
      ctx.strokeStyle = selected ? '#63e6ff' : 'rgba(99,230,255,0.25)';
      ctx.lineWidth = selected ? 2 : 1;
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawSignals() {
    for (const sig of state.signals) {
      const node = state.nodes[sig.nodeIndex];
      const type = signalTypes[sig.typeIndex];
      const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 220 + sig.nodeIndex);
      const assigned = sig.assigned !== null ? directives[sig.assigned] : null;
      const suggestion = directives[sig.suggestion];

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `${type.color}33`;
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.r + 14 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.fillStyle = type.color;
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.r - 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.font = '12px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#e6f2ff';
      ctx.fillText(type.name, node.x, node.y - node.r - 12);
      ctx.restore();

      ctx.save();
      ctx.font = '12px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = suggestion.color;
      ctx.fillText(`AI: ${suggestion.label}`, node.x, node.y + node.r + 16);
      ctx.restore();

      if (assigned) {
        ctx.save();
        ctx.font = '13px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = assigned.color;
        ctx.fillText(`You: ${assigned.label}`, node.x, node.y + node.r + 32);
        ctx.restore();
      }
    }
  }

  function drawResolveFlash() {
    if (state.resolveFlash <= 0) return;
    ctx.save();
    ctx.globalAlpha = state.resolveFlash;
    ctx.fillStyle = 'rgba(99,230,255,0.2)';
    ctx.fillRect(0, 0, state.w, state.h);
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, state.w, state.h);
    drawBackground();
    drawNodes();
    drawSignals();
    drawResolveFlash();

    if (state.paused) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, state.w, state.h);
      ctx.fillStyle = '#e6f2ff';
      ctx.font = '26px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('PAUSED', state.w / 2, state.h / 2);
      ctx.restore();
    }
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    update(dt);
    draw();

    requestAnimationFrame(loop);
  }

  canvas.addEventListener('pointerdown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const idx = pickNodeAt(x, y);
    if (idx !== null && state.signals.some((sig) => sig.nodeIndex === idx)) {
      state.selectedNode = idx;
    } else {
      state.selectedNode = null;
    }
  });

  window.addEventListener('keydown', (e) => {
    const k = e.key;
    keys[k] = true;

    if (k === 'r' || k === 'R') resetGame();
    if (k === 'Escape') {
      if (state.running) {
        state.paused = !state.paused;
        btnPause.textContent = state.paused ? 'Resume' : 'Pause';
      }
    }

    if (!state.running && (k === 'Enter' || k === ' ')) {
      startGame();
      return;
    }

    if (k === '1' || k === '2' || k === '3') {
      assignDirective(Number(k) - 1);
    }

    if (k === ' ') {
      executeEarly();
    }
  });

  window.addEventListener('keyup', (e) => {
    keys[e.key] = false;
  });

  btnStart.addEventListener('click', startGame);
  btnPause.addEventListener('click', () => {
    if (!state.running) return;
    state.paused = !state.paused;
    btnPause.textContent = state.paused ? 'Resume' : 'Pause';
  });
  btnReset.addEventListener('click', resetGame);

  btnOverlayStart.addEventListener('click', startGame);
  btnOverlayRestart.addEventListener('click', resetGame);

  // Touch directive buttons (mobile)
  document.querySelectorAll('.dir-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const d = btn.dataset.dir;
      if (d === 'exec') { executeEarly(); return; }
      assignDirective(Number(d) - 1);
    });
  });

  window.addEventListener('resize', resize);

  resize();
  resetGame();
  requestAnimationFrame(loop);
})();
