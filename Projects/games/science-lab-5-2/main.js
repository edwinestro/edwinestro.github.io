import { ELEMENTS_118, elementTheme } from './elements.js';
import { mulberry32, sampleOrbital, chooseOrbitalForElement, orbitalLabel, clamp } from './orbitals.js';
import { makeTextures, drawRoomBackdrop, drawWallDecals } from './room-renderer.js';
import { getQuizForElement } from './quiz.js';

const $ = (s) => document.querySelector(s);

const canvas = $('#view');
const ctx = canvas.getContext('2d');

const bg = $('#bg');
const bgCtx = bg.getContext('2d');

const roomList = $('#roomList');
const search = $('#search');

const chipProgress = $('#chipProgress');
const vpTitle = $('#vpTitle');
const vpSub = $('#vpSub');

const hudRoom = $('#hudRoom');
const hudOrbital = $('#hudOrbital');
const hudElectrons = $('#hudElectrons');
const hudViz = $('#hudViz');

const btnInfo = $('#btnInfo');
const btnQuiz = $('#btnQuiz');
const btnViz = $('#btnViz');
const btnMode = $('#btnMode');
const btnMeasure = $('#btnMeasure');
const btnReset = $('#btnReset');
const btnFullscreen = $('#btnFullscreen');

const overlay = $('#overlay');
const overlayKicker = $('#overlayKicker');
const overlayTitle = $('#overlayTitle');
const overlayCopy = $('#overlayCopy');
const overlayOptions = $('#overlayOptions');
const overlayPrimary = $('#overlayPrimary');
const overlaySecondary = $('#overlaySecondary');

const STORAGE_KEY = 'scienceLab52.visited.v1';

const state = {
  dpr: 1,
  w: 960,
  h: 540,
  time: 0,
  running: true,
  reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,

  // camera for room projection
  camera: {
    yaw: 0,
    pitch: 0,
    zoom: 1,
  },

  // input
  dragging: false,
  lastX: 0,
  lastY: 0,

  // selected room
  elements: ELEMENTS_118,
  filtered: ELEMENTS_118,
  selectedIndex: 0,
  selectedSymbol: null,

  visited: new Set(),

  // orbital mode
  orbitalMode: 'auto', // auto | s | px | py | pz

  // visualization mode
  // - both: show electrons + probability density + orbital isosurfaces
  // - density: show only probability density
  // - orbitals: show only orbital isosurfaces
  // - electrons: show only electron points
  vizMode: 'both',

  // electron sampling (valence approximation)
  rng: mulberry32(12345),
  electrons: [],

  // precomputed density points per orbital (for stable visualization)
  density: {
    orbitals: {}, // { [orbital]: { points: [{x,y,z}], color } }
  },

  // quiz
  quiz: {
    active: false,
    answered: false,
    current: null,
  },

  // teleport transitions
  fade: {
    active: false,
    t: 0,
    dir: 0,
    nextSymbol: null,
  },

  tex: null,
};

function vizLabel(mode) {
  if (mode === 'both') return 'Both';
  if (mode === 'density') return 'Density';
  if (mode === 'orbitals') return 'Orbitals';
  if (mode === 'electrons') return 'Electrons';
  return String(mode);
}

function updateVizUI() {
  if (btnViz) btnViz.textContent = `Viz: ${vizLabel(state.vizMode)}`;
  if (hudViz) hudViz.textContent = `Viz: ${vizLabel(state.vizMode)}`;
}

function saveVisited() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...state.visited]));
  } catch {
    // ignore
  }
}

function loadVisited() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      state.visited = new Set(arr.filter((x) => typeof x === 'string'));
    }
  } catch {
    // ignore
  }
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  state.dpr = dpr;

  const rect = canvas.getBoundingClientRect();
  const w = Math.max(320, Math.floor(rect.width));
  const h = Math.max(320, Math.floor(rect.height));

  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  state.w = w;
  state.h = h;

  // background canvas
  bg.width = Math.floor(window.innerWidth * dpr);
  bg.height = Math.floor(window.innerHeight * dpr);
  bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function setOverlay({ title, copy, kicker = 'Science Lab 5.2', primary = 'Continue', secondary = 'Close' }) {
  overlay.hidden = false;
  overlayKicker.textContent = kicker;
  overlayTitle.textContent = title;
  overlayCopy.textContent = copy;
  if (overlayOptions) overlayOptions.replaceChildren();
  overlayPrimary.textContent = primary;
  overlaySecondary.textContent = secondary;
}

function hideOverlay() {
  overlay.hidden = true;
  state.quiz.active = false;
}

function postResult(win) {
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'lab:result', game: 'science-lab-5-2', result: win ? 'win' : 'lose' }, '*');
    }
  } catch {
    // ignore
  }
}

function updateProgressUI() {
  chipProgress.textContent = `Visited: ${state.visited.size} / ${state.elements.length}`;
}

function computeOrbitalParams(el) {
  // "Realistic" choice (practical edition):
  // - Use hydrogenic orbital shapes (s / p) as visual proxies.
  // - Scale n by period (roughly correlates with principal quantum number).
  const n = clamp(el.period || 1, 1, 6);
  return { n };
}

function valenceElectrons(el) {
  // MVP approximation:
  // - Period 1: H=1, He=2
  // - Main group: group 1-2 => 1-2; group 13-18 => (group-10) except 18 => 8 (He handled above)
  // - Transition/post-transition/metalloid: show 2–4 for readability
  if (el.number === 1) return 1;
  if (el.number === 2) return 2;
  if (el.group === 1) return 1;
  if (el.group === 2) return 2;
  if (el.group >= 13 && el.group <= 17) return clamp(el.group - 10, 1, 8);
  if (el.group === 18) return 8;
  if (String(el.category).includes('transition')) {
    // keep compact but show some d character
    return clamp((el.group || 8), 2, 10);
  }
  if (String(el.category).includes('metalloid')) return 4;
  return 2;
}

function orbitalFillForElement(el) {
  // Simple, realistic-enough outer-shell model for s/p blocks.
  // Returns { sCount, pCount } for the outer shell.
  // Notes:
  // - For main-group elements this follows the usual pattern: ns^a np^b.
  // - For transition/lanthanide/actinide we keep a compact representation.
  if (el.number === 1) return { sCount: 1, pCount: 0 };
  if (el.number === 2) return { sCount: 2, pCount: 0 };

  // Main group
  if (el.group === 1) return { sCount: 1, pCount: 0 };
  if (el.group === 2) return { sCount: 2, pCount: 0 };

  if (el.group >= 13 && el.group <= 18) {
    const pCount = el.group === 18 ? 6 : clamp(el.group - 12, 1, 6);
    return { sCount: 2, pCount };
  }

  // Transition metals: show ns + (n-1)d filling proxy.
  // Very simplified: d count roughly relates to group-2 (1..10).
  if (String(el.category).includes('transition')) {
    const dCount = clamp((el.group || 8) - 2, 1, 10);
    return { sCount: 2, pCount: 0, dCount, fCount: 0 };
  }

  // Lanthanides/actinides: keep compact for now.
  if (String(el.category).includes('lanthanide')) {
    // Z=57..71
    // Reality has exceptions (La, Ce, Gd, Lu), but for visualization we want clear 4f filling.
    const fCount = clamp(el.number - 57, 0, 14);
    const dCount = (el.number === 57 || el.number === 58 || el.number === 64 || el.number === 71) ? 1 : 0;
    return { sCount: 2, pCount: 0, dCount, fCount };
  }
  if (String(el.category).includes('actinide')) {
    // Z=89..103
    const fCount = clamp(el.number - 89, 0, 14);
    const dCount = (el.number <= 92) ? 1 : 0;
    return { sCount: 2, pCount: 0, dCount, fCount };
  }

  // Everything else: compact visualization
  return { sCount: clamp(valenceElectrons(el), 1, 2), pCount: 0, dCount: 0, fCount: 0 };
}

function buildElectronsForElement(el) {
  const { n } = computeOrbitalParams(el);

  // If user manually selects an orbital (not auto), apply it to all electrons
  // (except Hydrogen: forced to s in orbitals.js).
  const forced = el.number === 1 ? 's' : (state.orbitalMode !== 'auto' ? state.orbitalMode : null);

  const fill = orbitalFillForElement(el);
  const autoCount = (fill.sCount || 0) + (fill.pCount || 0) + (fill.dCount || 0) + (fill.fCount || 0);
  // allow slightly larger caps for d-block so it reads like a transition metal
  const cap = String(el.category).includes('transition') ? 12 : (String(el.category).includes('lanthanide') || String(el.category).includes('actinide')) ? 18 : 8;
  const count = forced ? clamp(valenceElectrons(el), 1, cap) : clamp(autoCount, 1, cap);
  const electrons = [];

  // For auto fill:
  // - s gets up to 2 (paired)
  // - p fills across px/py/pz with Hund's rule
  // - d fills across five d orbitals with Hund's rule
  const pOrbitals = ['px', 'py', 'pz'];
  const dOrbitals = ['dxy', 'dxz', 'dyz', 'dx2y2', 'dz2'];
  const fOrbitals = ['fxyz', 'fz3', 'fxz2', 'fyz2', 'fz_x2y2', 'fx_x23y2', 'fy_3x2y2'];

  const orbitalAssignments = [];
  if (forced) {
    for (let i = 0; i < count; i++) orbitalAssignments.push(forced);
  } else {
    for (let i = 0; i < fill.sCount; i++) orbitalAssignments.push('s');
    // Hund: first pass px/py/pz, then pair
    for (let i = 0; i < fill.pCount; i++) {
      orbitalAssignments.push(pOrbitals[i % 3]);
    }

    // Hund for d: fill each singly then pair
    for (let i = 0; i < (fill.dCount || 0); i++) {
      orbitalAssignments.push(dOrbitals[i % 5]);
    }

    // Hund for f: fill each singly then pair
    for (let i = 0; i < (fill.fCount || 0); i++) {
      orbitalAssignments.push(fOrbitals[i % 7]);
    }
  }

  // Count per orbital so we can pair/space them.
  const perOrb = new Map();
  for (const o of orbitalAssignments) perOrb.set(o, (perOrb.get(o) || 0) + 1);
  const seenOrb = new Map();

  for (let i = 0; i < count; i++) {
    let orbital;

    orbital = orbitalAssignments[i] || (forced || chooseOrbitalForElement(el, 'auto', state.rng));
    const orbCount = perOrb.get(orbital) || 1;
    const orbIndex = (seenOrb.get(orbital) || 0);
    seenOrb.set(orbital, orbIndex + 1);

    const seed = el.number * 10007 + i * 1337 + orbital.charCodeAt(0) * 31;
    const rng = mulberry32(seed);
    electrons.push({
      orbital,
      n,
      rng,
      orbCount,
      orbIndex,
      pos: { x: 0, y: 0, z: 0 },
      tgt: { x: 0, y: 0, z: 0 },
      lastMeasureAt: 0,
      // stagger measurement so they don't all jump at once
      measureEveryMs: (170 + (i % 5) * 34) * (1 + 0.08 * (n - 1)),
    });
  }

  return electrons;
}

function precomputeDensityForElement(el, theme) {
  // Build stable point clouds per orbital used in this room.
  // The density is a visualization of |psi|^2, rendered as faint points.

  const orbitalsUsed = new Set(state.electrons.map((e) => e.orbital));
  const orbitals = [...orbitalsUsed];

  // If only one orbital exists, still provide a nice-looking cloud.
  if (orbitals.length === 0) orbitals.push('s');

  const clouds = {};
  // Keep total point budget roughly constant so f-block doesn't become heavy.
  const totalBudget = 3000;
  const per = Math.floor(totalBudget / Math.max(1, orbitals.length));
  const pointsPerOrbital = state.reducedMotion ? 0 : clamp(per, 250, 900);

  for (let i = 0; i < orbitals.length; i++) {
    const orb = orbitals[i];
    const seed = el.number * 70001 + orb.charCodeAt(0) * 97 + i * 133;
    const rng = mulberry32(seed);
    const n = state.electrons[0]?.n || clamp(el.period || 1, 1, 7);

    // Keep density scale consistent with drawAtom() logic
    const maxAU = 2.6 * n;
    const s = 34 + (n <= 2 ? 6 : 0);

    const pts = [];
    for (let k = 0; k < pointsPerOrbital; k++) {
      const p = sampleOrbital(rng, { orbital: orb, n });
      pts.push({
        x: clamp(p.x, -maxAU, maxAU) * s,
        y: clamp(p.y, -maxAU, maxAU) * s,
        z: clamp(p.z, -maxAU, maxAU) * s,
      });
    }

    const hue = (theme.hue + i * 28) % 360;
    clouds[orb] = {
      points: pts,
      color: `hsla(${hue}, 90%, 70%, 0.14)`,
      hue,
    };
  }

  state.density.orbitals = clouds;
}

function currentElement() {
  const sym = state.selectedSymbol;
  return state.elements.find((e) => e.symbol === sym) || state.filtered[state.selectedIndex] || state.elements[0];
}

function setSelectedBySymbol(symbol, { focus = true, teleport = true } = {}) {
  const idxAll = state.elements.findIndex((e) => e.symbol === symbol);
  if (idxAll < 0) return;

  // Make it visible in filtered list (reset search if needed)
  if (!state.filtered.some((e) => e.symbol === symbol)) {
    state.filtered = state.elements;
    search.value = '';
    renderList();
  }

  const idx = state.filtered.findIndex((e) => e.symbol === symbol);
  if (idx >= 0) state.selectedIndex = idx;
  state.selectedSymbol = symbol;

  if (teleport) {
    teleportTo(symbol);
  } else {
    applyRoom(symbol);
  }

  if (focus) {
    const row = roomList.querySelector(`[data-symbol="${symbol}"]`);
    if (row) row.focus({ preventScroll: false });
  }

  renderList();
}

function teleportTo(symbol) {
  if (state.reducedMotion) {
    applyRoom(symbol);
    return;
  }

  state.fade.active = true;
  state.fade.t = 0;
  state.fade.dir = 1;
  state.fade.nextSymbol = symbol;
}

function applyRoom(symbol) {
  state.selectedSymbol = symbol;

  const el = state.elements.find((e) => e.symbol === symbol);
  if (!el) return;

  state.visited.add(symbol);
  saveVisited();
  updateProgressUI();

  const theme = elementTheme(el);
  const seed = el.number * 10007 + el.symbol.charCodeAt(0) * 97;
  state.rng = mulberry32(seed);

  // electron set (valence approximation)
  state.electrons = buildElectronsForElement(el);
  precomputeDensityForElement(el, theme);

  // mild camera reset
  state.camera.yaw = 0;
  state.camera.pitch = 0;

  vpTitle.textContent = `${el.name} (${el.symbol})`;
  const massTxt = (el.mass && el.mass !== '—') ? `${el.mass} u` : '—';
  const periodTxt = el.period ? `Period ${el.period}` : 'Period —';
  const groupTxt = el.group ? `Group ${el.group}` : 'Group —';
  const cfgTxt = el.config ? el.config : '—';
  vpSub.textContent = `Atomic #${el.number} · Mass ${massTxt} · ${el.category} · ${periodTxt} · ${groupTxt} · e⁻: ${cfgTxt}`;

  hudRoom.textContent = `Room: ${el.symbol}`;
  const shown = state.electrons[0]?.orbital || 's';
  hudOrbital.textContent = `Orbital: ${orbitalLabel(state.orbitalMode)} → ${orbitalLabel(shown)}`;
  if (hudElectrons) hudElectrons.textContent = `Electrons: ${state.electrons.length} (valence)`;
  updateVizUI();

  // win condition: visit all rooms
  if (state.visited.size >= state.elements.length) {
    setOverlay({
      title: 'Lab Complete',
      copy: `You visited all ${state.elements.length} rooms.\n\nThis is the MVP loop: teleport → observe → learn.\n\nSubmitting completion to the hub…`,
      kicker: 'Science Lab 5.2 · Result',
      primary: 'Nice',
      secondary: 'Close',
    });
    postResult(true);
  }

  // store in URL
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('room', el.symbol);
    window.history.replaceState({}, '', url);
  } catch {
    // ignore
  }

  // store theme on state
  state.theme = theme;
}

function renderList() {
  while (roomList.firstChild) roomList.removeChild(roomList.firstChild);

  const activeSym = state.selectedSymbol;

  state.filtered.forEach((el, idx) => {
    const row = document.createElement('div');
    row.className = 'room' + (el.symbol === activeSym ? ' active' : '');
    row.tabIndex = 0;
    row.setAttribute('role', 'option');
    row.dataset.symbol = el.symbol;

    const left = document.createElement('div');
    left.className = 'room-left';

    const name = document.createElement('div');
    name.className = 'room-name';
    name.textContent = `${el.symbol} — ${el.name}`;

    const meta = document.createElement('div');
    meta.className = 'room-meta';
    meta.textContent = `#${el.number} · Period ${el.period} · Group ${el.group}`;

    left.appendChild(name);
    left.appendChild(meta);

    const right = document.createElement('div');
    right.className = 'room-badges';

    const b1 = document.createElement('span');
    b1.className = 'badge';
    b1.textContent = el.category;
    right.appendChild(b1);

    if (state.visited.has(el.symbol)) {
      const b2 = document.createElement('span');
      b2.className = 'badge good';
      b2.textContent = 'VISITED';
      right.appendChild(b2);
    }

    row.appendChild(left);
    row.appendChild(right);

    row.addEventListener('click', () => {
      state.selectedIndex = idx;
      setSelectedBySymbol(el.symbol);
    });

    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        state.selectedIndex = idx;
        setSelectedBySymbol(el.symbol);
      }
    });

    roomList.appendChild(row);
  });
}

function filterList(q) {
  const s = q.trim().toLowerCase();
  if (!s) {
    state.filtered = state.elements;
    state.selectedIndex = 0;
    renderList();
    return;
  }

  const f = state.elements.filter((e) => {
    const n = e.name.toLowerCase();
    const sym = e.symbol.toLowerCase();
    return (
      sym === s ||
      n.includes(s) ||
      String(e.number) === s ||
      `${sym}${e.number}`.includes(s)
    );
  });

  state.filtered = f.length ? f : state.elements;
  state.selectedIndex = 0;
  renderList();
}

function cycleOrbitalMode() {
  const el = currentElement();

  // Hydrogen MVP: only show 1s (s) / Auto (which resolves to 1s).
  const isTransition = String(el.category).includes('transition');
  const isFBlock = String(el.category).includes('lanthanide') || String(el.category).includes('actinide');
  const dModes = isTransition ? ['dxy', 'dxz', 'dyz', 'dx2y2', 'dz2'] : [];
  const fModes = isFBlock ? ['fxyz', 'fz3', 'fxz2', 'fyz2', 'fz_x2y2', 'fx_x23y2', 'fy_3x2y2'] : [];
  const modes = el.number === 1 ? ['auto', 's'] : ['auto', 's', 'px', 'py', 'pz', ...dModes, ...fModes];
  const i = modes.indexOf(state.orbitalMode);
  const next = modes[(i + 1) % modes.length];
  state.orbitalMode = next;
  btnMode.textContent = `Orbital: ${orbitalLabel(next)}`;

  // re-apply room to update chosen orbital
  applyRoom(el.symbol);
}

function cycleVizMode() {
  const modes = ['both', 'density', 'orbitals', 'electrons'];
  const i = modes.indexOf(state.vizMode);
  state.vizMode = modes[(i + 1) % modes.length];
  updateVizUI();
}

function measureNow() {
  for (const e of state.electrons) {
    e.lastMeasureAt = -9999;
  }
}

function backgroundTick(t) {
  const w = window.innerWidth;
  const h = window.innerHeight;

  bgCtx.clearRect(0, 0, w, h);
  const centerX = w * 0.5;
  const centerY = h * 0.35;

  const g = bgCtx.createRadialGradient(centerX, centerY, 12, centerX, centerY, Math.max(w, h) * 0.9);
  g.addColorStop(0, 'rgba(154,230,255,0.04)');
  g.addColorStop(0.55, 'rgba(122,162,255,0.10)');
  g.addColorStop(1, 'rgba(7,10,16,0.72)');
  bgCtx.fillStyle = g;
  bgCtx.fillRect(0, 0, w, h);

  // drifting glyphs
  const letters = 'ATOM|ORBITAL|LAB|DATA|ΔE|ψ|e−|n=|ℏ|科学';
  bgCtx.font = '14px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
  bgCtx.textAlign = 'center';
  bgCtx.textBaseline = 'middle';

  const count = 42;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const r = 120 + (i % 7) * 28;
    const x = centerX + Math.cos(a + t * 0.00008) * r;
    const y = centerY + Math.sin(a + t * 0.00010) * r;
    const alpha = 0.04 + (i % 6) * 0.01;
    bgCtx.fillStyle = `rgba(154,230,255,${alpha})`;
    bgCtx.fillText(letters[Math.floor((i * 7 + t * 0.002) % letters.length)], x, y);
  }
}

function drawAtom(ctx, el, theme, time) {
  const w = state.w;
  const h = state.h;
  const mid = h * 0.56;

  const vecLen = (v) => Math.max(1e-6, Math.hypot(v.x, v.y, v.z));
  const vecNorm = (v) => {
    const d = vecLen(v);
    return { x: v.x / d, y: v.y / d, z: v.z / d };
  };
  const vecDot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;

  const pickPointFromDensity = (orbital, rng) => {
    const clouds = state.density?.orbitals || {};
    const cloud = clouds[orbital];
    const pts = cloud?.points;
    if (!pts || !pts.length) return null;
    const idx = Math.floor(rng() * pts.length);
    return pts[idx];
  };

  const scaleForN = (n) => {
    // Larger n orbitals extend further, but keep within viewport.
    // We scale the sampled coordinates down slightly as n grows.
    const s = 34 + (n <= 2 ? 6 : 0);
    const maxAU = 2.6 * n; // clamp range in atomic units
    return { s, maxAU };
  };

  const findPartner = (idx) => {
    const e = state.electrons[idx];
    if (!e || e.orbCount !== 2) return null;
    // partner in same orbital: orbIndex 0 pairs with 1
    const want = e.orbIndex === 0 ? 1 : 0;
    return state.electrons.find((x) => x.orbital === e.orbital && x.orbIndex === want) || null;
  };

  const resampleTarget = (idx) => {
    const e = state.electrons[idx];
    if (!e) return;

    const { s, maxAU } = scaleForN(e.n);
    const maxTries = 10;

    // If paired, mirror partner direction for visual stability.
    const partner = findPartner(idx);
    if (partner && partner.lastMeasureAt === time && partner.tgt) {
      const d = vecNorm(partner.tgt);
      const r = vecLen(partner.tgt);
      const mirrored = { x: -d.x * r, y: -d.y * r, z: -d.z * r };
      e.tgt = mirrored;
      return;
    }

    for (let t = 0; t < maxTries; t++) {
      // Key realism improvement:
      // Pick targets from the same density cloud we render (|psi|^2) for this orbital.
      // This guarantees electrons always appear inside their orbital/density.
      const picked = pickPointFromDensity(e.orbital, e.rng);
      const candidate = picked
        ? { x: picked.x, y: picked.y, z: picked.z }
        : (() => {
            const pt = sampleOrbital(e.rng, { orbital: e.orbital, n: e.n });
            return {
              x: clamp(pt.x, -maxAU, maxAU) * s,
              y: clamp(pt.y, -maxAU, maxAU) * s,
              z: clamp(pt.z, -maxAU, maxAU) * s,
            };
          })();

      const candDir = vecNorm(candidate);

      // repulsion: avoid too-close directions with electrons in same orbital
      let ok = true;
      for (let j = 0; j < state.electrons.length; j++) {
        if (j === idx) continue;
        const o = state.electrons[j];
        if (!o || o.orbital !== e.orbital) continue;
        const od = vecNorm(o.tgt);
        const d = vecDot(candDir, od);
        if (d > 0.78) {
          ok = false;
          break;
        }
      }

      if (ok) {
        e.tgt = candidate;
        return;
      }
    }

    // fallback
    const picked = pickPointFromDensity(e.orbital, e.rng);
    if (picked) {
      e.tgt = { x: picked.x, y: picked.y, z: picked.z };
      return;
    }
    const pt = sampleOrbital(e.rng, { orbital: e.orbital, n: e.n });
    e.tgt = { x: pt.x * 34, y: pt.y * 34, z: pt.z * 34 };
  };

  // update electron target positions
  for (let i = 0; i < state.electrons.length; i++) {
    const e = state.electrons[i];
    if (time - e.lastMeasureAt > e.measureEveryMs) {
      e.lastMeasureAt = time;
      resampleTarget(i);
    }
  }

  // smooth towards targets
  const lerp = state.reducedMotion ? 1 : 0.12;
  for (const e of state.electrons) {
    e.pos.x += (e.tgt.x - e.pos.x) * lerp;
    e.pos.y += (e.tgt.y - e.pos.y) * lerp;
    e.pos.z += (e.tgt.z - e.pos.z) * lerp;
  }

  // rotate by camera drag
  const yaw = state.camera.yaw;
  const pitch = state.camera.pitch;
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);

  const rot = (p) => {
    // yaw around y axis, pitch around x axis
    let x = p.x;
    let y = p.y;
    let z = p.z;

    // yaw
    const x1 = x * cy + z * sy;
    const z1 = -x * sy + z * cy;
    x = x1;
    z = z1;

    // pitch
    const y1 = y * cp - z * sp;
    const z2 = y * sp + z * cp;
    y = y1;
    z = z2;

    return { x, y, z };
  };

  const drawDensityClouds = () => {
    if (state.reducedMotion) return;
    const clouds = state.density.orbitals || {};
    const entries = Object.entries(clouds);
    if (!entries.length) return;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    for (const [orb, cloud] of entries) {
      const pts = cloud.points;
      if (!pts || !pts.length) continue;

      // Slightly different alpha per orbital
      ctx.fillStyle = cloud.color;
      for (let i = 0; i < pts.length; i++) {
        const pt = rot(pts[i]);
        const p2 = project(pt, cx, cy2, 520);
        ctx.fillRect(p2.x, p2.y, 1, 1);
      }

      // label (tiny)
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.font = '800 11px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
      ctx.fillStyle = `hsla(${cloud.hue}, 90%, 70%, 0.35)`;
      ctx.fillText(orbitalLabel(orb), cx + 140, cy2 - 110 + (orb.charCodeAt(0) % 3) * 12);
      ctx.restore();
    }

    ctx.restore();
  };

  const drawOrbitalIsosurfaces = () => {
    // Cheap isosurface: draw translucent lobes for p orbitals and a sphere for s.
    // This gives an immediate "orbital" shape reference.
    const clouds = state.density.orbitals || {};
    const entries = Object.entries(clouds);
    if (!entries.length) return;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    const baseR = 86;

    for (const [orb, cloud] of entries) {
      const hue = cloud.hue ?? theme.hue;

      // s
      if (orb === 's') {
        const g = ctx.createRadialGradient(cx - 10, cy2 - 12, 10, cx, cy2, baseR);
        g.addColorStop(0, 'rgba(255,255,255,0.06)');
        g.addColorStop(0.25, `hsla(${hue}, 90%, 70%, 0.12)`);
        g.addColorStop(1, `hsla(${hue}, 90%, 70%, 0.0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy2, baseR, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }

      // p
      if (orb === 'px' || orb === 'py' || orb === 'pz') {
        const axis = orb === 'px' ? { x: 1, y: 0, z: 0 } : orb === 'py' ? { x: 0, y: 1, z: 0 } : { x: 0, y: 0, z: 1 };
        const lobeDist = 62;
        const lobeR = 62;

        const p1 = rot({ x: axis.x * lobeDist, y: axis.y * lobeDist, z: axis.z * lobeDist });
        const p2 = rot({ x: -axis.x * lobeDist, y: -axis.y * lobeDist, z: -axis.z * lobeDist });
        const s1 = project(p1, cx, cy2, 520);
        const s2 = project(p2, cx, cy2, 520);

        const drawLobe = (sx, sy, strength) => {
          const g = ctx.createRadialGradient(sx - 10, sy - 10, 10, sx, sy, lobeR);
          g.addColorStop(0, `hsla(${hue}, 90%, 70%, ${0.12 * strength})`);
          g.addColorStop(0.35, `hsla(${hue}, 90%, 70%, ${0.07 * strength})`);
          g.addColorStop(1, `hsla(${hue}, 90%, 70%, 0.0)`);
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(sx, sy, lobeR, 0, Math.PI * 2);
          ctx.fill();
        };

        drawLobe(s1.x, s1.y, 1);
        drawLobe(s2.x, s2.y, 0.92);

        ctx.globalAlpha = 0.25;
        ctx.strokeStyle = `hsla(${hue}, 90%, 70%, 0.35)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(s1.x, s1.y, lobeR * 0.82, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(s2.x, s2.y, lobeR * 0.82, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        continue;
      }

      // d
      const isD = orb === 'dxy' || orb === 'dxz' || orb === 'dyz' || orb === 'dx2y2' || orb === 'dz2';
      if (isD) {
        const lobeR = 44;
        const dist = 64;

        const drawDLobe = (p, strength = 1) => {
          const pp = project(rot(p), cx, cy2, 520);
          const g = ctx.createRadialGradient(pp.x - 8, pp.y - 8, 8, pp.x, pp.y, lobeR);
          g.addColorStop(0, `hsla(${hue}, 90%, 70%, ${0.12 * strength})`);
          g.addColorStop(0.5, `hsla(${hue}, 90%, 70%, ${0.06 * strength})`);
          g.addColorStop(1, `hsla(${hue}, 90%, 70%, 0.0)`);
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(pp.x, pp.y, lobeR, 0, Math.PI * 2);
          ctx.fill();
        };

        if (orb === 'dz2') {
          drawDLobe({ x: 0, y: 0, z: dist }, 1);
          drawDLobe({ x: 0, y: 0, z: -dist }, 0.95);
          ctx.save();
          ctx.globalAlpha = 0.18;
          ctx.strokeStyle = `hsla(${hue}, 90%, 70%, 0.45)`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(cx, cy2, 86, 28, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        } else if (orb === 'dx2y2') {
          drawDLobe({ x: dist, y: 0, z: 0 }, 1);
          drawDLobe({ x: -dist, y: 0, z: 0 }, 0.95);
          drawDLobe({ x: 0, y: dist, z: 0 }, 0.95);
          drawDLobe({ x: 0, y: -dist, z: 0 }, 0.92);
        } else if (orb === 'dxy') {
          drawDLobe({ x: dist * 0.72, y: dist * 0.72, z: 0 }, 1);
          drawDLobe({ x: -dist * 0.72, y: dist * 0.72, z: 0 }, 0.95);
          drawDLobe({ x: dist * 0.72, y: -dist * 0.72, z: 0 }, 0.95);
          drawDLobe({ x: -dist * 0.72, y: -dist * 0.72, z: 0 }, 0.92);
        } else if (orb === 'dxz') {
          drawDLobe({ x: dist * 0.72, y: 0, z: dist * 0.72 }, 1);
          drawDLobe({ x: -dist * 0.72, y: 0, z: dist * 0.72 }, 0.95);
          drawDLobe({ x: dist * 0.72, y: 0, z: -dist * 0.72 }, 0.95);
          drawDLobe({ x: -dist * 0.72, y: 0, z: -dist * 0.72 }, 0.92);
        } else if (orb === 'dyz') {
          drawDLobe({ x: 0, y: dist * 0.72, z: dist * 0.72 }, 1);
          drawDLobe({ x: 0, y: -dist * 0.72, z: dist * 0.72 }, 0.95);
          drawDLobe({ x: 0, y: dist * 0.72, z: -dist * 0.72 }, 0.95);
          drawDLobe({ x: 0, y: -dist * 0.72, z: -dist * 0.72 }, 0.92);
        }

        continue;
      }

      // f
      const isF =
        orb === 'fxyz' ||
        orb === 'fz3' ||
        orb === 'fxz2' ||
        orb === 'fyz2' ||
        orb === 'fz_x2y2' ||
        orb === 'fx_x23y2' ||
        orb === 'fy_3x2y2';

      if (isF) {
        // f orbitals are complex; this is a proxy: many small lobes in distinctive arrangements.
        const lobeR = 34;
        const dist = 66;

        const drawFLobe = (p, strength = 1) => {
          const pp = project(rot(p), cx, cy2, 520);
          const g = ctx.createRadialGradient(pp.x - 7, pp.y - 7, 7, pp.x, pp.y, lobeR);
          g.addColorStop(0, `hsla(${hue}, 90%, 70%, ${0.11 * strength})`);
          g.addColorStop(0.55, `hsla(${hue}, 90%, 70%, ${0.05 * strength})`);
          g.addColorStop(1, `hsla(${hue}, 90%, 70%, 0.0)`);
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(pp.x, pp.y, lobeR, 0, Math.PI * 2);
          ctx.fill();
        };

        const c = 0.68;
        const corners = [
          { x: dist * c, y: dist * c, z: dist * c },
          { x: -dist * c, y: dist * c, z: dist * c },
          { x: dist * c, y: -dist * c, z: dist * c },
          { x: -dist * c, y: -dist * c, z: dist * c },
          { x: dist * c, y: dist * c, z: -dist * c },
          { x: -dist * c, y: dist * c, z: -dist * c },
          { x: dist * c, y: -dist * c, z: -dist * c },
          { x: -dist * c, y: -dist * c, z: -dist * c },
        ];

        if (orb === 'fxyz') {
          // 8-lobe cube corners
          for (let i = 0; i < corners.length; i++) drawFLobe(corners[i], 1);
        } else if (orb === 'fz3') {
          // strong along z plus a belt
          drawFLobe({ x: 0, y: 0, z: dist * 1.05 }, 1);
          drawFLobe({ x: 0, y: 0, z: -dist * 1.05 }, 0.96);
          drawFLobe({ x: dist, y: 0, z: 0 }, 0.7);
          drawFLobe({ x: -dist, y: 0, z: 0 }, 0.7);
          drawFLobe({ x: 0, y: dist, z: 0 }, 0.7);
          drawFLobe({ x: 0, y: -dist, z: 0 }, 0.7);
        } else if (orb === 'fxz2') {
          // lobes biased in x and z
          drawFLobe({ x: dist, y: 0, z: dist * 0.8 }, 1);
          drawFLobe({ x: -dist, y: 0, z: dist * 0.8 }, 0.95);
          drawFLobe({ x: dist, y: 0, z: -dist * 0.8 }, 0.95);
          drawFLobe({ x: -dist, y: 0, z: -dist * 0.8 }, 0.92);
          drawFLobe({ x: dist * 0.55, y: 0, z: 0 }, 0.7);
          drawFLobe({ x: -dist * 0.55, y: 0, z: 0 }, 0.7);
        } else if (orb === 'fyz2') {
          drawFLobe({ x: 0, y: dist, z: dist * 0.8 }, 1);
          drawFLobe({ x: 0, y: -dist, z: dist * 0.8 }, 0.95);
          drawFLobe({ x: 0, y: dist, z: -dist * 0.8 }, 0.95);
          drawFLobe({ x: 0, y: -dist, z: -dist * 0.8 }, 0.92);
          drawFLobe({ x: 0, y: dist * 0.55, z: 0 }, 0.7);
          drawFLobe({ x: 0, y: -dist * 0.55, z: 0 }, 0.7);
        } else if (orb === 'fz_x2y2') {
          // four in xy plus z
          drawFLobe({ x: dist, y: 0, z: dist * 0.55 }, 1);
          drawFLobe({ x: -dist, y: 0, z: dist * 0.55 }, 0.95);
          drawFLobe({ x: 0, y: dist, z: -dist * 0.55 }, 0.95);
          drawFLobe({ x: 0, y: -dist, z: -dist * 0.55 }, 0.92);
          drawFLobe({ x: 0, y: 0, z: dist }, 0.75);
          drawFLobe({ x: 0, y: 0, z: -dist }, 0.72);
        } else if (orb === 'fx_x23y2') {
          // 6-lobe flower in xy
          drawFLobe({ x: dist, y: 0, z: 0 }, 1);
          drawFLobe({ x: -dist, y: 0, z: 0 }, 0.95);
          drawFLobe({ x: dist * 0.5, y: dist * 0.86, z: 0 }, 0.92);
          drawFLobe({ x: -dist * 0.5, y: dist * 0.86, z: 0 }, 0.90);
          drawFLobe({ x: dist * 0.5, y: -dist * 0.86, z: 0 }, 0.92);
          drawFLobe({ x: -dist * 0.5, y: -dist * 0.86, z: 0 }, 0.90);
        } else {
          // fy_3x2y2
          drawFLobe({ x: 0, y: dist, z: 0 }, 1);
          drawFLobe({ x: 0, y: -dist, z: 0 }, 0.95);
          drawFLobe({ x: dist * 0.86, y: dist * 0.5, z: 0 }, 0.92);
          drawFLobe({ x: dist * 0.86, y: -dist * 0.5, z: 0 }, 0.90);
          drawFLobe({ x: -dist * 0.86, y: dist * 0.5, z: 0 }, 0.92);
          drawFLobe({ x: -dist * 0.86, y: -dist * 0.5, z: 0 }, 0.90);
        }

        continue;
      }
    }

    ctx.restore();
  };

  const drawAxes = () => {
    // Reference coordinates widget
    const ox = 92;
    const oy = h - 92;
    const dist = 220;
    const scale = 38;

    const basis = [
      { v: { x: scale, y: 0, z: 0 }, c: 'rgba(255,120,120,0.90)', label: 'x' },
      { v: { x: 0, y: scale, z: 0 }, c: 'rgba(140,255,170,0.90)', label: 'y' },
      { v: { x: 0, y: 0, z: scale }, c: 'rgba(140,200,255,0.92)', label: 'z' },
    ];

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.lineWidth = 2;
    ctx.font = '800 12px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    // origin dot
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.arc(ox, oy, 3, 0, Math.PI * 2);
    ctx.fill();

    for (const b of basis) {
      const end = project(rot(b.v), ox, oy, dist);
      ctx.strokeStyle = b.c;
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      ctx.fillStyle = b.c;
      ctx.fillText(b.label, end.x + 6, end.y);
    }

    // label
    ctx.fillStyle = 'rgba(154,230,255,0.55)';
    ctx.fillText('coords', ox + 10, oy + 26);
    ctx.restore();
  };

  // nucleus
  const cx = w * 0.5;
  const cy2 = mid + 8;

  // glow under atom
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const gg = ctx.createRadialGradient(cx, cy2, 10, cx, cy2, 240);
  gg.addColorStop(0, 'rgba(154,230,255,0.10)');
  gg.addColorStop(0.6, 'rgba(122,162,255,0.03)');
  gg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gg;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // Visualization layers
  // 1) Orbital isosurface shapes (lobes/sphere)
  if (state.vizMode === 'both' || state.vizMode === 'orbitals') {
    drawOrbitalIsosurfaces();
  }

  // 2) Probability density clouds (|psi|^2)
  if (state.vizMode === 'both' || state.vizMode === 'density') {
    drawDensityClouds();
  }

  // draw nucleus
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const ng = ctx.createRadialGradient(cx - 6, cy2 - 6, 4, cx, cy2, 28);
  ng.addColorStop(0, 'rgba(255,255,255,0.95)');
  ng.addColorStop(0.25, 'rgba(154,230,255,0.65)');
  ng.addColorStop(1, 'rgba(122,162,255,0.05)');
  ctx.fillStyle = ng;
  ctx.beginPath();
  ctx.arc(cx, cy2, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 3) Electron points (measurement samples)
  if (state.vizMode === 'both' || state.vizMode === 'electrons') {
    for (let i = 0; i < state.electrons.length; i++) {
      const ee = state.electrons[i];
      const e = rot(ee.pos);
      const pe = project(e, cx, cy2, 520);

      // Color electrons by orbital (matches the density/orbital color)
      const hue = state.density?.orbitals?.[ee.orbital]?.hue ?? ((theme.hue + i * 22) % 360);
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const eg = ctx.createRadialGradient(pe.x - 2, pe.y - 2, 1, pe.x, pe.y, 12);
      eg.addColorStop(0, 'rgba(255,255,255,0.95)');
      eg.addColorStop(0.25, `hsla(${hue}, 90%, 70%, 0.78)`);
      eg.addColorStop(1, `hsla(${hue}, 90%, 70%, 0.0)`);
      ctx.fillStyle = eg;
      ctx.beginPath();
      ctx.arc(pe.x, pe.y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // subtle orbit ring (helps readability)
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.strokeStyle = 'rgba(154,230,255,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(cx, cy2, 86, 42, yaw * 0.25, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  drawAxes();
}

function project(p, cx, cy, dist) {
  const z = p.z + dist;
  const s = dist / Math.max(50, z);
  return { x: cx + p.x * s, y: cy - p.y * s };
}

function draw(t) {
  state.time = t;

  // fade teleport
  if (state.fade.active && !state.reducedMotion) {
    state.fade.t += 1 / 60;
    const k = clamp(state.fade.t / 0.5, 0, 1);

    if (state.fade.dir === 1 && k >= 1) {
      applyRoom(state.fade.nextSymbol);
      state.fade.dir = -1;
      state.fade.t = 0;
    }

    if (state.fade.dir === -1 && k >= 1) {
      state.fade.active = false;
    }
  }

  const w = state.w;
  const h = state.h;
  ctx.clearRect(0, 0, w, h);

  const el = currentElement();
  const theme = state.theme || elementTheme(el);

  drawRoomBackdrop(ctx, w, h, theme, state.tex, t, state.camera);
  drawWallDecals(ctx, w, h, el, theme, t);
  drawAtom(ctx, el, theme, t);

  // teleport fade overlay
  if (state.fade.active && !state.reducedMotion) {
    const k = clamp(state.fade.t / 0.5, 0, 1);
    const alpha = state.fade.dir === 1 ? k : 1 - k;
    ctx.save();
    ctx.fillStyle = `rgba(0,0,0,${clamp(alpha, 0, 1)})`;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  if (!state.reducedMotion) {
    backgroundTick(t);
  }

  requestAnimationFrame(draw);
}

function showInfo() {
  const el = currentElement();
  setOverlay({
    title: `${el.name} (${el.symbol})`,
    copy:
      `Atomic #: ${el.number} · Mass: ${el.mass} u\n` +
      `Category: ${el.category} · Period: ${el.period} · Group: ${el.group}\n\n` +
      `Visualization modes:\n` +
      `- Electrons: discrete “measurement samples” (points).\n` +
      `- Density: probability density cloud (|ψ|²) for the orbitals in this room.\n` +
      `- Orbitals: simplified orbital isosurfaces (s sphere / p lobes).\n` +
      `- Both: combined view.\n\n` +
      `Science Lab 5.2 uses hydrogenic-inspired orbital sampling (s/p) plus a valence-electron approximation for readability.\n` +
      `Electron points are sampled from the orbital probability density (|ψ|²). In this build, targets are chosen directly from the same density cloud that is rendered in the background, so points stay inside their orbitals.\n` +
      `When two electrons share the same orbital, we display them as opposite samples to avoid clustering (a readability + repulsion cue).\n\n` +
      `Controls: drag to rotate · scroll to zoom · press Measure to collapse to a fresh sample.`,
    primary: 'Continue',
    secondary: 'Close',
  });
}

function showQuiz() {
  const el = currentElement();
  const q = getQuizForElement(el);
  state.quiz.active = true;
  state.quiz.answered = false;
  state.quiz.current = q;

  overlay.hidden = false;
  overlayKicker.textContent = 'Science Lab 5.2 · Quiz';
  overlayTitle.textContent = `${el.name} (${el.symbol})`;
  overlayCopy.textContent = q.prompt;

  overlayPrimary.textContent = 'Close';
  overlaySecondary.textContent = 'Close';

  if (overlayOptions) overlayOptions.replaceChildren();

  q.choices.forEach((choice, idx) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn option';
    b.textContent = choice;
    b.addEventListener('click', () => answerQuiz(idx));
    overlayOptions.appendChild(b);
  });
}

function answerQuiz(idx) {
  if (!state.quiz.active || state.quiz.answered) return;
  const q = state.quiz.current;
  if (!q) return;
  state.quiz.answered = true;

  const buttons = [...overlayOptions.querySelectorAll('button')];
  buttons.forEach((b, i) => {
    if (i === q.correctIndex) b.classList.add('good');
    if (i === idx && idx !== q.correctIndex) b.classList.add('bad');
    b.disabled = true;
  });

  const explain = document.createElement('div');
  explain.style.marginTop = '0.65rem';
  explain.style.color = 'rgba(255,255,255,0.78)';
  explain.style.lineHeight = '1.5';
  explain.textContent = (idx === q.correctIndex ? 'Correct. ' : 'Not quite. ') + q.explain;
  overlayOptions.appendChild(explain);
}

function resetProgress() {
  state.visited = new Set();
  saveVisited();
  updateProgressUI();
  renderList();
  const el = currentElement();
  applyRoom(el.symbol);

  setOverlay({
    title: 'Reset complete',
    copy: 'Visited rooms cleared.',
    primary: 'Ok',
    secondary: 'Close',
  });
}

function tryFullscreen() {
  const el = document.documentElement;
  const fn = el.requestFullscreen || el.webkitRequestFullscreen;
  if (fn) fn.call(el);
}

function wireEvents() {
  search.addEventListener('input', () => filterList(search.value));

  btnInfo.addEventListener('click', showInfo);
  btnQuiz.addEventListener('click', showQuiz);
  btnViz.addEventListener('click', cycleVizMode);
  btnMode.addEventListener('click', cycleOrbitalMode);
  btnMeasure.addEventListener('click', measureNow);
  btnReset.addEventListener('click', resetProgress);
  btnFullscreen.addEventListener('click', tryFullscreen);

  overlayPrimary.addEventListener('click', () => hideOverlay());
  overlaySecondary.addEventListener('click', () => hideOverlay());

  // Keyboard navigation inside list
  window.addEventListener('keydown', (e) => {
    if (!overlay.hidden) {
      if (e.key === 'Escape') hideOverlay();
      return;
    }

    if (e.key === 'i' || e.key === 'I') {
      e.preventDefault();
      showInfo();
      return;
    }

    if (e.key === 'Enter') {
      const el = state.filtered[state.selectedIndex];
      if (el) setSelectedBySymbol(el.symbol);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      state.selectedIndex = (state.selectedIndex + 1) % state.filtered.length;
      const el = state.filtered[state.selectedIndex];
      if (el) {
        state.selectedSymbol = el.symbol;
        renderList();
        const row = roomList.querySelector(`[data-symbol="${el.symbol}"]`);
        if (row) row.scrollIntoView({ block: 'nearest' });
      }
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      state.selectedIndex = (state.selectedIndex - 1 + state.filtered.length) % state.filtered.length;
      const el = state.filtered[state.selectedIndex];
      if (el) {
        state.selectedSymbol = el.symbol;
        renderList();
        const row = roomList.querySelector(`[data-symbol="${el.symbol}"]`);
        if (row) row.scrollIntoView({ block: 'nearest' });
      }
    }
  });

  // Drag rotate
  const onDown = (e) => {
    state.dragging = true;
    state.lastX = e.clientX;
    state.lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  };

  const onMove = (e) => {
    if (!state.dragging) return;
    const dx = e.clientX - state.lastX;
    const dy = e.clientY - state.lastY;
    state.lastX = e.clientX;
    state.lastY = e.clientY;

    state.camera.yaw += dx * 0.008;
    state.camera.pitch = clamp(state.camera.pitch + dy * 0.006, -0.9, 0.9);
  };

  const onUp = () => {
    state.dragging = false;
  };

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);

  // Zoom
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const dz = e.deltaY > 0 ? 0.95 : 1.05;
    state.camera.zoom = clamp(state.camera.zoom * dz, 0.75, 1.5);
  }, { passive: false });
}

function boot() {
  state.tex = makeTextures();
  loadVisited();
  updateProgressUI();

  // initial selection from URL
  const url = new URL(window.location.href);
  const qRoom = url.searchParams.get('room');
  const initial = qRoom && state.elements.some((e) => e.symbol === qRoom) ? qRoom : state.elements[0].symbol;

  state.selectedSymbol = initial;
  renderList();
  applyRoom(initial);

  setOverlay({
    title: 'Welcome to Science Lab 5.2',
    copy:
      `This is a fresh rework focused on stability and clarity.\n\n` +
      `Goal: explore the full periodic table (${state.elements.length} rooms). Each room shows quantized electron visualization via orbitals and probability density.\n\n` +
      `Teleport by selecting an element on the left.`,
    primary: 'Start',
    secondary: 'Close',
  });

  wireEvents();
  resize();
  requestAnimationFrame(draw);
}

window.addEventListener('resize', resize);
boot();
