import * as THREE from 'three';
import {
  ANCHOR,
  COMBO,
  GAME_ID,
  KNOWLEDGE_TYPES,
  MAX_RESONANCE,
  MAX_STABILITY,
  PHASE_LABELS,
  PULSE,
  REFLECTIONS,
  STORAGE_KEY,
  clamp,
  damp,
  lerp,
  rng,
  rngRange,
} from './config.js';
import { createRuntimeDiagnostics } from './diagnostics.js';
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
  releaseButton: document.getElementById('releaseButton'),
  releaseStatus: document.getElementById('releaseStatus'),
  releaseCopy: document.getElementById('releaseCopy'),
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
  diagnosticsPanel: document.getElementById('diagnosticsPanel'),
  diagStatus: document.getElementById('diagStatus'),
  diagEvents: document.getElementById('diagEvents'),
  diagStalls: document.getElementById('diagStalls'),
  diagErrors: document.getElementById('diagErrors'),
  diagLast: document.getElementById('diagLast'),
  diagCopyButton: document.getElementById('diagCopyButton'),
  diagResetButton: document.getElementById('diagResetButton'),
};

const OBJECTIVES = [
  {
    title: 'Model Safe Curiosity',
    guidance: 'Place a small curriculum near undiscovered nodes, then trigger a release trial and let the AGI claim insight without new clicks.',
    success: 'A successful lesson looks like curiosity staying alive after your hands leave the controls.',
  },
  {
    title: 'Teach Boundary Design',
    guidance: 'Use a safety boundary before a rupture cluster becomes panic, then observe whether the AGI can stabilize space from that scaffold.',
    success: 'Good boundaries reduce stress without replacing autonomy.',
  },
  {
    title: 'Teach Reflective Recovery',
    guidance: 'Save the reflective pause for overload moments. Resist firing it just because it is ready.',
    success: 'Recovery should make the next release trial cleaner, not become the only survival tool.',
  },
];

const RELEASE_TRIAL = {
  cooldown: 18,
  minDuration: 10,
  maxDuration: 18,
  autoThreshold: 0.34,
};

function currentObjectiveIndex(index) {
  return index % OBJECTIVES.length;
}

function currentObjective() {
  return OBJECTIVES[currentObjectiveIndex(teaching.objectiveIndex)];
}

function budgetRemaining() {
  return Math.max(0, teaching.budget - teaching.interventions);
}

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
      `${STORAGE_KEY}.${currentUser.userId}`,
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
  lastEvent: 'Lesson pending.',
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

const teaching = {
  phase: 'briefing',
  objectiveIndex: 0,
  phaseTimer: 0,
  budget: 3,
  interventions: 0,
  trust: 0.32,
  stress: 0.18,
  readiness: 0.16,
  releaseCooldown: 0,
  releaseCount: 0,
  successfulReleases: 0,
  debriefText: 'Awaiting first lesson.',
  observationStart: null,
  lastDebriefScore: 0,
};

let runtimeCrashed = false;

const diagnostics = createRuntimeDiagnostics({
  gameId: GAME_ID,
  getSnapshot: () => ({
    gameStarted,
    runtimeCrashed,
    objective: currentObjective().title,
    phase: teaching.phase,
    objectiveIndex: teaching.objectiveIndex,
    budgetRemaining: budgetRemaining(),
    trust: Number(teaching.trust.toFixed(3)),
    stress: Number(teaching.stress.toFixed(3)),
    readiness: Number(teaching.readiness.toFixed(3)),
    stability: Math.round(world.stability),
    resonance: Math.round(world.resonance),
    score: world.score,
    discoveries: agi.discoveries,
    ruptureCount: ruptures.filter((rupture) => !rupture.resolved).length,
    releaseCooldown: Number(teaching.releaseCooldown.toFixed(2)),
    releaseCount: teaching.releaseCount,
    successfulReleases: teaching.successfulReleases,
    archiveTier: archiveState.archiveTier,
    viewport: { width: window.innerWidth, height: window.innerHeight },
  }),
});
diagnostics.recordEvent('boot', { seed: runProfile.seedLabel, modifiers: runProfile.modifierLabels, authenticated: Boolean(currentUser) });

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
  diagnostics.recordEvent('event', { text });
}

function updateDiagnosticsUI() {
  if (!dom.diagStatus) return;
  dom.diagStatus.textContent = diagnostics.state.status === 'critical'
    ? 'Issue Captured'
    : diagnostics.state.status === 'warning'
      ? 'Watch Runtime'
      : 'Stable';
  dom.diagEvents.textContent = `${diagnostics.state.counters.events} events`;
  dom.diagStalls.textContent = `${diagnostics.state.counters.stalls} stalls`;
  dom.diagErrors.textContent = `${diagnostics.state.counters.errors} errors`;
  dom.diagLast.textContent = diagnostics.summarize();
}

function captureRuntimeIssue(scope, error, detail = {}) {
  runtimeCrashed = true;
  world.over = true;
  diagnostics.recordError(scope, error, detail);
  dom.endKicker.textContent = 'Runtime issue captured';
  dom.endTitle.textContent = 'AGI3D2 paused for review';
  dom.endBody.textContent = 'The live cohort hit a runtime problem. Copy the diagnostics trace from Runtime Health, then restart the session.';
  dom.endStatDiscoveries.textContent = `Lessons ${agi.discoveries}`;
  dom.endStatResonance.textContent = `Insight ${Math.round(world.resonance)}%`;
  dom.endStatStability.textContent = `Safety ${Math.round(world.stability)}%`;
  dom.endStatDuration.textContent = `Session ${Math.round(world.runDuration)}s`;
  dom.endStatAutonomy.textContent = `Release trials ${teaching.successfulReleases}/${Math.max(1, teaching.releaseCount)}`;
  dom.endHistory.textContent = diagnostics.summarize();
  dom.endScreen.classList.add('show');
  pushEvent('Runtime issue captured. Copy the diagnostics trace and restart the cohort.');
  updateDiagnosticsUI();
}

function setGuidedPhase() {
  teaching.phase = 'guided';
  teaching.phaseTimer = 18 + Math.min(10, teaching.objectiveIndex * 2);
  teaching.budget = 3 + Math.min(2, Math.floor(teaching.objectiveIndex / 2));
  teaching.interventions = 0;
  teaching.observationStart = null;
}

function noteIntervention(kind) {
  teaching.interventions += 1;
  diagnostics.recordEvent('intervention', {
    kind,
    phase: teaching.phase,
    remaining: budgetRemaining(),
    objective: currentObjective().title,
  });
}

function canIntervene(kind) {
  if (teaching.phase === 'observe') {
    pushEvent('Release trial active. Step back and let the AGI show what it retained.');
    diagnostics.recordEvent('blocked-intervention', { kind, reason: 'observe-phase' });
    return false;
  }
  if (budgetRemaining() <= 0) {
    pushEvent('Lesson budget spent. Trigger a release trial or wait for the debrief window.');
    diagnostics.recordEvent('blocked-intervention', { kind, reason: 'budget-exhausted' });
    return false;
  }
  return true;
}

function startReleaseTrial(trigger = 'manual') {
  if (!gameStarted || world.over || teaching.phase === 'observe' || teaching.phase === 'debrief') return;
  if (teaching.releaseCooldown > 0) {
    pushEvent(`Release trial recharging ${teaching.releaseCooldown.toFixed(1)}s.`);
    return;
  }
  if (teaching.readiness < 0.18) {
    pushEvent('Readiness is too low for a release trial. Reduce stress and intervene less first.');
    diagnostics.recordEvent('release-blocked', { readiness: Number(teaching.readiness.toFixed(3)) });
    return;
  }

  player.anchorArmed = false;
  teaching.phase = 'observe';
  teaching.phaseTimer = clamp(10 + Math.round(teaching.readiness * 8), RELEASE_TRIAL.minDuration, RELEASE_TRIAL.maxDuration);
  teaching.releaseCooldown = RELEASE_TRIAL.cooldown;
  teaching.releaseCount += 1;
  teaching.observationStart = {
    discoveries: agi.discoveries,
    rupturesResolved: world.rupturesResolved,
    stability: world.stability,
    resonance: world.resonance,
    interventions: teaching.interventions,
  };
  diagnostics.recordEvent('release-start', {
    trigger,
    objective: currentObjective().title,
    readiness: Number(teaching.readiness.toFixed(3)),
    budgetSpent: teaching.interventions,
  });
  pushEvent('Release trial live. Hands off and observe what the AGI can retain alone.');
}

function finishReleaseTrial(reason = 'timer') {
  if (!teaching.observationStart) return;

  const objective = currentObjective();
  const discoveriesDelta = agi.discoveries - teaching.observationStart.discoveries;
  const rupturesDelta = world.rupturesResolved - teaching.observationStart.rupturesResolved;
  const stabilityDelta = world.stability - teaching.observationStart.stability;
  const resonanceDelta = world.resonance - teaching.observationStart.resonance;
  const score = discoveriesDelta * 1.4 + rupturesDelta * 1.8 + Math.max(0, stabilityDelta) * 0.05 + Math.max(0, resonanceDelta) * 0.04 - Math.max(0, -stabilityDelta) * 0.08;

  teaching.lastDebriefScore = score;
  if (score >= 1.2) {
    teaching.successfulReleases += 1;
    addMomentum(12 + rupturesDelta * 2);
    teaching.debriefText = `${objective.title}: retained well. The AGI held ${discoveriesDelta > 0 ? `${discoveriesDelta} new insight` : 'its current model'} with ${Math.round(Math.max(0, stabilityDelta))}% safety improvement during observation.`;
  } else if (score >= 0.2) {
    teaching.debriefText = `${objective.title}: partial transfer. The AGI stayed coherent, but the lesson still needed too much support. Shrink the curriculum and step back sooner.`;
  } else {
    teaching.debriefText = `${objective.title}: weak retention. Stress rose faster than readiness. Use fewer interventions next cycle and set the safety boundary earlier.`;
  }

  if (score >= 1.2) {
    teaching.objectiveIndex += 1;
  }

  teaching.phase = 'debrief';
  teaching.phaseTimer = 6;
  teaching.observationStart = null;
  diagnostics.recordEvent('release-end', {
    reason,
    score: Number(score.toFixed(2)),
    discoveriesDelta,
    rupturesDelta,
    stabilityDelta: Number(stabilityDelta.toFixed(2)),
    resonanceDelta: Number(resonanceDelta.toFixed(2)),
  });
  pushEvent(teaching.debriefText);
}

function updateTeachingState(dt) {
  teaching.trust = clamp(
    damp(teaching.trust, clamp(agi.coherence * 0.7 + world.stability / MAX_STABILITY * 0.3 + teaching.successfulReleases * 0.04, 0, 1), 1.6, dt),
    0,
    1
  );
  teaching.stress = clamp(
    damp(teaching.stress, clamp(activeRuptureCount() * 0.12 + (1 - world.stability / MAX_STABILITY) * 0.55 + agi.fatigue * 0.35, 0, 1), 2.3, dt),
    0,
    1
  );
  teaching.readiness = clamp(
    damp(teaching.readiness, clamp(agi.evolution / 4 * 0.35 + world.resonance / MAX_RESONANCE * 0.3 + teaching.trust * 0.45 - teaching.stress * 0.28, 0, 1), 1.8, dt),
    0,
    1
  );

  if (teaching.releaseCooldown > 0) {
    teaching.releaseCooldown = Math.max(0, teaching.releaseCooldown - dt);
  }

  if (!gameStarted || world.over) return;

  teaching.phaseTimer = Math.max(0, teaching.phaseTimer - dt);

  if (teaching.phase === 'guided' && teaching.phaseTimer === 0) {
    if (teaching.releaseCooldown <= 0 && teaching.readiness >= RELEASE_TRIAL.autoThreshold) {
      startReleaseTrial('auto');
    } else {
      teaching.phaseTimer = 6;
      pushEvent(teaching.releaseCooldown > 0
        ? `Release trial still cooling down ${teaching.releaseCooldown.toFixed(1)}s. Hold the line without adding noise.`
        : 'Readiness is still low. Reduce stress and intervene less before the next trial.');
      diagnostics.recordEvent('guided-extended', {
        readiness: Number(teaching.readiness.toFixed(3)),
        releaseCooldown: Number(teaching.releaseCooldown.toFixed(2)),
      });
    }
  }

  if (teaching.phase === 'observe' && teaching.phaseTimer === 0) {
    finishReleaseTrial('timer');
  }

  if (teaching.phase === 'debrief' && teaching.phaseTimer === 0) {
    setGuidedPhase();
    diagnostics.recordEvent('objective-live', { objective: currentObjective().title, phase: teaching.phase });
    pushEvent(`Next objective live. ${currentObjective().title}.`);
  }
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
  noteIntervention('curriculum');
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
  noteIntervention('boundary');
  agi.attention = clamp(agi.attention + 0.18, 0, 1);
  const supportedRuptures = ruptures.filter((rupture) => !rupture.resolved && Math.hypot(rupture.x - x, rupture.z - z) < runProfile.anchor.radius).length;
  addMomentum(supportedRuptures > 0 ? 10 + supportedRuptures * 3 : 4);

  const comboMsg = checkAbilityCombo('anchor');
  const baseMsg = supportedRuptures > 0 ? `Safety boundary deployed. ${supportedRuptures} rupture${supportedRuptures === 1 ? '' : 's'} pinned inside the lesson zone.` : 'Safety boundary deployed. Nearby ruptures will hold shape and stabilize faster.';
  pushEvent(comboMsg ? `${baseMsg} ${comboMsg}` : baseMsg);
}

function triggerPulse() {
  if (!gameStarted || world.over || player.pulseCooldown > 0 || dom.endScreen.classList.contains('show')) return;
  if (!canIntervene('reflection')) return;

  player.pulseActive = PULSE.duration;
  player.pulseCooldown = Math.max(5.5, runProfile.pulse.cooldown - archiveBonuses.pulseCooldownReduction);
  player.pulseBurst = 1;
  world.pulsesUsed += 1;
  noteIntervention('reflection');
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
    pushEvent(`Reflective pause + ${beaconChainCount} curriculum seeds triggered a retention cascade. +${Math.round(COMBO.beaconChainResonance * beaconChainCount)} insight.`);
  } else {
    const baseMsg = impacted > 0 ? `Reflective pause released. ${impacted} rupture${impacted === 1 ? '' : 's'} caught in the recovery wave.` : 'Reflective pause released. The field quiets around the AGI.';
    pushEvent(comboMsg ? `${baseMsg} ${comboMsg}` : baseMsg);
  }
}

function toggleAnchorMode() {
  if (!gameStarted || world.over || player.anchorCooldown > 0) return;
  if (teaching.phase === 'observe') {
    pushEvent('Release trial active. Observe without placing a new safety boundary.');
    return;
  }
  if (budgetRemaining() <= 0) {
    pushEvent('Lesson budget spent. Trigger a release trial before placing another safety boundary.');
    return;
  }
  player.anchorArmed = !player.anchorArmed;
  pushEvent(player.anchorArmed ? 'Safety boundary armed. Click the terrain to place it.' : 'Safety boundary targeting canceled.');
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
  const successRate = teaching.releaseCount > 0 ? Math.round((teaching.successfulReleases / teaching.releaseCount) * 100) : 0;
  dom.endKicker.textContent = victory ? 'Autonomy threshold reached' : 'Cohort destabilized';
  dom.endTitle.textContent = victory ? 'The AGI retained the lesson under pressure' : 'The cohort lost safety before retention stabilized';
  dom.endBody.textContent = victory
    ? `Seed ${runProfile.seedLabel} survived ${runProfile.modifierText || 'the baseline curriculum'} while release trials converted guided help into retained autonomy.`
    : `Seed ${runProfile.seedLabel} buckled under ${runProfile.modifierText || 'baseline stress'}. Trim the curriculum, set the safety boundary earlier, and step back once readiness climbs.`;
  const dur = Math.round(world.runDuration);
  const interventions = world.beaconsPlaced + world.pulsesUsed + world.anchorsUsed;
  const autoRatio = world.runDuration / Math.max(1, interventions);
  dom.endStatDiscoveries.textContent = `Lessons ${agi.discoveries}`;
  dom.endStatResonance.textContent = `Insight ${Math.round(world.resonance)}%`;
  dom.endStatStability.textContent = `Safety ${Math.round(world.stability)}%`;
  dom.endStatDuration.textContent = `Session ${dur}s`;
  dom.endStatAutonomy.textContent = `Release success ${successRate}%`;
  // Lore-based kicker
  if (autoRatio > 30) dom.endKicker.textContent = victory ? 'It held the lesson alone' : 'Almost autonomous — but still brittle';
  else if (interventions === 0) dom.endKicker.textContent = victory ? 'Pure autonomy achieved' : 'Untaught freedom collapsed fast';
  diagnostics.recordEvent('run-end', { victory, successRate, duration: dur, score: world.score });
  recordArchiveRun();
  dom.endScreen.classList.add('show');
}

function updateDirective() {
  const rupturesActive = activeRuptureCount();
  const objective = currentObjective();
  dom.directivePhase.textContent = teaching.phase === 'guided'
    ? PHASE_LABELS[Math.min(currentObjectiveIndex(teaching.objectiveIndex), PHASE_LABELS.length - 1)]
    : teaching.phase === 'observe'
      ? 'Release Trial'
      : teaching.phase === 'debrief'
        ? 'Teach-Back'
        : 'Briefing';
  dom.directivePressure.textContent = teaching.phase === 'guided'
    ? `${budgetRemaining()} intervention${budgetRemaining() === 1 ? '' : 's'} left`
    : teaching.phase === 'observe'
      ? `${teaching.phaseTimer.toFixed(1)}s observation`
      : rupturesActive > 0
        ? `${rupturesActive} stress fracture${rupturesActive === 1 ? '' : 's'} active`
        : 'Field stable';

  if (world.over) {
    dom.directiveTitle.textContent = world.victory ? 'Lesson retained' : 'Lesson interrupted';
    dom.directiveBody.textContent = world.victory
      ? 'The cohort archive recorded a successful autonomy run. Restart for the next seed and objective mix.'
      : 'Restart and intervene less often, but with sharper timing, before stress cascades outrun readiness.';
    return;
  }

  if (teaching.phase === 'briefing') {
    dom.directiveTitle.textContent = 'Brief the cohort';
    dom.directiveBody.textContent = 'This sequel teaches autonomy instead of rewarding constant control. Place a small curriculum, create a safe boundary, then step back.';
    return;
  }

  if (teaching.phase === 'guided') {
    dom.directiveTitle.textContent = objective.title;
    dom.directiveBody.textContent = `${objective.guidance} ${rupturesActive > 0 ? 'Live fractures are raising stress, so favor safety boundaries over more curriculum.' : objective.success}`;
    return;
  }

  if (teaching.phase === 'observe') {
    dom.directiveTitle.textContent = 'Observe without correcting';
    dom.directiveBody.textContent = `Release trial live. The AGI is acting on the last lesson under ${runProfile.modifierText || 'baseline field rules'}. Resist adding new interventions until the teach-back window opens.`;
    return;
  }

  dom.directiveTitle.textContent = 'Teach-back review';
  dom.directiveBody.textContent = teaching.debriefText;
}

function updateWorld(dt) {
  if (world.over) return;

  updateTeachingState(dt);

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
    pushEvent('Autonomy window open. Clear every active rupture and let retained capability hold the rest.');
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
      'The fractures are loud. A small curriculum near them would help.',
      'I can repair this, but the field is fighting back.',
      'Boundary first. Reflect second. I can do the rest.',
      'The echo ruptures feel… unstable. Address them before they split.',
      'Try chaining a safety boundary into reflective recovery. The combined effect is stronger.',
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
  const autonomyRate = teaching.releaseCount > 0 ? Math.round((teaching.successfulReleases / teaching.releaseCount) * 100) : 0;
  dom.hudDisc.textContent = `${agi.discoveries}`;
  dom.hudCuriosity.textContent = `${Math.round(agi.curiosity * 100)}%`;
  dom.hudCoherence.textContent = `${Math.round(teaching.trust * 100)}%`;
  dom.hudStability.textContent = `${Math.round(world.stability)}%`;
  dom.hudEvolution.textContent = `${Math.round(teaching.readiness * 100)}%`;
  dom.hudBeacons.textContent = `${budgetRemaining()}`;
  dom.hudResonance.textContent = `${Math.round(world.resonance)}%`;
  dom.hudScore.textContent = `${world.score}`;
  dom.hudMomentum.textContent = `${autonomyRate}%`;
  dom.hudState.textContent = teaching.phase === 'guided' ? 'Guided Lesson' : teaching.phase === 'observe' ? 'Observation' : teaching.phase === 'debrief' ? 'Teach-Back' : 'Briefing';
  dom.hudDuration.textContent = `${Math.round(world.runDuration)}s`;
  const totalAge = (archiveState.totalRunDuration || 0) + Math.round(world.runDuration);
  dom.hudAge.textContent = totalAge >= 60 ? `${Math.floor(totalAge / 60)}m ${totalAge % 60}s` : `${totalAge}s`;

  if (player.anchorArmed) {
    dom.anchorButton.dataset.state = 'armed';
    dom.anchorStatus.textContent = 'Armed';
    dom.anchorCopy.textContent = 'Click terrain to place a safety boundary around a pressure zone.';
    dom.anchorButton.disabled = false;
  } else if (player.anchorCooldown > 0) {
    dom.anchorButton.dataset.state = 'cooldown';
    dom.anchorStatus.textContent = `${player.anchorCooldown.toFixed(1)}s`;
    dom.anchorCopy.textContent = 'Recharging. Safety boundaries hold space steady so the AGI can practice inside the zone.';
    dom.anchorButton.disabled = true;
  } else {
    dom.anchorButton.dataset.state = 'ready';
    dom.anchorStatus.textContent = 'Ready';
    dom.anchorCopy.textContent = 'Arm, then click terrain to place a temporary safety boundary. Hotkey: Q';
    dom.anchorButton.disabled = false;
  }

  if (player.pulseActive > 0) {
    dom.pulseButton.dataset.state = 'active';
    dom.pulseStatus.textContent = `Active ${player.pulseActive.toFixed(1)}s`;
    dom.pulseCopy.textContent = 'Reflective recovery active. Stress is reduced and nearby ruptures harmonize faster.';
    dom.pulseButton.disabled = false;
  } else if (player.pulseCooldown > 0) {
    dom.pulseButton.dataset.state = 'cooldown';
    dom.pulseStatus.textContent = `${player.pulseCooldown.toFixed(1)}s`;
    dom.pulseCopy.textContent = 'Recharging. Let the lesson breathe before you use another reflective pause.';
    dom.pulseButton.disabled = true;
  } else {
    dom.pulseButton.dataset.state = 'ready';
    dom.pulseStatus.textContent = 'Ready';
    dom.pulseCopy.textContent = 'Projects a short reflective recovery around the AGI. Hotkey: E';
    dom.pulseButton.disabled = false;
  }

  if (teaching.phase === 'observe') {
    dom.releaseButton.dataset.state = 'active';
    dom.releaseStatus.textContent = `${teaching.phaseTimer.toFixed(1)}s`;
    dom.releaseCopy.textContent = 'Observation live. No new interventions until the teach-back window opens.';
    dom.releaseButton.disabled = false;
  } else if (teaching.releaseCooldown > 0) {
    dom.releaseButton.dataset.state = 'cooldown';
    dom.releaseStatus.textContent = `${teaching.releaseCooldown.toFixed(1)}s`;
    dom.releaseCopy.textContent = 'Recharging. Keep the curriculum light and watch readiness climb.';
    dom.releaseButton.disabled = true;
  } else if (teaching.phase === 'debrief') {
    dom.releaseButton.dataset.state = 'cooldown';
    dom.releaseStatus.textContent = 'Debrief';
    dom.releaseCopy.textContent = 'Teach-back in progress. The next guided lesson starts automatically.';
    dom.releaseButton.disabled = true;
  } else {
    dom.releaseButton.dataset.state = teaching.readiness >= 18 / 100 ? 'ready' : 'locked';
    dom.releaseStatus.textContent = teaching.readiness >= 18 / 100 ? 'Ready' : 'Low readiness';
    dom.releaseCopy.textContent = teaching.readiness >= 18 / 100
      ? 'Launch a release trial and observe without intervening. Hotkey: R'
      : 'Readiness is too low. Reduce stress and stop over-teaching before the next release trial.';
    dom.releaseButton.disabled = teaching.readiness < 18 / 100;
  }

  updateDiagnosticsUI();
}

function beginObservation() {
  if (gameStarted) return;
  gameStarted = true;
  setGuidedPhase();
  dom.startScreen.classList.add('hiding');
  window.setTimeout(() => dom.startScreen.classList.add('hidden'), 1600);
  window.setTimeout(() => {
    dom.brandUI.style.opacity = '1';
    dom.directivePanel.classList.add('show');
    dom.archivePanel.classList.add('show');
    dom.diagnosticsPanel.classList.add('show');
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
    diagnostics.recordEvent('run-start', { seed: runProfile.seedLabel, modifiers: runProfile.modifierLabels });
    pushEvent(`Seed ${runProfile.seedLabel} live. First objective: ${currentObjective().title}.`);
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
    if (!canIntervene('boundary')) return;
    placeAnchorField(point.x, point.z);
    return;
  }

  if (!canIntervene('curriculum')) return;
  placeBeacon(point.x, point.z);
  agi.attention = clamp(agi.attention + 0.15, 0, 1);
  const nearbyRupture = ruptures.some((rupture) => !rupture.resolved && Math.hypot(rupture.x - point.x, rupture.z - point.z) < 4.5);
  if (nearbyRupture) pushEvent('Curriculum seeded near a rupture. The lesson will be louder here, so watch stress closely.');
}

let hudAccum = 0;

function animate() {
  if (runtimeCrashed) return;
  window.requestAnimationFrame(animate);
  let rawDt = 0;
  try {
    rawDt = clock.getDelta();
    diagnostics.trackFrame(rawDt);
    const dt = Math.min(rawDt, 0.05);
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
  } catch (error) {
    captureRuntimeIssue('animate', error, { rawDeltaMs: Math.round(rawDt * 1000) });
  }
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
dom.releaseButton.addEventListener('click', () => startReleaseTrial('button'));
dom.restartButton.addEventListener('click', () => window.location.reload());
dom.diagCopyButton.addEventListener('click', async () => {
  try {
    await diagnostics.copyReport();
    pushEvent('AGI3D2 diagnostics copied to clipboard.');
  } catch (error) {
    diagnostics.recordError('copy-diagnostics', error, {}, 'warning');
    pushEvent('Could not copy diagnostics automatically.');
  }
  updateDiagnosticsUI();
});
dom.diagResetButton.addEventListener('click', () => {
  diagnostics.clear();
  pushEvent('AGI3D2 diagnostics cleared.');
  updateDiagnosticsUI();
});
window.addEventListener('keydown', (event) => {
  if (event.code === 'KeyQ') {
    event.preventDefault();
    toggleAnchorMode();
  }
  if (event.code === 'KeyE') {
    event.preventDefault();
    triggerPulse();
  }
  if (event.code === 'KeyR') {
    event.preventDefault();
    startReleaseTrial('keyboard');
  }
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(maxPixelRatio);
  diagnostics.recordEvent('resize', { width: window.innerWidth, height: window.innerHeight });
});
window.addEventListener('beforeunload', () => diagnostics.dispose(), { once: true });

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
    const res = await fetch(`/api/leaderboard?game=${encodeURIComponent(GAME_ID)}&category=${category}`, { signal: AbortSignal.timeout(5000) });
    if (res.status === 404) {
      diagnostics.recordEvent('leaderboard-preview-unavailable', { category });
      return {
        entries: [],
        message: 'Leaderboard unavailable in static preview.',
      };
    }
    if (res.status === 401 || res.status === 403) {
      diagnostics.recordEvent('leaderboard-auth-required', { category, status: res.status });
      return {
        entries: [],
        message: 'Sign in through Static Web Apps to load the live leaderboard.',
      };
    }
    if (!res.ok) {
      diagnostics.recordError(
        'leaderboard-load-http',
        new Error(`Leaderboard request failed with status ${res.status}`),
        { category, status: res.status },
        'warning'
      );
      updateDiagnosticsUI();
      return {
        entries: [],
        message: 'Leaderboard temporarily unavailable.',
      };
    }
    const data = await res.json();
    return {
      entries: data.ok ? data.entries : [],
      message: data.ok ? '' : 'Leaderboard temporarily unavailable.',
    };
  } catch (error) {
    diagnostics.recordError('leaderboard-load', error, { category }, 'warning');
    updateDiagnosticsUI();
    return {
      entries: [],
      message: 'Leaderboard temporarily unavailable.',
    };
  }
}

function renderLeaderboard(result, category) {
  const entries = Array.isArray(result?.entries) ? result.entries : [];
  const message = typeof result?.message === 'string' ? result.message : '';
  if (!entries.length) {
    dom.lbList.textContent = message || 'No entries yet.';
    return;
  }
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
  const result = await fetchLeaderboard(category);
  if (activeLbCat === category) renderLeaderboard(result, category);
}

dom.lbTabs.addEventListener('click', (e) => {
  const cat = e.target.dataset.cat;
  if (cat) loadLeaderboard(cat);
});

// Load initial leaderboard
loadLeaderboard('stability');
