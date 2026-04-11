(() => {
  const STORAGE_KEY = 'onlyfied.best.v1';
  const REGISTRY_URL = '../../data/games.json';

  const fallbackGames = [
    { id: 'agi-3d', title: 'AGI 3D', desc: 'Living 3D presence with ambient spectacle.', badges: ['3D', 'Experience'] },
    { id: 'science-lab-5-2', title: 'Science Lab 5.2', desc: 'Explorable science hub with guided curiosity.', badges: ['Science', 'MVP'] },
    { id: 'frost-signal', title: 'Frost Signal', desc: 'Fast arcade loop with instant reset clarity.', badges: ['Arcade'] },
    { id: 'copiloki-academy', title: 'Copiloki Academy', desc: 'Cozy progression sim built around care and variety.', badges: ['Cozy', 'Training Sim'] },
    { id: 'memory-sequence', title: 'Memory Sequence', desc: 'Cognitive pattern recall and clean escalation.', badges: ['Cognitive'] },
    { id: 'agi-breeder', title: 'AGI Breeder', desc: 'Strategy sim about balancing power and safety.', badges: ['Strategy', 'Simulation'] },
  ];

  const refs = {
    startBtn: document.getElementById('startBtn'),
    overlayStart: document.getElementById('overlayStart'),
    resetBtn: document.getElementById('resetBtn'),
    overlay: document.getElementById('startOverlay'),
    ariaLive: document.getElementById('ariaLive'),
    dayChip: document.getElementById('dayChip'),
    scoreChip: document.getElementById('scoreChip'),
    comboChip: document.getElementById('comboChip'),
    bestChip: document.getElementById('bestChip'),
    discoverChip: document.getElementById('discoverChip'),
    goalText: document.getElementById('goalText'),
    hypeValue: document.getElementById('hypeValue'),
    clarityValue: document.getElementById('clarityValue'),
    trustValue: document.getElementById('trustValue'),
    momentumValue: document.getElementById('momentumValue'),
    burnoutValue: document.getElementById('burnoutValue'),
    hypeMeter: document.getElementById('hypeMeter'),
    clarityMeter: document.getElementById('clarityMeter'),
    trustMeter: document.getElementById('trustMeter'),
    momentumMeter: document.getElementById('momentumMeter'),
    burnoutMeter: document.getElementById('burnoutMeter'),
    insightTitle: document.getElementById('insightPanelTitle'),
    sourceDesc: document.getElementById('sourceDesc'),
    themeChip: document.getElementById('themeChip'),
    actionHintChip: document.getElementById('actionHintChip'),
    insightList: document.getElementById('insightList'),
    statusLine: document.getElementById('statusLine'),
    sourceFeed: document.getElementById('sourceFeed'),
    logList: document.getElementById('logList'),
    actionButtons: Array.from(document.querySelectorAll('.action-btn')),
  };

  const state = {
    catalog: [...fallbackGames],
    running: false,
    day: 0,
    score: 0,
    combo: 0,
    streak: 0,
    hype: 60,
    clarity: 60,
    trust: 60,
    momentum: 50,
    burnout: 10,
    best: 0,
    discovered: new Set(),
    currentGame: null,
    currentTheme: 'strategy',
    currentInsight: null,
    lastAction: '',
    log: [],
  };

  const ACTIONS = {
    amplify: {
      label: 'Amplify the hook',
      hint: 'Best for arcade and 3D spectacle',
      base: { score: 14, hype: 12, clarity: -4, trust: -5, momentum: 8, burnout: 10 },
    },
    prototype: {
      label: 'Prototype the idea',
      hint: 'Best for science and strategy signals',
      base: { score: 12, hype: 2, clarity: 9, trust: 3, momentum: 9, burnout: 8 },
    },
    stabilize: {
      label: 'Stabilize the build',
      hint: 'Best for memory and reliability pressure',
      base: { score: 8, hype: -2, clarity: 10, trust: 10, momentum: 3, burnout: -8 },
    },
    recover: {
      label: 'Recover and refocus',
      hint: 'Use when burnout spikes or trust dips',
      base: { score: 4, hype: -4, clarity: 7, trust: 6, momentum: -2, burnout: -18 },
    },
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function loadBest() {
    const saved = Number(localStorage.getItem(STORAGE_KEY) || '0');
    state.best = Number.isFinite(saved) ? saved : 0;
  }

  function saveBest() {
    localStorage.setItem(STORAGE_KEY, String(state.best));
  }

  function classifyGame(game) {
    const badges = (game.badges || []).map((badge) => String(badge).toLowerCase());
    const title = String(game.title || '').toLowerCase();

    if (badges.includes('science') || title.includes('protein') || title.includes('science') || title.includes('attract')) return 'science';
    if (badges.includes('cozy') || badges.includes('training sim') || title.includes('copiloki')) return 'cozy';
    if (badges.includes('cognitive') || title.includes('memory') || title.includes('alz')) return 'cognitive';
    if (badges.includes('arcade') || badges.includes('action') || title.includes('thermal') || title.includes('frost')) return 'arcade';
    if (badges.includes('3d') || badges.includes('experience') || title.includes('agi') || title.includes('unsupervised')) return 'experience';
    return 'strategy';
  }

  function themeLabel(theme) {
    return {
      science: 'Science loop',
      cozy: 'Care loop',
      cognitive: 'Memory loop',
      arcade: 'Arcade loop',
      experience: '3D spectacle',
      strategy: 'Strategy board',
    }[theme] || 'Creative loop';
  }

  function suggestedAction(theme) {
    return {
      science: 'Prototype next',
      cozy: 'Stabilize next',
      cognitive: 'Stabilize next',
      arcade: 'Amplify next',
      experience: 'Amplify next',
      strategy: 'Prototype next',
    }[theme] || 'Prototype next';
  }

  function buildInsight(game, theme) {
    const badgeText = (game.badges || []).slice(0, 3).join(' • ') || 'No tags yet';
    const notes = [
      `Source: ${game.title} — ${badgeText}.`,
      `Borrow the strongest part of its ${themeLabel(theme).toLowerCase()} without losing readability.`,
      `Vary your response to build combo power instead of repeating the same move.`
    ];

    if (theme === 'science') notes[1] = 'Borrow its curiosity and make the mechanics easier to understand at a glance.';
    if (theme === 'cozy') notes[1] = 'Borrow its warmth and progression loop, then keep the run emotionally readable.';
    if (theme === 'cognitive') notes[1] = 'Borrow its clarity and escalation, then slow down before burnout spikes.';
    if (theme === 'arcade') notes[1] = 'Borrow its fast restart energy, but do not let hype outrun trust.';
    if (theme === 'experience') notes[1] = 'Borrow its visual spectacle, then ground it with a clearer objective.';

    return {
      title: `${game.title} → ${themeLabel(theme)}`,
      desc: game.desc || 'A fresh idea pulled from the repo.',
      notes,
      actionHint: suggestedAction(theme),
    };
  }

  async function loadCatalog() {
    try {
      const response = await fetch(REGISTRY_URL);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      const games = Array.isArray(payload.games) ? payload.games : [];
      state.catalog = games.length ? games : [...fallbackGames];
    } catch (error) {
      console.warn('Onlyfied: using fallback game catalog.', error);
      state.catalog = [...fallbackGames];
    }
  }

  function addLog(message) {
    state.log.unshift(message);
    state.log = state.log.slice(0, 8);
    refs.logList.innerHTML = state.log.map((item) => `<li>${item}</li>`).join('');
  }

  function updateMeter(valueEl, meterEl, value, isDanger = false) {
    const pct = clamp(Math.round(value), 0, 100);
    valueEl.textContent = `${pct}%`;
    meterEl.style.width = `${pct}%`;

    if (isDanger) {
      meterEl.style.background = pct >= 70
        ? 'linear-gradient(90deg, #ff8a7a, #ff5c6f)'
        : 'linear-gradient(90deg, #ffb28a, #ff8a7a)';
      return;
    }

    meterEl.style.background = pct < 30
      ? 'linear-gradient(90deg, #ff9a8a, #ffd07d)'
      : pct < 70
        ? 'linear-gradient(90deg, #7fd7ff, #8cf0b9)'
        : 'linear-gradient(90deg, #4ce1c2, #8cf0b9)';
  }

  function renderFeed() {
    const cards = state.catalog.slice(0, 8).map((game) => {
      const discovered = state.discovered.has(game.id);
      const theme = classifyGame(game);
      return `
        <article class="feed-card${discovered ? ' discovered' : ''}">
          <h3>${game.title}</h3>
          <p>${themeLabel(theme)} • ${(game.badges || []).slice(0, 2).join(' • ') || 'Repo signal'}</p>
        </article>`;
    });
    refs.sourceFeed.innerHTML = cards.join('');
  }

  function renderInsight() {
    if (!state.currentInsight) return;
    refs.insightTitle.textContent = state.currentInsight.title;
    refs.sourceDesc.textContent = state.currentInsight.desc;
    refs.themeChip.textContent = themeLabel(state.currentTheme);
    refs.actionHintChip.textContent = state.currentInsight.actionHint;
    refs.insightList.innerHTML = state.currentInsight.notes.map((note) => `<li>${note}</li>`).join('');
  }

  function renderStatus() {
    refs.dayChip.textContent = `Day ${state.day}`;
    refs.scoreChip.textContent = `Score ${state.score}`;
    refs.comboChip.textContent = `Combo ×${state.combo}`;
    refs.bestChip.textContent = `Best ${state.best}`;
    refs.discoverChip.textContent = `Sources ${state.discovered.size}`;

    updateMeter(refs.hypeValue, refs.hypeMeter, state.hype);
    updateMeter(refs.clarityValue, refs.clarityMeter, state.clarity);
    updateMeter(refs.trustValue, refs.trustMeter, state.trust);
    updateMeter(refs.momentumValue, refs.momentumMeter, state.momentum);
    updateMeter(refs.burnoutValue, refs.burnoutMeter, state.burnout, true);

    refs.goalText.innerHTML = state.running
      ? `Keep building until you hit <strong>120 score</strong> without letting trust, clarity, or hype collapse.`
      : 'Reach <strong>120 score</strong> with trust and clarity above 45 before day 14.';

    refs.actionButtons.forEach((button) => {
      button.disabled = !state.running;
    });
  }

  function announce(message) {
    refs.ariaLive.textContent = message;
  }

  function pickNextGame() {
    const pool = state.catalog.filter((game) => game.id !== state.currentGame?.id);
    const unseen = pool.filter((game) => !state.discovered.has(game.id));
    const sourcePool = unseen.length ? unseen : (pool.length ? pool : state.catalog);
    const next = sourcePool[Math.floor(Math.random() * sourcePool.length)] || fallbackGames[0];

    state.currentGame = next;
    state.currentTheme = classifyGame(next);
    state.currentInsight = buildInsight(next, state.currentTheme);
    state.discovered.add(next.id);

    renderInsight();
    renderFeed();
  }

  function themeBonus(actionKey, theme) {
    const bonus = { score: 0, hype: 0, clarity: 0, trust: 0, momentum: 0, burnout: 0 };

    if (theme === 'science' && actionKey === 'prototype') {
      bonus.score += 6; bonus.clarity += 7; bonus.trust += 3;
    }
    if (theme === 'cozy' && (actionKey === 'stabilize' || actionKey === 'recover')) {
      bonus.trust += 7; bonus.burnout -= 5;
    }
    if (theme === 'cognitive' && (actionKey === 'stabilize' || actionKey === 'prototype')) {
      bonus.clarity += 6; bonus.score += 4;
    }
    if (theme === 'arcade' && actionKey === 'amplify') {
      bonus.score += 6; bonus.momentum += 8;
    }
    if (theme === 'experience' && actionKey === 'amplify') {
      bonus.hype += 5; bonus.score += 5;
    }
    if (theme === 'strategy' && actionKey === 'prototype') {
      bonus.clarity += 4; bonus.trust += 2; bonus.score += 5;
    }

    return bonus;
  }

  function applyDelta(delta) {
    state.score = Math.max(0, state.score + (delta.score || 0));
    state.hype = clamp(state.hype + (delta.hype || 0), 0, 100);
    state.clarity = clamp(state.clarity + (delta.clarity || 0), 0, 100);
    state.trust = clamp(state.trust + (delta.trust || 0), 0, 100);
    state.momentum = clamp(state.momentum + (delta.momentum || 0), 0, 100);
    state.burnout = clamp(state.burnout + (delta.burnout || 0), 0, 100);
  }

  function buildLogMessage(actionKey) {
    const action = ACTIONS[actionKey];
    return `${action.label} on ${state.currentGame.title}: score ${state.score}, trust ${Math.round(state.trust)}, burnout ${Math.round(state.burnout)}.`;
  }

  function endRun(kind, message) {
    state.running = false;
    refs.overlay.hidden = false;
    refs.statusLine.innerHTML = message;
    addLog(kind === 'win' ? `✅ ${message}` : `⚠️ ${message}`);

    if (state.score > state.best) {
      state.best = state.score;
      saveBest();
      addLog(`New best score: ${state.best}.`);
    }

    renderStatus();
    announce(message);
  }

  function checkOutcome() {
    if (state.score >= 120 && state.trust >= 45 && state.clarity >= 45 && state.day >= 7) {
      return { kind: 'win', message: 'Balanced launch achieved. Onlyfied turned repo insight into a clean, playable release.' };
    }

    if (state.day > 13 || state.burnout >= 100 || state.trust <= 0 || state.clarity <= 0 || state.hype <= 0) {
      return { kind: 'lose', message: 'The remix spiraled out. Reset, vary your moves, and protect trust before chasing more hype.' };
    }

    return null;
  }

  function takeAction(actionKey) {
    if (!state.running || !ACTIONS[actionKey]) return;

    const action = ACTIONS[actionKey];
    const comboBoost = state.lastAction && state.lastAction !== actionKey ? Math.min(state.combo + 1, 6) : Math.max(state.combo - 1, 0);
    state.combo = comboBoost;

    applyDelta(action.base);
    applyDelta(themeBonus(actionKey, state.currentTheme));

    if (state.lastAction && state.lastAction !== actionKey) {
      applyDelta({ score: 4, momentum: 4, burnout: -2 });
    } else if (state.lastAction === actionKey) {
      applyDelta({ burnout: 6, trust: -2, clarity: -1 });
    }

    state.day += 1;
    state.streak += 1;
    state.lastAction = actionKey;

    refs.statusLine.innerHTML = `${ACTIONS[actionKey].label} applied to <strong>${state.currentGame.title}</strong>. ${suggestedAction(state.currentTheme)} remains the safest follow-up.`;
    addLog(buildLogMessage(actionKey));

    const outcome = checkOutcome();
    if (outcome) {
      renderStatus();
      endRun(outcome.kind, outcome.message);
      return;
    }

    pickNextGame();
    renderStatus();
  }

  function startRun() {
    state.running = true;
    state.day = 1;
    state.score = 0;
    state.combo = 0;
    state.streak = 0;
    state.hype = 60;
    state.clarity = 60;
    state.trust = 60;
    state.momentum = 50;
    state.burnout = 10;
    state.discovered = new Set();
    state.lastAction = '';
    state.log = [];
    refs.overlay.hidden = true;
    refs.statusLine.innerHTML = 'A fresh remix session begins. Read the source, then choose a balanced response.';
    addLog('Onlyfied run started. Pulling signals from the repo...');
    pickNextGame();
    renderStatus();
    announce('Onlyfied run started.');
  }

  function clearBest() {
    localStorage.removeItem(STORAGE_KEY);
    state.best = 0;
    renderStatus();
    addLog('Best score cleared.');
    announce('Best score cleared.');
  }

  refs.startBtn?.addEventListener('click', startRun);
  refs.overlayStart?.addEventListener('click', startRun);
  refs.resetBtn?.addEventListener('click', clearBest);
  refs.actionButtons.forEach((button) => {
    button.addEventListener('click', () => takeAction(button.dataset.action));
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === '1') takeAction('amplify');
    if (event.key === '2') takeAction('prototype');
    if (event.key === '3') takeAction('stabilize');
    if (event.key === '4') takeAction('recover');
    if (event.key === 'n' || event.key === 'N') startRun();
  });

  loadBest();
  loadCatalog().then(() => {
    renderFeed();
    renderStatus();
    refs.bestChip.textContent = `Best ${state.best}`;
  });
})();