# Protein Interactions — Molecular Dynamics Simulator

An interactive 3D simulator showing how proteins interact with other biological molecules. Watch antibodies dock onto antigens, transcription factors grip DNA, drugs inhibit enzymes, and more — all in real-time in your browser.

Built with **Three.js** (via CDN) — no build step, no npm install required.

![Three.js](https://img.shields.io/badge/Three.js-0.160-blue) ![Vanilla JS](https://img.shields.io/badge/Vanilla-JS-yellow) ![No Build](https://img.shields.io/badge/Build-None-green)

## Quick Start

```bash
# Requires a local HTTP server (ES modules don't work over file://)
python -m http.server 8080
# or
npx serve -l 8080
```

Open **http://localhost:8080** in your browser.

## Interaction Scenarios

| Scene | Molecules | Interaction Type | What Happens |
|-------|-----------|-----------------|--------------|
| **Antibody + Antigen** | Y-shaped antibody + foreign protein | Protein–Protein | The antibody's variable tips lock onto antigen epitopes via shape complementarity. Basis of adaptive immunity. |
| **Transcription Factor + DNA** | Zinc-finger protein + DNA double helix | Protein–DNA | The protein slides along and grips DNA's major groove. Zinc ions stabilize finger domains that read 3 base pairs each. Controls gene expression. |
| **Drug + Enzyme** | COX enzyme + aspirin-like molecule | Small Molecule–Protein | A drug enters the enzyme's active site pocket, blocking catalysis through competitive inhibition. |
| **Ion Channel + Membrane** | Transmembrane channel (4-helix bundle) + lipid bilayer | Protein–Membrane | The channel spans the lipid bilayer. Ions (green spheres) pass through the central pore. How neurons fire. |
| **ATP + Motor Protein** | Myosin motor + ATP molecule | Small Molecule–Protein | ATP binds to the motor and gets hydrolyzed, releasing energy that drives a power stroke. How muscles contract. |

## Simulation Phases

Each scenario plays through three phases:

1. **Approaching** — Molecule B moves toward Molecule A, with attractive force lines shown between them
2. **Bound** — The molecules dock; B pulses gently to indicate binding energy
3. **Active** — Conformational change occurs in A (rotation/wobble) showing functional response

## Controls

### Mouse
| Action | Input |
|--------|-------|
| Rotate | Left-drag |
| Pan | Right-drag |
| Zoom | Scroll wheel |

### UI Controls
- **Scenario** — dropdown to switch between interaction scenes
- **Sim Speed** — slider (0.1x – 3.0x) controlling animation speed
- **Show Bonds** — toggle bond visibility
- **Show Forces** — toggle attraction force lines during approach phase
- **Show Labels** — toggle molecule name labels floating above each group
- **Auto-Spin** — continuous rotation
- **Glow Effect** — Unreal Bloom post-processing
- **▶ Play / ⏸ Pause** — start or pause the docking simulation
- **↺ Reset** — return molecules to starting positions
- **📷 Screenshot** — save PNG of current view

### Keyboard Shortcuts
| Key | Action |
|-----|--------|
| `Space` | Play / Pause |
| `R` | Reset simulation |
| `S` | Toggle auto-spin |
| `F` | Toggle force lines |
| `P` | Screenshot |
| `←` `→` | Previous / Next scenario |

## How Real Protein Interactions Work

Proteins interact with other molecules through several types of forces:

| Force | Strength | Range | Example |
|-------|----------|-------|---------|
| **Covalent bonds** | Very strong | 1–2 Å | Disulfide bridges in antibodies |
| **Hydrogen bonds** | Moderate | 2–3 Å | Base pairing in DNA, enzyme active sites |
| **Electrostatic (ionic)** | Moderate | 3–5 Å | Salt bridges at protein interfaces |
| **Van der Waals** | Weak individually | 3–4 Å | Shape complementarity (lots of atoms = strong total) |
| **Hydrophobic effect** | Moderate (entropic) | N/A | Burying nonpolar surfaces away from water |

The "lock and key" metaphor (antibody-antigen) is classic, but modern biology favors "induced fit" — both molecules change shape upon binding.

## Project Structure

```
protein interactions/
├── index.html              # HTML shell, CDN imports, UI panels
├── styles.css              # Dark theme, glassmorphism, responsive
├── main.js                 # Three.js scene, simulation engine, controls
├── interaction-data.js     # Scene definitions + molecular generators
└── README.md
```

### File Details

**`interaction-data.js`** — All molecular data and scene definitions:
- `ELEMENTS` — Extended CPK definitions (C, N, O, H, S, P, Fe, Zn, Mg)
- `helixAtoms(n, radius, rise, phase, offset, label)` — Parametric alpha-helix generator
- `dnaStrand(bp, offset, label)` — Double-helix DNA with phosphate backbone
- `smallMolecule(type, offset, label)` — Generators for drug, ATP, lipid, ion
- `membrane(w, d, y, label)` — Lipid bilayer sheet
- `SCENES` — Array of 5 interaction scenarios with:
  - Generate function producing two molecular groups
  - Start/dock offset positions for animation
  - Molecule metadata (name, color, binding type)
  - Descriptions of the real biology

**`main.js`** — Simulation engine:
- Three.js scene with bloom post-processing, particles, grid
- `buildGroup()` — Renders atoms + bonds for a molecular group with tint coloring
- `simStep(dt)` — Physics loop: approach → bound → active phases with easing
- Force line visualization between approaching molecules
- Floating text labels via `CanvasTexture` + `Sprite`
- Raycaster hover with scale-up highlight
- Full keyboard shortcuts + UI wiring

## Technical Notes

- **No build step** — vanilla ES modules via `<script type="importmap">`
- **Three.js 0.160** from CDN
- **Two-group architecture** — molecules are in separate `THREE.Group` objects so groupB can be animated toward groupA without recalculating atom positions
- **Parametric generation** — all structures are simulated, not loaded from PDB files
- **Phase-based simulation** — simProgress 0→1 (approach), 1→2 (bound/active/complete)
- **Force lines** — dashed attractor lines fade out as molecules get closer

## Relationship to Protein Simulator

This project builds on the [protein simulator](../protein%20simulator/) which visualizes individual protein structures. This project adds:
- Multiple molecule groups interacting in the same scene
- Animated docking simulations
- Force visualization
- Molecule labels
- Play/pause/reset sim controls
- Five distinct biological interaction scenarios

## Dependencies

| Dependency | Version | Source |
|------------|---------|--------|
| Three.js | 0.160.0 | CDN (`unpkg.com`) |
| OrbitControls | 0.160.0 | CDN |
| EffectComposer + UnrealBloomPass | 0.160.0 | CDN |

No other dependencies. No `node_modules`. No bundler.
