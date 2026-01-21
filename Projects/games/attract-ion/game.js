(() => {
  const canvas = document.getElementById('scene');
  const ctx = canvas.getContext('2d');
  const prompt = document.getElementById('prompt');
  const promptTitle = document.getElementById('promptTitle');
  const promptBody = document.getElementById('promptBody');
  const promptAction = document.getElementById('promptAction');
  const promptSkip = document.getElementById('promptSkip');
  const controlPad = document.getElementById('controlPad');
  const btnCool = document.getElementById('btnCool');
  const btnHeat = document.getElementById('btnHeat');
  const hudStep = document.getElementById('hudStep');
  const hudEnergy = document.getElementById('hudEnergy');
  const hudPressure = document.getElementById('hudPressure');
  const hudTemp = document.getElementById('hudTemp');
  const hudVolume = document.getElementById('hudVolume');
  const hudTempHold = document.getElementById('hudTempHold');
  const hudStability = document.getElementById('hudStability');
  const hudOrbit = document.getElementById('hudOrbit');
  const hudVelocity = document.getElementById('hudVelocity');
  const orbitHint = document.getElementById('orbitHint');
  const orbitHintTitle = document.getElementById('orbitHintTitle');
  const orbitHintSub = document.getElementById('orbitHintSub');
  const toastEl = document.getElementById('toast');
  const faqStep = document.getElementById('faqStep');
  const faqBand = document.getElementById('faqBand');
  const faqBandPct = document.getElementById('faqBandPct');

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
    holdTime: 7,
    grace: 3,
    driftForce: 5,
    fieldStep: 0.18,
    fieldMax: 1.6,
    fieldMin: -1.6,
    fieldScale: 44,
    fieldResponse: 7.5,
    wheelThreshold: 70,
    tutorialSeconds: 10,
    tutorialPulseEvery: 1.1,
    coreRadius: 28,
    escapeRadius: 260,
  };

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const orbitBandHalfWidth = () => config.targetRadius * config.bandFraction;
  const starLayers = [
    { count: 70, size: 1.6, alpha: 0.55, drift: 0.00018 },
    { count: 45, size: 1.2, alpha: 0.4, drift: 0.00028 },
    { count: 30, size: 0.9, alpha: 0.32, drift: 0.0004 },
  ];

  const state = {
    phase: 'intro',
    time: 0,
    lastTime: 0,
    energy: 0,
    fieldBias: 0,
    fieldBiasTarget: 0,
    fieldForce: 0,
    attraction: 0,
    orbitError: 0,
    bandHold: 0,
    inBand: false,
    graceLeft: config.grace,
    stability: 0,
    currentRadius: 0,
    pullIntensity: 0,
    pushIntensity: 0,
    failReason: null,
    wheelAccum: 0,
    tutorialLeft: 0,
    tutorialNextPulseAt: 0,
    stars: [],
    trail: [],
    electron: {
      x: config.targetRadius + 12,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
    },
  };

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(canvas.clientWidth * dpr);
    canvas.height = Math.floor(canvas.clientHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    initStars();
    if (state.phase === 'simulate') {
      resetSimulation();
    }
  }

  window.addEventListener('resize', resize);
  resize();

  function initStars() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    state.stars = starLayers.map((layer) =>
      Array.from({ length: layer.count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        tw: Math.random() * Math.PI * 2,
        seed: Math.random(),
      }))
    );
  }

  function toast(msg, ms = 1600) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(() => toastEl.classList.remove('show'), ms);
  }

  function setPrompt(title, body, showAction = true, actionLabel = 'Engage') {
    promptTitle.textContent = title;
    promptBody.textContent = body;
    promptAction.hidden = !showAction;
    promptAction.textContent = actionLabel;
    prompt.hidden = false;
  }

  function hidePrompt() {
    prompt.hidden = true;
  }

  function setPhase(phase) {
    state.phase = phase;
    state.time = 0;

    if (phase === 'intro') {
      hudStep.textContent = 'Attraction v2 online. Stabilize the electron orbit.';
      if (promptSkip) promptSkip.hidden = false;
      setPrompt(
        'Initialize Attraction v2',
        `Pull in (scroll up / W / ↑) or push out (scroll down / S / ↓). Keep the electron inside the orbit band for ${config.holdTime.toFixed(0)} seconds to stabilize the shell.`,
        true,
        'Start Simulation'
      );
    }

    if (phase === 'simulate') {
      hudStep.textContent = 'Hold the electron inside the orbit band. Pull in or push out with the controls.';
      if (promptSkip) promptSkip.hidden = true;
      hidePrompt();
    }

    if (phase === 'success') {
      hudStep.textContent = 'Stability achieved. Orbit locked.';
      if (promptSkip) promptSkip.hidden = true;
      setPrompt('Stabilized', 'Orbit locked. You held the electron inside the band long enough to form a stable shell.', true, 'Run Again');
      toast('Orbit stabilized.', 1800);
    }

    if (phase === 'fail') {
      hudStep.textContent = 'Orbit destabilized. Recalibrate and try again.';
      if (promptSkip) promptSkip.hidden = true;
      const failTitle = state.failReason?.title || 'Orbit Lost';
      const failBody = state.failReason?.body || 'The electron left the stability band. Use small pull/push corrections to hold it inside.';
      setPrompt(failTitle, failBody, true, 'Retry');
    }

    if (controlPad) {
      controlPad.hidden = phase !== 'simulate';
    }

    if (orbitHint) {
      orbitHint.hidden = phase !== 'simulate';
      orbitHint.classList.toggle('show', phase === 'simulate');
    }

    if (phase !== 'simulate') {
      btnCool?.classList.remove('suggest');
      btnHeat?.classList.remove('suggest');
    }
  }

  function startIntro() {
    setPhase('intro');
  }

  function resetSimulation() {
    const r = config.targetRadius + orbitBandHalfWidth() + 8;
    state.electron.x = r;
    state.electron.y = 0;
    state.electron.vx = 0;
    state.electron.vy = Math.sqrt((config.k * r) / (r * r + config.softening));
    state.energy = 0;
    state.fieldBias = 0;
    state.fieldBiasTarget = 0;
    state.fieldForce = 0;
    state.attraction = config.k / (r * r + config.softening);
    state.orbitError = r - config.targetRadius;
    state.bandHold = 0;
    state.inBand = false;
    state.graceLeft = config.grace;
    state.stability = 0;
    state.currentRadius = r;
    state.trail = [];
    state.pullIntensity = 0;
    state.pushIntensity = 0;
    state.failReason = null;
    state.wheelAccum = 0;
    state.tutorialLeft = config.tutorialSeconds;
    state.tutorialNextPulseAt = 0;
    if (hudEnergy) hudEnergy.textContent = Math.round(state.energy);
    if (hudPressure) hudPressure.textContent = `${state.attraction.toFixed(1)} a.u.`;
    const fieldLabel = `${state.fieldBias >= 0 ? '+' : ''}${state.fieldBias.toFixed(2)}`;
    const errorLabel = `${state.orbitError >= 0 ? '+' : ''}${state.orbitError.toFixed(1)} px`;
    if (hudTemp) hudTemp.textContent = fieldLabel;
    if (hudVolume) hudVolume.textContent = errorLabel;
    if (hudTempHold) hudTempHold.textContent = `${state.bandHold.toFixed(1)}s (grace ${state.graceLeft.toFixed(1)}s)`;
    if (hudStability) hudStability.textContent = `${Math.round(state.stability * 100)}%`;
    if (hudOrbit) hudOrbit.textContent = `${Math.round(r)} px`;
    if (hudVelocity) hudVelocity.textContent = `${Math.hypot(state.electron.vx, state.electron.vy).toFixed(1)} px/s`;
  }

  function updateStaticLabels() {
    if (faqStep) faqStep.textContent = `${config.fieldStep.toFixed(1)}`;
    if (faqBand) faqBand.textContent = `${Math.round(orbitBandHalfWidth())}`;
    if (faqBandPct) faqBandPct.textContent = `${Math.round(config.bandFraction * 100)}`;
  }

  function startSimulation() {
    resetSimulation();
    setPhase('simulate');
  }

  promptAction.addEventListener('click', () => {
    if (state.phase === 'intro' || state.phase === 'fail' || state.phase === 'success') {
      startSimulation();
    }
  });

  promptSkip.addEventListener('click', () => {
    if (state.phase === 'intro') {
      startSimulation();
    }
  });

  updateStaticLabels();

  const center = () => ({ x: canvas.clientWidth / 2, y: canvas.clientHeight / 2 + 20 });

  function drawStars(t) {
    if (!state.stars.length) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    starLayers.forEach((layer, layerIndex) => {
      const stars = state.stars[layerIndex] || [];
      const drift = layer.drift * (layerIndex + 1);
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        const flicker = 0.65 + 0.35 * Math.sin(t * 0.0012 + s.tw);
        const dx = Math.sin(t * drift + s.tw) * (6 + layerIndex * 3);
        const dy = Math.cos(t * drift + s.tw * 1.3) * (4 + layerIndex * 2);
        const x = (s.x + dx + w) % w;
        const y = (s.y + dy + h) % h;
        ctx.fillStyle = `rgba(154,230,255,${layer.alpha * flicker})`;
        ctx.fillRect(x, y, layer.size, layer.size);
      }
    });
  }

  function planeToWorld(x, y, z = 0, t = 0) {
    const rx = config.tiltX + Math.sin(t * 0.00035) * config.wobble;
    const ry = config.tiltY + Math.cos(t * 0.0004) * config.wobble;

    let wx = x;
    let wy = y;
    let wz = z;

    const cosX = Math.cos(rx);
    const sinX = Math.sin(rx);
    const cosY = Math.cos(ry);
    const sinY = Math.sin(ry);

    const y1 = wy * cosX - wz * sinX;
    const z1 = wy * sinX + wz * cosX;
    const x2 = wx * cosY + z1 * sinY;
    const z2 = -wx * sinY + z1 * cosY;

    return { x: x2, y: y1, z: z2 };
  }

  function project(point) {
    const c = center();
    const depth = Math.max(120, config.fov + point.z);
    const scale = config.fov / depth;
    return {
      x: c.x + point.x * scale,
      y: c.y + point.y * scale,
      scale,
    };
  }

  function drawProjectedRing(radius, stroke, lineWidth = 2) {
    ctx.save();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    const steps = 140;
    for (let i = 0; i <= steps; i++) {
      const ang = (i / steps) * Math.PI * 2;
      const px = Math.cos(ang) * radius;
      const py = Math.sin(ang) * radius;
      const world = planeToWorld(px, py, 0, state.time);
      const p = project(world);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  function drawProjectedRingDepth(radius, baseAlpha, lineWidth, depthStrength = 0.5, color = '138,255,168') {
    const steps = 140;
    let prev = null;
    for (let i = 0; i <= steps; i++) {
      const ang = (i / steps) * Math.PI * 2;
      const px = Math.cos(ang) * radius;
      const py = Math.sin(ang) * radius;
      const world = planeToWorld(px, py, 0, state.time);
      const proj = project(world);
      if (prev) {
        const depth = clamp(world.z / (radius * 0.6), -1, 1);
        const alpha = baseAlpha * (0.6 + depthStrength * (depth + 1) * 0.5);
        ctx.strokeStyle = `rgba(${color},${alpha})`;
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
    const color = state.inBand ? '138,255,168' : '255,210,120';
    const baseAlpha = state.inBand ? 0.18 : 0.12;
    const band = orbitBandHalfWidth();
    drawProjectedRingDepth(config.targetRadius - band, baseAlpha, 1.5, 0.6, color);
    drawProjectedRingDepth(config.targetRadius, baseAlpha + 0.06, 2.2, 0.7, color);
    drawProjectedRingDepth(config.targetRadius + band, baseAlpha, 1.5, 0.6, color);
  }

  function drawEnergyField(t) {
    const ringCount = 3;
    const stabilityGlow = 0.12 + state.stability * 0.5 + (state.inBand ? 0.12 : 0);
    for (let i = 0; i < ringCount; i++) {
      const radius = 60 + i * 26 + Math.sin(t * 0.003 + i) * 6;
      drawProjectedRing(radius, `rgba(122,162,255,${0.08 + i * 0.04 + stabilityGlow * 0.12})`, 2);
    }

    const { x, y } = center();
    const glow = 0.3 + Math.sin(t * 0.006) * 0.15 + stabilityGlow;
    const g = ctx.createRadialGradient(x, y, 10, x, y, 120);
    g.addColorStop(0, `rgba(154,230,255,${0.35 + glow})`);
    g.addColorStop(1, 'rgba(10,14,24,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, 120, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawCore(t) {
    const { x, y } = center();
    // Core
    const lightX = x - 8;
    const lightY = y - 10;
    const coreGradient = ctx.createRadialGradient(lightX, lightY, 2, x, y, 22);
    coreGradient.addColorStop(0, 'rgba(255,255,255,0.95)');
    coreGradient.addColorStop(0.45, 'rgba(154,230,255,0.95)');
    coreGradient.addColorStop(1, 'rgba(20,40,70,0.8)');
    ctx.shadowColor = 'rgba(154,230,255,0.45)';
    ctx.shadowBlur = 18;
    ctx.fillStyle = coreGradient;
    ctx.beginPath();
    ctx.arc(x, y, 10 + Math.sin(t * 0.004) * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Field ring (pull vs push)
    if (state.pullIntensity > 0.02) {
      const ringAlpha = 0.18 + state.pullIntensity * 0.6;
      ctx.strokeStyle = `rgba(154,230,255,${ringAlpha})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, 26, -Math.PI / 2, -Math.PI / 2 + state.pullIntensity * Math.PI * 2);
      ctx.stroke();
    }

    if (state.pushIntensity > 0.02) {
      ctx.strokeStyle = `rgba(255,180,84,${0.2 + state.pushIntensity * 0.6})`;
      ctx.lineWidth = 2.2;
      for (let i = 0; i < 4; i++) {
        const ang = t * 0.002 + i * (Math.PI / 2);
        const inner = 22;
        const outer = 30 + Math.sin(t * 0.004 + i) * 2;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(ang) * inner, y + Math.sin(ang) * inner * 0.7);
        ctx.lineTo(x + Math.cos(ang) * outer, y + Math.sin(ang) * outer * 0.7);
        ctx.stroke();
      }
    }

    // Quarks (u, u, d) with charges
    const quarks = [
      { label: 'u', charge: '+2/3', color: '#7aa2ff', phase: 0 },
      { label: 'u', charge: '+2/3', color: '#8affa8', phase: 2.1 },
      { label: 'd', charge: '−1/3', color: '#ffb454', phase: 4.2 },
    ];
    for (let i = 0; i < quarks.length; i++) {
      const q = quarks[i];
      const ang = t * 0.0014 + q.phase;
      const r = 52 + Math.sin(t * 0.002 + i) * 6;
      const qx = x + Math.cos(ang) * r;
      const qy = y + Math.sin(ang) * r * 0.78;
      ctx.fillStyle = q.color;
      ctx.beginPath();
      ctx.arc(qx, qy, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = '12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(q.label, qx, qy - 10);
      ctx.font = '10px system-ui, sans-serif';
      ctx.fillText(q.charge, qx, qy + 18);
    }

    // Gluon bonds (triangular linkage)
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < quarks.length; i++) {
      const q = quarks[i];
      const ang = t * 0.0014 + q.phase;
      const r = 52 + Math.sin(t * 0.002 + i) * 6;
      const qx = x + Math.cos(ang) * r;
      const qy = y + Math.sin(ang) * r * 0.78;
      if (i === 0) ctx.moveTo(qx, qy);
      else ctx.lineTo(qx, qy);
    }
    ctx.closePath();
    ctx.stroke();

  }

  function drawFieldFrame() {
    if (state.pullIntensity <= 0.02 && state.pushIntensity <= 0.02) return;
    const { x, y } = center();
    const r = config.frameRadius;
    ctx.save();

    if (state.pullIntensity > 0.02) {
      const alpha = 0.12 + state.pullIntensity * 0.55;
      ctx.strokeStyle = `rgba(154,230,255,${alpha})`;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.62, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = `rgba(200,240,255,${0.12 + state.pullIntensity * 0.35})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(x, y, r - 16, (r - 16) * 0.62, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (state.pushIntensity > 0.02) {
      const alpha = 0.12 + state.pushIntensity * 0.55;
      ctx.strokeStyle = `rgba(255,180,84,${alpha})`;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.ellipse(x, y, r - 8, (r - 8) * 0.62, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawElectron() {
    const e = state.electron;
    const world = planeToWorld(e.x, e.y, e.z, state.time);
    const p = project(world);
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(p.x + 6, p.y + 6, 6 * p.scale, 4 * p.scale, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5 * p.scale, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(154,230,255,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 7 * p.scale, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('e⁻', p.x, p.y - 10);
    ctx.restore();
  }

  function drawTrail() {
    if (state.trail.length < 2) return;
    for (let i = 1; i < state.trail.length; i++) {
      const prev = state.trail[i - 1];
      const curr = state.trail[i];
      const wPrev = planeToWorld(prev.x, prev.y, prev.z || 0, state.time);
      const wCurr = planeToWorld(curr.x, curr.y, curr.z || 0, state.time);
      const pPrev = project(wPrev);
      const pCurr = project(wCurr);
      const depth = clamp(wCurr.z / (config.targetRadius * 0.8), -1, 1);
      const alpha = 0.18 + (depth + 1) * 0.12;
      const width = 1.4 + pCurr.scale * 1.2;
      ctx.strokeStyle = `rgba(154,230,255,${alpha})`;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(pPrev.x, pPrev.y);
      ctx.lineTo(pCurr.x, pCurr.y);
      ctx.stroke();
    }
  }

  function drawParticles(t) {
    const { x, y } = center();
    for (let i = 0; i < 60; i++) {
      const angle = (i / 60) * Math.PI * 2 + t * 0.0006;
      const radius = 140 + Math.sin(t * 0.002 + i) * 12;
      const px = x + Math.cos(angle) * radius;
      const py = y + Math.sin(angle * 1.3) * radius * 0.5;
      ctx.fillStyle = 'rgba(154,230,255,0.25)';
      ctx.fillRect(px, py, 2, 2);
    }
  }

  function onWheel(e) {
    if (state.phase !== 'simulate') return;
    e.preventDefault();
    let dy = e.deltaY;
    if (e.deltaMode === 1) dy *= 16;
    if (e.deltaMode === 2) dy *= 240;

    state.wheelAccum += dy;
    const threshold = config.wheelThreshold;
    while (Math.abs(state.wheelAccum) >= threshold) {
      const direction = Math.sign(state.wheelAccum);
      applyFieldBias(direction > 0 ? config.fieldStep : -config.fieldStep);
      state.wheelAccum -= direction * threshold;
    }
  }

  canvas.addEventListener('wheel', onWheel, { passive: false });

  function applyFieldBias(delta) {
    if (state.phase !== 'simulate') return;
    state.fieldBiasTarget = clamp(state.fieldBiasTarget + delta, config.fieldMin, config.fieldMax);
    if (delta < 0) {
      state.pullIntensity = clamp(state.pullIntensity + 0.2, 0, 1);
      state.pushIntensity = Math.max(0, state.pushIntensity - 0.12);
    }
    if (delta > 0) {
      state.pushIntensity = clamp(state.pushIntensity + 0.2, 0, 1);
      state.pullIntensity = Math.max(0, state.pullIntensity - 0.12);
    }
  }

  function bindHold(el, delta) {
    if (!el) return;
    let timer = null;
    const step = () => applyFieldBias(delta);
    const clear = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };
    const down = (e) => {
      e.preventDefault();
      step();
      clear();
      timer = setInterval(step, 140);
    };
    const up = (e) => {
      e.preventDefault();
      clear();
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', up);
  }

  bindHold(btnCool, -config.fieldStep);
  bindHold(btnHeat, config.fieldStep);

  window.addEventListener('keydown', (e) => {
    if (state.phase !== 'simulate') return;
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
      e.preventDefault();
      applyFieldBias(-config.fieldStep);
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
      e.preventDefault();
      applyFieldBias(config.fieldStep);
    }
  });

  function updateSimulation(dt) {
    const e = state.electron;
    const dx = e.x;
    const dy = e.y;
    const r = Math.hypot(dx, dy) || 1;
    state.currentRadius = r;

    state.fieldBias += (state.fieldBiasTarget - state.fieldBias) * (1 - Math.exp(-config.fieldResponse * dt));

    const attract = -config.k / (r * r + config.softening);
    const drift = Math.sin(state.time * 0.0011) * config.driftForce;
    const fieldForce = state.fieldBias * config.fieldScale;
    const totalForce = attract + drift + fieldForce;
    const ax = (totalForce * dx) / r;
    const ay = (totalForce * dy) / r;

    e.vx += ax * dt;
    e.vy += ay * dt;

    const damp = Math.exp(-config.damping * dt);
    e.vx *= damp;
    e.vy *= damp;

    const speedBefore = Math.hypot(e.vx, e.vy);
    if (speedBefore > config.maxSpeed) {
      const scale = config.maxSpeed / speedBefore;
      e.vx *= scale;
      e.vy *= scale;
    }

    e.x += e.vx * dt;
    e.y += e.vy * dt;

    const angle = Math.atan2(e.y, e.x);
    const zAmp = 14 + Math.abs(state.fieldBias) * 4 + state.stability * 6;
    e.z = Math.sin(angle + state.time * 0.0012) * zAmp;

    const speed = Math.hypot(e.vx, e.vy);
    state.energy = 0.5 * speed * speed;

    state.pullIntensity = Math.max(0, state.pullIntensity - dt * 0.65);
    state.pushIntensity = Math.max(0, state.pushIntensity - dt * 0.65);

    const orbitError = r - config.targetRadius;
    state.orbitError = orbitError;
    const band = orbitBandHalfWidth();
    const inBand = Math.abs(orbitError) <= band;
    if (inBand && !state.inBand) {
      toast('Orbit band locked. Hold steady.', 900);
    }
    state.inBand = inBand;

    if (inBand) {
      state.bandHold += dt;
      state.graceLeft = config.grace;
    } else {
      state.bandHold = Math.max(0, state.bandHold - dt * 0.6);
      state.graceLeft = Math.max(0, state.graceLeft - dt);
    }

    const idealSpeed = Math.sqrt(Math.abs(attract) * r);
    const speedDeviation = Math.abs(speed - idealSpeed);
    const radiusScore = clamp(1 - Math.abs(orbitError) / (band * 1.2), 0, 1);
    const speedScore = clamp(1 - speedDeviation / (idealSpeed * 0.7 + 1), 0, 1);
    state.stability = clamp(radiusScore * 0.7 + speedScore * 0.3, 0, 1);

    state.trail.push({ x: e.x, y: e.y, z: e.z });
    if (state.trail.length > 70) state.trail.shift();

    if (r < config.coreRadius) {
      state.failReason = {
        title: 'Core Collision',
        body: 'The electron collapsed into the core. Push outward when the orbit tightens.',
      };
      setPhase('fail');
      return;
    }

    if (r > config.escapeRadius) {
      state.failReason = {
        title: 'Electron Escaped',
        body: 'The electron drifted too far. Pull inward to keep it inside the band.',
      };
      setPhase('fail');
      return;
    }

    if (!inBand && state.graceLeft <= 0) {
      state.failReason = {
        title: 'Orbit Unstable',
        body: 'The electron stayed outside the band too long. Use small pull/push corrections.',
      };
      setPhase('fail');
      return;
    }

    if (state.bandHold >= config.holdTime) {
      setPhase('success');
      return;
    }

    const needPull = orbitError > 0;
    const hint = inBand
      ? 'Hold steady inside the band.'
      : needPull
        ? 'Too far — pull in (scroll up / W / ↑).'
        : 'Too close — push out (scroll down / S / ↓).';
    if (hudStep && hudStep.textContent !== hint) hudStep.textContent = hint;

    if (orbitHint && orbitHintTitle && orbitHintSub) {
      orbitHint.dataset.mode = inBand ? 'hold' : needPull ? 'pull' : 'push';
      orbitHint.classList.add('show');
      orbitHintTitle.textContent = inBand ? 'HOLD' : needPull ? 'PULL IN' : 'PUSH OUT';
      orbitHintSub.textContent = inBand
        ? 'Stay inside the band.'
        : needPull
          ? 'Scroll up / W / ↑'
          : 'Scroll down / S / ↓';
    }

    btnCool?.classList.toggle('suggest', !inBand && needPull);
    btnHeat?.classList.toggle('suggest', !inBand && !needPull);

    if (state.tutorialLeft > 0) {
      state.tutorialLeft = Math.max(0, state.tutorialLeft - dt);
      if (!inBand && state.time >= state.tutorialNextPulseAt) {
        state.tutorialNextPulseAt = state.time + config.tutorialPulseEvery * 1000;
        if (orbitHintSub) {
          orbitHintSub.textContent = needPull ? 'Try a small pull pulse (scroll up).' : 'Try a small push pulse (scroll down).';
        }
      }
    }

    state.attraction = Math.abs(attract);
    state.fieldForce = fieldForce;
    if (hudEnergy) hudEnergy.textContent = Math.round(state.energy);
    if (hudPressure) hudPressure.textContent = `${state.attraction.toFixed(1)} a.u.`;
    const fieldLabel = `${state.fieldBias >= 0 ? '+' : ''}${state.fieldBias.toFixed(2)}`;
    const errorLabel = `${state.orbitError >= 0 ? '+' : ''}${state.orbitError.toFixed(1)} px`;
    if (hudTemp) hudTemp.textContent = fieldLabel;
    if (hudVolume) hudVolume.textContent = errorLabel;
    if (hudTempHold)
      hudTempHold.textContent = `${Math.min(state.bandHold, config.holdTime).toFixed(1)}s (grace ${state.graceLeft.toFixed(1)}s)`;
    if (hudStability) hudStability.textContent = `${Math.round(state.stability * 100)}%`;
    if (hudOrbit) hudOrbit.textContent = `${Math.round(r)} px`;
    if (hudVelocity) hudVelocity.textContent = `${speed.toFixed(1)} px/s`;
  }

  function render(t) {
    const dt = state.lastTime ? Math.min(0.04, (t - state.lastTime) / 1000) : 0.016;
    state.lastTime = t;
    state.time = t;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#05070b');
    grad.addColorStop(1, '#0a1322');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    drawStars(t);
    drawParticles(t);
    drawEnergyField(t);
    drawTargetBand();
    drawCore(t);
    drawTrail();
    drawElectron();
    drawFieldFrame();

    if (state.phase === 'intro') {
      const alpha = Math.min(1, t / 2000);
      ctx.fillStyle = `rgba(154,230,255,${0.16 * alpha})`;
      ctx.fillRect(0, 0, w, h);
    }

    if (state.phase === 'simulate') {
      updateSimulation(dt);
    }

    requestAnimationFrame(render);
  }

  startIntro();
  requestAnimationFrame(render);
})();
