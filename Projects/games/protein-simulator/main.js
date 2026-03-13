import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import {
  ELEMENTS,
  STRUCTURES,
  getChainColor,
  getResidueColor,
} from "./protein-data.js";

/* ═══════════════════════════════════════════
   0. Utility: toast notifications
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
   1. Structure state (mutable — swapped on select)
   ═══════════════════════════════════════════ */
let currentStructureIdx = 0;
let { atoms, bonds, residueCount } = STRUCTURES[0].generate();

/* ═══════════════════════════════════════════
   2. Scene, Camera, Renderer
   ═══════════════════════════════════════════ */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0e17);
scene.fog = new THREE.FogExp2(0x0b0e17, 0.008);

const camera = new THREE.PerspectiveCamera(
  55,
  window.innerWidth / window.innerHeight,
  0.1,
  800
);
camera.position.set(20, 20, 30);

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
document.body.prepend(renderer.domElement);

/* ═══════════════════════════════════════════
   2b. Post-processing: Bloom / Glow
   ═══════════════════════════════════════════ */
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.45,   // strength
  0.6,    // radius
  0.4     // threshold
);
composer.addPass(bloomPass);
let bloomEnabled = true;

/* ═══════════════════════════════════════════
   3. Orbit Controls
   ═══════════════════════════════════════════ */
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 5;
controls.maxDistance = 200;

/* ═══════════════════════════════════════════
   4. Lighting (enhanced)
   ═══════════════════════════════════════════ */
scene.add(new THREE.AmbientLight(0xffffff, 0.45));

const dirLight = new THREE.DirectionalLight(0xffffff, 1.1);
dirLight.position.set(15, 25, 20);
scene.add(dirLight);

const backLight = new THREE.DirectionalLight(0x4488ff, 0.35);
backLight.position.set(-10, -5, -15);
scene.add(backLight);

const rimLight = new THREE.DirectionalLight(0xff6b9d, 0.2);
rimLight.position.set(5, -10, 20);
scene.add(rimLight);

/* ═══════════════════════════════════════════
   4b. Ground grid plane
   ═══════════════════════════════════════════ */
const gridHelper = new THREE.GridHelper(120, 40, 0x1a2a4a, 0x111828);
gridHelper.position.y = -25;
gridHelper.material.transparent = true;
gridHelper.material.opacity = 0.35;
scene.add(gridHelper);

/* ═══════════════════════════════════════════
   4c. Ambient floating particles
   ═══════════════════════════════════════════ */
const PARTICLE_COUNT = 300;
const particleGeo = new THREE.BufferGeometry();
const particlePositions = new Float32Array(PARTICLE_COUNT * 3);
const particleSpeeds = new Float32Array(PARTICLE_COUNT);
for (let i = 0; i < PARTICLE_COUNT; i++) {
  particlePositions[i * 3] = (Math.random() - 0.5) * 200;
  particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 200;
  particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 200;
  particleSpeeds[i] = 0.01 + Math.random() * 0.03;
}
particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
const particleMat = new THREE.PointsMaterial({
  color: 0x4488cc,
  size: 0.3,
  transparent: true,
  opacity: 0.35,
  sizeAttenuation: true,
});
const particleSystem = new THREE.Points(particleGeo, particleMat);
scene.add(particleSystem);

function updateParticles() {
  const pos = particleGeo.attributes.position.array;
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    pos[i * 3 + 1] += particleSpeeds[i];
    if (pos[i * 3 + 1] > 100) pos[i * 3 + 1] = -100;
  }
  particleGeo.attributes.position.needsUpdate = true;
}

/* ═══════════════════════════════════════════
   5. Build protein mesh group
   ═══════════════════════════════════════════ */
let proteinGroup = new THREE.Group();
scene.add(proteinGroup);

let atomMeshes = [];
let bondMeshes = [];
let ribbonMeshes = [];
let atomSizeScale = 1.0;
let currentScheme = "cpk";
let showRibbon = false;
let renderMode = "ball-stick"; // ball-stick | space-fill | wireframe
let exploded = false;
let hoveredMesh = null;

const VDW_RADII = { C: 1.7, N: 1.55, O: 1.52, H: 1.2, S: 1.8 };  // van der Waals radii

const sphereGeo = new THREE.SphereGeometry(1, 32, 24);
const cylinderGeo = new THREE.CylinderGeometry(1, 1, 1, 10);
const bondMat = new THREE.MeshPhongMaterial({ color: 0x556677, shininess: 30, transparent: true, opacity: 0.85 });
const wireMat = new THREE.MeshPhongMaterial({ color: 0x556677, shininess: 30, wireframe: true, transparent: true, opacity: 0.6 });

/* ── Selection state (hoisted before buildMeshes) ── */
const selectedAtoms = [];  // max 2
const highlightColor = 0xff6b9d;
const selectionPanel = document.getElementById("selection-info");
let distanceLine = null;

function clearSelection() {
  selectedAtoms.forEach(({ mesh, originalColor }) => {
    mesh.material.color.setHex(originalColor);
    mesh.material.emissive.setHex(0x000000);
  });
  selectedAtoms.length = 0;
  selectionPanel.style.display = "none";
  if (distanceLine) {
    scene.remove(distanceLine);
    distanceLine.geometry.dispose();
    distanceLine = null;
  }
}

function getAtomColor(atom, index) {
  if (currentScheme === "cpk") return ELEMENTS[atom.element].color;
  const rIdx = Math.floor(index / 5);
  if (currentScheme === "chain") return getChainColor(rIdx, residueCount);
  return getResidueColor(rIdx, residueCount);
}

function getAtomRadius(atom) {
  if (renderMode === "space-fill") return VDW_RADII[atom.element] || 1.5;
  return ELEMENTS[atom.element].radius;
}

/** Build backbone ribbon (tube along Cα positions) */
function buildRibbon() {
  // Clear old ribbons
  ribbonMeshes.forEach((m) => { proteinGroup.remove(m); m.geometry.dispose(); });
  ribbonMeshes = [];

  // Collect Cα positions (every backbone has N, Cα, C, O, H pattern — Cα is index 1 mod 5 in backbone)
  const caPositions = [];
  atoms.forEach((a, i) => {
    // Cα atoms are the second atom per residue backbone (element C, not carbonyl)
    // Heuristic: backbone Cα is at positions where the previous atom is N
    if (i > 0 && atoms[i - 1].element === "N" && a.element === "C" &&
        a.residue === atoms[i - 1].residue) {
      caPositions.push(new THREE.Vector3(a.x, a.y, a.z));
    }
  });

  if (caPositions.length < 2) return;

  const curve = new THREE.CatmullRomCurve3(caPositions, false, "catmullrom", 0.5);
  const tubeGeo = new THREE.TubeGeometry(curve, caPositions.length * 6, 0.45, 8, false);
  const tubeMat = new THREE.MeshPhongMaterial({
    color: 0x64d2ff,
    shininess: 60,
    transparent: true,
    opacity: 0.7,
    side: THREE.DoubleSide,
  });
  const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
  tubeMesh.visible = showRibbon;
  proteinGroup.add(tubeMesh);
  ribbonMeshes.push(tubeMesh);
}

/** Rebuild all meshes from current atoms/bonds arrays */
function buildMeshes() {
  // Clear old meshes
  proteinGroup.clear();
  atomMeshes = [];
  bondMeshes = [];
  ribbonMeshes = [];
  clearSelection();

  // Atoms
  atoms.forEach((atom, i) => {
    const el = ELEMENTS[atom.element];
    const isWire = renderMode === "wireframe";
    const mat = isWire
      ? new THREE.MeshPhongMaterial({
          color: getAtomColor(atom, i),
          wireframe: true,
          transparent: true,
          opacity: 0.6,
        })
      : new THREE.MeshPhongMaterial({
          color: getAtomColor(atom, i),
          shininess: 90,
          specular: 0x666666,
          emissive: new THREE.Color(getAtomColor(atom, i)).multiplyScalar(0.06),
        });
    const mesh = new THREE.Mesh(sphereGeo, mat);
    mesh.position.set(atom.x, atom.y, atom.z);
    mesh.scale.setScalar(getAtomRadius(atom) * atomSizeScale);
    mesh.userData = {
      index: i,
      element: atom.element,
      residue: atom.residue,
      homePos: new THREE.Vector3(atom.x, atom.y, atom.z),
      baseScale: getAtomRadius(atom) * atomSizeScale,
    };
    proteinGroup.add(mesh);
    atomMeshes.push(mesh);
  });

  // Bonds
  const showBonds = document.getElementById("bond-toggle").checked;
  const isWire = renderMode === "wireframe";
  const currentBondMat = isWire ? wireMat : bondMat;
  const hideBondsInSpaceFill = renderMode === "space-fill";
  bonds.forEach((bond) => {
    const a = atoms[bond.from];
    const b = atoms[bond.to];
    if (!a || !b) return;
    const start = new THREE.Vector3(a.x, a.y, a.z);
    const end = new THREE.Vector3(b.x, b.y, b.z);
    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    const len = start.distanceTo(end);

    const mesh = new THREE.Mesh(cylinderGeo, currentBondMat);
    mesh.position.copy(mid);
    mesh.scale.set(0.12, len, 0.12);
    mesh.visible = showBonds && !hideBondsInSpaceFill;

    const dir = new THREE.Vector3().subVectors(end, start).normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    mesh.quaternion.copy(quat);

    proteinGroup.add(mesh);
    bondMeshes.push(mesh);
  });

  // Backbone ribbon
  buildRibbon();

  // Center
  const box = new THREE.Box3().setFromObject(proteinGroup);
  const center = box.getCenter(new THREE.Vector3());
  proteinGroup.position.sub(center);
  controls.target.set(0, 0, 0);

  // Position grid under the molecule
  const boxSize = box.getSize(new THREE.Vector3());
  gridHelper.position.y = -boxSize.y * 0.6;

  // Fit camera with smooth transition
  const size = box.getSize(new THREE.Vector3()).length();
  animateCamera(new THREE.Vector3(size * 0.8, size * 0.6, size * 1.0));

  // Update info panel with animated counters
  animateCounter("info-residues", residueCount);
  animateCounter("info-atoms", atoms.length);
  animateCounter("info-bonds", bonds.length);
  document.getElementById("info-description").textContent = STRUCTURES[currentStructureIdx].description;

  // Reset explode state
  exploded = false;
  document.getElementById("explode-btn").textContent = "💥 Explode";
}

/** Animate a number counter in an element */
function animateCounter(id, target) {
  const el = document.getElementById(id);
  const start = parseInt(el.textContent) || 0;
  const diff = target - start;
  const duration = 400;
  const startTime = performance.now();
  function step(now) {
    const t = Math.min((now - startTime) / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3); // easeOutCubic
    el.textContent = Math.round(start + diff * ease);
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/** Smooth camera transition */
function animateCamera(targetPos) {
  const startPos = camera.position.clone();
  const duration = 600;
  const startTime = performance.now();
  function step(now) {
    const t = Math.min((now - startTime) / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    camera.position.lerpVectors(startPos, targetPos, ease);
    controls.update();
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/** Switch to a different structure by index */
function loadStructure(idx) {
  currentStructureIdx = idx;
  const data = STRUCTURES[idx].generate();
  atoms = data.atoms;
  bonds = data.bonds;
  residueCount = data.residueCount;
  buildMeshes();
}

/* ═══════════════════════════════════════════
   5b. Explode / Collapse animation
   ═══════════════════════════════════════════ */
const EXPLODE_FACTOR = 3.0;

function toggleExplode() {
  exploded = !exploded;
  const duration = 800;
  const startTime = performance.now();
  const targets = atomMeshes.map((mesh) => {
    const home = mesh.userData.homePos;
    if (exploded) {
      const dir = home.clone().normalize();
      return home.clone().add(dir.multiplyScalar(home.length() * EXPLODE_FACTOR));
    }
    return home.clone();
  });
  const starts = atomMeshes.map((m) => m.position.clone());

  document.getElementById("explode-btn").textContent = exploded ? "🧲 Collapse" : "💥 Explode";
  showToast(exploded ? "Exploded" : "Collapsed");

  // Hide bonds during explode
  if (exploded) bondMeshes.forEach((m) => (m.visible = false));

  function step(now) {
    const t = Math.min((now - startTime) / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    atomMeshes.forEach((mesh, i) => {
      mesh.position.lerpVectors(starts[i], targets[i], ease);
    });
    if (t < 1) {
      requestAnimationFrame(step);
    } else if (!exploded) {
      // Restore bond visibility
      const showBonds = document.getElementById("bond-toggle").checked;
      bondMeshes.forEach((m) => (m.visible = showBonds && renderMode !== "space-fill"));
    }
  }
  requestAnimationFrame(step);
}

/* ═══════════════════════════════════════════
   5c. Atom entrance animation (fly-in)
   ═══════════════════════════════════════════ */
function animateEntrance() {
  showToast("Animating…");
  const duration = 1200;
  const startTime = performance.now();

  // Scatter atoms to random far positions
  const starts = atomMeshes.map(() => {
    return new THREE.Vector3(
      (Math.random() - 0.5) * 80,
      (Math.random() - 0.5) * 80,
      (Math.random() - 0.5) * 80
    );
  });
  const targets = atomMeshes.map((m) => m.userData.homePos.clone());

  // Start atoms at scattered positions, scale 0
  atomMeshes.forEach((mesh, i) => {
    mesh.position.copy(starts[i]);
    mesh.scale.setScalar(0.01);
  });
  bondMeshes.forEach((m) => (m.visible = false));

  function step(now) {
    const t = Math.min((now - startTime) / duration, 1);
    // Stagger: each atom starts at a slightly different time
    atomMeshes.forEach((mesh, i) => {
      const stagger = (i / atomMeshes.length) * 0.4;
      const localT = Math.max(0, Math.min((t - stagger) / (1 - 0.4), 1));
      const ease = 1 - Math.pow(1 - localT, 4); // easeOutQuart
      mesh.position.lerpVectors(starts[i], targets[i], ease);
      mesh.scale.setScalar(mesh.userData.baseScale * ease);
    });
    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      // Restore bonds
      const showBonds = document.getElementById("bond-toggle").checked;
      bondMeshes.forEach((m) => (m.visible = showBonds && renderMode !== "space-fill"));
      showToast("Assembled!");
    }
  }
  requestAnimationFrame(step);
}

// Initial build
buildMeshes();

// Hide loading overlay
setTimeout(() => document.getElementById("loading").classList.add("hidden"), 300);

/* ═══════════════════════════════════════════
   6. Raycaster for hover tooltip
   ═══════════════════════════════════════════ */
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const tooltip = document.getElementById("tooltip");

renderer.domElement.addEventListener("pointermove", (e) => {
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(atomMeshes);
  if (hits.length) {
    const hitMesh = hits[0].object;
    const data = hitMesh.userData;
    const el = ELEMENTS[data.element];
    tooltip.textContent = `${el.name} (${data.element}) — ${data.residue}`;
    tooltip.style.display = "block";
    tooltip.style.left = e.clientX + 14 + "px";
    tooltip.style.top = e.clientY - 10 + "px";
    renderer.domElement.style.cursor = "pointer";

    // Hover highlight: scale up hovered atom
    if (hoveredMesh && hoveredMesh !== hitMesh) {
      hoveredMesh.scale.setScalar(hoveredMesh.userData.baseScale);
    }
    hitMesh.scale.setScalar(hitMesh.userData.baseScale * 1.35);
    hoveredMesh = hitMesh;
  } else {
    tooltip.style.display = "none";
    renderer.domElement.style.cursor = "grab";
    if (hoveredMesh) {
      hoveredMesh.scale.setScalar(hoveredMesh.userData.baseScale);
      hoveredMesh = null;
    }
  }
});

/* ═══════════════════════════════════════════
   6b. Click-to-select + distance measurement
   ═══════════════════════════════════════════ */
renderer.domElement.addEventListener("click", (e) => {
  // Don't select if user was dragging
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(atomMeshes);
  if (!hits.length) return;

  const mesh = hits[0].object;
  const data = mesh.userData;

  // Already selected? Deselect.
  const existIdx = selectedAtoms.findIndex((s) => s.mesh === mesh);
  if (existIdx >= 0) {
    mesh.material.color.setHex(selectedAtoms[existIdx].originalColor);
    mesh.material.emissive.setHex(0x000000);
    selectedAtoms.splice(existIdx, 1);
    updateSelectionPanel();
    return;
  }

  // Max 2 selected
  if (selectedAtoms.length >= 2) {
    const old = selectedAtoms.shift();
    old.mesh.material.color.setHex(old.originalColor);
    old.mesh.material.emissive.setHex(0x000000);
  }

  const originalColor = getAtomColor(atoms[data.index], data.index);
  mesh.material.color.setHex(highlightColor);
  mesh.material.emissive.setHex(0x331122);
  selectedAtoms.push({ mesh, data, originalColor });
  updateSelectionPanel();
});

function updateSelectionPanel() {
  if (selectedAtoms.length === 0) {
    selectionPanel.style.display = "none";
    if (distanceLine) { scene.remove(distanceLine); distanceLine.geometry.dispose(); distanceLine = null; }
    return;
  }
  selectionPanel.style.display = "block";

  const a = selectedAtoms[0];
  document.getElementById("sel-atom-a").innerHTML =
    `<span class="label">A:</span><span>${ELEMENTS[a.data.element].name} — ${a.data.residue}</span>`;

  if (selectedAtoms.length === 2) {
    const b = selectedAtoms[1];
    document.getElementById("sel-atom-b").innerHTML =
      `<span class="label">B:</span><span>${ELEMENTS[b.data.element].name} — ${b.data.residue}</span>`;

    const dist = a.mesh.position.distanceTo(b.mesh.position);
    document.getElementById("sel-distance").innerHTML =
      `<span class="label">Distance:</span><span>${dist.toFixed(2)} Å</span>`;

    // Draw distance line
    if (distanceLine) { scene.remove(distanceLine); distanceLine.geometry.dispose(); }
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      a.mesh.getWorldPosition(new THREE.Vector3()),
      b.mesh.getWorldPosition(new THREE.Vector3()),
    ]);
    const lineMat = new THREE.LineBasicMaterial({ color: highlightColor, linewidth: 2, transparent: true, opacity: 0.8 });
    distanceLine = new THREE.Line(lineGeo, lineMat);
    scene.add(distanceLine);
  } else {
    document.getElementById("sel-atom-b").innerHTML = "";
    document.getElementById("sel-distance").innerHTML = "";
    if (distanceLine) { scene.remove(distanceLine); distanceLine.geometry.dispose(); distanceLine = null; }
  }
}

document.getElementById("clear-selection").addEventListener("click", clearSelection);

/* ═══════════════════════════════════════════
   7. UI Controls
   ═══════════════════════════════════════════ */

// ── Structure selector ──
const structureSelect = document.getElementById("structure-select");
STRUCTURES.forEach((s, i) => {
  const opt = document.createElement("option");
  opt.value = i;
  opt.textContent = s.name;
  structureSelect.appendChild(opt);
});
structureSelect.addEventListener("change", () => {
  loadStructure(parseInt(structureSelect.value, 10));
});

// ── Render mode ──
const renderModeSelect = document.getElementById("render-mode");
renderModeSelect.addEventListener("change", () => {
  renderMode = renderModeSelect.value;
  buildMeshes();
  showToast(`Render: ${renderModeSelect.options[renderModeSelect.selectedIndex].text}`);
});

// ── Atom size slider ──
const atomSizeInput = document.getElementById("atom-size");
atomSizeInput.addEventListener("input", () => {
  atomSizeScale = parseFloat(atomSizeInput.value);
  atomMeshes.forEach((mesh, i) => {
    const r = getAtomRadius(atoms[i]);
    mesh.scale.setScalar(r * atomSizeScale);
    mesh.userData.baseScale = r * atomSizeScale;
  });
});

// ── Bond toggle ──
const bondToggle = document.getElementById("bond-toggle");
bondToggle.addEventListener("change", () => {
  bondMeshes.forEach((m) => (m.visible = bondToggle.checked));
});

// ── Backbone ribbon toggle ──
const ribbonToggle = document.getElementById("ribbon-toggle");
ribbonToggle.addEventListener("change", () => {
  showRibbon = ribbonToggle.checked;
  ribbonMeshes.forEach((m) => (m.visible = showRibbon));
});

// ── Auto-spin toggle ──
let autoSpin = false;
const spinToggle = document.getElementById("spin-toggle");
const spinSpeedInput = document.getElementById("spin-speed");
spinToggle.addEventListener("change", () => {
  autoSpin = spinToggle.checked;
  controls.autoRotate = autoSpin;
  controls.autoRotateSpeed = parseFloat(spinSpeedInput.value);
});
spinSpeedInput.addEventListener("input", () => {
  controls.autoRotateSpeed = parseFloat(spinSpeedInput.value);
});

// ── Bloom / Glow toggle ──
const bloomToggle = document.getElementById("bloom-toggle");
bloomToggle.addEventListener("change", () => {
  bloomEnabled = bloomToggle.checked;
});

// ── Ground grid toggle ──
const gridToggle = document.getElementById("grid-toggle");
gridToggle.addEventListener("change", () => {
  gridHelper.visible = gridToggle.checked;
});

// ── Color scheme ──
const colorSelect = document.getElementById("color-scheme");
colorSelect.addEventListener("change", () => {
  currentScheme = colorSelect.value;
  atomMeshes.forEach((mesh, i) => {
    const c = getAtomColor(atoms[i], i);
    mesh.material.color.setHex(c);
    mesh.material.emissive.set(new THREE.Color(c).multiplyScalar(0.06));
  });
});

// ── Reset view ──
function resetView() {
  const box = new THREE.Box3().setFromObject(proteinGroup);
  const size = box.getSize(new THREE.Vector3()).length();
  animateCamera(new THREE.Vector3(size * 0.8, size * 0.6, size * 1.0));
  controls.target.set(0, 0, 0);
  showToast("View reset");
}
document.getElementById("reset-view").addEventListener("click", resetView);

// ── Screenshot ──
function takeScreenshot() {
  // Render one frame for the screenshot
  if (bloomEnabled) {
    composer.render();
  } else {
    renderer.render(scene, camera);
  }
  const link = document.createElement("a");
  link.download = `protein-${STRUCTURES[currentStructureIdx].id}-${Date.now()}.png`;
  link.href = renderer.domElement.toDataURL("image/png");
  link.click();
  showToast("Screenshot saved!");
}
document.getElementById("screenshot-btn").addEventListener("click", takeScreenshot);

// ── Explode ──
document.getElementById("explode-btn").addEventListener("click", toggleExplode);

// ── Animate entrance ──
document.getElementById("animate-btn").addEventListener("click", animateEntrance);

/* ═══════════════════════════════════════════
   7b. Keyboard shortcuts
   ═══════════════════════════════════════════ */
window.addEventListener("keydown", (e) => {
  // Ignore if user is typing in an input / select
  if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT" || e.target.tagName === "TEXTAREA") return;

  switch (e.key.toLowerCase()) {
    case "r":
      resetView();
      break;
    case "s":
      spinToggle.checked = !spinToggle.checked;
      spinToggle.dispatchEvent(new Event("change"));
      showToast(spinToggle.checked ? "Auto-spin ON" : "Auto-spin OFF");
      break;
    case "b":
      bondToggle.checked = !bondToggle.checked;
      bondToggle.dispatchEvent(new Event("change"));
      showToast(bondToggle.checked ? "Bonds visible" : "Bonds hidden");
      break;
    case "g":
      bloomToggle.checked = !bloomToggle.checked;
      bloomToggle.dispatchEvent(new Event("change"));
      showToast(bloomEnabled ? "Glow ON" : "Glow OFF");
      break;
    case "p":
      takeScreenshot();
      break;
    case "f":
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
        showToast("Fullscreen");
      } else {
        document.exitFullscreen();
      }
      break;
    case "arrowleft":
      {
        const idx = (currentStructureIdx - 1 + STRUCTURES.length) % STRUCTURES.length;
        structureSelect.value = idx;
        loadStructure(idx);
        showToast(STRUCTURES[idx].name);
      }
      break;
    case "arrowright":
      {
        const idx = (currentStructureIdx + 1) % STRUCTURES.length;
        structureSelect.value = idx;
        loadStructure(idx);
        showToast(STRUCTURES[idx].name);
      }
      break;
    case "escape":
      clearSelection();
      showToast("Selection cleared");
      break;
    case "e":
      toggleExplode();
      break;
    case "a":
      animateEntrance();
      break;
    case "1":
      renderModeSelect.value = "ball-stick";
      renderModeSelect.dispatchEvent(new Event("change"));
      break;
    case "2":
      renderModeSelect.value = "space-fill";
      renderModeSelect.dispatchEvent(new Event("change"));
      break;
    case "3":
      renderModeSelect.value = "wireframe";
      renderModeSelect.dispatchEvent(new Event("change"));
      break;
  }
});

/* ═══════════════════════════════════════════
   8. Animation loop + FPS counter
   ═══════════════════════════════════════════ */
const fpsEl = document.getElementById("fps-counter");
let frameCount = 0;
let lastFpsTime = performance.now();

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  updateParticles();

  // FPS
  frameCount++;
  const now = performance.now();
  if (now - lastFpsTime >= 500) {
    const fps = Math.round(frameCount / ((now - lastFpsTime) / 1000));
    fpsEl.textContent = `${fps} fps`;
    frameCount = 0;
    lastFpsTime = now;
  }

  if (bloomEnabled) {
    composer.render();
  } else {
    renderer.render(scene, camera);
  }
}
animate();

/* ═══════════════════════════════════════════
   9. Resize handler
   ═══════════════════════════════════════════ */
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});
