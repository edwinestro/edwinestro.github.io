// Science Lab 5.2 — full periodic table (118 rooms)
// Source for names/masses: legacy ScienceLab v4 (legacy/stringball-endpoint/maze.html)
// Notes:
// - This is a visualization-driven lab, not a chemistry solver.
// - We include period/group + a coarse category classification for theming and quiz behavior.

// Ordered list (Z=1..118)
const SYMBOLS_118 = "H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og".split(/\s+/);

// Metadata (name + atomic mass as string; some are bracketed/approx masses)
const PERIODIC_META = [
  {sym:'H', name:'Hydrogen', mass:'1.008'}, {sym:'He', name:'Helium', mass:'4.0026'},
  {sym:'Li', name:'Lithium', mass:'6.94'}, {sym:'Be', name:'Beryllium', mass:'9.0122'},
  {sym:'B', name:'Boron', mass:'10.81'}, {sym:'C', name:'Carbon', mass:'12.011'},
  {sym:'N', name:'Nitrogen', mass:'14.007'}, {sym:'O', name:'Oxygen', mass:'15.999'},
  {sym:'F', name:'Fluorine', mass:'18.998'}, {sym:'Ne', name:'Neon', mass:'20.180'},
  {sym:'Na', name:'Sodium', mass:'22.990'}, {sym:'Mg', name:'Magnesium', mass:'24.305'},
  {sym:'Al', name:'Aluminium', mass:'26.982'}, {sym:'Si', name:'Silicon', mass:'28.085'},
  {sym:'P', name:'Phosphorus', mass:'30.974'}, {sym:'S', name:'Sulfur', mass:'32.06'},
  {sym:'Cl', name:'Chlorine', mass:'35.45'}, {sym:'Ar', name:'Argon', mass:'39.948'},
  {sym:'K', name:'Potassium', mass:'39.098'}, {sym:'Ca', name:'Calcium', mass:'40.078'},
  {sym:'Sc', name:'Scandium', mass:'44.956'}, {sym:'Ti', name:'Titanium', mass:'47.867'},
  {sym:'V', name:'Vanadium', mass:'50.942'}, {sym:'Cr', name:'Chromium', mass:'51.996'},
  {sym:'Mn', name:'Manganese', mass:'54.938'}, {sym:'Fe', name:'Iron', mass:'55.845'},
  {sym:'Co', name:'Cobalt', mass:'58.933'}, {sym:'Ni', name:'Nickel', mass:'58.693'},
  {sym:'Cu', name:'Copper', mass:'63.546'}, {sym:'Zn', name:'Zinc', mass:'65.38'},
  {sym:'Ga', name:'Gallium', mass:'69.723'}, {sym:'Ge', name:'Germanium', mass:'72.630'},
  {sym:'As', name:'Arsenic', mass:'74.922'}, {sym:'Se', name:'Selenium', mass:'78.971'},
  {sym:'Br', name:'Bromine', mass:'79.904'}, {sym:'Kr', name:'Krypton', mass:'83.798'},
  {sym:'Rb', name:'Rubidium', mass:'85.468'}, {sym:'Sr', name:'Strontium', mass:'87.62'},
  {sym:'Y', name:'Yttrium', mass:'88.906'}, {sym:'Zr', name:'Zirconium', mass:'91.224'},
  {sym:'Nb', name:'Niobium', mass:'92.906'}, {sym:'Mo', name:'Molybdenum', mass:'95.95'},
  {sym:'Tc', name:'Technetium', mass:'98'}, {sym:'Ru', name:'Ruthenium', mass:'101.07'},
  {sym:'Rh', name:'Rhodium', mass:'102.91'}, {sym:'Pd', name:'Palladium', mass:'106.42'},
  {sym:'Ag', name:'Silver', mass:'107.87'}, {sym:'Cd', name:'Cadmium', mass:'112.41'},
  {sym:'In', name:'Indium', mass:'114.82'}, {sym:'Sn', name:'Tin', mass:'118.71'},
  {sym:'Sb', name:'Antimony', mass:'121.76'}, {sym:'Te', name:'Tellurium', mass:'127.60'},
  {sym:'I', name:'Iodine', mass:'126.90'}, {sym:'Xe', name:'Xenon', mass:'131.29'},
  {sym:'Cs', name:'Caesium', mass:'132.91'}, {sym:'Ba', name:'Barium', mass:'137.33'},
  {sym:'La', name:'Lanthanum', mass:'138.91'}, {sym:'Ce', name:'Cerium', mass:'140.12'},
  {sym:'Pr', name:'Praseodymium', mass:'140.91'}, {sym:'Nd', name:'Neodymium', mass:'144.24'},
  {sym:'Pm', name:'Promethium', mass:'145'}, {sym:'Sm', name:'Samarium', mass:'150.36'},
  {sym:'Eu', name:'Europium', mass:'151.96'}, {sym:'Gd', name:'Gadolinium', mass:'157.25'},
  {sym:'Tb', name:'Terbium', mass:'158.93'}, {sym:'Dy', name:'Dysprosium', mass:'162.50'},
  {sym:'Ho', name:'Holmium', mass:'164.93'}, {sym:'Er', name:'Erbium', mass:'167.26'},
  {sym:'Tm', name:'Thulium', mass:'168.93'}, {sym:'Yb', name:'Ytterbium', mass:'173.05'},
  {sym:'Lu', name:'Lutetium', mass:'174.97'}, {sym:'Hf', name:'Hafnium', mass:'178.49'},
  {sym:'Ta', name:'Tantalum', mass:'180.95'}, {sym:'W', name:'Tungsten', mass:'183.84'},
  {sym:'Re', name:'Rhenium', mass:'186.21'}, {sym:'Os', name:'Osmium', mass:'190.23'},
  {sym:'Ir', name:'Iridium', mass:'192.22'}, {sym:'Pt', name:'Platinum', mass:'195.08'},
  {sym:'Au', name:'Gold', mass:'196.97'}, {sym:'Hg', name:'Mercury', mass:'200.59'},
  {sym:'Tl', name:'Thallium', mass:'204.38'}, {sym:'Pb', name:'Lead', mass:'207.2'},
  {sym:'Bi', name:'Bismuth', mass:'208.98'}, {sym:'Po', name:'Polonium', mass:'209'},
  {sym:'At', name:'Astatine', mass:'210'}, {sym:'Rn', name:'Radon', mass:'222'},
  {sym:'Fr', name:'Francium', mass:'223'}, {sym:'Ra', name:'Radium', mass:'226'},
  {sym:'Ac', name:'Actinium', mass:'227'}, {sym:'Th', name:'Thorium', mass:'232.04'},
  {sym:'Pa', name:'Protactinium', mass:'231.04'}, {sym:'U', name:'Uranium', mass:'238.03'},
  {sym:'Np', name:'Neptunium', mass:'237'}, {sym:'Pu', name:'Plutonium', mass:'244'},
  {sym:'Am', name:'Americium', mass:'243'}, {sym:'Cm', name:'Curium', mass:'247'},
  {sym:'Bk', name:'Berkelium', mass:'247'}, {sym:'Cf', name:'Californium', mass:'251'},
  {sym:'Es', name:'Einsteinium', mass:'252'}, {sym:'Fm', name:'Fermium', mass:'257'},
  {sym:'Md', name:'Mendelevium', mass:'258'}, {sym:'No', name:'Nobelium', mass:'259'},
  {sym:'Lr', name:'Lawrencium', mass:'266'}, {sym:'Rf', name:'Rutherfordium', mass:'267'},
  {sym:'Db', name:'Dubnium', mass:'268'}, {sym:'Sg', name:'Seaborgium', mass:'269'},
  {sym:'Bh', name:'Bohrium', mass:'270'}, {sym:'Hs', name:'Hassium', mass:'270'},
  {sym:'Mt', name:'Meitnerium', mass:'278'}, {sym:'Ds', name:'Darmstadtium', mass:'281'},
  {sym:'Rg', name:'Roentgenium', mass:'282'}, {sym:'Cn', name:'Copernicium', mass:'285'},
  {sym:'Nh', name:'Nihonium', mass:'286'}, {sym:'Fl', name:'Flerovium', mass:'289'},
  {sym:'Mc', name:'Moscovium', mass:'290'}, {sym:'Lv', name:'Livermorium', mass:'293'},
  {sym:'Ts', name:'Tennessine', mass:'294'}, {sym:'Og', name:'Oganesson', mass:'294'},
];

const META_BY_SYM = Object.fromEntries(PERIODIC_META.map((m) => [m.sym, m]));

// Period/group layout for the main table (18 groups).
// Lanthanides/actinides are handled separately.
const PERIOD_ROWS = [
  // period 1
  { period: 1, row: ['H', null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 'He'] },
  // period 2
  { period: 2, row: ['Li', 'Be', null, null, null, null, null, null, null, null, null, null, 'B', 'C', 'N', 'O', 'F', 'Ne'] },
  // period 3
  { period: 3, row: ['Na', 'Mg', null, null, null, null, null, null, null, null, null, null, 'Al', 'Si', 'P', 'S', 'Cl', 'Ar'] },
  // period 4
  { period: 4, row: ['K', 'Ca', 'Sc', 'Ti', 'V', 'Cr', 'Mn', 'Fe', 'Co', 'Ni', 'Cu', 'Zn', 'Ga', 'Ge', 'As', 'Se', 'Br', 'Kr'] },
  // period 5
  { period: 5, row: ['Rb', 'Sr', 'Y', 'Zr', 'Nb', 'Mo', 'Tc', 'Ru', 'Rh', 'Pd', 'Ag', 'Cd', 'In', 'Sn', 'Sb', 'Te', 'I', 'Xe'] },
  // period 6 (group 3 shown as La; lanthanides are handled separately)
  { period: 6, row: ['Cs', 'Ba', 'La', 'Hf', 'Ta', 'W', 'Re', 'Os', 'Ir', 'Pt', 'Au', 'Hg', 'Tl', 'Pb', 'Bi', 'Po', 'At', 'Rn'] },
  // period 7 (group 3 shown as Ac; actinides are handled separately)
  { period: 7, row: ['Fr', 'Ra', 'Ac', 'Rf', 'Db', 'Sg', 'Bh', 'Hs', 'Mt', 'Ds', 'Rg', 'Cn', 'Nh', 'Fl', 'Mc', 'Lv', 'Ts', 'Og'] },
];

const LAN = ['La','Ce','Pr','Nd','Pm','Sm','Eu','Gd','Tb','Dy','Ho','Er','Tm','Yb','Lu'];
const ACT = ['Ac','Th','Pa','U','Np','Pu','Am','Cm','Bk','Cf','Es','Fm','Md','No','Lr'];

const GP_BY_SYM = (() => {
  const map = {};
  for (const { period, row } of PERIOD_ROWS) {
    for (let g = 1; g <= 18; g++) {
      const sym = row[g - 1];
      if (sym) map[sym] = { period, group: g };
    }
  }
  // f-block: keep period, set group=3 for lab heuristics
  for (const sym of LAN) map[sym] = { period: 6, group: 3 };
  for (const sym of ACT) map[sym] = { period: 7, group: 3 };
  return map;
})();

const SET_NOBLE = new Set(['He','Ne','Ar','Kr','Xe','Rn','Og']);
const SET_HALOGEN = new Set(['F','Cl','Br','I','At','Ts']);
const SET_METALLOID = new Set(['B','Si','Ge','As','Sb','Te','Po']);
const SET_NONMETAL = new Set(['H','C','N','O','P','S','Se']);
const SET_LAN = new Set(LAN);
const SET_ACT = new Set(ACT);

function categoryFor(sym, gp) {
  if (SET_LAN.has(sym)) return 'lanthanide';
  if (SET_ACT.has(sym)) return 'actinide';
  if (SET_NOBLE.has(sym)) return 'noble gas';
  if (SET_HALOGEN.has(sym)) return 'halogen';
  if (SET_METALLOID.has(sym)) return 'metalloid';
  if (SET_NONMETAL.has(sym)) return 'nonmetal';
  if (gp?.group === 1) return 'alkali metal';
  if (gp?.group === 2) return 'alkaline earth';
  if (gp?.group >= 3 && gp?.group <= 12) return 'transition metal';
  return 'post-transition';
}

export const ELEMENTS_118 = SYMBOLS_118.map((sym, i) => {
  const num = i + 1;
  const meta = META_BY_SYM[sym];
  const gp = GP_BY_SYM[sym] || { period: null, group: null };
  return {
    symbol: sym,
    name: meta?.name || `Element ${sym}`,
    number: num,
    mass: meta?.mass || '—',
    period: gp.period,
    group: gp.group,
    category: categoryFor(sym, gp),
    // Optional for future: full electron configuration text.
    config: null,
  };
});

export function elementTheme(el) {
  // Category-based palette (used for walls + room lighting).
  const base = {
    'nonmetal': ['#9ae6ff', '#7aa2ff'],
    'noble gas': ['#c4b5fd', '#9ae6ff'],
    'alkali metal': ['#ffcf4d', '#ff8d5d'],
    'alkaline earth': ['#ffd93d', '#9ae6ff'],
    'halogen': ['#8affa8', '#9ae6ff'],
    'metalloid': ['#8affa8', '#7aa2ff'],
    'post-transition': ['#9ca3af', '#9ae6ff'],
    'transition metal': ['#ffcf4d', '#7aa2ff'],
    'lanthanide': ['#fb7185', '#a78bfa'],
    'actinide': ['#f97316', '#22d3ee'],
  };
  const pick = base[el.category] || ['#9ae6ff', '#7aa2ff'];

  // Tiny deterministic per-element variation
  const k = (el.number * 997) % 360;
  return {
    accentA: pick[0],
    accentB: pick[1],
    hue: k,
  };
}
