# Protein Simulator — 3D Molecular Viewer

An interactive 3D molecular structure viewer that runs entirely in the browser. Built with **Three.js** (via CDN) — no build step, no npm install required.

![Three.js](https://img.shields.io/badge/Three.js-0.160-blue) ![Vanilla JS](https://img.shields.io/badge/Vanilla-JS-yellow) ![No Build](https://img.shields.io/badge/Build-None-green)

## Quick Start

The app uses ES modules, so it needs a local HTTP server (browsers block module imports over `file://`).

```bash
# Option 1: Python
python -m http.server 8080

# Option 2: Node.js
npx serve -l 8080
```

Then open **http://localhost:8080** in your browser.

## Features

### Mouse Controls
| Action | Input |
|--------|-------|
| Rotate | Left-click + drag |
| Pan | Right-click + drag |
| Zoom | Scroll wheel |

### Structure Selector
Switch between five simulated molecular structures via the dropdown:

| Structure | Description |
|-----------|-------------|
| **Alpha-Helix (α-Helix)** | The most common protein secondary structure. A right-handed coil stabilized by i → i+4 hydrogen bonds. Found in hemoglobin, keratin, and membrane proteins. |
| **Beta-Sheet (β-Sheet)** | Flat, pleated sheets of multiple antiparallel strands connected by hydrogen bonds. Found in silk fibroin, antibodies, and amyloid plaques. |
| **Beta-Hairpin (β-Hairpin)** | A single polypeptide chain that folds back on itself with a tight turn, forming two antiparallel beta-strands. |
| **Collagen Triple-Helix** | Three intertwined polyproline-II helices forming a right-handed super-coil. The most abundant protein in the human body. |
| **DNA Double-Helix** | Two antiparallel sugar-phosphate backbones with base pairs (A-T, G-C) connected by hydrogen bonds. B-form geometry. |

### Interactive Controls
- **Atom Size** — slider to scale all atom spheres (0.2× – 2.0×)
- **Show Bonds** — toggle bond visibility on/off
- **Auto-Spin** — continuous Y-axis rotation
- **Color Scheme** — CPK (element colors), Chain (segment coloring), or Residue (hue gradient)
- **Reset View** — return camera to default position
- **Hover Tooltip** — hover over any atom to see its element name and residue

### Element Colors (CPK Convention)
| Element | Color | Hex |
|---------|-------|-----|
| C — Carbon | Gray | `#909090` |
| N — Nitrogen | Blue | `#3050F8` |
| O — Oxygen | Red | `#FF0D0D` |
| H — Hydrogen | White | `#FFFFFF` |
| S — Sulfur | Yellow | `#FFFF30` |

## Project Structure

```
protein simulator/
├── index.html          # HTML shell, CDN imports, UI panels
├── styles.css          # Dark theme, glassmorphism panels, responsive layout
├── main.js             # Three.js scene, renderer, controls, raycaster, UI wiring
├── protein-data.js     # Structure generators + element/color definitions
└── README.md
```

### File Details

**`protein-data.js`** — Contains all molecular data generation:
- `ELEMENTS` — CPK color and radius definitions for C, N, O, H, S
- `AMINO_ACIDS` — Simplified side-chain templates for 8 amino acids (ALA, GLY, VAL, LEU, SER, CYS, GLU, LYS)
- `generateProtein(n)` — Parametric alpha-helix (3.6 residues/turn, 1.5 Å rise, 2.3 Å radius)
- `generateBetaSheet(n)` — Antiparallel beta-sheet with 4 strands and pleated geometry
- `generateBetaHairpin(n)` — Two-strand hairpin with semicircular turn
- `generateCollagen(n)` — Triple-helix with 3 chains at 120° phase offsets
- `generateDNA(n)` — Double-helix with sugar-phosphate backbones and base-pair hydrogen bonds
- `STRUCTURES` — Catalog array with metadata and generator functions for each structure
- `getChainColor()` / `getResidueColor()` — Color scheme helper functions

**`main.js`** — Scene management and interactivity:
- Three.js scene with `PerspectiveCamera`, `WebGLRenderer` (antialiased), and `FogExp2`
- `OrbitControls` with damping for smooth mouse interaction
- `buildMeshes()` — Rebuilds all atom spheres and bond cylinders from data arrays
- `loadStructure(idx)` — Hot-swaps the active structure by regenerating data and meshes
- Raycaster hover detection for atom tooltips
- Event listeners for all UI controls

**`styles.css`** — Visual design:
- CSS custom properties for dark theme tokens
- Glassmorphism panels (`backdrop-filter: blur`)
- Responsive layout with mobile breakpoints

## Technical Notes

- **No build step** — vanilla ES modules loaded via `<script type="importmap">`
- **Three.js 0.160** loaded from `unpkg.com` CDN
- **Shared geometries** — all atoms share one `SphereGeometry`, all bonds share one `CylinderGeometry`, scaled per-instance for performance
- **Auto-fit camera** — on structure switch, the camera repositions based on the bounding box size
- Structures are **entirely simulated** using parametric equations — no real PDB data

## Dependencies

| Dependency | Version | Source |
|------------|---------|--------|
| Three.js | 0.160.0 | CDN (`unpkg.com`) |
| OrbitControls | 0.160.0 | CDN (`unpkg.com`) |

No other dependencies. No `node_modules`. No bundler.
