(() => {
  const $ = (sel) => document.querySelector(sel);

  // URL controls (used by the homepage "Play Science Lab" CTA)
  const params = new URLSearchParams(window.location.search);
  const isPlayMode =
    params.get('mode') === 'play' ||
    params.get('play') === '1' ||
    params.get('play') === 'true';
  const launchTarget = params.get('launch'); // experiment id | "featured"
  const autoFS = params.get('fs') === '1' || params.get('fullscreen') === '1';

  if (isPlayMode) {
    document.body.classList.add('playmode');
  }

  const chipProgress = $('#chipProgress');
  const chipStatus = $('#chipStatus');

  const expList = $('#expList');
  const btnLaunch = $('#btnLaunch');
  const btnComplete = $('#btnComplete');
  const btnReset = $('#btnReset');

  const featured = $('#featured');
  const featuredDate = $('#featuredDate');
  const featuredName = $('#featuredName');
  const featuredDesc = $('#featuredDesc');
  const featuredShot = $('#featuredShot');
  const btnLaunchFeatured = $('#btnLaunchFeatured');
  const btnSelectFeatured = $('#btnSelectFeatured');

  const vpTitle = $('#vpTitle');
  const frameWrap = $('#frameWrap');
  const frame = $('#frame');
  const placeholder = $('#placeholder');

  const btnBack = $('#btnBack');
  const btnOpen = $('#btnOpen');
  const btnFS = $('#btnFS');

  const result = $('#result');
  const resultKicker = $('#resultKicker');
  const resultTitle = $('#resultTitle');
  const resultCopy = $('#resultCopy');
  const resultOk = $('#resultOk');

  const progressKey = 'scienceLab.progress.v1';
  const metaKey = 'scienceLab.meta.v1';

  // Games database (relative to Projects/hubs/science-lab/)
  const gamesDbUrl = '../../data/games.json';

  // Default screenshot if a game does not provide a thumbnail.
  const defaultFeaturedThumbnail = 'assets/featured-science-lab-mock.svg';

  // Fallback if the DB can’t be loaded (offline / missing file).
  const DEFAULT_EXPERIMENTS = [
    {
      id: 'maze-3d',
      title: 'ScienceLab',
      desc: 'Explore the ScienceLab 3D laboratory experience (legacy v4).',
      href: '../../../legacy/stringball-endpoint/maze.html',
      badges: ['3D', 'Science'],
      counted: true,
    },
    {
      id: 'frost-signal',
      title: 'Frost Signal',
      desc: 'Collect trust shards. Win/lose, restart. Auto-reports result.',
      href: '../../games/frost-signal/index.html',
      badges: ['Arcade', 'MVP'],
      counted: true,
    },
    {
      id: 'thermal-drift',
      title: 'Thermal Drift',
      desc: 'Survive levels, dodge enemies. Auto-reports result after patch.',
      href: '../../games/thermal-drift/index.html',
      badges: ['Action', 'Prototype'],
      counted: true,
    },
    {
      id: 'memory-sequence',
      title: 'Memory Sequence',
      desc: 'Follow and replicate an expanding pattern (legacy lab).',
      href: '../../../legacy/stringball-endpoint/games.html#memory-sequence',
      badges: ['Cognitive'],
      counted: true,
    },
    {
      id: 'memory-mapping',
      title: 'Memory Mapping',
      desc: 'Rebuild the pattern by position (legacy lab).',
      href: '../../../legacy/stringball-endpoint/games.html#memory-mapping',
      badges: ['Cognitive'],
      counted: true,
    },
    {
      id: 'alz-jaime',
      title: 'Alz‑Jaime',
      desc: 'Gentle progressive sequence (legacy lab).',
      href: '../../../legacy/stringball-endpoint/games.html#alz-jaime',
      badges: ['Gentle'],
      counted: false,
    },
    {
      id: 'unsupervised-3d',
      title: 'Unsupervised 3D',
      desc: '3D memory + environment interactions (legacy lab).',
      href: '../../../legacy/stringball-endpoint/games.html#unsupervised-3d',
      badges: ['3D'],
      counted: false,
    },
  ];

  let experiments = DEFAULT_EXPERIMENTS;
  let countedTotal = experiments.filter((e) => e.counted).length;
  let featuredId = null;

  let selectedId = null;
  let currentId = null;

  function normalizeExperiment(exp) {
    const e = { ...exp };
    e.badges = Array.isArray(e.badges) ? e.badges : [];
    e.counted = Boolean(e.counted);

    // Optional thumbnail for featured rendering.
    if (typeof e.thumbnail !== 'string' || !e.thumbnail.trim()) {
      e.thumbnail = null;
    }

    // Normalize updatedAt into a sortable numeric field.
    const ms = typeof e.updatedAt === 'string' ? Date.parse(e.updatedAt) : NaN;
    e.updatedAtMs = Number.isFinite(ms) ? ms : 0;
    return e;
  }

  function pickFeatured(exps) {
    let best = null;
    for (const e of exps) {
      if (!best) {
        best = e;
        continue;
      }
      if ((e.updatedAtMs || 0) > (best.updatedAtMs || 0)) best = e;
    }
    return best;
  }

  function formatUpdatedLabel(iso) {
    if (!iso) return 'Updated —';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'Updated —';
    try {
      const fmt = new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
      return `Updated ${fmt.format(d)}`;
    } catch {
      return `Updated ${d.toISOString().slice(0, 10)}`;
    }
  }

  function renderFeaturedCard() {
    if (!featured) return;
    const exp = experiments.find((e) => e.id === featuredId);
    if (!exp) {
      featured.hidden = true;
      return;
    }

    featured.hidden = false;
    featuredName.textContent = exp.title || exp.id;
    featuredDesc.textContent = exp.desc || '';
    featuredDate.textContent = formatUpdatedLabel(exp.updatedAt);

    if (featuredShot) {
      featuredShot.src = exp.thumbnail || defaultFeaturedThumbnail;
      featuredShot.alt = `Screenshot (mock) for featured build: ${exp.title || exp.id}`;
    }
  }

  async function loadExperimentsFromDb() {
    try {
      const res = await fetch(gamesDbUrl, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const db = await res.json();
      if (!db || typeof db !== 'object' || !Array.isArray(db.games)) throw new Error('Invalid DB shape');

      const loaded = db.games
        .filter((g) => g && typeof g === 'object')
        .map((g) => normalizeExperiment(g))
        .filter((g) => g.id && g.title && g.href);

      if (loaded.length) {
        experiments = loaded;
      } else {
        experiments = DEFAULT_EXPERIMENTS.map(normalizeExperiment);
      }
    } catch {
      experiments = DEFAULT_EXPERIMENTS.map(normalizeExperiment);
    }

    countedTotal = experiments.filter((e) => e.counted).length;
    const featuredExp = pickFeatured(experiments);
    featuredId = featuredExp?.id || null;
    renderFeaturedCard();
  }

  function loadProgress() {
    try {
      return JSON.parse(localStorage.getItem(progressKey) || '{}') || {};
    } catch {
      return {};
    }
  }

  function loadMeta() {
    try {
      return JSON.parse(localStorage.getItem(metaKey) || '{}') || {};
    } catch {
      return {};
    }
  }

  function saveMeta(meta) {
    localStorage.setItem(metaKey, JSON.stringify(meta));
  }

  function saveProgress(p) {
    localStorage.setItem(progressKey, JSON.stringify(p));
  }

  function setStatus(text) {
    chipStatus.textContent = `Status: ${text}`;
  }

  function completedCount(p) {
    return experiments.filter((e) => e.counted && p[e.id] === true).length;
  }

  function getDefaultSelection(p) {
    const featuredExp = experiments.find((e) => e.id === featuredId);
    if (featuredExp && (featuredExp.counted ? p[featuredExp.id] !== true : true)) {
      return featuredExp.id;
    }
    const firstIncomplete = experiments.find((e) => e.counted && p[e.id] !== true);
    if (firstIncomplete) return firstIncomplete.id;
    const meta = loadMeta();
    return meta.lastSelected || experiments[0]?.id;
  }

  function setSelected(id, { focusRow = false } = {}) {
    selectedId = id;
    const meta = loadMeta();
    saveMeta({ ...meta, lastSelected: id });
    render(focusRow ? id : null);
  }

  function render(focusId) {
    const p = loadProgress();
    if (!selectedId) {
      selectedId = getDefaultSelection(p);
    }
    chipProgress.textContent = `Progress: ${completedCount(p)} / ${countedTotal}`;

    while(expList.firstChild) expList.removeChild(expList.firstChild);
    let focusTarget = null;
    for (let i = 0; i < experiments.length; i++) {
      const exp = experiments[i];
      const row = document.createElement('div');
      row.className = `exp ${exp.id === selectedId ? 'active' : ''}`;
      row.setAttribute('role', 'listitem');
      row.tabIndex = 0;
      row.style.setProperty('--i', String(i));

      const left = document.createElement('div');
      const title = document.createElement('div');
      title.className = 'exp-title';
      title.textContent = exp.title;
      const desc = document.createElement('div');
      desc.className = 'exp-desc';
      desc.textContent = exp.desc;
      left.appendChild(title);
      left.appendChild(desc);

      const right = document.createElement('div');
      right.className = 'exp-badges';

      if (p[exp.id] === true) {
        const b = document.createElement('span');
        b.className = 'badge good';
        b.textContent = 'COMPLETE';
        right.appendChild(b);
      }

      if (featuredId && exp.id === featuredId) {
        const b = document.createElement('span');
        b.className = 'badge good';
        b.textContent = 'FEATURED';
        right.appendChild(b);
      }

      for (const label of exp.badges || []) {
        const b = document.createElement('span');
        b.className = 'badge';
        b.textContent = label;
        right.appendChild(b);
      }

      row.appendChild(left);
      row.appendChild(right);

      const pick = () => {
        setSelected(exp.id, { focusRow: true });
      };

      row.addEventListener('click', pick);
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          pick();
        }
      });

      expList.appendChild(row);

      if (focusId && exp.id === focusId) {
        focusTarget = row;
      }
    }

    if (focusTarget) {
      focusTarget.focus({ preventScroll: true });
    }
  }

  function getSelected() {
    return experiments.find((e) => e.id === selectedId) || experiments[0];
  }

  function showFrame(exp) {
    currentId = exp.id;
    vpTitle.textContent = exp.title;

    btnOpen.href = exp.href;

    hideResult();
    placeholder.style.display = 'none';
    frame.style.display = 'block';
    frame.dataset.runningId = exp.id;
    setStatus(`Launching: ${exp.title}`);
    frame.src = exp.href;

    btnBack.disabled = false;
  }

  function backToLab() {
    // In play mode we treat "Back" as "exit play mode".
    if (isPlayMode) {
      window.location.href = window.location.pathname;
      return;
    }

    currentId = null;
    vpTitle.textContent = 'Viewport';
    frame.removeAttribute('src');
    frame.removeAttribute('data-running-id');
    frame.style.display = 'none';
    placeholder.style.display = 'grid';
    btnBack.disabled = true;
    hideResult();
    setStatus('Idle');
  }

  function markComplete(expId) {
    const p = loadProgress();
    p[expId] = true;
    saveProgress(p);
    render();
  }

  function showResult({ game, result: outcome }) {
    const exp = experiments.find((e) => e.id === game);
    const title = exp?.title || game;

    const win = outcome === 'win';
    result.hidden = false;
    resultKicker.textContent = win ? 'Result: Trust Verified' : 'Result: Integrity Compromised';
    resultTitle.textContent = win ? 'WIN' : 'LOSE';
    resultCopy.textContent = win
      ? `${title} completed. Marking as complete in the Lab.`
      : `${title} ended. You can retry or continue to other experiments.`;

    if (win && exp?.counted) {
      markComplete(exp.id);
    }

    setStatus(win ? `Completed: ${title}` : `Failed: ${title}`);
  }

  function hideResult() {
    result.hidden = true;
  }

  // Fullscreen: request on viewport container
  function requestFS() {
    const el = frameWrap;
    const fn = el.requestFullscreen || el.webkitRequestFullscreen;
    if (fn) fn.call(el);
  }

  // Background canvas (frost particles)
  const bg = document.getElementById('bg');
  const bgCtx = bg.getContext('2d');
  const letters = '氷霜|冷光|LAB|TRUST|FROST|DATA';
  const particles = [];
  const center = { x: 0, y: 0 };

  function resizeBG() {
    bg.width = window.innerWidth;
    bg.height = window.innerHeight;
    center.x = bg.width / 2;
    center.y = bg.height / 2;
  }

  function spawnBG() {
    const side = Math.floor(Math.random() * 4);
    let x, y;

    if (side === 0) { x = -10; y = Math.random() * bg.height; }
    else if (side === 1) { x = bg.width + 10; y = Math.random() * bg.height; }
    else if (side === 2) { x = Math.random() * bg.width; y = -10; }
    else { x = Math.random() * bg.width; y = bg.height + 10; }

    const dx = center.x - x;
    const dy = center.y - y;
    const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    const speed = 0.35 + Math.random() * 0.75;

    particles.push({
      x,
      y,
      vx: (dx / dist) * speed,
      vy: (dy / dist) * speed,
      char: letters.charAt(Math.floor(Math.random() * letters.length)),
      life: 0,
      max: 80 + Math.random() * 120,
    });
  }

  function drawBG() {
    bgCtx.clearRect(0, 0, bg.width, bg.height);

    const g = bgCtx.createRadialGradient(center.x, center.y, 10, center.x, center.y, Math.max(bg.width, bg.height) * 0.8);
    g.addColorStop(0, 'rgba(120, 203, 255, 0.0)');
    g.addColorStop(0.5, 'rgba(48, 135, 220, 0.16)');
    g.addColorStop(1, 'rgba(10, 25, 50, 0.6)');
    bgCtx.fillStyle = g;
    bgCtx.fillRect(0, 0, bg.width, bg.height);

    while (particles.length < 160) spawnBG();

    bgCtx.font = '18px "Share Tech Mono", "Courier New", monospace';
    bgCtx.textAlign = 'center';
    bgCtx.textBaseline = 'middle';

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life += 1;
      const fade = 1 - p.life / p.max;
      bgCtx.fillStyle = `rgba(138, 255, 168, ${Math.max(0, fade)})`;
      bgCtx.fillText(p.char, p.x, p.y);
      if (p.life >= p.max) particles.splice(i, 1);
    }

    requestAnimationFrame(drawBG);
  }

  // Wire up buttons
  btnLaunch.addEventListener('click', () => showFrame(getSelected()));
  btnComplete.addEventListener('click', () => {
    const exp = getSelected();
    markComplete(exp.id);
    setStatus(`Manually completed: ${exp.title}`);
  });

  if (btnLaunchFeatured) {
    btnLaunchFeatured.addEventListener('click', () => {
      const exp = experiments.find((e) => e.id === featuredId);
      if (exp) showFrame(exp);
    });
  }

  if (btnSelectFeatured) {
    btnSelectFeatured.addEventListener('click', () => {
      const exp = experiments.find((e) => e.id === featuredId);
      if (exp) setSelected(exp.id, { focusRow: true });
    });
  }
  btnReset.addEventListener('click', () => {
    localStorage.removeItem(progressKey);
    localStorage.removeItem(metaKey);
    selectedId = null;
    render();
    setStatus('Progress reset');
  });

  btnBack.addEventListener('click', backToLab);
  btnFS.addEventListener('click', requestFS);

  expList.addEventListener('keydown', (e) => {
    const navKeys = ['ArrowDown', 'ArrowUp', 'Home', 'End'];
    if (!navKeys.includes(e.key)) return;
    e.preventDefault();
    const idx = experiments.findIndex((ex) => ex.id === selectedId);
    if (idx < 0) return;
    let nextIdx = idx;
    if (e.key === 'ArrowDown') nextIdx = (idx + 1) % experiments.length;
    if (e.key === 'ArrowUp') nextIdx = (idx - 1 + experiments.length) % experiments.length;
    if (e.key === 'Home') nextIdx = 0;
    if (e.key === 'End') nextIdx = experiments.length - 1;
    const next = experiments[nextIdx];
    if (next) setSelected(next.id, { focusRow: true });
  });

  resultOk.addEventListener('click', () => {
    hideResult();
  });

  // Clear lingering overlay if the viewport is clicked after a result
  frameWrap.addEventListener('click', () => {
    if (!result.hidden) hideResult();
  });

  frame.addEventListener('load', () => {
    const runningId = frame.dataset.runningId;
    if (!runningId) return;
    const exp = experiments.find((e) => e.id === runningId);
    if (exp) setStatus(`Running: ${exp.title}`);
  });

  frame.addEventListener('error', () => {
    const runningId = frame.dataset.runningId;
    const exp = experiments.find((e) => e.id === runningId);
    setStatus(`Load failed: ${exp?.title || runningId || 'experiment'}`);
    placeholder.style.display = 'grid';
    placeholder.querySelector('.ph-title').textContent = 'Could not load experiment';
    placeholder.querySelector('.ph-sub').textContent = 'Try “Open in New Tab” or check the experiment path.';
    frame.style.display = 'none';
  });

  // Listen for embedded games reporting win/lose
  window.addEventListener('message', (e) => {
    const data = e.data;
    if (!data || typeof data !== 'object') return;
    if (data.type !== 'lab:result') return;
    if (!data.game || !data.result) return;

    // Ignore stale/foreign results (e.g., previous iframe still posting messages)
    if (!currentId) return;
    if (data.game !== currentId) return;
    if (frame && frame.contentWindow && e.source && e.source !== frame.contentWindow) return;

    showResult({ game: data.game, result: data.result });
  });

  // Emergency escape: always allow dismissing any overlay
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !result.hidden) {
      e.preventDefault();
      hideResult();
      setStatus('Running');
    }
  });

  // Boot
  (async () => {
    await loadExperimentsFromDb();
    render();
    setStatus('Idle');

    // Optional direct-to-game mode.
    if (isPlayMode) {
      let exp = null;

      if (launchTarget && launchTarget !== 'featured') {
        exp = experiments.find((e) => e.id === launchTarget) || null;
      }

      if (!exp) {
        exp = experiments.find((e) => e.id === featuredId) || getSelected();
      }

      if (exp) {
        setSelected(exp.id);
        showFrame(exp);

        // Best-effort: request browser Fullscreen if asked.
        // Note: some browsers block this unless it happens within a direct user gesture.
        if (autoFS) {
          setTimeout(() => {
            try {
              requestFS();
            } catch {
              // ignore
            }
          }, 120);
        }
      }
    }
  })();

  window.addEventListener('resize', resizeBG);
  resizeBG();
  requestAnimationFrame(drawBG);
})();
