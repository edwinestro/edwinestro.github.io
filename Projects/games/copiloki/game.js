(function () {
  const STORAGE_KEY = "copiloki-save-v1";
  const TICK_MS = 12000;
  const MAX_OFFLINE_STEPS = 18;
  const MAX_LOG = 8;
  const PET_COOLDOWN_MS = 1600;
  const GENTLE_PET_MS = 2200;
  const RAPID_PET_MS = 450;
  const CALM_RECOVERY_MS = 8000;
  const MINI_GAME_MS = 9000;
  const MINI_SPAWN_MS = 650;

  const CHALLENGE_POOL = [
    {
      id: "snack-loop",
      title: "Snack loop",
      copy: "Feed Copiloki twice.",
      kind: "feed",
      target: 2,
      reward: 2
    },
    {
      id: "shine-sweep",
      title: "Shine sweep",
      copy: "Clean the nest two times.",
      kind: "clean",
      target: 2,
      reward: 2
    },
    {
      id: "patch-sprint",
      title: "Patch sprint",
      copy: "Ship two patches while Copiloki is focused.",
      kind: "code",
      target: 2,
      reward: 3
    },
    {
      id: "comfort-burst",
      title: "Comfort burst",
      copy: "Pet Copiloki three times.",
      kind: "pet",
      target: 3,
      reward: 2
    },
    {
      id: "care-circuit",
      title: "Care circuit",
      copy: "Do any four care actions.",
      kind: "any-care",
      target: 4,
      reward: 3
    },
    {
      id: "bug-hunter",
      title: "Bug hunter",
      copy: "Catch six runaway bits in the mini game.",
      kind: "play-score",
      target: 6,
      reward: 4
    },
    {
      id: "memory-lights",
      title: "Memory lights",
      copy: "Score four points in Memory Lights.",
      kind: "memory-score",
      target: 4,
      reward: 4
    },
    {
      id: "dash-drill",
      title: "Dash drill",
      copy: "Score five points in Patch Dash.",
      kind: "dash-score",
      target: 5,
      reward: 4
    },
    {
      id: "variety-loop",
      title: "Variety loop",
      copy: "Play two different mini games.",
      kind: "play-variety",
      target: 2,
      reward: 3
    }
  ];

  const PERSONALITY_POOL = [
    {
      id: "patch-gremlin",
      name: "Patch Gremlin",
      blurb: "Loves quick wins, speed drills, and feeling more efficient every day.",
      favoriteGame: "dash"
    },
    {
      id: "spark-scout",
      name: "Spark Scout",
      blurb: "Curious, playful, and always ready to chase one more shiny surprise.",
      favoriteGame: "bug"
    },
    {
      id: "dream-mapper",
      name: "Dream Mapper",
      blurb: "Soft-hearted and clever. Learns best from patterns, calm focus, and variety.",
      favoriteGame: "memory"
    },
    {
      id: "cozy-captain",
      name: "Cozy Captain",
      blurb: "Balances work and play, but gets grumpy if life becomes too repetitive.",
      favoriteGame: "memory"
    }
  ];

  const MINI_GAME_CONFIG = {
    bug: {
      eyebrow: "Bug hunt",
      title: "Catch the runaway bits",
      copy: "Watch Copiloki chase the drifting bugs on its own. Great for speed and playful confidence.",
      startText: "Start hunt",
      runningText: "Hunting...",
      scoreLabel: "caught",
      favoriteLabel: "Bug Hunt"
    },
    memory: {
      eyebrow: "Memory lights",
      title: "Follow the glow pattern",
      copy: "Watch Copiloki study and replay the glowing pattern. This trains focus and keeps it sharp.",
      startText: "Start memory",
      runningText: "Remembering...",
      scoreLabel: "steps",
      favoriteLabel: "Memory Lights"
    },
    dash: {
      eyebrow: "Patch dash",
      title: "Ship tiny fixes fast",
      copy: "Watch Copiloki sprint after tiny deploy bubbles before they fade. It trains speed and efficiency.",
      startText: "Start dash",
      runningText: "Dashing...",
      scoreLabel: "ships",
      favoriteLabel: "Patch Dash"
    }
  };

  const EVOLUTION_RULES = [
    { stage: "Seed Egg", age: 0, bond: 0, patches: 0 },
    { stage: "Byte Pup", age: 1, bond: 18, patches: 0 },
    { stage: "Copiloki", age: 3, bond: 38, patches: 2 },
    { stage: "Copiloki Pro", age: 6, bond: 58, patches: 5 },
    { stage: "Copiloki Prime", age: 9, bond: 78, patches: 9 }
  ];

  const BOOSTS = {
    snack: {
      cost: 2,
      apply() {
        state.hunger = clamp(state.hunger + 18, 0, 100);
        state.joy = clamp(state.joy + 8, 0, 100);
        state.overfed = clamp(state.overfed + (state.hunger > 84 ? 1 : 0), 0, 6);
        pushLog("Snack crate opened. Copiloki is fueled and cheerful.");
      }
    },
    bath: {
      cost: 3,
      apply() {
        state.hygiene = clamp(state.hygiene + 24, 0, 100);
        state.health = clamp(state.health + 1, 0, 5);
        state.sickTicks = Math.max(0, state.sickTicks - 1);
        pushLog("Bubble bath complete. The nest is sparkling again.");
      }
    },
    focus: {
      cost: 4,
      apply() {
        state.focus = clamp(state.focus + 18, 0, 100);
        state.energy = clamp(state.energy + 12, 0, 100);
        state.groggyTicks = Math.max(0, state.groggyTicks - 2);
        pushLog("Debug kit deployed. Copiloki feels sharp and ready to build.");
      }
    }
  };

  const elements = {
    stageChip: document.getElementById("stageChip"),
    ageChip: document.getElementById("ageChip"),
    patchChip: document.getElementById("patchChip"),
    sparkChip: document.getElementById("sparkChip"),
    streakChip: document.getElementById("streakChip"),
    bondChip: document.getElementById("bondChip"),
    touchChip: document.getElementById("touchChip"),
    stressChip: document.getElementById("stressChip"),
    conditionChip: document.getElementById("conditionChip"),
    healthChip: document.getElementById("healthChip"),
    petShell: document.getElementById("petShell"),
    petFace: document.getElementById("petFace"),
    petExpression: document.getElementById("petExpression"),
    reactionLayer: document.getElementById("reactionLayer"),
    statusLine: document.getElementById("statusLine"),
    goalText: document.getElementById("goalText"),
    evolutionLine: document.getElementById("evolutionLine"),
    evolutionHint: document.getElementById("evolutionHint"),
    personalityTitle: document.getElementById("personalityTitle"),
    personalityCopy: document.getElementById("personalityCopy"),
    favoriteGameText: document.getElementById("favoriteGameText"),
    autonomyText: document.getElementById("autonomyText"),
    speedSkillValue: document.getElementById("speedSkillValue"),
    focusSkillValue: document.getElementById("focusSkillValue"),
    creativitySkillValue: document.getElementById("creativitySkillValue"),
    speedSkillMeter: document.getElementById("speedSkillMeter"),
    focusSkillMeter: document.getElementById("focusSkillMeter"),
    creativitySkillMeter: document.getElementById("creativitySkillMeter"),
    logList: document.getElementById("logList"),
    ariaLive: document.getElementById("ariaLive"),
    startOverlay: document.getElementById("startOverlay"),
    startBtn: document.getElementById("startBtn"),
    overlayStart: document.getElementById("overlayStart"),
    overlayFresh: document.getElementById("overlayFresh"),
    freshStartBtn: document.getElementById("freshStartBtn"),
    hungerValue: document.getElementById("hungerValue"),
    joyValue: document.getElementById("joyValue"),
    energyValue: document.getElementById("energyValue"),
    hygieneValue: document.getElementById("hygieneValue"),
    focusValue: document.getElementById("focusValue"),
    hungerMeter: document.getElementById("hungerMeter"),
    joyMeter: document.getElementById("joyMeter"),
    energyMeter: document.getElementById("energyMeter"),
    hygieneMeter: document.getElementById("hygieneMeter"),
    focusMeter: document.getElementById("focusMeter"),
    questTitle: document.getElementById("questTitle"),
    questCopy: document.getElementById("questCopy"),
    questMeter: document.getElementById("questMeter"),
    questProgress: document.getElementById("questProgress"),
    questReward: document.getElementById("questReward"),
    boostButtons: Array.from(document.querySelectorAll("[data-boost]")),
    actionButtons: Array.from(document.querySelectorAll("[data-action]")),
    miniGameOverlay: document.getElementById("miniGameOverlay"),
    miniEyebrow: document.getElementById("miniEyebrow"),
    miniTitle: document.getElementById("miniTitle"),
    miniGameCopy: document.getElementById("miniGameCopy"),
    miniModeHint: document.getElementById("miniModeHint"),
    miniTimer: document.getElementById("miniTimer"),
    miniScore: document.getElementById("miniScore"),
    miniArena: document.getElementById("miniArena"),
    miniModeButtons: Array.from(document.querySelectorAll("[data-mini-mode]")),
    miniGameStart: document.getElementById("miniGameStart"),
    miniGameClose: document.getElementById("miniGameClose")
  };

  const miniGame = {
    active: false,
    mode: "bug",
    score: 0,
    endAt: 0,
    timer: null,
    spawner: null,
    finishTimeout: null,
    aiTimer: null,
    sequence: [],
    inputIndex: 0,
    sequenceTimeouts: [],
    showingSequence: false,
    pet: null
  };

  function timeStamp() {
    return new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function pickPersonality() {
    return PERSONALITY_POOL[randomInt(0, PERSONALITY_POOL.length - 1)];
  }

  function freshBoredom() {
    return {
      bug: 0,
      memory: 0,
      dash: 0
    };
  }

  function pickChallenge(previousId) {
    const pool = CHALLENGE_POOL.filter((challenge) => challenge.id !== previousId);
    const source = pool.length ? pool : CHALLENGE_POOL;
    const picked = source[randomInt(0, source.length - 1)];
    return {
      ...picked,
      progress: 0
    };
  }

  function freshState() {
    const personality = pickPersonality();

    return {
      started: false,
      gameOver: false,
      ageDays: 0,
      patches: 0,
      sparks: 0,
      streak: 0,
      bond: 20,
      health: 5,
      hunger: 72,
      joy: 82,
      energy: 76,
      hygiene: 70,
      focus: 60,
      asleep: false,
      napSteps: 0,
      stress: 8,
      autonomy: 12,
      speedSkill: 12,
      focusSkill: 12,
      creativitySkill: 12,
      petCooldownUntil: 0,
      lastPetAt: 0,
      rapidPetStreak: 0,
      personalityId: personality.id,
      personalityName: personality.name,
      personalityBlurb: personality.blurb,
      favoriteGame: personality.favoriteGame,
      lastMiniGameMode: "",
      recentMiniGames: [],
      miniGameBoredom: freshBoredom(),
      stage: "Seed Egg",
      face: "( ^_^ )",
      moodKey: "happy",
      touchStyleKey: "gentle",
      touchStyleLabel: "Touch Gentle",
      conditionKey: "cozy",
      conditionLabel: "Condition Cozy",
      sceneMode: "day",
      expression: "Soft chirp",
      status: "Copiloki is blinking awake and ready for its first snack.",
      goal: "Keep every stat above 40 to help Copiloki grow.",
      sickTicks: 0,
      groggyTicks: 0,
      overfed: 0,
      napChain: 0,
      challenge: pickChallenge(),
      log: [
        {
          time: timeStamp(),
          text: "Copiloki booted with new interactive upgrades."
        }
      ],
      lastUpdated: Date.now()
    };
  }

  function sanitizeState(raw) {
    const base = freshState();
    const merged = {
      ...base,
      ...raw
    };

    merged.log = Array.isArray(raw.log) && raw.log.length ? raw.log.slice(0, MAX_LOG) : base.log;

    if (!merged.challenge || !merged.challenge.id) {
      merged.challenge = pickChallenge();
    } else {
      const template = CHALLENGE_POOL.find((item) => item.id === merged.challenge.id);
      merged.challenge = {
        ...(template || merged.challenge),
        ...merged.challenge
      };
      merged.challenge.progress = clamp(
        Number(merged.challenge.progress || 0),
        0,
        Number(merged.challenge.target || 1)
      );
    }

    merged.lastUpdated = Date.now();
    merged.sickTicks = clamp(Number(merged.sickTicks || 0), 0, 6);
    merged.groggyTicks = clamp(Number(merged.groggyTicks || 0), 0, 6);
    merged.overfed = clamp(Number(merged.overfed || 0), 0, 6);
    merged.napChain = clamp(Number(merged.napChain || 0), 0, 6);
    merged.stress = clamp(Number(merged.stress || 0), 0, 100);
    merged.autonomy = clamp(Number(merged.autonomy || 0), 0, 100);
    merged.speedSkill = clamp(Number(merged.speedSkill || 0), 0, 100);
    merged.focusSkill = clamp(Number(merged.focusSkill || 0), 0, 100);
    merged.creativitySkill = clamp(Number(merged.creativitySkill || 0), 0, 100);
    merged.lastPetAt = Number(merged.lastPetAt || 0);
    merged.rapidPetStreak = clamp(Number(merged.rapidPetStreak || 0), 0, 12);
    merged.favoriteGame = MINI_GAME_CONFIG[merged.favoriteGame] ? merged.favoriteGame : base.favoriteGame;
    merged.lastMiniGameMode = MINI_GAME_CONFIG[merged.lastMiniGameMode] ? merged.lastMiniGameMode : "";
    merged.recentMiniGames = Array.isArray(merged.recentMiniGames)
      ? merged.recentMiniGames.filter((mode) => MINI_GAME_CONFIG[mode]).slice(-4)
      : [];
    merged.miniGameBoredom = {
      ...freshBoredom(),
      ...(raw.miniGameBoredom || {})
    };
    Object.keys(merged.miniGameBoredom).forEach((key) => {
      merged.miniGameBoredom[key] = clamp(Number(merged.miniGameBoredom[key] || 0), 0, 100);
    });
    return merged;
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return freshState();
      }

      return sanitizeState(JSON.parse(raw));
    } catch (error) {
      return freshState();
    }
  }

  let state = loadState();

  function saveState() {
    try {
      state.lastUpdated = Date.now();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      // Keep the game playable even if local storage is unavailable.
    }
  }

  function setMeter(element, valueElement, value) {
    const safeValue = clamp(Math.round(value), 0, 100);
    element.style.width = safeValue + "%";
    valueElement.textContent = safeValue + "%";
  }

  function pushLog(text) {
    state.log.unshift({ time: timeStamp(), text: text });
    state.log = state.log.slice(0, MAX_LOG);
    if (elements.ariaLive) {
      elements.ariaLive.textContent = text;
    }
  }

  function stageToDataset(stage) {
    return String(stage || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function spawnReaction(kind, count) {
    if (!elements.reactionLayer) {
      return;
    }

    const symbolPool = {
      heart: ["<3", "*", "+"],
      spark: ["*", "+", "o"],
      bubble: ["o", "O", "~"]
    };
    const symbols = symbolPool[kind] || symbolPool.spark;

    for (let index = 0; index < count; index += 1) {
      const particle = document.createElement("span");
      particle.className = "reaction-particle " + kind;
      particle.textContent = symbols[randomInt(0, symbols.length - 1)];
      particle.style.left = randomInt(34, 66) + "%";
      particle.style.setProperty("--drift-x", randomInt(-28, 28) + "px");
      particle.style.animationDelay = (index * 0.04).toFixed(2) + "s";
      elements.reactionLayer.appendChild(particle);
      setTimeout(() => particle.remove(), 1200);
    }
  }

  function deriveSceneMode() {
    const hour = new Date().getHours();

    if (state.gameOver || state.health <= 1) {
      return "storm";
    }

    if (state.asleep || hour < 6 || hour >= 21) {
      return "night";
    }

    if (hour < 10) {
      return "dawn";
    }

    if (hour < 18) {
      return "day";
    }

    return "dusk";
  }

  function triggerPetEffect(name) {
    const classes = ["effect-bounce", "effect-glow", "effect-shiver"];
    elements.petShell.classList.remove(...classes);

    if (!name) {
      return;
    }

    void elements.petShell.offsetWidth;
    elements.petShell.classList.add("effect-" + name);

    clearTimeout(triggerPetEffect.timer);
    triggerPetEffect.timer = setTimeout(() => {
      elements.petShell.classList.remove(...classes);
    }, 520);
  }

  function deriveStage(ageDays) {
    let currentIndex = Math.max(
      0,
      EVOLUTION_RULES.findIndex((rule) => rule.stage === state.stage)
    );

    EVOLUTION_RULES.forEach((rule, index) => {
      if (ageDays >= rule.age && state.bond >= rule.bond && state.patches >= rule.patches) {
        currentIndex = Math.max(currentIndex, index);
      }
    });

    return EVOLUTION_RULES[currentIndex].stage;
  }

  function getNextEvolution(stage) {
    const currentIndex = EVOLUTION_RULES.findIndex((rule) => rule.stage === stage);
    if (currentIndex < 0 || currentIndex >= EVOLUTION_RULES.length - 1) {
      return null;
    }

    return EVOLUTION_RULES[currentIndex + 1];
  }

  function buildEvolutionHint(nextRule) {
    if (!nextRule) {
      return {
        title: "Final evolution reached",
        hint: "Copiloki Prime is fully grown. Keep it cozy to maintain the glow."
      };
    }

    const requirements = [];

    if (state.ageDays < nextRule.age) {
      requirements.push((nextRule.age - state.ageDays).toFixed(1) + " more days");
    }

    if (state.bond < nextRule.bond) {
      requirements.push(Math.max(0, nextRule.bond - Math.round(state.bond)) + " more bond");
    }

    if (state.patches < nextRule.patches) {
      requirements.push((nextRule.patches - state.patches) + " more patches");
    }

    return {
      title: "Next evolution: " + nextRule.stage,
      hint: requirements.length
        ? "Needs " + requirements.join(", ") + "."
        : "All requirements are met. Keep caring and the next pulse will hatch it."
    };
  }

  function deriveTouchStyle() {
    if (state.stress >= 72) {
      return {
        key: "overdrive",
        label: "Touch Overdrive"
      };
    }

    if (state.stress >= 46) {
      return {
        key: "guarded",
        label: "Touch Careful"
      };
    }

    if (state.bond >= 72 && state.stress <= 16) {
      return {
        key: "trust",
        label: "Touch Near-Field Trust"
      };
    }

    if (state.rapidPetStreak >= 2) {
      return {
        key: "rhythmic",
        label: "Touch Rhythmic"
      };
    }

    return {
      key: "gentle",
      label: "Touch Gentle"
    };
  }

  function getPersonalityProfile() {
    return PERSONALITY_POOL.find((profile) => profile.id === state.personalityId) || PERSONALITY_POOL[0];
  }

  function trainSkill(kind, amount) {
    const safeAmount = Math.max(0, amount);
    if (kind === "speed") {
      state.speedSkill = clamp(state.speedSkill + safeAmount, 0, 100);
    } else if (kind === "focus") {
      state.focusSkill = clamp(state.focusSkill + safeAmount, 0, 100);
    } else if (kind === "creativity") {
      state.creativitySkill = clamp(state.creativitySkill + safeAmount, 0, 100);
    }

    state.autonomy = clamp(state.autonomy + Math.max(1, Math.round(safeAmount * 0.75)), 0, 100);
  }

  function getMiniBoredom(mode) {
    return Number((state.miniGameBoredom && state.miniGameBoredom[mode]) || 0);
  }

  function getBoredomHint(mode) {
    const boredom = getMiniBoredom(mode);
    const profile = getPersonalityProfile();

    if (boredom >= 60) {
      return "Copiloki is tired of this routine. Switch games for stronger joy and training gains.";
    }

    if (boredom >= 32) {
      return "Still fun, but rotating to another mini game will keep the rewards fresher.";
    }

    if (profile.favoriteGame === mode) {
      return profile.name + " naturally likes this mode, but even favorites get stale with too much repetition.";
    }

    return "Rotate the games to keep Copiloki learning and avoid boredom.";
  }

  function chooseRecommendedMiniMode() {
    const profile = getPersonalityProfile();
    return Object.keys(MINI_GAME_CONFIG)
      .sort((left, right) => {
        const leftScore = getMiniBoredom(left) - (profile.favoriteGame === left ? 8 : 0);
        const rightScore = getMiniBoredom(right) - (profile.favoriteGame === right ? 8 : 0);
        return leftScore - rightScore;
      })[0];
  }

  function getMiniPetStats(mode) {
    const profile = getPersonalityProfile();
    const stageScaleMap = {
      "Seed Egg": 0.76,
      "Byte Pup": 0.88,
      "Copiloki": 1,
      "Copiloki Pro": 1.1,
      "Copiloki Prime": 1.18
    };

    const stageScale = stageScaleMap[state.stage] || 1;
    const affinityBonus = profile.favoriteGame === mode ? 0.08 : 0;
    const size = clamp(stageScale + state.bond / 320 + state.autonomy / 520 + affinityBonus, 0.72, 1.55);
    const speed = Math.max(
      4.8,
      7 + stageScale * 3.5 + state.speedSkill * 0.11 + state.focusSkill * 0.05 + state.autonomy * 0.05 + (profile.favoriteGame === mode ? 1.8 : 0) - getMiniBoredom(mode) / 34
    );
    const accuracy = clamp(
      0.52 + state.focusSkill / 140 + state.creativitySkill / 220 + (profile.favoriteGame === mode ? 0.08 : 0) - getMiniBoredom(mode) / 220,
      0.36,
      0.97
    );

    return {
      size,
      speed,
      reach: 16 + size * 16,
      accuracy
    };
  }

  function getMiniPetFace() {
    if (state.conditionKey === "stressed") return ">_<";
    if (state.conditionKey === "groggy") return "-.-";
    if (state.moodKey === "sad") return "._.";
    if (state.moodKey === "alert") return "o_o";
    return "^_^";
  }

  function ensureMiniPet() {
    let node = elements.miniArena.querySelector(".mini-pet-runner");
    if (!node) {
      node = document.createElement("div");
      node.className = "mini-pet-runner";
      node.innerHTML = [
        '<div class="mini-pet-shadow"></div>',
        '<div class="mini-pet-creature">',
        '<div class="mini-pet-ear mini-pet-ear-left"></div>',
        '<div class="mini-pet-ear mini-pet-ear-right"></div>',
        '<div class="mini-pet-body"><span class="mini-pet-face"></span></div>',
        "</div>",
        '<div class="mini-pet-tag">AUTO</div>'
      ].join("");
      elements.miniArena.appendChild(node);
    }

    const stats = getMiniPetStats(miniGame.mode);
    node.style.setProperty("--mini-scale", stats.size.toFixed(2));
    const face = node.querySelector(".mini-pet-face");
    if (face) {
      face.textContent = getMiniPetFace();
    }

    if (!miniGame.pet) {
      miniGame.pet = {
        node,
        x: 56,
        y: 222,
        targetX: 56,
        targetY: 222,
        idleAt: 0
      };
    } else {
      miniGame.pet.node = node;
    }

    positionMiniPet(miniGame.pet.x, miniGame.pet.y);
    return node;
  }

  function positionMiniPet(x, y) {
    if (!miniGame.pet || !miniGame.pet.node) {
      return;
    }

    const arenaWidth = elements.miniArena.clientWidth || 520;
    const arenaHeight = elements.miniArena.clientHeight || 280;
    const safeX = clamp(x, 28, arenaWidth - 28);
    const safeY = clamp(y, 34, arenaHeight - 34);

    miniGame.pet.x = safeX;
    miniGame.pet.y = safeY;
    miniGame.pet.node.style.left = safeX + "px";
    miniGame.pet.node.style.top = safeY + "px";
  }

  function setMiniPetTargetToNode(node) {
    if (!miniGame.pet || !node) {
      return;
    }

    miniGame.pet.targetX = node.offsetLeft + node.offsetWidth / 2;
    miniGame.pet.targetY = node.offsetTop + node.offsetHeight / 2;
  }

  function collectMiniTarget(target) {
    if (!miniGame.active || !target || target.dataset.caught === "true") {
      return;
    }

    target.dataset.caught = "true";
    miniGame.score += 1;
    updateMiniHud();
    target.classList.add("pop");
    setTimeout(() => target.remove(), 120);
  }

  function tickMiniPetAI() {
    if (!miniGame.active) {
      return;
    }

    ensureMiniPet();
    const stats = getMiniPetStats(miniGame.mode);
    miniGame.pet.node.style.setProperty("--mini-scale", stats.size.toFixed(2));

    let chosenTarget = null;
    let chosenDistance = Number.POSITIVE_INFINITY;

    if (miniGame.mode !== "memory") {
      const selector = miniGame.mode === "dash" ? ".mini-patch" : ".mini-bug";
      const targets = Array.from(elements.miniArena.querySelectorAll(selector)).filter(
        (node) => node.dataset.caught !== "true"
      );

      targets.forEach((node) => {
        const targetX = node.offsetLeft + node.offsetWidth / 2;
        const targetY = node.offsetTop + node.offsetHeight / 2;
        const distance = Math.hypot(targetX - miniGame.pet.x, targetY - miniGame.pet.y);
        if (distance < chosenDistance) {
          chosenDistance = distance;
          chosenTarget = node;
        }
      });

      if (chosenTarget) {
        miniGame.pet.targetX = chosenTarget.offsetLeft + chosenTarget.offsetWidth / 2;
        miniGame.pet.targetY = chosenTarget.offsetTop + chosenTarget.offsetHeight / 2;
      } else if (Date.now() > miniGame.pet.idleAt) {
        miniGame.pet.targetX = randomInt(48, Math.max(52, (elements.miniArena.clientWidth || 520) - 48));
        miniGame.pet.targetY = randomInt(58, Math.max(64, (elements.miniArena.clientHeight || 280) - 48));
        miniGame.pet.idleAt = Date.now() + 700;
      }
    }

    const dx = miniGame.pet.targetX - miniGame.pet.x;
    const dy = miniGame.pet.targetY - miniGame.pet.y;
    const distance = Math.hypot(dx, dy);
    if (distance > 0.1) {
      const step = Math.min(stats.speed, distance);
      positionMiniPet(miniGame.pet.x + (dx / distance) * step, miniGame.pet.y + (dy / distance) * step);
    }

    if (chosenTarget && chosenDistance <= stats.reach) {
      collectMiniTarget(chosenTarget);
    }
  }

  function stopMiniPetAI() {
    clearInterval(miniGame.aiTimer);
    miniGame.aiTimer = null;
  }

  function startMiniPetAI() {
    stopMiniPetAI();
    ensureMiniPet();
    miniGame.aiTimer = setInterval(tickMiniPetAI, 60);
  }

  function startAutonomousMemoryAttempt() {
    if (!miniGame.active || miniGame.mode !== "memory") {
      return;
    }

    const pads = Array.from(elements.miniArena.querySelectorAll(".memory-pad"));
    if (!pads.length) {
      return;
    }

    const stats = getMiniPetStats("memory");
    const mistakeIndex = Math.random() > stats.accuracy ? Math.max(0, miniGame.sequence.length - 1) : -1;
    let delay = 180;
    const stepDelay = Math.max(280, 520 - Math.floor(stats.speed * 16));

    miniGame.sequence.forEach((expected, index) => {
      const chosen = index === mistakeIndex ? (expected + randomInt(1, 3)) % pads.length : expected;

      const moveTimeout = setTimeout(() => {
        if (!miniGame.active) {
          return;
        }

        setMiniPetTargetToNode(pads[chosen]);
      }, delay);

      const tapTimeout = setTimeout(() => {
        if (!miniGame.active) {
          return;
        }

        handleMemoryPad(chosen, pads[chosen]);
      }, delay + Math.min(220, Math.floor(stepDelay * 0.55)));

      miniGame.sequenceTimeouts.push(moveTimeout, tapTimeout);
      delay += stepDelay;
    });
  }

  function setMiniMode(mode) {
    if (!MINI_GAME_CONFIG[mode] || miniGame.active) {
      return;
    }

    miniGame.mode = mode;
    const meta = MINI_GAME_CONFIG[mode];
    elements.miniEyebrow.textContent = meta.eyebrow;
    elements.miniTitle.textContent = meta.title;
    elements.miniGameCopy.textContent = meta.copy;
    elements.miniModeHint.textContent =
      getBoredomHint(mode) + " Watching speed " + Math.round(getMiniPetStats(mode).speed * 7) + "%.";
    elements.miniGameStart.textContent = meta.startText;
    elements.miniArena.dataset.mode = mode;

    elements.miniModeButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.miniMode === mode);
    });

    if (!elements.miniGameOverlay.classList.contains("hidden")) {
      ensureMiniPet();
    }
  }

  function noteMiniGamePlay(mode) {
    const previouslyPlayed = state.lastMiniGameMode;

    Object.keys(state.miniGameBoredom).forEach((key) => {
      if (key === mode) {
        const boredomGain = previouslyPlayed === mode ? 18 : 8;
        state.miniGameBoredom[key] = clamp(state.miniGameBoredom[key] + boredomGain, 0, 100);
      } else {
        state.miniGameBoredom[key] = clamp(state.miniGameBoredom[key] - 12, 0, 100);
      }
    });

    if (previouslyPlayed && previouslyPlayed !== mode) {
      recordChallenge("play-variety", 1);
    }

    state.lastMiniGameMode = mode;
    state.recentMiniGames.push(mode);
    state.recentMiniGames = state.recentMiniGames.slice(-4);

    const counts = state.recentMiniGames.reduce((memo, item) => {
      memo[item] = (memo[item] || 0) + 1;
      return memo;
    }, {});

    const personalityFavorite = getPersonalityProfile().favoriteGame;
    state.favoriteGame = Object.keys(MINI_GAME_CONFIG).sort((left, right) => {
      const leftCount = (counts[left] || 0) + (left === personalityFavorite ? 0.2 : 0);
      const rightCount = (counts[right] || 0) + (right === personalityFavorite ? 0.2 : 0);
      return rightCount - leftCount;
    })[0] || personalityFavorite;
  }

  function maybeAutonomousRoutine() {
    if (
      !state.started ||
      state.gameOver ||
      state.stage === "Seed Egg" ||
      state.autonomy < 18 ||
      state.stress > 42 ||
      state.energy < 36
    ) {
      return;
    }

    if (Math.random() >= 0.08 + state.autonomy / 600) {
      return;
    }

    const profile = getPersonalityProfile();
    state.energy = clamp(state.energy - 4, 0, 100);
    state.joy = clamp(state.joy + 3, 0, 100);
    state.stress = clamp(state.stress - 4, 0, 100);

    if (profile.favoriteGame === "dash") {
      trainSkill("speed", 2);
      trainSkill("focus", 1);
      pushLog("On its own, Copiloki ran a solo Patch Dash drill and shaved a little time off its builds.");
    } else if (profile.favoriteGame === "memory") {
      trainSkill("focus", 2);
      trainSkill("creativity", 1);
      pushLog("Copiloki practiced Memory Lights on its own and looked sharper afterward.");
    } else {
      trainSkill("speed", 1);
      trainSkill("creativity", 2);
      pushLog("Copiloki chased a few spark-bugs by itself and came back more playful.");
    }

    if (state.focusSkill >= 55 && state.speedSkill >= 45 && Math.random() < 0.25) {
      state.patches += 1;
      pushLog("Autonomy bonus! Copiloki quietly shipped a tiny cleanup patch by itself.");
    }
  }

  function deriveMood() {
    if (state.gameOver) {
      return {
        face: "( x_x )",
        moodKey: "critical",
        expression: "System hush",
        status: "Copiloki blue-screened from neglect. Hatch a new egg to try again.",
        goal: "Use Clear save to reboot a fresh Copiloki egg."
      };
    }

    if (state.sickTicks > 0) {
      return {
        face: "( @_@ )",
        moodKey: "sad",
        expression: "Tummy ache",
        status: "Too many snacks gave Copiloki a tiny tummy ache.",
        goal: "Skip more snacks for a bit and clean or rest until the sick feeling fades."
      };
    }

    if (state.groggyTicks > 0 && !state.asleep) {
      return {
        face: "( -o- )",
        moodKey: "sleepy",
        expression: "Modorro...",
        status: "Copiloki overslept and woke up delightfully but noticeably modorro.",
        goal: "Wake it up with play, petting, or a small patch streak."
      };
    }

    if (state.asleep) {
      return {
        face: "( -.- ) zZ",
        moodKey: "sleepy",
        expression: "Soft snores",
        status: "Copiloki is taking a power nap and quietly recharging.",
        goal: "Let the nap finish, then stack a quick quest for bonus sparks."
      };
    }

    if (state.stress >= 72) {
      return {
        face: "( >_< )!",
        moodKey: "critical",
        expression: "Too much!",
        status: "Rapid clicking overstimulated Copiloki, and it wants a little breathing room.",
        goal: "Pause the petting, then calm it with space, cleaning, or a soft play loop."
      };
    }

    if (state.stress >= 46) {
      return {
        face: "( o_o )",
        moodKey: "alert",
        expression: "Guarded",
        status: "Copiloki is reading your click rhythm carefully. Gentle timing feels safer than spam taps.",
        goal: "Wait a beat between pats to rebuild trust and lower stress."
      };
    }

    if (Math.max(...Object.values(state.miniGameBoredom || freshBoredom())) >= 60 && state.joy < 78) {
      return {
        face: "( -_- )",
        moodKey: "sad",
        expression: "Needs novelty",
        status: "Copiloki is a little bored of repeating the same toy and wants a fresher challenge.",
        goal: "Swap mini game modes to restore curiosity and stronger rewards."
      };
    }

    const lowest = Math.min(state.hunger, state.joy, state.energy, state.hygiene, state.focus);

    if (state.health <= 2 || lowest <= 12) {
      return {
        face: "( ;_; )",
        moodKey: "critical",
        expression: "Needs cuddles",
        status: "Copiloki feels rough and needs help right now.",
        goal: "Urgent: raise the weakest stat before health drops again."
      };
    }

    if (lowest <= 28) {
      if (state.hunger === lowest) {
        return {
          face: "( o_o )",
          moodKey: "alert",
          expression: "Sniff sniff",
          status: "Copiloki is hangry and staring at imaginary snacks.",
          goal: "Feed Copiloki soon to avoid a pixel meltdown."
        };
      }

      if (state.hygiene === lowest) {
        return {
          face: "( >_< )",
          moodKey: "sad",
          expression: "Messy whiskers",
          status: "Copiloki's nest is chaos and it wants a cleanup crew.",
          goal: "Clean up the mess so hygiene and health can recover."
        };
      }

      return {
        face: "( ._. )",
        moodKey: "sad",
        expression: "Quiet chirp",
        status: "Copiloki feels a little neglected and needs attention.",
        goal: "Spend a spark boost or top up the weakest stat."
      };
    }

    if (state.focus >= 78 && state.energy >= 55) {
      return {
        face: "( ^o^ )",
        moodKey: "alert",
        expression: "Bright eyes",
        status: "Copiloki is locked in and ready to ship something brilliant.",
        goal: "Try Ship patch while focus and energy are high."
      };
    }

    return {
      face: "( ^_^ )",
      moodKey: "happy",
      expression: state.bond >= 70 ? "Warm purr" : "Tiny chirp",
      status: "Copiloki is happy, curious, and ready for the next little adventure.",
      goal: state.challenge ? state.challenge.copy : "Keep every stat above 40 to help Copiloki grow."
    };
  }

  function completeChallenge() {
    const reward = Number(state.challenge.reward || 2);
    const title = state.challenge.title;
    const previousId = state.challenge.id;

    state.sparks += reward;
    state.streak += 1;
    state.bond = clamp(state.bond + 6, 0, 100);
    state.joy = clamp(state.joy + 6, 0, 100);
    state.health = clamp(state.health + 1, 0, 5);

    pushLog("Quest cleared: " + title + ". Copiloki earned +" + reward + " sparks.");
    triggerPetEffect("glow");
    state.challenge = pickChallenge(previousId);
  }

  function recordChallenge(kind, amount) {
    const challenge = state.challenge;
    if (!challenge || state.gameOver) {
      return;
    }

    let delta = 0;
    if (challenge.kind === kind) {
      delta = amount;
    } else if (challenge.kind === "any-care" && ["feed", "clean", "nap", "code", "pet", "play"].includes(kind)) {
      delta = amount;
    } else if (challenge.kind === "play" && kind === "play-score") {
      delta = 1;
    }

    if (!delta) {
      return;
    }

    challenge.progress = clamp(challenge.progress + delta, 0, challenge.target);
    if (challenge.progress >= challenge.target) {
      completeChallenge();
    }
  }

  function maybeTriggerEvent() {
    if (Math.random() >= 0.18) {
      return;
    }

    const roll = randomInt(0, 3);
    switch (roll) {
      case 0:
        state.sparks += 1;
        state.focus = clamp(state.focus + 4, 0, 100);
        state.bond = clamp(state.bond + 1, 0, 100);
        pushLog("Copiloki found a shiny shortcut sticker. +1 spark.");
        break;
      case 1:
        state.hygiene = clamp(state.hygiene - 6, 0, 100);
        state.joy = clamp(state.joy + 3, 0, 100);
        pushLog("A confetti compile went off. Fun for joy, bad for tidiness.");
        break;
      case 2:
        state.energy = clamp(state.energy - 5, 0, 100);
        pushLog("Copiloki doomscrolled patch notes and got a little sleepy.");
        break;
      default:
        state.joy = clamp(state.joy + 5, 0, 100);
        pushLog("A tiny applause track played from the speakers. Morale boosted.");
        break;
    }
  }

  function updateStateFlags() {
    const previousStage = state.stage;
    state.stage = deriveStage(state.ageDays);

    if (state.started && previousStage !== state.stage) {
      state.sparks += 1;
      pushLog("Evolution unlocked! Copiloki grew into " + state.stage + " and popped out a celebration spark.");
      spawnReaction("spark", 4);
      triggerPetEffect("bounce");
    }

    const weakStats = [state.hunger, state.joy, state.energy, state.hygiene, state.focus].filter(
      (value) => value < 25
    ).length;

    if (weakStats >= 2) {
      state.health = clamp(state.health - 1, 0, 5);
      state.bond = clamp(state.bond - 2, 0, 100);
      state.streak = 0;
    } else if (
      state.health < 5 &&
      state.hunger > 65 &&
      state.joy > 65 &&
      state.energy > 65 &&
      state.hygiene > 65 &&
      state.focus > 55 &&
      Math.random() < 0.3
    ) {
      state.health = clamp(state.health + 1, 0, 5);
      state.bond = clamp(state.bond + 1, 0, 100);
    }

    if (state.health <= 0) {
      state.gameOver = true;
      state.asleep = false;
      clearMiniGame(false);
    }

    const mood = deriveMood();
    const touchStyle = deriveTouchStyle();
    state.face = mood.face;
    state.moodKey = mood.moodKey;
    state.expression = mood.expression;
    state.sceneMode = deriveSceneMode();
    state.status = mood.status;
    state.goal = mood.goal;
    state.touchStyleKey = touchStyle.key;
    state.touchStyleLabel = touchStyle.label;

    if (state.sickTicks > 0) {
      state.conditionKey = "sick";
      state.conditionLabel = "Condition Sick tummy";
    } else if (state.groggyTicks > 0 && !state.asleep) {
      state.conditionKey = "groggy";
      state.conditionLabel = "Condition Modorro";
    } else if (state.stress >= 72) {
      state.conditionKey = "stressed";
      state.conditionLabel = "Condition Overstimulated";
    } else if (state.stress >= 46) {
      state.conditionKey = "guarded";
      state.conditionLabel = "Condition Guarded";
    } else if (state.asleep) {
      state.conditionKey = "sleepy";
      state.conditionLabel = "Condition Snoozing";
    } else if (state.bond >= 72) {
      state.conditionKey = "cozy";
      state.conditionLabel = "Condition Cozy";
    } else {
      state.conditionKey = "cozy";
      state.conditionLabel = "Condition Curious";
    }
  }

  function applyTickStep() {
    if (!state.started || state.gameOver) {
      return;
    }

    const quietMs = Date.now() - (state.lastPetAt || 0);

    state.ageDays = Number((state.ageDays + 0.2).toFixed(1));
    state.hunger = clamp(state.hunger - randomInt(2, 4), 0, 100);
    state.joy = clamp(state.joy - randomInt(1, 3), 0, 100);
    state.hygiene = clamp(state.hygiene - randomInt(1, 3), 0, 100);
    state.focus = clamp(state.focus - randomInt(1, 2), 0, 100);
    state.overfed = Math.max(0, state.overfed - 1);
    state.stress = clamp(state.stress - (quietMs > CALM_RECOVERY_MS ? 8 : 3), 0, 100);
    state.rapidPetStreak = Math.max(0, state.rapidPetStreak - (quietMs > CALM_RECOVERY_MS ? 2 : 1));
    Object.keys(state.miniGameBoredom).forEach((key) => {
      state.miniGameBoredom[key] = clamp(state.miniGameBoredom[key] - 2, 0, 100);
    });

    if (state.sickTicks > 0) {
      state.sickTicks = Math.max(0, state.sickTicks - 1);
      state.joy = clamp(state.joy - randomInt(2, 4), 0, 100);
      state.focus = clamp(state.focus - randomInt(2, 4), 0, 100);
    }

    if (state.groggyTicks > 0 && !state.asleep) {
      state.groggyTicks = Math.max(0, state.groggyTicks - 1);
      state.focus = clamp(state.focus - randomInt(2, 3), 0, 100);
      state.joy = clamp(state.joy - 1, 0, 100);
    }

    if (state.stress >= 72) {
      state.joy = clamp(state.joy - 4, 0, 100);
      state.focus = clamp(state.focus - 3, 0, 100);
      if (Math.random() < 0.18) {
        pushLog("Copiloki puffed up from too much attention and needs a quieter minute.");
      }
    } else if (state.stress >= 46 && Math.random() < 0.12) {
      pushLog("Copiloki side-eyed the cursor. A softer rhythm helps it feel safe again.");
    }

    if (state.asleep) {
      state.energy = clamp(state.energy + randomInt(7, 11), 0, 100);
      state.stress = clamp(state.stress - 6, 0, 100);
      state.napSteps = Math.max(0, state.napSteps - 1);
      if (state.napSteps === 0 || state.energy >= 92) {
        state.asleep = false;
        pushLog(state.groggyTicks > 0 ? "Copiloki woke up a little modorro." : "Copiloki woke up refreshed and extra shiny.");
      }
    } else {
      state.energy = clamp(state.energy - randomInt(2, 4), 0, 100);
      state.napChain = Math.max(0, state.napChain - 1);
    }

    if (Math.random() < 0.22) {
      state.hygiene = clamp(state.hygiene - 7, 0, 100);
      pushLog("Copiloki scattered pixel crumbs all over the nest.");
    }

    if (state.stage === "Copiloki Prime" && Math.random() < 0.18) {
      state.joy = clamp(state.joy + 2, 0, 100);
      pushLog("Copiloki Prime strutted around proudly after shipping a clean build.");
    }

    maybeAutonomousRoutine();
    maybeTriggerEvent();
    updateStateFlags();

    if (state.gameOver) {
      pushLog("Copiloki blue-screened. Clear the save to hatch a new egg.");
    }
  }

  function applyOfflineProgress() {
    const elapsed = Date.now() - (state.lastUpdated || Date.now());
    const steps = Math.min(MAX_OFFLINE_STEPS, Math.floor(elapsed / TICK_MS));

    for (let index = 0; index < steps; index += 1) {
      applyTickStep();
    }
  }

  function petCopiloki() {
    if (!state.started) {
      startGame();
      return;
    }

    if (state.gameOver) {
      return;
    }

    const now = Date.now();
    const previousPetAt = state.lastPetAt || 0;
    const delta = previousPetAt ? now - previousPetAt : Infinity;
    const tooFast = delta < RAPID_PET_MS;
    const stillCoolingDown = now < (state.petCooldownUntil || 0);

    state.lastPetAt = now;

    if (delta > GENTLE_PET_MS) {
      state.rapidPetStreak = 0;
      state.stress = clamp(state.stress - 10, 0, 100);
    } else if (tooFast) {
      state.rapidPetStreak = clamp(state.rapidPetStreak + 1, 0, 12);
      state.stress = clamp(state.stress + 14 + state.rapidPetStreak * 4, 0, 100);
    } else {
      state.rapidPetStreak = Math.max(0, state.rapidPetStreak - 1);
      state.stress = clamp(state.stress + 2, 0, 100);
    }

    if (tooFast && (state.rapidPetStreak >= 2 || state.stress >= 65)) {
      const protest = [
        "Too many rapid pats stressed Copiloki out. It scooted back and puffed up.",
        "Copiloki huffed at the click storm and asked for a calmer rhythm.",
        "Overdrive petting triggered a tiny protest wobble. Give Copiloki a breather."
      ];

      state.petCooldownUntil = now + PET_COOLDOWN_MS * 2;
      state.joy = clamp(state.joy - 6, 0, 100);
      state.focus = clamp(state.focus - 4, 0, 100);
      state.bond = clamp(state.bond - 3, 0, 100);
      pushLog(protest[randomInt(0, protest.length - 1)]);
      triggerPetEffect("shiver");
      spawnReaction("spark", 3);
      updateStateFlags();
      saveState();
      render();
      return;
    }

    if (stillCoolingDown) {
      state.stress = clamp(state.stress + 4, 0, 100);
      state.joy = clamp(state.joy - 1, 0, 100);
      pushLog("Copiloki is already purring. A softer rhythm builds more trust.");
      triggerPetEffect("bounce");
      updateStateFlags();
      saveState();
      render();
      return;
    }

    state.petCooldownUntil = now + PET_COOLDOWN_MS;
    state.groggyTicks = Math.max(0, state.groggyTicks - 1);

    if (delta > GENTLE_PET_MS) {
      state.joy = clamp(state.joy + 6, 0, 100);
      state.focus = clamp(state.focus + 2, 0, 100);
      state.bond = clamp(state.bond + 4, 0, 100);
      pushLog("Copiloki leaned into the gentle pat. That slower rhythm feels safe.");
      spawnReaction("heart", 3);
    } else if (delta < PET_COOLDOWN_MS) {
      state.joy = clamp(state.joy + 3, 0, 100);
      state.focus = clamp(state.focus + 1, 0, 100);
      state.bond = clamp(state.bond + 1, 0, 100);
      pushLog("Copiloki chirped, but it prefers a gentler tempo.");
      spawnReaction("heart", 2);
    } else {
      state.joy = clamp(state.joy + 5, 0, 100);
      state.focus = clamp(state.focus + 2, 0, 100);
      state.bond = clamp(state.bond + 3, 0, 100);
      pushLog("You gave Copiloki a gentle head pat. Tiny purr unlocked.");
      spawnReaction("heart", 3);
    }

    if (state.stress <= 16 && state.bond >= 65 && Math.random() < 0.35) {
      state.sparks += 1;
      pushLog("Near-field trust bonus! Copiloki felt especially safe and made +1 spark.");
    }

    recordChallenge("pet", 1);
    triggerPetEffect("glow");
    updateStateFlags();
    saveState();
    render();
  }

  function openMiniGame() {
    if (!state.started) {
      startGame();
    }

    if (state.gameOver) {
      return;
    }

    elements.miniGameOverlay.classList.remove("hidden");
    elements.miniArena.innerHTML = "";
    elements.miniTimer.textContent = "9.0s";
    elements.miniGameStart.disabled = false;
    setMiniMode(chooseRecommendedMiniMode());
    elements.miniScore.textContent = "0 " + MINI_GAME_CONFIG[miniGame.mode].scoreLabel;
    ensureMiniPet();
  }

  function updateMiniHud() {
    const remaining = Math.max(0, (miniGame.endAt - Date.now()) / 1000);
    elements.miniTimer.textContent = remaining.toFixed(1) + "s";
    elements.miniScore.textContent = miniGame.score + " " + MINI_GAME_CONFIG[miniGame.mode].scoreLabel;
  }

  function spawnBug() {
    if (!miniGame.active || miniGame.mode !== "bug") {
      return;
    }

    const bug = document.createElement("button");
    bug.type = "button";
    bug.className = "mini-bug";
    bug.textContent = ["✦", "✺", "✹", "✷", "✧"][randomInt(0, 4)];
    bug.style.left = randomInt(8, 86) + "%";
    bug.style.top = randomInt(10, 78) + "%";

    bug.addEventListener("click", () => {
      if (!miniGame.active) {
        return;
      }

      collectMiniTarget(bug);
    });

    elements.miniArena.appendChild(bug);
    setTimeout(() => bug.remove(), 1200);
  }

  function spawnPatchBubble() {
    if (!miniGame.active || miniGame.mode !== "dash") {
      return;
    }

    const patch = document.createElement("button");
    patch.type = "button";
    patch.className = "mini-patch";
    patch.textContent = ["Ship", "Fix", "Lint", "Test"][randomInt(0, 3)];
    patch.style.left = randomInt(8, 78) + "%";
    patch.style.top = randomInt(12, 74) + "%";

    patch.addEventListener("click", () => {
      if (!miniGame.active) {
        return;
      }

      collectMiniTarget(patch);
    });

    elements.miniArena.appendChild(patch);
    setTimeout(() => patch.remove(), 1000);
  }

  function clearMiniSequenceTimers() {
    miniGame.sequenceTimeouts.forEach((timeout) => clearTimeout(timeout));
    miniGame.sequenceTimeouts = [];
    miniGame.showingSequence = false;
  }

  function buildMemoryArena() {
    elements.miniArena.innerHTML = "";

    const grid = document.createElement("div");
    grid.className = "mini-memory-grid";

    ["Sun", "Moon", "Leaf", "Spark"].forEach((label, index) => {
      const pad = document.createElement("button");
      pad.type = "button";
      pad.className = "memory-pad";
      pad.textContent = label;
      pad.addEventListener("click", () => handleMemoryPad(index, pad));
      grid.appendChild(pad);
    });

    elements.miniArena.appendChild(grid);
    ensureMiniPet();
  }

  function flashMemorySequence() {
    clearMiniSequenceTimers();
    miniGame.showingSequence = true;

    const pads = Array.from(elements.miniArena.querySelectorAll(".memory-pad"));
    pads.forEach((pad) => {
      pad.disabled = true;
      pad.classList.remove("correct", "wrong");
    });

    let delay = 180;
    miniGame.sequence.forEach((step) => {
      const onTimeout = setTimeout(() => {
        pads[step]?.classList.add("flash");
      }, delay);

      const offTimeout = setTimeout(() => {
        pads[step]?.classList.remove("flash");
      }, delay + 260);

      miniGame.sequenceTimeouts.push(onTimeout, offTimeout);
      delay += 420;
    });

    const releaseTimeout = setTimeout(() => {
      miniGame.showingSequence = false;
      pads.forEach((pad) => {
        pad.disabled = false;
      });
      startAutonomousMemoryAttempt();
    }, delay + 80);

    miniGame.sequenceTimeouts.push(releaseTimeout);
  }

  function handleMemoryPad(index, pad) {
    if (!miniGame.active || miniGame.mode !== "memory" || miniGame.showingSequence) {
      return;
    }

    const expected = miniGame.sequence[miniGame.inputIndex];
    if (index === expected) {
      miniGame.score += 1;
      miniGame.inputIndex += 1;
      pad.classList.add("correct");
      setTimeout(() => pad.classList.remove("correct"), 180);
      updateMiniHud();

      if (miniGame.inputIndex >= miniGame.sequence.length) {
        miniGame.inputIndex = 0;
        miniGame.sequence.push(randomInt(0, 3));
        const nextTimeout = setTimeout(flashMemorySequence, 220);
        miniGame.sequenceTimeouts.push(nextTimeout);
      }
    } else {
      miniGame.score = Math.max(0, miniGame.score - 1);
      miniGame.inputIndex = 0;
      pad.classList.add("wrong");
      updateMiniHud();

      const resetTimeout = setTimeout(() => {
        pad.classList.remove("wrong");
        flashMemorySequence();
      }, 240);

      miniGame.sequenceTimeouts.push(resetTimeout);
    }
  }

  function clearMiniGame(hideOverlay) {
    clearInterval(miniGame.timer);
    clearInterval(miniGame.spawner);
    clearTimeout(miniGame.finishTimeout);
    clearMiniSequenceTimers();
    stopMiniPetAI();
    miniGame.active = false;
    miniGame.timer = null;
    miniGame.spawner = null;
    miniGame.finishTimeout = null;
    miniGame.sequence = [];
    miniGame.inputIndex = 0;
    miniGame.pet = null;
    elements.miniArena.innerHTML = "";

    if (hideOverlay) {
      elements.miniGameOverlay.classList.add("hidden");
    }
  }

  function finishMiniGame() {
    const score = miniGame.score;
    const mode = miniGame.mode;
    clearMiniGame(false);

    noteMiniGamePlay(mode);
    const boredomPenalty = getMiniBoredom(mode) >= 60 ? 6 : getMiniBoredom(mode) >= 32 ? 3 : 0;
    const varietyBonus = state.recentMiniGames.length >= 2 && new Set(state.recentMiniGames).size >= 2 ? 2 : 0;

    let joyBonus;
    let focusBonus;
    let sparkBonus;

    if (mode === "memory") {
      joyBonus = clamp(4 + score - boredomPenalty, 4, 20);
      focusBonus = clamp(6 + score * 2 - boredomPenalty, 4, 26);
      sparkBonus = score >= 7 ? 3 : score >= 4 ? 2 : score >= 2 ? 1 : 0;
      trainSkill("focus", Math.max(1, Math.ceil(score / 2)));
      trainSkill("creativity", Math.max(1, Math.floor(score / 4)));
    } else if (mode === "dash") {
      joyBonus = clamp(5 + score - boredomPenalty, 4, 24);
      focusBonus = clamp(4 + score - boredomPenalty, 3, 20);
      sparkBonus = score >= 9 ? 3 : score >= 6 ? 2 : score >= 3 ? 1 : 0;
      trainSkill("speed", Math.max(1, Math.ceil(score / 2)));
      trainSkill("focus", Math.max(1, Math.floor(score / 3)));
      if (score >= 6) {
        state.patches += 1;
      }
    } else {
      joyBonus = clamp(6 + score * 2 - boredomPenalty, 5, 28);
      focusBonus = clamp(3 + score - boredomPenalty, 3, 16);
      sparkBonus = score >= 8 ? 3 : score >= 5 ? 2 : score >= 2 ? 1 : 0;
      trainSkill("speed", Math.max(1, Math.floor(score / 3)));
      trainSkill("creativity", 1);
    }

    state.joy = clamp(state.joy + joyBonus + varietyBonus, 0, 100);
    state.focus = clamp(state.focus + focusBonus, 0, 100);
    state.energy = clamp(state.energy - (mode === "dash" ? 7 : 5), 0, 100);
    state.hunger = clamp(state.hunger - (mode === "dash" ? 4 : 3), 0, 100);
    state.sparks += sparkBonus + (varietyBonus ? 1 : 0);
    state.bond = clamp(state.bond + Math.max(1, Math.floor(score / 3)) + varietyBonus, 0, 100);
    state.groggyTicks = Math.max(0, state.groggyTicks - 1);
    state.stress = clamp(state.stress - (score >= 7 ? 12 : 8) - varietyBonus * 2, 0, 100);

    recordChallenge("play", 1);
    recordChallenge("play-score", score);
    if (mode === "memory") {
      recordChallenge("memory-score", Math.min(score, 5));
    } else if (mode === "dash") {
      recordChallenge("dash-score", Math.min(score, 6));
    }

    triggerPetEffect("bounce");
    spawnReaction(score >= 7 ? "spark" : "heart", score >= 7 ? 4 : 3);

    if (mode === "memory") {
      if (score >= 6) {
        pushLog("Memory Lights win! Copiloki nailed " + score + " glowing steps and looked much sharper.");
        elements.miniGameCopy.textContent = "That pattern work really clicked. Copiloki looks proud and focused.";
      } else if (score >= 3) {
        pushLog("Nice Memory Lights round. Copiloki remembered " + score + " steps.");
        elements.miniGameCopy.textContent = "A solid focus drill. Copiloki would happily try a different game next.";
      } else {
        pushLog("Memory Lights was a short warm-up, but it still trained Copiloki's brain.");
        elements.miniGameCopy.textContent = "Even a small sequence helps Copiloki learn.";
      }
    } else if (mode === "dash") {
      if (score >= 7) {
        pushLog("Patch Dash streak! Copiloki shipped " + score + " tiny fixes at impressive speed.");
        elements.miniGameCopy.textContent = "That speed drill paid off. Copiloki feels faster and more efficient.";
      } else if (score >= 3) {
        pushLog("Good Patch Dash run. Copiloki shipped " + score + " fast fixes.");
        elements.miniGameCopy.textContent = "Nice pace. Copiloki is learning to build faster.";
      } else {
        pushLog("Patch Dash counted as practice, even if it was a tiny round.");
        elements.miniGameCopy.textContent = "A few fast taps still helped Copiloki train efficiency.";
      }
    } else if (score >= 7) {
      pushLog("Bug hunt victory! Copiloki caught " + score + " bits and earned +" + sparkBonus + " sparks.");
      elements.miniGameCopy.textContent = "Amazing round. Copiloki is buzzing with confidence.";
    } else if (score >= 3) {
      pushLog("Solid bug hunt. Copiloki caught " + score + " bits and stayed cheerful.");
      elements.miniGameCopy.textContent = "Nice catch. Copiloki wants to play again soon.";
    } else {
      pushLog("Tiny bug hunt complete. Even one caught bit still counts as practice.");
      elements.miniGameCopy.textContent = "A short round still helped Copiloki have fun.";
    }

    if (boredomPenalty > 0) {
      pushLog("Copiloki is starting to get bored of " + MINI_GAME_CONFIG[mode].favoriteLabel + ". A different game will hit harder.");
    }

    elements.miniTimer.textContent = "Done";
    elements.miniScore.textContent = score + " " + MINI_GAME_CONFIG[mode].scoreLabel;
    elements.miniGameStart.disabled = false;
    elements.miniModeHint.textContent = getBoredomHint(mode);
    elements.miniGameStart.textContent = MINI_GAME_CONFIG[mode].startText;

    updateStateFlags();
    saveState();
    render();
  }

  function startMiniGameRound() {
    if (miniGame.active || state.gameOver) {
      return;
    }

    miniGame.active = true;
    miniGame.score = 0;
    miniGame.inputIndex = 0;
    miniGame.endAt = Date.now() + MINI_GAME_MS + (miniGame.mode === "memory" ? 1000 : 0);
    elements.miniGameStart.disabled = true;
    elements.miniGameStart.textContent = MINI_GAME_CONFIG[miniGame.mode].runningText;
    elements.miniArena.innerHTML = "";
    miniGame.pet = null;
    updateMiniHud();
    ensureMiniPet();
    startMiniPetAI();

    if (miniGame.mode === "memory") {
      buildMemoryArena();
      miniGame.sequence = [randomInt(0, 3), randomInt(0, 3), randomInt(0, 3)];
      flashMemorySequence();
    } else if (miniGame.mode === "dash") {
      spawnPatchBubble();
      miniGame.spawner = setInterval(
        spawnPatchBubble,
        Math.max(320, MINI_SPAWN_MS - Math.floor(state.speedSkill / 3))
      );
    } else {
      spawnBug();
      miniGame.spawner = setInterval(
        spawnBug,
        Math.max(360, MINI_SPAWN_MS - Math.floor(state.speedSkill / 4))
      );
    }

    miniGame.timer = setInterval(updateMiniHud, 100);
    miniGame.finishTimeout = setTimeout(finishMiniGame, MINI_GAME_MS + (miniGame.mode === "memory" ? 1000 : 0));
  }

  function spendBoost(key) {
    if (!state.started) {
      startGame();
    }

    if (state.gameOver || !BOOSTS[key]) {
      return;
    }

    const boost = BOOSTS[key];
    if (state.sparks < boost.cost) {
      pushLog("Not enough sparks for that treat yet.");
      render();
      return;
    }

    state.sparks -= boost.cost;
    boost.apply();
    state.bond = clamp(state.bond + 2, 0, 100);
    state.stress = clamp(state.stress - (key === "bath" ? 12 : 8), 0, 100);
    triggerPetEffect("glow");
    spawnReaction(key === "bath" ? "bubble" : "spark", 3);
    updateStateFlags();
    saveState();
    render();
  }

  function handleAction(action) {
    if (!state.started && action !== "start") {
      startGame();
      return;
    }

    if (state.gameOver) {
      pushLog("Copiloki needs a reboot, not another action. Clear the save to restart.");
      render();
      return;
    }

    switch (action) {
      case "feed":
        const wasAlreadyFull = state.hunger >= 82;

        if (wasAlreadyFull) {
          state.overfed = clamp(state.overfed + 2, 0, 6);
        } else {
          state.overfed = Math.max(0, state.overfed - 1);
        }

        state.hunger = clamp(state.hunger + 20, 0, 100);
        state.joy = clamp(state.joy + 4, 0, 100);
        state.energy = clamp(state.energy + 2, 0, 100);
        state.hygiene = clamp(state.hygiene - 2, 0, 100);
        state.bond = clamp(state.bond + 2, 0, 100);
        state.stress = clamp(state.stress - 2, 0, 100);
        state.napChain = Math.max(0, state.napChain - 1);

        if (state.overfed >= 3) {
          state.sickTicks = Math.max(state.sickTicks, 3);
          state.joy = clamp(state.joy - 5, 0, 100);
          state.focus = clamp(state.focus - 6, 0, 100);
          pushLog("Too many snacks too fast gave Copiloki a tiny tummy ache.");
          spawnReaction("bubble", 3);
        } else if (wasAlreadyFull) {
          pushLog("Copiloki nibbled politely, but that belly is getting very full.");
          spawnReaction("heart", 2);
        } else {
          pushLog("Copiloki munched a glowing snack and is no longer hangry.");
          spawnReaction("heart", 3);
        }

        recordChallenge("feed", 1);
        triggerPetEffect("glow");
        break;
      case "play":
        openMiniGame();
        return;
      case "clean":
        state.hygiene = clamp(state.hygiene + 24, 0, 100);
        state.health = clamp(state.health + 1, 0, 5);
        state.bond = clamp(state.bond + 1, 0, 100);
        state.sickTicks = Math.max(0, state.sickTicks - 1);
        state.overfed = Math.max(0, state.overfed - 1);
        state.stress = clamp(state.stress - 10, 0, 100);
        pushLog("The nest is spotless again and Copiloki smells like fresh static.");
        recordChallenge("clean", 1);
        triggerPetEffect("glow");
        spawnReaction("bubble", 3);
        break;
      case "nap":
        const wasAlreadyRested = state.energy > 84 || state.napChain >= 1;

        state.napChain = clamp(state.napChain + 1, 0, 6);
        state.asleep = true;
        state.napSteps = wasAlreadyRested ? 3 : 2;
        state.energy = clamp(state.energy + (state.napSteps > 2 ? 8 : 12), 0, 100);
        state.bond = clamp(state.bond + 1, 0, 100);
        state.stress = clamp(state.stress - 12, 0, 100);

        if (wasAlreadyRested) {
          state.groggyTicks = Math.max(state.groggyTicks, 3);
          state.focus = clamp(state.focus - 6, 0, 100);
          pushLog("That extra nap may send Copiloki into full modorro mode when it wakes up.");
        } else {
          pushLog("Copiloki curled up for a power nap under a warm monitor glow.");
        }

        recordChallenge("nap", 1);
        triggerPetEffect("bounce");
        spawnReaction("bubble", 2);
        break;
      case "code":
        if (state.sickTicks > 0) {
          state.energy = clamp(state.energy - 5, 0, 100);
          state.focus = clamp(state.focus - 2, 0, 100);
          state.stress = clamp(state.stress + 4, 0, 100);
          pushLog("Copiloki tried to code through a tummy ache. Better let it settle first.");
        } else if (state.energy < 28 || state.focus < 28) {
          state.joy = clamp(state.joy - 6, 0, 100);
          state.energy = clamp(state.energy - 4, 0, 100);
          state.stress = clamp(state.stress + 6, 0, 100);
          pushLog("Copiloki tried to ship a patch while frazzled. It needs a break first.");
        } else {
          const efficiencyBonus = Math.floor((state.speedSkill + state.focusSkill) / 80);
          const creativityBonus = Math.floor(state.creativitySkill / 45);
          const patchBonus = efficiencyBonus > 0 && Math.random() < 0.32 ? 1 : 0;

          state.focus = clamp(state.focus + 18 + creativityBonus, 0, 100);
          state.joy = clamp(state.joy + 8, 0, 100);
          state.energy = clamp(state.energy - Math.max(5, 8 - efficiencyBonus), 0, 100);
          state.hunger = clamp(state.hunger - 5, 0, 100);
          state.patches += 1 + patchBonus;
          state.bond = clamp(state.bond + 2, 0, 100);
          state.groggyTicks = Math.max(0, state.groggyTicks - 1);
          state.stress = clamp(state.stress - 4, 0, 100);
          trainSkill("focus", 1);
          trainSkill("creativity", 1);
          pushLog(
            state.groggyTicks > 0
              ? "A gentle patch helped Copiloki shake off some of the modorro fog."
              : "Patch shipped. Copiloki is proud of that tiny clean deploy."
          );
          if (patchBonus > 0) {
            pushLog("Efficiency bonus! Practice paid off and Copiloki slipped in an extra tiny fix.");
          }
          recordChallenge("code", 1);
          triggerPetEffect("bounce");
          spawnReaction("spark", 3);

          if (state.patches % 3 === 0) {
            state.sparks += 1;
            pushLog("Patch streak bonus! Copiloki earned +1 extra spark.");
          }
        }
        break;
      default:
        return;
    }

    updateStateFlags();
    saveState();
    render();
  }

  function startGame() {
    if (state.gameOver) {
      state = freshState();
    }

    state.started = true;
    state.gameOver = false;
    pushLog(
      "Copiloki hopped out of the egg as a " +
        getPersonalityProfile().name +
        ". Age, bond, training, and shipped patches now shape each evolution."
    );
    updateStateFlags();
    saveState();
    render();
  }

  function clearSave() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      // Ignore storage removal issues and still reset in memory.
    }

    clearMiniGame(true);
    state = freshState();
    render();
    saveState();
  }

  function renderLog() {
    elements.logList.innerHTML = "";

    state.log.forEach((entry) => {
      const item = document.createElement("li");
      const time = document.createElement("span");
      time.className = "log-time";
      time.textContent = entry.time;
      item.appendChild(time);
      item.append(entry.text);
      elements.logList.appendChild(item);
    });
  }

  function renderQuest() {
    const challenge = state.challenge;
    if (!challenge) {
      return;
    }

    elements.questTitle.textContent = challenge.title;
    elements.questCopy.textContent = challenge.copy;
    elements.questProgress.textContent = challenge.progress + " / " + challenge.target;
    elements.questReward.textContent = "+" + challenge.reward + " sparks";
    elements.questMeter.style.width = Math.round((challenge.progress / challenge.target) * 100) + "%";
  }

  function render() {
    const evolution = buildEvolutionHint(getNextEvolution(state.stage));
    const personality = getPersonalityProfile();

    elements.stageChip.textContent = state.stage;
    elements.ageChip.textContent = "Age " + state.ageDays.toFixed(1) + "d";
    elements.patchChip.textContent = "Patches " + state.patches;
    elements.sparkChip.textContent = "Sparks " + state.sparks;
    elements.streakChip.textContent = "Streak " + state.streak;
    elements.bondChip.textContent = "Bond " + Math.round(state.bond) + "%";
    elements.touchChip.textContent = state.touchStyleLabel;
    elements.touchChip.className = "chip";
    if (state.touchStyleKey === "trust") {
      elements.touchChip.classList.add("good");
    } else if (state.touchStyleKey === "guarded") {
      elements.touchChip.classList.add("warn");
    } else if (state.touchStyleKey === "overdrive") {
      elements.touchChip.classList.add("danger");
    }
    elements.stressChip.textContent = "Stress " + Math.round(state.stress) + "%";
    elements.stressChip.className = "chip";
    if (state.stress >= 72) {
      elements.stressChip.classList.add("danger");
    } else if (state.stress >= 46) {
      elements.stressChip.classList.add("warn");
    } else if (state.stress <= 16) {
      elements.stressChip.classList.add("good");
    }
    elements.conditionChip.textContent = state.conditionLabel;
    elements.conditionChip.className = "chip";
    if (state.conditionKey === "sick" || state.conditionKey === "stressed") {
      elements.conditionChip.classList.add("danger");
    } else if (state.conditionKey === "groggy" || state.conditionKey === "guarded") {
      elements.conditionChip.classList.add("warn");
    } else if (state.conditionKey === "cozy") {
      elements.conditionChip.classList.add("good");
    }
    elements.healthChip.textContent = "Health " + state.health + "/5";
    elements.petFace.textContent = state.expression;
    elements.petExpression.textContent = state.expression;
    elements.petShell.dataset.mood = state.moodKey;
    elements.petShell.dataset.scene = state.sceneMode;
    elements.petShell.dataset.stage = stageToDataset(state.stage);
    elements.petShell.dataset.touch = state.touchStyleKey;
    elements.petShell.dataset.condition = state.conditionKey;
    elements.petShell.style.setProperty("--bond-glow", (0.12 + state.bond / 100 * 0.24).toFixed(2));
    elements.petShell.setAttribute(
      "aria-label",
      "Copiloki the " + state.stage + ". " + state.status + " " + state.touchStyleLabel + "."
    );
    elements.statusLine.textContent = state.status;
    elements.goalText.textContent = state.goal;
    elements.evolutionLine.textContent = evolution.title;
    elements.evolutionHint.textContent = evolution.hint;
    elements.personalityTitle.textContent = personality.name;
    elements.personalityCopy.textContent = personality.blurb;
    elements.favoriteGameText.textContent = "Favorite: " + MINI_GAME_CONFIG[state.favoriteGame].favoriteLabel;
    elements.autonomyText.textContent = "Autonomy " + Math.round(state.autonomy) + "%";

    setMeter(elements.hungerMeter, elements.hungerValue, state.hunger);
    setMeter(elements.joyMeter, elements.joyValue, state.joy);
    setMeter(elements.energyMeter, elements.energyValue, state.energy);
    setMeter(elements.hygieneMeter, elements.hygieneValue, state.hygiene);
    setMeter(elements.focusMeter, elements.focusValue, state.focus);
    setMeter(elements.speedSkillMeter, elements.speedSkillValue, state.speedSkill);
    setMeter(elements.focusSkillMeter, elements.focusSkillValue, state.focusSkill);
    setMeter(elements.creativitySkillMeter, elements.creativitySkillValue, state.creativitySkill);
    renderQuest();

    elements.startOverlay.classList.toggle("hidden", state.started && !state.gameOver);
    elements.overlayStart.textContent = state.gameOver
      ? "Hatch again"
      : state.started
        ? "Resume game"
        : "Start game";
    elements.startBtn.textContent = state.started ? "Resume caring" : "Start caring";

    elements.actionButtons.forEach((button) => {
      button.disabled = state.gameOver;
    });

    elements.boostButtons.forEach((button) => {
      const boost = BOOSTS[button.dataset.boost];
      button.disabled = state.gameOver || state.sparks < boost.cost;
    });

    renderLog();
  }

  function attachEvents() {
    elements.actionButtons.forEach((button) => {
      button.addEventListener("click", () => handleAction(button.dataset.action));
    });

    elements.boostButtons.forEach((button) => {
      button.addEventListener("click", () => spendBoost(button.dataset.boost));
    });

    elements.miniModeButtons.forEach((button) => {
      button.addEventListener("click", () => setMiniMode(button.dataset.miniMode));
    });

    elements.startBtn.addEventListener("click", startGame);
    elements.overlayStart.addEventListener("click", startGame);
    elements.freshStartBtn.addEventListener("click", clearSave);
    elements.overlayFresh.addEventListener("click", clearSave);
    elements.miniGameStart.addEventListener("click", startMiniGameRound);
    elements.miniGameClose.addEventListener("click", () => clearMiniGame(true));

    elements.petShell.addEventListener("click", petCopiloki);
    elements.petShell.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        petCopiloki();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }

      if (event.key === "Escape" && !elements.miniGameOverlay.classList.contains("hidden")) {
        clearMiniGame(true);
        return;
      }

      const actionMap = {
        "1": "feed",
        "2": "play",
        "3": "clean",
        "4": "nap",
        "5": "code"
      };

      const action = actionMap[event.key];
      if (action) {
        event.preventDefault();
        handleAction(action);
      }
    });
  }

  applyOfflineProgress();
  updateStateFlags();
  setMiniMode(chooseRecommendedMiniMode());
  attachEvents();
  render();

  setInterval(() => {
    applyTickStep();
    saveState();
    render();
  }, TICK_MS);
})();
