(function () {
  const STORAGE_KEY = "copiloki-save-v1";
  const TICK_MS = 12000;
  const MAX_OFFLINE_STEPS = 18;
  const MAX_LOG = 8;
  const PET_COOLDOWN_MS = 7000;
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
    }
  ];

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
    miniGameCopy: document.getElementById("miniGameCopy"),
    miniTimer: document.getElementById("miniTimer"),
    miniScore: document.getElementById("miniScore"),
    miniArena: document.getElementById("miniArena"),
    miniGameStart: document.getElementById("miniGameStart"),
    miniGameClose: document.getElementById("miniGameClose")
  };

  const miniGame = {
    active: false,
    score: 0,
    endAt: 0,
    timer: null,
    spawner: null,
    finishTimeout: null
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
      petCooldownUntil: 0,
      stage: "Seed Egg",
      face: "( ^_^ )",
      moodKey: "happy",
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
    const classes = ["effect-bounce", "effect-glow"];
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
    state.face = mood.face;
    state.moodKey = mood.moodKey;
    state.expression = mood.expression;
    state.sceneMode = deriveSceneMode();
    state.status = mood.status;
    state.goal = mood.goal;

    if (state.sickTicks > 0) {
      state.conditionKey = "sick";
      state.conditionLabel = "Condition Sick tummy";
    } else if (state.groggyTicks > 0 && !state.asleep) {
      state.conditionKey = "groggy";
      state.conditionLabel = "Condition Modorro";
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

    state.ageDays = Number((state.ageDays + 0.2).toFixed(1));
    state.hunger = clamp(state.hunger - randomInt(2, 4), 0, 100);
    state.joy = clamp(state.joy - randomInt(1, 3), 0, 100);
    state.hygiene = clamp(state.hygiene - randomInt(1, 3), 0, 100);
    state.focus = clamp(state.focus - randomInt(1, 2), 0, 100);
    state.overfed = Math.max(0, state.overfed - 1);

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

    if (state.asleep) {
      state.energy = clamp(state.energy + randomInt(7, 11), 0, 100);
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
    if (now < (state.petCooldownUntil || 0)) {
      pushLog("Copiloki is already purring from the last head pat.");
      render();
      return;
    }

    state.petCooldownUntil = now + PET_COOLDOWN_MS;
    state.joy = clamp(state.joy + 5, 0, 100);
    state.focus = clamp(state.focus + 2, 0, 100);
    state.bond = clamp(state.bond + 3, 0, 100);
    state.groggyTicks = Math.max(0, state.groggyTicks - 1);
    pushLog("You gave Copiloki a gentle head pat. Tiny purr unlocked.");
    recordChallenge("pet", 1);
    triggerPetEffect("glow");
    spawnReaction("heart", 3);
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
    elements.miniGameCopy.textContent =
      "Click the drifting bugs before they escape. The better you do, the more joy and sparks Copiloki earns.";
    elements.miniArena.innerHTML = "";
    elements.miniTimer.textContent = "9.0s";
    elements.miniScore.textContent = "0 caught";
    elements.miniGameStart.textContent = "Start hunt";
    elements.miniGameStart.disabled = false;
  }

  function updateMiniHud() {
    const remaining = Math.max(0, (miniGame.endAt - Date.now()) / 1000);
    elements.miniTimer.textContent = remaining.toFixed(1) + "s";
    elements.miniScore.textContent = miniGame.score + " caught";
  }

  function spawnBug() {
    if (!miniGame.active) {
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

      miniGame.score += 1;
      updateMiniHud();
      bug.classList.add("pop");
      setTimeout(() => bug.remove(), 120);
    });

    elements.miniArena.appendChild(bug);
    setTimeout(() => bug.remove(), 1200);
  }

  function clearMiniGame(hideOverlay) {
    clearInterval(miniGame.timer);
    clearInterval(miniGame.spawner);
    clearTimeout(miniGame.finishTimeout);
    miniGame.active = false;
    miniGame.timer = null;
    miniGame.spawner = null;
    miniGame.finishTimeout = null;
    elements.miniArena.innerHTML = "";

    if (hideOverlay) {
      elements.miniGameOverlay.classList.add("hidden");
    }
  }

  function finishMiniGame() {
    const score = miniGame.score;
    clearMiniGame(false);

    const joyBonus = clamp(6 + score * 2, 6, 28);
    const focusBonus = clamp(3 + score, 3, 16);
    const sparkBonus = score >= 8 ? 3 : score >= 5 ? 2 : score >= 2 ? 1 : 0;

    state.joy = clamp(state.joy + joyBonus, 0, 100);
    state.focus = clamp(state.focus + focusBonus, 0, 100);
    state.energy = clamp(state.energy - 5, 0, 100);
    state.hunger = clamp(state.hunger - 3, 0, 100);
    state.sparks += sparkBonus;
    state.bond = clamp(state.bond + Math.max(1, Math.floor(score / 3)), 0, 100);
    state.groggyTicks = Math.max(0, state.groggyTicks - 1);

    recordChallenge("play", 1);
    recordChallenge("play-score", score);
    triggerPetEffect("bounce");
    spawnReaction(score >= 7 ? "spark" : "heart", score >= 7 ? 4 : 3);

    if (score >= 7) {
      pushLog("Bug hunt victory! Copiloki caught " + score + " bits and earned +" + sparkBonus + " sparks.");
      elements.miniGameCopy.textContent = "Amazing round. Copiloki is buzzing with confidence.";
    } else if (score >= 3) {
      pushLog("Solid bug hunt. Copiloki caught " + score + " bits and stayed cheerful.");
      elements.miniGameCopy.textContent = "Nice catch. Copiloki wants to play again soon.";
    } else {
      pushLog("Tiny bug hunt complete. Even one caught bit still counts as practice.");
      elements.miniGameCopy.textContent = "A short round still helped Copiloki have fun.";
    }

    elements.miniTimer.textContent = "Done";
    elements.miniScore.textContent = score + " caught";
    elements.miniGameStart.disabled = false;
    elements.miniGameStart.textContent = "Play again";

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
    miniGame.endAt = Date.now() + MINI_GAME_MS;
    elements.miniGameStart.disabled = true;
    elements.miniGameStart.textContent = "Hunting...";
    elements.miniArena.innerHTML = "";
    updateMiniHud();

    spawnBug();
    miniGame.spawner = setInterval(spawnBug, MINI_SPAWN_MS);
    miniGame.timer = setInterval(updateMiniHud, 100);
    miniGame.finishTimeout = setTimeout(finishMiniGame, MINI_GAME_MS);
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
          pushLog("Copiloki tried to code through a tummy ache. Better let it settle first.");
        } else if (state.energy < 28 || state.focus < 28) {
          state.joy = clamp(state.joy - 6, 0, 100);
          state.energy = clamp(state.energy - 4, 0, 100);
          pushLog("Copiloki tried to ship a patch while frazzled. It needs a break first.");
        } else {
          state.focus = clamp(state.focus + 18, 0, 100);
          state.joy = clamp(state.joy + 8, 0, 100);
          state.energy = clamp(state.energy - 8, 0, 100);
          state.hunger = clamp(state.hunger - 5, 0, 100);
          state.patches += 1;
          state.bond = clamp(state.bond + 2, 0, 100);
          state.groggyTicks = Math.max(0, state.groggyTicks - 1);
          pushLog(
            state.groggyTicks > 0
              ? "A gentle patch helped Copiloki shake off some of the modorro fog."
              : "Patch shipped. Copiloki is proud of that tiny clean deploy."
          );
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
    pushLog("Copiloki hopped out of the egg. Age, bond, and shipped patches now shape each evolution.");
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

    elements.stageChip.textContent = state.stage;
    elements.ageChip.textContent = "Age " + state.ageDays.toFixed(1) + "d";
    elements.patchChip.textContent = "Patches " + state.patches;
    elements.sparkChip.textContent = "Sparks " + state.sparks;
    elements.streakChip.textContent = "Streak " + state.streak;
    elements.bondChip.textContent = "Bond " + Math.round(state.bond) + "%";
    elements.conditionChip.textContent = state.conditionLabel;
    elements.conditionChip.className = "chip";
    if (state.conditionKey === "sick") {
      elements.conditionChip.classList.add("danger");
    } else if (state.conditionKey === "groggy") {
      elements.conditionChip.classList.add("warn");
    }
    elements.healthChip.textContent = "Health " + state.health + "/5";
    elements.petFace.textContent = state.expression;
    elements.petExpression.textContent = state.expression;
    elements.petShell.dataset.mood = state.moodKey;
    elements.petShell.dataset.scene = state.sceneMode;
    elements.petShell.dataset.stage = stageToDataset(state.stage);
    elements.petShell.dataset.condition = state.conditionKey;
    elements.petShell.style.setProperty("--bond-glow", (0.12 + state.bond / 100 * 0.24).toFixed(2));
    elements.petShell.setAttribute("aria-label", "Copiloki the " + state.stage + ". " + state.status);
    elements.statusLine.textContent = state.status;
    elements.goalText.textContent = state.goal;
    elements.evolutionLine.textContent = evolution.title;
    elements.evolutionHint.textContent = evolution.hint;

    setMeter(elements.hungerMeter, elements.hungerValue, state.hunger);
    setMeter(elements.joyMeter, elements.joyValue, state.joy);
    setMeter(elements.energyMeter, elements.energyValue, state.energy);
    setMeter(elements.hygieneMeter, elements.hygieneValue, state.hygiene);
    setMeter(elements.focusMeter, elements.focusValue, state.focus);
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
  attachEvents();
  render();

  setInterval(() => {
    applyTickStep();
    saveState();
    render();
  }, TICK_MS);
})();
