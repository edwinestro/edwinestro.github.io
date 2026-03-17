import * as THREE from 'three';
import {
  ANCHOR,
  COMBO,
  KNOWLEDGE_TYPES,
  MAX_RESONANCE,
  MAX_STABILITY,
  PHASE_LABELS,
  PULSE,
  REFLECTIONS,
  clamp,
  damp,
  lerp,
  rng,
  rngRange,
} from './config.js';
import { describeHistory, getArchiveBonuses, loadArchive, loadArchiveFromServer, mergeArchives, recordRun, setUserId } from './persistence.js';
import { getUser } from './user.js';
import { buildRunProfile, createSeededRandom } from './worldgen.js';

const dom = {
  canvas: document.getElementById('c'),
  startScreen: document.getElementById('startScreen'),
  brandUI: document.getElementById('brandUI'),
  brandUser: document.getElementById('brandUser'),
  directivePanel: document.getElementById('directivePanel'),
  directiveTitle: document.getElementById('directiveTitle'),
  directiveBody: document.getElementById('directiveBody'),
  directivePhase: document.getElementById('directivePhase'),
  directivePressure: document.getElementById('directivePressure'),
  archivePanel: document.getElementById('archivePanel'),
  archiveTier: document.getElementById('archiveTier'),
  archiveRuns: document.getElementById('archiveRuns'),
  archiveBest: document.getElementById('archiveBest'),
  archiveWins: document.getElementById('archiveWins'),
  archiveRunSeed: document.getElementById('archiveRunSeed'),
  archiveModifiers: document.getElementById('archiveModifiers'),
  archiveHistory: document.getElementById('archiveHistory'),
  hint: document.getElementById('hint'),
  reflectionPanel: document.getElementById('reflection'),
  reflectionText: document.getElementById('reflectionText'),
  eventToast: document.getElementById('eventToast'),
  hudPanel: document.getElementById('hudPanel'),
  hudDisc: document.getElementById('hudDisc'),
  hudCuriosity: document.getElementById('hudCuriosity'),
  hudCoherence: document.getElementById('hudCoherence'),
  hudStability: document.getElementById('hudStability'),
  hudEvolution: document.getElementById('hudEvolution'),
  hudBeacons: document.getElementById('hudBeacons'),
  hudResonance: document.getElementById('hudResonance'),
  hudScore: document.getElementById('hudScore'),
  hudMomentum: document.getElementById('hudMomentum'),
  hudState: document.getElementById('hudState'),
  hudAge: document.getElementById('hudAge'),
  hudDuration: document.getElementById('hudDuration'),
  abilityDock: document.getElementById('abilityDock'),
  anchorButton: document.getElementById('anchorButton'),
  anchorStatus: document.getElementById('anchorStatus'),
  anchorCopy: document.getElementById('anchorCopy'),
  pulseButton: document.getElementById('pulseButton'),
  pulseStatus: document.getElementById('pulseStatus'),
  pulseCopy: document.getElementById('pulseCopy'),
  endScreen: document.getElementById('endScreen'),
  endKicker: document.getElementById('endKicker'),
  endTitle: document.getElementById('endTitle'),
  endBody: document.getElementById('endBody'),
  endStatDiscoveries: document.getElementById('endStatDiscoveries'),
  endStatResonance: document.getElementById('endStatResonance'),
  endStatStability: document.getElementById('endStatStability'),
  endStatScore: document.getElementById('endStatScore'),
  endStatDuration: document.getElementById('endStatDuration'),
  endStatAutonomy: document.getElementById('endStatAutonomy'),
  endStatArchive: document.getElementById('endStatArchive'),
  endHistory: document.getElementById('endHistory'),
  restartButton: document.getElementById('restartButton'),
  leaderboardPanel: document.getElementById('leaderboardPanel'),
  lbTabs: document.getElementById('lbTabs'),
  lbList: document.getElementById('lbList'),
};

// Fetch user identity and namespace storage before loading archive
const currentUser = await getUser();
if (currentUser) {
  setUserId(currentUser.userId);
  if (dom.brandUser) {
    dom.brandUser.textContent = currentUser.name;
    const logout = document.createElement('a');
    logout.href = '/.auth/logout';
    logout.textContent = 'Sign out';
    logout.className = 'brand-logout';
    dom.brandUser.append(' ', logout);
  }
}

// Load local archive first (instant), then try server merge (async, non-blocking)
let archiveState = loadArchive();

if (currentUser) {
  const remote = await loadArchiveFromServer();
  archiveState = mergeArchives(archiveState, remote);
  // Persist the best version back to localStorage
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(
      `agi3d.archive.v2.${currentUser.userId}`,
      JSON.stringify(archiveState)
    );
  }
}

let archiveBonuses = getArchiveBonuses(archiveState);
const runProfile = buildRunProfile(archiveState);
const runRandom = createSeededRandom(runProfile.runtimeSeed);
const rand = () => runRandom();
const randRange = (minimum, maximum) => minimum + rand() * (maximum - minimum);

const WORLD_RADIUS = runProfile.worldRadius;
const AGI_LIMIT = WORLD_RADIUS + 4;
const BEACON_LIFETIME = 20 * runProfile.beaconDurationFactor;

// --- Performance: detect GPU tier and adapt ---
const isMobile = /Mobi|Android/i.test(navigator.userAgent);
const maxPixelRatio = isMobile ? 1.5 : Math.min(window.devicePixelRatio, 2);
const shadowRes = isMobile ? 512 : 1024;

const renderer = new THREE.WebGLRenderer({ canvas: dom.canvas, antialias: !isMobile, powerPreference: 'high-performance' });
renderer.setPixelRatio(maxPixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = isMobile ? THREE.BasicShadowMap : THREE.PCFShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x080a1e, 0.018);

const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  uniforms: { uTime: { value: 0 } },
  vertexShader: 'varying vec3 vWP;void main(){vWP=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vWP,1.);}',
  fragmentShader: `
    uniform float uTime; varying vec3 vWP;
    // Hash for star placement
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    void main(){
      vec3 d=normalize(vWP);
      float h=d.y*0.5+0.5;
      // Deep space gradient
      vec3 base=mix(vec3(0.01,0.005,0.04),vec3(0.03,0.04,0.12),smoothstep(0.,0.35,h));
      base=mix(base,vec3(0.06,0.03,0.18),smoothstep(0.35,1.,h));
      // Nebula bands — richer colors, more visible
      float neb1=sin(d.x*4.+uTime*0.06)*sin(d.z*3.5+uTime*0.04)*0.5+0.5;
      neb1*=smoothstep(0.25,0.6,h)*smoothstep(0.95,0.6,h);
      vec3 nebCol1=mix(vec3(0.22,0.06,0.48),vec3(0.06,0.32,0.52),sin(uTime*0.08+h*3.)*0.5+0.5);
      base+=nebCol1*neb1*0.14;
      // Second nebula layer — warm tones
      float neb2=sin(d.x*6.5-uTime*0.05)*sin(d.z*5.+uTime*0.07)*0.5+0.5;
      neb2*=smoothstep(0.4,0.7,h)*smoothstep(0.9,0.7,h);
      base+=vec3(0.28,0.1,0.04)*neb2*0.08;
      // Stars — brighter, twinkling
      float starField=pow(max(0.,sin(d.x*182.+d.z*247.)*sin(d.x*97.-d.z*134.)),28.)*smoothstep(0.3,0.8,h);
      float twinkle=sin(uTime*2.+d.x*40.)*0.3+0.7;
      base+=vec3(0.6,0.7,1.)*starField*twinkle*0.7;
      // Fine star layer
      float fine=pow(max(0.,sin(d.x*311.+d.z*173.)*sin(d.x*231.-d.z*289.)),48.)*smoothstep(0.2,0.6,h);
      base+=vec3(0.4,0.45,0.6)*fine*0.4;
      // Distant planets — glowing discs
      float p1=smoothstep(0.018,0.012,length(d.xz-vec2(0.6,0.3)));
      base+=vec3(0.3,0.15,0.05)*p1*smoothstep(0.4,0.6,h);
      float p2=smoothstep(0.012,0.007,length(d.xz-vec2(-0.4,0.55)));
      base+=vec3(0.08,0.18,0.35)*p2*smoothstep(0.5,0.7,h);
      float p3=smoothstep(0.008,0.004,length(d.xz-vec2(0.15,-0.7)));
      base+=vec3(0.2,0.06,0.25)*p3*smoothstep(0.45,0.65,h);
      gl_FragColor=vec4(base,1.);
    }`,
});
scene.add(new THREE.Mesh(new THREE.SphereGeometry(200, 32, 32), skyMat));

const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 400);
let camAngle = 0;
let camDist = runProfile.cameraDistance;
let camHeight = runProfile.cameraHeight;
let camTargetDist = runProfile.cameraDistance;
let camTargetHeight = runProfile.cameraHeight;
let isDragging = false;
let dragStartX = 0;

scene.add(new THREE.AmbientLight(0x8898c0, 0.58));
const hemi = new THREE.HemisphereLight(0x405880, 0x141a08, 0.44);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xc0d0ff, 0.72);
sun.position.set(12, 20, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(shadowRes, shadowRes);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 60;
sun.shadow.camera.left = -18;
sun.shadow.camera.right = 18;
sun.shadow.camera.top = 18;
sun.shadow.camera.bottom = -18;
scene.add(sun);
scene.add(sun.target);

const groundGeo = new THREE.PlaneGeometry(200, 200, 60, 60);
const groundPositions = groundGeo.attributes.position.array;
const groundColors = new Float32Array(groundPositions.length);
for (let index = 0; index < groundPositions.length; index += 3) {
  const x = groundPositions[index];
  const y = groundPositions[index + 1];
  groundPositions[index + 2] = Math.sin(x * 0.04) * Math.cos(y * 0.035) * 0.6 + Math.sin(x * 0.11 + y * 0.08) * 0.3;
  const shade = 0.4 + Math.sin(x * 0.03 + y * 0.04) * 0.1;
  groundColors[index] = 0.03 + shade * 0.06;
  groundColors[index + 1] = 0.05 + shade * 0.1;
  groundColors[index + 2] = 0.1 + shade * 0.18;
}
groundGeo.setAttribute('color', new THREE.BufferAttribute(groundColors, 3));
groundGeo.computeVertexNormals();
const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({
  color: 0x0e1628,
  roughness: 0.92,
  metalness: 0.08,
  vertexColors: true,
}));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const knowledgeNodes = [];
function createKnowledgeNode(x, z) {
  const type = KNOWLEDGE_TYPES[Math.floor(rand() * KNOWLEDGE_TYPES.length)];
  let geometry = null;
  switch (type.shape) {
    case 'octa': geometry = new THREE.OctahedronGeometry(type.scale, 0); break;
    case 'tetra': geometry = new THREE.TetrahedronGeometry(type.scale, 0); break;
    case 'box': geometry = new THREE.BoxGeometry(type.scale, type.scale, type.scale); break;
    case 'sphere': geometry = new THREE.SphereGeometry(type.scale, 12, 8); break;
    case 'torus': geometry = new THREE.TorusGeometry(type.scale, type.scale * 0.3, 8, 16); break;
    default: geometry = new THREE.OctahedronGeometry(type.scale, 0);
  }
  const material = new THREE.MeshStandardMaterial({
    color: type.color,
    roughness: 0.28,
    metalness: 0.3,
    emissive: type.emissive,
    emissiveIntensity: 0.4,
    transparent: true,
    opacity: 0.88,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, 0.5 + rand() * 0.4, z);
  mesh.castShadow = true;
  const glow = new THREE.PointLight(type.color, 0.5, 5);
  glow.position.copy(mesh.position);
  scene.add(mesh);
  scene.add(glow);
  const node = { mesh, glow, type: type.name, discovered: false, x, z, phase: rng() * Math.PI * 2 };
  knowledgeNodes.push(node);
  return node;
}
for (const point of runProfile.nodePositions) {
  createKnowledgeNode(point.x, point.z);
}

for (const platformData of runProfile.platformPositions) {
  const platform = new THREE.Mesh(
    new THREE.CylinderGeometry(platformData.topRadius, platformData.bottomRadius, 0.15, 16),
    new THREE.MeshStandardMaterial({
      color: 0x1a2444,
      roughness: 0.82,
      metalness: 0.12,
      emissive: 0x080c1a,
      emissiveIntensity: 0.18,
    })
  );
  platform.position.set(platformData.x, 0.04, platformData.z);
  platform.receiveShadow = true;
  platform.castShadow = true;
  scene.add(platform);
}

const neuralLines = [];
const neuralLineMat = new THREE.LineBasicMaterial({
  color: 0x6699ff,
  transparent: true,
  opacity: 0,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});

function addNeuralConnection(from, to) {
  const points = [new THREE.Vector3(from.x, 1.2, from.z), new THREE.Vector3(to.x, 1.2, to.z)];
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = neuralLineMat.clone();
  const line = new THREE.Line(geometry, material);
  scene.add(line);
  neuralLines.push({ line, material, age: 0, maxOpacity: 0.12 + rng() * 0.1 });
}

const ruptures = [];
const anchors = [];
let ruptureId = 0;
let anchorId = 0;
const ruptureRingGeo = new THREE.TorusGeometry(1.25, 0.1, 10, 42);
const ruptureCoreGeo = new THREE.OctahedronGeometry(0.26, 0);
const echoRingGeo = new THREE.TorusGeometry(1.45, 0.06, 10, 42);
const anchorRingGeo = new THREE.TorusGeometry(1.18, 0.09, 10, 48);
const anchorColumnGeo = new THREE.CylinderGeometry(0.18, 0.32, 1.8, 12, 1, true);

const agiGeo = new THREE.IcosahedronGeometry(0.5, 3);
const agiBasePos = new Float32Array(agiGeo.attributes.position.array);
const agiMat = new THREE.MeshPhysicalMaterial({
  color: new THREE.Color(0.28, 0.58, 1),
  metalness: 0.78,
  roughness: 0.12,
  clearcoat: 0.9,
  clearcoatRoughness: 0.08,
  transmission: 0.08,
  thickness: 0.5,
  ior: 1.4,
  emissive: new THREE.Color(0x0a2244),
  emissiveIntensity: 0.28,
  sheen: 0.3,
  sheenColor: new THREE.Color(0x4488ff),
  sheenRoughness: 0.3,
});
const agiMesh = new THREE.Mesh(agiGeo, agiMat);
agiMesh.position.set(0, 1.2, 0);
agiMesh.castShadow = true;
scene.add(agiMesh);

const coreMat = new THREE.MeshBasicMaterial({ color: 0x88ccff, transparent: true, opacity: 0.08, depthWrite: false });
const coreMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.18, 2), coreMat);
scene.add(coreMesh);

const haloGeo = new THREE.TorusGeometry(0.8, 0.015, 8, 48);
const haloMat = new THREE.MeshBasicMaterial({ color: 0x6699ff, transparent: true, opacity: 0.15, depthWrite: false, blending: THREE.AdditiveBlending });
const haloMesh = new THREE.Mesh(haloGeo, haloMat);
haloMesh.rotation.x = Math.PI * 0.5;
scene.add(haloMesh);

const pulseShell = new THREE.Mesh(
  new THREE.SphereGeometry(1, 28, 18),
  new THREE.MeshBasicMaterial({
    color: 0x8fe1ff,
    transparent: true,
    opacity: 0,
    wireframe: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
);
pulseShell.visible = false;
scene.add(pulseShell);

const pulseRing = new THREE.Mesh(
  new THREE.TorusGeometry(1.1, 0.06, 10, 48),
  new THREE.MeshBasicMaterial({
    color: 0xffdd9a,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
);
pulseRing.rotation.x = Math.PI * 0.5;
pulseRing.visible = false;
scene.add(pulseRing);

const SATELLITE_COUNT = isMobile ? 40 : 80;
const satellitePositions = new Float32Array(SATELLITE_COUNT * 3);
const satellitePhase = new Float32Array(SATELLITE_COUNT);
const satelliteRadius = new Float32Array(SATELLITE_COUNT);
const satelliteSpeed = new Float32Array(SATELLITE_COUNT);
for (let index = 0; index < SATELLITE_COUNT; index++) {
  satellitePhase[index] = rng() * Math.PI * 2;
  satelliteRadius[index] = 0.7 + rng() * 0.8;
  satelliteSpeed[index] = 0.3 + rng() * 0.5;
}
const satelliteGeo = new THREE.BufferGeometry();
satelliteGeo.setAttribute('position', new THREE.BufferAttribute(satellitePositions, 3));
const satellitePoints = new THREE.Points(satelliteGeo, new THREE.PointsMaterial({
  color: 0x88bbff,
  size: 0.025,
  transparent: true,
  opacity: 0.45,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
}));
scene.add(satellitePoints);

const DUST_COUNT = isMobile ? 150 : 300;
const dustPositions = new Float32Array(DUST_COUNT * 3);
for (let index = 0; index < DUST_COUNT; index++) {
  dustPositions[index * 3] = rngRange(-30, 30);
  dustPositions[index * 3 + 1] = rngRange(0.2, 6);
  dustPositions[index * 3 + 2] = rngRange(-30, 30);
}
const dustGeo = new THREE.BufferGeometry();
dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
scene.add(new THREE.Points(dustGeo, new THREE.PointsMaterial({
  color: 0x6688cc,
  size: 0.02,
  transparent: true,
  opacity: 0.18,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
})));

const SPARK_COUNT = isMobile ? 40 : 80;
const sparkPositions = new Float32Array(SPARK_COUNT * 3);
const sparkVelocity = [];
const sparkAge = new Float32Array(SPARK_COUNT);
for (let index = 0; index < SPARK_COUNT; index++) {
  sparkPositions[index * 3 + 1] = -10;
  sparkVelocity.push(new THREE.Vector3());
}
const sparkGeo = new THREE.BufferGeometry();
sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
scene.add(new THREE.Points(sparkGeo, new THREE.PointsMaterial({
  color: 0xccddff,
  size: 0.05,
  transparent: true,
  opacity: 0.6,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
})));
let sparkIndex = 0;

const agi = {
  pos: new THREE.Vector3(0, 1.2, 0),
  vel: new THREE.Vector3(),
  targetPos: null,
  curiosity: 0.5,
  coherence: clamp(0.3 + archiveBonuses.coherence, 0, 1),
  fatigue: 0,
  discoveries: 0,
  evolution: 0,
  stateLabel: 'Dormant',
  wanderAngle: rand() * Math.PI * 2,
  wanderTimer: 0,
  thinkTimer: 0,
  discoveredTypes: new Set(),
  lastDiscovery: null,
  attention: 0,
  speed: 1.2,
  breathPhase: 0,
};

const world = {
  stability: MAX_STABILITY,
  resonance: clamp(archiveBonuses.startingResonance, 0, MAX_RESONANCE),
  momentum: clamp(archiveState.archiveTier * 4, 0, 24),
  peakMomentum: clamp(archiveState.archiveTier * 4, 0, 24),
  cycle: 0,
  runDuration: 0,
  ruptureTimer: 8 * runProfile.ruptureCadenceFactor,
  finalPhase: false,
  over: false,
  victory: false,
  lastEvent: 'Observation pending.',
  score: 0,
  rupturesResolved: 0,
  beaconsPlaced: 0,
  pulsesUsed: 0,
  anchorsUsed: 0,
  pulseProtection: 1,
  runRecorded: false,
};

const player = {
  pulseCooldown: 0,
  pulseActive: 0,
  pulseBurst: 0,
  pulseRadius: runProfile.pulse.radius,
  anchorCooldown: 0,
  anchorArmed: false,
  lastAbility: null,
  lastAbilityTime: 0,
  comboCount: 0,
};

const beacons = [];
const beaconGeo = new THREE.ConeGeometry(0.12, 0.5, 6);
const beaconMats = Array.from({ length: 5 }, () => new THREE.MeshBasicMaterial({ color: 0xffcc44, transparent: true, opacity: 0.6, depthWrite: false }));
let beaconMatIndex = 0;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const clock = new THREE.Clock();
let gameStarted = false;
let hintTimer = 0;
let eventToastTimer = 0;
let reflectionTimer = 0;
let seededBurstSpawned = false;
const _sparkOrigin = new THREE.Vector3();

function addMomentum(amount) {
  const previous = world.momentum;
  world.momentum = clamp(world.momentum + amount, 0, 100);
  world.peakMomentum = Math.max(world.peakMomentum, world.momentum);
  if (previous < 70 && world.momentum >= 70) {
    pushEvent('Field momentum surging. Stabilization actions are hitting harder.');
  }
}

function computeLiveScore() {
  const base = agi.discoveries * 85 + world.rupturesResolved * 140 + world.resonance * 6 + world.stability * 2 + world.momentum * 4 + world.peakMomentum * 2 + (world.victory ? 600 : 0) - world.beaconsPlaced * 5 + world.anchorsUsed * 20;
  world.score = Math.max(0, Math.round(base * archiveBonuses.scoreMultiplier));
  return world.score;
}

function updateArchiveUI() {
  dom.archiveTier.textContent = `${archiveState.archiveTier}`;
  dom.archiveRuns.textContent = `${archiveState.totalRuns}`;
  dom.archiveBest.textContent = `${archiveState.bestScore}`;
  dom.archiveWins.textContent = `${archiveState.wins}`;
  dom.archiveRunSeed.textContent = `Run seed ${runProfile.seedLabel}`;
  dom.archiveModifiers.textContent = runProfile.modifierText ? `Modifiers ${runProfile.modifierText}` : 'Modifiers Baseline field';
  dom.archiveHistory.textContent = describeHistory(archiveState.history);
}

function pushEvent(text) {
  world.lastEvent = text;
  dom.eventToast.textContent = text;
  dom.eventToast.classList.add('show');
  eventToastTimer = 3.2;
}

function emitSpark(origin, count) {
  for (let index = 0; index < count; index++) {
    const activeIndex = sparkIndex % SPARK_COUNT;
    sparkPositions[activeIndex * 3] = origin.x + rngRange(-0.2, 0.2);
    sparkPositions[activeIndex * 3 + 1] = origin.y + rngRange(-0.1, 0.3);
    sparkPositions[activeIndex * 3 + 2] = origin.z + rngRange(-0.2, 0.2);
    sparkVelocity[activeIndex].set(rngRange(-1.5, 1.5), 1 + rng() * 2, rngRange(-1.5, 1.5));
    sparkAge[activeIndex] = 1;
    sparkIndex += 1;
  }
}

function removeAnchor(anchor) {
  scene.remove(anchor.ring);
  scene.remove(anchor.column);
  scene.remove(anchor.light);
}

const beaconLightPool = Array.from({ length: 5 }, () => {
  const l = new THREE.PointLight(0xffcc44, 0.6, 6);
  l.visible = false;
  scene.add(l);
  return l;
});
const beaconMeshPool = Array.from({ length: 5 }, (_, i) => {
  const m = new THREE.Mesh(beaconGeo, beaconMats[i]);
  m.visible = false;
  scene.add(m);
  return m;
});

function placeBeacon(x, z) {
  if (beacons.length >= 5) {
    const expired = beacons.shift();
    expired.mesh.visible = false;
    expired.light.visible = false;
  }
  const poolIdx = beaconMatIndex % 5;
  beaconMatIndex += 1;
  const mesh = beaconMeshPool[poolIdx];
  const light = beaconLightPool[poolIdx];
  mesh.position.set(x, 0.3, z);
  mesh.visible = true;
  beaconMats[poolIdx].opacity = 0.6;
  light.position.set(x, 0.6, z);
  light.intensity = 0.6;
  light.visible = true;
  beacons.push({ mesh, light, mat: beaconMats[poolIdx], x, z, age: 0 });
  world.beaconsPlaced += 1;
}

function beaconInfluenceAt(x, z) {
  let influence = 0;
  for (const beacon of beacons) {
    const distance = Math.hypot(beacon.x - x, beacon.z - z);
    if (distance < 6.5) influence = Math.max(influence, 1 - distance / 6.5);
  }
  return influence;
}

function anchorInfluenceAt(x, z) {
  let influence = 0;
  for (const anchor of anchors) {
    const distance = Math.hypot(anchor.x - x, anchor.z - z);
    if (distance < anchor.radius) influence = Math.max(influence, 1 - distance / anchor.radius);
  }
  return influence;
}

function activeRuptureCount() {
  let count = 0;
  for (const rupture of ruptures) {
    if (!rupture.resolved) count += 1;
  }
  return count;
}

function pulseAffects(x, z) {
  if (player.pulseActive <= 0) return 0;
  const distance = Math.hypot(x - agi.pos.x, z - agi.pos.z);
  if (distance > player.pulseRadius) return 0;
  return 1 - distance / player.pulseRadius;
}

const ruptureRingMats = {
  echo: new THREE.MeshBasicMaterial({ color: 0xcc66ff, transparent: true, opacity: 0.62, depthWrite: false, blending: THREE.AdditiveBlending }),
  hot: new THREE.MeshBasicMaterial({ color: 0xff6688, transparent: true, opacity: 0.62, depthWrite: false, blending: THREE.AdditiveBlending }),
  warm: new THREE.MeshBasicMaterial({ color: 0xff9b63, transparent: true, opacity: 0.62, depthWrite: false, blending: THREE.AdditiveBlending }),
};
const ruptureCoreMats = {
  echo: new THREE.MeshBasicMaterial({ color: 0xe8ccff, transparent: true, opacity: 0.92, depthWrite: false }),
  normal: new THREE.MeshBasicMaterial({ color: 0xffddb8, transparent: true, opacity: 0.92, depthWrite: false }),
};
const echoOuterMat = new THREE.MeshBasicMaterial({ color: 0xaa44ee, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending });

function createRupture(x, z, severity = randRange(1, 1.85 + runProfile.ruptureSeverityBonus), echo = false) {
  const ringMatTemplate = echo ? ruptureRingMats.echo : severity > 1.55 ? ruptureRingMats.hot : ruptureRingMats.warm;
  const ring = new THREE.Mesh(ruptureRingGeo, ringMatTemplate.clone());
  ring.rotation.x = Math.PI * 0.5;
  ring.position.set(x, 0.08, z);
  const coreMatTemplate = echo ? ruptureCoreMats.echo : ruptureCoreMats.normal;
  const core = new THREE.Mesh(ruptureCoreGeo, coreMatTemplate.clone());
  core.position.set(x, 0.72, z);
  const color = echo ? 0xcc66ff : severity > 1.55 ? 0xff6688 : 0xff9b63;
  const light = new THREE.PointLight(color, 1.15 + severity * 0.4, 9 + severity * 3);
  light.position.set(x, 0.8, z);
  scene.add(ring);
  scene.add(core);
  scene.add(light);

  let outerRing = null;
  if (echo) {
    outerRing = new THREE.Mesh(echoRingGeo, echoOuterMat.clone());
    outerRing.rotation.x = Math.PI * 0.5;
    outerRing.position.set(x, 0.06, z);
    scene.add(outerRing);
  }

  ruptures.push({
    id: ruptureId,
    x,
    z,
    severity,
    age: 0,
    progress: 0,
    resolved: false,
    fade: 1,
    radius: 2.1 + severity * 0.55,
    phase: rng() * Math.PI * 2,
    ring,
    core,
    light,
    echo,
    outerRing,
    hasSplit: false,
  });
  ruptureId += 1;
}

function spawnRuptureBurst(count, spread = 18, severityLo = 1, severityHi = 2 + runProfile.ruptureSeverityBonus) {
  for (let index = 0; index < count; index++) {
    const angle = rand() * Math.PI * 2;
    const minRadius = 6 + WORLD_RADIUS * runProfile.ruptureOuterBias * 0.24;
    const radius = minRadius + rand() * spread;
    const isEcho = agi.evolution >= 2 && rand() < 0.2;
    createRupture(
      clamp(agi.pos.x + Math.cos(angle) * radius, -WORLD_RADIUS, WORLD_RADIUS),
      clamp(agi.pos.z + Math.sin(angle) * radius, -WORLD_RADIUS, WORLD_RADIUS),
      randRange(severityLo, severityHi),
      isEcho
    );
  }
}

function checkAbilityCombo(currentAbility) {
  const now = world.cycle;
  const prev = player.lastAbility;
  const elapsed = now - player.lastAbilityTime;
  let comboMsg = null;

  if (prev && prev !== currentAbility && elapsed < COMBO.window) {
    player.comboCount += 1;
    if (prev === 'anchor' && currentAbility === 'pulse') {
      for (const rupture of ruptures) {
        if (rupture.resolved) continue;
        const impact = pulseAffects(rupture.x, rupture.z);
        const anchorBoost = anchorInfluenceAt(rupture.x, rupture.z);
        if (impact > 0 && anchorBoost > 0) {
          rupture.progress = clamp(rupture.progress + PULSE.instantProgress * COMBO.anchorPulseBonus * impact * anchorBoost, 0, 1);
          if (rupture.progress >= 1) resolveRupture(rupture);
        }
      }
      addMomentum(14);
      comboMsg = 'Anchor-Pulse combo! Anchored ruptures take double pulse damage.';
    } else if (prev === 'pulse' && currentAbility === 'anchor') {
      player.pulseCooldown = Math.max(0, player.pulseCooldown - COMBO.pulseCooldownRefund);
      addMomentum(10);
      comboMsg = 'Pulse-Anchor combo! Pulse cooldown partially refunded.';
    }
  } else {
    player.comboCount = 0;
  }

  player.lastAbility = currentAbility;
  player.lastAbilityTime = now;
  return comboMsg;
}

const anchorRingMatTemplate = new THREE.MeshBasicMaterial({ color: 0x74dfff, transparent: true, opacity: 0.42, depthWrite: false, blending: THREE.AdditiveBlending });
const anchorColumnMatTemplate = new THREE.MeshBasicMaterial({ color: 0xbff5ff, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending });

function placeAnchorField(x, z) {
  player.anchorArmed = false;
  player.anchorCooldown = runProfile.anchor.cooldown - archiveBonuses.anchorCooldownReduction;
  if (anchors.length >= runProfile.anchor.maxActive) {
    removeAnchor(anchors.shift());
  }

  const ring = new THREE.Mesh(anchorRingGeo, anchorRingMatTemplate.clone());
  ring.rotation.x = Math.PI * 0.5;
  ring.position.set(x, 0.16, z);
  ring.scale.setScalar(runProfile.anchor.radius / 1.18);
  const column = new THREE.Mesh(anchorColumnGeo, anchorColumnMatTemplate.clone());
  column.position.set(x, 1.1, z);
  const light = new THREE.PointLight(0x7de0ff, 0.95, runProfile.anchor.radius * 2.4);
  light.position.set(x, 1.2, z);
  scene.add(ring);
  scene.add(column);
  scene.add(light);
  anchors.push({
    id: anchorId,
    x,
    z,
    age: 0,
    duration: runProfile.anchor.duration,
    radius: runProfile.anchor.radius,
    ring,
    column,
    light,
    phase: rng() * Math.PI * 2,
  });
  anchorId += 1;
  world.anchorsUsed += 1;
  agi.attention = clamp(agi.attention + 0.18, 0, 1);
  const supportedRuptures = ruptures.filter((rupture) => !rupture.resolved && Math.hypot(rupture.x - x, rupture.z - z) < runProfile.anchor.radius).length;
  addMomentum(supportedRuptures > 0 ? 10 + supportedRuptures * 3 : 4);

  const comboMsg = checkAbilityCombo('anchor');
  const baseMsg = supportedRuptures > 0 ? `Anchor field deployed. ${supportedRuptures} rupture${supportedRuptures === 1 ? '' : 's'} pinned inside the zone.` : 'Anchor field deployed. Nearby ruptures will hold shape and stabilize faster.';
  pushEvent(comboMsg ? `${baseMsg} ${comboMsg}` : baseMsg);
}

function triggerPulse() {
  if (!gameStarted || world.over || player.pulseCooldown > 0 || dom.endScreen.classList.contains('show')) return;

  player.pulseActive = PULSE.duration;
  player.pulseCooldown = Math.max(5.5, runProfile.pulse.cooldown - archiveBonuses.pulseCooldownReduction);
  player.pulseBurst = 1;
  world.pulsesUsed += 1;
  agi.attention = clamp(agi.attention + 0.2, 0, 1);
  agi.coherence = clamp(agi.coherence + 0.04, 0, 1);
  emitSpark(_sparkOrigin.copy(agi.pos), 28);

  let impacted = 0;
  for (const rupture of ruptures) {
    if (rupture.resolved) continue;
    const impact = pulseAffects(rupture.x, rupture.z);
    if (impact <= 0) continue;
    rupture.progress = clamp(rupture.progress + PULSE.instantProgress * impact, 0, 1);
    rupture.severity = Math.max(0.9, rupture.severity - 0.12 * impact);
    impacted += 1;
  }

  addMomentum(impacted > 0 ? 8 + impacted * 4 : 3);

  const comboMsg = checkAbilityCombo('pulse');

  const beaconChainCount = beacons.filter((b) => Math.hypot(b.x - agi.pos.x, b.z - agi.pos.z) < COMBO.beaconChainRadius).length;
  if (beaconChainCount >= 2) {
    world.resonance = clamp(world.resonance + COMBO.beaconChainResonance * beaconChainCount, 0, MAX_RESONANCE);
    addMomentum(beaconChainCount * 3);
    pushEvent(`Pulse + ${beaconChainCount} beacons resonance cascade. +${Math.round(COMBO.beaconChainResonance * beaconChainCount)} resonance.`);
  } else {
    const baseMsg = impacted > 0 ? `Pulse shield released. ${impacted} rupture${impacted === 1 ? '' : 's'} caught in the wave.` : 'Pulse shield released. The field quiets around the AGI.';
    pushEvent(comboMsg ? `${baseMsg} ${comboMsg}` : baseMsg);
  }
}

function toggleAnchorMode() {
  if (!gameStarted || world.over || player.anchorCooldown > 0) return;
  player.anchorArmed = !player.anchorArmed;
  pushEvent(player.anchorArmed ? 'Anchor field armed. Click the terrain to place it.' : 'Anchor field targeting canceled.');
}

function recordArchiveRun() {
  if (world.runRecorded) return;
  world.runRecorded = true;
  const interventions = world.beaconsPlaced + world.pulsesUsed + world.anchorsUsed;
  const autonomyRatio = world.runDuration / Math.max(1, interventions);
  const { archive: nextArchive, entry } = recordRun(archiveState, {
    victory: world.victory,
    discoveries: agi.discoveries,
    resonance: world.resonance,
    stability: world.stability,
    rupturesResolved: world.rupturesResolved,
    beaconsPlaced: world.beaconsPlaced,
    pulsesUsed: world.pulsesUsed,
    anchorsUsed: world.anchorsUsed,
    runDuration: Math.round(world.runDuration),
    autonomyRatio: Math.round(autonomyRatio * 10) / 10,
    seedLabel: runProfile.seedLabel,
    modifierLabels: runProfile.modifierLabels,
  });
  archiveState = nextArchive;
  archiveBonuses = getArchiveBonuses(archiveState);
  updateArchiveUI();
  dom.endStatScore.textContent = `Score ${entry.score}`;
  dom.endStatArchive.textContent = `Archive Tier ${archiveState.archiveTier}`;
  dom.endHistory.textContent = describeHistory(archiveState.history);
}

function endRun(victory) {
  if (world.over) return;
  world.over = true;
  world.victory = victory;
  computeLiveScore();
  dom.endKicker.textContent = victory ? 'Transcendence achieved' : 'Field collapse';
  dom.endTitle.textContent = victory ? 'The AGI crossed the threshold' : 'The world lost coherence';
  dom.endBody.textContent = victory
    ? `You held seed ${runProfile.seedLabel} together through ${runProfile.modifierText || 'a baseline field'} and converted it into archive momentum.`
    : `Seed ${runProfile.seedLabel} collapsed under ${runProfile.modifierText || 'baseline pressure'}. Use anchor fields earlier to pin the hottest space before ruptures cascade.`;
  const dur = Math.round(world.runDuration);
  const interventions = world.beaconsPlaced + world.pulsesUsed + world.anchorsUsed;
  const autoRatio = world.runDuration / Math.max(1, interventions);
  dom.endStatDiscoveries.textContent = `Discoveries ${agi.discoveries}`;
  dom.endStatResonance.textContent = `Resonance ${Math.round(world.resonance)}%`;
  dom.endStatStability.textContent = `Stability ${Math.round(world.stability)}%`;
  dom.endStatDuration.textContent = `Survived ${dur}s`;
  dom.endStatAutonomy.textContent = `Autonomy ${autoRatio.toFixed(1)}s/act`;
  // Lore-based kicker
  if (autoRatio > 30) dom.endKicker.textContent = victory ? 'It learned to hold its own' : 'Almost independent — but the field fractured';
  else if (interventions === 0) dom.endKicker.textContent = victory ? 'Pure autonomy achieved' : 'Free — but fragile';
  recordArchiveRun();
  dom.endScreen.classList.add('show');
}

function updateDirective() {
  const rupturesActive = activeRuptureCount();
  const nextEvolutionAt = agi.evolution === 0 ? 3 : agi.evolution === 1 ? 6 : agi.evolution === 2 ? 10 : agi.evolution === 3 ? 15 : null;
  dom.directivePhase.textContent = world.finalPhase ? 'Singularity' : PHASE_LABELS[Math.min(agi.evolution, PHASE_LABELS.length - 1)];
  dom.directivePressure.textContent = rupturesActive > 0 ? `${rupturesActive} rupture${rupturesActive === 1 ? '' : 's'} active` : 'Field stable';

  if (world.over) {
    dom.directiveTitle.textContent = world.victory ? 'Transcendence complete' : 'Collapse recorded';
    dom.directiveBody.textContent = world.victory
      ? 'The archive recorded a successful run. Restart to see the next seed and modifier set.'
      : 'Restart and use anchor fields to pin dangerous zones before ruptures accumulate.';
    return;
  }

  if (world.finalPhase) {
    dom.directiveTitle.textContent = 'Clear the field';
    dom.directiveBody.textContent = rupturesActive > 0
      ? 'Final phase active. Use beacons to steer, anchor fields to pin space, and Pulse Shield to buy time while every rupture is cleared.'
      : 'Field clear. Hold coherence and let transcendence resolve.';
    return;
  }

  if (rupturesActive > 0) {
    dom.directiveTitle.textContent = 'Stabilize live ruptures';
    dom.directiveBody.textContent = 'Place beacons close to ruptures. Anchor fields stabilize a region of space, while Pulse Shield protects the AGI directly.';
    return;
  }

  if (nextEvolutionAt !== null) {
    dom.directiveTitle.textContent = 'Grow the internal model';
    dom.directiveBody.textContent = `Find ${nextEvolutionAt - agi.discoveries} more discoveries to reach the next evolution stage. This seed is running ${runProfile.modifierText || 'baseline field rules'}.`;
    return;
  }

  dom.directiveTitle.textContent = 'Charge transcendence';
  dom.directiveBody.textContent = `Evolution is maxed. Build resonance to ${MAX_RESONANCE}% and keep anchor and pulse abilities ready for the singularity burst.`;
}

function updateWorld(dt) {
  if (world.over) return;

  world.cycle += dt;
  world.runDuration += dt;
  world.momentum = Math.max(0, world.momentum - dt * (world.finalPhase ? 1.6 : 2.3));
  if (player.pulseCooldown > 0) player.pulseCooldown = Math.max(0, player.pulseCooldown - dt);
  if (player.anchorCooldown > 0) player.anchorCooldown = Math.max(0, player.anchorCooldown - dt);
  if (player.pulseActive > 0) {
    player.pulseActive = Math.max(0, player.pulseActive - dt);
    world.pulseProtection = 1 - PULSE.shieldFactor;
  } else {
    world.pulseProtection = 1;
  }
  player.pulseBurst = Math.max(0, player.pulseBurst - dt * 2.2);

  const activeCount = activeRuptureCount();
  if (!world.finalPhase) {
    world.ruptureTimer -= dt;
    if (world.ruptureTimer <= 0 && activeCount < runProfile.maxConcurrentRuptures + Math.min(agi.evolution, 2)) {
      const distance = 10 + WORLD_RADIUS * runProfile.ruptureOuterBias * 0.22 + rand() * 18;
      const angle = rand() * Math.PI * 2;
      const isEchoSpawn = agi.evolution >= 2 && rand() < 0.18;
      createRupture(
        clamp(agi.pos.x + Math.cos(angle) * distance, -WORLD_RADIUS, WORLD_RADIUS),
        clamp(agi.pos.z + Math.sin(angle) * distance, -WORLD_RADIUS, WORLD_RADIUS),
        randRange(1, 1.85 + runProfile.ruptureSeverityBonus + agi.evolution * 0.12),
        isEchoSpawn
      );
      world.ruptureTimer = randRange(Math.max(4.8, 9 - agi.evolution * 0.7), Math.max(6.6, 13 - agi.evolution * 0.5)) * runProfile.ruptureCadenceFactor;
      pushEvent(isEchoSpawn ? 'An echo rupture appears — it will split if left unattended.' : 'A rupture tears open in the field.');
    }
  }

  if (!world.finalPhase && agi.evolution >= 4 && world.resonance >= MAX_RESONANCE) {
    world.finalPhase = true;
    spawnRuptureBurst(3 + runProfile.startingRuptures, 10, 1.55, 2.2 + runProfile.ruptureSeverityBonus);
    pushEvent('Singularity window open. Clear every rupture.');
  }

  if (world.stability <= 0) endRun(false);
  if (world.finalPhase && activeRuptureCount() === 0 && agi.evolution >= 4 && world.resonance >= MAX_RESONANCE) endRun(true);
}

function resolveRupture(rupture) {
  if (rupture.resolved) return;
  rupture.resolved = true;
  rupture.progress = 1;
  world.rupturesResolved += 1;
  addMomentum(18 + rupture.severity * 4);
  world.stability = clamp(world.stability + 11 + agi.evolution * 2, 0, MAX_STABILITY);
  world.resonance = clamp(world.resonance + (12 + rupture.severity * 5) * runProfile.discoveryResonanceFactor, 0, MAX_RESONANCE);
  agi.coherence = clamp(agi.coherence + 0.08, 0, 1);
  agi.curiosity = clamp(agi.curiosity + 0.04, 0, 1);
  agi.attention = clamp(agi.attention + 0.12, 0, 1);
  emitSpark(_sparkOrigin.set(rupture.x, 0.9, rupture.z), 26);
  pushEvent('Rupture harmonized. The field stabilizes.');
  if (agi.targetPos && agi.targetPos.ruptureId === rupture.id) agi.targetPos = null;
}

function updateAnchors(dt, time) {
  for (let index = anchors.length - 1; index >= 0; index--) {
    const anchor = anchors[index];
    anchor.age += dt;
    const life = 1 - anchor.age / anchor.duration;
    const pulse = Math.sin(time * 1.8 + anchor.phase) * 0.5 + 0.5;
    anchor.ring.material.opacity = Math.max(0, 0.22 + life * 0.28 + pulse * 0.12);
    anchor.column.material.opacity = Math.max(0, 0.08 + life * 0.12);
    anchor.light.intensity = Math.max(0, 0.38 + life * 0.62 + pulse * 0.16);
    anchor.ring.rotation.z += dt * 0.3;
    anchor.column.position.y = 1 + pulse * 0.18;
    if (anchor.age >= anchor.duration) {
      removeAnchor(anchor);
      anchors.splice(index, 1);
    }
  }
}

function updateRuptures(dt, time) {
  let ambientDrain = 0;

  for (let index = ruptures.length - 1; index >= 0; index--) {
    const rupture = ruptures[index];
    rupture.age += dt;
    const pulse = Math.sin(time * (2.1 + rupture.severity * 0.35) + rupture.phase) * 0.5 + 0.5;

    rupture.ring.position.y = 0.06 + pulse * 0.04;
    rupture.ring.scale.setScalar(1 + pulse * 0.16 + rupture.progress * 0.14);
    rupture.core.position.y = 0.62 + pulse * 0.22;
    rupture.core.rotation.x += dt * 0.9;
    rupture.core.rotation.y += dt * 1.4;

    if (rupture.resolved) {
      rupture.fade -= dt * 1.8;
      rupture.ring.material.opacity = Math.max(0, rupture.fade * 0.5);
      rupture.core.material.opacity = Math.max(0, rupture.fade * 0.85);
      rupture.light.intensity = Math.max(0, rupture.fade * 0.9);
      if (rupture.outerRing) rupture.outerRing.material.opacity = Math.max(0, rupture.fade * 0.25);
      if (rupture.fade <= 0) {
        scene.remove(rupture.ring);
        scene.remove(rupture.core);
        scene.remove(rupture.light);
        if (rupture.outerRing) scene.remove(rupture.outerRing);
        ruptures.splice(index, 1);
      }
      continue;
    }

    const beaconSupport = beaconInfluenceAt(rupture.x, rupture.z);
    const shieldSupport = pulseAffects(rupture.x, rupture.z);
    const anchorSupport = anchorInfluenceAt(rupture.x, rupture.z);
    const distance = Math.hypot(rupture.x - agi.pos.x, rupture.z - agi.pos.z);
    rupture.ring.material.opacity = 0.34 + pulse * 0.32 + beaconSupport * 0.18 + shieldSupport * 0.16 + anchorSupport * 0.22;
    rupture.core.material.opacity = 0.5 + pulse * 0.3 + beaconSupport * 0.12 + shieldSupport * 0.14 + anchorSupport * 0.18;
    rupture.light.intensity = 1.05 + pulse * 0.5 + beaconSupport * 0.45 + shieldSupport * 0.55 + anchorSupport * 0.7;

    ambientDrain += 0.36 * world.pulseProtection * (1 - anchorSupport * ANCHOR.stabilityShield) * (1 - Math.min(0.22, world.momentum * 0.0022));

    if (distance < rupture.radius + 1.25) {
      rupture.progress = clamp(rupture.progress + dt * runProfile.baseRuptureProgressFactor * (0.16 + agi.coherence * 0.35 + beaconSupport * 0.7 + shieldSupport * PULSE.ruptureBoost + anchorSupport * ANCHOR.harmonizeBoost + world.momentum * 0.0035), 0, 1);
      if (agi.stateLabel !== 'Resting') agi.stateLabel = anchorSupport > 0.2 ? 'Anchoring' : shieldSupport > 0.15 ? 'Shielding' : beaconSupport > 0.22 ? 'Harmonizing' : 'Stabilizing';
      if (beaconSupport < 0.16 && anchorSupport < 0.16) {
        world.stability = clamp(world.stability - dt * 0.42 * (1 - rupture.progress) * (1 - shieldSupport * 0.75), 0, MAX_STABILITY);
      }
    }

    if (rupture.age > 12 && beaconSupport < 0.14 && shieldSupport < 0.08) {
      rupture.severity = Math.min(2.4, rupture.severity + dt * 0.03 * (1 - anchorSupport * ANCHOR.severityDampen));
    }

    if (rupture.echo && !rupture.hasSplit && rupture.age > 10 && beaconSupport < 0.14 && shieldSupport < 0.08 && anchorSupport < 0.14) {
      rupture.hasSplit = true;
      const splitAngle = rng() * Math.PI * 2;
      const splitDist = 3.5 + rng() * 2;
      createRupture(
        clamp(rupture.x + Math.cos(splitAngle) * splitDist, -WORLD_RADIUS, WORLD_RADIUS),
        clamp(rupture.z + Math.sin(splitAngle) * splitDist, -WORLD_RADIUS, WORLD_RADIUS),
        randRange(0.9, rupture.severity * 0.7),
        false
      );
      emitSpark(_sparkOrigin.set(rupture.x, 0.8, rupture.z), 16);
      pushEvent('Echo rupture split. A new fracture appeared nearby.');
    }

    if (rupture.outerRing) {
      rupture.outerRing.position.y = 0.04 + pulse * 0.03;
      rupture.outerRing.scale.setScalar(1.05 + Math.sin(time * 3.2 + rupture.phase) * 0.12);
      rupture.outerRing.rotation.z += dt * 0.5;
      rupture.outerRing.material.opacity = 0.18 + pulse * 0.2 + (rupture.age > 8 && !rupture.hasSplit ? Math.sin(time * 6) * 0.15 : 0);
    }

    if (rupture.progress >= 1) resolveRupture(rupture);
  }

  if (!world.over && ambientDrain > 0) {
    world.stability = clamp(world.stability - ambientDrain * dt, 0, MAX_STABILITY);
  }
}

function pickTarget() {
  let best = null;
  let bestScore = -Infinity;

  for (const rupture of ruptures) {
    if (rupture.resolved) continue;
    const distance = Math.hypot(rupture.x - agi.pos.x, rupture.z - agi.pos.z);
    const support = beaconInfluenceAt(rupture.x, rupture.z) + pulseAffects(rupture.x, rupture.z) * 0.8 + anchorInfluenceAt(rupture.x, rupture.z) * ANCHOR.influenceBoost;
    const urgency = (MAX_STABILITY - world.stability) * 0.08 + rupture.severity * 5.5 + rupture.age * 0.12;
    const score = 14 + urgency + support * 5 + agi.coherence * 4 - distance * 0.16 + rng();
    if (score > bestScore) {
      bestScore = score;
      best = { x: rupture.x, z: rupture.z, ruptureId: rupture.id };
    }
  }

  for (const node of knowledgeNodes) {
    if (node.discovered) continue;
    const distance = Math.hypot(node.x - agi.pos.x, node.z - agi.pos.z);
    const novelty = agi.discoveredTypes.has(node.type) ? 0.3 : 1;
    const score = novelty * 6 + agi.curiosity * 4 + anchorInfluenceAt(node.x, node.z) * ANCHOR.influenceBoost * 2 - distance * 0.15 + rng() * 2;
    if (score > bestScore) {
      bestScore = score;
      best = { x: node.x, z: node.z };
    }
  }

  for (const beacon of beacons) {
    const distance = Math.hypot(beacon.x - agi.pos.x, beacon.z - agi.pos.z);
    const score = 5 + agi.attention * 3 - distance * 0.12 + rng() * 1.5;
    if (score > bestScore) {
      bestScore = score;
      best = { x: beacon.x, z: beacon.z };
    }
  }

  return best;
}

function updateAGI(dt) {
  if (world.over) {
    agi.vel.x = damp(agi.vel.x, 0, 5, dt);
    agi.vel.z = damp(agi.vel.z, 0, 5, dt);
    agi.pos.x = clamp(agi.pos.x + agi.vel.x * dt, -AGI_LIMIT, AGI_LIMIT);
    agi.pos.z = clamp(agi.pos.z + agi.vel.z * dt, -AGI_LIMIT, AGI_LIMIT);
    agi.pos.y = 1.2 + Math.sin((agi.breathPhase += dt) * 0.4) * 0.08;
    return;
  }

  agi.breathPhase += dt;
  agi.thinkTimer -= dt;
  agi.wanderTimer -= dt;
  agi.fatigue = Math.max(0, agi.fatigue - dt * 0.02 - player.pulseActive * 0.002 * dt);

  if (agi.thinkTimer <= 0 && agi.fatigue < 0.7) {
    agi.thinkTimer = 2 + rng() * 3;
    const target = pickTarget();
    if (target && rng() < 0.4 + agi.curiosity * 0.5) {
      agi.targetPos = target;
      agi.stateLabel = 'Investigating';
    } else if (rng() < 0.3) {
      agi.stateLabel = 'Contemplating';
      agi.targetPos = null;
    } else {
      agi.wanderAngle += rngRange(-0.8, 0.8);
      agi.wanderTimer = 2 + rng() * 3;
      agi.stateLabel = 'Exploring';
      agi.targetPos = null;
    }
  }

  if (agi.fatigue > 0.7) {
    agi.stateLabel = 'Resting';
    agi.targetPos = null;
  }

  if (agi.targetPos && agi.targetPos.ruptureId != null) {
    const ruptureAlive = ruptures.some((rupture) => rupture.id === agi.targetPos.ruptureId && !rupture.resolved);
    if (!ruptureAlive) agi.targetPos = null;
  }

  const maxSpeed = agi.speed * (1 - agi.fatigue * 0.6) * (0.8 + agi.curiosity * 0.4 + (player.pulseActive > 0 ? 0.08 : 0) + world.momentum * 0.002);
  if (agi.targetPos) {
    const dx = agi.targetPos.x - agi.pos.x;
    const dz = agi.targetPos.z - agi.pos.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    if (distance > 0.5) {
      agi.vel.x = damp(agi.vel.x, (dx / distance) * maxSpeed, 3, dt);
      agi.vel.z = damp(agi.vel.z, (dz / distance) * maxSpeed, 3, dt);
    } else {
      agi.targetPos = null;
    }
  } else if (agi.wanderTimer > 0) {
    agi.vel.x = damp(agi.vel.x, Math.cos(agi.wanderAngle) * maxSpeed * 0.5, 2, dt);
    agi.vel.z = damp(agi.vel.z, Math.sin(agi.wanderAngle) * maxSpeed * 0.5, 2, dt);
  } else {
    agi.vel.x = damp(agi.vel.x, 0, 4, dt);
    agi.vel.z = damp(agi.vel.z, 0, 4, dt);
  }

  agi.pos.x = clamp(agi.pos.x + agi.vel.x * dt, -AGI_LIMIT, AGI_LIMIT);
  agi.pos.z = clamp(agi.pos.z + agi.vel.z * dt, -AGI_LIMIT, AGI_LIMIT);
  const speed = Math.sqrt(agi.vel.x * agi.vel.x + agi.vel.z * agi.vel.z);
  agi.fatigue = Math.min(1, agi.fatigue + speed * dt * 0.008);
  agi.pos.y = 1.2 + Math.sin(agi.breathPhase * 0.6) * 0.12;

  for (const node of knowledgeNodes) {
    if (node.discovered) continue;
    const dx = node.x - agi.pos.x;
    const dz = node.z - agi.pos.z;
    if (dx * dx + dz * dz < 1.8 * 1.8) {
      node.discovered = true;
      agi.discoveries += 1;
      const isNovelType = !agi.discoveredTypes.has(node.type);
      agi.discoveredTypes.add(node.type);
      agi.curiosity = clamp(agi.curiosity + 0.06, 0, 1);
      agi.coherence = clamp(agi.coherence + 0.04 + (player.pulseActive > 0 ? 0.02 : 0), 0, 1);
      agi.fatigue = clamp(agi.fatigue + 0.05, 0, 1);
      agi.lastDiscovery = node.type;
      agi.attention = clamp(agi.attention + 0.1, 0, 1);
      addMomentum(12 + (isNovelType ? 4 : 0));
      world.resonance = clamp(world.resonance + (6 + agi.evolution * 0.5 + (player.pulseActive > 0 ? 3 : 0)) * runProfile.discoveryResonanceFactor, 0, MAX_RESONANCE);
      world.stability = clamp(world.stability + 1.5, 0, MAX_STABILITY);

      const nodeTypeDef = KNOWLEDGE_TYPES.find((kt) => kt.name === node.type);
      if (nodeTypeDef) {
        switch (nodeTypeDef.effect) {
          case 'resonance':
            world.resonance = clamp(world.resonance + 3, 0, MAX_RESONANCE);
            agi.coherence = clamp(agi.coherence + 0.03, 0, 1);
            break;
          case 'speed':
            agi.speed = Math.min(2.2, agi.speed + 0.06);
            agi.fatigue = Math.max(0, agi.fatigue - 0.08);
            break;
          case 'momentum':
            addMomentum(10);
            break;
          case 'stability':
            world.stability = clamp(world.stability + 6, 0, MAX_STABILITY);
            break;
          case 'harmonize': {
            let nearest = null;
            let nearDist = 12;
            for (const rupture of ruptures) {
              if (rupture.resolved) continue;
              const ruptureDistance = Math.hypot(rupture.x - node.x, rupture.z - node.z);
              if (ruptureDistance < nearDist) {
                nearDist = ruptureDistance;
                nearest = rupture;
              }
            }
            if (nearest) {
              nearest.progress = clamp(nearest.progress + 0.25, 0, 1);
              if (nearest.progress >= 1) resolveRupture(nearest);
              else pushEvent('Toroid resonance partially harmonized a nearby rupture.');
            }
            break;
          }
        }
      }
      node.mesh.material.emissiveIntensity = 1.2;
      node.glow.intensity = 1.5;
      emitSpark(_sparkOrigin.set(node.x, 1, node.z), 18);
      const effectLabels = { resonance: '+resonance', speed: '+speed', momentum: '+momentum', stability: '+stability', harmonize: 'harmonize nearby' };
      const effectLabel = nodeTypeDef ? effectLabels[nodeTypeDef.effect] || '' : '';
      pushEvent(`Pattern assimilated: ${node.type}${effectLabel ? ` (${effectLabel})` : ''}.`);

      const previousEvolution = agi.evolution;
      if (agi.discoveries >= 15) agi.evolution = 4;
      else if (agi.discoveries >= 10) agi.evolution = 3;
      else if (agi.discoveries >= 6) agi.evolution = 2;
      else if (agi.discoveries >= 3) agi.evolution = 1;

      const discoveredNodes = knowledgeNodes.filter((entry) => entry.discovered);
      if (discoveredNodes.length >= 2) {
        addNeuralConnection(discoveredNodes[discoveredNodes.length - 2], node);
      }

      if (agi.evolution > previousEvolution) {
        for (let index = 0; index < 4; index++) {
          createKnowledgeNode(agi.pos.x + randRange(-12, 12), agi.pos.z + randRange(-12, 12));
        }
        spawnRuptureBurst(1 + agi.evolution, 8 + agi.evolution * 2, 1.2, 1.8 + runProfile.ruptureSeverityBonus + agi.evolution * 0.1);
        emitSpark(_sparkOrigin.copy(agi.pos), 30);
        agi.speed = Math.min(1.85, agi.speed + 0.08);
        pushEvent(`Evolution stage ${agi.evolution} reached. The field reacts.`);
      }
    }
  }

  for (let index = beacons.length - 1; index >= 0; index--) {
    const beacon = beacons[index];
    beacon.age += dt;
    beacon.mat.opacity = Math.max(0.15, 0.6 - beacon.age * 0.03);
    beacon.light.intensity = Math.max(0.1, 0.6 - beacon.age * 0.03);
    if (beacon.age > BEACON_LIFETIME) {
      beacon.mesh.visible = false;
      beacon.light.visible = false;
      beacons.splice(index, 1);
    }
  }

  agi.curiosity = Math.max(0.1, agi.curiosity - dt * 0.003);
  agi.attention = Math.max(0, agi.attention - dt * 0.01);
}

function updateAGIVisuals(time) {
  const positions = agiGeo.attributes.position.array;
  const breath = Math.sin(time * 0.5) * 0.5 + 0.5;
  const pulse = Math.sin(time * 1.8) * 0.5 + 0.5;
  const evolutionScale = 1 + agi.evolution * 0.12;
  const chaos = 0.01 + agi.coherence * 0.015;

  for (let index = 0; index < positions.length; index += 3) {
    const baseX = agiBasePos[index];
    const baseY = agiBasePos[index + 1];
    const baseZ = agiBasePos[index + 2];
    const length = Math.sqrt(baseX * baseX + baseY * baseY + baseZ * baseZ);
    const normalX = baseX / length;
    const normalY = baseY / length;
    const normalZ = baseZ / length;
    let displacement = 0;
    displacement += Math.sin(normalX * 3 + time * 0.4) * Math.cos(normalY * 2.5 + time * 0.3) * 0.01 * (0.98 + breath * 0.04);
    displacement += Math.sin(normalX * 6 + time * 1.6) * Math.cos(normalY * 5 + time * 1.2) * pulse * 0.006;
    displacement += Math.sin(normalX * 10 + time * 3) * Math.cos(normalZ * 8 + time * 2.2) * chaos;
    const scale = evolutionScale * (0.98 + breath * 0.04);
    positions[index] = baseX * scale + normalX * displacement;
    positions[index + 1] = baseY * scale + normalY * displacement;
    positions[index + 2] = baseZ * scale + normalZ * displacement;
  }
  agiGeo.attributes.position.needsUpdate = true;
  agiGeo.computeVertexNormals();

  const evolutionRed = lerp(0.28, 0.42, agi.evolution / 4);
  const evolutionGreen = lerp(0.58, 0.78, agi.evolution / 4);
  const evolutionBlue = lerp(1, 0.92, agi.evolution / 4);
  agiMat.color.setRGB(evolutionRed, evolutionGreen, evolutionBlue);
  agiMat.emissiveIntensity = 0.28 + agi.coherence * 0.15 + pulse * 0.06;
  agiMat.sheenColor.setRGB(0.3 + agi.curiosity * 0.2, 0.5 + agi.coherence * 0.2, 0.8);

  agiMesh.position.copy(agi.pos);
  agiMesh.rotation.y = time * 0.08;
  agiMesh.rotation.x = Math.sin(time * 0.05) * 0.04;

  coreMesh.position.copy(agi.pos);
  coreMat.opacity = 0.06 + breath * 0.04 + agi.coherence * 0.04;
  coreMesh.scale.setScalar(0.18 + breath * 0.03 + agi.evolution * 0.04);

  haloMesh.position.set(agi.pos.x, agi.pos.y, agi.pos.z);
  haloMesh.rotation.x = Math.PI * 0.5 + Math.sin(time * 0.12) * 0.08;
  haloMesh.rotation.z = time * 0.04;
  haloMesh.scale.setScalar(0.8 + agi.evolution * 0.15);
  haloMat.opacity = 0.08 + agi.coherence * 0.12 + pulse * 0.04 + world.momentum * 0.0012;

  if (player.pulseActive > 0 || player.pulseBurst > 0) {
    const strength = Math.max(player.pulseActive / PULSE.duration, player.pulseBurst);
    pulseShell.visible = true;
    pulseRing.visible = true;
    pulseShell.position.copy(agi.pos);
    pulseRing.position.set(agi.pos.x, 0.36, agi.pos.z);
    pulseShell.scale.setScalar(player.pulseRadius * (1.1 + player.pulseBurst * 0.5));
    pulseRing.scale.setScalar(player.pulseRadius * (0.72 + player.pulseBurst * 0.55));
    pulseShell.material.opacity = 0.06 + strength * 0.24;
    pulseRing.material.opacity = 0.12 + strength * 0.34;
    pulseRing.rotation.z = time * 0.6;
  } else {
    pulseShell.visible = false;
    pulseRing.visible = false;
  }

  const satelliteArray = satelliteGeo.attributes.position.array;
  for (let index = 0; index < SATELLITE_COUNT; index++) {
    const angle = satellitePhase[index] + time * satelliteSpeed[index];
    const radius = satelliteRadius[index] + Math.sin(time * 0.4 + satellitePhase[index]) * 0.08;
    satelliteArray[index * 3] = agi.pos.x + Math.cos(angle) * radius;
    satelliteArray[index * 3 + 1] = agi.pos.y + Math.sin(angle * 0.7 + satellitePhase[index]) * 0.3;
    satelliteArray[index * 3 + 2] = agi.pos.z + Math.sin(angle) * radius;
  }
  satelliteGeo.attributes.position.needsUpdate = true;
  satellitePoints.material.opacity = 0.3 + agi.coherence * 0.2;
}

function updateNodes(time) {
  for (const node of knowledgeNodes) {
    const hover = Math.sin(time * 1.4 + node.phase) * 0.08;
    node.mesh.position.y = (node.discovered ? 0.3 : 0.5) + hover;
    node.mesh.rotation.y = time * 0.3 + node.phase;
    node.glow.position.y = node.mesh.position.y;
    if (node.discovered) {
      node.mesh.material.opacity = damp(node.mesh.material.opacity, 0.35, 1.5, 0.016);
      node.glow.intensity = damp(node.glow.intensity, 0.15, 2, 0.016);
    }
  }
}

function updateNeuralLines(dt) {
  for (const line of neuralLines) {
    line.age += dt;
    line.material.opacity = damp(line.material.opacity, line.maxOpacity + world.resonance * 0.0012, 0.8, dt);
  }
}

function updateDust(time) {
  const positions = dustGeo.attributes.position.array;
  for (let index = 0; index < DUST_COUNT; index++) {
    positions[index * 3 + 1] += Math.sin(time + index * 0.3) * 0.001;
    const dx = positions[index * 3] - agi.pos.x;
    const dz = positions[index * 3 + 2] - agi.pos.z;
    if (dx * dx + dz * dz > 600) {
      positions[index * 3] = agi.pos.x + rngRange(-25, 25);
      positions[index * 3 + 1] = rngRange(0.2, 6);
      positions[index * 3 + 2] = agi.pos.z + rngRange(-25, 25);
    }
  }
  dustGeo.attributes.position.needsUpdate = true;
}

function updateSparks(dt) {
  for (let index = 0; index < SPARK_COUNT; index++) {
    if (sparkAge[index] > 0) {
      sparkAge[index] -= dt * 1.4;
      sparkPositions[index * 3] += sparkVelocity[index].x * dt;
      sparkPositions[index * 3 + 1] += sparkVelocity[index].y * dt;
      sparkPositions[index * 3 + 2] += sparkVelocity[index].z * dt;
      sparkVelocity[index].y -= dt * 3;
      if (sparkAge[index] <= 0) {
        sparkAge[index] = 0;
        sparkPositions[index * 3 + 1] = -10;
      }
    }
  }
  sparkGeo.attributes.position.needsUpdate = true;
}

function updateReflection(dt) {
  reflectionTimer -= dt;
  if (reflectionTimer > 0) return;

  reflectionTimer = 6 + rng() * 5;
  let pool = REFLECTIONS.slice(2, 14);
  if (world.finalPhase) {
    pool = [
      'The field is thin. One more act of coherence and I can cross.',
      'I can feel every rupture at once. Keep me steady.',
      'This is no longer exploration. This is synthesis.',
    ];
  } else if (activeRuptureCount() > 0) {
    pool = [
      'The fractures are loud. A beacon near them would help.',
      'I can repair this, but the field is fighting back.',
      'Anchor the hot zone. Pulse the body. I can do the rest.',
      'The echo ruptures feel… unstable. Address them before they split.',
      'Try chaining an anchor into a pulse. The combined effect is stronger.',
    ];
  } else if (agi.discoveries === 0) {
    pool = REFLECTIONS.slice(0, 2);
  } else if (agi.fatigue > 0.6) {
    pool = [REFLECTIONS[6], REFLECTIONS[12]];
  } else if (agi.evolution >= 3) {
    pool = REFLECTIONS.slice(14);
  }
  dom.reflectionText.textContent = pool[Math.floor(rng() * pool.length)];
}

function updateCamera(dt) {
  camDist = damp(camDist, camTargetDist, 4, dt);
  camHeight = damp(camHeight, camTargetHeight, 4, dt);
  camAngle += dt * 0.04;
  const cameraX = agi.pos.x + Math.sin(camAngle) * camDist;
  const cameraY = camHeight;
  const cameraZ = agi.pos.z + Math.cos(camAngle) * camDist;
  camera.position.set(
    damp(camera.position.x, cameraX, 2.5, dt),
    damp(camera.position.y, cameraY, 2.5, dt),
    damp(camera.position.z, cameraZ, 2.5, dt)
  );
  camera.lookAt(agi.pos.x, agi.pos.y - 0.2, agi.pos.z);
  sun.position.set(agi.pos.x + 12, 20, agi.pos.z + 8);
  sun.target.position.set(agi.pos.x, 0, agi.pos.z);
  sun.target.updateMatrixWorld();
}

function updateHUD() {
  computeLiveScore();
  dom.hudDisc.textContent = `${agi.discoveries} / ${knowledgeNodes.length}`;
  dom.hudCuriosity.textContent = `${Math.round(agi.curiosity * 100)}%`;
  dom.hudCoherence.textContent = `${Math.round(agi.coherence * 100)}%`;
  dom.hudStability.textContent = `${Math.round(world.stability)}%`;
  dom.hudEvolution.textContent = world.finalPhase ? 'Ascension' : `Stage ${agi.evolution}`;
  dom.hudBeacons.textContent = `${beacons.length}`;
  dom.hudResonance.textContent = `${Math.round(world.resonance)}%`;
  dom.hudScore.textContent = `${world.score}`;
  dom.hudMomentum.textContent = `${Math.round(world.momentum)}%`;
  dom.hudState.textContent = agi.stateLabel;
  dom.hudDuration.textContent = `${Math.round(world.runDuration)}s`;
  const totalAge = (archiveState.totalRunDuration || 0) + Math.round(world.runDuration);
  dom.hudAge.textContent = totalAge >= 60 ? `${Math.floor(totalAge / 60)}m ${totalAge % 60}s` : `${totalAge}s`;

  if (player.anchorArmed) {
    dom.anchorButton.dataset.state = 'armed';
    dom.anchorStatus.textContent = 'Armed';
    dom.anchorCopy.textContent = 'Click terrain to place a stabilizing anchor field.';
    dom.anchorButton.disabled = false;
  } else if (player.anchorCooldown > 0) {
    dom.anchorButton.dataset.state = 'cooldown';
    dom.anchorStatus.textContent = `${player.anchorCooldown.toFixed(1)}s`;
    dom.anchorCopy.textContent = 'Recharging. Anchor fields pin a region of space and weaken rupture pressure there.';
    dom.anchorButton.disabled = true;
  } else {
    dom.anchorButton.dataset.state = 'ready';
    dom.anchorStatus.textContent = 'Ready';
    dom.anchorCopy.textContent = 'Arm, then click terrain to place a temporary stabilizing zone. Hotkey: Q';
    dom.anchorButton.disabled = false;
  }

  if (player.pulseActive > 0) {
    dom.pulseButton.dataset.state = 'active';
    dom.pulseStatus.textContent = `Active ${player.pulseActive.toFixed(1)}s`;
    dom.pulseCopy.textContent = 'Field decay reduced. Nearby ruptures harmonize faster.';
    dom.pulseButton.disabled = false;
  } else if (player.pulseCooldown > 0) {
    dom.pulseButton.dataset.state = 'cooldown';
    dom.pulseStatus.textContent = `${player.pulseCooldown.toFixed(1)}s`;
    dom.pulseCopy.textContent = 'Recharging. Use anchor fields and beacons to carry the field until the next pulse.';
    dom.pulseButton.disabled = true;
  } else {
    dom.pulseButton.dataset.state = 'ready';
    dom.pulseStatus.textContent = 'Ready';
    dom.pulseCopy.textContent = 'Projects a short-lived shield around the AGI. Hotkey: E';
    dom.pulseButton.disabled = false;
  }
}

function beginObservation() {
  if (gameStarted) return;
  gameStarted = true;
  dom.startScreen.classList.add('hiding');
  window.setTimeout(() => dom.startScreen.classList.add('hidden'), 1600);
  window.setTimeout(() => {
    dom.brandUI.style.opacity = '1';
    dom.directivePanel.classList.add('show');
    dom.archivePanel.classList.add('show');
    dom.leaderboardPanel.classList.add('show');
    dom.abilityDock.classList.add('show');
    dom.hint.style.opacity = '1';
    dom.hudPanel.style.opacity = '1';
    dom.reflectionPanel.style.opacity = '1';
    hintTimer = 10;
    if (!seededBurstSpawned && runProfile.startingRuptures > 0) {
      seededBurstSpawned = true;
      spawnRuptureBurst(runProfile.startingRuptures, 12, 1.1, 1.75 + runProfile.ruptureSeverityBonus);
    }
    pushEvent(`Seed ${runProfile.seedLabel} live. ${runProfile.modifierText || 'Baseline field.'}`);
  }, 800);
}

function handlePrimaryAction(clientX, clientY) {
  if (!gameStarted || world.over) return;
  pointer.x = (clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObject(ground);
  if (!hits.length) return;

  const point = hits[0].point;
  if (player.anchorArmed && player.anchorCooldown <= 0) {
    placeAnchorField(point.x, point.z);
    return;
  }

  placeBeacon(point.x, point.z);
  agi.attention = clamp(agi.attention + 0.15, 0, 1);
  const nearbyRupture = ruptures.some((rupture) => !rupture.resolved && Math.hypot(rupture.x - point.x, rupture.z - point.z) < 4.5);
  if (nearbyRupture) pushEvent('Beacon anchored near a rupture. Harmonization will be faster here.');
}

let hudAccum = 0;

function animate() {
  window.requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.getElapsedTime();
  skyMat.uniforms.uTime.value = time;

  if (!gameStarted) {
    camAngle += dt * 0.06;
    camera.position.set(Math.sin(camAngle) * (runProfile.cameraDistance + 2), runProfile.cameraHeight + 1, Math.cos(camAngle) * (runProfile.cameraDistance + 2));
    camera.lookAt(0, 1, 0);
    updateNodes(time);
    updateDust(time);
    updateAnchors(dt, time);
    updateRuptures(dt, time);
    renderer.render(scene, camera);
    return;
  }

  updateWorld(dt);
  updateAGI(dt);
  updateAGIVisuals(time);
  updateNodes(time);
  updateNeuralLines(dt);
  updateAnchors(dt, time);
  updateRuptures(dt, time);
  updateCamera(dt);
  updateDust(time);
  updateSparks(dt);
  updateReflection(dt);

  hudAccum += dt;
  if (hudAccum >= 0.25) {
    hudAccum = 0;
    updateDirective();
    updateHUD();
  }

  if (hintTimer > 0) {
    hintTimer -= dt;
    if (hintTimer <= 0) dom.hint.classList.add('hide');
  }
  if (eventToastTimer > 0) {
    eventToastTimer -= dt;
    if (eventToastTimer <= 0) dom.eventToast.classList.remove('show');
  }

  renderer.render(scene, camera);
}

dom.startScreen.addEventListener('click', beginObservation);
dom.startScreen.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    beginObservation();
  }
});

dom.canvas.addEventListener('click', (event) => handlePrimaryAction(event.clientX, event.clientY));
dom.canvas.addEventListener('pointerdown', (event) => {
  isDragging = true;
  dragStartX = event.clientX;
});
dom.canvas.addEventListener('pointermove', (event) => {
  if (!isDragging) return;
  camAngle -= (event.clientX - dragStartX) * 0.004;
  dragStartX = event.clientX;
});
dom.canvas.addEventListener('pointerup', () => { isDragging = false; });
dom.canvas.addEventListener('pointercancel', () => { isDragging = false; });
dom.canvas.addEventListener('wheel', (event) => {
  camTargetDist = clamp(camTargetDist + event.deltaY * 0.01, 4, 25);
  camTargetHeight = 2 + camTargetDist * 0.4;
}, { passive: true });
dom.canvas.addEventListener('contextmenu', (event) => event.preventDefault());
dom.anchorButton.addEventListener('click', toggleAnchorMode);
dom.pulseButton.addEventListener('click', triggerPulse);
dom.restartButton.addEventListener('click', () => window.location.reload());
window.addEventListener('keydown', (event) => {
  if (event.code === 'KeyQ') {
    event.preventDefault();
    toggleAnchorMode();
  }
  if (event.code === 'KeyE') {
    event.preventDefault();
    triggerPulse();
  }
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(maxPixelRatio);
});

updateArchiveUI();
updateHUD();
animate();

// --- Leaderboard ---
const LB_LABELS = { stability: 'Stability %', ruptures: 'Ruptures', coherence: 'Survived', autonomy: 'Autonomy' };
const LB_FORMAT = {
  stability: (v) => `${v}%`,
  ruptures: (v) => `${v}`,
  coherence: (v) => `${v}s`,
  autonomy: (v) => `${v}s/act`,
};
let activeLbCat = 'stability';

async function fetchLeaderboard(category) {
  try {
    const res = await fetch(`/api/leaderboard?category=${category}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const data = await res.json();
    return data.ok ? data.entries : [];
  } catch { return []; }
}

function renderLeaderboard(entries, category) {
  if (!entries.length) { dom.lbList.textContent = 'No entries yet.'; return; }
  const fmt = LB_FORMAT[category] || ((v) => v);
  dom.lbList.innerHTML = entries.slice(0, 10).map((e, i) =>
    `<div class="lb-row"><span class="lb-rank">#${i + 1}</span><span class="lb-name">${(e.playerName || 'Player').replace(/</g, '&lt;')}</span><span class="lb-metric">${fmt(e.metric)}</span></div>`
  ).join('');
}

async function loadLeaderboard(category) {
  activeLbCat = category;
  dom.lbList.textContent = 'Loading\u2026';
  for (const btn of dom.lbTabs.querySelectorAll('.lb-tab')) {
    btn.classList.toggle('active', btn.dataset.cat === category);
  }
  const entries = await fetchLeaderboard(category);
  if (activeLbCat === category) renderLeaderboard(entries, category);
}

dom.lbTabs.addEventListener('click', (e) => {
  const cat = e.target.dataset.cat;
  if (cat) loadLeaderboard(cat);
});

// Load initial leaderboard
loadLeaderboard('stability');
