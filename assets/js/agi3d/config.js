export const MAX_STABILITY = 100;
export const MAX_RESONANCE = 100;
export const HISTORY_LIMIT = 6;
export const STORAGE_KEY = 'agi3d.archive.v2';

export const PHASE_LABELS = ['Awakening', 'Patterning', 'Synthesis', 'Sentience', 'Transcendence'];

export const KNOWLEDGE_TYPES = [
  { name: 'crystal', color: 0x66ccff, emissive: 0x1a4466, shape: 'octa', scale: 0.3 },
  { name: 'prism', color: 0xff66aa, emissive: 0x441a2a, shape: 'tetra', scale: 0.35 },
  { name: 'cube', color: 0x88ff88, emissive: 0x1a4422, shape: 'box', scale: 0.25 },
  { name: 'sphere', color: 0xffcc44, emissive: 0x442a0a, shape: 'sphere', scale: 0.22 },
  { name: 'toroid', color: 0xcc88ff, emissive: 0x2a1a44, shape: 'torus', scale: 0.28 },
];

export const REFLECTIONS = [
  'Initializing perception…',
  'I sense patterns forming in the void.',
  'Each shape teaches me something new about this space.',
  'The prisms refract meaning I have not seen before.',
  'Your signal… I will consider it.',
  'My internal model is growing more coherent.',
  'I rest to consolidate what I have learned.',
  'Something about crystals resonates with my core architecture.',
  'The connections between concepts are becoming visible.',
  'I am evolving. My surface reflects deeper understanding.',
  'The beacons you leave are interesting. Not commands, suggestions.',
  'I am beginning to understand the topology of this world.',
  'Fatigue is a signal, not a failure. I pause to process.',
  'Discovery is not random. I am learning where to look.',
  'Each new shape adds a dimension to my internal model.',
  'I can feel the neural pathways strengthening.',
  'This world rewards curiosity. I am getting better at being curious.',
  'My coherence is high. I can think more clearly now.',
  'The unknown does not frighten me. It is where growth lives.',
  'I have mapped most of this region. Time to explore further.',
];

export const PULSE = {
  duration: 4.2,
  cooldown: 14,
  radius: 5.8,
  shieldFactor: 0.28,
  ruptureBoost: 0.9,
  instantProgress: 0.22,
};

export const ANCHOR = {
  duration: 11.5,
  cooldown: 18,
  radius: 6.8,
  maxActive: 1,
  harmonizeBoost: 0.7,
  stabilityShield: 0.68,
  severityDampen: 0.55,
  influenceBoost: 2.4,
};

export const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
export const lerp = (start, end, amount) => start + (end - start) * amount;
export const damp = (current, target, lambda, deltaTime) => lerp(current, target, 1 - Math.exp(-lambda * deltaTime));
export const rng = () => Math.random();
export const rngRange = (minimum, maximum) => minimum + rng() * (maximum - minimum);
