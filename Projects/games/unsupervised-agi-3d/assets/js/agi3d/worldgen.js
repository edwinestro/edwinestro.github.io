import { ANCHOR, PULSE, clamp } from './config.js';

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createSeededRandom(seed) {
  let state = hashString(seed) || 1;
  return () => {
    state += 0x6D2B79F5;
    let next = state;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function randomRange(random, minimum, maximum) {
  return minimum + random() * (maximum - minimum);
}

function formatSeedLabel(seed) {
  return hashString(seed).toString(16).toUpperCase().padStart(8, '0').slice(0, 8);
}

function makePoint(random, radius, clusterTightness, edgeBias) {
  const angle = random() * Math.PI * 2;
  const centerPull = Math.pow(random(), clusterTightness);
  const edgePull = edgeBias > 0 ? (1 - edgeBias) * centerPull + edgeBias * Math.sqrt(random()) : centerPull;
  const distance = radius * (0.18 + edgePull * 0.82);
  return { x: Math.cos(angle) * distance, z: Math.sin(angle) * distance };
}

const MODIFIERS = [
  {
    id: 'stormfront',
    minTier: 0,
    label: 'Stormfront',
    description: 'Ruptures arrive faster and hit harder.',
    apply(profile) {
      profile.ruptureCadenceFactor *= 0.74;
      profile.ruptureSeverityBonus += 0.24;
      profile.maxConcurrentRupturesBonus += 1;
    },
  },
  {
    id: 'dense-bloom',
    minTier: 0,
    label: 'Dense Bloom',
    description: 'More knowledge nodes bloom around the center.',
    apply(profile) {
      profile.nodeCount += 6;
      profile.clusterTightness *= 0.78;
      profile.discoveryResonanceFactor *= 0.96;
    },
  },
  {
    id: 'long-orbit',
    minTier: 1,
    label: 'Long Orbit',
    description: 'The world widens, stretching traversal and platform spacing.',
    apply(profile) {
      profile.worldRadius += 8;
      profile.platformCount += 3;
      profile.cameraDistance += 2;
      profile.cameraHeight += 0.8;
      profile.edgeBias += 0.16;
    },
  },
  {
    id: 'anchor-reserve',
    minTier: 1,
    label: 'Anchor Reserve',
    description: 'Anchor fields last longer and support more placements.',
    apply(profile) {
      profile.anchorDurationFactor *= 1.3;
      profile.anchorCooldownFactor *= 0.82;
      profile.anchorRadiusFactor *= 1.12;
      profile.anchorMaxActiveBonus += 1;
    },
  },
  {
    id: 'echo-lattice',
    minTier: 2,
    label: 'Echo Lattice',
    description: 'Resonance gains rise, but ruptures need more support to settle.',
    apply(profile) {
      profile.discoveryResonanceFactor *= 1.16;
      profile.baseRuptureProgressFactor *= 0.92;
      profile.startingRuptures += 1;
    },
  },
  {
    id: 'calm-fringe',
    minTier: 3,
    label: 'Calm Fringe',
    description: 'The edge holds more discoveries, while ruptures stalk the perimeter.',
    apply(profile) {
      profile.edgeBias += 0.24;
      profile.ruptureOuterBias += 0.32;
      profile.platformCount += 1;
    },
  },
];

function selectModifiers(archive, random) {
  const available = MODIFIERS.filter((modifier) => modifier.minTier <= archive.archiveTier);
  const count = archive.archiveTier >= 4 ? 3 : archive.archiveTier >= 2 ? 2 : 1;
  const pool = [...available];
  const selected = [];

  while (pool.length && selected.length < count) {
    const index = Math.floor(random() * pool.length);
    selected.push(pool.splice(index, 1)[0]);
  }

  return selected;
}

export function buildRunProfile(archive) {
  const seed = `agi3d|${archive.totalRuns}|${archive.bestScore}|${archive.wins}|${archive.archiveTier}|${archive.history[0]?.score ?? 0}`;
  const random = createSeededRandom(seed);
  const profile = {
    seed,
    seedLabel: formatSeedLabel(seed),
    runtimeSeed: `${seed}|runtime`,
    worldRadius: 34 + archive.archiveTier * 1.4,
    nodeCount: 20,
    platformCount: 8,
    clusterTightness: 1.12,
    edgeBias: 0.08,
    ruptureOuterBias: 0.04,
    ruptureCadenceFactor: 1,
    ruptureSeverityBonus: 0,
    maxConcurrentRupturesBonus: 0,
    startingRuptures: 0,
    discoveryResonanceFactor: 1,
    baseRuptureProgressFactor: 1,
    cameraDistance: 12,
    cameraHeight: 6,
    beaconDurationFactor: 1,
    pulseCooldownFactor: 1,
    pulseRadiusFactor: 1,
    anchorDurationFactor: 1,
    anchorCooldownFactor: 1,
    anchorRadiusFactor: 1,
    anchorMaxActiveBonus: 0,
    modifiers: [],
    nodePositions: [],
    platformPositions: [],
  };

  const modifiers = selectModifiers(archive, random);
  for (const modifier of modifiers) {
    modifier.apply(profile);
  }
  profile.modifiers = modifiers.map((modifier) => ({
    id: modifier.id,
    label: modifier.label,
    description: modifier.description,
  }));

  const nodeRadius = profile.worldRadius - 2;
  for (let index = 0; index < profile.nodeCount; index++) {
    profile.nodePositions.push(makePoint(random, nodeRadius, profile.clusterTightness, profile.edgeBias));
  }

  for (let index = 0; index < profile.platformCount; index++) {
    const angle = (index / profile.platformCount) * Math.PI * 2 + randomRange(random, -0.22, 0.22);
    const radius = 4 + random() * (profile.worldRadius * 0.42);
    profile.platformPositions.push({
      x: Math.cos(angle) * radius,
      z: Math.sin(angle) * radius,
      topRadius: 0.8 + random() * 0.6,
      bottomRadius: 1 + random() * 0.5,
    });
  }

  profile.maxConcurrentRuptures = 2 + profile.maxConcurrentRupturesBonus;
  profile.modifierLabels = profile.modifiers.map((modifier) => modifier.label);
  profile.modifierText = profile.modifierLabels.join(' • ');
  profile.anchor = {
    duration: ANCHOR.duration * profile.anchorDurationFactor,
    cooldown: ANCHOR.cooldown * profile.anchorCooldownFactor,
    radius: ANCHOR.radius * profile.anchorRadiusFactor,
    maxActive: ANCHOR.maxActive + profile.anchorMaxActiveBonus,
  };
  profile.pulse = {
    cooldown: PULSE.cooldown * profile.pulseCooldownFactor,
    radius: PULSE.radius * profile.pulseRadiusFactor,
  };
  profile.worldRadius = clamp(profile.worldRadius, 28, 50);

  return profile;
}
