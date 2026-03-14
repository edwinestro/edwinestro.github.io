import * as THREE from 'three';

// ─── AGI Visualization: liquid-metal wobbling sphere ───
const canvas = document.getElementById('agiCanvas');
const vizOverlay = document.getElementById('agiVizOverlay');
const vizTitle = document.getElementById('agiVizTitle');
const vizStats = document.getElementById('agiVizStats');
const vizClose = document.getElementById('agiVizClose');
const viewAgiBtn = document.getElementById('viewAgiBtn');

let scene, camera, renderer, sphere, clock, animId;
let targetTraits = { capability: 50, alignment: 50, resilience: 50, creativity: 50, risk: 20 };
let currentTraits = { ...targetTraits };
let initialized = false;

function initScene() {
  if (initialized) return;
  initialized = true;

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x050a18, 0.012);

  camera = new THREE.PerspectiveCamera(50, canvas.width / canvas.height, 0.1, 100);
  camera.position.set(0, 0.4, 3.6);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.width, canvas.height);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  // Environment sphere for reflections
  const envGeo = new THREE.SphereGeometry(30, 32, 32);
  const envMat = new THREE.MeshBasicMaterial({
    color: 0x0a1428,
    side: THREE.BackSide,
  });
  scene.add(new THREE.Mesh(envGeo, envMat));

  // AGI sphere — smooth subdivision for wobble
  const geo = new THREE.IcosahedronGeometry(1, 5);
  geo.userData.basePositions = new Float32Array(geo.attributes.position.array);

  const mat = new THREE.MeshPhysicalMaterial({
    color: 0x6ce8ff,
    metalness: 0.85,
    roughness: 0.12,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
    transmission: 0.15,
    thickness: 0.6,
    ior: 1.42,
    envMapIntensity: 2.0,
    emissive: 0x112244,
    emissiveIntensity: 0.15,
  });

  sphere = new THREE.Mesh(geo, mat);
  scene.add(sphere);

  // Ring particles
  const ringGeo = new THREE.BufferGeometry();
  const ringCount = 200;
  const ringPos = new Float32Array(ringCount * 3);
  for (let i = 0; i < ringCount; i++) {
    const a = (i / ringCount) * Math.PI * 2;
    const r = 1.7 + Math.random() * 0.3;
    ringPos[i * 3] = Math.cos(a) * r;
    ringPos[i * 3 + 1] = (Math.random() - 0.5) * 0.15;
    ringPos[i * 3 + 2] = Math.sin(a) * r;
  }
  ringGeo.setAttribute('position', new THREE.BufferAttribute(ringPos, 3));
  const ringMat = new THREE.PointsMaterial({ color: 0x7ff0c5, size: 0.03, transparent: true, opacity: 0.7 });
  const ring = new THREE.Points(ringGeo, ringMat);
  ring.name = 'ring';
  scene.add(ring);

  // Lighting
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
  keyLight.position.set(3, 4, 5);
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0x6ce8ff, 1.2);
  rimLight.position.set(-3, 2, -4);
  scene.add(rimLight);

  const bottomLight = new THREE.PointLight(0xff7bc1, 0.8, 8);
  bottomLight.position.set(0, -3, 1);
  scene.add(bottomLight);

  scene.add(new THREE.AmbientLight(0x1a2a44, 0.6));

  clock = new THREE.Clock();
}

function lerpTraits(dt) {
  const speed = 3.0 * dt;
  for (const key of Object.keys(currentTraits)) {
    currentTraits[key] += (targetTraits[key] - currentTraits[key]) * speed;
  }
}

function wobble(time) {
  const geo = sphere.geometry;
  const base = geo.userData.basePositions;
  const pos = geo.attributes.position.array;

  // Wobble intensity from risk (high risk = more chaotic)
  const riskFactor = currentTraits.risk / 100;
  const alignFactor = currentTraits.alignment / 100;
  const capFactor = currentTraits.capability / 100;
  const creativeFactor = currentTraits.creativity / 100;

  const amplitude = 0.06 + riskFactor * 0.14 - alignFactor * 0.03;
  const speed = 1.2 + riskFactor * 1.5 + creativeFactor * 0.6;
  const complexity = 2 + Math.floor(capFactor * 4);

  for (let i = 0; i < pos.length; i += 3) {
    const bx = base[i], by = base[i + 1], bz = base[i + 2];
    const len = Math.sqrt(bx * bx + by * by + bz * bz);
    const nx = bx / len, ny = by / len, nz = bz / len;

    // Multi-octave noise-like wobble using sin layers
    let displacement = 0;
    for (let oct = 1; oct <= complexity; oct++) {
      const freq = oct * 1.7;
      displacement += Math.sin(nx * freq + time * speed + oct) *
                      Math.cos(ny * freq * 1.3 + time * speed * 0.7 + oct * 0.5) *
                      Math.sin(nz * freq * 0.9 + time * speed * 0.5 + oct * 1.2) *
                      (amplitude / oct);
    }

    // Scale by capability
    const scale = 0.85 + capFactor * 0.35;
    pos[i] = bx * scale + nx * displacement;
    pos[i + 1] = by * scale + ny * displacement;
    pos[i + 2] = bz * scale + nz * displacement;
  }

  geo.attributes.position.needsUpdate = true;
  geo.computeVertexNormals();
}

function updateMaterial() {
  const mat = sphere.material;
  const cap = currentTraits.capability / 100;
  const align = currentTraits.alignment / 100;
  const res = currentTraits.resilience / 100;
  const cre = currentTraits.creativity / 100;
  const risk = currentTraits.risk / 100;

  // Color shifts: alignment → cyan/green, capability → white/bright, creativity → purple/pink, risk → red
  const r = 0.15 + risk * 0.6 + cre * 0.3;
  const g = 0.6 + align * 0.3 + res * 0.1;
  const b = 0.9 + cap * 0.1 - risk * 0.3;
  mat.color.setRGB(Math.min(r, 1), Math.min(g, 1), Math.min(b, 1));

  // Higher alignment = more mirror-like, less rough
  mat.roughness = 0.25 - align * 0.18;
  mat.metalness = 0.7 + align * 0.2;

  // Risk adds emissive glow
  mat.emissive.setRGB(risk * 0.4, risk * 0.05, risk * 0.12);
  mat.emissiveIntensity = 0.1 + risk * 0.6;

  // Creativity increases transmission (more ethereal)
  mat.transmission = 0.05 + cre * 0.2;

  // Resilience increases clearcoat
  mat.clearcoat = 0.6 + res * 0.4;
}

function animate() {
  animId = requestAnimationFrame(animate);
  const dt = clock.getDelta();
  const time = clock.getElapsedTime();

  lerpTraits(dt);
  wobble(time);
  updateMaterial();

  // Slow rotation
  sphere.rotation.y = time * 0.15;
  sphere.rotation.x = Math.sin(time * 0.08) * 0.1;

  // Ring rotation
  const ring = scene.getObjectByName('ring');
  if (ring) {
    ring.rotation.y = -time * 0.12;
    ring.rotation.x = Math.sin(time * 0.1) * 0.06;
  }

  renderer.render(scene, camera);
}

function updateStatsDisplay() {
  const c = targetTraits;
  vizStats.innerHTML = [
    `<span style="color:#6ce8ff">Cap ${Math.round(c.capability)}</span>`,
    `<span style="color:#7ff0c5">Align ${Math.round(c.alignment)}</span>`,
    `<span style="color:#ffd978">Res ${Math.round(c.resilience)}</span>`,
    `<span style="color:#ff7bc1">Cre ${Math.round(c.creativity)}</span>`,
    `<span style="color:#ff7d7d">Risk ${Math.round(c.risk)}</span>`,
  ].join(' · ');
}

function showViz(candidate, title) {
  if (!candidate) return;
  initScene();

  targetTraits = {
    capability: candidate.capability,
    alignment: candidate.alignment,
    resilience: candidate.resilience,
    creativity: candidate.creativity,
    risk: candidate.risk,
  };

  vizTitle.textContent = title || `${candidate.name} — AGI Form`;
  updateStatsDisplay();
  vizOverlay.classList.remove('hidden');

  if (!animId) {
    clock.start();
    animate();
  }
}

function hideViz() {
  vizOverlay.classList.add('hidden');
  if (animId) {
    cancelAnimationFrame(animId);
    animId = null;
  }
}

vizClose.addEventListener('click', hideViz);
vizOverlay.addEventListener('click', (e) => {
  if (e.target === vizOverlay) hideViz();
});

// "View AGI form" button
viewAgiBtn.addEventListener('click', () => {
  if (typeof window.getAgiVizCandidate === 'function') {
    const c = window.getAgiVizCandidate();
    if (c) showViz(c, `${c.name} — AGI Form`);
  }
});

// Expose for game.js to call
window.showAgiViz = showViz;
window.hideAgiViz = hideViz;
