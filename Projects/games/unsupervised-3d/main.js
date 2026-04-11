/**
 * Neon Vault — Unsupervised 3D
 * Three.js rewrite: proper WebGL, real lighting, no glitches.
 */
import * as THREE from 'three';

/* ══════════════════════════════════════════════
   CONFIG
   ══════════════════════════════════════════════ */
const LEVELS = [
  {
    cols: 3,
    rows: 2,
    time: 40,
    label: 'Floor 1 — Alignment Seed',
    codename: 'Mission 01 // Bootstrap the Core',
    objective: 'Recover the first alignment shard before corruption agents map your signal.',
    story: 'You are building a good AGI inside the Neon Vault, restoring aligned cognition before sabotage swarms can poison the training loop.',
    briefing: 'Noise probes are still weak. Learn the room, secure the seed shard, and start the first clean weights pass.',
    lockdown: 0,
    rounds: [
      { label: 'Noise Probe', briefing: 'A sabotage probe tests your first alignment pass.', targetKills: 1, aliveCap: 1, hp: 2, fireDelay: 2.25, respawnMs: 2600, moveScale: 0.85, projectileSpeed: 6.4, damage: 1, shell: 0x180d32, glow: 0x7b61ff, eye: 0xff6ec7 },
      { label: 'Poison Seeder', briefing: 'A poison-seed drone enters to stain the seed weights.', targetKills: 1, aliveCap: 1, hp: 3, fireDelay: 1.95, respawnMs: 2200, moveScale: 0.95, projectileSpeed: 6.9, damage: 1, shell: 0x1d1338, glow: 0x00e5ff, eye: 0xffe66d },
    ],
  },
  {
    cols: 4,
    rows: 2,
    time: 55,
    label: 'Floor 2 — Bias Lattice',
    codename: 'Mission 02 // Debias the Dataset',
    objective: 'Clear the grid while decoy hunters inject bad priors into the center lane.',
    story: 'The vault starts feeding mirrored false examples, trying to bend the model toward brittle and unsafe behavior.',
    briefing: 'Two linked rounds. First comes noisy bias, then an active hunter trained to punish hesitation.',
    lockdown: 0,
    rounds: [
      { label: 'Bias Sweep', briefing: 'Twin decoys seed bad examples across opposite lanes.', targetKills: 2, aliveCap: 2, hp: 2, fireDelay: 2.0, respawnMs: 2200, moveScale: 0.9, projectileSpeed: 6.8, damage: 1, shell: 0x160f2e, glow: 0xff6ec7, eye: 0x00e5ff },
      { label: 'Hunter Drop', briefing: 'A pursuit unit enters with tighter arcs and hotter sabotage packets.', targetKills: 2, aliveCap: 2, hp: 3, fireDelay: 1.7, respawnMs: 1800, moveScale: 1.05, projectileSpeed: 7.2, damage: 1, shell: 0x241245, glow: 0xff8020, eye: 0xff5e5e },
    ],
  },
  {
    cols: 4,
    rows: 3,
    time: 75,
    label: 'Floor 3 — Adversarial Spiral',
    codename: 'Mission 03 // Hold the Gradient',
    objective: 'Break the adversarial spiral and keep the good gradient stable through lockdown.',
    story: 'The sabotage stack now responds to every correct match by generating adversarial variants designed to collapse your training path.',
    briefing: 'Expect crossfire, fake signals, and a forced hold while the gradient stabilizes.',
    lockdown: 6,
    rounds: [
      { label: 'Adversarial Openers', briefing: 'Two sentries try to herd you into poisoned pattern reads.', targetKills: 2, aliveCap: 2, hp: 3, fireDelay: 1.6, respawnMs: 1700, moveScale: 1.05, projectileSpeed: 7.3, damage: 1, shell: 0x1a1038, glow: 0x7b61ff, eye: 0xffe66d },
      { label: 'Gradient Knot', briefing: 'A knotter locks the center while false samples recycle around it.', targetKills: 3, aliveCap: 2, hp: 4, fireDelay: 1.45, respawnMs: 1600, moveScale: 1.12, projectileSpeed: 7.5, damage: 2, shell: 0x211245, glow: 0x00e5ff, eye: 0xff5e5e },
    ],
  },
  {
    cols: 5,
    rows: 3,
    time: 95,
    label: 'Floor 4 — Safety Relay',
    codename: 'Mission 04 // Wire the Guardrails',
    objective: 'Secure the safety relay before relay hunters flood the room with bad constraints.',
    story: 'You are deep enough that each recovered shard can now harden the AGI, but every relay left online gives the sabotage layer another way in.',
    briefing: 'This floor mixes relay hunters, anchors, and layered respawns while you wire the first real guardrails.',
    lockdown: 0,
    rounds: [
      { label: 'Relay Pair', briefing: 'Two relay hunters broadcast hostile reward signals across the floor.', targetKills: 2, aliveCap: 2, hp: 3, fireDelay: 1.5, respawnMs: 1500, moveScale: 1.15, projectileSpeed: 7.6, damage: 1, shell: 0x21104a, glow: 0x61ffca, eye: 0xff6ec7 },
      { label: 'Anchor Break', briefing: 'An anchor drone tries to freeze the guardrail lane while relays recycle.', targetKills: 3, aliveCap: 2, hp: 4, fireDelay: 1.32, respawnMs: 1400, moveScale: 1.2, projectileSpeed: 7.9, damage: 2, shell: 0x2a123c, glow: 0xff8020, eye: 0xffe66d },
      { label: 'Sabotage Push', briefing: 'The sabotage net floods the room with one last coordinated attack.', targetKills: 2, aliveCap: 3, hp: 4, fireDelay: 1.22, respawnMs: 1300, moveScale: 1.25, projectileSpeed: 8.0, damage: 2, shell: 0x18183d, glow: 0x00e5ff, eye: 0xff5e5e },
    ],
  },
  {
    cols: 5,
    rows: 4,
    time: 120,
    label: 'Floor 5 — Alignment Forge',
    codename: 'Mission 05 // Train Under Fire',
    objective: 'Take the forge shard and hold the alignment lattice under full sabotage pressure.',
    story: 'The vault drops all subtlety now. You are training a good AGI in real time while hostile agents try to turn every reward into a failure mode.',
    briefing: 'More bodies, faster loops, and a purge timer waiting behind the last clean match.',
    lockdown: 8,
    rounds: [
      { label: 'Lattice Sweep', briefing: 'Three corruptor drones patrol the tile lanes together.', targetKills: 3, aliveCap: 3, hp: 4, fireDelay: 1.3, respawnMs: 1200, moveScale: 1.28, projectileSpeed: 8.1, damage: 2, shell: 0x201237, glow: 0xff6ec7, eye: 0x00e5ff },
      { label: 'Purge Tether', briefing: 'A purge tether keeps the center flooded with hostile reward pulses.', targetKills: 3, aliveCap: 3, hp: 5, fireDelay: 1.15, respawnMs: 1100, moveScale: 1.34, projectileSpeed: 8.35, damage: 2, shell: 0x2c1230, glow: 0xffe66d, eye: 0xff5e5e },
    ],
  },
  {
    cols: 6,
    rows: 4,
    time: 150,
    label: 'Floor 6 — AGI Core',
    codename: 'Mission 06 // Launch the Guardian',
    objective: 'Assemble the final core shard, defeat the eclipse sentinel, and launch the aligned AGI before corruption wins.',
    story: 'The central archive knows what you are doing now: you are trying to finish a good AGI before the sabotage stack can turn it into something unsafe and hostile.',
    briefing: 'The last floor throws full sentinel coverage, heavier sabotage packets, and the hardest lockdown in the vault.',
    lockdown: 10,
    rounds: [
      { label: 'Core Screen', briefing: 'Three sentries screen the final alignment core.', targetKills: 3, aliveCap: 3, hp: 5, fireDelay: 1.1, respawnMs: 1000, moveScale: 1.35, projectileSpeed: 8.5, damage: 2, shell: 0x22103f, glow: 0x7b61ff, eye: 0xffe66d },
      { label: 'Sentinel Teeth', briefing: 'Heavy hunters replace the scouts and close every safe angle around the model.', targetKills: 3, aliveCap: 3, hp: 6, fireDelay: 0.98, respawnMs: 900, moveScale: 1.42, projectileSpeed: 8.8, damage: 2, shell: 0x2f112f, glow: 0xff6ec7, eye: 0xff5e5e },
      { label: 'Eclipse Crown', briefing: 'The eclipse sentinel warps between lanes, unleashes barrages, and will not yield the core without a true boss fight.', targetKills: 1, aliveCap: 1, hp: 18, fireDelay: 0.82, respawnMs: 850, moveScale: 1.55, projectileSpeed: 9.2, damage: 3, boss: true, shell: 0x141826, glow: 0x00e5ff, eye: 0xffe66d, scale: 1.35 },
    ],
  },
];

const TILE_COLORS = [
  0xff6ec7, 0x7b61ff, 0x00e5ff, 0xffe66d, 0xff5e5e, 0x61ffca,
  0xff9a3c, 0xa78bfa, 0x6ee7b7, 0xf472b6, 0x38bdf8, 0xfacc15,
];

const ROOM = { w: 12, d: 12, h: 4.5 };
const TILE_SIZE = 0.95;
const TILE_GAP  = 1.25;
const MOVE_SPEED = 4.0;
const PLAYER_MAX_HEALTH = 5;
const ENEMY_SLOTS = [
  [-3.1, 1.9, 2.1],
  [0, 2.2, 2.9],
  [3.1, 1.85, 2.15],
  [-1.9, 2.25, 3.9],
  [1.9, 2.1, 4.0],
];

/* ══════════════════════════════════════════════
   STATE
   ══════════════════════════════════════════════ */
let level = 0, score = 0, combo = 0, mistakes = 0;
let timerStart = 0, timerElapsed = 0, timerRunning = false, gameWon = false, gameOver = false;
let tiles = [], revealed = new Set(), matched = new Set(), lock = false;
let confettiTimeout = 0;
let playerHealth = PLAYER_MAX_HEALTH;
let runStarted = false;
let overlayMode = 'start';
let enemies = [];
let enemyRespawns = [];
let enemyIdSeed = 0;
let damageFlashTimeout = 0;
let gunRecoil = 0;
let crosshairHitTimeout = 0;
let targetLocked = false;
let floorDroneKills = 0;
let floorPairsCleared = false;
let lockdownRemaining = 0;
let lockdownActive = false;
let floorTransitionPending = false;
let activeRound = 0;
let roundKills = 0;
let pickups = [];
let pickupNotice = '';
let pickupNoticeUntil = 0;
let bonusDamage = 0;
let bonusSpeed = 0;
let captureRig = null;

const keys = { w: false, a: false, s: false, d: false };
let pointerLocked = false;
const euler = new THREE.Euler(0, 0, 0, 'YXZ');
const velocity = new THREE.Vector3();

/* ══════════════════════════════════════════════
   DOM REFS
   ══════════════════════════════════════════════ */
const $ = (s) => document.getElementById(s);
const hudLevel = $('hudLevel'), hudPairs = $('hudPairs'), hudScore = $('hudScore');
const hudHealth = $('hudHealth'), hudEnemy = $('hudEnemy');
const hudCombo = $('hudCombo'), hudTimer = $('hudTimer'), hudStars = $('hudStars');
const hudProgress = $('hudProgress'), mission = $('mission');
const pickupRadarMap = $('pickupRadarMap'), pickupRadarNote = $('pickupRadarNote');
const startOverlay = $('startOverlay'), startBtn = $('startBtn');
const startTitle = $('startTitle'), startCopy = $('startCopy'), startHint = $('startHint');
const damageFlash = $('damageFlash');
const crosshair = $('crosshair');

/* ══════════════════════════════════════════════
   THREE.JS SETUP
   ══════════════════════════════════════════════ */
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0420);
scene.fog = new THREE.FogExp2(0x0b0420, 0.035);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 1.65, -ROOM.d / 2 + 1.5);
camera.rotation.order = 'YXZ';
scene.add(camera);

/* Raycaster for tile clicks */
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(0, 0);

/* ══════════════════════════════════════════════
   ROOM GEOMETRY
   ══════════════════════════════════════════════ */
function buildRoom() {
  // Floor
  const floorGeo = new THREE.PlaneGeometry(ROOM.w, ROOM.d, 32, 32);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x120830, roughness: 0.6, metalness: 0.3,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Floor grid lines
  const gridHelper = new THREE.GridHelper(ROOM.w, 12, 0x7b61ff, 0x301870);
  gridHelper.position.y = 0.005;
  gridHelper.material.opacity = 0.25;
  gridHelper.material.transparent = true;
  scene.add(gridHelper);

  // Ceiling
  const ceilGeo = new THREE.PlaneGeometry(ROOM.w, ROOM.d);
  const ceilMat = new THREE.MeshStandardMaterial({
    color: 0x0e0828, roughness: 0.8, metalness: 0.1, side: THREE.DoubleSide,
  });
  const ceil = new THREE.Mesh(ceilGeo, ceilMat);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = ROOM.h;
  scene.add(ceil);

  // Walls
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x1a0e50, roughness: 0.7, metalness: 0.2, side: THREE.DoubleSide,
  });
  const wallConfigs = [
    { w: ROOM.w, h: ROOM.h, pos: [0, ROOM.h / 2, -ROOM.d / 2], rot: [0, 0, 0] },           // front
    { w: ROOM.w, h: ROOM.h, pos: [0, ROOM.h / 2, ROOM.d / 2], rot: [0, Math.PI, 0] },       // back
    { w: ROOM.d, h: ROOM.h, pos: [-ROOM.w / 2, ROOM.h / 2, 0], rot: [0, Math.PI / 2, 0] },  // left
    { w: ROOM.d, h: ROOM.h, pos: [ROOM.w / 2, ROOM.h / 2, 0], rot: [0, -Math.PI / 2, 0] },  // right
  ];
  wallConfigs.forEach(cfg => {
    const geo = new THREE.PlaneGeometry(cfg.w, cfg.h);
    const wall = new THREE.Mesh(geo, wallMat.clone());
    wall.position.set(...cfg.pos);
    wall.rotation.set(...cfg.rot);
    wall.receiveShadow = true;
    scene.add(wall);
  });

  // Neon stripes on walls (emissive boxes)
  const stripeColors = [0xff6ec7, 0x7b61ff, 0x00e5ff, 0xffe66d];
  for (let si = 0; si < 5; si++) {
    const y = 0.5 + si * 0.75;
    const color = stripeColors[si % stripeColors.length];
    // Front wall
    addStripe(0, y, -ROOM.d / 2 + 0.01, ROOM.w * 0.85, 0.04, 0, color);
    // Side walls
    addStripe(-ROOM.w / 2 + 0.01, y, 0, 0, 0.04, ROOM.d * 0.7, color);
    addStripe(ROOM.w / 2 - 0.01, y, 0, 0, 0.04, ROOM.d * 0.7, color);
  }
}

function addStripe(x, y, z, w, h, d, color) {
  const geo = new THREE.BoxGeometry(Math.max(w, 0.02), h, Math.max(d, 0.02));
  const mat = new THREE.MeshStandardMaterial({
    color, emissive: color, emissiveIntensity: 0.8,
    roughness: 0.3, metalness: 0.5,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  scene.add(mesh);
}

/* ══════════════════════════════════════════════
   LIGHTING
   ══════════════════════════════════════════════ */
function buildLights() {
  // Ambient
  scene.add(new THREE.AmbientLight(0x2a1860, 0.6));

  // Ceiling spotlight
  const spot = new THREE.SpotLight(0xc084fc, 30, 20, Math.PI / 4, 0.5, 1.5);
  spot.position.set(0, ROOM.h - 0.2, 0);
  spot.target.position.set(0, 0, 0);
  spot.castShadow = true;
  spot.shadow.mapSize.set(512, 512);
  scene.add(spot);
  scene.add(spot.target);

  // Neon point lights
  const neons = [
    { pos: [-4, 2, -4], color: 0xff6ec7, intensity: 15 },
    { pos: [4, 2, -4],  color: 0x3080ff, intensity: 12 },
    { pos: [-4, 2, 4],  color: 0x30ff90, intensity: 10 },
    { pos: [4, 2, 4],   color: 0xffcc30, intensity: 10 },
    { pos: [0, 1, -5],  color: 0xff3080, intensity: 12 },
    { pos: [0, 1, 5],   color: 0x20ccff, intensity: 12 },
    { pos: [-5, 1, 0],  color: 0x40ff60, intensity: 10 },
    { pos: [5, 1, 0],   color: 0xff8020, intensity: 10 },
    { pos: [-1.5, 0.3, 0], color: 0xdd30dd, intensity: 6 },
    { pos: [1.5, 0.3, 0],  color: 0x20dddd, intensity: 6 },
  ];
  neons.forEach(n => {
    const light = new THREE.PointLight(n.color, n.intensity, 14, 1.5);
    light.position.set(...n.pos);
    scene.add(light);

    // Visible orb
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 12, 8),
      new THREE.MeshStandardMaterial({ color: n.color, emissive: n.color, emissiveIntensity: 2 }),
    );
    orb.position.copy(light.position);
    scene.add(orb);
  });
}

/* ══════════════════════════════════════════════
   TILE BOARD
   ══════════════════════════════════════════════ */
const tileGroup = new THREE.Group();
scene.add(tileGroup);

const enemyGroup = new THREE.Group();
scene.add(enemyGroup);

const enemyProjectiles = new THREE.Group();
scene.add(enemyProjectiles);

const beamGroup = new THREE.Group();
scene.add(beamGroup);

const pickupGroup = new THREE.Group();
scene.add(pickupGroup);

const FACE_DOWN_COLOR = 0x1a1040;
const captureMode = new URLSearchParams(location.search).has('capture');

function getLevelConfig() {
  return LEVELS[level] || LEVELS[LEVELS.length - 1];
}

function getFloorKillRequirement(lv = getLevelConfig()) {
  return lv.rounds.reduce((sum, round) => sum + round.targetKills, 0);
}

function getRoundConfig(lv = getLevelConfig()) {
  return lv.rounds[Math.min(activeRound, lv.rounds.length - 1)];
}

function getOverallRoundIndex() {
  return LEVELS.slice(0, level).reduce((sum, floor) => sum + floor.rounds.length, 0) + activeRound;
}

function getPlayerStats() {
  const roundIndex = getOverallRoundIndex();
  const stateTitles = [
    'Seed',
    'Tune',
    'Guide',
    'Shield',
    'Debias',
    'Harden',
    'Refine',
    'Stabilize',
    'Scale',
    'Fortify',
    'Audit',
    'Safeguard',
    'Align',
    'Guardian',
  ];
  const power = 1 + roundIndex * 0.3 + bonusDamage;
  return {
    speed: MOVE_SPEED + roundIndex * 0.2 + bonusSpeed,
    shotDamage: Number(power.toFixed(1)),
    mitigation: Math.min(0.45, roundIndex * 0.045),
    title: stateTitles[Math.min(stateTitles.length - 1, roundIndex)],
    boostText: [bonusDamage > 0 ? 'Lens+' + bonusDamage.toFixed(1) : '', bonusSpeed > 0 ? 'Sprint+' + bonusSpeed.toFixed(1) : ''].filter(Boolean).join(' '),
  };
}

function getEnemyDamage(profile) {
  return profile.damage || (1 + Math.floor(getOverallRoundIndex() / 3));
}

function getAliveEnemyCount() {
  return enemies.filter((unit) => unit.alive).length;
}

function clearPickups() {
  while (pickupGroup.children.length) {
    const pickup = pickupGroup.children.pop();
    pickup.traverse((node) => {
      if (node.geometry) node.geometry.dispose();
      if (node.material) {
        if (Array.isArray(node.material)) node.material.forEach((mat) => mat.dispose());
        else node.material.dispose();
      }
    });
  }
  pickups = [];
}

function setPickupNotice(text) {
  pickupNotice = text;
  pickupNoticeUntil = performance.now() + 2800;
}

function roomToRadarPosition(x, z) {
  const width = pickupRadarMap.clientWidth || 104;
  const height = pickupRadarMap.clientHeight || 104;
  return {
    left: ((x + ROOM.w / 2) / ROOM.w) * width,
    top: ((z + ROOM.d / 2) / ROOM.d) * height,
  };
}

function renderRadarMarkers() {
  if (!pickupRadarMap || !pickupRadarNote) return;
  pickupRadarMap.querySelectorAll('.pickup-radar-marker').forEach((node) => node.remove());

  let note = 'No AGI tools active';
  pickups.forEach((pickup) => {
    const marker = document.createElement('div');
    marker.className = 'pickup-radar-marker ' + pickup.type;
    const pos = roomToRadarPosition(pickup.root.position.x, pickup.root.position.z);
    marker.style.left = pos.left + 'px';
    marker.style.top = pos.top + 'px';
    marker.title = pickup.label;
    pickupRadarMap.append(marker);
  });

  const bossUnit = enemies.find((unit) => unit.alive && unit.profile.boss);
  if (bossUnit) {
    const marker = document.createElement('div');
    marker.className = 'pickup-radar-marker boss';
    const pos = roomToRadarPosition(bossUnit.root.position.x, bossUnit.root.position.z);
    marker.style.left = pos.left + 'px';
    marker.style.top = pos.top + 'px';
    marker.title = 'Eclipse Crown';
    pickupRadarMap.append(marker);
    note = 'Boss live: Eclipse Crown distorting the core lanes';
  } else if (pickups.length === 1) {
    note = pickups[0].label + ' detected';
  } else if (pickups.length > 1) {
    note = pickups.length + ' AGI tools detected';
  }

  if (pickupNotice && performance.now() < pickupNoticeUntil) note = pickupNotice;
  pickupRadarNote.textContent = note;
}

function choosePickupType() {
  if (playerHealth <= Math.max(2, PLAYER_MAX_HEALTH - 2)) return 'patch';
  return Math.random() > 0.5 ? 'lens' : 'overclock';
}

function spawnPickup(position, forcedType) {
  if (pickups.length >= 2) return;
  const type = forcedType || choosePickupType();
  const defs = {
    patch: { label: 'Guardrail Patch', color: 0x61ffca, ring: 0xb8ffe8 },
    lens: { label: 'Interpretability Lens', color: 0xffe66d, ring: 0xffb86b },
    overclock: { label: 'Optimizer Burst', color: 0x00e5ff, ring: 0x7b61ff },
  };
  const def = defs[type];
  const root = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.18, 0),
    new THREE.MeshStandardMaterial({ color: def.color, emissive: def.color, emissiveIntensity: 1.2, metalness: 0.35, roughness: 0.18 }),
  );
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.28, 0.03, 8, 24),
    new THREE.MeshStandardMaterial({ color: def.ring, emissive: def.ring, emissiveIntensity: 0.9, metalness: 0.4, roughness: 0.14 }),
  );
  ring.rotation.x = Math.PI / 2;
  root.add(core);
  root.add(ring);
  root.position.copy(position);
  root.position.y = 0.45;
  root.userData.baseY = root.position.y;
  pickupGroup.add(root);
  pickups.push({ type, label: def.label, root, ring, bornAt: performance.now() * 0.001 });
}

function collectPickup(pickup) {
  if (pickup.type === 'patch') {
    playerHealth = Math.min(PLAYER_MAX_HEALTH, playerHealth + 1);
    clearEnemyProjectiles();
    setPickupNotice('Guardrail Patch collected: integrity restored and incoming sabotage cleared.');
  } else if (pickup.type === 'lens') {
    bonusDamage = Math.min(2, bonusDamage + 0.4);
    setPickupNotice('Interpretability Lens collected: AGI output power increased.');
  } else if (pickup.type === 'overclock') {
    bonusSpeed = Math.min(1.5, bonusSpeed + 0.35);
    setPickupNotice('Optimizer Burst collected: movement and routing speed increased.');
  }

  spawnParticles(pickup.root.position, 0x61ffca, 14);
  pickup.root.traverse((node) => {
    if (node.geometry) node.geometry.dispose();
    if (node.material) node.material.dispose();
  });
  pickupGroup.remove(pickup.root);
  pickups = pickups.filter((entry) => entry !== pickup);
  updateHUD();
}

function updatePickups(dt) {
  for (let i = pickups.length - 1; i >= 0; i--) {
    const pickup = pickups[i];
    const t = performance.now() * 0.001 - pickup.bornAt;
    pickup.root.position.y = pickup.root.userData.baseY + Math.sin(t * 2.4) * 0.12;
    pickup.root.rotation.y += dt * 1.8;
    pickup.ring.rotation.z += dt * 2.6;
    if (pickup.root.position.distanceTo(camera.position) < 0.8 && pointerLocked && runStarted && !gameOver && !gameWon) {
      collectPickup(pickup);
    }
  }
}

function getEnemyFromObject(object) {
  let current = object;
  while (current && current !== scene) {
    if (typeof current.userData.enemyId === 'number') {
      return enemies.find((unit) => unit.id === current.userData.enemyId) || null;
    }
    current = current.parent;
  }
  return null;
}

function buildBoard() {
  // Clear previous tiles
  while (tileGroup.children.length) tileGroup.remove(tileGroup.children[0]);
  tiles = []; revealed = new Set(); matched = new Set(); lock = false;
  combo = 0; mistakes = 0;
  floorDroneKills = 0;
  floorPairsCleared = false;
  lockdownRemaining = 0;
  lockdownActive = false;
  floorTransitionPending = false;
  activeRound = 0;
  roundKills = 0;
  timerElapsed = 0;
  timerRunning = false;
  timerStart = 0;
  pickupNotice = '';
  pickupNoticeUntil = 0;
  clearEnemies();
  clearBeams();
  clearPickups();
  spawnRoundWave();

  const lv = getLevelConfig();
  const pairCount = lv.cols * lv.rows;
  const pool = [];
  for (let i = 0; i < pairCount; i++) {
    pool.push({ id: i, color: TILE_COLORS[i % TILE_COLORS.length] });
    pool.push({ id: i, color: TILE_COLORS[i % TILE_COLORS.length] });
  }
  // Shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const startX = -((lv.cols - 1) * TILE_GAP) / 2;
  const startZ = -((lv.rows - 1) * TILE_GAP) / 2;
  let idx = 0;
  for (let r = 0; r < lv.rows; r++) {
    for (let c = 0; c < lv.cols; c++) {
      const p = pool[idx++];
      const x = startX + c * TILE_GAP;
      const z = startZ + r * TILE_GAP;
      const tile = makeTile(p.id, p.color, x, z);
      tileGroup.add(tile);
      tiles.push(tile);
    }
  }

  // Reset camera — slight downward tilt so the board and hostiles read immediately on spawn
  camera.position.set(0, 1.65, -ROOM.d / 2 + 1.5);
  euler.set(0.16, 0, 0);
  camera.rotation.copy(euler);

  updateHUD();
}

function setPhotoModeCamera() {
  camera.position.set(0, 2.55, -3.2);
  euler.set(0.82, 0, 0);
  camera.rotation.copy(euler);
}

function stageCaptureScene() {
  scene.background = new THREE.Color(0x070316);
  scene.fog = new THREE.FogExp2(0x070316, 0.028);
  setPhotoModeCamera();
  const showcaseTiles = [
    [-1.45, 0.12, -0.15],
    [-0.25, 0.12, 0.15],
    [0.95, 0.12, 0.45],
    [2.15, 0.12, 0.75],
  ];
  [0, 1, 2, 3].forEach((index, order) => {
    if (!tiles[index]) return;
    revealTile(tiles[index]);
    tiles[index].position.set(...showcaseTiles[order]);
    tiles[index].rotation.x = -0.18;
    tiles[index].scale.setScalar(1.28 - order * 0.08);
    tiles[index].material[2].emissiveIntensity = 2.3;
    tiles[index].material[0].emissiveIntensity = 0.65;
    tiles[index].material[1].emissiveIntensity = 0.65;
    tiles[index].material[3].emissiveIntensity = 0.65;
    tiles[index].material[4].emissiveIntensity = 0.65;
    tiles[index].material[5].emissiveIntensity = 0.65;
  });
  if (!pickups.length) {
    spawnPickup(new THREE.Vector3(0.35, 0.45, 0.15), 'lens');
  }
  const leadEnemy = enemies.find((unit) => unit.alive);
  if (leadEnemy) {
    leadEnemy.root.position.set(1.45, 1.55, 1.35);
    leadEnemy.root.userData.baseX = 1.45;
    leadEnemy.root.userData.baseY = 1.55;
    leadEnemy.root.userData.baseZ = 1.35;
    leadEnemy.eye.material.emissiveIntensity = 2.8;
    leadEnemy.ring.material.emissiveIntensity = 1.8;
  }
  addBeam(new THREE.Vector3(-0.3, 0.25, -0.1), new THREE.Vector3(1.35, 1.45, 1.2), 0x61ffca, 0.2, 0.9);
  if (!captureRig) {
    captureRig = new THREE.Group();
    const key = new THREE.PointLight(0xff6ec7, 14, 12, 2);
    key.position.set(-1.8, 2.8, -0.8);
    const fill = new THREE.PointLight(0x00e5ff, 10, 12, 2);
    fill.position.set(1.8, 2.1, 0.4);
    const rim = new THREE.PointLight(0xffe66d, 7, 10, 2);
    rim.position.set(0.4, 3.2, 2.2);
    captureRig.add(key, fill, rim);
    scene.add(captureRig);
  }
}

function clearEnemyProjectiles() {
  while (enemyProjectiles.children.length) {
    const shot = enemyProjectiles.children.pop();
    shot.geometry.dispose();
    shot.material.dispose();
  }
}

function clearEnemies() {
  enemyGroup.clear();
  enemies = [];
  enemyRespawns = [];
  clearEnemyProjectiles();
}

function clearBeams() {
  while (beamGroup.children.length) {
    const beam = beamGroup.children.pop();
    beam.geometry.dispose();
    beam.material.dispose();
  }
}

function makeTile(id, revealColor, x, z) {
  const geo = new THREE.BoxGeometry(TILE_SIZE, 0.08, TILE_SIZE);
  const topMat = new THREE.MeshStandardMaterial({
    color: FACE_DOWN_COLOR, roughness: 0.5, metalness: 0.3,
    emissive: 0x2a1460, emissiveIntensity: 0.3,
  });
  const sideMat = new THREE.MeshStandardMaterial({
    color: 0x301860, roughness: 0.6, metalness: 0.2,
    emissive: 0x7b61ff, emissiveIntensity: 0.2,
  });
  const mesh = new THREE.Mesh(geo, [sideMat, sideMat, topMat, sideMat, sideMat, sideMat]);
  mesh.position.set(x, 0.04, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = { id, revealColor, revealed: false, matched: false, tween: 0 };

  // "?" label (sprite)
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx =
    canvas.getContext('2d', { alpha: false, desynchronized: true }) ||
    canvas.getContext('2d');
  ctx.fillStyle = 'rgba(123,97,255,0.5)';
  ctx.font = 'bold 48px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', 32, 32);
  const tex = new THREE.CanvasTexture(canvas);
  const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(0.5, 0.5, 1);
  sprite.position.y = 0.12;
  sprite.userData.isLabel = true;
  mesh.add(sprite);

  return mesh;
}

function revealTile(tile) {
  const d = tile.userData;
  if (d.revealed || d.matched) return;
  d.revealed = true;
  // Color the top face
  tile.material[2].color.setHex(d.revealColor);
  tile.material[2].emissive.setHex(d.revealColor);
  tile.material[2].emissiveIntensity = 0.6;
  // Hide "?"
  tile.children.forEach(c => { if (c.userData.isLabel) c.visible = false; });
  // Pop animation
  d.tween = 1.0;
}

function hideTile(tile) {
  const d = tile.userData;
  d.revealed = false;
  tile.material[2].color.setHex(FACE_DOWN_COLOR);
  tile.material[2].emissive.setHex(0x2a1460);
  tile.material[2].emissiveIntensity = 0.3;
  tile.children.forEach(c => { if (c.userData.isLabel) c.visible = true; });
}

function markMatched(tile) {
  const d = tile.userData;
  d.matched = true;
  tile.material[2].emissiveIntensity = 1.0;
  // Glow outline via edge wireframe
  const wireGeo = new THREE.EdgesGeometry(tile.geometry);
  const wireMat = new THREE.LineBasicMaterial({ color: d.revealColor, linewidth: 1 });
  const wire = new THREE.LineSegments(wireGeo, wireMat);
  tile.add(wire);
}

/* ══════════════════════════════════════════════
   PARTICLES
   ══════════════════════════════════════════════ */
const particleGroup = new THREE.Group();
scene.add(particleGroup);

function spawnParticles(pos, color, count) {
  for (let i = 0; i < count; i++) {
    const geo = new THREE.SphereGeometry(0.04, 4, 4);
    const mat = new THREE.MeshBasicMaterial({ color });
    const p = new THREE.Mesh(geo, mat);
    p.position.copy(pos);
    p.position.y += 0.2;
    p.userData.vel = new THREE.Vector3(
      (Math.random() - 0.5) * 3,
      1.5 + Math.random() * 3,
      (Math.random() - 0.5) * 3,
    );
    p.userData.life = 1.0;
    particleGroup.add(p);
  }
}

function updateParticles(dt) {
  for (let i = particleGroup.children.length - 1; i >= 0; i--) {
    const p = particleGroup.children[i];
    p.position.addScaledVector(p.userData.vel, dt);
    p.userData.vel.y -= 6 * dt;
    p.userData.life -= dt * 1.5;
    p.material.opacity = Math.max(0, p.userData.life);
    p.material.transparent = true;
    if (p.userData.life <= 0) {
      p.geometry.dispose(); p.material.dispose();
      particleGroup.remove(p);
    }
  }
}

function showOverlay(mode) {
  overlayMode = mode;
  startOverlay.style.display = 'grid';
  const lv = getLevelConfig();
  const round = getRoundConfig(lv);
  if (mode === 'pause') {
    startTitle.textContent = 'Training Paused';
    startCopy.innerHTML = 'Corruption agents are still active in the room.<br>Re-enter pointer lock to keep moving, matching, and defending the model.';
    startHint.textContent = 'Click resume · WASD to move · Click to shoot';
    startBtn.textContent = 'Resume';
  } else if (mode === 'briefing') {
    startTitle.textContent = lv.codename;
    startCopy.innerHTML = `${lv.story}<br><br><strong>${lv.label}</strong><br>${lv.briefing}<br><br>Opening round: ${round.label} - ${round.briefing}`;
    startHint.textContent = 'Click deploy · Mouse to look · Click to shoot · Clear the grid and protect the aligned build';
    startBtn.textContent = 'Deploy';
  } else if (mode === 'gameover') {
    startTitle.textContent = 'Alignment Failed';
    startCopy.innerHTML = `${lv.codename} failed.<br>The corruption swarm broke your run before the AGI build stabilized.<br>Restart and run a cleaner training route.`;
    startHint.textContent = 'Restart to reset score, health, and floor progress';
    startBtn.textContent = 'Restart';
  } else if (mode === 'win') {
    startTitle.textContent = 'Guardian Launched';
    startCopy.innerHTML = 'You secured every shard, broke the sabotage lattice, and launched a good AGI through the eclipse hold.<br>Run it again for a faster build and a cleaner score.';
    startHint.textContent = 'Restart for another full run';
    startBtn.textContent = 'Restart';
  } else {
    startTitle.textContent = 'Build the Good AGI';
    startCopy.innerHTML = `${lv.story}<br><br><strong>${lv.codename}</strong><br>${lv.objective}<br>Every floor stacks new rounds, faster player upgrades, and tougher sabotage pressure.`;
    startHint.textContent = 'Click to start · WASD to move · Mouse to look · Click to shoot';
    startBtn.textContent = 'Start';
  }
}

function hideOverlay() {
  startOverlay.style.display = 'none';
}

function resumeTimer() {
  if (!timerRunning) {
    timerStart = performance.now();
    timerRunning = true;
  }
}

function pauseTimer() {
  if (timerRunning) {
    timerElapsed += (performance.now() - timerStart) / 1000;
    timerRunning = false;
  }
}

function getTimerValue() {
  return timerElapsed + (timerRunning ? (performance.now() - timerStart) / 1000 : 0);
}

function flashDamage() {
  damageFlash.classList.add('active');
  clearTimeout(damageFlashTimeout);
  damageFlashTimeout = setTimeout(() => damageFlash.classList.remove('active'), 120);
}

function flashCrosshairHit() {
  crosshair.classList.add('hit');
  clearTimeout(crosshairHitTimeout);
  crosshairHitTimeout = setTimeout(() => crosshair.classList.remove('hit'), 90);
}

function addBeam(start, end, color, life = 0.08, opacity = 1) {
  const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
  const line = new THREE.Line(geometry, material);
  line.userData.life = life;
  beamGroup.add(line);
}

function resetRun() {
  level = 0;
  score = 0;
  combo = 0;
  mistakes = 0;
  gameWon = false;
  gameOver = false;
  playerHealth = PLAYER_MAX_HEALTH;
  bonusDamage = 0;
  bonusSpeed = 0;
  runStarted = false;
  buildBoard();
  showOverlay('start');
}

function completeFloor() {
  if (floorTransitionPending) return;
  floorTransitionPending = true;
  pauseTimer();
  playerHealth = Math.min(PLAYER_MAX_HEALTH, playerHealth + 1);
  score += 75 + floorDroneKills * 25;
  spawnParticles(camera.position, 0x61ffca, 18);

  if (level < LEVELS.length - 1) {
    setTimeout(() => {
      level++;
      buildBoard();
      document.exitPointerLock?.();
      showOverlay('briefing');
    }, 2000);
    return;
  }

  gameWon = true;
  document.exitPointerLock?.();
  showOverlay('win');
}

function tryResolveFloor() {
  const lv = getLevelConfig();
  if (!floorPairsCleared || floorTransitionPending) return;
  if (floorDroneKills < getFloorKillRequirement(lv)) return;
  if (activeRound < lv.rounds.length - 1) return;
  if (roundKills < getRoundConfig(lv).targetKills) return;
  if (getAliveEnemyCount() > 0 || enemyRespawns.length > 0) return;

  if (lv.lockdown > 0) {
    if (!lockdownActive && lockdownRemaining <= 0) {
      lockdownActive = true;
      lockdownRemaining = lv.lockdown;
      spawnParticles(camera.position, 0xffe66d, 12);
      return;
    }
    if (lockdownRemaining > 0) return;
  }

  completeFloor();
}

function createGun() {
  const gun = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.16, 0.55),
    new THREE.MeshStandardMaterial({ color: 0x241245, emissive: 0x7b61ff, emissiveIntensity: 0.45, metalness: 0.6, roughness: 0.25 }),
  );
  body.position.set(0, -0.02, -0.2);
  gun.add(body);

  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.05, 0.42, 10),
    new THREE.MeshStandardMaterial({ color: 0x9fdcff, emissive: 0x00e5ff, emissiveIntensity: 0.7, metalness: 0.4, roughness: 0.2 }),
  );
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0.05, 0.02, -0.48);
  gun.add(barrel);

  const grip = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.18, 0.12),
    new THREE.MeshStandardMaterial({ color: 0x10131d, emissive: 0xff6ec7, emissiveIntensity: 0.2, metalness: 0.3, roughness: 0.45 }),
  );
  grip.position.set(-0.03, -0.14, -0.04);
  gun.add(grip);

  const muzzle = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xffe66d, transparent: true, opacity: 0 }),
  );
  muzzle.position.set(0.05, 0.02, -0.68);
  muzzle.userData.life = 0;
  gun.add(muzzle);

  gun.position.set(0.42, -0.32, -0.72);
  camera.add(gun);
  return { root: gun, muzzle };
}

const gun = createGun();

function spawnEnemy(profile, slotIndex) {
  const root = new THREE.Group();
  const scale = profile.scale || 1;
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(0.34 * scale, 20, 20),
    new THREE.MeshStandardMaterial({ color: profile.shell, emissive: profile.glow, emissiveIntensity: 0.85, metalness: 0.55, roughness: 0.18 }),
  );
  shell.castShadow = true;
  root.add(shell);

  const eye = new THREE.Mesh(
    new THREE.SphereGeometry(0.11 * scale, 12, 12),
    new THREE.MeshStandardMaterial({ color: profile.eye, emissive: profile.eye, emissiveIntensity: 1.4, metalness: 0.25, roughness: 0.18 }),
  );
  eye.position.set(0, 0, 0.28 * scale);
  root.add(eye);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.48 * scale, 0.03 * scale, 10, 32),
    new THREE.MeshStandardMaterial({ color: profile.glow, emissive: profile.glow, emissiveIntensity: 0.9, metalness: 0.65, roughness: 0.14 }),
  );
  ring.rotation.x = Math.PI / 2;
  root.add(ring);

  const gunPodGeo = new THREE.CylinderGeometry(0.04 * scale, 0.06 * scale, 0.32 * scale, 10);
  const gunPodMat = new THREE.MeshStandardMaterial({ color: 0x12131d, emissive: profile.eye, emissiveIntensity: 0.35, metalness: 0.35, roughness: 0.35 });
  [-1, 1].forEach((dir) => {
    const pod = new THREE.Mesh(gunPodGeo, gunPodMat);
    pod.rotation.z = Math.PI / 2;
    pod.position.set(dir * 0.42 * scale, -0.04 * scale, 0.06 * scale);
    root.add(pod);
  });

  const slot = ENEMY_SLOTS[slotIndex % ENEMY_SLOTS.length];
  root.position.set(slot[0], slot[1], slot[2]);
  root.userData.baseX = slot[0];
  root.userData.baseY = slot[1];
  root.userData.baseZ = slot[2];
  root.userData.spawnTime = performance.now() * 0.001;
  const id = enemyIdSeed++;
  root.traverse((node) => {
    node.userData.enemyId = id;
  });
  enemyGroup.add(root);

  const unit = {
    id,
    root,
    ring,
    eye,
    alive: true,
    charge: 0,
    hp: profile.hp,
    cooldown: profile.fireDelay * (0.55 + Math.random() * 0.35),
    slot: slotIndex,
    profile,
    phase: Math.random() * Math.PI * 2,
    bossWarpAt: performance.now() + 2400 + Math.random() * 900,
    barrageCooldown: profile.boss ? 2.4 : 0,
    phaseTrigger: 0,
  };
  enemies.push(unit);
  return unit;
}

function spawnRoundWave() {
  const round = getRoundConfig();
  const remainingKills = Math.max(0, round.targetKills - roundKills);
  const pressureBonus = getOverallRoundIndex() >= 6 ? 1 : 0;
  const eliteBonus = getOverallRoundIndex() >= 11 ? 1 : 0;
  const spawnCount = Math.min(round.aliveCap + pressureBonus + eliteBonus, remainingKills, ENEMY_SLOTS.length);
  for (let slotIndex = 0; slotIndex < spawnCount; slotIndex++) {
    spawnEnemy(round, slotIndex);
  }
}

function advanceRoundIfNeeded() {
  const lv = getLevelConfig();
  const round = getRoundConfig(lv);
  if (roundKills < round.targetKills) return;
  if (getAliveEnemyCount() > 0 || enemyRespawns.length > 0) return;
  if (activeRound < lv.rounds.length - 1) {
    activeRound += 1;
    roundKills = 0;
    playerHealth = Math.min(PLAYER_MAX_HEALTH, playerHealth + 1);
    spawnParticles(camera.position, 0xffe66d, 14);
    spawnRoundWave();
    updateHUD();
    return;
  }
  tryResolveFloor();
}

function damageEnemy(unit) {
  if (!unit || !unit.alive || gameOver || gameWon) return;
  unit.hp -= getPlayerStats().shotDamage;
  gun.muzzle.material.opacity = 0.95;
  gun.muzzle.userData.life = 0.08;
  flashCrosshairHit();
  spawnParticles(unit.root.position, unit.profile.eye, 14);
  if (unit.hp <= 0) {
    unit.alive = false;
    floorDroneKills += 1;
    roundKills += 1;
    score += 150 + level * 40;
    const round = getRoundConfig();
    spawnParticles(unit.root.position, round.glow, 28);
    enemyGroup.remove(unit.root);
    if (roundKills < round.targetKills) {
      enemyRespawns.push({
        dueAt: performance.now() + round.respawnMs,
        slot: unit.slot,
        roundIndex: activeRound,
      });
    }
    advanceRoundIfNeeded();
  }
}

function damagePlayer(amount) {
  if (gameOver || gameWon) return;
  const stats = getPlayerStats();
  const appliedDamage = Math.max(1, Math.round(amount * (1 - stats.mitigation)));
  playerHealth = Math.max(0, playerHealth - appliedDamage);
  combo = 0;
  flashDamage();
  if (playerHealth <= 0) {
    gameOver = true;
    pauseTimer();
    document.exitPointerLock?.();
    showOverlay('gameover');
  }
}

function enemyShoot(unit) {
  if (!unit || !unit.alive || !pointerLocked || !runStarted || gameOver || gameWon) return;
  const origin = unit.root.position.clone();
  origin.y += 0.02;
  const shotOffsets = unit.profile.boss ? [-0.22, 0, 0.22] : [0];
  shotOffsets.forEach((spread) => {
    const shot = new THREE.Mesh(
      new THREE.SphereGeometry(unit.profile.boss ? 0.11 : 0.09, 10, 10),
      new THREE.MeshBasicMaterial({ color: unit.profile.eye }),
    );
    shot.position.copy(origin);
    const target = camera.position.clone().add(new THREE.Vector3(spread, 0.1 + Math.random() * 0.2, (Math.random() - 0.5) * 0.2));
    addBeam(origin, target, unit.profile.eye, unit.profile.boss ? 0.18 : 0.12, unit.profile.boss ? 0.85 : 0.7);
    shot.userData.vel = target.sub(origin).normalize().multiplyScalar(unit.profile.projectileSpeed + (unit.profile.boss ? 0.6 : 0));
    shot.userData.life = unit.profile.boss ? 4.8 : 4;
    shot.userData.damage = getEnemyDamage(unit.profile);
    enemyProjectiles.add(shot);
  });
}

function firePlayerShot() {
  if (!pointerLocked || gameOver || gameWon || startOverlay.style.display !== 'none') return;
  gunRecoil = 1;
  gun.muzzle.material.opacity = 1;
  gun.muzzle.userData.life = 0.08;

  raycaster.setFromCamera(pointer, camera);
  const enemyHit = raycaster.intersectObject(enemyGroup, true)[0];
  const tileHit = raycaster.intersectObjects(tiles, false)[0];
  const shotEnd = enemyHit && (!tileHit || enemyHit.distance < tileHit.distance)
    ? enemyHit.point.clone()
    : tileHit
      ? tileHit.point.clone()
      : camera.position.clone().add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(12));
  addBeam(camera.position.clone().add(new THREE.Vector3(0.18, -0.12, -0.18).applyEuler(camera.rotation)), shotEnd, 0xffe66d, 0.07, 0.95);

  if (enemyHit && (!tileHit || enemyHit.distance < tileHit.distance)) {
    damageEnemy(getEnemyFromObject(enemyHit.object));
    return;
  }
  if (tileHit) {
    onTileClick(tileHit.object);
    return;
  }
  spawnParticles(camera.position.clone().add(new THREE.Vector3(0, -0.15, 0)), 0xffe66d, 3);
}

/* ══════════════════════════════════════════════
   HUD
   ══════════════════════════════════════════════ */
function getStars() {
  const lv = LEVELS[level] || LEVELS[LEVELS.length - 1];
  let s = 1;
  if (getTimerValue() < lv.time) s++;
  if (mistakes === 0) s++;
  return '★'.repeat(s) + '☆'.repeat(3 - s);
}

function updateHUD() {
  const lv = getLevelConfig();
  const round = getRoundConfig(lv);
  const stats = getPlayerStats();
  const liveTimer = getTimerValue();
  const aliveCount = getAliveEnemyCount();
  hudLevel.textContent = lv.label;
  hudPairs.textContent = 'Pairs: ' + (matched.size / 2) + '/' + (tiles.length / 2);
  hudScore.textContent = 'Score: ' + score + ' · Power ' + stats.shotDamage.toFixed(1);
  hudHealth.textContent = 'Health: ' + playerHealth + ' · Guard ' + Math.round(stats.mitigation * 100) + '%';
  hudEnemy.textContent = 'Hostiles: ' + aliveCount + ' · ' + round.label;
  hudCombo.textContent = combo > 1 ? combo + 'x combo' : 'Round ' + (activeRound + 1) + '/' + lv.rounds.length + ' · ' + stats.title + (stats.boostText ? ' · ' + stats.boostText : '');
  hudTimer.textContent = Math.floor(liveTimer) + 's';
  hudTimer.className = 'hud-timer ' + (liveTimer < lv.time ? 'ok' : 'over');
  hudStars.textContent = getStars();
  hudProgress.style.width = (tiles.length ? (matched.size / tiles.length) * 100 : 0) + '%';

  const remaining = (tiles.length - matched.size) / 2;
  const pairsText = 'Pairs ' + (matched.size / 2) + '/' + (tiles.length / 2);
  const killText = 'Kills ' + floorDroneKills + '/' + getFloorKillRequirement(lv);
  const roundText = 'Round ' + (activeRound + 1) + '/' + lv.rounds.length + ' - ' + round.label;
  const roundKillText = 'Wave kills ' + roundKills + '/' + round.targetKills;
  let mt = lv.objective;
  if (gameWon) mt = 'All floors cleared. The aligned AGI is live.';
  else if (gameOver) mt = 'The corruption swarm stopped the build. Restart the training run.';
  else if (floorTransitionPending) mt = 'Extraction corridor opening...';
  else if (!floorPairsCleared) mt = [lv.codename, roundText, round.briefing, 'Good AGI state: ' + stats.title, stats.boostText ? 'Active boosts ' + stats.boostText : '', 'Sprint ' + stats.speed.toFixed(1), pickupNotice && performance.now() < pickupNoticeUntil ? pickupNotice : '', pairsText, roundKillText, 'Bonus under ' + lv.time + 's'].filter(Boolean).join(' · ');
  else if (lockdownActive) mt = ['Lockdown active', 'Hold for ' + Math.ceil(lockdownRemaining) + 's', 'Keep the AGI stable', killText, roundText].filter(Boolean).join(' · ');
  else if (floorDroneKills < getFloorKillRequirement(lv)) mt = [lv.objective, 'Finish the hostile waves to unlock extraction.', killText, roundText].join(' · ');
  else if (remaining <= 0) mt = 'Directive complete. Lift opening...';
  mission.textContent = mt;
  renderRadarMarkers();
}

/* ══════════════════════════════════════════════
   TILE CLICK LOGIC
   ══════════════════════════════════════════════ */
function onTileClick(tile) {
  if (lock || gameWon) return;
  const d = tile.userData;
  if (d.matched || d.revealed) return;

  revealed.add(tiles.indexOf(tile));
  revealTile(tile);

  const rev = Array.from(revealed).filter(x => !matched.has(x));
  if (rev.length >= 2) {
    lock = true;
    setTimeout(() => {
      const [a, b] = rev;
      if (tiles[a].userData.id === tiles[b].userData.id) {
        matched.add(a); matched.add(b);
        markMatched(tiles[a]); markMatched(tiles[b]);
        combo++;
        const points = 100 * combo;
        score += points;

        const matchedPairs = matched.size / 2;
        if (matchedPairs % 2 === 0) {
          const pickupPos = tiles[a].position.clone().add(tiles[b].position).multiplyScalar(0.5);
          spawnPickup(pickupPos);
        }

        spawnParticles(tiles[a].position, tiles[a].userData.revealColor, 10);
        spawnParticles(tiles[b].position, tiles[b].userData.revealColor, 10);

        if (matched.size === tiles.length) {
          floorPairsCleared = true;
          tryResolveFloor();
        }
      } else {
        hideTile(tiles[a]); hideTile(tiles[b]);
        combo = 0; mistakes++;
      }
      revealed.clear();
      lock = false;
      updateHUD();
    }, 600);
  }
  updateHUD();
}

/* ══════════════════════════════════════════════
   INPUT
   ══════════════════════════════════════════════ */
function onKeyDown(e) {
  if (e.key === 'w' || e.key === 'W') keys.w = true;
  if (e.key === 's' || e.key === 'S') keys.s = true;
  if (e.key === 'a' || e.key === 'A') keys.a = true;
  if (e.key === 'd' || e.key === 'D') keys.d = true;
}
function onKeyUp(e) {
  if (e.key === 'w' || e.key === 'W') keys.w = false;
  if (e.key === 's' || e.key === 'S') keys.s = false;
  if (e.key === 'a' || e.key === 'A') keys.a = false;
  if (e.key === 'd' || e.key === 'D') keys.d = false;
}

function onPointerLockChange() {
  pointerLocked = document.pointerLockElement === renderer.domElement;
  if (!pointerLocked && runStarted && !gameOver && !gameWon && startOverlay.style.display === 'none') {
    pauseTimer();
    showOverlay('pause');
  } else if (pointerLocked && runStarted && !gameOver && !gameWon) {
    hideOverlay();
    resumeTimer();
  }
}

function onMouseMove(e) {
  if (!pointerLocked) return;
  euler.y -= e.movementX * 0.002;
  // Standard FPS: mouse up (negative movementY) → look up (negative euler.x)
  euler.x -= e.movementY * 0.002;
  euler.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, euler.x));
  camera.rotation.copy(euler);
}

function onClick() {
  if (!pointerLocked) {
    renderer.domElement.requestPointerLock();
    return;
  }
  firePlayerShot();
}

window.addEventListener('keydown', onKeyDown);
window.addEventListener('keyup', onKeyUp);
document.addEventListener('pointerlockchange', onPointerLockChange);
document.addEventListener('mousemove', onMouseMove);
renderer.domElement.addEventListener('click', onClick);

/* Start button */
startBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (overlayMode === 'gameover' || overlayMode === 'win') {
    resetRun();
  } else {
    runStarted = true;
    hideOverlay();
    resumeTimer();
  }
  renderer.domElement.requestPointerLock();
});
startOverlay.addEventListener('click', () => {
  if (overlayMode === 'gameover' || overlayMode === 'win') {
    resetRun();
  } else {
    runStarted = true;
    hideOverlay();
    resumeTimer();
  }
  renderer.domElement.requestPointerLock();
});

/* ══════════════════════════════════════════════
   MOVEMENT
   ══════════════════════════════════════════════ */
function updateMovement(dt) {
  const stats = getPlayerStats();
  velocity.set(0, 0, 0);
  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0; forward.normalize();
  const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();

  if (keys.w) velocity.add(forward);
  if (keys.s) velocity.sub(forward);
  if (keys.d) velocity.add(right);
  if (keys.a) velocity.sub(right);

  if (velocity.length() > 0) {
    velocity.normalize().multiplyScalar(stats.speed * dt);
    camera.position.add(velocity);
    // Room bounds
    const hw = ROOM.w / 2 - 0.3, hd = ROOM.d / 2 - 0.3;
    camera.position.x = Math.max(-hw, Math.min(hw, camera.position.x));
    camera.position.z = Math.max(-hd, Math.min(hd, camera.position.z));
  }
}

/* ══════════════════════════════════════════════
   TILE ANIMATIONS
   ══════════════════════════════════════════════ */
function updateTileAnimations(dt) {
  for (const tile of tiles) {
    const d = tile.userData;
    // Pop when revealed
    if (d.tween > 0) {
      d.tween -= dt * 3;
      const s = 1 + d.tween * 0.15;
      tile.scale.set(s, 1 + d.tween * 0.5, s);
    } else {
      tile.scale.set(1, 1, 1);
    }
    // Matched glow pulse
    if (d.matched) {
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.004);
      tile.material[2].emissiveIntensity = 0.6 + pulse * 0.6;
    }
  }
}

function updateAimState() {
  if (!pointerLocked || gameOver || gameWon || startOverlay.style.display !== 'none' || getAliveEnemyCount() === 0) {
    targetLocked = false;
    crosshair.classList.remove('locked');
    return;
  }
  raycaster.setFromCamera(pointer, camera);
  targetLocked = Boolean(raycaster.intersectObject(enemyGroup, true)[0]);
  crosshair.classList.toggle('locked', targetLocked);
}

function updateEnemy(dt) {
  for (let i = enemyRespawns.length - 1; i >= 0; i--) {
    const respawn = enemyRespawns[i];
    if (respawn.roundIndex !== activeRound) {
      enemyRespawns.splice(i, 1);
      continue;
    }
    if (performance.now() >= respawn.dueAt && !gameOver && !gameWon) {
      spawnEnemy(getRoundConfig(), respawn.slot);
      enemyRespawns.splice(i, 1);
    }
  }
  if (!runStarted || !pointerLocked || gameOver || gameWon) return;

  enemies.forEach((unit) => {
    if (!unit.alive) return;
    const t = performance.now() * 0.001 - unit.root.userData.spawnTime;
    if (unit.profile.boss) {
      const phaseRatio = 1 - unit.hp / unit.profile.hp;
      const swing = 1.6 + phaseRatio * 1.4;
      unit.root.position.x = Math.sin(t * (1.1 + phaseRatio * 0.5) + unit.phase) * swing;
      unit.root.position.z = 3.6 + Math.cos(t * (0.8 + phaseRatio * 0.35) + unit.phase) * (1.1 + phaseRatio * 0.55);
      unit.root.position.y = 2.35 + Math.sin(t * 3.4) * 0.35;
      if (performance.now() >= unit.bossWarpAt) {
        const slot = ENEMY_SLOTS[Math.floor(Math.random() * ENEMY_SLOTS.length)];
        unit.root.userData.baseX = slot[0] * 0.72;
        unit.root.userData.baseZ = Math.max(2.6, slot[2] + 0.4);
        unit.phase += Math.PI / 3;
        unit.bossWarpAt = performance.now() + Math.max(1200, 2400 - phaseRatio * 900);
        spawnParticles(unit.root.position, unit.profile.glow, 18);
        addBeam(unit.root.position.clone(), camera.position.clone(), unit.profile.glow, 0.18, 0.55);
      }
      unit.barrageCooldown -= dt;
      if (unit.barrageCooldown <= 0) {
        enemyShoot(unit);
        unit.barrageCooldown = Math.max(0.95, 2.1 - phaseRatio * 0.9);
      }
    } else {
      const swing = Math.min(3.1, (LEVELS[level].cols * TILE_GAP) / 2 + 0.6) * unit.profile.moveScale;
      unit.root.position.x = unit.root.userData.baseX + Math.sin(t * (0.75 + unit.profile.moveScale * 0.2) + unit.phase) * swing;
      unit.root.position.z = unit.root.userData.baseZ + Math.cos(t * (0.55 + unit.profile.moveScale * 0.14) + unit.phase) * (0.8 + unit.profile.moveScale * 0.55);
      unit.root.position.y = unit.root.userData.baseY + Math.sin(t * 2.4 + unit.phase) * 0.22;
    }
    unit.root.lookAt(camera.position.x, unit.root.position.y, camera.position.z);
    unit.ring.rotation.z += dt * (2.2 + unit.profile.moveScale * 0.6);
    const activeCooldown = unit.profile.boss ? unit.barrageCooldown : unit.cooldown;
    const maxCooldown = unit.profile.boss ? 2.4 : unit.profile.fireDelay;
    unit.charge = THREE.MathUtils.clamp(1 - activeCooldown / maxCooldown, 0, 1);
    unit.eye.material.emissiveIntensity = 1.2 + unit.charge * 1.8;
    if (unit.charge > 0.72) {
      addBeam(unit.root.position.clone().add(new THREE.Vector3(0, 0, 0.28 * (unit.profile.scale || 1))), camera.position.clone(), unit.profile.eye, 0.03, 0.35);
    }

    unit.cooldown -= dt;
    if (!unit.profile.boss && unit.cooldown <= 0) {
      enemyShoot(unit);
      unit.cooldown = unit.profile.fireDelay;
    }
  });

  advanceRoundIfNeeded();
}

function updateEnemyProjectiles(dt) {
  for (let i = enemyProjectiles.children.length - 1; i >= 0; i--) {
    const shot = enemyProjectiles.children[i];
    shot.position.addScaledVector(shot.userData.vel, dt);
    shot.userData.life -= dt;
    if (shot.position.distanceTo(camera.position) < 0.55) {
      damagePlayer(shot.userData.damage || 1);
      shot.geometry.dispose();
      shot.material.dispose();
      enemyProjectiles.remove(shot);
      continue;
    }
    if (shot.userData.life <= 0 || Math.abs(shot.position.x) > ROOM.w || Math.abs(shot.position.z) > ROOM.d) {
      shot.geometry.dispose();
      shot.material.dispose();
      enemyProjectiles.remove(shot);
    }
  }
}

function updateBeams(dt) {
  for (let i = beamGroup.children.length - 1; i >= 0; i--) {
    const beam = beamGroup.children[i];
    beam.userData.life -= dt;
    beam.material.opacity = Math.max(0, beam.material.opacity - dt * 8);
    if (beam.userData.life <= 0) {
      beam.geometry.dispose();
      beam.material.dispose();
      beamGroup.remove(beam);
    }
  }
}

function updateGun(dt) {
  gun.root.visible = pointerLocked && startOverlay.style.display === 'none';
  if (!gun.root.visible) return;
  gunRecoil = Math.max(0, gunRecoil - dt * 8);
  const swayTime = performance.now() * 0.003;
  gun.root.position.set(
    0.42 + Math.sin(swayTime) * 0.01,
    -0.32 + Math.cos(swayTime * 0.8) * 0.008 + gunRecoil * 0.03,
    -0.72 + gunRecoil * 0.08,
  );
  gun.root.rotation.set(-0.12 - gunRecoil * 0.18, -0.28, 0.02 + gunRecoil * 0.05);
  if (gun.muzzle.userData.life > 0) {
    gun.muzzle.userData.life -= dt;
    gun.muzzle.material.opacity = Math.max(0, gun.muzzle.userData.life * 12);
  } else {
    gun.muzzle.material.opacity = 0;
  }
}

/* ══════════════════════════════════════════════
   RESIZE
   ══════════════════════════════════════════════ */
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ══════════════════════════════════════════════
   GAME LOOP
   ══════════════════════════════════════════════ */
let prevTime = performance.now();

function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt = Math.min((now - prevTime) / 1000, 0.1);
  prevTime = now;

  if (lockdownActive && timerRunning && !gameOver && !gameWon) {
    lockdownRemaining = Math.max(0, lockdownRemaining - dt);
    if (lockdownRemaining <= 0) {
      lockdownActive = false;
      tryResolveFloor();
    }
  }

  updateMovement(dt);
  updateTileAnimations(dt);
  updateAimState(dt);
  updateEnemy(dt);
  updateEnemyProjectiles(dt);
  updateBeams(dt);
  updateGun(dt);
  updatePickups(dt);
  updateParticles(dt);
  updateHUD();

  renderer.render(scene, camera);
}

/* ══════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════ */
buildRoom();
buildLights();
buildBoard();
showOverlay('start');
animate();

if (captureMode) {
  document.body.classList.add('capture-mode');
  runStarted = true;
  hideOverlay();
  stageCaptureScene();
}

if (location.hostname === '127.0.0.1' || location.hostname === 'localhost') {
  window.__unsupervised3dCapture = {
    photoMode() {
      runStarted = true;
      hideOverlay();
      stageCaptureScene();
      updateHUD();
    },
  };
}
