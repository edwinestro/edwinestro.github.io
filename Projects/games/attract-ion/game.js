(() => {
  /* ═══════════════════════════════════════
     DOM refs
     ═══════════════════════════════════════ */
  const canvas = document.getElementById('scene');
  const ctx = canvas.getContext('2d');
  const prompt = document.getElementById('prompt');
  const promptTitle = document.getElementById('promptTitle');
  const promptBody = document.getElementById('promptBody');
  const promptAction = document.getElementById('promptAction');
  const promptSkip = document.getElementById('promptSkip');
  const controlPad = document.getElementById('controlPad');
  const btnPull = document.getElementById('btnPull');
  const hudStep = document.getElementById('hudStep');
  const hudStabilityVal = document.getElementById('hudStabilityVal');
  const hudHoldFill = document.getElementById('hudHoldFill');
  const hudHoldTime = document.getElementById('hudHoldTime');
  const hudHoldGrace = document.getElementById('hudHoldGrace');
  const hudErrorVal = document.getElementById('hudErrorVal');
  const hudErrorZone = document.getElementById('hudErrorZone');
  const hudHearts = document.getElementById('hudHearts');
  const hudLevelName = document.getElementById('hudLevelName');
  const hudLevelElectrons = document.getElementById('hudLevelElectrons');
  const orbitHint = document.getElementById('orbitHint');
  const orbitHintTitle = document.getElementById('orbitHintTitle');
  const orbitHintSub = document.getElementById('orbitHintSub');
  const toastEl = document.getElementById('toast');
  const btnSound = document.getElementById('btnSound');
  const promptStats = document.getElementById('promptStats');
  const promptEncourage = document.getElementById('promptEncourage');
  const statHoldTime = document.getElementById('statHoldTime');
  const statStability = document.getElementById('statStability');
  const statAttempts = document.getElementById('statAttempts');
  const statProgress = document.getElementById('statProgress');

  // Tutorial DOM
  const tutorialOverlay = document.getElementById('tutorialOverlay');
  const tutorialDots = document.getElementById('tutorialDots');
  const tutorialTitle = document.getElementById('tutorialTitle');
  const tutorialBody = document.getElementById('tutorialBody');
  const tutorialNext = document.getElementById('tutorialNext');
  const tutorialSkipBtn = document.getElementById('tutorialSkip');

  // Level Select DOM
  const levelSelectOverlay = document.getElementById('levelSelect');
  const levelGrid = document.getElementById('levelGrid');
  const levelSelectBack = document.getElementById('levelSelectBack');
  const promptLevels = document.getElementById('promptLevels');

  /* ═══════════════════════════════════════
     Levels
     ═══════════════════════════════════════ */
  const levels = [
    {
      name: 'Hydrogen',
      symbol: 'H',
      atomicNumber: 1,
      electrons: 1,
      holdTime: 7,
      protons: 1,
      neutrons: 0,
      desc: 'Keep one electron in orbit for 7 seconds.',
      successMsg: 'Hydrogen stabilized! The simplest atom is now yours.',
      nextMsg: 'Next challenge: Helium \u2014 two electrons, one shell.',
    },
    {
      name: 'Helium',
      symbol: 'He',
      atomicNumber: 2,
      electrons: 2,
      holdTime: 7,
      protons: 2,
      neutrons: 2,
      desc: 'Manage two electrons that repel each other. Keep both stable for 7 seconds.',
      successMsg: 'Helium stabilized! A noble gas \u2014 perfectly balanced.',
      nextMsg: null,
    },
  ];

  /* ═══════════════════════════════════════
     Config
     ═══════════════════════════════════════ */
  const config = {
    k: 380000,
    damping: 0.035,
    targetRadius: 120,
    bandFraction: 0.18,
    frameRadius: 260,
    minSpeed: 18,
    maxSpeed: 170,
    fov: 520,
    tiltX: -0.55,
    tiltY: 0.45,
    wobble: 0.08,
    softening: 55,
    grace: 3,
    driftForce: 5,
    fieldStep: 0.22,
    fieldMax: 0,
    fieldMin: -1.8,
    fieldScale: 44,
    fieldResponse: 7.5,
    wheelThreshold: 70,
    coreRadius: 28,
    escapeRadius: 260,
    kRepel: 120000,
    repelSoftening: 40,
    electronColors: [
      { main: 'rgba(255,255,255,0.9)', ring: 'rgba(154,230,255,0.6)', trail: '154,230,255', label: 'e\u207B\u2081' },
      { main: 'rgba(255,220,255,0.9)', ring: 'rgba(255,140,220,0.6)', trail: '255,140,220', label: 'e\u207B\u2082' },
    ],
  };

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const orbitBandHalfWidth = () => config.targetRadius * config.bandFraction;

  /* ═══════════════════════════════════════
     Session persistence
     ═══════════════════════════════════════ */
  const session = {
    attempts: 0,
    bestHoldTime: 0,
    bestStability: 0,
    totalPlayTime: 0,
    tutorialDone: localStorage.getItem('attractionTutorialDone') === 'true',
    soundEnabled: localStorage.getItem('attractionSound') !== 'false',
  };

  /* ═══════════════════════════════════════
     Progress persistence (localStorage)
     ═══════════════════════════════════════ */
  const progress = {
    completed: [],   // array of level indices completed
    bestTimes: {},   // { levelIndex: bestHoldTime }
  };

  function loadProgress() {
    try {
      var saved = localStorage.getItem('attractionProgress');
      if (saved) {
        var d = JSON.parse(saved);
        progress.completed = d.completed || [];
        progress.bestTimes = d.bestTimes || {};
      }
    } catch (_) { /* ignore */ }
  }

  function saveProgress() {
    try {
      localStorage.setItem('attractionProgress', JSON.stringify(progress));
    } catch (_) { /* ignore */ }
  }

  function markLevelCompleted(levelIndex) {
    if (progress.completed.indexOf(levelIndex) === -1) {
      progress.completed.push(levelIndex);
    }
    saveProgress();
  }

  function isLevelUnlocked(levelIndex) {
    if (levelIndex === 0) return true;
    return progress.completed.indexOf(levelIndex - 1) !== -1;
  }

  function isLevelCompleted(levelIndex) {
    return progress.completed.indexOf(levelIndex) !== -1;
  }

  loadProgress();

  try {
    const saved = sessionStorage.getItem('attractionSession');
    if (saved) {
      const d = JSON.parse(saved);
      session.attempts = d.attempts || 0;
      session.bestHoldTime = d.bestHoldTime || 0;
      session.bestStability = d.bestStability || 0;
      session.totalPlayTime = d.totalPlayTime || 0;
    }
  } catch (_) { /* ignore */ }

  function saveSession() {
    try {
      sessionStorage.setItem('attractionSession', JSON.stringify({
        attempts: session.attempts,
        bestHoldTime: session.bestHoldTime,
        bestStability: session.bestStability,
        totalPlayTime: session.totalPlayTime,
      }));
    } catch (_) { /* ignore */ }
  }

  /* ═══════════════════════════════════════
     Audio
     ═══════════════════════════════════════ */
  let audioCtx = null;
  function initAudio() {
    if (audioCtx) return;
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (_) { /* no audio */ }
  }

  function playTone(freq, dur, type = 'sine', volStart = 0.15, volEnd = 0) {
    if (!audioCtx || !session.soundEnabled) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(volStart, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.001, volEnd), audioCtx.currentTime + dur);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + dur);
    } catch (_) { /* ignore */ }
  }

  function playFailSound() {
    playTone(280, 0.15, 'sawtooth', 0.12, 0.01);
    setTimeout(() => playTone(180, 0.15, 'sawtooth', 0.1, 0.01), 100);
    setTimeout(() => playTone(100, 0.2, 'sawtooth', 0.08, 0.001), 200);
  }

  function playSuccessSound() {
    playTone(262, 0.2, 'sine', 0.12, 0.02);
    setTimeout(() => playTone(330, 0.2, 'sine', 0.12, 0.02), 120);
    setTimeout(() => playTone(392, 0.3, 'sine', 0.15, 0.01), 240);
  }

  function playLevelUpSound() {
    playTone(330, 0.15, 'sine', 0.12, 0.02);
    setTimeout(() => playTone(392, 0.15, 'sine', 0.12, 0.02), 100);
    setTimeout(() => playTone(494, 0.15, 'sine', 0.14, 0.02), 200);
    setTimeout(() => playTone(523, 0.3, 'sine', 0.16, 0.01), 300);
  }

  function updateSoundButton() {
    if (btnSound) {
      btnSound.textContent = session.soundEnabled ? 'Sound On' : 'Sound Off';
      btnSound.classList.toggle('muted', !session.soundEnabled);
    }
  }

  /* ═══════════════════════════════════════
     Star field (visual only)
     ═══════════════════════════════════════ */
  const starLayers = [
    { count: 70, size: 1.6, alpha: 0.55, drift: 0.00018 },
    { count: 45, size: 1.2, alpha: 0.4, drift: 0.00028 },
    { count: 30, size: 0.9, alpha: 0.32, drift: 0.0004 },
  ];

  /* ═══════════════════════════════════════
     State
     ═══════════════════════════════════════ */
  function createElectron(angle, r) {
    // Compute orbital speed accounting for constant outward drift
    var netInward = config.k / (r * r + config.softening) - config.driftForce;
    var speed = Math.sqrt(Math.max(1, netInward) * r);
    return {
      x: Math.cos(angle) * r,
      y: Math.sin(angle) * r,
      z: 0,
      vx: -Math.sin(angle) * speed,
      vy:  Math.cos(angle) * speed,
      trail: [],
      bandHold: 0,
      graceLeft: config.grace,
      inBand: false,
      stability: 0,
      peakStability: 0,
      orbitError: 0,
      currentRadius: r,
      recovering: false,
      recoverStart: 0,
      recoverDuration: 600,
      _screenX: 0,
      _screenY: 0,
    };
  }

  const state = {
    phase: 'intro',
    currentLevel: 0,
    time: 0,
    lastTime: 0,
    energy: 0,
    fieldBias: 0,
    fieldBiasTarget: 0,
    fieldForce: 0,
    attraction: 0,
    pullIntensity: 0,
    failReason: null,
    wheelAccum: 0,
    stars: [],
    dramaPhase: null,
    dramaStart: 0,
    dramaDuration: 800,
    shakeOffset: { x: 0, y: 0 },
    flashAlpha: 0,
    snapshot: {
      holdTime: 0, stability: 0, peakStability: 0,
      timeAlive: 0, isNewBestHold: false, isNewBestStability: false,
    },
    simStartTime: 0,
    lives: 3,
    maxLives: 3,
    electrons: [],
    cursorX: 0,
    cursorY: 0,
    selectedIndex: 0,
    cursorOnCanvas: false,
  };

  /* ═══════════════════════════════════════
     Tutorial system
     ═══════════════════════════════════════ */
  const tutorialSteps = [
    {
      title: 'Welcome to Attract-ion!',
      body: 'Your goal: keep <strong>electrons</strong> orbiting inside the <strong>green band</strong> around the nucleus.',
    },
    {
      title: 'The Electron Wants to Escape',
      body: 'The electron naturally drifts <strong>outward</strong>. Your job is to <strong>pull it back</strong> before it escapes.',
    },
    {
      title: 'Scroll Down to Pull',
      body: 'Use <span class="key">Scroll Down</span> to pull the nearest electron toward the nucleus.<br><br>On mobile, hold the <strong>Pull</strong> button.',
    },
    {
      title: 'Hover to Select',
      body: 'When there are multiple electrons, <strong>move your mouse near</strong> the one you want to pull. The closest electron to your cursor is automatically selected.',
    },
    {
      title: 'Hold for 7 Seconds',
      body: 'Keep the electron in the green band for <strong>7 seconds</strong> to stabilize the atom. You have 3 hearts \u2014 if the electron crashes or escapes, you lose one.<br><br>Ready?',
    },
  ];

  let tutorialIndex = 0;

  function renderTutorialDots() {
    if (!tutorialDots) return;
    tutorialDots.innerHTML = '';
    tutorialSteps.forEach((_, i) => {
      const dot = document.createElement('span');
      dot.className = 'tutorial-dot' + (i === tutorialIndex ? ' active' : i < tutorialIndex ? ' done' : '');
      tutorialDots.appendChild(dot);
    });
  }

  function showTutorialStep() {
    const step = tutorialSteps[tutorialIndex];
    if (tutorialTitle) tutorialTitle.textContent = step.title;
    if (tutorialBody) tutorialBody.innerHTML = step.body;
    renderTutorialDots();
    const isLast = tutorialIndex === tutorialSteps.length - 1;
    if (tutorialNext) tutorialNext.textContent = isLast ? 'Start Playing!' : 'Next';
    if (tutorialSkipBtn) tutorialSkipBtn.hidden = isLast;
  }

  function startTutorial() {
    tutorialIndex = 0;
    if (tutorialOverlay) tutorialOverlay.hidden = false;
    showTutorialStep();
    state.phase = 'tutorial';
  }

  function endTutorial() {
    if (tutorialOverlay) tutorialOverlay.hidden = true;
    session.tutorialDone = true;
    localStorage.setItem('attractionTutorialDone', 'true');
    startSimulation();
  }

  if (tutorialNext) {
    tutorialNext.addEventListener('click', () => {
      if (tutorialIndex < tutorialSteps.length - 1) {
        tutorialIndex++;
        showTutorialStep();
      } else {
        endTutorial();
      }
    });
  }

  if (tutorialSkipBtn) {
    tutorialSkipBtn.addEventListener('click', () => endTutorial());
  }

  /* ═══════════════════════════════════════
     Resize
     ═══════════════════════════════════════ */
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(canvas.clientWidth * dpr);
    canvas.height = Math.floor(canvas.clientHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    initStars();
  }

  window.addEventListener('resize', resize);
  resize();

  function initStars() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    state.stars = starLayers.map(layer =>
      Array.from({ length: layer.count }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        tw: Math.random() * Math.PI * 2, seed: Math.random(),
      }))
    );
  }

  /* ═══════════════════════════════════════
     Helpers
     ═══════════════════════════════════════ */
  function toast(msg, ms = 1600) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(() => toastEl.classList.remove('show'), ms);
  }

  function setPrompt(title, body, showAction = true, actionLabel = 'Play') {
    promptTitle.textContent = title;
    promptBody.textContent = body;
    promptAction.hidden = !showAction;
    promptAction.textContent = actionLabel;
    prompt.hidden = false;
  }

  function hidePrompt() { prompt.hidden = true; }

  function currentLevelConfig() { return levels[state.currentLevel]; }

  /* ═══════════════════════════════════════
     Coaching
     ═══════════════════════════════════════ */
  const coachingTips = {
    core: [
      'Try smaller, gentler pulls next time.',
      'When the electron is close, a single light scroll works best.',
      'Let it drift a bit \u2014 don\'t over-correct inward.',
    ],
    escape: [
      'Pull earlier when you see the orbit growing.',
      'The orbit naturally drifts outward \u2014 anticipate it.',
      'Quick pull pulses work better than big ones.',
    ],
    unstable: [
      'Stay in the band longer before making corrections.',
      'Smaller, more frequent adjustments beat big ones.',
      'The grace timer resets when you re-enter the band.',
    ],
  };

  const encouragements = [
    'Getting closer!',
    'Nice try \u2014 you\'ve got this!',
    'Almost had it!',
    'Keep at it!',
    'The orbit is tricky, but you\'re learning.',
  ];

  function getCoachingTip(failType) {
    const tips = coachingTips[failType] || coachingTips.unstable;
    return tips[Math.floor(Math.random() * tips.length)];
  }

  function getEncouragement() {
    const snap = state.snapshot;
    const ht = currentLevelConfig().holdTime;
    const msgs = [];
    if (snap.isNewBestHold) msgs.push('New best hold time!');
    if (snap.isNewBestStability) msgs.push('New stability record!');
    const remaining = ht - snap.holdTime;
    if (remaining <= 2 && remaining > 0) {
      msgs.push('Only ' + remaining.toFixed(1) + 's away from winning!');
    } else if (snap.holdTime > 0) {
      const pct = Math.round((snap.holdTime / ht) * 100);
      if (pct >= 50) msgs.push(pct + '% of the way there!');
    }
    if (session.attempts > 1 && msgs.length === 0) {
      msgs.push(encouragements[Math.floor(Math.random() * encouragements.length)]);
    }
    return msgs.join(' ');
  }

  function updatePromptStats() {
    const snap = state.snapshot;
    if (statHoldTime) {
      statHoldTime.textContent = snap.holdTime.toFixed(1) + 's';
      statHoldTime.classList.toggle('improved', snap.isNewBestHold);
    }
    if (statStability) {
      statStability.textContent = Math.round(snap.peakStability * 100) + '%';
      statStability.classList.toggle('improved', snap.isNewBestStability);
    }
    if (statAttempts) statAttempts.textContent = '#' + session.attempts;
    if (statProgress) {
      const ht = currentLevelConfig().holdTime;
      const pct = Math.min(100, Math.round((snap.holdTime / ht) * 100));
      statProgress.style.setProperty('--progress', pct + '%');
      statProgress.textContent = pct + '%';
    }
    if (promptEncourage) {
      promptEncourage.textContent = getEncouragement();
      promptEncourage.hidden = !promptEncourage.textContent;
    }
    if (promptStats) promptStats.hidden = false;
  }

  /* ═══════════════════════════════════════
     Hearts & recovery
     ═══════════════════════════════════════ */
  function renderHearts() {
    if (!hudHearts) return;
    const spans = hudHearts.querySelectorAll('.heart');
    spans.forEach((s, i) => {
      s.classList.remove('full', 'lost', 'breaking');
      s.classList.add(i < state.lives ? 'full' : 'lost');
    });
  }

  function loseHeart(failType) {
    if (state.electrons.some(el => el.recovering) || state.dramaPhase === 'active') return;
    state.lives = Math.max(0, state.lives - 1);

    if (hudHearts) {
      const spans = hudHearts.querySelectorAll('.heart');
      const idx = state.lives;
      if (spans[idx]) {
        spans[idx].classList.remove('full', 'lost');
        spans[idx].classList.add('breaking');
      }
    }

    playTone(220, 0.12, 'sawtooth', 0.08, 0.01);

    if (state.lives <= 0) {
      triggerFailDrama(failType);
      return;
    }

    toast('Heart lost! ' + state.lives + ' remaining.', 1200);
    for (const el of state.electrons) {
      el.recovering = true;
      el.recoverStart = performance.now();
      el.graceLeft = config.grace;
    }
  }

  function recoverElectron(el) {
    const r = Math.hypot(el.x, el.y) || 1;
    const targetR = config.targetRadius;
    const diff = targetR - r;
    const nudge = diff * 0.06;
    el.x += (el.x / r) * nudge;
    el.y += (el.y / r) * nudge;

    const idealSpeed = Math.sqrt(config.k * targetR / (targetR * targetR + config.softening));
    const curSpeed = Math.hypot(el.vx, el.vy) || 1;
    const ratio = 1 + (idealSpeed / curSpeed - 1) * 0.08;
    el.vx *= ratio;
    el.vy *= ratio;

    state.fieldBiasTarget *= 0.9;

    const elapsed = performance.now() - el.recoverStart;
    const newR = Math.hypot(el.x, el.y);
    const band = orbitBandHalfWidth();
    if ((Math.abs(newR - targetR) <= band && elapsed > 300) || elapsed > el.recoverDuration) {
      el.recovering = false;
      el.graceLeft = config.grace;
    }

    if (!state.electrons.some(e => e.recovering)) {
      toast('Orbit recovered!', 800);
    }
  }

  /* ═══════════════════════════════════════
     Fail drama
     ═══════════════════════════════════════ */
  function triggerFailDrama(failType) {
    const timeAlive = (performance.now() - state.simStartTime) / 1000;
    const bestHold = Math.max(...state.electrons.map(e => e.bandHold));
    const bestStab = Math.max(...state.electrons.map(e => e.peakStability));
    const isNewBestHold = bestHold > session.bestHoldTime;
    const isNewBestStability = bestStab > session.bestStability;

    state.snapshot = {
      holdTime: bestHold,
      stability: state.electrons[0] ? state.electrons[0].stability : 0,
      peakStability: bestStab,
      timeAlive: timeAlive,
      isNewBestHold: isNewBestHold,
      isNewBestStability: isNewBestStability,
    };

    if (isNewBestHold) session.bestHoldTime = bestHold;
    if (isNewBestStability) session.bestStability = bestStab;
    session.totalPlayTime += timeAlive;
    saveSession();

    state.dramaPhase = 'active';
    state.dramaStart = performance.now();
    state.flashAlpha = 0.4;
    playFailSound();

    if (state.failReason) state.failReason.tip = getCoachingTip(failType);
  }

  /* ═══════════════════════════════════════
     Phase management
     ═══════════════════════════════════════ */
  function setPhase(phase) {
    state.phase = phase;
    state.time = 0;
    const lvl = currentLevelConfig();

    if (phase === 'intro') {
      hudStep.textContent = 'Stabilize the electron orbit.';
      if (promptSkip) promptSkip.hidden = false;
      if (promptStats) promptStats.hidden = true;
      if (promptEncourage) promptEncourage.hidden = true;
      setPrompt(
        'Attract-ion',
        'Level ' + (state.currentLevel + 1) + ': ' + lvl.name + ' \u2014 ' + lvl.desc,
        true,
        session.tutorialDone ? 'Play' : 'How to Play'
      );
    }

    if (phase === 'simulate') {
      hudStep.textContent = 'Keep the electron inside the band!';
      if (promptSkip) promptSkip.hidden = true;
      if (promptStats) promptStats.hidden = true;
      if (promptEncourage) promptEncourage.hidden = true;
      hidePrompt();
      initAudio();
    }

    if (phase === 'levelComplete') {
      hudStep.textContent = lvl.name + ' stabilized!';
      if (promptSkip) promptSkip.hidden = true;
      if (promptStats) promptStats.hidden = true;
      if (promptEncourage) promptEncourage.hidden = true;
      markLevelCompleted(state.currentLevel);
      playLevelUpSound();
      if (state.currentLevel < levels.length - 1) {
        var nextLvl = levels[state.currentLevel + 1];
        setPrompt(
          lvl.name + ' Complete!',
          lvl.successMsg + '\n\n' + lvl.nextMsg,
          true,
          'Next: ' + nextLvl.name
        );
      } else {
        setPrompt(
          'All Atoms Stabilized!',
          lvl.successMsg + '\n\nYou\'ve mastered the first shell. More elements coming soon!',
          true,
          'Play Again'
        );
      }
      toast(lvl.name + ' stabilized!', 2000);
      session.bestHoldTime = Math.max(session.bestHoldTime, lvl.holdTime);
      session.bestStability = Math.max(session.bestStability, Math.max(...state.electrons.map(e => e.peakStability)));
      saveSession();
    }

    if (phase === 'success') {
      setPhase('levelComplete');
      return;
    }

    if (phase === 'fail') {
      hudStep.textContent = 'All hearts lost. Try again!';
      if (promptSkip) promptSkip.hidden = true;
      var title = state.failReason ? state.failReason.title : 'Orbit Lost';
      var body = state.failReason ? state.failReason.body : 'The electron left the stability band.';
      if (state.failReason && state.failReason.tip) body += '\n\nTip: ' + state.failReason.tip;
      setPrompt(title, body, true, 'Try Again');
      updatePromptStats();
    }

    if (controlPad) controlPad.hidden = phase !== 'simulate';
    if (orbitHint) {
      orbitHint.hidden = phase !== 'simulate';
      orbitHint.classList.toggle('show', phase === 'simulate');
    }
    if (btnPull) btnPull.classList.remove('suggest');
    // Show Levels button only on intro and levelComplete
    if (promptLevels) promptLevels.hidden = (phase !== 'intro' && phase !== 'levelComplete');

    updateLevelHUD();
  }

  /* ═══════════════════════════════════════
     Level HUD
     ═══════════════════════════════════════ */
  function updateLevelHUD() {
    var lvl = currentLevelConfig();
    if (hudLevelName) hudLevelName.textContent = lvl.symbol + ' ' + lvl.name;
    if (hudLevelElectrons) {
      hudLevelElectrons.textContent = lvl.electrons === 1 ? '1 electron' : lvl.electrons + ' electrons';
    }
  }

  /* ═══════════════════════════════════════
     Simulation lifecycle
     ═══════════════════════════════════════ */
  function resetSimulation() {
    var lvl = currentLevelConfig();
    var nElectrons = lvl.electrons;
    var r = config.targetRadius + orbitBandHalfWidth() + 8;

    state.electrons = [];
    for (var i = 0; i < nElectrons; i++) {
      var angle = (i / nElectrons) * Math.PI * 2;
      state.electrons.push(createElectron(angle, r));
    }

    state.energy = 0;
    state.fieldBias = 0;
    state.fieldBiasTarget = 0;
    state.fieldForce = 0;
    state.attraction = config.k / (r * r + config.softening);
    state.pullIntensity = 0;
    state.failReason = null;
    state.wheelAccum = 0;
    state.dramaPhase = null;
    state.dramaStart = 0;
    state.shakeOffset = { x: 0, y: 0 };
    state.flashAlpha = 0;
    state.simStartTime = performance.now();
    state.lives = state.maxLives;
    state.selectedIndex = 0;
    renderHearts();
    session.attempts++;
    saveSession();
    updateHUD();
  }

  function startSimulation() {
    resetSimulation();
    setPhase('simulate');
  }

  function advanceLevel() {
    if (state.currentLevel < levels.length - 1) {
      state.currentLevel++;
      startSimulation();
    } else {
      // All levels done — show level select
      showLevelSelect();
    }
  }

  promptAction.addEventListener('click', function () {
    if (state.phase === 'intro') {
      if (!session.tutorialDone) {
        startTutorial();
      } else {
        startSimulation();
      }
    } else if (state.phase === 'fail') {
      startSimulation();
    } else if (state.phase === 'levelComplete') {
      advanceLevel();
    }
  });

  if (promptSkip) {
    promptSkip.addEventListener('click', function () {
      if (state.phase === 'intro') startSimulation();
    });
  }

  /* ═══════════════════════════════════════
     Level Select
     ═══════════════════════════════════════ */
  function showLevelSelect() {
    if (!levelSelectOverlay || !levelGrid) return;
    levelGrid.innerHTML = '';
    for (var i = 0; i < levels.length; i++) {
      var lvl = levels[i];
      var unlocked = isLevelUnlocked(i);
      var completed = isLevelCompleted(i);
      var card = document.createElement('div');
      card.className = 'level-card' + (completed ? ' completed' : '') + (!unlocked ? ' locked' : '');
      card.dataset.level = i;

      var symbol = document.createElement('div');
      symbol.className = 'level-symbol';
      symbol.textContent = lvl.symbol;
      card.appendChild(symbol);

      var label = document.createElement('div');
      label.className = 'level-label';
      label.textContent = lvl.name;
      card.appendChild(label);

      var info = document.createElement('div');
      info.className = 'level-info';
      info.textContent = lvl.electrons + (lvl.electrons === 1 ? ' electron' : ' electrons') + ' \u00B7 ' + lvl.holdTime + 's hold';
      card.appendChild(info);

      var badge = document.createElement('div');
      badge.className = 'level-badge';
      if (completed) {
        badge.classList.add('done');
        badge.textContent = '\u2713 Done';
      } else if (unlocked) {
        badge.classList.add('new');
        badge.textContent = 'Play';
      } else {
        badge.classList.add('lock');
        badge.textContent = '\uD83D\uDD12 Locked';
      }
      card.appendChild(badge);

      if (unlocked) {
        (function (idx) {
          card.addEventListener('click', function () {
            state.currentLevel = idx;
            hideLevelSelect();
            startSimulation();
          });
        })(i);
      }

      levelGrid.appendChild(card);
    }
    levelSelectOverlay.hidden = false;
    hidePrompt();
  }

  function hideLevelSelect() {
    if (levelSelectOverlay) levelSelectOverlay.hidden = true;
  }

  if (levelSelectBack) {
    levelSelectBack.addEventListener('click', function () {
      hideLevelSelect();
      setPhase('intro');
    });
  }

  if (promptLevels) {
    promptLevels.addEventListener('click', function () {
      showLevelSelect();
    });
  }

  /* ═══════════════════════════════════════
     HUD update
     ═══════════════════════════════════════ */
  function updateHUD() {
    var lvl = currentLevelConfig();
    var nElectrons = state.electrons.length;

    var avgStability = nElectrons > 0
      ? state.electrons.reduce(function (s, e) { return s + e.stability; }, 0) / nElectrons
      : 0;
    var stabPct = Math.round(avgStability * 100);
    if (hudStabilityVal) {
      hudStabilityVal.textContent = stabPct + '%';
      hudStabilityVal.classList.remove('danger', 'warning');
      if (stabPct < 25) hudStabilityVal.classList.add('danger');
      else if (stabPct < 50) hudStabilityVal.classList.add('warning');
    }

    var minHold = nElectrons > 0
      ? Math.min.apply(null, state.electrons.map(function (e) { return e.bandHold; }))
      : 0;
    var holdPct = Math.min(100, (minHold / lvl.holdTime) * 100);
    if (hudHoldFill) hudHoldFill.style.width = holdPct + '%';
    if (hudHoldTime) hudHoldTime.textContent = minHold.toFixed(1) + ' / ' + lvl.holdTime.toFixed(1) + 's';

    var outElectrons = state.electrons.filter(function (e) { return !e.inBand; });
    if (hudHoldGrace) {
      if (outElectrons.length > 0) {
        var worstGrace = Math.min.apply(null, outElectrons.map(function (e) { return e.graceLeft; }));
        if (worstGrace < config.grace) {
          hudHoldGrace.textContent = 'Grace: ' + worstGrace.toFixed(1) + 's';
        } else {
          hudHoldGrace.textContent = '';
        }
      } else {
        hudHoldGrace.textContent = '';
      }
    }

    var sel = state.electrons[state.selectedIndex];
    if (sel) {
      var err = sel.orbitError;
      var band = orbitBandHalfWidth();
      var r = sel.currentRadius;
      if (hudErrorVal) {
        hudErrorVal.textContent = (err >= 0 ? '+' : '') + err.toFixed(0) + ' px';
      }
      if (hudErrorZone) {
        if (r <= config.coreRadius + 15) {
          hudErrorZone.textContent = 'Core!';
          hudErrorZone.dataset.state = 'danger';
        } else if (r >= config.escapeRadius - 20) {
          hudErrorZone.textContent = 'Escape!';
          hudErrorZone.dataset.state = 'danger';
        } else if (Math.abs(err) <= band) {
          hudErrorZone.textContent = 'In Band';
          hudErrorZone.dataset.state = 'in';
        } else if (sel.graceLeft < 1) {
          hudErrorZone.textContent = 'Critical!';
          hudErrorZone.dataset.state = 'danger';
        } else if (sel.graceLeft < 2) {
          hudErrorZone.textContent = 'Warning';
          hudErrorZone.dataset.state = 'warn';
        } else {
          hudErrorZone.textContent = 'Drifting';
          hudErrorZone.dataset.state = 'warn';
        }
      }
    }
  }

  /* ═══════════════════════════════════════
     Drawing
     ═══════════════════════════════════════ */
  var center = function () {
    return { x: canvas.clientWidth / 2, y: canvas.clientHeight / 2 + 20 };
  };

  function drawStars(t) {
    if (!state.stars.length) return;
    var w = canvas.clientWidth;
    var h = canvas.clientHeight;
    starLayers.forEach(function (layer, li) {
      var stars = state.stars[li] || [];
      var drift = layer.drift * (li + 1);
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        var flicker = 0.65 + 0.35 * Math.sin(t * 0.0012 + s.tw);
        var dx = Math.sin(t * drift + s.tw) * (6 + li * 3);
        var dy = Math.cos(t * drift + s.tw * 1.3) * (4 + li * 2);
        var x = (s.x + dx + w) % w;
        var y = (s.y + dy + h) % h;
        ctx.fillStyle = 'rgba(154,230,255,' + layer.alpha * flicker + ')';
        ctx.fillRect(x, y, layer.size, layer.size);
      }
    });
  }

  function planeToWorld(x, y, z, t) {
    z = z || 0;
    t = t || 0;
    var rx = config.tiltX + Math.sin(t * 0.00035) * config.wobble;
    var ry = config.tiltY + Math.cos(t * 0.0004) * config.wobble;
    var cosX = Math.cos(rx), sinX = Math.sin(rx);
    var cosY = Math.cos(ry), sinY = Math.sin(ry);
    var y1 = y * cosX - z * sinX;
    var z1 = y * sinX + z * cosX;
    var x2 = x * cosY + z1 * sinY;
    var z2 = -x * sinY + z1 * cosY;
    return { x: x2, y: y1, z: z2 };
  }

  function project(point) {
    var c = center();
    var depth = Math.max(120, config.fov + point.z);
    var scale = config.fov / depth;
    return { x: c.x + point.x * scale, y: c.y + point.y * scale, scale: scale };
  }

  function drawProjectedRing(radius, stroke, lineWidth) {
    lineWidth = lineWidth || 2;
    ctx.save();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    var steps = 140;
    for (var i = 0; i <= steps; i++) {
      var ang = (i / steps) * Math.PI * 2;
      var w = planeToWorld(Math.cos(ang) * radius, Math.sin(ang) * radius, 0, state.time);
      var p = project(w);
      i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  function drawProjectedRingDepth(radius, baseAlpha, lineWidth, depthStr, color) {
    depthStr = depthStr || 0.5;
    color = color || '138,255,168';
    var steps = 140;
    var prev = null;
    for (var i = 0; i <= steps; i++) {
      var ang = (i / steps) * Math.PI * 2;
      var world = planeToWorld(Math.cos(ang) * radius, Math.sin(ang) * radius, 0, state.time);
      var proj = project(world);
      if (prev) {
        var depth = clamp(world.z / (radius * 0.6), -1, 1);
        var alpha = baseAlpha * (0.6 + depthStr * (depth + 1) * 0.5);
        ctx.strokeStyle = 'rgba(' + color + ',' + alpha + ')';
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        ctx.moveTo(prev.x, prev.y);
        ctx.lineTo(proj.x, proj.y);
        ctx.stroke();
      }
      prev = proj;
    }
  }

  function drawTargetBand() {
    var band = orbitBandHalfWidth();
    var inner = config.targetRadius - band;
    var outer = config.targetRadius + band;
    var allInBand = state.electrons.length > 0 && state.electrons.every(function (e) { return e.inBand; });
    var bandColor = allInBand ? '138,255,168' : '255,210,120';

    for (var i = 1; i <= 3; i++) {
      var r = inner + (i / 4) * (outer - inner);
      drawProjectedRingDepth(r, allInBand ? 0.08 : 0.04, 4, 0.5, bandColor);
    }

    var edgeAlpha = allInBand ? 0.4 : 0.24;
    drawProjectedRingDepth(inner, edgeAlpha, 2.5, 0.7, bandColor);
    drawProjectedRingDepth(outer, edgeAlpha, 2.5, 0.7, bandColor);
    drawProjectedRingDepth(config.targetRadius, 0.06, 1, 0.5, '154,230,255');

    var anyOutAndGracing = state.electrons.some(function (e) { return !e.inBand && e.graceLeft < config.grace; });
    if (anyOutAndGracing && state.phase === 'simulate') {
      var outEls = state.electrons.filter(function (e) { return !e.inBand; });
      var worstGrace = Math.min.apply(null, outEls.map(function (e) { return e.graceLeft; }));
      var urgency = 1 - (worstGrace / config.grace);
      var pulse = 0.5 + 0.5 * Math.sin(state.time * 0.008 * (1 + urgency * 4));
      var warnAlpha = urgency * pulse * 0.35;
      drawProjectedRingDepth(inner, warnAlpha, 3.5, 0.7, '255,64,96');
      drawProjectedRingDepth(outer, warnAlpha, 3.5, 0.7, '255,64,96');
    }
  }

  function drawLimits() {
    drawProjectedRingDepth(config.coreRadius, 0.07, 1.2, 0.4, '255,64,96');
    drawProjectedRingDepth(config.escapeRadius, 0.05, 1, 0.3, '255,64,96');

    if (state.phase !== 'simulate') return;

    for (var ei = 0; ei < state.electrons.length; ei++) {
      var r = state.electrons[ei].currentRadius;
      if (r < config.coreRadius + 35 && r > config.coreRadius) {
        var prox = 1 - (r - config.coreRadius) / 35;
        drawProjectedRingDepth(config.coreRadius, 0.07 + prox * 0.3, 2 + prox * 3, 0.5, '255,64,96');
      }
      if (r > config.escapeRadius - 50 && r < config.escapeRadius) {
        var prox2 = 1 - (config.escapeRadius - r) / 50;
        drawProjectedRingDepth(config.escapeRadius, 0.05 + prox2 * 0.25, 1.5 + prox2 * 2.5, 0.4, '255,64,96');
      }
    }
  }

  function drawEnergyField(t) {
    var avgStability = state.electrons.length > 0
      ? state.electrons.reduce(function (s, e) { return s + e.stability; }, 0) / state.electrons.length
      : 0;
    var allInBand = state.electrons.length > 0 && state.electrons.every(function (e) { return e.inBand; });
    var stabilityGlow = 0.12 + avgStability * 0.5 + (allInBand ? 0.12 : 0);
    for (var i = 0; i < 3; i++) {
      var radius = 60 + i * 26 + Math.sin(t * 0.003 + i) * 6;
      drawProjectedRing(radius, 'rgba(122,162,255,' + (0.08 + i * 0.04 + stabilityGlow * 0.12) + ')', 2);
    }
    var c = center();
    var glow = 0.3 + Math.sin(t * 0.006) * 0.15 + stabilityGlow;
    var g = ctx.createRadialGradient(c.x, c.y, 10, c.x, c.y, 120);
    g.addColorStop(0, 'rgba(154,230,255,' + (0.35 + glow) + ')');
    g.addColorStop(1, 'rgba(10,14,24,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 120, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawCore(t) {
    var c = center();
    var lvl = currentLevelConfig();

    var coreSize = 10 + (lvl.protons - 1) * 3 + Math.sin(t * 0.004) * 2;
    var coreGrad = ctx.createRadialGradient(c.x - 8, c.y - 10, 2, c.x, c.y, coreSize + 12);
    coreGrad.addColorStop(0, 'rgba(255,255,255,0.95)');
    coreGrad.addColorStop(0.45, 'rgba(154,230,255,0.95)');
    coreGrad.addColorStop(1, 'rgba(20,40,70,0.8)');
    ctx.shadowColor = 'rgba(154,230,255,0.45)';
    ctx.shadowBlur = 18;
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(c.x, c.y, coreSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    if (state.pullIntensity > 0.02) {
      ctx.strokeStyle = 'rgba(154,230,255,' + (0.18 + state.pullIntensity * 0.6) + ')';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 26, -Math.PI / 2, -Math.PI / 2 + state.pullIntensity * Math.PI * 2);
      ctx.stroke();
    }

    // Build nucleon list
    var nucleons = [];
    for (var pi = 0; pi < lvl.protons; pi++) nucleons.push({ type: 'p' });
    for (var ni = 0; ni < lvl.neutrons; ni++) nucleons.push({ type: 'n' });

    var totalN = nucleons.length;
    // Scale quark detail based on nucleon count — fewer nucleons = more detail room
    var showLabels = totalN <= 1;
    var quarkSize = totalN <= 1 ? 4.5 : 3;
    var quarkOrbitR = totalN <= 1 ? 14 : 7;
    var nucleonSpread = totalN <= 1 ? 46 : 18;

    for (var nIdx = 0; nIdx < totalN; nIdx++) {
      var nuc = nucleons[nIdx];
      var basePhase = (nIdx / Math.max(1, totalN)) * Math.PI * 2;
      // Position nucleons in a tight cluster — spread grows slightly with count
      var nucAng = basePhase + t * 0.0008;
      var nucDist = totalN <= 1 ? 0 : nucleonSpread + Math.sin(t * 0.002 + nIdx) * 3;
      var nucX = c.x + Math.cos(nucAng) * nucDist;
      var nucY = c.y + Math.sin(nucAng) * nucDist * 0.78;

      // Draw a subtle nucleon body (proton = blue tint, neutron = grey)
      if (totalN > 1) {
        ctx.fillStyle = nuc.type === 'p' ? 'rgba(122,162,255,0.25)' : 'rgba(180,190,210,0.2)';
        ctx.beginPath();
        ctx.arc(nucX, nucY, quarkOrbitR + 4, 0, Math.PI * 2);
        ctx.fill();
      }

      var quarks = nuc.type === 'p'
        ? [
            { label: 'u', color: '#7aa2ff' },
            { label: 'u', color: '#8affa8' },
            { label: 'd', color: '#ffb454' },
          ]
        : [
            { label: 'u', color: '#7aa2ff' },
            { label: 'd', color: '#ffb454' },
            { label: 'd', color: '#cc9966' },
          ];

      var qPositions = [];
      for (var qi = 0; qi < quarks.length; qi++) {
        var q = quarks[qi];
        var qAng = t * 0.0014 + basePhase + qi * (Math.PI * 2 / 3);
        var qR = quarkOrbitR + Math.sin(t * 0.002 + qi) * (totalN <= 1 ? 2 : 1);
        var qx = nucX + Math.cos(qAng) * qR;
        var qy = nucY + Math.sin(qAng) * qR * 0.78;
        qPositions.push({ x: qx, y: qy });

        ctx.fillStyle = q.color;
        ctx.beginPath();
        ctx.arc(qx, qy, quarkSize, 0, Math.PI * 2);
        ctx.fill();
        if (showLabels) {
          ctx.fillStyle = 'rgba(255,255,255,0.8)';
          ctx.font = '9px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(q.label, qx, qy - 7);
        }
      }

      // Gluon bonds
      ctx.strokeStyle = 'rgba(255,255,255,0.13)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (var gi = 0; gi < qPositions.length; gi++) {
        gi === 0 ? ctx.moveTo(qPositions[gi].x, qPositions[gi].y) : ctx.lineTo(qPositions[gi].x, qPositions[gi].y);
      }
      ctx.closePath();
      ctx.stroke();
    }

    // Element symbol at center
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(lvl.symbol, c.x, c.y);
    ctx.textBaseline = 'alphabetic';
  }

  function drawFieldFrame() {
    if (state.pullIntensity <= 0.02) return;
    var c = center();
    var r = config.frameRadius;
    ctx.save();
    ctx.strokeStyle = 'rgba(154,230,255,' + (0.12 + state.pullIntensity * 0.55) + ')';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, r, r * 0.62, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawElectrons() {
    for (var i = 0; i < state.electrons.length; i++) {
      var el = state.electrons[i];
      var colors = config.electronColors[i] || config.electronColors[0];
      var isSelected = i === state.selectedIndex;
      var world = planeToWorld(el.x, el.y, el.z, state.time);
      var p = project(world);

      el._screenX = p.x;
      el._screenY = p.y;

      ctx.save();

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(p.x + 6, p.y + 6, 6 * p.scale, 4 * p.scale, 0, 0, Math.PI * 2);
      ctx.fill();

      // Selection highlight ring (only for multi-electron levels)
      if (isSelected && state.electrons.length > 1) {
        var pulseScale = 1 + 0.15 * Math.sin(state.time * 0.006);
        ctx.strokeStyle = colors.ring;
        ctx.lineWidth = 2.5;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 14 * p.scale * pulseScale, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Electron body
      ctx.fillStyle = colors.main;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5 * p.scale, 0, Math.PI * 2);
      ctx.fill();

      // Ring
      ctx.strokeStyle = colors.ring;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 7 * p.scale, 0, Math.PI * 2);
      ctx.stroke();

      // Label
      ctx.fillStyle = colors.main;
      ctx.font = '11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(state.electrons.length > 1 ? colors.label : 'e\u207B', p.x, p.y - 11);

      // Per-electron hold indicator arc (only for multi-electron)
      if (state.phase === 'simulate' && state.electrons.length > 1) {
        var holdPct = Math.min(1, el.bandHold / currentLevelConfig().holdTime);
        if (holdPct > 0.01) {
          ctx.strokeStyle = el.inBand ? 'rgba(138,255,168,0.7)' : 'rgba(255,210,120,0.5)';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 12 * p.scale, -Math.PI / 2, -Math.PI / 2 + holdPct * Math.PI * 2);
          ctx.stroke();
        }
      }

      ctx.restore();
    }
  }

  function drawTrails() {
    for (var i = 0; i < state.electrons.length; i++) {
      var el = state.electrons[i];
      var colors = config.electronColors[i] || config.electronColors[0];
      if (el.trail.length < 2) continue;
      for (var j = 1; j < el.trail.length; j++) {
        var prev = el.trail[j - 1];
        var curr = el.trail[j];
        var wP = planeToWorld(prev.x, prev.y, prev.z || 0, state.time);
        var wC = planeToWorld(curr.x, curr.y, curr.z || 0, state.time);
        var pP = project(wP);
        var pC = project(wC);
        var depth = clamp(wC.z / (config.targetRadius * 0.8), -1, 1);
        ctx.strokeStyle = 'rgba(' + colors.trail + ',' + (0.18 + (depth + 1) * 0.12) + ')';
        ctx.lineWidth = 1.4 + pC.scale * 1.2;
        ctx.beginPath();
        ctx.moveTo(pP.x, pP.y);
        ctx.lineTo(pC.x, pC.y);
        ctx.stroke();
      }
    }
  }

  function drawParticles(t) {
    var c = center();
    for (var i = 0; i < 60; i++) {
      var angle = (i / 60) * Math.PI * 2 + t * 0.0006;
      var radius = 140 + Math.sin(t * 0.002 + i) * 12;
      ctx.fillStyle = 'rgba(154,230,255,0.25)';
      ctx.fillRect(c.x + Math.cos(angle) * radius, c.y + Math.sin(angle * 1.3) * radius * 0.5, 2, 2);
    }
  }

  /* ═══════════════════════════════════════
     Input — Pull-only scroll + cursor tracking
     ═══════════════════════════════════════ */
  function onWheel(e) {
    if (state.phase !== 'simulate') return;
    e.preventDefault();
    var dy = e.deltaY;
    if (e.deltaMode === 1) dy *= 16;
    if (e.deltaMode === 2) dy *= 240;

    // Pull only: scroll down (positive deltaY) = pull inward
    if (dy <= 0) return;

    state.wheelAccum += dy;
    var threshold = config.wheelThreshold;
    while (state.wheelAccum >= threshold) {
      applyFieldBias(-config.fieldStep);
      state.wheelAccum -= threshold;
    }
  }

  canvas.addEventListener('wheel', onWheel, { passive: false });

  // Cursor tracking for nearest-electron selection
  canvas.addEventListener('mousemove', function (e) {
    var rect = canvas.getBoundingClientRect();
    state.cursorX = e.clientX - rect.left;
    state.cursorY = e.clientY - rect.top;
    state.cursorOnCanvas = true;
    updateSelectedElectron();
  });

  canvas.addEventListener('mouseleave', function () {
    state.cursorOnCanvas = false;
  });

  canvas.addEventListener('touchmove', function (e) {
    if (e.touches.length > 0) {
      var rect = canvas.getBoundingClientRect();
      state.cursorX = e.touches[0].clientX - rect.left;
      state.cursorY = e.touches[0].clientY - rect.top;
      state.cursorOnCanvas = true;
      updateSelectedElectron();
    }
  }, { passive: true });

  function updateSelectedElectron() {
    if (state.electrons.length <= 1) {
      state.selectedIndex = 0;
      return;
    }
    var bestDist = Infinity;
    var bestIdx = 0;
    for (var i = 0; i < state.electrons.length; i++) {
      var el = state.electrons[i];
      if (el._screenX == null) continue;
      var dx = state.cursorX - el._screenX;
      var dy = state.cursorY - el._screenY;
      var dist = dx * dx + dy * dy;
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    state.selectedIndex = bestIdx;
  }

  function applyFieldBias(delta) {
    if (state.phase !== 'simulate') return;
    state.fieldBiasTarget = clamp(state.fieldBiasTarget + delta, config.fieldMin, config.fieldMax);
    if (delta < 0) {
      state.pullIntensity = clamp(state.pullIntensity + 0.25, 0, 1);
    }
  }

  // Touch pull button
  function bindHold(el, delta) {
    if (!el) return;
    var timer = null;
    var step = function () { applyFieldBias(delta); };
    var clear = function () { if (timer) { clearInterval(timer); timer = null; } };
    var down = function (e) { e.preventDefault(); step(); clear(); timer = setInterval(step, 140); };
    var up = function (e) { e.preventDefault(); clear(); };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', up);
  }

  bindHold(btnPull, -config.fieldStep);

  /* ═══════════════════════════════════════
     Simulation tick
     ═══════════════════════════════════════ */
  function updateSimulation(dt) {
    var lvl = currentLevelConfig();

    state.fieldBias += (state.fieldBiasTarget - state.fieldBias) * (1 - Math.exp(-config.fieldResponse * dt));
    state.fieldBiasTarget *= Math.exp(-1.2 * dt);
    state.pullIntensity = Math.max(0, state.pullIntensity - dt * 0.65);

    for (var i = 0; i < state.electrons.length; i++) {
      var el = state.electrons[i];

      if (el.recovering) {
        recoverElectron(el);
        updateElectronMetrics(el, dt);
        continue;
      }

      var dx = el.x, dy = el.y;
      var r = Math.hypot(dx, dy) || 1;
      el.currentRadius = r;

      // 1. Coulomb attraction to nucleus
      var attract = -config.k / (r * r + config.softening);

      // 2. Outward drift — electron naturally escapes
      var drift = config.driftForce + Math.sin(state.time * 0.0011) * (config.driftForce * 0.3);

      // 3. Player pull field — only on selected electron
      var isSelected = i === state.selectedIndex;
      var fieldForce = isSelected ? state.fieldBias * config.fieldScale : 0;

      var totalForce = attract + drift + fieldForce;
      var ax = (totalForce * dx) / r;
      var ay = (totalForce * dy) / r;

      // 4. Electron-electron repulsion
      if (state.electrons.length > 1) {
        for (var j = 0; j < state.electrons.length; j++) {
          if (j === i) continue;
          var other = state.electrons[j];
          var rdx = el.x - other.x;
          var rdy = el.y - other.y;
          var rDist = Math.hypot(rdx, rdy) || 1;
          var repelForce = config.kRepel / (rDist * rDist + config.repelSoftening);
          ax += (repelForce * rdx) / rDist;
          ay += (repelForce * rdy) / rDist;
        }
      }

      el.vx += ax * dt;
      el.vy += ay * dt;
      var damp = Math.exp(-config.damping * dt);
      el.vx *= damp;
      el.vy *= damp;

      var speedBefore = Math.hypot(el.vx, el.vy);
      if (speedBefore > config.maxSpeed) {
        var s = config.maxSpeed / speedBefore;
        el.vx *= s;
        el.vy *= s;
      }

      el.x += el.vx * dt;
      el.y += el.vy * dt;

      var angle = Math.atan2(el.y, el.x);
      el.z = Math.sin(angle + state.time * 0.0012) * (14 + Math.abs(state.fieldBias) * 4 + el.stability * 6);

      el.trail.push({ x: el.x, y: el.y, z: el.z });
      if (el.trail.length > 70) el.trail.shift();

      updateElectronMetrics(el, dt);

      // Fail checks
      var newR = Math.hypot(el.x, el.y);
      if (newR < config.coreRadius) {
        state.failReason = { title: 'Core Collision', body: 'An electron hit the nucleus! Pull more gently.' };
        loseHeart('core');
        return;
      }
      if (newR > config.escapeRadius) {
        state.failReason = { title: 'Electron Escaped', body: 'An electron flew away! Pull earlier when you see it drifting.' };
        loseHeart('escape');
        return;
      }
      if (!el.inBand && el.graceLeft <= 0) {
        state.failReason = { title: 'Orbit Unstable', body: 'An electron stayed outside the band too long.' };
        loseHeart('unstable');
        return;
      }
    }

    // Win check — ALL electrons must reach holdTime
    var allStable = state.electrons.length > 0 &&
      state.electrons.every(function (e) { return e.bandHold >= lvl.holdTime; });
    if (allStable) {
      setPhase('success');
      return;
    }

    updateHUD();
    updateOrbitHint();
    if (btnPull) {
      var sel = state.electrons[state.selectedIndex];
      btnPull.classList.toggle('suggest', sel && !sel.inBand && sel.orbitError > 0);
    }
  }

  function updateElectronMetrics(el, dt) {
    var r = Math.hypot(el.x, el.y) || 1;
    el.currentRadius = r;
    var orbitError = r - config.targetRadius;
    el.orbitError = orbitError;
    var band = orbitBandHalfWidth();
    var inBand = Math.abs(orbitError) <= band;
    el.inBand = inBand;

    if (inBand) {
      el.bandHold += dt;
      el.graceLeft = config.grace;
    } else {
      el.bandHold = Math.max(0, el.bandHold - dt * 0.6);
      el.graceLeft = Math.max(0, el.graceLeft - dt);
    }

    var speed = Math.hypot(el.vx, el.vy);
    var attract = Math.abs(-config.k / (r * r + config.softening));
    var idealSpeed = Math.sqrt(attract * r);
    var radiusScore = clamp(1 - Math.abs(orbitError) / (band * 1.2), 0, 1);
    var speedScore = clamp(1 - Math.abs(speed - idealSpeed) / (idealSpeed * 0.7 + 1), 0, 1);
    el.stability = clamp(radiusScore * 0.7 + speedScore * 0.3, 0, 1);
    if (el.stability > el.peakStability) el.peakStability = el.stability;
  }

  function updateOrbitHint() {
    var sel = state.electrons[state.selectedIndex];
    if (!sel) return;
    var inBand = sel.inBand;
    var allInBand = state.electrons.every(function (e) { return e.inBand; });

    var hint;
    if (allInBand) {
      hint = 'Hold steady!';
    } else if (inBand && state.electrons.length > 1) {
      hint = 'This one is good \u2014 check the other!';
    } else if (inBand) {
      hint = 'Hold steady!';
    } else {
      hint = 'Drifting out \u2014 scroll down to pull!';
    }
    if (hudStep && hudStep.textContent !== hint) hudStep.textContent = hint;

    if (orbitHint && orbitHintTitle && orbitHintSub) {
      var mode = allInBand ? 'hold' : 'pull';
      orbitHint.dataset.mode = mode;
      orbitHint.classList.add('show');
      orbitHintTitle.textContent = allInBand ? 'HOLD' : 'PULL';
      orbitHintSub.textContent = allInBand
        ? 'Keep all electrons inside the band.'
        : 'Scroll down to pull';
    }
  }

  /* ═══════════════════════════════════════
     Render loop
     ═══════════════════════════════════════ */
  function render(t) {
    var dt = state.lastTime ? Math.min(0.04, (t - state.lastTime) / 1000) : 0.016;
    state.lastTime = t;
    state.time = t;
    var w = canvas.clientWidth;
    var h = canvas.clientHeight;

    if (state.dramaPhase === 'active') {
      var elapsed = t - state.dramaStart;
      var progress = Math.min(1, elapsed / state.dramaDuration);
      var shake = 12 * (1 - progress);
      state.shakeOffset.x = (Math.random() - 0.5) * shake;
      state.shakeOffset.y = (Math.random() - 0.5) * shake;
      state.flashAlpha = 0.4 * (1 - progress);
      if (progress >= 1) {
        state.dramaPhase = null;
        state.shakeOffset = { x: 0, y: 0 };
        state.flashAlpha = 0;
        setPhase('fail');
      }
    }

    ctx.save();
    ctx.translate(state.shakeOffset.x, state.shakeOffset.y);
    ctx.clearRect(-20, -20, w + 40, h + 40);

    var bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#05070b');
    bg.addColorStop(1, '#0a1322');
    ctx.fillStyle = bg;
    ctx.fillRect(-20, -20, w + 40, h + 40);

    drawStars(t);
    drawParticles(t);
    drawEnergyField(t);
    drawLimits();
    drawTargetBand();
    drawCore(t);
    drawTrails();
    drawElectrons();
    drawFieldFrame();

    if (state.phase === 'intro' || state.phase === 'tutorial') {
      var alpha = Math.min(1, t / 2000);
      ctx.fillStyle = 'rgba(154,230,255,' + 0.16 * alpha + ')';
      ctx.fillRect(0, 0, w, h);
    }

    if (state.phase === 'simulate' || state.dramaPhase === 'active') {
      updateSimulation(dt);
    }

    if (state.flashAlpha > 0) {
      ctx.fillStyle = 'rgba(255,100,50,' + state.flashAlpha + ')';
      ctx.fillRect(-20, -20, w + 40, h + 40);
    }

    ctx.restore();
    requestAnimationFrame(render);
  }

  /* ═══════════════════════════════════════
     Sound toggle
     ═══════════════════════════════════════ */
  if (btnSound) {
    btnSound.addEventListener('click', function () {
      initAudio();
      session.soundEnabled = !session.soundEnabled;
      localStorage.setItem('attractionSound', session.soundEnabled);
      updateSoundButton();
      if (session.soundEnabled) playTone(440, 0.1, 'sine', 0.1, 0.01);
    });
    updateSoundButton();
  }

  /* ═══════════════════════════════════════
     Boot
     ═══════════════════════════════════════ */
  setPhase('intro');
  requestAnimationFrame(render);
})();
