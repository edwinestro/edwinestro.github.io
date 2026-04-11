import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ELEMENTS, SCENES } from "./interaction-data.js";

/* ═══════════════════════════════════════════
   Utilities
   ═══════════════════════════════════════════ */
const toastEl = document.getElementById("toast");
let toastTimer = 0;
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2200);
}

/* ═══════════════════════════════════════════
   State
   ═══════════════════════════════════════════ */
let currentSceneIdx = 0;
let sceneData = null;     // generated groups
let simPlaying = false;
let simProgress = 0;      // 0→1 approach, 1→2 docked/bound
let simSpeed = 1.0;
let showForces = true;
let showLabels = true;

/* ═══════════════════════════════════════════
   Scene, Camera, Renderer
   ═══════════════════════════════════════════ */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x080c14);
scene.fog = new THREE.FogExp2(0x080c14, 0.005);

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 1000);
camera.position.set(30, 25, 45);

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
document.body.prepend(renderer.domElement);

/* Post-processing */
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(innerWidth, innerHeight), 0.4, 0.6, 0.45
);
composer.addPass(bloomPass);
let bloomEnabled = true;

/* Controls */
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 8;
controls.maxDistance = 250;

/* Lighting */
scene.add(new THREE.AmbientLight(0xffffff, 0.4));
const dir1 = new THREE.DirectionalLight(0xffffff, 1.0);
dir1.position.set(20, 30, 25);
scene.add(dir1);
const dir2 = new THREE.DirectionalLight(0x4488ff, 0.3);
dir2.position.set(-15, -8, -20);
scene.add(dir2);
const rim = new THREE.DirectionalLight(0xff6b9d, 0.15);
rim.position.set(5, -10, 20);
scene.add(rim);

/* Grid */
const grid = new THREE.GridHelper(150, 50, 0x1a2a4a, 0x111828);
grid.position.y = -30;
grid.material.transparent = true;
grid.material.opacity = 0.3;
scene.add(grid);

/* Ambient particles */
const PCOUNT = 250;
const pGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(PCOUNT * 3);
const pSpd = new Float32Array(PCOUNT);
for (let i = 0; i < PCOUNT; i++) {
  pPos[i * 3] = (Math.random() - 0.5) * 200;
  pPos[i * 3 + 1] = (Math.random() - 0.5) * 200;
  pPos[i * 3 + 2] = (Math.random() - 0.5) * 200;
  pSpd[i] = 0.01 + Math.random() * 0.025;
}
pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
const pMat = new THREE.PointsMaterial({ color: 0x335588, size: 0.3, transparent: true, opacity: 0.3, sizeAttenuation: true });
scene.add(new THREE.Points(pGeo, pMat));
function updateParticles() {
  const a = pGeo.attributes.position.array;
  for (let i = 0; i < PCOUNT; i++) { a[i * 3 + 1] += pSpd[i]; if (a[i * 3 + 1] > 100) a[i * 3 + 1] = -100; }
  pGeo.attributes.position.needsUpdate = true;
}

/* ═══════════════════════════════════════════
   Molecule Groups
   ═══════════════════════════════════════════ */
const groupA = new THREE.Group();
const groupB = new THREE.Group();
scene.add(groupA, groupB);

let meshesA = [], meshesB = [], bondsA = [], bondsB = [];
let forceLines = [];
let labelSprites = [];

const sphereGeo = new THREE.SphereGeometry(1, 24, 18);
const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 8);

function buildGroup(data, group, meshes, bondMeshes, tintColor) {
  group.clear();
  meshes.length = 0;
  bondMeshes.length = 0;

  const showBonds = document.getElementById("bond-toggle").checked;
  data.atoms.forEach((atom, i) => {
    const el = ELEMENTS[atom.element] || ELEMENTS.C;
    const mat = new THREE.MeshPhongMaterial({
      color: tintColor || el.color,
      shininess: 80,
      specular: 0x444444,
      emissive: new THREE.Color(tintColor || el.color).multiplyScalar(0.05),
    });
    const mesh = new THREE.Mesh(sphereGeo, mat);
    mesh.position.set(atom.x, atom.y, atom.z);
    mesh.scale.setScalar(el.radius * 0.9);
    mesh.userData = { index: i, element: atom.element, residue: atom.residue, group: atom.group,
      homePos: new THREE.Vector3(atom.x, atom.y, atom.z), baseScale: el.radius * 0.9 };
    group.add(mesh);
    meshes.push(mesh);
  });

  const bMat = new THREE.MeshPhongMaterial({ color: 0x445566, shininess: 20, transparent: true, opacity: 0.7 });
  data.bonds.forEach((b) => {
    const a1 = data.atoms[b.from], a2 = data.atoms[b.to];
    if (!a1 || !a2) return;
    const s = new THREE.Vector3(a1.x, a1.y, a1.z);
    const e = new THREE.Vector3(a2.x, a2.y, a2.z);
    const mid = s.clone().add(e).multiplyScalar(0.5);
    const len = s.distanceTo(e);
    const mesh = new THREE.Mesh(cylGeo, bMat);
    mesh.position.copy(mid);
    mesh.scale.set(0.08, len, 0.08);
    const dir = e.clone().sub(s).normalize();
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    mesh.visible = showBonds;
    group.add(mesh);
    bondMeshes.push(mesh);
  });
}

function clearForceLines() {
  forceLines.forEach(l => { scene.remove(l); l.geometry.dispose(); });
  forceLines = [];
}

function clearLabels() {
  labelSprites.forEach(s => { scene.remove(s); s.material.map?.dispose(); s.material.dispose(); });
  labelSprites = [];
}

function makeLabel(text, position, color) {
  const canvas = document.createElement("canvas");
  const ctx =
    canvas.getContext("2d", { alpha: false, desynchronized: true }) ||
    canvas.getContext("2d");
  canvas.width = 256; canvas.height = 64;
  ctx.fillStyle = "transparent"; ctx.fillRect(0, 0, 256, 64);
  ctx.font = "bold 28px system-ui";
  ctx.fillStyle = color || "#64d2ff";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(text, 128, 32);
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.position.copy(position);
  sprite.scale.set(12, 3, 1);
  scene.add(sprite);
  labelSprites.push(sprite);
  return sprite;
}

function updateForceLines() {
  clearForceLines();
  if (!showForces || simProgress >= 1.0) return;

  // Draw attraction lines from B centroid to A centroid
  const cA = new THREE.Vector3(), cB = new THREE.Vector3();
  meshesA.forEach(m => cA.add(m.getWorldPosition(new THREE.Vector3())));
  meshesB.forEach(m => cB.add(m.getWorldPosition(new THREE.Vector3())));
  if (meshesA.length) cA.divideScalar(meshesA.length);
  if (meshesB.length) cB.divideScalar(meshesB.length);

  // Draw dashed lines
  const count = 5;
  for (let i = 0; i < count; i++) {
    const frac = (i + 1) / (count + 1);
    const start = cA.clone().lerp(cB, frac - 0.05);
    const end = cA.clone().lerp(cB, frac + 0.05);
    const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
    const mat = new THREE.LineBasicMaterial({
      color: 0x64ffda, transparent: true,
      opacity: 0.4 * (1.0 - simProgress),
    });
    const line = new THREE.Line(geo, mat);
    scene.add(line);
    forceLines.push(line);
  }
}

/* ═══════════════════════════════════════════
   Load Scene
   ═══════════════════════════════════════════ */
function loadScene(idx) {
  currentSceneIdx = idx;
  const sc = SCENES[idx];
  sceneData = sc.generate();

  buildGroup(sceneData.groupA, groupA, meshesA, bondsA, sc.moleculeA.color);
  buildGroup(sceneData.groupB, groupB, meshesB, bondsB, sc.moleculeB.color);

  // Position B at start offset
  const so = sceneData.startOffsetB;
  groupB.position.set(so.x, so.y, so.z);

  // Center A
  groupA.position.set(0, 0, 0);

  // Reset sim
  simProgress = 0;
  simPlaying = false;
  document.getElementById("play-btn").textContent = "▶ Play";

  // Camera fit
  const box = new THREE.Box3().setFromObject(groupA);
  box.expandByObject(groupB);
  const size = box.getSize(new THREE.Vector3()).length();
  const center = box.getCenter(new THREE.Vector3());
  camera.position.set(center.x + size * 0.6, center.y + size * 0.4, center.z + size * 0.8);
  controls.target.copy(center);
  controls.update();
  grid.position.y = box.min.y - 5;

  // Labels
  clearLabels();
  if (showLabels) {
    const boxA = new THREE.Box3().setFromObject(groupA);
    const topA = new THREE.Vector3(); boxA.getCenter(topA); topA.y = boxA.max.y + 3;
    makeLabel(sc.moleculeA.name, topA, `#${sc.moleculeA.color.toString(16).padStart(6, "0")}`);

    const boxB = new THREE.Box3().setFromObject(groupB);
    const topB = new THREE.Vector3(); boxB.getCenter(topB); topB.y = boxB.max.y + 3;
    makeLabel(sc.moleculeB.name, topB, `#${sc.moleculeB.color.toString(16).padStart(6, "0")}`);
  }

  // Force lines
  updateForceLines();

  // Update UI
  document.getElementById("info-mol-a").textContent = sc.moleculeA.name;
  document.getElementById("info-mol-b").textContent = sc.moleculeB.name;
  document.getElementById("info-atoms").textContent = sceneData.groupA.atoms.length + sceneData.groupB.atoms.length;
  document.getElementById("info-description").textContent = sc.description;
  updateStateBadge("Approaching");

  // Legend
  const legendItems = document.getElementById("legend-items");
  legendItems.innerHTML = `
    <div class="legend-mol"><span class="legend-dot" style="background:#${sc.moleculeA.color.toString(16).padStart(6, "0")};"></span>${sc.moleculeA.name}</div>
    <div class="legend-mol"><span class="legend-dot" style="background:#${sc.moleculeB.color.toString(16).padStart(6, "0")};"></span>${sc.moleculeB.name}</div>
    <div class="legend-mol" style="margin-top:4px; font-size:11px; color:var(--text-muted);">Binding: ${sc.bindingType}</div>
  `;

  showToast(sc.name);
}

function updateStateBadge(state) {
  const el = document.getElementById("info-state");
  el.textContent = state;
  el.className = "state-badge";
  if (state === "Bound") el.classList.add("bound");
  else if (state === "Active") el.classList.add("active");
}

/* ═══════════════════════════════════════════
   Simulation Step
   ═══════════════════════════════════════════ */
function simStep(dt) {
  if (!simPlaying || !sceneData) return;

  const speed = simSpeed * dt * 0.4;

  if (simProgress < 1.0) {
    // Phase 1: Approach — lerp groupB toward dock position
    simProgress = Math.min(simProgress + speed, 1.0);
    const ease = 1 - Math.pow(1 - simProgress, 3);
    const so = sceneData.startOffsetB;
    const dock = sceneData.dockOffsetB;
    groupB.position.set(
      so.x + (dock.x - so.x) * ease,
      so.y + (dock.y - so.y) * ease,
      so.z + (dock.z - so.z) * ease
    );
    updateForceLines();
    updateStateBadge("Approaching");

    // Update label position for B
    if (labelSprites.length >= 2) {
      const boxB = new THREE.Box3().setFromObject(groupB);
      const topB = new THREE.Vector3(); boxB.getCenter(topB); topB.y = boxB.max.y + 3;
      labelSprites[1].position.copy(topB);
    }
  } else if (simProgress >= 1.0 && simProgress < 2.0) {
    // Phase 2: Bound — gentle pulsing
    simProgress += speed * 0.3;
    updateStateBadge("Bound");

    // Pulse binding glow
    const pulse = Math.sin(simProgress * 4) * 0.08 + 1.0;
    meshesB.forEach(m => m.scale.setScalar(m.userData.baseScale * pulse));

    if (simProgress >= 1.5) {
      updateStateBadge("Active");
      // Slight conformational change in A
      const wobble = Math.sin(simProgress * 3) * 0.15;
      groupA.rotation.y = wobble;
    }
  }

  if (simProgress >= 2.0) {
    simPlaying = false;
    document.getElementById("play-btn").textContent = "▶ Play";
    updateStateBadge("Complete");
    showToast("Interaction complete!");
    clearForceLines();
  }
}

/* ═══════════════════════════════════════════
   Raycaster / Tooltip
   ═══════════════════════════════════════════ */
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const tooltip = document.getElementById("tooltip");
let hoveredMesh = null;

renderer.domElement.addEventListener("pointermove", (e) => {
  pointer.x = (e.clientX / innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const allMeshes = [...meshesA, ...meshesB];
  const hits = raycaster.intersectObjects(allMeshes);
  if (hits.length) {
    const mesh = hits[0].object;
    const d = mesh.userData;
    const el = ELEMENTS[d.element] || { name: d.element };
    tooltip.textContent = `${el.name} (${d.element}) — ${d.residue}`;
    tooltip.style.display = "block";
    tooltip.style.left = e.clientX + 14 + "px";
    tooltip.style.top = e.clientY - 10 + "px";
    renderer.domElement.style.cursor = "pointer";
    if (hoveredMesh && hoveredMesh !== mesh) hoveredMesh.scale.setScalar(hoveredMesh.userData.baseScale);
    mesh.scale.setScalar(mesh.userData.baseScale * 1.3);
    hoveredMesh = mesh;
  } else {
    tooltip.style.display = "none";
    renderer.domElement.style.cursor = "grab";
    if (hoveredMesh) { hoveredMesh.scale.setScalar(hoveredMesh.userData.baseScale); hoveredMesh = null; }
  }
});

/* ═══════════════════════════════════════════
   UI Controls
   ═══════════════════════════════════════════ */
// Scene selector
const sceneSelect = document.getElementById("scene-select");
SCENES.forEach((s, i) => {
  const opt = document.createElement("option");
  opt.value = i;
  opt.textContent = s.name;
  sceneSelect.appendChild(opt);
});
sceneSelect.addEventListener("change", () => loadScene(parseInt(sceneSelect.value, 10)));

// Play / Pause
const playBtn = document.getElementById("play-btn");
playBtn.addEventListener("click", () => {
  if (simProgress >= 2.0) { simProgress = 0; }
  simPlaying = !simPlaying;
  playBtn.textContent = simPlaying ? "⏸ Pause" : "▶ Play";
  if (simPlaying) showToast("Simulation running");
});

// Reset
document.getElementById("reset-btn").addEventListener("click", () => {
  loadScene(currentSceneIdx);
  showToast("Reset");
});

// Speed
document.getElementById("speed-slider").addEventListener("input", (e) => {
  simSpeed = parseFloat(e.target.value);
});

// Bonds
const bondToggle = document.getElementById("bond-toggle");
bondToggle.addEventListener("change", () => {
  [...bondsA, ...bondsB].forEach(m => (m.visible = bondToggle.checked));
});

// Forces
document.getElementById("forces-toggle").addEventListener("change", (e) => {
  showForces = e.target.checked;
  if (!showForces) clearForceLines();
  else updateForceLines();
});

// Labels
document.getElementById("labels-toggle").addEventListener("change", (e) => {
  showLabels = e.target.checked;
  labelSprites.forEach(s => (s.visible = showLabels));
});

// Spin
const spinToggle = document.getElementById("spin-toggle");
spinToggle.addEventListener("change", () => {
  controls.autoRotate = spinToggle.checked;
  controls.autoRotateSpeed = 1.5;
});

// Bloom
const bloomToggle = document.getElementById("bloom-toggle");
bloomToggle.addEventListener("change", () => { bloomEnabled = bloomToggle.checked; });

// Screenshot
function takeScreenshot() {
  if (bloomEnabled) composer.render(); else renderer.render(scene, camera);
  const link = document.createElement("a");
  link.download = `interaction-${SCENES[currentSceneIdx].id}-${Date.now()}.png`;
  link.href = renderer.domElement.toDataURL("image/png");
  link.click();
  showToast("Screenshot saved!");
}
document.getElementById("screenshot-btn").addEventListener("click", takeScreenshot);

/* ═══════════════════════════════════════════
   Keyboard
   ═══════════════════════════════════════════ */
window.addEventListener("keydown", (e) => {
  if (["INPUT", "SELECT", "TEXTAREA"].includes(e.target.tagName)) return;
  switch (e.key.toLowerCase()) {
    case " ":
      e.preventDefault();
      playBtn.click();
      break;
    case "r":
      loadScene(currentSceneIdx);
      showToast("Reset");
      break;
    case "s":
      spinToggle.checked = !spinToggle.checked;
      spinToggle.dispatchEvent(new Event("change"));
      showToast(spinToggle.checked ? "Spin ON" : "Spin OFF");
      break;
    case "f":
      showForces = !showForces;
      document.getElementById("forces-toggle").checked = showForces;
      if (!showForces) clearForceLines(); else updateForceLines();
      showToast(showForces ? "Forces shown" : "Forces hidden");
      break;
    case "p":
      takeScreenshot();
      break;
    case "arrowleft": {
      const idx = (currentSceneIdx - 1 + SCENES.length) % SCENES.length;
      sceneSelect.value = idx; loadScene(idx);
      break;
    }
    case "arrowright": {
      const idx = (currentSceneIdx + 1) % SCENES.length;
      sceneSelect.value = idx; loadScene(idx);
      break;
    }
  }
});

/* ═══════════════════════════════════════════
   Animation Loop
   ═══════════════════════════════════════════ */
const fpsEl = document.getElementById("fps-counter");
let frameCount = 0, lastFpsTime = performance.now(), lastTime = performance.now();

function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt = (now - lastTime) / 1000;
  lastTime = now;

  controls.update();
  updateParticles();
  simStep(dt);

  // FPS
  frameCount++;
  if (now - lastFpsTime >= 500) {
    fpsEl.textContent = `${Math.round(frameCount / ((now - lastFpsTime) / 1000))} fps`;
    frameCount = 0; lastFpsTime = now;
  }

  if (bloomEnabled) composer.render(); else renderer.render(scene, camera);
}

/* ═══════════════════════════════════════════
   Init
   ═══════════════════════════════════════════ */
loadScene(0);
animate();
setTimeout(() => document.getElementById("loading").classList.add("hidden"), 400);

/* Resize */
window.addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
});
