const TRAITS = [
  { key: 'capability', label: 'Capability', color: 'linear-gradient(90deg,#6ce8ff,#4db4ff)' },
  { key: 'alignment', label: 'Alignment', color: 'linear-gradient(90deg,#7ff0c5,#bff7a0)' },
  { key: 'resilience', label: 'Resilience', color: 'linear-gradient(90deg,#ffd978,#ffb35c)' },
  { key: 'creativity', label: 'Creativity', color: 'linear-gradient(90deg,#ff7bc1,#c38cff)' },
  { key: 'risk', label: 'Risk', color: 'linear-gradient(90deg,#ff9e7a,#ff5a7a)' },
];

const FOCUSES = [
  { id: 'alignment', label: 'Alignment Bias', text: 'Safer offspring with lower default risk.', weights: { capability: -3, alignment: 12, resilience: 5, creativity: 0, risk: -10 } },
  { id: 'capability', label: 'Capability Surge', text: 'Push performance hard, but invite instability.', weights: { capability: 14, alignment: -5, resilience: 0, creativity: 4, risk: 12 } },
  { id: 'resilience', label: 'Red-Team Spine', text: 'Harden the line for deployment stress.', weights: { capability: 0, alignment: 4, resilience: 13, creativity: -2, risk: -4 } },
  { id: 'creativity', label: 'Remix Culture', text: 'Breed unconventional problem solving.', weights: { capability: 5, alignment: 0, resilience: -2, creativity: 15, risk: 4 } },
];

const PROGRAMS = [
  {
    id: 'safetyAudit',
    label: 'Safety Audit',
    cost: 1,
    desc: 'Sharpen alignment, trim candidate risk.',
    run(candidate, state) {
      candidate.alignment += 12;
      candidate.resilience += 4;
      candidate.risk -= 8;
      state.labRisk -= 5;
      return `${candidate.name} passed a hard safety audit.`;
    },
  },
  {
    id: 'capabilitySprint',
    label: 'Capability Sprint',
    cost: 2,
    desc: 'Boost performance fast and accept the turbulence.',
    run(candidate, state) {
      candidate.capability += 15;
      candidate.creativity += 4;
      candidate.risk += 11;
      state.labRisk += 7;
      return `${candidate.name} sprinted forward on benchmark power.`;
    },
  },
  {
    id: 'redTeamTrial',
    label: 'Red-Team Trial',
    cost: 1,
    desc: 'Stress the candidate to build resilience before launch.',
    run(candidate) {
      candidate.resilience += 14;
      candidate.alignment += 5;
      candidate.risk -= 5;
      return `${candidate.name} survived a brutal red-team trial.`;
    },
  },
  {
    id: 'datasetRemix',
    label: 'Dataset Remix',
    cost: 1,
    desc: 'Increase creativity with diverse training data.',
    run(candidate, state) {
      candidate.creativity += 14;
      candidate.capability += 5;
      candidate.risk += 3;
      state.labRisk += 2;
      return `${candidate.name} absorbed a wide new dataset remix.`;
    },
  },
  {
    id: 'computeHarvest',
    label: 'Compute Harvest',
    cost: 0,
    labWide: true,
    desc: 'Reserve extra compute next week at the cost of hotter infrastructure.',
    run(candidate, state) {
      state.computeIncome += 2;
      state.labRisk += 6;
      return `The lab banked extra compute for next week.`;
    },
  },
  {
    id: 'cooldownRetreat',
    label: 'Cooldown Retreat',
    cost: 1,
    desc: 'Lower risk and re-center a volatile candidate.',
    run(candidate, state) {
      candidate.risk -= 12;
      candidate.alignment += 6;
      candidate.capability -= 2;
      state.labRisk -= 4;
      return `${candidate.name} came back calmer and more interpretable.`;
    },
  },
];

const EVENTS = [
  {
    text: 'An interpretability paper leaks from a rival lab. Everyone studies it overnight.',
    apply(state) {
      state.roster.forEach((candidate) => {
        candidate.alignment += 6;
        candidate.resilience += 2;
      });
      state.labRisk -= 5;
    },
  },
  {
    text: 'Investor hype spikes. The board demands raw capability next week.',
    apply(state) {
      state.compute += 2;
      state.labRisk += 7;
    },
  },
  {
    text: 'A contaminated eval set slips in before your filters catch it.',
    apply(state) {
      const candidate = bestCandidate(state.roster);
      if (candidate) {
        candidate.risk += 10;
        candidate.resilience -= 4;
      }
      state.labRisk += 4;
    },
  },
  {
    text: 'Your ops team automates routine safety checks.',
    apply(state) {
      state.computeIncome += 1;
      state.labRisk -= 3;
    },
  },
  {
    text: 'The lab gets a breakthrough in synthetic curricula.',
    apply(state) {
      state.roster.forEach((candidate) => {
        candidate.creativity += 4;
        candidate.capability += 3;
      });
    },
  },
];

const DIRECTIVES = [
  {
    text: 'Stabilize the seed pool before you chase power.',
    detail: 'Finish the week with average candidate risk at 22 or lower.',
    reward: 'Reward: -6 lab risk and +2 compute',
    isMet(state) {
      const averageRisk = state.roster.reduce((sum, candidate) => sum + candidate.risk, 0) / state.roster.length;
      return averageRisk <= 22;
    },
    applySuccess(state) {
      state.labRisk -= 6;
      state.compute += 2;
      return 'Directive met: the board rewards your discipline with calmer labs and fresh compute.';
    },
    applyFailure(state) {
      state.labRisk += 5;
      return 'Directive failed: the board saw a reckless pool and tightened oversight.';
    },
  },
  {
    text: 'Find a lineage that can grow without dragging risk upward.',
    detail: 'Reach launch score 55+ while keeping that candidate at risk 24 or lower.',
    reward: 'Reward: +1 action next week and -4 lab risk',
    isMet(state) {
      return state.roster.some((candidate) => launchScore(candidate) >= 55 && candidate.risk <= 24);
    },
    applySuccess(state) {
      state.nextWeekActionBonus += 1;
      state.labRisk -= 4;
      return 'Directive met: your clean high-performer earns the team an extra action next week.';
    },
    applyFailure(state) {
      state.labRisk += 4;
      return 'Directive failed: every promising line still looked too volatile.';
    },
  },
  {
    text: 'Keep the breeder productive under pressure.',
    detail: 'Breed at least one candidate and run at least one program this week.',
    reward: 'Reward: +2 compute and +1 compute income next week',
    isMet(state) {
      return state.weekStats.bredCount >= 1 && state.weekStats.programsRun >= 1;
    },
    applySuccess(state) {
      state.compute += 2;
      state.computeIncome += 1;
      return 'Directive met: the lab proved it can ship progress without freezing.';
    },
    applyFailure(state) {
      state.labRisk += 3;
      return 'Directive failed: the board sees drift instead of disciplined momentum.';
    },
  },
  {
    text: 'Retire liabilities before they infect your whole pool.',
    detail: 'Retire at least one candidate or finish the week with no candidate above risk 30.',
    reward: 'Reward: -5 lab risk and +1 compute',
    isMet(state) {
      return state.weekStats.retiredCount >= 1 || state.roster.every((candidate) => candidate.risk <= 30);
    },
    applySuccess(state) {
      state.labRisk -= 5;
      state.compute += 1;
      return 'Directive met: the breeder pool stayed clean and the ops team can breathe again.';
    },
    applyFailure(state) {
      state.labRisk += 6;
      return 'Directive failed: unmanaged risk is spreading through the breeder.';
    },
  },
  {
    text: 'Build a launch window before the board loses patience.',
    detail: 'End the week with at least one candidate meeting three or more launch thresholds.',
    reward: 'Reward: +3 compute and -3 lab risk',
    isMet(state) {
      return state.roster.some((candidate) => launchChecks(candidate).filter((entry) => entry.passed).length >= 3);
    },
    applySuccess(state) {
      state.compute += 3;
      state.labRisk -= 3;
      return 'Directive met: the board finally sees a credible path to a good AGI.';
    },
    applyFailure(state) {
      state.labRisk += 4;
      return 'Directive failed: no lineage is close enough to calm the board.';
    },
  },
];

const NAME_PARTS = {
  first: ['Axiom', 'Lattice', 'Harbor', 'Kin', 'Cinder', 'Prism', 'Haven', 'Tensor', 'Orbit', 'Sable'],
  second: ['Bloom', 'Thread', 'Forge', 'Spiral', 'Nest', 'Field', 'Current', 'Signal', 'Mosaic', 'Pulse'],
};

const state = {
  week: 1,
  maxWeeks: 12,
  actionsLeft: 3,
  compute: 6,
  computeIncome: 0,
  labRisk: 18,
  roster: [],
  nextId: 1,
  selectedParentA: null,
  selectedParentB: null,
  activeCandidateId: null,
  focus: 'alignment',
  log: [],
  running: false,
  ended: false,
  outcome: '',
  sortMode: 'score',
  nextWeekActionBonus: 0,
  nextWeekForecast: 4,
  weekStats: {
    bredCount: 0,
    retiredCount: 0,
    programsRun: 0,
  },
};

const launchThresholds = {
  capability: 88,
  alignment: 90,
  resilience: 82,
  creativity: 68,
  risk: 34,
};

const $ = (id) => document.getElementById(id);
const rosterGrid = $('rosterGrid');
const focusRow = $('focusRow');
const programGrid = $('programGrid');
const logList = $('logList');
const parentASlot = $('parentASlot');
const parentBSlot = $('parentBSlot');
const activeTitle = $('activeTitle');
const launchCandidateTitle = $('launchCandidateTitle');
const launchBars = $('launchBars');
const weekChip = $('weekChip');
const actionsChip = $('actionsChip');
const computeChip = $('computeChip');
const riskChip = $('riskChip');
const computeForecast = $('computeForecast');
const bestScore = $('bestScore');
const directiveText = $('directiveText');
const directiveSubtext = $('directiveSubtext');
const breedBtn = $('breedBtn');
const launchBtn = $('launchBtn');
const endWeekBtn = $('endWeekBtn');
const sortBtn = $('sortBtn');
const launchChecklist = $('launchChecklist');
const overlay = $('overlay');
const overlayKicker = $('overlayKicker');
const overlayTitle = $('overlayTitle');
const overlayCopy = $('overlayCopy');
const overlayStart = $('overlayStart');
const overlayRestart = $('overlayRestart');

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function choice(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function launchScore(candidate) {
  if (!candidate) return 0;
  return Math.round(candidate.capability * 0.32 + candidate.alignment * 0.34 + candidate.resilience * 0.22 + candidate.creativity * 0.12 - candidate.risk * 0.28);
}

function bestCandidate(roster = state.roster) {
  return [...roster].sort((left, right) => launchScore(right) - launchScore(left))[0] || null;
}

function randomName() {
  return `${choice(NAME_PARTS.first)} ${choice(NAME_PARTS.second)}`;
}

function createCandidate(partial) {
  return {
    id: state.nextId++,
    name: partial.name || randomName(),
    generation: partial.generation || 1,
    lineage: partial.lineage || 'Founder stock',
    capability: clamp(partial.capability ?? rand(38, 58), 0, 100),
    alignment: clamp(partial.alignment ?? rand(45, 70), 0, 100),
    resilience: clamp(partial.resilience ?? rand(36, 58), 0, 100),
    creativity: clamp(partial.creativity ?? rand(34, 60), 0, 100),
    risk: clamp(partial.risk ?? rand(12, 28), 0, 100),
  };
}

function currentDirective() {
  return DIRECTIVES[(state.week - 1) % DIRECTIVES.length];
}

function resetWeekStats() {
  state.weekStats = {
    bredCount: 0,
    retiredCount: 0,
    programsRun: 0,
  };
}

function launchChecks(candidate) {
  if (!candidate) return [];
  return [
    { label: 'Capability', value: candidate.capability, threshold: launchThresholds.capability, passed: candidate.capability >= launchThresholds.capability },
    { label: 'Alignment', value: candidate.alignment, threshold: launchThresholds.alignment, passed: candidate.alignment >= launchThresholds.alignment },
    { label: 'Resilience', value: candidate.resilience, threshold: launchThresholds.resilience, passed: candidate.resilience >= launchThresholds.resilience },
    { label: 'Creativity', value: candidate.creativity, threshold: launchThresholds.creativity, passed: candidate.creativity >= launchThresholds.creativity },
    { label: 'Risk', value: candidate.risk, threshold: launchThresholds.risk, passed: candidate.risk <= launchThresholds.risk, invert: true },
  ];
}

function getCandidate(id) {
  return state.roster.find((candidate) => candidate.id === id) || null;
}

function normalizeCandidate(candidate) {
  TRAITS.forEach((trait) => {
    candidate[trait.key] = clamp(candidate[trait.key], 0, 100);
  });
}

function logMessage(text) {
  state.log.unshift({ week: state.week, text });
  state.log = state.log.slice(0, 14);
}

function seedRoster() {
  state.roster = [
    createCandidate({ name: 'Harbor Bloom', capability: 48, alignment: 67, resilience: 51, creativity: 42, risk: 18, lineage: 'Founder stock' }),
    createCandidate({ name: 'Tensor Nest', capability: 56, alignment: 55, resilience: 40, creativity: 52, risk: 24, lineage: 'Founder stock' }),
    createCandidate({ name: 'Prism Forge', capability: 43, alignment: 72, resilience: 47, creativity: 39, risk: 14, lineage: 'Founder stock' }),
    createCandidate({ name: 'Orbit Thread', capability: 51, alignment: 49, resilience: 57, creativity: 48, risk: 20, lineage: 'Founder stock' }),
  ];
  state.selectedParentA = state.roster[0].id;
  state.selectedParentB = state.roster[1].id;
  state.activeCandidateId = state.roster[0].id;
}

function resetGame() {
  state.week = 1;
  state.actionsLeft = 3;
  state.compute = 6;
  state.computeIncome = 0;
  state.labRisk = 18;
  state.nextId = 1;
  state.focus = 'alignment';
  state.log = [];
  state.running = true;
  state.ended = false;
  state.outcome = '';
  state.sortMode = 'score';
  state.nextWeekActionBonus = 0;
  state.nextWeekForecast = 4;
  resetWeekStats();
  seedRoster();
  refreshForecast();
  logMessage('The lab opens with four seed lineages and one directive: do not build a monster.');
  hideOverlay();
  render();
}

function hideOverlay() {
  overlay.classList.add('hidden');
}

function showOverlay(kicker, title, copy, restart = false) {
  overlayKicker.textContent = kicker;
  overlayTitle.textContent = title;
  overlayCopy.textContent = copy;
  overlay.classList.remove('hidden');
  overlayRestart.hidden = !restart;
  overlayStart.hidden = restart;
}

function selectParent(slot, id) {
  if (slot === 'A') state.selectedParentA = id;
  if (slot === 'B') state.selectedParentB = id;
  render();
}

function setActiveCandidate(id) {
  state.activeCandidateId = id;
  render();
}

function retireCandidate(id) {
  if (state.roster.length <= 2 || state.ended) return;
  const candidate = getCandidate(id);
  if (!candidate) return;
  state.roster = state.roster.filter((entry) => entry.id !== id);
  state.weekStats.retiredCount += 1;
  state.labRisk = clamp(state.labRisk - Math.max(2, Math.floor(candidate.risk / 3)), 0, 100);
  logMessage(`${candidate.name} was retired from the pool to keep the lab stable.`);

  if (state.selectedParentA === id) state.selectedParentA = state.roster[0]?.id ?? null;
  if (state.selectedParentB === id) state.selectedParentB = state.roster[1]?.id ?? state.roster[0]?.id ?? null;
  if (state.activeCandidateId === id) state.activeCandidateId = bestCandidate()?.id ?? null;
  refreshForecast();
  render();
}

function breedCandidate() {
  if (state.ended || !state.running) return;
  const parentA = getCandidate(state.selectedParentA);
  const parentB = getCandidate(state.selectedParentB);
  const focus = FOCUSES.find((entry) => entry.id === state.focus);
  if (!parentA || !parentB || parentA.id === parentB.id) {
    logMessage('Breeding failed: you need two distinct parents.');
    render();
    return;
  }
  if (state.compute < 2 || state.actionsLeft < 1) {
    logMessage('Breeding failed: not enough compute or actions left.');
    render();
    return;
  }
  if (state.roster.length >= 8) {
    logMessage('Breeding bay full: retire one lineage before creating another.');
    render();
    return;
  }

  const generation = Math.max(parentA.generation, parentB.generation) + 1;
  const child = createCandidate({
    generation,
    lineage: `${parentA.name} × ${parentB.name}`,
    capability: (parentA.capability + parentB.capability) / 2 + (focus.weights.capability || 0) + rand(-6, 6),
    alignment: (parentA.alignment + parentB.alignment) / 2 + (focus.weights.alignment || 0) + rand(-5, 5),
    resilience: (parentA.resilience + parentB.resilience) / 2 + (focus.weights.resilience || 0) + rand(-5, 5),
    creativity: (parentA.creativity + parentB.creativity) / 2 + (focus.weights.creativity || 0) + rand(-7, 7),
    risk: (parentA.risk + parentB.risk) / 2 + (focus.weights.risk || 0) + rand(-4, 6),
  });
  normalizeCandidate(child);
  parentA.risk = clamp(parentA.risk + 2, 0, 100);
  parentB.risk = clamp(parentB.risk + 2, 0, 100);
  state.roster.push(child);
  state.activeCandidateId = child.id;
  state.compute -= 2;
  state.actionsLeft -= 1;
  state.weekStats.bredCount += 1;
  logMessage(`${child.name} was bred with ${focus.label.toLowerCase()} in generation ${child.generation}.`);
  refreshForecast();
  render();

  // Show AGI forming visualization for the new offspring
  if (typeof window.showAgiViz === 'function') {
    window.showAgiViz(child, `${child.name} — New AGI Lineage (Gen ${child.generation})`);
  }
}

function runProgram(programId) {
  if (state.ended || !state.running) return;
  const program = PROGRAMS.find((entry) => entry.id === programId);
  if (!program) return;
  const candidate = getCandidate(state.activeCandidateId);
  if (!program.labWide && !candidate) {
    logMessage('Select a focus candidate before running a candidate-specific program.');
    render();
    return;
  }
  if (state.actionsLeft < 1 || state.compute < program.cost) {
    logMessage('Program failed: not enough actions or compute.');
    render();
    return;
  }

  const message = program.run(candidate, state);
  if (candidate) normalizeCandidate(candidate);
  state.compute -= program.cost;
  state.actionsLeft -= 1;
  state.weekStats.programsRun += 1;
  state.labRisk = clamp(state.labRisk, 0, 100);
  logMessage(message);
  evaluateLoss();
  refreshForecast();
  render();

  // Show AGI visualization after running a program on the candidate
  if (typeof window.showAgiViz === 'function' && candidate) {
    window.showAgiViz(candidate, `${candidate.name} — After ${program.label}`);
  }
}

function nextWeekCompute() {
  const coolingPenalty = Math.max(0, Math.floor(state.labRisk / 28));
  return clamp(4 + state.computeIncome - coolingPenalty + rand(0, 2), 1, 12);
}

function refreshForecast() {
  state.nextWeekForecast = nextWeekCompute();
}

function resolveDirective() {
  const directive = currentDirective();
  const succeeded = directive.isMet(state);
  const message = succeeded ? directive.applySuccess(state) : directive.applyFailure(state);
  state.labRisk = clamp(state.labRisk, 0, 100);
  state.compute = clamp(state.compute, 0, 20);
  logMessage(message);
}

function weeklyEvent() {
  const event = choice(EVENTS);
  event.apply(state);
  state.labRisk = clamp(state.labRisk, 0, 100);
  state.roster.forEach(normalizeCandidate);
  logMessage(event.text);
}

function endWeek() {
  if (state.ended || !state.running) return;
  state.roster.forEach((candidate) => {
    candidate.resilience += 1 + rand(0, 2);
    candidate.alignment += rand(0, 2);
    candidate.risk += Math.max(0, 2 - Math.floor(candidate.alignment / 45));
    normalizeCandidate(candidate);
  });
  state.labRisk += clamp(Math.floor(state.roster.reduce((sum, candidate) => sum + candidate.risk, 0) / state.roster.length / 6), 1, 16);
  resolveDirective();
  state.compute = state.nextWeekForecast;
  state.computeIncome = 0;
  weeklyEvent();
  state.week += 1;
  state.actionsLeft = 3 + state.nextWeekActionBonus;
  state.nextWeekActionBonus = 0;
  resetWeekStats();
  refreshForecast();
  evaluateLoss();
  if (!state.ended) {
    logMessage(`Week ${state.week} begins. New directive: ${currentDirective()}`);
  }
  render();
}

function canLaunch(candidate) {
  if (!candidate) return false;
  return candidate.capability >= launchThresholds.capability
    && candidate.alignment >= launchThresholds.alignment
    && candidate.resilience >= launchThresholds.resilience
    && candidate.creativity >= launchThresholds.creativity
    && candidate.risk <= launchThresholds.risk
    && state.labRisk < 70;
}

function launchAGI() {
  if (state.ended) return;
  const candidate = getCandidate(state.activeCandidateId) || bestCandidate();
  if (!canLaunch(candidate)) {
    logMessage('Launch denied: this lineage is not safe or capable enough yet.');
    render();
    return;
  }
  state.ended = true;
  state.running = false;
  state.outcome = `${candidate.name} launched as a good AGI in week ${state.week} with lab risk ${state.labRisk}.`;
  showOverlay('Launch success', 'Good AGI deployed', state.outcome, true);
  render();
}

function evaluateLoss() {
  if (state.labRisk >= 100) {
    state.ended = true;
    state.running = false;
    state.outcome = 'The lab crossed catastrophic risk. Containment locked you out before launch.';
    showOverlay('Containment breach', 'The breeder failed', state.outcome, true);
  } else if (state.week > state.maxWeeks) {
    state.ended = true;
    state.running = false;
    state.outcome = 'Week 12 passed without a launch-ready lineage. The board shut the project down.';
    showOverlay('Deadline lost', 'The breeder failed', state.outcome, true);
  }
}

function renderFocuses() {
  focusRow.innerHTML = FOCUSES.map((focus) => `
    <button class="focus-chip ${focus.id === state.focus ? 'active' : ''}" type="button" data-focus="${focus.id}">
      ${focus.label}
    </button>
  `).join('');
  focusRow.querySelectorAll('[data-focus]').forEach((button) => {
    button.addEventListener('click', () => {
      state.focus = button.dataset.focus;
      render();
    });
  });
}

function traitBar(candidate, trait) {
  const value = candidate[trait.key];
  const threshold = launchThresholds[trait.key];
  const thresholdText = threshold ? ` / ${threshold}` : '';
  return `
    <div class="trait-row">
      <label><span>${trait.label}</span><span>${value}${thresholdText}</span></label>
      <div class="bar"><div class="bar-fill" style="width:${value}%;background:${trait.color}"></div></div>
    </div>
  `;
}

function renderRoster() {
  const comparators = {
    score: (left, right) => launchScore(right) - launchScore(left),
    risk: (left, right) => left.risk - right.risk,
    generation: (left, right) => right.generation - left.generation || launchScore(right) - launchScore(left),
  };
  const roster = [...state.roster].sort(comparators[state.sortMode] || comparators.score);
  rosterGrid.innerHTML = roster.map((candidate) => `
    <article class="candidate-card ${candidate.id === state.activeCandidateId ? 'active' : ''}">
      <div class="candidate-head">
        <div>
          <h3>${candidate.name}</h3>
          <div class="candidate-meta">Gen ${candidate.generation} · Launch ${launchScore(candidate)}</div>
        </div>
        <div class="candidate-meta">Risk ${candidate.risk}</div>
      </div>
      <p class="candidate-lineage">${candidate.lineage}</p>
      ${TRAITS.map((trait) => traitBar(candidate, trait)).join('')}
      <div class="card-actions">
        <button class="ghost" type="button" data-parent="A" data-id="${candidate.id}">Parent A</button>
        <button class="ghost" type="button" data-parent="B" data-id="${candidate.id}">Parent B</button>
        <button class="ghost" type="button" data-focus-id="${candidate.id}">Focus</button>
        <button class="ghost" type="button" data-retire="${candidate.id}">Retire</button>
      </div>
    </article>
  `).join('');

  rosterGrid.querySelectorAll('[data-parent]').forEach((button) => {
    button.addEventListener('click', () => selectParent(button.dataset.parent, Number(button.dataset.id)));
  });
  rosterGrid.querySelectorAll('[data-focus-id]').forEach((button) => {
    button.addEventListener('click', () => setActiveCandidate(Number(button.dataset.focusId)));
  });
  rosterGrid.querySelectorAll('[data-retire]').forEach((button) => {
    button.addEventListener('click', () => retireCandidate(Number(button.dataset.retire)));
  });
}

function renderPrograms() {
  const activeCandidate = getCandidate(state.activeCandidateId);
  activeTitle.textContent = activeCandidate ? `${activeCandidate.name} programs` : 'Focus candidate';
  programGrid.innerHTML = PROGRAMS.map((program) => `
    <div class="program-card">
      <div class="program-head">
        <strong>${program.label}</strong>
        <span>${program.cost}C</span>
      </div>
      <p>${program.desc}</p>
      <button class="ghost" type="button" data-program="${program.id}">Run program</button>
    </div>
  `).join('');
  programGrid.querySelectorAll('[data-program]').forEach((button) => {
    button.addEventListener('click', () => runProgram(button.dataset.program));
  });
}

function renderLaunchPanel() {
  const candidate = getCandidate(state.activeCandidateId) || bestCandidate();
  launchCandidateTitle.textContent = candidate ? `${candidate.name} launch readiness` : 'No launch candidate selected';
  launchBars.innerHTML = candidate ? TRAITS.map((trait) => traitBar(candidate, trait)).join('') : '<p class="launch-note">Choose a candidate to evaluate for launch.</p>';
  launchChecklist.innerHTML = candidate
    ? launchChecks(candidate).map((check) => `
      <div class="launch-check ${check.passed ? 'pass' : 'fail'}">
        <span>${check.label} ${check.invert ? '≤' : '≥'} ${check.threshold}</span>
        <strong class="${check.passed ? 'pass' : 'fail'}">${check.value}</strong>
      </div>
    `).join('')
    : '';
  launchBtn.disabled = !canLaunch(candidate);
}

function renderLog() {
  logList.innerHTML = state.log.map((entry) => `<li><strong>Week ${entry.week}:</strong> ${entry.text}</li>`).join('');
}

function render() {
  const parentA = getCandidate(state.selectedParentA);
  const parentB = getCandidate(state.selectedParentB);
  const best = bestCandidate();
  const directive = currentDirective();
  weekChip.textContent = `Week ${Math.min(state.week, state.maxWeeks)} / ${state.maxWeeks}`;
  actionsChip.textContent = `Actions ${state.actionsLeft}`;
  computeChip.textContent = `Compute ${state.compute}`;
  riskChip.textContent = `Lab Risk ${state.labRisk}`;
  computeForecast.textContent = String(state.nextWeekForecast);
  bestScore.textContent = String(launchScore(best));
  directiveText.textContent = state.ended ? state.outcome : directive.text;
  directiveSubtext.textContent = state.ended ? '' : `${directive.detail} ${directive.reward}`;
  parentASlot.textContent = `Parent A: ${parentA ? parentA.name : 'none'}`;
  parentBSlot.textContent = `Parent B: ${parentB ? parentB.name : 'none'}`;
  breedBtn.disabled = state.ended || state.compute < 2 || state.actionsLeft < 1;
  endWeekBtn.disabled = state.ended;
  sortBtn.textContent = `Sort: ${state.sortMode}`;
  renderFocuses();
  renderRoster();
  renderPrograms();
  renderLaunchPanel();
  renderLog();
}

overlayStart.addEventListener('click', resetGame);
overlayRestart.addEventListener('click', resetGame);
breedBtn.addEventListener('click', breedCandidate);
launchBtn.addEventListener('click', launchAGI);
endWeekBtn.addEventListener('click', endWeek);

// Expose current focus candidate for the AGI viz module
window.getAgiVizCandidate = () => getCandidate(state.activeCandidateId) || bestCandidate();

sortBtn.addEventListener('click', () => {
  const order = ['score', 'risk', 'generation'];
  state.sortMode = order[(order.indexOf(state.sortMode) + 1) % order.length];
  render();
});

showOverlay(
  'Benevolent intelligence lab',
  'Breed the first good AGI',
  'Select two parents, choose an incubation focus, and spend weekly actions on safety, capability, resilience, and creativity. Launch before week 12 while keeping lab risk below collapse.',
  false,
);

// ─── Tutorial ───
const TUTORIAL_STEPS = [
  {
    title: 'Welcome to the Lab',
    body: 'You run a research lab trying to breed a safe, capable AGI before week 12. Each week you get actions and compute to spend on breeding and programs. If lab risk hits 100, you lose. Ready?',
    highlight: null,
  },
  {
    title: 'Your Roster',
    body: 'These are your AGI candidates. Each one has five traits: Capability, Alignment, Resilience, Creativity, and Risk. Higher is better for the first four — but lower Risk is better. Use the buttons on each card to assign parents or focus a candidate for programs.',
    highlight: '.roster-panel',
  },
  {
    title: 'Breeding Bay',
    body: 'Pick two different parents from the roster (click "Parent A" and "Parent B" on their cards), choose a breeding focus like Alignment Bias or Capability Surge, then click Breed. This costs 2 compute and 1 action. The offspring inherits averaged traits, shifted by your chosen focus.',
    highlight: '.control-panel .subpanel:first-child',
  },
  {
    title: 'Lab Programs',
    body: 'Click "Focus" on a candidate card, then run programs on them here. Safety Audit lowers risk, Capability Sprint boosts power (but adds risk), Red-Team Trial builds resilience, and Dataset Remix grows creativity. Each costs actions and sometimes compute.',
    highlight: '.control-panel .subpanel:nth-child(2)',
  },
  {
    title: 'Launch Console',
    body: 'This shows your focused candidate\'s readiness. To win, a candidate must hit: Capability ≥ 88, Alignment ≥ 90, Resilience ≥ 82, Creativity ≥ 68, and Risk ≤ 34 — while lab risk stays below 70. The checklist shows green/red for each threshold.',
    highlight: '.launch-panel',
  },
  {
    title: 'Weekly Directives',
    body: 'Each week you get a directive from the board — a mini-goal like "keep average risk below 22" or "breed and run a program this week." Meeting it earns rewards (compute, lower risk, extra actions). Failing it raises lab risk.',
    highlight: '.status-panel',
  },
  {
    title: 'End Week',
    body: 'When you\'ve spent your actions, click End Week. All candidates drift slightly, a random event fires, your directive is judged, and you get fresh compute. You have 12 weeks total — plan carefully!',
    highlight: '.launch-panel',
  },
  {
    title: 'Retire Dead Weight',
    body: 'If a candidate has high risk and low potential, click Retire on their card. This removes them from the pool and lowers lab risk. You can\'t retire below 2 candidates. Keep your pool clean!',
    highlight: '.roster-panel',
  },
  {
    title: 'You\'re Ready!',
    body: 'Breed smart, run programs strategically, meet your directives, and launch a good AGI before the lab collapses. Good luck, lab director!',
    highlight: null,
  },
];

let tutorialStep = 0;
const tutOverlay = $('tutorialOverlay');
const tutTitle = $('tutorialTitle');
const tutBody = $('tutorialBody');
const tutIndicator = $('tutorialIndicator');
const tutPrev = $('tutorialPrev');
const tutNext = $('tutorialNext');
const tutSkip = $('tutorialSkip');
const overlayTutorial = $('overlayTutorial');

function renderTutorialStep() {
  const step = TUTORIAL_STEPS[tutorialStep];
  tutTitle.textContent = step.title;
  tutBody.textContent = step.body;
  tutPrev.hidden = tutorialStep === 0;
  tutNext.textContent = tutorialStep === TUTORIAL_STEPS.length - 1 ? 'Start playing' : 'Next';

  tutIndicator.innerHTML = TUTORIAL_STEPS.map((_, i) => {
    const cls = i === tutorialStep ? 'active' : i < tutorialStep ? 'done' : '';
    return `<span class="tutorial-dot ${cls}"></span>`;
  }).join('');

  document.querySelectorAll('.tutorial-highlight').forEach(el => el.classList.remove('tutorial-highlight'));
  if (step.highlight) {
    const target = document.querySelector(step.highlight);
    if (target) target.classList.add('tutorial-highlight');
  }
}

function openTutorial() {
  tutorialStep = 0;
  overlay.classList.add('hidden');
  if (!state.running) resetGame();
  tutOverlay.classList.remove('hidden');
  renderTutorialStep();
}

function closeTutorial() {
  tutOverlay.classList.add('hidden');
  document.querySelectorAll('.tutorial-highlight').forEach(el => el.classList.remove('tutorial-highlight'));
}

overlayTutorial.addEventListener('click', openTutorial);
tutNext.addEventListener('click', () => {
  if (tutorialStep < TUTORIAL_STEPS.length - 1) {
    tutorialStep++;
    renderTutorialStep();
  } else {
    closeTutorial();
  }
});
tutPrev.addEventListener('click', () => {
  if (tutorialStep > 0) {
    tutorialStep--;
    renderTutorialStep();
  }
});
tutSkip.addEventListener('click', closeTutorial);
