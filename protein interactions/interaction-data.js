/**
 * Protein Interaction Scenarios
 *
 * Each scene defines two molecular groups that interact via a simulated
 * binding/docking animation. Structures are generated parametrically
 * (same approach as the protein simulator).
 */

/* ─── CPK Element definitions ─── */
export const ELEMENTS = {
  C:  { color: 0x909090, radius: 0.65, name: "Carbon" },
  N:  { color: 0x3050f8, radius: 0.60, name: "Nitrogen" },
  O:  { color: 0xff0d0d, radius: 0.55, name: "Oxygen" },
  H:  { color: 0xcccccc, radius: 0.28, name: "Hydrogen" },
  S:  { color: 0xffff30, radius: 0.90, name: "Sulfur" },
  P:  { color: 0xff8000, radius: 0.80, name: "Phosphorus" },
  Fe: { color: 0xe06633, radius: 0.75, name: "Iron" },
  Zn: { color: 0x7d80b0, radius: 0.74, name: "Zinc" },
  Mg: { color: 0x228b22, radius: 0.72, name: "Magnesium" },
};

/* ═══════════════════════════════════════════
   Geometry helpers
   ═══════════════════════════════════════════ */
function helixAtoms(n, radius, rise, phase, offset, label) {
  const atoms = [], bonds = [];
  const angleStep = (2 * Math.PI) / 3.6;
  for (let i = 0; i < n; i++) {
    const t = i * angleStep + phase;
    const y = i * rise;
    const x = radius * Math.cos(t) + offset.x;
    const z = radius * Math.sin(t) + offset.z;
    const yy = y + offset.y;
    const nIdx = atoms.length;
    atoms.push({ element: "N", x: x - 0.4, y: yy, z, residue: `${label} ${i + 1}`, group: label });
    const caIdx = atoms.length;
    atoms.push({ element: "C", x, y: yy, z, residue: `${label} ${i + 1}`, group: label });
    const cIdx = atoms.length;
    atoms.push({ element: "C", x: x + 0.5, y: yy + 0.3, z, residue: `${label} ${i + 1}`, group: label });
    atoms.push({ element: "O", x: x + 1.0, y: yy + 0.6, z: z + 0.2, residue: `${label} ${i + 1}`, group: label });
    bonds.push({ from: nIdx, to: caIdx }, { from: caIdx, to: cIdx }, { from: cIdx, to: cIdx + 1 });
    if (i > 0) bonds.push({ from: nIdx - 4, to: nIdx });
  }
  return { atoms, bonds };
}

function dnaStrand(bp, offset, label) {
  const atoms = [], bonds = [];
  const R = 4.5, rise = 3.4, bpTurn = 10;
  const angle = (2 * Math.PI) / bpTurn;
  for (let i = 0; i < bp; i++) {
    const t = i * angle;
    const y = i * rise + offset.y;
    // Strand 1
    const x1 = R * Math.cos(t) + offset.x, z1 = R * Math.sin(t) + offset.z;
    const s1 = atoms.length;
    atoms.push({ element: "P", x: x1, y, z: z1, residue: `${label} bp${i + 1}`, group: label });
    atoms.push({ element: "C", x: x1 * 0.8, y, z: z1 * 0.8, residue: `${label} bp${i + 1}`, group: label });
    atoms.push({ element: "N", x: x1 * 0.5, y, z: z1 * 0.5, residue: `${label} bp${i + 1}`, group: label });
    bonds.push({ from: s1, to: s1 + 1 }, { from: s1 + 1, to: s1 + 2 });
    // Strand 2
    const x2 = R * Math.cos(t + Math.PI) + offset.x, z2 = R * Math.sin(t + Math.PI) + offset.z;
    const s2 = atoms.length;
    atoms.push({ element: "P", x: x2, y, z: z2, residue: `${label} bp${i + 1}`, group: label });
    atoms.push({ element: "C", x: x2 * 0.8, y, z: z2 * 0.8, residue: `${label} bp${i + 1}`, group: label });
    atoms.push({ element: "N", x: x2 * 0.5, y, z: z2 * 0.5, residue: `${label} bp${i + 1}`, group: label });
    bonds.push({ from: s2, to: s2 + 1 }, { from: s2 + 1, to: s2 + 2 });
    // H-bond
    bonds.push({ from: s1 + 2, to: s2 + 2 });
    // Backbone
    if (i > 0) {
      bonds.push({ from: s1 - 6, to: s1 });
      bonds.push({ from: s2 - 6, to: s2 });
    }
  }
  return { atoms, bonds };
}

function smallMolecule(type, offset, label) {
  const atoms = [], bonds = [];
  const ox = offset.x, oy = offset.y, oz = offset.z;
  if (type === "drug") {
    // Aspirin-like: benzene ring + functional groups
    const ring = 6;
    for (let i = 0; i < ring; i++) {
      const a = (i / ring) * Math.PI * 2;
      atoms.push({ element: "C", x: ox + 1.4 * Math.cos(a), y: oy, z: oz + 1.4 * Math.sin(a), residue: label, group: label });
      if (i > 0) bonds.push({ from: atoms.length - 2, to: atoms.length - 1 });
    }
    bonds.push({ from: atoms.length - ring, to: atoms.length - 1 }); // close ring
    // Carboxyl
    const base = atoms.length;
    atoms.push({ element: "C", x: ox + 2.5, y: oy, z: oz, residue: label, group: label });
    atoms.push({ element: "O", x: ox + 3.3, y: oy + 0.6, z: oz, residue: label, group: label });
    atoms.push({ element: "O", x: ox + 3.3, y: oy - 0.6, z: oz, residue: label, group: label });
    bonds.push({ from: 0, to: base }, { from: base, to: base + 1 }, { from: base, to: base + 2 });
    // Acetyl
    const b2 = atoms.length;
    atoms.push({ element: "O", x: ox - 1.0, y: oy + 1.5, z: oz, residue: label, group: label });
    atoms.push({ element: "C", x: ox - 1.8, y: oy + 2.2, z: oz, residue: label, group: label });
    atoms.push({ element: "O", x: ox - 2.6, y: oy + 2.8, z: oz, residue: label, group: label });
    bonds.push({ from: 2, to: b2 }, { from: b2, to: b2 + 1 }, { from: b2 + 1, to: b2 + 2 });
  } else if (type === "atp") {
    // Adenine base + ribose + 3 phosphates
    // Base (purine-like, simplified)
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      atoms.push({ element: "N", x: ox + 1.2 * Math.cos(a), y: oy, z: oz + 1.2 * Math.sin(a), residue: label, group: label });
      if (i > 0) bonds.push({ from: atoms.length - 2, to: atoms.length - 1 });
    }
    bonds.push({ from: atoms.length - 5, to: atoms.length - 1 });
    // Ribose
    const rb = atoms.length;
    atoms.push({ element: "C", x: ox + 2.5, y: oy, z: oz, residue: label, group: label });
    atoms.push({ element: "O", x: ox + 3.0, y: oy + 0.5, z: oz, residue: label, group: label });
    bonds.push({ from: 0, to: rb }, { from: rb, to: rb + 1 });
    // Three phosphates
    for (let p = 0; p < 3; p++) {
      const px = ox + 4.0 + p * 2.0;
      const pi = atoms.length;
      atoms.push({ element: "P", x: px, y: oy, z: oz, residue: label, group: label });
      atoms.push({ element: "O", x: px + 0.5, y: oy + 0.7, z: oz, residue: label, group: label });
      atoms.push({ element: "O", x: px + 0.5, y: oy - 0.7, z: oz, residue: label, group: label });
      atoms.push({ element: "O", x: px - 0.5, y: oy, z: oz + 0.7, residue: label, group: label });
      bonds.push({ from: pi, to: pi + 1 }, { from: pi, to: pi + 2 }, { from: pi, to: pi + 3 });
      if (p === 0) bonds.push({ from: rb + 1, to: pi });
      else bonds.push({ from: pi - 4, to: pi });
    }
  } else if (type === "lipid") {
    // Phospholipid: head + two tails
    // Head
    atoms.push({ element: "P", x: ox, y: oy, z: oz, residue: label, group: label });
    atoms.push({ element: "O", x: ox + 0.6, y: oy + 0.5, z: oz, residue: label, group: label });
    atoms.push({ element: "N", x: ox - 0.6, y: oy + 0.8, z: oz, residue: label, group: label });
    bonds.push({ from: 0, to: 1 }, { from: 0, to: 2 });
    // Tail 1
    for (let t = 0; t < 8; t++) {
      const ti = atoms.length;
      atoms.push({ element: "C", x: ox - 0.3, y: oy - (t + 1) * 1.5, z: oz + (t % 2 === 0 ? 0.3 : -0.3), residue: label, group: label });
      bonds.push({ from: t === 0 ? 0 : ti - 1, to: ti });
    }
    // Tail 2
    const t2start = atoms.length;
    for (let t = 0; t < 8; t++) {
      const ti = atoms.length;
      atoms.push({ element: "C", x: ox + 0.3, y: oy - (t + 1) * 1.5, z: oz + (t % 2 === 0 ? -0.3 : 0.3), residue: label, group: label });
      bonds.push({ from: t === 0 ? 0 : ti - 1, to: ti });
    }
  } else if (type === "ion") {
    atoms.push({ element: "Zn", x: ox, y: oy, z: oz, residue: label, group: label });
  }
  return { atoms, bonds };
}

function membrane(width, depth, yPos, label) {
  const atoms = [], bonds = [];
  const spacing = 3.5;
  for (let x = -width / 2; x <= width / 2; x += spacing) {
    for (let z = -depth / 2; z <= depth / 2; z += spacing) {
      // Upper leaflet head
      const hi = atoms.length;
      atoms.push({ element: "P", x, y: yPos + 1, z, residue: `${label} head`, group: label });
      // Upper leaflet tail
      atoms.push({ element: "C", x, y: yPos, z, residue: `${label} tail`, group: label });
      atoms.push({ element: "C", x, y: yPos - 1, z, residue: `${label} tail`, group: label });
      bonds.push({ from: hi, to: hi + 1 }, { from: hi + 1, to: hi + 2 });
      // Lower leaflet
      atoms.push({ element: "C", x, y: yPos - 2, z, residue: `${label} tail`, group: label });
      atoms.push({ element: "C", x, y: yPos - 3, z, residue: `${label} tail`, group: label });
      atoms.push({ element: "P", x, y: yPos - 4, z, residue: `${label} head`, group: label });
      bonds.push({ from: hi + 2, to: hi + 3 }, { from: hi + 3, to: hi + 4 }, { from: hi + 4, to: hi + 5 });
    }
  }
  return { atoms, bonds };
}

/* ═══════════════════════════════════════════
   Scene definitions
   ═══════════════════════════════════════════ */
export const SCENES = [
  {
    id: "antibody-antigen",
    name: "Antibody + Antigen",
    description: "An antibody (Y-shaped immune protein) recognizes and binds a foreign antigen protein. The variable region at the tips locks onto epitopes with shape complementarity, like a lock and key. This is the basis of the adaptive immune system.",
    moleculeA: { name: "Antibody", color: 0x4fc3f7 },
    moleculeB: { name: "Antigen", color: 0xff8a65 },
    bindingType: "Protein–Protein",
    generate() {
      // Antibody: two helical arms
      const armL = helixAtoms(14, 2.0, 1.4, 0, { x: -6, y: 0, z: 0 }, "Ab-L");
      const armR = helixAtoms(14, 2.0, 1.4, Math.PI, { x: 6, y: 0, z: 0 }, "Ab-R");
      const stem = helixAtoms(10, 1.8, 1.5, 0, { x: 0, y: -18, z: 0 }, "Ab-Fc");
      const a = { atoms: [...armL.atoms, ...armR.atoms, ...stem.atoms], bonds: [...armL.bonds] };
      // fix bond indices for armR and stem
      const offR = armL.atoms.length;
      armR.bonds.forEach(b => a.bonds.push({ from: b.from + offR, to: b.to + offR }));
      const offS = offR + armR.atoms.length;
      stem.bonds.forEach(b => a.bonds.push({ from: b.from + offS, to: b.to + offS }));
      // Antigen: small helix
      const ag = helixAtoms(8, 1.8, 1.5, 0.5, { x: 0, y: 25, z: 0 }, "Antigen");
      return {
        groupA: a,
        groupB: ag,
        startOffsetB: { x: 0, y: 30, z: 0 },
        dockOffsetB: { x: 0, y: 12, z: 0 },
        bindingSites: [{ a: 1, b: 1 }],
      };
    },
  },
  {
    id: "transcription-factor-dna",
    name: "Transcription Factor + DNA",
    description: "A zinc-finger transcription factor protein slides along and grips the major groove of DNA. Each zinc finger (protein loop stabilized by a Zn²⁺ ion) reads 3 base pairs. This turns genes on and off — the core of gene regulation.",
    moleculeA: { name: "Zinc-Finger Protein", color: 0x81c784 },
    moleculeB: { name: "DNA", color: 0xba68c8 },
    bindingType: "Protein–DNA",
    generate() {
      const tf = helixAtoms(12, 2.2, 1.5, 0, { x: 0, y: 0, z: 0 }, "ZnF");
      // Add zinc ions
      for (let i = 0; i < 3; i++) {
        tf.atoms.push({ element: "Zn", x: 3.5, y: i * 6, z: 0, residue: `Zn ${i + 1}`, group: "ZnF" });
      }
      const dna = dnaStrand(12, { x: 0, y: 30, z: 0 }, "DNA");
      return {
        groupA: tf,
        groupB: dna,
        startOffsetB: { x: 0, y: 30, z: 15 },
        dockOffsetB: { x: 0, y: 0, z: 4 },
        bindingSites: [{ a: 0, b: 0 }],
      };
    },
  },
  {
    id: "drug-enzyme",
    name: "Drug + Enzyme",
    description: "A small-molecule drug (aspirin-like) enters the active site pocket of an enzyme (COX-like). The drug binds through hydrogen bonds and hydrophobic contacts, blocking the enzyme's catalytic activity — this is competitive inhibition.",
    moleculeA: { name: "COX Enzyme", color: 0xe57373 },
    moleculeB: { name: "Drug (Aspirin)", color: 0xffd54f },
    bindingType: "Small Molecule–Protein",
    generate() {
      // Enzyme: two helices forming a pocket
      const h1 = helixAtoms(16, 2.5, 1.4, 0, { x: -3, y: 0, z: 0 }, "COX-A");
      const h2 = helixAtoms(16, 2.5, 1.4, Math.PI / 2, { x: 3, y: 0, z: 0 }, "COX-B");
      const enz = { atoms: [...h1.atoms, ...h2.atoms], bonds: [...h1.bonds] };
      const off2 = h1.atoms.length;
      h2.bonds.forEach(b => enz.bonds.push({ from: b.from + off2, to: b.to + off2 }));
      const drug = smallMolecule("drug", { x: 0, y: 12, z: 0 }, "Aspirin");
      return {
        groupA: enz,
        groupB: drug,
        startOffsetB: { x: 0, y: 25, z: 15 },
        dockOffsetB: { x: 0, y: 12, z: 0 },
        bindingSites: [{ a: 0, b: 0 }],
      };
    },
  },
  {
    id: "ion-channel-membrane",
    name: "Ion Channel + Membrane",
    description: "A transmembrane ion channel protein spans the lipid bilayer. When a signal arrives, the channel opens, allowing ions (shown as spheres) to flow through the central pore. This is how neurons fire and muscles contract.",
    moleculeA: { name: "Ion Channel", color: 0x4dd0e1 },
    moleculeB: { name: "Lipid Bilayer", color: 0xa1887f },
    bindingType: "Protein–Membrane",
    generate() {
      // Channel: 4 helices arranged in a ring
      const channel = { atoms: [], bonds: [] };
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2;
        const cx = 5 * Math.cos(angle), cz = 5 * Math.sin(angle);
        const h = helixAtoms(12, 1.5, 1.5, angle, { x: cx, y: -8, z: cz }, `Ch-${i + 1}`);
        const off = channel.atoms.length;
        h.atoms.forEach(a => channel.atoms.push(a));
        h.bonds.forEach(b => channel.bonds.push({ from: b.from + off, to: b.to + off }));
      }
      // Add ions in the pore
      for (let i = 0; i < 3; i++) {
        channel.atoms.push({ element: "Mg", x: 0, y: -2 + i * 5, z: 0, residue: `Ion ${i + 1}`, group: "Ion" });
      }
      const mem = membrane(30, 30, -2, "Membrane");
      return {
        groupA: channel,
        groupB: mem,
        startOffsetB: { x: 0, y: -30, z: 0 },
        dockOffsetB: { x: 0, y: 0, z: 0 },
        bindingSites: [],
      };
    },
  },
  {
    id: "atp-motor",
    name: "ATP + Motor Protein",
    description: "ATP (adenosine triphosphate) — the cell's energy currency — binds to a motor protein like myosin. ATP hydrolysis (breaking a phosphate bond) releases energy, causing a conformational change that drives the power stroke. This is how muscles move.",
    moleculeA: { name: "Motor Protein (Myosin)", color: 0x9575cd },
    moleculeB: { name: "ATP", color: 0x4db6ac },
    bindingType: "Small Molecule–Protein",
    generate() {
      const motor = helixAtoms(20, 2.8, 1.3, 0, { x: 0, y: 0, z: 0 }, "Myosin");
      // Add Fe cofactor
      motor.atoms.push({ element: "Fe", x: 0, y: 14, z: 0, residue: "Fe cofactor", group: "Myosin" });
      const atp = smallMolecule("atp", { x: 0, y: 18, z: 0 }, "ATP");
      return {
        groupA: motor,
        groupB: atp,
        startOffsetB: { x: 15, y: 25, z: 10 },
        dockOffsetB: { x: 0, y: 18, z: 0 },
        bindingSites: [{ a: 0, b: 0 }],
      };
    },
  },
];
