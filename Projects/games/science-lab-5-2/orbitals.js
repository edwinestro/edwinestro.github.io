// Science Lab 5.2 — orbital sampling (stylized but physically-inspired)
// Goal: produce "measurement-like" discrete positions that look like quantized orbitals.
// This is NOT a full quantum chemistry solver; it is an educational visualization.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// Random normal (Box–Muller)
export function randn(rng) {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

export function sampleUnitSphere(rng) {
  // Uniform direction
  const z = rng() * 2 - 1;
  const t = rng() * Math.PI * 2;
  const r = Math.sqrt(Math.max(0, 1 - z * z));
  return { x: r * Math.cos(t), y: r * Math.sin(t), z };
}

function gammaInt(rng, k, theta) {
  // Integer-shape Gamma(k, theta) by sum of exponentials.
  // k must be a positive integer.
  let s = 0;
  for (let i = 0; i < k; i++) {
    s += -Math.log(Math.max(1e-12, rng()));
  }
  return s * theta;
}

function sampleRadiusHydrogenicProxy(rng, n, l) {
  // More realistic (but still lightweight) radial proxy:
  // P(r) ~ r^{2l+2} * exp(-2r/(n a0)) (ignoring Laguerre polynomial nodes).
  // This corresponds to a gamma distribution with shape k = 2l+3 and scale theta = n/2.
  // - 1s (n=1,l=0): Gamma(3, 0.5) => correct qualitative form.
  // - 2p (n=2,l=1): Gamma(5, 1) => correct qualitative form.
  const k = 2 * l + 3;
  const theta = Math.max(0.35, n / 2);
  return gammaInt(rng, k, theta);
}

export function sampleOrbital(rng, { orbital = 'auto', n = 1 } = {}) {
  // Returns a 3D point in "atomic units".
  // Supported orbitals:
  // - s: spherical density
  // - pz: two-lobe density along z
  // - px: lobes along x
  // - py: lobes along y
  // - dxy, dxz, dyz, dx2y2, dz2: five d orbitals (angular proxy)
  // - fxyz, fz3, fxz2, fyz2, fz_x2y2, fx_x23y2, fy_3x2y2: seven f orbitals (angular proxy)

  const mode = orbital;

  if (mode === 's') {
    const dir = sampleUnitSphere(rng);
    const r = sampleRadiusHydrogenicProxy(rng, n, 0);
    return { x: dir.x * r, y: dir.y * r, z: dir.z * r };
  }

  // d orbitals: rejection sample direction by simple polynomial angular weights.
  // Note: this is a visualization proxy, not an exact spherical harmonic implementation.
  if (mode === 'dxy' || mode === 'dxz' || mode === 'dyz' || mode === 'dx2y2' || mode === 'dz2') {
    const nn = Math.max(3, n);
    const r = sampleRadiusHydrogenicProxy(rng, nn, 2);

    const weight = (dir) => {
      const x = dir.x;
      const y = dir.y;
      const z = dir.z;
      // weights are squared polynomials to keep >=0
      if (mode === 'dxy') return (x * y) * (x * y);
      if (mode === 'dxz') return (x * z) * (x * z);
      if (mode === 'dyz') return (y * z) * (y * z);
      if (mode === 'dx2y2') {
        const t = x * x - y * y;
        return t * t;
      }
      // dz2 ~ (3z^2 - r^2)^2, on unit sphere r^2=1 => (3z^2-1)^2
      const t = 3 * z * z - 1;
      return t * t;
    };

    // Normalize acceptance: max weight is <=1 for these polynomials on unit sphere.
    // We bias acceptance a bit stronger to create clearer lobes.
    for (let i = 0; i < 100; i++) {
      const dir = sampleUnitSphere(rng);
      const w = weight(dir);
      // tweak factor: w^0.7 increases acceptance but keeps shape
      const a = Math.pow(Math.min(1, w * 6), 0.7);
      if (rng() < a) {
        return { x: dir.x * r, y: dir.y * r, z: dir.z * r };
      }
    }
    // fallback
    const dir = sampleUnitSphere(rng);
    return { x: dir.x * r, y: dir.y * r, z: dir.z * r };
  }

  // f orbitals: rejection sample direction by polynomial angular weights.
  // Again, this is a visualization proxy to get correct “lobe topology”.
  if (
    mode === 'fxyz' ||
    mode === 'fz3' ||
    mode === 'fxz2' ||
    mode === 'fyz2' ||
    mode === 'fz_x2y2' ||
    mode === 'fx_x23y2' ||
    mode === 'fy_3x2y2'
  ) {
    const nn = Math.max(4, n);
    const r = sampleRadiusHydrogenicProxy(rng, nn, 3);

    const weight = (dir) => {
      const x = dir.x;
      const y = dir.y;
      const z = dir.z;
      // Use squared polynomials; coefficients chosen for qualitative shape.
      if (mode === 'fxyz') {
        const t = x * y * z;
        return t * t;
      }
      if (mode === 'fz3') {
        // z(5z^2-3) ~ l=3, m=0 proxy
        const t = z * (5 * z * z - 3);
        return t * t;
      }
      if (mode === 'fxz2') {
        const t = x * (5 * z * z - 1);
        return t * t;
      }
      if (mode === 'fyz2') {
        const t = y * (5 * z * z - 1);
        return t * t;
      }
      if (mode === 'fz_x2y2') {
        const t = z * (x * x - y * y);
        return t * t;
      }
      if (mode === 'fx_x23y2') {
        const t = x * (x * x - 3 * y * y);
        return t * t;
      }
      // fy_3x2y2
      const t = y * (3 * x * x - y * y);
      return t * t;
    };

    for (let i = 0; i < 160; i++) {
      const dir = sampleUnitSphere(rng);
      const w = weight(dir);
      const a = Math.pow(Math.min(1, w * 14), 0.65);
      if (rng() < a) {
        return { x: dir.x * r, y: dir.y * r, z: dir.z * r };
      }
    }

    const dir = sampleUnitSphere(rng);
    return { x: dir.x * r, y: dir.y * r, z: dir.z * r };
  }

  // p orbitals: rejection sample for |cos(theta)| weighting to create lobes.
  // This is a visual approximation.
  const axis = mode === 'px' ? 'x' : mode === 'py' ? 'y' : 'z';

  while (true) {
    const dir = sampleUnitSphere(rng);
    const a = Math.abs(dir[axis]);
    // acceptance ~ a^2 to create stronger lobes
    if (rng() < a * a) {
      const r = sampleRadiusHydrogenicProxy(rng, Math.max(2, n), 1);
      return { x: dir.x * r, y: dir.y * r, z: dir.z * r };
    }
  }
}

export function chooseOrbitalForElement(el, orbitalMode = 'auto', rng) {
  // Hydrogen (Z=1) has one electron and its ground state is 1s.
  // For Science Lab 5.2 MVP we lock Hydrogen to s so users don't get a misleading "px" option.
  // (Later we can add an explicit "excite" mode to demonstrate 2p states.)
  if (el.number === 1) return 's';

  if (orbitalMode !== 'auto') return orbitalMode;

  // Heuristic: main group uses s/p as valence visualization.
  // Transition metals: still show p (looks good) but allow cycling.
  if (el.group === 18) return 's';
  if (el.group === 17) return rng() < 0.5 ? 'pz' : 'px';
  if (el.category.includes('transition')) return rng() < 0.5 ? 'px' : 'py';
  // Groups 13–16: p orbitals look appropriate as valence-like shapes.
  if (el.group >= 13 && el.group <= 16) return rng() < 0.33 ? 'px' : rng() < 0.66 ? 'py' : 'pz';
  // default: s
  return 's';
}

export function orbitalLabel(orbital) {
  if (orbital === 'auto') return 'Auto';
  if (orbital === 's') return 's';
  if (orbital === 'px') return 'pₓ';
  if (orbital === 'py') return 'pᵧ';
  if (orbital === 'pz') return 'p_z';
  if (orbital === 'dxy') return 'd_xy';
  if (orbital === 'dxz') return 'd_xz';
  if (orbital === 'dyz') return 'd_yz';
  if (orbital === 'dx2y2') return 'd_(x²−y²)';
  if (orbital === 'dz2') return 'd_z²';
  if (orbital === 'fxyz') return 'f_xyz';
  if (orbital === 'fz3') return 'f_z³';
  if (orbital === 'fxz2') return 'f_xz²';
  if (orbital === 'fyz2') return 'f_yz²';
  if (orbital === 'fz_x2y2') return 'f_z(x²−y²)';
  if (orbital === 'fx_x23y2') return 'f_x(x²−3y²)';
  if (orbital === 'fy_3x2y2') return 'f_y(3x²−y²)';
  return orbital;
}
