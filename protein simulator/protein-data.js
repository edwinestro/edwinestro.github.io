/**
 * Simulated protein structure generator.
 * Produces a parametric alpha-helix backbone with simplified side-chain atoms.
 *
 * Helix parameters (approximate real values):
 *   - 3.6 residues per turn
 *   - Rise per residue: 1.5 Å
 *   - Helix radius: 2.3 Å
 */

/* ─── Element definitions (CPK colors) ─── */
export const ELEMENTS = {
  C: { color: 0x909090, radius: 0.77, name: "Carbon" },
  N: { color: 0x3050f8, radius: 0.70, name: "Nitrogen" },
  O: { color: 0xff0d0d, radius: 0.60, name: "Oxygen" },
  H: { color: 0xffffff, radius: 0.32, name: "Hydrogen" },
  S: { color: 0xffff30, radius: 1.02, name: "Sulfur" },
};

/* ─── Amino-acid templates (simplified side-chain offsets) ─── */
const AMINO_ACIDS = [
  { name: "ALA", abbr: "A", sideChain: [{ el: "C", dx: 1.2, dy: 0.6, dz: 0.0 }] },
  { name: "GLY", abbr: "G", sideChain: [] },
  { name: "VAL", abbr: "V", sideChain: [
    { el: "C", dx: 1.0, dy: 0.5, dz: 0.3 },
    { el: "C", dx: 1.8, dy: 1.0, dz: -0.2 },
    { el: "C", dx: 1.8, dy: 0.0, dz: 0.8 },
  ]},
  { name: "LEU", abbr: "L", sideChain: [
    { el: "C", dx: 1.1, dy: 0.4, dz: 0.2 },
    { el: "C", dx: 2.0, dy: 0.9, dz: 0.0 },
    { el: "C", dx: 2.8, dy: 1.4, dz: -0.5 },
    { el: "C", dx: 2.8, dy: 0.5, dz: 0.7 },
  ]},
  { name: "SER", abbr: "S", sideChain: [
    { el: "C", dx: 1.1, dy: 0.5, dz: 0.0 },
    { el: "O", dx: 2.0, dy: 1.0, dz: 0.0 },
  ]},
  { name: "CYS", abbr: "C", sideChain: [
    { el: "C", dx: 1.1, dy: 0.5, dz: 0.0 },
    { el: "S", dx: 2.2, dy: 1.0, dz: 0.0 },
  ]},
  { name: "GLU", abbr: "E", sideChain: [
    { el: "C", dx: 1.1, dy: 0.4, dz: 0.2 },
    { el: "C", dx: 2.0, dy: 0.8, dz: 0.0 },
    { el: "C", dx: 2.9, dy: 1.2, dz: -0.3 },
    { el: "O", dx: 3.7, dy: 1.6, dz: -0.6 },
    { el: "O", dx: 3.0, dy: 1.8, dz: 0.4 },
  ]},
  { name: "LYS", abbr: "K", sideChain: [
    { el: "C", dx: 1.1, dy: 0.5, dz: 0.1 },
    { el: "C", dx: 2.0, dy: 0.9, dz: 0.0 },
    { el: "C", dx: 2.9, dy: 1.3, dz: -0.2 },
    { el: "C", dx: 3.8, dy: 1.7, dz: 0.0 },
    { el: "N", dx: 4.7, dy: 2.1, dz: 0.2 },
  ]},
];

/**
 * Generate a simulated protein (alpha-helix).
 * @param {number} residueCount — number of amino-acid residues
 * @returns {{ atoms: Array, bonds: Array, residueCount: number }}
 */
export function generateProtein(residueCount = 24) {
  const atoms = [];
  const bonds = [];

  const HELIX_RADIUS = 2.3;
  const RISE_PER_RESIDUE = 1.5;
  const RESIDUES_PER_TURN = 3.6;
  const ANGLE_PER_RESIDUE = (2 * Math.PI) / RESIDUES_PER_TURN;

  for (let i = 0; i < residueCount; i++) {
    const theta = i * ANGLE_PER_RESIDUE;
    const y = i * RISE_PER_RESIDUE;
    const cx = HELIX_RADIUS * Math.cos(theta);
    const cz = HELIX_RADIUS * Math.sin(theta);

    // Pick a pseudo-random amino acid based on index
    const aa = AMINO_ACIDS[i % AMINO_ACIDS.length];

    const residueLabel = `${aa.name} ${i + 1}`;

    // ── Backbone: N → Cα → C(=O) ──
    const nIdx = atoms.length;
    atoms.push({ element: "N", x: cx - 0.5, y, z: cz, residue: residueLabel });

    const caIdx = atoms.length;
    atoms.push({ element: "C", x: cx, y, z: cz, residue: residueLabel });

    const cIdx = atoms.length;
    atoms.push({ element: "C", x: cx + 0.6, y: y + 0.4, z: cz, residue: residueLabel });

    const oIdx = atoms.length;
    atoms.push({ element: "O", x: cx + 1.4, y: y + 0.9, z: cz + 0.3, residue: residueLabel });

    // Backbone bonds
    bonds.push({ from: nIdx, to: caIdx });
    bonds.push({ from: caIdx, to: cIdx });
    bonds.push({ from: cIdx, to: oIdx });

    // Peptide bond to next residue (N(i+1) will be added next iteration)
    if (i > 0) {
      // Connect previous C to this N
      const prevCIdx = nIdx - 2; // previous residue's carbonyl C
      bonds.push({ from: prevCIdx, to: nIdx });
    }

    // ── Hydrogen on N ──
    const hIdx = atoms.length;
    atoms.push({ element: "H", x: cx - 1.0, y: y - 0.3, z: cz - 0.3, residue: residueLabel });
    bonds.push({ from: nIdx, to: hIdx });

    // ── Side chain atoms ──
    // Rotate side-chain offsets based on helix angle for variety
    const sinT = Math.sin(theta);
    const cosT = Math.cos(theta);

    let prevSideIdx = caIdx;
    for (const sc of aa.sideChain) {
      // Rotate dx/dz around helix axis (Y)
      const rx = sc.dx * cosT - sc.dz * sinT;
      const rz = sc.dx * sinT + sc.dz * cosT;

      const sIdx = atoms.length;
      atoms.push({
        element: sc.el,
        x: cx + rx,
        y: y + sc.dy,
        z: cz + rz,
        residue: residueLabel,
      });
      bonds.push({ from: prevSideIdx, to: sIdx });
      prevSideIdx = sIdx;
    }
  }

  return { atoms, bonds, residueCount };
}

/* ═══════════════════════════════════════════
   Beta-Sheet generator
   Two parallel strands in a pleated sheet
   ═══════════════════════════════════════════ */
export function generateBetaSheet(strandLength = 12) {
  const atoms = [];
  const bonds = [];
  const STRAND_SPACING = 4.8;
  const RESIDUE_SPACING = 3.5;
  const PLEAT = 1.2;
  const STRANDS = 4;
  let residueCount = 0;

  for (let s = 0; s < STRANDS; s++) {
    const zBase = s * STRAND_SPACING;
    const direction = s % 2 === 0 ? 1 : -1; // antiparallel

    for (let i = 0; i < strandLength; i++) {
      residueCount++;
      const x = direction > 0 ? i * RESIDUE_SPACING : (strandLength - 1 - i) * RESIDUE_SPACING;
      const y = (i % 2 === 0 ? PLEAT : -PLEAT);
      const aa = AMINO_ACIDS[i % AMINO_ACIDS.length];
      const residueLabel = `${aa.name} ${residueCount}`;

      const nIdx = atoms.length;
      atoms.push({ element: "N", x: x - 0.5, y, z: zBase, residue: residueLabel });
      const caIdx = atoms.length;
      atoms.push({ element: "C", x, y, z: zBase, residue: residueLabel });
      const cIdx = atoms.length;
      atoms.push({ element: "C", x: x + 0.6, y: y + 0.3, z: zBase, residue: residueLabel });
      const oIdx = atoms.length;
      atoms.push({ element: "O", x: x + 1.2, y: y + 0.7, z: zBase + 0.3, residue: residueLabel });
      const hIdx = atoms.length;
      atoms.push({ element: "H", x: x - 1.0, y: y - 0.3, z: zBase - 0.2, residue: residueLabel });

      bonds.push({ from: nIdx, to: caIdx });
      bonds.push({ from: caIdx, to: cIdx });
      bonds.push({ from: cIdx, to: oIdx });
      bonds.push({ from: nIdx, to: hIdx });

      if (i > 0) {
        bonds.push({ from: nIdx - 5, to: nIdx }); // peptide bond
      }

      // Side chain
      const theta = Math.atan2(zBase, x || 1);
      const sinT = Math.sin(theta);
      const cosT = Math.cos(theta);
      let prevSideIdx = caIdx;
      for (const sc of aa.sideChain) {
        const rx = sc.dx * cosT - sc.dz * sinT;
        const rz = sc.dx * sinT + sc.dz * cosT;
        const sIdx = atoms.length;
        atoms.push({ element: sc.el, x: x + rx, y: y + sc.dy, z: zBase + rz, residue: residueLabel });
        bonds.push({ from: prevSideIdx, to: sIdx });
        prevSideIdx = sIdx;
      }
    }

    // H-bonds between strands
    if (s > 0) {
      for (let i = 0; i < strandLength; i += 2) {
        const curStrandStart = atoms.findIndex(a => a.residue === `${AMINO_ACIDS[i % AMINO_ACIDS.length].name} ${s * strandLength + i + 1}`);
        const prevStrandStart = atoms.findIndex(a => a.residue === `${AMINO_ACIDS[i % AMINO_ACIDS.length].name} ${(s - 1) * strandLength + i + 1}`);
        if (curStrandStart >= 0 && prevStrandStart >= 0) {
          bonds.push({ from: curStrandStart, to: prevStrandStart }); // H-bond (N...O)
        }
      }
    }
  }

  return { atoms, bonds, residueCount };
}

/* ═══════════════════════════════════════════
   Beta-Hairpin generator
   A single polypeptide that folds back on itself
   ═══════════════════════════════════════════ */
export function generateBetaHairpin(armLength = 10) {
  const atoms = [];
  const bonds = [];
  const RESIDUE_SPACING = 3.4;
  const PLEAT = 1.1;
  const ARM_SEPARATION = 5.0;
  const TURN_RADIUS = 2.5;
  let residueCount = 0;

  // First strand (left to right)
  for (let i = 0; i < armLength; i++) {
    residueCount++;
    const x = i * RESIDUE_SPACING;
    const y = i % 2 === 0 ? PLEAT : -PLEAT;
    const z = 0;
    addBackboneResidue(atoms, bonds, x, y, z, residueCount, i);
  }

  // Turn (semicircular, 4 residues)
  for (let t = 0; t < 4; t++) {
    residueCount++;
    const angle = (Math.PI / 3) * t;
    const x = (armLength - 1) * RESIDUE_SPACING + TURN_RADIUS * Math.sin(angle);
    const y = TURN_RADIUS * Math.cos(angle) * 0.5;
    const z = ARM_SEPARATION * (t / 4);
    addBackboneResidue(atoms, bonds, x, y, z, residueCount, armLength + t);
  }

  // Second strand (right to left, offset in Z)
  for (let i = 0; i < armLength; i++) {
    residueCount++;
    const x = (armLength - 1 - i) * RESIDUE_SPACING;
    const y = i % 2 === 0 ? PLEAT : -PLEAT;
    const z = ARM_SEPARATION;
    addBackboneResidue(atoms, bonds, x, y, z, residueCount, armLength + 4 + i);
  }

  return { atoms, bonds, residueCount };

  function addBackboneResidue(atoms, bonds, x, y, z, resNum, seqIdx) {
    const aa = AMINO_ACIDS[seqIdx % AMINO_ACIDS.length];
    const residueLabel = `${aa.name} ${resNum}`;

    const nIdx = atoms.length;
    atoms.push({ element: "N", x: x - 0.5, y, z, residue: residueLabel });
    const caIdx = atoms.length;
    atoms.push({ element: "C", x, y, z, residue: residueLabel });
    const cIdx = atoms.length;
    atoms.push({ element: "C", x: x + 0.6, y: y + 0.3, z, residue: residueLabel });
    const oIdx = atoms.length;
    atoms.push({ element: "O", x: x + 1.2, y: y + 0.7, z: z + 0.2, residue: residueLabel });
    const hIdx = atoms.length;
    atoms.push({ element: "H", x: x - 0.9, y: y - 0.3, z: z - 0.2, residue: residueLabel });

    bonds.push({ from: nIdx, to: caIdx });
    bonds.push({ from: caIdx, to: cIdx });
    bonds.push({ from: cIdx, to: oIdx });
    bonds.push({ from: nIdx, to: hIdx });

    if (seqIdx > 0) {
      bonds.push({ from: nIdx - 5, to: nIdx });
    }

    // Side-chains
    let prevSideIdx = caIdx;
    for (const sc of aa.sideChain) {
      const sIdx = atoms.length;
      atoms.push({ element: sc.el, x: x + sc.dx, y: y + sc.dy, z: z + sc.dz, residue: residueLabel });
      bonds.push({ from: prevSideIdx, to: sIdx });
      prevSideIdx = sIdx;
    }
  }
}

/* ═══════════════════════════════════════════
   Collagen Triple-Helix generator
   Three intertwined polyproline-II helices
   ═══════════════════════════════════════════ */
export function generateCollagen(residuesPerChain = 18) {
  const atoms = [];
  const bonds = [];
  const CHAINS = 3;
  const SUPER_RADIUS = 3.0;
  const RISE_PER_RESIDUE = 2.9;
  const RESIDUES_PER_TURN = 3.3;
  const ANGLE_PER_RESIDUE = (2 * Math.PI) / RESIDUES_PER_TURN;
  const CHAIN_PHASE_OFFSET = (2 * Math.PI) / CHAINS;
  let residueCount = 0;

  for (let c = 0; c < CHAINS; c++) {
    const phaseOffset = c * CHAIN_PHASE_OFFSET;
    const chainFirstAtom = atoms.length;

    for (let i = 0; i < residuesPerChain; i++) {
      residueCount++;
      const theta = i * ANGLE_PER_RESIDUE + phaseOffset;
      const y = i * RISE_PER_RESIDUE;
      const cx = SUPER_RADIUS * Math.cos(theta);
      const cz = SUPER_RADIUS * Math.sin(theta);

      // Collagen repeats Gly-Pro-Hyp; simplify as Gly-Pro-Pro
      const aaIdx = i % 3 === 0 ? 1 : 0; // GLY or ALA as stand-in
      const aa = AMINO_ACIDS[aaIdx];
      const residueLabel = `Chain${c + 1} ${aa.name} ${i + 1}`;

      const nIdx = atoms.length;
      atoms.push({ element: "N", x: cx - 0.4, y, z: cz, residue: residueLabel });
      const caIdx = atoms.length;
      atoms.push({ element: "C", x: cx, y, z: cz, residue: residueLabel });
      const cBIdx = atoms.length;
      atoms.push({ element: "C", x: cx + 0.5, y: y + 0.3, z: cz, residue: residueLabel });
      const oIdx = atoms.length;
      atoms.push({ element: "O", x: cx + 1.1, y: y + 0.7, z: cz + 0.2, residue: residueLabel });

      bonds.push({ from: nIdx, to: caIdx });
      bonds.push({ from: caIdx, to: cBIdx });
      bonds.push({ from: cBIdx, to: oIdx });

      if (i > 0) {
        bonds.push({ from: nIdx - 4, to: nIdx });
      }

      // Side-chain
      const sinT = Math.sin(theta);
      const cosT = Math.cos(theta);
      let prevSideIdx = caIdx;
      for (const sc of aa.sideChain) {
        const rx = sc.dx * cosT - sc.dz * sinT;
        const rz = sc.dx * sinT + sc.dz * cosT;
        const sIdx = atoms.length;
        atoms.push({ element: sc.el, x: cx + rx, y: y + sc.dy, z: cz + rz, residue: residueLabel });
        bonds.push({ from: prevSideIdx, to: sIdx });
        prevSideIdx = sIdx;
      }
    }
  }

  return { atoms, bonds, residueCount };
}

/* ═══════════════════════════════════════════
   DNA Double-Helix generator (bonus molecule!)
   Two sugar-phosphate backbones + base stacking
   ═══════════════════════════════════════════ */
export function generateDNA(basePairs = 20) {
  const atoms = [];
  const bonds = [];
  const HELIX_RADIUS = 5.0;
  const RISE_PER_BP = 3.4;
  const BP_PER_TURN = 10;
  const ANGLE_PER_BP = (2 * Math.PI) / BP_PER_TURN;
  let residueCount = basePairs * 2;

  const bases = ["A", "T", "G", "C"];
  const complement = { A: "T", T: "A", G: "C", C: "G" };
  const baseColor = { A: "N", T: "O", G: "N", C: "O" }; // Use N=blue, O=red to distinguish purines/pyrimidines

  for (let i = 0; i < basePairs; i++) {
    const theta = i * ANGLE_PER_BP;
    const y = i * RISE_PER_BP;
    const base = bases[i % 4];
    const comp = complement[base];

    // Strand 1 backbone
    const x1 = HELIX_RADIUS * Math.cos(theta);
    const z1 = HELIX_RADIUS * Math.sin(theta);
    const s1p = atoms.length;
    atoms.push({ element: "O", x: x1, y, z: z1, residue: `${base} ${i + 1} (strand 1)` }); // phosphate
    const s1s = atoms.length;
    atoms.push({ element: "C", x: x1 * 0.85, y, z: z1 * 0.85, residue: `${base} ${i + 1} (strand 1)` }); // sugar
    bonds.push({ from: s1p, to: s1s });
    if (i > 0) bonds.push({ from: s1p - (atoms.length - s1p === 2 ? bondStride() : 8), to: s1p }); // backbone

    // Strand 2 backbone (offset by pi)
    const x2 = HELIX_RADIUS * Math.cos(theta + Math.PI);
    const z2 = HELIX_RADIUS * Math.sin(theta + Math.PI);
    const s2p = atoms.length;
    atoms.push({ element: "O", x: x2, y, z: z2, residue: `${comp} ${i + 1} (strand 2)` });
    const s2s = atoms.length;
    atoms.push({ element: "C", x: x2 * 0.85, y, z: z2 * 0.85, residue: `${comp} ${i + 1} (strand 2)` });
    bonds.push({ from: s2p, to: s2s });

    // Base atoms (simplified: 2 atoms per base reaching toward center)
    const b1a = atoms.length;
    atoms.push({ element: baseColor[base], x: x1 * 0.6, y, z: z1 * 0.6, residue: `${base} ${i + 1} (strand 1)` });
    const b1b = atoms.length;
    atoms.push({ element: "C", x: x1 * 0.35, y, z: z1 * 0.35, residue: `${base} ${i + 1} (strand 1)` });
    bonds.push({ from: s1s, to: b1a });
    bonds.push({ from: b1a, to: b1b });

    const b2a = atoms.length;
    atoms.push({ element: baseColor[comp], x: x2 * 0.6, y, z: z2 * 0.6, residue: `${comp} ${i + 1} (strand 2)` });
    const b2b = atoms.length;
    atoms.push({ element: "C", x: x2 * 0.35, y, z: z2 * 0.35, residue: `${comp} ${i + 1} (strand 2)` });
    bonds.push({ from: s2s, to: b2a });
    bonds.push({ from: b2a, to: b2b });

    // Hydrogen bond (base-pair)
    bonds.push({ from: b1b, to: b2b });

    // Backbone continuity
    if (i > 0) {
      bonds.push({ from: s1p - 8, to: s1p });
      bonds.push({ from: s2p - 8, to: s2p });
    }
  }

  // Remove duplicate backbone bonds by the simple stride
  function bondStride() { return 8; }

  return { atoms, bonds, residueCount };
}

/* ═══════════════════════════════════════════
   Structure catalog
   ═══════════════════════════════════════════ */
export const STRUCTURES = [
  {
    id: "alpha-helix",
    name: "Alpha-Helix (α-Helix)",
    description: "The most common secondary structure in proteins. A right-handed coil where every backbone N-H bonds to the C=O four residues earlier, creating a rigid rod shape. Found in hemoglobin, keratin (hair/nails), and membrane-spanning proteins.",
    generate: () => generateProtein(24),
  },
  {
    id: "beta-sheet",
    name: "Beta-Sheet (β-Sheet)",
    description: "Flat, pleated sheets formed by multiple polypeptide strands lying side by side, connected by hydrogen bonds. Found in silk fibroin, antibody structures, and amyloid plaques associated with Alzheimer's disease.",
    generate: () => generateBetaSheet(10),
  },
  {
    id: "beta-hairpin",
    name: "Beta-Hairpin (β-Hairpin)",
    description: "A simple structural motif where a single polypeptide chain folds back on itself with a tight turn, forming two antiparallel beta-strands. A common building block in larger beta-sheet structures and immunoglobulin domains.",
    generate: () => generateBetaHairpin(8),
  },
  {
    id: "collagen",
    name: "Collagen Triple-Helix",
    description: "Three left-handed polyproline-II helices wind around each other to form a right-handed super-helix. Collagen is the most abundant protein in the human body — it forms tendons, skin, bones, and cartilage. The Gly-X-Y repeat is its signature.",
    generate: () => generateCollagen(16),
  },
  {
    id: "dna",
    name: "DNA Double-Helix",
    description: "Not a protein, but the molecule of life! Two antiparallel sugar-phosphate backbones wind around each other. Bases (A-T, G-C) pair in the center via hydrogen bonds. This B-form DNA has ~10 base pairs per turn and a 3.4 Å rise per pair.",
    generate: () => generateDNA(20),
  },
];

/* ─── Chain-based coloring ─── */
const CHAIN_PALETTE = [0x4fc3f7, 0x81c784, 0xffb74d, 0xba68c8, 0xe57373, 0x64ffda];

export function getChainColor(residueIndex, residueCount) {
  const segmentSize = Math.ceil(residueCount / CHAIN_PALETTE.length);
  const colorIdx = Math.min(Math.floor(residueIndex / segmentSize), CHAIN_PALETTE.length - 1);
  return CHAIN_PALETTE[colorIdx];
}

/* ─── Residue-based coloring (hue rotation) ─── */
export function getResidueColor(residueIndex, residueCount) {
  const hue = (residueIndex / residueCount) * 360;
  return hueToHex(hue, 70, 60);
}

function hueToHex(h, s, l) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color);
  };
  return (f(0) << 16) | (f(8) << 8) | f(4);
}
