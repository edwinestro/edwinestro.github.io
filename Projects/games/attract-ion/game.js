(() => {
  const canvas = document.getElementById('scene');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const prompt = document.getElementById('prompt');
  const promptTitle = document.getElementById('promptTitle');
  const promptBody = document.getElementById('promptBody');
  const promptAction = document.getElementById('promptAction');
  const promptSkip = document.getElementById('promptSkip');
  const promptLevels = document.getElementById('promptLevels');
  const promptExpansion = document.getElementById('promptExpansion');
  const promptStats = document.getElementById('promptStats');
  const promptEncourage = document.getElementById('promptEncourage');
  const promptTest = document.getElementById('promptTest');
  const statHoldTime = document.getElementById('statHoldTime');
  const statStability = document.getElementById('statStability');
  const statAttempts = document.getElementById('statAttempts');
  const statProgress = document.getElementById('statProgress');

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
  const hudThermo = document.getElementById('hudThermo');
  const thermoTarget = document.getElementById('thermoTarget');
  const thermoCompounds = document.getElementById('thermoCompounds');
  const thermoPhase = document.getElementById('thermoPhase');
  const thermoTemp = document.getElementById('thermoTemp');
  const thermoPressure = document.getElementById('thermoPressure');
  const thermoVolume = document.getElementById('thermoVolume');
  const orbitHint = document.getElementById('orbitHint');
  const orbitHintTitle = document.getElementById('orbitHintTitle');
  const orbitHintSub = document.getElementById('orbitHintSub');

  const controlPad = document.getElementById('controlPad');
  const btnPull = document.getElementById('btnPull');
  const btnCool = document.getElementById('btnCool');
  const btnHeat = document.getElementById('btnHeat');
  const btnPressureUp = document.getElementById('btnPressureUp');
  const btnPressureDown = document.getElementById('btnPressureDown');
  const btnVolumeUp = document.getElementById('btnVolumeUp');
  const btnVolumeDown = document.getElementById('btnVolumeDown');
  const moleculeOptions = document.getElementById('moleculeOptions');
  const btnMol10 = document.getElementById('btnMol10');
  const btnMol10000 = document.getElementById('btnMol10000');
  const btnMol10b = document.getElementById('btnMol10b');
  const btnSound = document.getElementById('btnSound');
  const btnPause = document.getElementById('btnPause');

  const pauseOverlay = document.getElementById('pauseOverlay');
  const pauseResume = document.getElementById('pauseResume');
  const pauseRestart = document.getElementById('pauseRestart');

  const tutorialOverlay = document.getElementById('tutorialOverlay');
  const tutorialDots = document.getElementById('tutorialDots');
  const tutorialTitle = document.getElementById('tutorialTitle');
  const tutorialBody = document.getElementById('tutorialBody');
  const tutorialNext = document.getElementById('tutorialNext');
  const tutorialSkip = document.getElementById('tutorialSkip');

  const levelSelectOverlay = document.getElementById('levelSelect');
  const levelGrid = document.getElementById('levelGrid');
  const levelSelectBack = document.getElementById('levelSelectBack');
  const levelSelectTitle = levelSelectOverlay ? levelSelectOverlay.querySelector('.level-select-title') : null;
  const levelSelectSub = levelSelectOverlay ? levelSelectOverlay.querySelector('.level-select-sub') : null;

  const toastEl = document.getElementById('toast');

  const levels = [
    { track: 'core', name: 'Hydrogen', symbol: 'H', electrons: 1, holdTime: 4.5, protons: 1, neutrons: 0, desc: 'Keep one electron in orbit for 4.5 seconds.' },
    { track: 'core', name: 'Helium', symbol: 'He', electrons: 2, holdTime: 5.4, protons: 2, neutrons: 2, desc: 'Manage two electrons and hold for 5.4 seconds.' },
    { track: 'core', name: 'Lithium', symbol: 'Li', electrons: 2, holdTime: 6, protons: 3, neutrons: 4, desc: 'Keep both electrons stable for 6 seconds.' },
    { track: 'core', name: 'Beryllium', symbol: 'Be', electrons: 3, holdTime: 6.3, protons: 4, neutrons: 5, desc: 'Control three electrons for 6.3 seconds.' },
    { track: 'core', name: 'Boron', symbol: 'B', electrons: 3, holdTime: 6.8, protons: 5, neutrons: 6, desc: 'Final atom: stabilize three electrons for 6.8 seconds.' },
    {
      track: 'expansion',
      name: 'H2O Cooling Basin',
      symbol: 'H₂O-I',
      electrons: 1,
      holdTime: 6,
      protons: 10,
      neutrons: 8,
      desc: 'Expansion Attraction: cool down many H2O compounds with pressure, volume, and temperature control.',
      waterCompounds: 160,
      waterTargetPhase: 'ice',
      waterTargetTempK: 263,
      expansionTiers: [
        { name: 'Hot', durationSec: 1.3, bandMultiplier: 1.08, graceMultiplier: 1.06, driftMultiplier: 0.95, cue: 'Frequent access, fast response.' },
        { name: 'Cool', durationSec: 1.5, bandMultiplier: 1, graceMultiplier: 1, driftMultiplier: 1, cue: 'Usage declines, precision matters.' },
        { name: 'Cold', durationSec: 1.7, bandMultiplier: 0.95, graceMultiplier: 0.93, driftMultiplier: 1.08, cue: 'Rare access, higher handling cost.' },
        { name: 'Archive', durationSec: 2, bandMultiplier: 0.9, graceMultiplier: 0.88, driftMultiplier: 1.14, cue: 'Offline-like latency, stay calm.' },
      ],
    },
    {
      track: 'expansion',
      name: 'H2O Cryo Vault',
      symbol: 'H₂O-II',
      electrons: 3,
      holdTime: 7.4,
      protons: 10,
      neutrons: 8,
      desc: 'Expansion Attraction: high-inertia H2O cooling target with stricter thermal control.',
      waterCompounds: 260,
      waterTargetPhase: 'ice',
      waterTargetTempK: 258,
      expansionTiers: [
        { name: 'Hot', durationSec: 1.2, bandMultiplier: 1.02, graceMultiplier: 1, driftMultiplier: 1, cue: 'High throughput orbit.' },
        { name: 'Cool', durationSec: 1.4, bandMultiplier: 0.98, graceMultiplier: 0.96, driftMultiplier: 1.05, cue: 'Balanced storage tier.' },
        { name: 'Cold', durationSec: 1.6, bandMultiplier: 0.92, graceMultiplier: 0.9, driftMultiplier: 1.12, cue: 'Cost-optimized but stricter control.' },
        { name: 'Archive', durationSec: 2.2, bandMultiplier: 0.86, graceMultiplier: 0.84, driftMultiplier: 1.2, cue: 'Rehydration challenge mode.' },
      ],
    },
  ];

  const config = {
    k: 380000,
    damping: 0.035,
    targetRadius: 120,
    bandFraction: 0.28,
    coreRadius: 22,
    escapeRadius: 290,
    softening: 55,
    driftForce: 3.2,
    grace: 5,
    fieldStep: 0.3,
    fieldMin: -2.2,
    fieldMax: 0,
    fieldScale: 50,
    fieldResponse: 7.5,
    wheelThreshold: 45,
    maxSpeed: 170,
    fov: 520,
    tiltX: -0.55,
    tiltY: 0.45,
    wobble: 0.08,
    kRepel: 120000,
    repelSoftening: 40,
    frameRadius: 280,
    electronColors: [
      { main: 'rgba(255,255,255,0.9)', ring: 'rgba(154,230,255,0.6)', trail: '154,230,255', label: 'e⁻₁' },
      { main: 'rgba(255,220,255,0.9)', ring: 'rgba(255,140,220,0.6)', trail: '255,140,220', label: 'e⁻₂' },
      { main: 'rgba(210,255,220,0.92)', ring: 'rgba(138,255,168,0.58)', trail: '138,255,168', label: 'e⁻₃' },
    ],
  };

  const tutorialSteps = [
    { title: 'Welcome', body: 'Keep electrons inside the <strong>green band</strong> around the nucleus.' },
    { title: 'Pull Control', body: 'Use <span class="key">Scroll Down</span>, hold <strong>Space</strong>, or hold <strong>ArrowDown</strong> to pull inward.' },
    { title: 'Selection', body: 'In multi-electron levels, move near an electron to select it.' },
    { title: 'Win Condition', body: 'Hold all electrons in-band for the target time. You have <strong>5 hearts</strong>.' },
  ];

  const defaultTierProfile = { name: 'Core', durationSec: Infinity, bandMultiplier: 1, graceMultiplier: 1, driftMultiplier: 1, cue: 'Core campaign physics.' };
  const moleculePresets = [10, 10000, 10000000000];
  const moleculeFormatter = new Intl.NumberFormat('en-US');

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  const session = {
    attempts: 0,
    bestHoldTime: 0,
    bestStability: 0,
    totalPlayTime: 0,
    tutorialDone: localStorage.getItem('attractionTutorialDone') === 'true',
    soundEnabled: localStorage.getItem('attractionSound') !== 'false',
  };

  const progress = {
    completed: [],
    bestTimes: {},
    bestStars: {},
    attemptsByLevel: {},
  };

  const playtest = {
    history: [],
  };

  function loadProgress() {
    try {
      const raw = localStorage.getItem('attractionProgress');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      progress.completed = parsed.completed || [];
      progress.bestTimes = parsed.bestTimes || {};
      progress.bestStars = parsed.bestStars || {};
      progress.attemptsByLevel = parsed.attemptsByLevel || {};
    } catch (_) {}
  }

  function saveProgress() {
    try {
      localStorage.setItem('attractionProgress', JSON.stringify(progress));
    } catch (_) {}
  }

  function loadPlaytestHistory() {
    try {
      const raw = localStorage.getItem('attractionPlaytestHistory');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) playtest.history = parsed.slice(0, 30);
    } catch (_) {}
  }

  function savePlaytestHistory() {
    try {
      localStorage.setItem('attractionPlaytestHistory', JSON.stringify(playtest.history.slice(0, 30)));
    } catch (_) {}
  }

  function loadSession() {
    try {
      const raw = sessionStorage.getItem('attractionSession');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      session.attempts = parsed.attempts || 0;
      session.bestHoldTime = parsed.bestHoldTime || 0;
      session.bestStability = parsed.bestStability || 0;
      session.totalPlayTime = parsed.totalPlayTime || 0;
    } catch (_) {}
  }

  function saveSession() {
    try {
      sessionStorage.setItem('attractionSession', JSON.stringify({
        attempts: session.attempts,
        bestHoldTime: session.bestHoldTime,
        bestStability: session.bestStability,
        totalPlayTime: session.totalPlayTime,
      }));
    } catch (_) {}
  }

  loadProgress();
  loadSession();
  loadPlaytestHistory();

  let audioCtx = null;
  function initAudio() {
    if (audioCtx) return;
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) {}
  }

  function tone(freq, dur, type, v0, v1) {
    if (!audioCtx || !session.soundEnabled) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(v0 || 0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.001, v1 || 0.01), audioCtx.currentTime + dur);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + dur);
    } catch (_) {}
  }

  const stars = Array.from({ length: 3 }, () => []);

  const state = {
    phase: 'intro',
    currentLevel: 0,
    time: 0,
    lastTime: 0,
    lives: 5,
    maxLives: 5,
    paused: false,
    fieldBias: 0,
    fieldBiasTarget: 0,
    pullIntensity: 0,
    wheelAccum: 0,
    electrons: [],
    selectedIndex: 0,
    cursorX: 0,
    cursorY: 0,
    cursorOnCanvas: false,
    keyboardPull: false,
    simStartTime: 0,
    failReason: null,
    snapshot: { holdTime: 0, peakStability: 0 },
    assistLevel: 0,
    assistBandBonus: 0,
    assistGraceBonus: 0,
    assistDriftScale: 1,
    assistDecayScale: 1,
    tutorialIndex: 0,
    lastMilestone: 0,
    levelSelectFilter: 'core',
    expansionTierIndex: 0,
    expansionTierElapsed: 0,
    thermo: {
      active: false,
      compounds: 0,
      selectedCompounds: 10000,
      temperatureK: 295,
      pressureAtm: 1,
      volumeL: 12,
      targetPhase: 'ice',
      targetTempK: 263,
      phase: 'liquid',
      targetSatisfied: false,
      targetStableTime: 0,
    },
    keyboardPullCooldown: 0,
    runMetrics: null,
    lastRunReport: null,
  };

  function currentLevel() {
    return levels[state.currentLevel] || levels[0];
  }

  function levelTrack(levelIndex) {
    const level = levels[levelIndex];
    return level && level.track ? level.track : 'core';
  }

  function firstLevelIndexByTrack(track) {
    const found = levels.findIndex(level => (level.track || 'core') === track);
    return found >= 0 ? found : 0;
  }

  function levelIndicesByTrack(track) {
    return levels.map((level, index) => ({ level, index }))
      .filter(item => (item.level.track || 'core') === track)
      .map(item => item.index);
  }

  function nextLevelIndexInTrack(levelIndex) {
    const track = levelTrack(levelIndex);
    const trackIndices = levelIndicesByTrack(track);
    const pos = trackIndices.indexOf(levelIndex);
    if (pos < 0 || pos >= trackIndices.length - 1) return null;
    return trackIndices[pos + 1];
  }

  function levelOrdinalInTrack(levelIndex) {
    const track = levelTrack(levelIndex);
    const trackIndices = levelIndicesByTrack(track);
    const pos = trackIndices.indexOf(levelIndex);
    return {
      current: pos >= 0 ? pos + 1 : 1,
      total: Math.max(1, trackIndices.length),
    };
  }

  function currentTierProfile() {
    const level = currentLevel();
    if (!level.expansionTiers || level.expansionTiers.length === 0) return defaultTierProfile;
    const idx = clamp(state.expansionTierIndex, 0, level.expansionTiers.length - 1);
    return level.expansionTiers[idx];
  }

  function isWaterCoolingLevel() {
    const level = currentLevel();
    return levelTrack(state.currentLevel) === 'expansion' && !!level.waterCompounds;
  }

  function thermoPhaseAt(tempK, pressureAtm) {
    if (tempK <= 273.15 && pressureAtm >= 0.75) return 'ice';
    if (tempK >= 373.15 || (pressureAtm <= 0.75 && tempK >= 325)) return 'vapor';
    return 'liquid';
  }

  function refreshThermoPhase() {
    state.thermo.phase = thermoPhaseAt(state.thermo.temperatureK, state.thermo.pressureAtm);
  }

  // ═══════════════════════════════════════
  // H2O Density Field (10,000,000 molecules)
  // ═══════════════════════════════════════
  const FIELD_W = 400;
  const FIELD_H = 280;
  const TOTAL_MOLECULES = 10000000;
  let densityField = null;
  let densityNext = null;
  let densityImageData = null;
  let densityCanvas = null;
  let densityCtx = null;
  let fieldReady = false;

  function containerBounds() {
    const cx = canvas.clientWidth / 2;
    const cy = canvas.clientHeight / 2 + 10;
    const vol = state.thermo.active ? state.thermo.volumeL : 12;
    const half = 70 + (vol / 24) * 190;
    return { left: cx - half, right: cx + half, top: cy - half * 0.65, bottom: cy + half * 0.65 };
  }

  function initDensityField() {
    densityField = new Float64Array(FIELD_W * FIELD_H);
    densityNext = new Float64Array(FIELD_W * FIELD_H);
    if (!densityCanvas) {
      densityCanvas = document.createElement('canvas');
      densityCanvas.width = FIELD_W;
      densityCanvas.height = FIELD_H;
      densityCtx = densityCanvas.getContext('2d');
    }
    densityImageData = densityCtx.createImageData(FIELD_W, FIELD_H);
    const perCell = TOTAL_MOLECULES / (FIELD_W * FIELD_H);
    for (let i = 0; i < densityField.length; i++) {
      densityField[i] = perCell * (0.85 + Math.random() * 0.3);
    }
    fieldReady = true;
  }

  function updateDensityField(dt) {
    if (!state.thermo.active) return;
    if (!fieldReady) initDensityField();

    const temp = state.thermo.temperatureK;
    const phase = state.thermo.phase;
    const pressure = state.thermo.pressureAtm;
    const w = FIELD_W, h = FIELD_H;
    const sDt = Math.min(dt, 0.033);

    let diff;
    if (phase === 'ice')        diff = 0.003 * Math.max(0.1, (temp - 200) / 73);
    else if (phase === 'vapor') diff = 0.4 * Math.sqrt(temp / 373);
    else                        diff = 0.11 * (temp / 293);

    let gravY = 0, convX = 0, convY = 0;
    if (phase === 'liquid') { gravY = 0.32 * (1 + pressure * 0.3); }
    else if (phase === 'vapor') { convY = -0.22 * (temp / 373); convX = Math.sin(state.time * 0.0008) * 0.07; }

    const isIce = phase === 'ice';
    const crystalStr = isIce ? clamp((273 - temp) / 50, 0, 1) * 0.55 : 0;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        const c = densityField[idx];
        if (c < 0.0005) { densityNext[idx] = 0; continue; }

        const left  = x > 0     ? densityField[idx - 1] : c;
        const right = x < w - 1 ? densityField[idx + 1] : c;
        const up    = y > 0     ? densityField[idx - w] : c;
        const down  = y < h - 1 ? densityField[idx + w] : c;
        let nv = c + (left + right + up + down - 4 * c) * diff;

        if (gravY > 0 && y < h - 1) {
          const flow = c * gravY * sDt;
          nv -= flow;
          densityNext[idx + w] += flow;
        }
        if (convY < 0 && y > 0) {
          const flow = c * Math.abs(convY) * sDt;
          nv -= flow;
          densityNext[idx - w] += flow;
        }
        if (Math.abs(convX) > 0.001) {
          const dir = convX > 0 ? 1 : -1;
          const nx = x + dir;
          if (nx >= 0 && nx < w) {
            const flow = c * Math.abs(convX) * sDt;
            nv -= flow;
            densityNext[idx + dir] += flow;
          }
        }

        if (crystalStr > 0) {
          const gs = 4;
          const row = Math.round(y / (gs * 0.866));
          const gx = Math.round((x - (row % 2) * gs * 0.5) / gs) * gs + (row % 2) * gs * 0.5;
          const gy = row * gs * 0.866;
          const dist2 = (x - gx) * (x - gx) + (y - gy) * (y - gy);
          if (dist2 > 2.25) {
            const pull = Math.min(c * crystalStr * sDt, c * 0.15);
            nv -= pull;
            const gxi = clamp(Math.round(gx), 0, w - 1);
            const gyi = clamp(Math.round(gy), 0, h - 1);
            densityNext[gyi * w + gxi] += pull;
          }
        }

        if (!isIce) {
          const noise = (Math.random() - 0.5) * c * 0.018 * (temp / 293);
          const dx2 = Math.random() < 0.5 ? -1 : 1;
          const dy2 = Math.random() < 0.5 ? -1 : 1;
          const nx2 = x + dx2, ny2 = y + dy2;
          if (nx2 >= 0 && nx2 < w && ny2 >= 0 && ny2 < h && Math.abs(noise) < c * 0.5) {
            nv -= Math.abs(noise);
            densityNext[ny2 * w + nx2] += Math.abs(noise);
          }
        }

        densityNext[idx] += Math.max(0, nv);
      }
    }

    const tmp = densityField;
    densityField = densityNext;
    densityNext = tmp;
    for (let i = 0; i < densityNext.length; i++) densityNext[i] = 0;
  }

  function drawDensityField() {
    if (!state.thermo.active || !fieldReady) return;

    const temp = state.thermo.temperatureK;
    const phase = state.thermo.phase;
    const data = densityImageData.data;
    const perCell = TOTAL_MOLECULES / (FIELD_W * FIELD_H);

    let rB, gB, bB;
    if (phase === 'ice') {
      const f = clamp((273 - temp) / 60, 0, 1);
      rB = 140 + f * 80; gB = 210 + f * 45; bB = 255;
    } else if (phase === 'vapor') {
      const f = clamp((temp - 373) / 80, 0, 1);
      rB = 255; gB = 170 - f * 50; bB = 130 - f * 50;
    } else {
      const f = clamp((temp - 273) / 100, 0, 1);
      rB = 60 + f * 80; gB = 140 + f * 60; bB = 255;
    }

    for (let i = 0; i < densityField.length; i++) {
      const norm = clamp(densityField[i] / (perCell * 3.5), 0, 1);
      const br = Math.sqrt(norm);
      const px = i * 4;
      data[px]     = (rB * br) | 0;
      data[px + 1] = (gB * br) | 0;
      data[px + 2] = (bB * br) | 0;
      data[px + 3] = (br * 220) | 0;
    }

    densityCtx.putImageData(densityImageData, 0, 0);

    const b = containerBounds();
    ctx.drawImage(densityCanvas, b.left, b.top, b.right - b.left, b.bottom - b.top);

    ctx.strokeStyle = 'rgba(154,230,255,0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.left, b.top, b.right - b.left, b.bottom - b.top);

    ctx.fillStyle = 'rgba(154,230,255,0.6)';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(formatMoleculeCount(state.thermo.compounds) + ' H\u2082O \u2014 ' + phase + ' \u00B7 ' + temp.toFixed(0) + 'K', (b.left + b.right) / 2, b.top - 8);

    const pGlow = clamp((state.thermo.pressureAtm - 0.5) / 2.5, 0, 1);
    if (pGlow > 0.05) {
      ctx.strokeStyle = 'rgba(255,200,100,' + (pGlow * 0.35) + ')';
      ctx.lineWidth = 3 + pGlow * 4;
      ctx.strokeRect(b.left, b.top, b.right - b.left, b.bottom - b.top);
    }
  }

  function formatMoleculeCount(value) {
    return moleculeFormatter.format(Math.max(0, Math.round(value || 0)));
  }

  function updateMoleculePresetButtons() {
    if (!moleculeOptions) return;
    const active = state.thermo.selectedCompounds;
    if (btnMol10) btnMol10.classList.toggle('is-active', active === 10);
    if (btnMol10000) btnMol10000.classList.toggle('is-active', active === 10000);
    if (btnMol10b) btnMol10b.classList.toggle('is-active', active === 10000000000);
  }

  function setMoleculePreset(compounds) {
    const selected = moleculePresets.includes(compounds) ? compounds : 10000;
    state.thermo.selectedCompounds = selected;
    if (state.thermo.active) {
      state.thermo.compounds = selected;
      state.thermo.targetStableTime = 0;
      state.thermo.targetSatisfied = false;
      fieldReady = false;
      toast(formatMoleculeCount(selected) + ' H\u2082O molecules \u2014 thermal mass updated', 1400);
    }
    updateMoleculePresetButtons();
    updateLevelHUD();
    updateHUD();
  }

  function resetThermoForLevel() {
    const level = currentLevel();
    state.thermo.active = isWaterCoolingLevel();
    if (!moleculePresets.includes(state.thermo.selectedCompounds)) state.thermo.selectedCompounds = 10000;
    state.thermo.compounds = state.thermo.active ? state.thermo.selectedCompounds : (level.waterCompounds || 0);
    state.thermo.temperatureK = 296;
    state.thermo.pressureAtm = 1;
    state.thermo.volumeL = 12;
    state.thermo.targetPhase = level.waterTargetPhase || 'ice';
    state.thermo.targetTempK = level.waterTargetTempK || 263;
    state.thermo.targetSatisfied = false;
    state.thermo.targetStableTime = 0;
    fieldReady = false;
    refreshThermoPhase();
  }

  function applyThermoControl(control) {
    if (!state.thermo.active || state.phase !== 'simulate' || state.paused) return;
    const magnitude = Math.log10(Math.max(10, state.thermo.compounds));
    const inertia = clamp(1.6 - (magnitude - 1) * 0.12, 0.42, 1.6);
    if (control === 'cool') { state.thermo.temperatureK -= 8.5 * inertia; tone(480, 0.06, 'sine', 0.06, 0.005); }
    if (control === 'heat') { state.thermo.temperatureK += 8.5 * inertia; tone(340, 0.06, 'sine', 0.06, 0.005); }
    if (control === 'pressureUp') {
      state.thermo.pressureAtm += 0.12;
      state.thermo.temperatureK += 0.9 * inertia;
    }
    if (control === 'pressureDown') {
      state.thermo.pressureAtm -= 0.12;
      state.thermo.temperatureK -= 0.7 * inertia;
    }
    if (control === 'volumeUp') {
      state.thermo.volumeL += 0.7;
      state.thermo.temperatureK -= 1.2 * inertia;
    }
    if (control === 'volumeDown') {
      state.thermo.volumeL -= 0.7;
      state.thermo.temperatureK += 1.2 * inertia;
    }

    state.thermo.pressureAtm = clamp(state.thermo.pressureAtm, 0.35, 3.2);
    state.thermo.volumeL = clamp(state.thermo.volumeL, 5.5, 24);
    state.thermo.temperatureK = clamp(state.thermo.temperatureK, 210, 450);
    refreshThermoPhase();
  }

  function updateThermoDynamics(dt) {
    if (!state.thermo.active) return;
    const tier = currentTierProfile();
    const ambient = 295 + (tier.name === 'Hot' ? 14 : tier.name === 'Cool' ? 6 : tier.name === 'Cold' ? -6 : -14);
    const massScale = clamp(1 / Math.max(1, Math.log10(Math.max(10, state.thermo.compounds))), 0.1, 0.65);
    const ambientPull = (ambient - state.thermo.temperatureK) * 0.085 * massScale * dt;
    const pressureVolumeFactor = (state.thermo.pressureAtm / Math.max(0.1, state.thermo.volumeL)) * 9 * massScale;
    state.thermo.temperatureK += ambientPull + pressureVolumeFactor * dt;
    state.thermo.temperatureK = clamp(state.thermo.temperatureK, 210, 450);
    refreshThermoPhase();

    const needsLowerTemp = state.thermo.targetPhase === 'ice' || state.thermo.targetPhase === 'liquid';
    const targetTempReached = needsLowerTemp
      ? state.thermo.temperatureK <= state.thermo.targetTempK
      : state.thermo.temperatureK >= state.thermo.targetTempK;
    const targetReached = state.thermo.phase === state.thermo.targetPhase && targetTempReached;
    state.thermo.targetSatisfied = targetReached;
    if (targetReached) state.thermo.targetStableTime += dt;
    else state.thermo.targetStableTime = Math.max(0, state.thermo.targetStableTime - dt * 0.45);
  }

  function effectiveBandHalf() {
    const tier = currentTierProfile();
    return config.targetRadius * config.bandFraction * (1 + state.assistBandBonus) * tier.bandMultiplier;
  }

  function effectiveGrace() {
    const tier = currentTierProfile();
    return (config.grace + state.assistGraceBonus) * tier.graceMultiplier;
  }

  function registerAttempt() {
    const key = String(state.currentLevel);
    progress.attemptsByLevel[key] = (progress.attemptsByLevel[key] || 0) + 1;
    saveProgress();
    const attempts = progress.attemptsByLevel[key];
    const assist = Math.min(3, Math.max(0, attempts - 2));
    state.assistLevel = assist;
    state.assistBandBonus = assist * 0.08;
    state.assistGraceBonus = assist * 0.75;
    state.assistDriftScale = Math.max(0.72, 1 - assist * 0.1);
    state.assistDecayScale = Math.max(0.5, 1 - assist * 0.22);
  }

  function markLevelCompleted(levelIndex, clearTime, starsEarned) {
    if (progress.completed.indexOf(levelIndex) === -1) progress.completed.push(levelIndex);
    const key = String(levelIndex);
    const prevTime = progress.bestTimes[key];
    if (typeof prevTime !== 'number' || clearTime < prevTime) progress.bestTimes[key] = clearTime;
    progress.bestStars[key] = Math.max(progress.bestStars[key] || 0, starsEarned);
    saveProgress();
  }

  function isLevelUnlocked(index) {
    const track = levelTrack(index);
    const trackIndices = levelIndicesByTrack(track);
    const pos = trackIndices.indexOf(index);
    if (pos <= 0) return true;
    return progress.completed.indexOf(trackIndices[pos - 1]) !== -1;
  }

  function isLevelCompleted(index) {
    return progress.completed.indexOf(index) !== -1;
  }

  function beginRunMetrics() {
    state.runMetrics = {
      startedAt: performance.now(),
      levelIndex: state.currentLevel,
      levelName: currentLevel().name,
      track: levelTrack(state.currentLevel),
      firstInputMs: null,
      pulls: { wheel: 0, keyboard: 0, touch: 0 },
      totalPulls: 0,
      pauseCount: 0,
      tierTransitions: 0,
      heartLosses: 0,
      failReasons: {},
      bandSampleCount: 0,
      bandPresenceSum: 0,
      gracePressurePeak: 0,
    };
  }

  function noteInput(source) {
    const run = state.runMetrics;
    if (!run) return;
    if (run.firstInputMs == null) run.firstInputMs = performance.now() - run.startedAt;
    if (run.pulls[source] != null) run.pulls[source] += 1;
    run.totalPulls += 1;
  }

  function recordBandSampling() {
    const run = state.runMetrics;
    if (!run || state.electrons.length === 0) return;
    const inBandCount = state.electrons.reduce((sum, electron) => sum + (electron.inBand ? 1 : 0), 0);
    run.bandSampleCount += 1;
    run.bandPresenceSum += inBandCount / state.electrons.length;

    const out = state.electrons.filter(electron => !electron.inBand);
    if (out.length > 0) {
      const worstGrace = Math.min.apply(null, out.map(electron => electron.graceLeft));
      const pressure = 1 - (worstGrace / Math.max(0.1, effectiveGrace()));
      run.gracePressurePeak = Math.max(run.gracePressurePeak, clamp(pressure, 0, 1));
    }
  }

  function dominantControlLabel(pulls) {
    const entries = Object.entries(pulls);
    entries.sort((a, b) => b[1] - a[1]);
    const dominant = entries[0];
    if (!dominant || dominant[1] === 0) return 'none';
    return dominant[0];
  }

  function buildRunSuggestion(run, outcome, comfortScore) {
    const pullsPerSec = run.totalPulls / Math.max(0.5, run.durationSec);
    if (run.firstInputMs == null) return 'Input was not detected quickly. Re-check controls visibility and onboarding.';
    if (run.track === 'expansion' && run.tierTransitions >= 3 && outcome === 'fail') return 'Archive-tier pressure likely caused the failure. Use shorter pull bursts before each tier shift.';
    if (run.heartLosses >= 3) return 'High strain detected. Reduce drift pressure or increase grace for this player profile.';
    if (pullsPerSec > 8) return 'Input load is heavy. Encourage fewer, smaller pull bursts to reduce fatigue.';
    if (run.gracePressurePeak > 0.8) return 'Orbit pressure spiked often. Consider more anticipatory pull timing cues.';
    if (outcome === 'success' && comfortScore >= 78) return 'Flow feels comfortable. Ready for harder variants or optional challenges.';
    return 'Balanced run. Keep accessibility cues and maintain current assist behavior.';
  }

  function finalizeRunMetrics(outcome, failTitle) {
    const run = state.runMetrics;
    if (!run) return null;

    run.durationSec = (performance.now() - run.startedAt) / 1000;
    run.bandConsistency = run.bandSampleCount > 0 ? run.bandPresenceSum / run.bandSampleCount : 0;
    const pullsPerSec = run.totalPulls / Math.max(0.5, run.durationSec);
    const inputLoadPenalty = Math.max(0, pullsPerSec - 4) * 6;
    const stabilityBonus = Math.round(state.snapshot.peakStability * 20);

    let comfortScore = 72;
    comfortScore -= run.heartLosses * 12;
    comfortScore -= run.gracePressurePeak * 22;
    comfortScore -= inputLoadPenalty;
    comfortScore += stabilityBonus;
    if (outcome === 'success') comfortScore += 10;
    comfortScore = clamp(Math.round(comfortScore), 5, 98);

    const challengeLabel = comfortScore >= 78 ? 'Comfortable' : comfortScore >= 55 ? 'Balanced' : 'Intense';
    const report = {
      timestamp: Date.now(),
      levelIndex: run.levelIndex,
      levelName: run.levelName,
      track: run.track,
      outcome,
      failTitle: failTitle || null,
      comfortScore,
      challengeLabel,
      durationSec: run.durationSec,
      firstInputSec: run.firstInputMs == null ? null : run.firstInputMs / 1000,
      pullsPerSec,
      dominantControl: dominantControlLabel(run.pulls),
      bandConsistency: run.bandConsistency,
      gracePressurePeak: run.gracePressurePeak,
      pauses: run.pauseCount,
      tierTransitions: run.tierTransitions,
      heartLosses: run.heartLosses,
      suggestion: buildRunSuggestion(run, outcome, comfortScore),
    };

    playtest.history.unshift(report);
    playtest.history = playtest.history.slice(0, 30);
    savePlaytestHistory();
    state.lastRunReport = report;
    state.runMetrics = null;
    return report;
  }

  function recentPlaytestTrendText() {
    if (playtest.history.length === 0) return 'No playtest history yet.';
    const windowRuns = playtest.history.slice(0, Math.min(8, playtest.history.length));
    const avgComfort = windowRuns.reduce((sum, run) => sum + run.comfortScore, 0) / windowRuns.length;
    const successCount = windowRuns.filter(run => run.outcome === 'success').length;
    const successRate = Math.round((successCount / windowRuns.length) * 100);
    const label = avgComfort >= 78 ? 'Comfortable' : avgComfort >= 55 ? 'Balanced' : 'Intense';
    return label + ' trend · ' + successRate + '% success (' + windowRuns.length + ' runs)';
  }

  function runReportText(report) {
    if (!report) return '';
    const outcomeText = report.outcome === 'success' ? 'Success' : 'Retry';
    const firstInputText = report.firstInputSec == null ? 'n/a' : report.firstInputSec.toFixed(1) + 's';
    const trackLabel = report.track === 'expansion' ? 'Expansion Attraction' : 'Core Campaign';
    const tierLine = report.track === 'expansion' ? ('\nTier shifts ' + report.tierTransitions) : '';
    return 'Playtest ' + outcomeText + ' · Comfort ' + report.comfortScore + '/100 (' + report.challengeLabel + ')\n'
      + trackLabel + '\n'
      + 'Input ' + report.dominantControl + ' · ' + report.pullsPerSec.toFixed(1) + ' pulls/s · First input ' + firstInputText + '\n'
      + 'Band consistency ' + Math.round(report.bandConsistency * 100) + '% · Pauses ' + report.pauses + '\n'
      + tierLine
      + (tierLine ? '\n' : '')
      + report.suggestion;
  }

  function toast(message, ms) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastEl._timer);
    toastEl._timer = setTimeout(() => toastEl.classList.remove('show'), ms || 1400);
  }

  function setPrompt(title, body, actionLabel) {
    if (!prompt) return;
    promptTitle.textContent = title;
    promptBody.textContent = body;
    promptAction.textContent = actionLabel || 'Play';
    prompt.hidden = false;
  }

  function hidePrompt() {
    if (prompt) prompt.hidden = true;
  }

  function updateSoundButton() {
    if (!btnSound) return;
    btnSound.textContent = session.soundEnabled ? 'Sound On' : 'Sound Off';
    btnSound.classList.toggle('muted', !session.soundEnabled);
  }

  function updatePauseButton() {
    if (!btnPause) return;
    btnPause.textContent = state.paused ? 'Resume' : 'Pause';
  }

  function renderHearts() {
    if (!hudHearts) return;
    const hearts = hudHearts.querySelectorAll('.heart');
    hearts.forEach((node, i) => {
      node.classList.remove('full', 'lost', 'breaking');
      node.classList.add(i < state.lives ? 'full' : 'lost');
    });
  }

  function updateLevelHUD() {
    const lvl = currentLevel();
    if (hudLevelName) hudLevelName.textContent = lvl.symbol + ' ' + lvl.name;
    if (hudLevelElectrons) {
      if (state.thermo.active) {
        const base = lvl.electrons + (lvl.electrons === 1 ? ' H2O molecule' : ' H2O molecules');
        hudLevelElectrons.textContent = base + ' · Batch ' + formatMoleculeCount(state.thermo.compounds);
      } else {
        const base = lvl.electrons + (lvl.electrons === 1 ? ' electron' : ' electrons');
        hudLevelElectrons.textContent = base;
      }
    }
  }

  function center() {
    return { x: canvas.clientWidth / 2, y: canvas.clientHeight / 2 + 20 };
  }

  function createElectron(angle, radius) {
    const netInward = config.k / (radius * radius + config.softening) - (config.driftForce * state.assistDriftScale * currentTierProfile().driftMultiplier);
    const speed = Math.sqrt(Math.max(1, netInward) * radius);
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      z: 0,
      vx: -Math.sin(angle) * speed,
      vy: Math.cos(angle) * speed,
      trail: [],
      bandHold: 0,
      graceLeft: effectiveGrace(),
      inBand: false,
      stability: 0,
      peakStability: 0,
      orbitError: 0,
      currentRadius: radius,
      _screenX: 0,
      _screenY: 0,
      _wasInBand: false,
    };
  }

  function recoverOrbit() {
    const lvl = currentLevel();
    const radius = config.targetRadius + effectiveBandHalf() * 0.35;
    state.electrons = [];
    for (let i = 0; i < lvl.electrons; i++) {
      const ang = (i / lvl.electrons) * Math.PI * 2;
      state.electrons.push(createElectron(ang, radius));
    }
    state.selectedIndex = 0;
  }

  function updateExpansionTierLifecycle(dt) {
    const level = currentLevel();
    if (!level.expansionTiers || level.expansionTiers.length === 0) return;
    const tier = currentTierProfile();
    state.expansionTierElapsed += dt;
    if (state.expansionTierElapsed < tier.durationSec) return;
    if (state.expansionTierIndex >= level.expansionTiers.length - 1) return;
    state.expansionTierElapsed = 0;
    state.expansionTierIndex += 1;
    const nextTier = currentTierProfile();
    if (state.runMetrics) state.runMetrics.tierTransitions += 1;
    toast('Tier shift: ' + nextTier.name, 1200);
  }

  function gradeStars(clearTime, peakStability) {
    let result = 1;
    if (state.lives >= 3) result += 1;
    if (peakStability >= 0.8 || clearTime <= currentLevel().holdTime * 1.6) result += 1;
    return result;
  }

  function updatePromptStats() {
    if (!promptStats) return;
    promptStats.hidden = false;
    statHoldTime.textContent = state.snapshot.holdTime.toFixed(1) + 's';
    statStability.textContent = Math.round(state.snapshot.peakStability * 100) + '%';
    statAttempts.textContent = '#' + session.attempts;
    const pct = Math.min(100, Math.round((state.snapshot.holdTime / currentLevel().holdTime) * 100));
    statProgress.textContent = pct + '%';
    statProgress.style.setProperty('--progress', pct + '%');
    if (promptEncourage) {
      promptEncourage.hidden = false;
      promptEncourage.textContent = state.lastRunReport
        ? state.lastRunReport.challengeLabel + ' run · ' + (state.lastRunReport.outcome === 'success' ? 'Nice control quality.' : 'You are close. Keep iterating.')
        : (state.thermo.active
          ? (state.thermo.targetStableTime > currentLevel().holdTime * 0.5 ? 'Cooling trend looks good. Keep temperature low.' : 'Use Cool + larger volume to freeze H2O faster.')
          : (state.snapshot.holdTime > currentLevel().holdTime * 0.5 ? 'Great progress! Keep going.' : 'Small pulls and steady timing work best.'));
    }
    if (promptTest) {
      const text = runReportText(state.lastRunReport);
      promptTest.hidden = text.length === 0;
      promptTest.textContent = text;
    }
  }

  function loseHeart(reason) {
    state.lives = Math.max(0, state.lives - 1);
    if (state.runMetrics) {
      state.runMetrics.heartLosses += 1;
      state.runMetrics.failReasons[reason.title] = (state.runMetrics.failReasons[reason.title] || 0) + 1;
    }
    renderHearts();
    tone(220, 0.12, 'sawtooth', 0.08, 0.01);
    if (state.lives <= 0) {
      state.failReason = reason;
      state.phase = 'fail';
      const minHold = state.thermo.active
        ? state.thermo.targetStableTime
        : (state.electrons.length > 0 ? Math.min.apply(null, state.electrons.map(electron => electron.bandHold)) : 0);
      const peakStability = state.electrons.length > 0 ? Math.max.apply(null, state.electrons.map(electron => electron.peakStability)) : 0;
      state.snapshot.holdTime = minHold;
      state.snapshot.peakStability = peakStability;
      finalizeRunMetrics('fail', reason.title);
      setPrompt(reason.title, reason.body, 'Try Again');
      updatePromptStats();
      return;
    }
    toast('Heart lost! ' + state.lives + ' remaining.');
    recoverOrbit();
  }

  function completeLevel() {
    const clearTime = (performance.now() - state.simStartTime) / 1000;
    const peakStability = Math.max.apply(null, state.electrons.map(e => e.peakStability));
    const starsEarned = gradeStars(clearTime, peakStability);
    const starsText = '★'.repeat(starsEarned) + '☆'.repeat(3 - starsEarned);

    state.snapshot.holdTime = state.thermo.active ? state.thermo.targetStableTime : currentLevel().holdTime;
    state.snapshot.peakStability = peakStability;
    state.lastMilestone = 0;
    finalizeRunMetrics('success', null);

    session.bestHoldTime = Math.max(session.bestHoldTime, currentLevel().holdTime);
    session.bestStability = Math.max(session.bestStability, peakStability);
    session.totalPlayTime += clearTime;
    saveSession();

    markLevelCompleted(state.currentLevel, clearTime, starsEarned);

    tone(262, 0.2, 'sine', 0.12, 0.02);
    setTimeout(() => tone(330, 0.2, 'sine', 0.12, 0.02), 120);
    setTimeout(() => tone(392, 0.25, 'sine', 0.14, 0.01), 240);

    const lvl = currentLevel();
    const nextIndex = nextLevelIndexInTrack(state.currentLevel);
    if (nextIndex != null) {
      const next = levels[nextIndex];
      setPrompt(
        lvl.name + ' Complete!',
        'Score: ' + starsText + ' · ' + clearTime.toFixed(1) + 's\n\n' + lvl.desc + '\n\nNext: ' + next.name,
        'Next: ' + next.name
      );
    } else if (levelTrack(state.currentLevel) === 'expansion') {
      setPrompt(
        'Expansion Attraction Complete!',
        'Water compounds cooled to stable ' + (currentLevel().waterTargetPhase || 'ice') + ' phase through pressure-volume-temperature control.\nScore: ' + starsText + ' · ' + clearTime.toFixed(1) + 's\nReplay expansion to improve comfort score.',
        'Replay Expansion'
      );
    } else {
      setPrompt(
        'Campaign Complete!',
        'You stabilized all atoms.\nScore: ' + starsText + ' · ' + clearTime.toFixed(1) + 's\nReplay to improve stars.',
        'Replay Campaign'
      );
    }

    state.phase = 'levelComplete';
    if (promptSkip) promptSkip.hidden = true;
    if (promptLevels) promptLevels.hidden = false;
    if (promptExpansion) promptExpansion.hidden = false;
    updatePromptStats();
    toast(lvl.name + ' stabilized!', 1800);
  }

  function startSimulation() {
    state.phase = 'simulate';
    state.paused = false;
    state.lastMilestone = 0;
    state.fieldBias = 0;
    state.fieldBiasTarget = 0;
    state.pullIntensity = 0;
    state.wheelAccum = 0;
    state.expansionTierIndex = 0;
    state.expansionTierElapsed = 0;
    state.keyboardPullCooldown = 0;
    state.failReason = null;
    state.lastRunReport = null;
    state.simStartTime = performance.now();
    state.lives = state.maxLives;
    session.attempts += 1;
    saveSession();

    registerAttempt();
    beginRunMetrics();
    resetThermoForLevel();
    recoverOrbit();

    if (state.assistLevel > 0) toast('Assist L' + state.assistLevel + ' active');
    if (levelTrack(state.currentLevel) === 'expansion') {
      toast('Expansion tier: ' + currentTierProfile().name, 1300);
    }

    hidePrompt();
    if (pauseOverlay) pauseOverlay.hidden = true;
    if (controlPad) controlPad.hidden = false;
    if (promptStats) promptStats.hidden = true;
    if (promptEncourage) promptEncourage.hidden = true;
    if (promptTest) promptTest.hidden = true;
    if (promptExpansion) promptExpansion.hidden = true;
    if (hudThermo) hudThermo.hidden = !state.thermo.active;
    if (moleculeOptions) moleculeOptions.hidden = !state.thermo.active;
    updateMoleculePresetButtons();
    updatePauseButton();
    renderHearts();
    updateLevelHUD();
    initAudio();
  }

  function setIntro() {
    state.phase = 'intro';
    state.paused = false;
    if (controlPad) controlPad.hidden = true;
    if (promptSkip) promptSkip.hidden = false;
    if (promptLevels) promptLevels.hidden = false;
    if (promptExpansion) promptExpansion.hidden = false;
    if (promptStats) promptStats.hidden = true;
    if (promptEncourage) promptEncourage.hidden = true;
    if (promptTest) promptTest.hidden = true;
    updatePauseButton();
    const lvl = currentLevel();
    const ordinal = levelOrdinalInTrack(state.currentLevel);
    const trackLabel = levelTrack(state.currentLevel) === 'expansion' ? 'Expansion Attraction' : 'Core Campaign';
    const tierNote = lvl.expansionTiers ? '\nLifecycle: ' + lvl.expansionTiers.map(tier => tier.name).join(' → ') : '';
    const waterTargetNote = lvl.waterCompounds
      ? ('\nWater target: Cool H2O to ' + (lvl.waterTargetTempK || 263) + 'K (' + (lvl.waterTargetPhase || 'ice') + '). Batch options: 10 / 10,000 / 10,000,000,000 molecules.')
      : '';
    setPrompt('Attract-ion', trackLabel + ' · Level ' + ordinal.current + '/' + ordinal.total + ': ' + lvl.name + ' — ' + lvl.desc + tierNote + waterTargetNote + '\n\n' + 'Player trend: ' + recentPlaytestTrendText(), session.tutorialDone ? 'Play' : 'How to Play');
    if (hudThermo) hudThermo.hidden = true;
    updateLevelHUD();
  }

  function togglePause(next) {
    if (state.phase !== 'simulate') return;
    state.paused = typeof next === 'boolean' ? next : !state.paused;
    if (state.paused && state.runMetrics) state.runMetrics.pauseCount += 1;
    if (pauseOverlay) pauseOverlay.hidden = !state.paused;
    if (controlPad) controlPad.hidden = state.paused;
    updatePauseButton();
    if (hudStep) hudStep.textContent = state.paused ? 'Paused' : 'Keep the electron inside the band!';
  }

  function advanceLevel() {
    const nextIndex = nextLevelIndexInTrack(state.currentLevel);
    if (nextIndex != null) {
      state.currentLevel = nextIndex;
      startSimulation();
      return;
    }
    const track = levelTrack(state.currentLevel);
    state.currentLevel = firstLevelIndexByTrack(track);
    setIntro();
    showLevelSelect(track);
  }

  function showLevelSelect(filter) {
    if (!levelSelectOverlay || !levelGrid) return;
    const selectedFilter = filter || state.levelSelectFilter || 'core';
    state.levelSelectFilter = selectedFilter;
    if (levelSelectTitle) levelSelectTitle.textContent = selectedFilter === 'expansion' ? 'Expansion Attraction' : 'Choose Your Atom';
    if (levelSelectSub) levelSelectSub.textContent = selectedFilter === 'expansion'
      ? 'H2O cooling program inspired by Hot/Cool/Cold/Archive access tiers.'
      : 'Complete each atom to unlock the next one.';
    levelGrid.innerHTML = '';
    for (let i = 0; i < levels.length; i++) {
      const lvl = levels[i];
      const track = lvl.track || 'core';
      if (selectedFilter === 'core' && track !== 'core') continue;
      if (selectedFilter === 'expansion' && track !== 'expansion') continue;
      const unlocked = isLevelUnlocked(i);
      const completed = isLevelCompleted(i);
      const card = document.createElement('div');
      card.className = 'level-card' + (completed ? ' completed' : '') + (!unlocked ? ' locked' : '');

      const symbol = document.createElement('div');
      symbol.className = 'level-symbol';
      symbol.textContent = lvl.symbol;
      card.appendChild(symbol);

      const label = document.createElement('div');
      label.className = 'level-label';
      label.textContent = lvl.name;
      card.appendChild(label);

      const info = document.createElement('div');
      info.className = 'level-info';
      const tierText = lvl.expansionTiers ? (' · ' + lvl.expansionTiers.map(tier => tier.name).join('→')) : '';
      info.textContent = lvl.electrons + (lvl.electrons === 1 ? ' electron' : ' electrons') + ' · ' + lvl.holdTime + 's hold' + tierText;
      card.appendChild(info);

      const key = String(i);
      const bestStars = progress.bestStars[key] || 0;
      const bestTime = progress.bestTimes[key];
      const attempts = progress.attemptsByLevel[key] || 0;
      const best = document.createElement('div');
      best.className = 'level-best';
      best.textContent = 'Best ' + (bestStars ? ('★'.repeat(bestStars) + '☆'.repeat(3 - bestStars)) : '---') + ' · ' + (typeof bestTime === 'number' ? bestTime.toFixed(1) + 's' : '--') + ' · Attempts ' + attempts;
      card.appendChild(best);

      const badge = document.createElement('div');
      badge.className = 'level-badge';
      if (completed) {
        badge.classList.add('done');
        badge.textContent = '✓ ' + Math.max(1, bestStars) + '★';
      } else if (unlocked) {
        badge.classList.add('new');
        badge.textContent = 'Play';
      } else {
        badge.classList.add('lock');
        badge.textContent = '🔒 Locked';
      }
      card.appendChild(badge);

      if (unlocked) {
        card.addEventListener('click', () => {
          state.currentLevel = i;
          hideLevelSelect();
          startSimulation();
        });
      }

      levelGrid.appendChild(card);
    }
    levelSelectOverlay.hidden = false;
    hidePrompt();
  }

  function hideLevelSelect() {
    if (levelSelectOverlay) levelSelectOverlay.hidden = true;
  }

  function showTutorialStep() {
    const step = tutorialSteps[state.tutorialIndex];
    if (tutorialTitle) tutorialTitle.textContent = step.title;
    if (tutorialBody) tutorialBody.innerHTML = step.body;
    if (tutorialDots) {
      tutorialDots.innerHTML = '';
      tutorialSteps.forEach((_, i) => {
        const d = document.createElement('span');
        d.className = 'tutorial-dot' + (i === state.tutorialIndex ? ' active' : i < state.tutorialIndex ? ' done' : '');
        tutorialDots.appendChild(d);
      });
    }
    if (tutorialNext) tutorialNext.textContent = state.tutorialIndex === tutorialSteps.length - 1 ? 'Start Playing!' : 'Next';
    if (tutorialSkip) tutorialSkip.hidden = state.tutorialIndex === tutorialSteps.length - 1;
  }

  function startTutorial() {
    state.phase = 'tutorial';
    state.tutorialIndex = 0;
    if (tutorialOverlay) tutorialOverlay.hidden = false;
    showTutorialStep();
  }

  function finishTutorial() {
    if (tutorialOverlay) tutorialOverlay.hidden = true;
    session.tutorialDone = true;
    localStorage.setItem('attractionTutorialDone', 'true');
    startSimulation();
  }

  function applyPull(step, source) {
    if (state.phase !== 'simulate' || state.paused) return;
    noteInput(source || 'wheel');
    state.fieldBiasTarget = clamp(state.fieldBiasTarget - (step || config.fieldStep), config.fieldMin, config.fieldMax);
    state.pullIntensity = clamp(state.pullIntensity + 0.22, 0, 1);
  }

  function updateSelectedElectron() {
    if (state.electrons.length <= 1) {
      state.selectedIndex = 0;
      return;
    }
    let best = Infinity;
    let idx = 0;
    for (let i = 0; i < state.electrons.length; i++) {
      const el = state.electrons[i];
      const dx = state.cursorX - el._screenX;
      const dy = state.cursorY - el._screenY;
      const d = dx * dx + dy * dy;
      if (d < best) {
        best = d;
        idx = i;
      }
    }
    state.selectedIndex = idx;
  }

  function updateHUD() {
    const lvl = currentLevel();
    const tier = currentTierProfile();
    const count = state.electrons.length;
    const avgStability = count ? state.electrons.reduce((sum, e) => sum + e.stability, 0) / count : 0;
    const stabPct = Math.round(avgStability * 100);

    if (hudStabilityVal) {
      hudStabilityVal.textContent = stabPct + '%';
      hudStabilityVal.classList.remove('danger', 'warning');
      if (stabPct < 25) hudStabilityVal.classList.add('danger');
      else if (stabPct < 50) hudStabilityVal.classList.add('warning');
    }

    const minHold = state.thermo.active
      ? state.thermo.targetStableTime
      : (count ? Math.min.apply(null, state.electrons.map(e => e.bandHold)) : 0);
    const holdPct = Math.min(100, (minHold / lvl.holdTime) * 100);
    if (hudHoldFill) hudHoldFill.style.width = holdPct + '%';
    if (hudHoldTime) hudHoldTime.textContent = minHold.toFixed(1) + ' / ' + lvl.holdTime.toFixed(1) + 's';

    const milestone = Math.floor((holdPct / 100) * 4);
    if (milestone > state.lastMilestone && milestone >= 1) tone(440 + milestone * 80, 0.1, 'sine', 0.08, 0.01);
    state.lastMilestone = milestone;

    const out = state.electrons.filter(e => !e.inBand);
    if (hudHoldGrace) {
      if (out.length > 0) {
        const worst = Math.min.apply(null, out.map(e => e.graceLeft));
        hudHoldGrace.textContent = 'Grace: ' + worst.toFixed(1) + 's';
      } else if (state.thermo.active) {
        hudHoldGrace.textContent = 'Phase: ' + (state.thermo.phase || 'liquid');
      } else if (state.assistLevel > 0) {
        hudHoldGrace.textContent = 'Assist L' + state.assistLevel;
      } else if (lvl.expansionTiers) {
        hudHoldGrace.textContent = 'Tier: ' + tier.name;
      } else {
        hudHoldGrace.textContent = '';
      }
    }

    if (hudThermo) {
      hudThermo.hidden = !state.thermo.active;
      if (state.thermo.active) {
        if (thermoTarget) thermoTarget.textContent = (lvl.waterTargetPhase || 'ice') + ' @ ' + Math.round(lvl.waterTargetTempK || 263) + 'K';
        if (thermoPhase) thermoPhase.textContent = state.thermo.phase || 'liquid';
        if (thermoTemp) thermoTemp.textContent = state.thermo.temperatureK.toFixed(1) + ' K';
        if (thermoPressure) thermoPressure.textContent = state.thermo.pressureAtm.toFixed(2) + ' atm';
        if (thermoVolume) thermoVolume.textContent = state.thermo.volumeL.toFixed(1) + ' L';
        if (thermoCompounds) thermoCompounds.textContent = formatMoleculeCount(state.thermo.compounds) + ' molecules';
      }
    }

    const sel = state.electrons[state.selectedIndex];
    if (!sel) return;
    if (hudErrorVal) hudErrorVal.textContent = (sel.orbitError >= 0 ? '+' : '') + sel.orbitError.toFixed(0) + ' px';
    if (hudErrorZone) {
      const abs = Math.abs(sel.orbitError);
      const band = effectiveBandHalf();
      if (sel.currentRadius <= config.coreRadius + 12) {
        hudErrorZone.textContent = 'Core!';
        hudErrorZone.dataset.state = 'danger';
      } else if (sel.currentRadius >= config.escapeRadius - 16) {
        hudErrorZone.textContent = 'Escape!';
        hudErrorZone.dataset.state = 'danger';
      } else if (abs <= band) {
        hudErrorZone.textContent = 'In Band';
        hudErrorZone.dataset.state = 'in';
      } else if (sel.graceLeft < 1) {
        hudErrorZone.textContent = 'Critical!';
        hudErrorZone.dataset.state = 'danger';
      } else {
        hudErrorZone.textContent = 'Drifting';
        hudErrorZone.dataset.state = 'warn';
      }
    }
  }

  function updateOrbitHint() {
    if (!orbitHint || !orbitHintTitle || !orbitHintSub) return;
    if (state.phase !== 'simulate' || state.paused) {
      orbitHint.hidden = true;
      return;
    }
    const allIn = state.electrons.length > 0 && state.electrons.every(e => e.inBand);
    orbitHint.hidden = false;
    orbitHint.classList.add('show');
    if (state.thermo.active) {
      orbitHint.dataset.mode = state.thermo.targetSatisfied ? 'hold' : 'pull';
      orbitHintTitle.textContent = state.thermo.targetSatisfied ? 'HOLD PHASE' : 'COOL WATER';
      orbitHintSub.textContent = state.thermo.targetSatisfied
        ? 'Keep phase stable until the timer fills.'
        : 'Use Cool + pressure/volume controls to reach ice phase.';
      if (hudStep) hudStep.textContent = state.thermo.targetSatisfied ? 'Phase stable — maintain control.' : 'Lower temperature and tune P/V.';
      return;
    }
    orbitHint.dataset.mode = allIn ? 'hold' : 'pull';
    orbitHintTitle.textContent = allIn ? 'HOLD' : 'PULL';
    const tier = currentTierProfile();
    const tierCue = currentLevel().expansionTiers ? (' · ' + tier.name + ' tier') : '';
    orbitHintSub.textContent = (allIn ? 'Keep all electrons inside the band.' : 'Scroll down / hold Space to pull') + tierCue;
    if (hudStep) hudStep.textContent = allIn ? 'Hold steady!' : 'Drifting out — pull inward.';
  }

  function updateElectronMetrics(el, dt) {
    const r = Math.hypot(el.x, el.y) || 1;
    el.currentRadius = r;
    const err = r - config.targetRadius;
    el.orbitError = err;
    const band = effectiveBandHalf();
    const inBand = Math.abs(err) <= band;
    el.inBand = inBand;

    if (inBand) {
      el.bandHold += dt;
      el.graceLeft = Math.min(effectiveGrace(), el.graceLeft + dt * 1.4);
      if (!el._wasInBand) tone(520, 0.07, 'sine', 0.06, 0.005);
    } else {
      el.bandHold = Math.max(0, el.bandHold - dt * 0.2 * state.assistDecayScale);
      el.graceLeft = Math.max(0, el.graceLeft - dt);
    }
    el._wasInBand = inBand;

    const speed = Math.hypot(el.vx, el.vy);
    const attract = Math.abs(-config.k / (r * r + config.softening));
    const ideal = Math.sqrt(attract * r);
    const radiusScore = clamp(1 - Math.abs(err) / (band * 1.2), 0, 1);
    const speedScore = clamp(1 - Math.abs(speed - ideal) / (ideal * 0.7 + 1), 0, 1);
    el.stability = clamp(radiusScore * 0.7 + speedScore * 0.3, 0, 1);
    if (el.stability > el.peakStability) el.peakStability = el.stability;
  }

  function updateSimulation(dt) {
    if (state.phase !== 'simulate' || state.paused) return;

    if (state.keyboardPull) {
      state.keyboardPullCooldown -= dt;
      if (state.keyboardPullCooldown <= 0) {
        applyPull(config.fieldStep * 0.9, 'keyboard');
        state.keyboardPullCooldown = 0.12;
      }
    } else {
      state.keyboardPullCooldown = 0;
    }

    state.fieldBias += (state.fieldBiasTarget - state.fieldBias) * (1 - Math.exp(-config.fieldResponse * dt));
    state.fieldBiasTarget *= Math.exp(-1.2 * dt);
    state.pullIntensity = Math.max(0, state.pullIntensity - dt * 0.65);

    updateExpansionTierLifecycle(dt);
    const tier = currentTierProfile();
    const driftBase = config.driftForce * state.assistDriftScale * tier.driftMultiplier;

    for (let i = 0; i < state.electrons.length; i++) {
      const el = state.electrons[i];
      const dx = el.x;
      const dy = el.y;
      const r = Math.hypot(dx, dy) || 1;

      const attract = -config.k / (r * r + config.softening);
      const drift = driftBase + Math.sin(state.time * 0.0011) * (driftBase * 0.22);
      const field = i === state.selectedIndex ? state.fieldBias * config.fieldScale : 0;
      let ax = ((attract + drift + field) * dx) / r;
      let ay = ((attract + drift + field) * dy) / r;

      if (state.electrons.length > 1) {
        for (let j = 0; j < state.electrons.length; j++) {
          if (j === i) continue;
          const other = state.electrons[j];
          const rx = el.x - other.x;
          const ry = el.y - other.y;
          const dist = Math.hypot(rx, ry) || 1;
          const repel = config.kRepel / (dist * dist + config.repelSoftening);
          ax += (repel * rx) / dist;
          ay += (repel * ry) / dist;
        }
      }

      el.vx += ax * dt;
      el.vy += ay * dt;
      const damp = Math.exp(-config.damping * dt);
      el.vx *= damp;
      el.vy *= damp;

      const speed = Math.hypot(el.vx, el.vy);
      if (speed > config.maxSpeed) {
        const s = config.maxSpeed / speed;
        el.vx *= s;
        el.vy *= s;
      }

      el.x += el.vx * dt;
      el.y += el.vy * dt;
      const ang = Math.atan2(el.y, el.x);
      el.z = Math.sin(ang + state.time * 0.0012) * (13 + Math.abs(state.fieldBias) * 4 + el.stability * 6);

      el.trail.push({ x: el.x, y: el.y, z: el.z });
      if (el.trail.length > 60) el.trail.shift();

      const newR = Math.hypot(el.x, el.y);
      if (newR < config.coreRadius + 28 && newR > config.coreRadius) {
        const push = (1 - (newR - config.coreRadius) / 28) * 2.2;
        el.vx += (el.x / newR) * push;
        el.vy += (el.y / newR) * push;
      }
      if (newR > config.escapeRadius - 48 && newR < config.escapeRadius) {
        const pull = (1 - (config.escapeRadius - newR) / 48) * 2;
        el.vx -= (el.x / newR) * pull;
        el.vy -= (el.y / newR) * pull;
      }

      updateElectronMetrics(el, dt);

      if (newR < config.coreRadius) {
        loseHeart({ title: 'Core Collision', body: 'An electron hit the nucleus. Use smaller pulls near the center.' });
        return;
      }
      if (newR > config.escapeRadius) {
        loseHeart({ title: 'Electron Escaped', body: 'An electron escaped. Pull a little earlier as the orbit expands.' });
        return;
      }
      if (!el.inBand && el.graceLeft <= 0) {
        loseHeart({ title: 'Orbit Unstable', body: 'An electron stayed outside the band too long.' });
        return;
      }
    }

    updateThermoDynamics(dt);
    updateDensityField(dt);

    const allStable = state.thermo.active
      ? state.thermo.targetStableTime >= currentLevel().holdTime
      : (state.electrons.length > 0 && state.electrons.every(e => e.bandHold >= currentLevel().holdTime));
    if (allStable) {
      completeLevel();
      return;
    }

    recordBandSampling();
    updateHUD();
    updateOrbitHint();
    if (btnPull) {
      const sel = state.electrons[state.selectedIndex];
      btnPull.classList.toggle('suggest', !state.thermo.active && !!(sel && !sel.inBand && sel.orbitError > 0));
    }
    if (state.thermo.active) {
      const needCool = !state.thermo.targetSatisfied && state.thermo.phase !== 'ice';
      if (btnCool) btnCool.classList.toggle('suggest', needCool);
      if (btnHeat) btnHeat.classList.toggle('suggest', false);
      if (btnPressureUp) btnPressureUp.classList.toggle('suggest', !state.thermo.targetSatisfied && state.thermo.pressureAtm < 1.3);
      if (btnVolumeUp) btnVolumeUp.classList.toggle('suggest', !state.thermo.targetSatisfied && state.thermo.volumeL < 12);
    } else {
      if (btnCool) btnCool.classList.remove('suggest');
      if (btnHeat) btnHeat.classList.remove('suggest');
      if (btnPressureUp) btnPressureUp.classList.remove('suggest');
      if (btnPressureDown) btnPressureDown.classList.remove('suggest');
      if (btnVolumeUp) btnVolumeUp.classList.remove('suggest');
      if (btnVolumeDown) btnVolumeDown.classList.remove('suggest');
    }
  }

  function drawStars(t) {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    for (let li = 0; li < stars.length; li++) {
      const layer = stars[li];
      const size = 1.6 - li * 0.35;
      const alpha = 0.55 - li * 0.12;
      for (let i = 0; i < layer.length; i++) {
        const s = layer[i];
        const flick = 0.65 + 0.35 * Math.sin(t * 0.0012 + s.tw);
        const x = (s.x + Math.sin(t * s.drift + s.tw) * 6 + w) % w;
        const y = (s.y + Math.cos(t * s.drift + s.tw * 1.3) * 4 + h) % h;
        ctx.fillStyle = 'rgba(154,230,255,' + (alpha * flick) + ')';
        ctx.fillRect(x, y, size, size);
      }
    }
  }

  function planeToWorld(x, y, z, t) {
    const rx = config.tiltX + Math.sin(t * 0.00035) * config.wobble;
    const ry = config.tiltY + Math.cos(t * 0.0004) * config.wobble;
    const cosX = Math.cos(rx), sinX = Math.sin(rx);
    const cosY = Math.cos(ry), sinY = Math.sin(ry);
    const y1 = y * cosX - z * sinX;
    const z1 = y * sinX + z * cosX;
    const x2 = x * cosY + z1 * sinY;
    const z2 = -x * sinY + z1 * cosY;
    return { x: x2, y: y1, z: z2 };
  }

  function project(point) {
    const c = center();
    const depth = Math.max(120, config.fov + point.z);
    const scale = config.fov / depth;
    return { x: c.x + point.x * scale, y: c.y + point.y * scale, scale };
  }

  function drawRing(radius, color, width) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width || 2;
    ctx.beginPath();
    const steps = 120;
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const p = project(planeToWorld(Math.cos(a) * radius, Math.sin(a) * radius, 0, state.time));
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.stroke();
  }

  function thermoBackgroundTint() {
    if (!state.thermo.active) return null;
    const temp = state.thermo.temperatureK;
    if (temp <= 263) return { top: '#040a14', bot: '#081828' };
    if (temp <= 290) {
      const f = (290 - temp) / 27;
      return { top: 'rgb(' + ((5 - f)|0) + ',' + ((7 + f * 3)|0) + ',' + ((11 + f * 9)|0) + ')', bot: 'rgb(' + ((10 - f * 2)|0) + ',' + ((19 + f * 5)|0) + ',' + ((34 + f * 6)|0) + ')' };
    }
    if (temp >= 373) return { top: '#0e0608', bot: '#1a0a0e' };
    if (temp >= 320) {
      const f = (temp - 320) / 53;
      return { top: 'rgb(' + ((5 + f * 9)|0) + ',' + ((7 - f)|0) + ',' + ((11 - f * 3)|0) + ')', bot: 'rgb(' + ((10 + f * 16)|0) + ',' + ((19 - f * 9)|0) + ',' + ((34 - f * 20)|0) + ')' };
    }
    return null;
  }

  function thermoGlowColor() {
    if (!state.thermo.active) return 'rgba(154,230,255,0.95)';
    if (state.thermo.phase === 'ice') return 'rgba(120,200,255,0.95)';
    if (state.thermo.phase === 'vapor') return 'rgba(255,160,120,0.85)';
    return 'rgba(180,220,255,0.9)';
  }

  function drawScene(t) {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);

    const tint = thermoBackgroundTint();
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, tint ? tint.top : '#05070b');
    bg.addColorStop(1, tint ? tint.bot : '#0a1322');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    drawStars(t);

    // Draw density field (H2O lab) behind orbital elements
    drawDensityField();

    const band = effectiveBandHalf();
    const bandColor = state.thermo.active && state.thermo.targetSatisfied ? 'rgba(120,200,255,0.42)' : 'rgba(138,255,168,0.34)';
    drawRing(config.targetRadius - band, bandColor, 2.3);
    drawRing(config.targetRadius + band, bandColor, 2.3);
    drawRing(config.targetRadius, 'rgba(154,230,255,0.2)', 1);

    drawRing(config.coreRadius, 'rgba(255,64,96,0.2)', 1);
    drawRing(config.escapeRadius, 'rgba(255,64,96,0.16)', 1);

    const c = center();
    const glow = ctx.createRadialGradient(c.x, c.y, 8, c.x, c.y, 100);
    glow.addColorStop(0, thermoGlowColor());
    glow.addColorStop(1, 'rgba(10,14,24,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 100, 0, Math.PI * 2);
    ctx.fill();

    for (let i = 0; i < state.electrons.length; i++) {
      const el = state.electrons[i];
      if (el.trail.length > 1) {
        const col = config.electronColors[i] || config.electronColors[0];
        for (let j = 1; j < el.trail.length; j++) {
          const p0 = project(planeToWorld(el.trail[j - 1].x, el.trail[j - 1].y, el.trail[j - 1].z || 0, state.time));
          const p1 = project(planeToWorld(el.trail[j].x, el.trail[j].y, el.trail[j].z || 0, state.time));
          ctx.strokeStyle = 'rgba(' + (state.thermo.active ? (state.thermo.phase === 'ice' ? '120,200,255' : state.thermo.phase === 'vapor' ? '255,160,120' : col.trail) : col.trail) + ',0.2)';
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.stroke();
        }
      }
    }

    for (let i = 0; i < state.electrons.length; i++) {
      const el = state.electrons[i];
      const col = config.electronColors[i] || config.electronColors[0];
      const p = project(planeToWorld(el.x, el.y, el.z, state.time));
      el._screenX = p.x;
      el._screenY = p.y;

      if (i === state.selectedIndex && state.electrons.length > 1) {
        ctx.strokeStyle = col.ring;
        ctx.setLineDash([4, 3]);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 14 * p.scale, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      const bodyColor = state.thermo.active ? (state.thermo.phase === 'ice' ? 'rgba(160,220,255,0.95)' : state.thermo.phase === 'vapor' ? 'rgba(255,180,140,0.9)' : col.main) : col.main;
      const ringColor = state.thermo.active ? (state.thermo.phase === 'ice' ? 'rgba(120,200,255,0.7)' : state.thermo.phase === 'vapor' ? 'rgba(255,140,100,0.6)' : col.ring) : col.ring;
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5 * p.scale, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = ringColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 7 * p.scale, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = bodyColor;
      ctx.font = '11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      const particleLabel = state.thermo.active
        ? (state.electrons.length > 1 ? ('H₂O-' + (i + 1)) : 'H₂O')
        : (state.electrons.length > 1 ? col.label : 'e⁻');
      ctx.fillText(particleLabel, p.x, p.y - 11);
    }
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(canvas.clientWidth * dpr);
    canvas.height = Math.floor(canvas.clientHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    for (let li = 0; li < stars.length; li++) {
      const count = li === 0 ? 70 : li === 1 ? 45 : 30;
      stars[li] = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        tw: Math.random() * Math.PI * 2,
        drift: 0.00018 + li * 0.00011,
      }));
    }
  }

  function renderFrame(t) {
    const dt = state.lastTime ? Math.min(0.04, (t - state.lastTime) / 1000) : 0.016;
    state.lastTime = t;
    state.time = t;

    updateSimulation(dt);
    drawScene(t);

    requestAnimationFrame(renderFrame);
  }

  canvas.addEventListener('wheel', e => {
    if (state.phase !== 'simulate' || state.paused) return;
    e.preventDefault();
    let dy = e.deltaY;
    if (e.deltaMode === 1) dy *= 16;
    if (e.deltaMode === 2) dy *= 240;
    if (dy <= 0) return;
    state.wheelAccum += dy;
    while (state.wheelAccum >= config.wheelThreshold) {
      applyPull(undefined, 'wheel');
      state.wheelAccum -= config.wheelThreshold;
    }
  }, { passive: false });

  canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    state.cursorX = e.clientX - rect.left;
    state.cursorY = e.clientY - rect.top;
    state.cursorOnCanvas = true;
    updateSelectedElectron();
  });

  canvas.addEventListener('touchmove', e => {
    if (!e.touches.length) return;
    const rect = canvas.getBoundingClientRect();
    state.cursorX = e.touches[0].clientX - rect.left;
    state.cursorY = e.touches[0].clientY - rect.top;
    state.cursorOnCanvas = true;
    updateSelectedElectron();
  }, { passive: true });

  function bindRepeat(button, action, interval) {
    if (!button) return;
    let timer = null;
    const stop = e => { if (e) e.preventDefault(); if (timer) { clearInterval(timer); timer = null; } };
    const start = e => {
      e.preventDefault();
      action();
      stop();
      timer = setInterval(action, interval || 130);
    };
    button.addEventListener('pointerdown', start);
    button.addEventListener('pointerup', stop);
    button.addEventListener('pointercancel', stop);
    button.addEventListener('pointerleave', stop);
  }
  bindRepeat(btnPull, () => applyPull(undefined, 'touch'), 130);
  bindRepeat(btnCool, () => applyThermoControl('cool'), 130);
  bindRepeat(btnHeat, () => applyThermoControl('heat'), 130);
  bindRepeat(btnPressureUp, () => applyThermoControl('pressureUp'), 140);
  bindRepeat(btnPressureDown, () => applyThermoControl('pressureDown'), 140);
  bindRepeat(btnVolumeUp, () => applyThermoControl('volumeUp'), 150);
  bindRepeat(btnVolumeDown, () => applyThermoControl('volumeDown'), 150);

  if (btnMol10) btnMol10.addEventListener('click', () => setMoleculePreset(10));
  if (btnMol10000) btnMol10000.addEventListener('click', () => setMoleculePreset(10000));
  if (btnMol10b) btnMol10b.addEventListener('click', () => setMoleculePreset(10000000000));

  window.addEventListener('keydown', e => {
    if (e.key === ' ' || e.key === 'ArrowDown') {
      state.keyboardPull = true;
      e.preventDefault();
    }
    if (state.phase === 'simulate' && state.thermo.active) {
      if (e.key === 'c' || e.key === 'C') {
        applyThermoControl('cool');
        e.preventDefault();
      } else if (e.key === 'x' || e.key === 'X') {
        applyThermoControl('heat');
        e.preventDefault();
      } else if (e.key === 'a' || e.key === 'A') {
        applyThermoControl('pressureDown');
        e.preventDefault();
      } else if (e.key === 's' || e.key === 'S') {
        applyThermoControl('pressureUp');
        e.preventDefault();
      } else if (e.key === 'q' || e.key === 'Q') {
        applyThermoControl('volumeDown');
        e.preventDefault();
      } else if (e.key === 'w' || e.key === 'W') {
        applyThermoControl('volumeUp');
        e.preventDefault();
      }
    }
    if (e.key === 'p' || e.key === 'P') {
      if (state.phase === 'simulate') togglePause();
    }
    if (e.key === 'Escape' && state.paused) togglePause(false);
    if ((e.key === 'r' || e.key === 'R') && (state.phase === 'simulate' || state.phase === 'fail' || state.phase === 'levelComplete')) {
      startSimulation();
    }
  });

  window.addEventListener('keyup', e => {
    if (e.key === ' ' || e.key === 'ArrowDown') state.keyboardPull = false;
  });

  if (btnSound) {
    btnSound.addEventListener('click', () => {
      initAudio();
      session.soundEnabled = !session.soundEnabled;
      localStorage.setItem('attractionSound', String(session.soundEnabled));
      updateSoundButton();
      if (session.soundEnabled) tone(440, 0.1, 'sine', 0.1, 0.01);
    });
  }

  if (btnPause) btnPause.addEventListener('click', () => togglePause());
  if (pauseResume) pauseResume.addEventListener('click', () => togglePause(false));
  if (pauseRestart) pauseRestart.addEventListener('click', () => startSimulation());

  if (promptAction) {
    promptAction.addEventListener('click', () => {
      if (state.phase === 'intro') {
        if (!session.tutorialDone) startTutorial();
        else startSimulation();
      } else if (state.phase === 'fail') {
        startSimulation();
      } else if (state.phase === 'levelComplete') {
        advanceLevel();
      }
    });
  }

  if (promptSkip) promptSkip.addEventListener('click', () => {
    if (state.phase === 'intro') startSimulation();
  });

  if (promptLevels) promptLevels.addEventListener('click', () => showLevelSelect('core'));
  if (promptExpansion) promptExpansion.addEventListener('click', () => {
    const expansionStart = firstLevelIndexByTrack('expansion');
    state.currentLevel = expansionStart;
    showLevelSelect('expansion');
  });
  if (levelSelectBack) levelSelectBack.addEventListener('click', () => {
    hideLevelSelect();
    setIntro();
  });

  if (tutorialNext) tutorialNext.addEventListener('click', () => {
    if (state.tutorialIndex < tutorialSteps.length - 1) {
      state.tutorialIndex += 1;
      showTutorialStep();
    } else {
      finishTutorial();
    }
  });
  if (tutorialSkip) tutorialSkip.addEventListener('click', () => finishTutorial());

  window.addEventListener('resize', resize);

  resize();
  updateSoundButton();
  updatePauseButton();
  renderHearts();
  setIntro();
  requestAnimationFrame(renderFrame);
})()

