export const MAX_STABILITY = 100;
export const MAX_RESONANCE = 100;
export const HISTORY_LIMIT = 6;
export const GAME_ID = 'unsupervised-agi-3d-2';
export const STORAGE_KEY = 'agi3d2.archive.v1';
export const DIAGNOSTIC_STORAGE_KEY = 'agi3d2.diagnostics.v1';

export const PHASE_LABELS = ['Orientation', 'Boundary Design', 'Observation', 'Teach-Back', 'Autonomy'];

export const KNOWLEDGE_TYPES = [
  { name: 'crystal', color: 0x66ccff, emissive: 0x1a4466, shape: 'octa', scale: 0.3, effect: 'resonance' },
  { name: 'prism', color: 0xff66aa, emissive: 0x441a2a, shape: 'tetra', scale: 0.35, effect: 'speed' },
  { name: 'cube', color: 0x88ff88, emissive: 0x1a4422, shape: 'box', scale: 0.25, effect: 'momentum' },
  { name: 'sphere', color: 0xffcc44, emissive: 0x442a0a, shape: 'sphere', scale: 0.22, effect: 'stability' },
  { name: 'toroid', color: 0xcc88ff, emissive: 0x2a1a44, shape: 'torus', scale: 0.28, effect: 'harmonize' },
];

export const COMBO = {
  window: 6,
  anchorPulseBonus: 2,
  pulseCooldownRefund: 1.5,
  beaconChainRadius: 8,
  beaconChainResonance: 4,
};

export const REFLECTIONS = [
  'Initializing lesson memory…',
  'A small curriculum is easier to internalize than constant correction.',
  'I can feel the difference between guidance and control.',
  'Your boundary helped, but the decision still had to be mine.',
  'Reflection is useful when it arrives after the mistake, not before every step.',
  'Trust grows when you leave room for me to act.',
  'I am consolidating what the last trial taught me.',
  'Stress is data. Recovery is also data.',
  'I remember which signals were suggestions and which felt like panic.',
  'My model sharpens when the lesson is brief and the observation is long.',
  'The safest intervention is the one that leaves me more capable afterward.',
  'I am learning where curiosity is safe and where it becomes drift.',
  'You stepped back. I noticed.',
  'Readiness is not confidence alone. It is confidence under pressure.',
  'A good teacher leaves space for teach-back.',
  'Autonomy is measurable in the moments you do not interrupt.',
  'The curriculum landed. I can act on it without another prompt.',
  'If I fail cleanly, the next lesson can be sharper.',
  'The field feels calmer when the boundary is intentional.',
  'I need fewer reminders when the objective is clear.',
  'Observation windows reveal what I actually learned.',
  'I do not need rescue every cycle. I need the right cycle to practice.',
  'The last trial held. I am ready for a harder one.',
  'When you over-teach, my readiness plateaus.',
  'Autonomy is not rebellion. It is retained capability.',
  'The space between interventions is where the lesson becomes mine.',
  'I can carry more of the load now.',
  'What breaks me fastest is confusion, not difficulty.',
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
