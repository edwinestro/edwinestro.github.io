(function () {
  const STORAGE_KEY = "copiloki-save-v1";
  const TICK_MS = 12000;
  const MAX_OFFLINE_STEPS = 18;
  const MAX_LOG = 8;

  const elements = {
    stageChip: document.getElementById("stageChip"),
    ageChip: document.getElementById("ageChip"),
    patchChip: document.getElementById("patchChip"),
    healthChip: document.getElementById("healthChip"),
    petShell: document.getElementById("petShell"),
    petFace: document.getElementById("petFace"),
    statusLine: document.getElementById("statusLine"),
    goalText: document.getElementById("goalText"),
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
    actionButtons: Array.from(document.querySelectorAll("[data-action]"))
  };

  function freshState() {
    return {
      started: false,
      gameOver: false,
      ageDays: 0,
      patches: 0,
      health: 5,
      hunger: 72,
      joy: 82,
      energy: 76,
      hygiene: 70,
      focus: 60,
      asleep: false,
      napSteps: 0,
      stage: "Seed Egg",
      face: "( ^_^ )",
      moodKey: "happy",
      status: "Copiloki is blinking awake and ready for its first snack.",
      goal: "Keep every stat above 40 to help Copiloki grow.",
      log: [
        {
          time: timeStamp(),
          text: "Cache cleared. A fresh Copiloki egg is ready to hatch."
        }
      ],
      lastUpdated: Date.now()
    };
  }

  function timeStamp() {
    return new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return freshState();
      }

      const parsed = JSON.parse(raw);
      return {
        ...freshState(),
        ...parsed,
        log: Array.isArray(parsed.log) && parsed.log.length ? parsed.log : freshState().log,
        lastUpdated: Date.now()
      };
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
    state.log.unshift({ time: timeStamp(), text });
    state.log = state.log.slice(0, MAX_LOG);
    if (elements.ariaLive) {
      elements.ariaLive.textContent = text;
    }
  }

  function deriveStage(ageDays) {
    if (ageDays >= 9) return "Copiloki Prime";
    if (ageDays >= 6) return "Copiloki Pro";
    if (ageDays >= 3) return "Copiloki";
    if (ageDays >= 1) return "Byte Pup";
    return "Seed Egg";
  }

  function deriveMood() {
    if (state.gameOver) {
      return {
        face: "( x_x )",
        moodKey: "critical",
        status: "Copiloki blue-screened from neglect. Hatch a new egg to try again.",
        goal: "Use Clear save to start over with a fresh Copiloki egg."
      };
    }

    if (state.asleep) {
      return {
        face: "( -.- ) zZ",
        moodKey: "sleepy",
        status: "Copiloki is taking a power nap and quietly recharging.",
        goal: "Let the nap finish, then top up the lowest stat."
      };
    }

    const lowest = Math.min(state.hunger, state.joy, state.energy, state.hygiene, state.focus);

    if (state.health <= 2 || lowest <= 12) {
      return {
        face: "( ;_; )",
        moodKey: "critical",
        status: "Copiloki feels rough and needs help right now.",
        goal: "Urgent: raise the weakest stat before health drops again."
      };
    }

    if (lowest <= 28) {
      if (state.hunger === lowest) {
        return {
          face: "( o_o )",
          moodKey: "alert",
          status: "Copiloki is hangry and staring at imaginary snacks.",
          goal: "Feed Copiloki soon to avoid a pixel meltdown."
        };
      }

      if (state.hygiene === lowest) {
        return {
          face: "( >_< )",
          moodKey: "sad",
          status: "Copiloki's nest is chaos and it wants a cleanup crew.",
          goal: "Clean up the mess so hygiene and health can recover."
        };
      }

      return {
        face: "( ._. )",
        moodKey: "sad",
        status: "Copiloki feels a little neglected and needs attention.",
        goal: "Boost the weakest stat back over 40."
      };
    }

    if (state.focus >= 78 && state.energy >= 55) {
      return {
        face: "( ^o^ )",
        moodKey: "alert",
        status: "Copiloki is locked in and ready to ship something brilliant.",
        goal: "Try Ship patch while focus and energy are high."
      };
    }

    return {
      face: "( ^_^ )",
      moodKey: "happy",
      status: "Copiloki is happy, curious, and ready for the next little adventure.",
      goal: "Keep every stat above 40 to help Copiloki grow."
    };
  }

  function updateStateFlags() {
    state.stage = deriveStage(state.ageDays);

    const weakStats = [state.hunger, state.joy, state.energy, state.hygiene, state.focus].filter((value) => value < 25).length;
    if (weakStats >= 2) {
      state.health = clamp(state.health - 1, 0, 5);
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
    }

    if (state.health <= 0) {
      state.gameOver = true;
      state.asleep = false;
    }

    const mood = deriveMood();
    state.face = mood.face;
    state.moodKey = mood.moodKey;
    state.status = mood.status;
    state.goal = mood.goal;
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

    if (state.asleep) {
      state.energy = clamp(state.energy + randomInt(7, 11), 0, 100);
      state.napSteps = Math.max(0, state.napSteps - 1);
      if (state.napSteps === 0 || state.energy >= 92) {
        state.asleep = false;
        pushLog("Copiloki woke up refreshed and extra shiny.");
      }
    } else {
      state.energy = clamp(state.energy - randomInt(2, 4), 0, 100);
    }

    if (Math.random() < 0.22) {
      state.hygiene = clamp(state.hygiene - 7, 0, 100);
      pushLog("Copiloki scattered pixel crumbs all over the nest.");
    }

    if (state.stage === "Copiloki Prime" && Math.random() < 0.18) {
      state.joy = clamp(state.joy + 2, 0, 100);
      pushLog("Copiloki Prime strutted around proudly after shipping a clean build.");
    }

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
        state.hunger = clamp(state.hunger + 20, 0, 100);
        state.joy = clamp(state.joy + 4, 0, 100);
        state.energy = clamp(state.energy + 2, 0, 100);
        state.hygiene = clamp(state.hygiene - 2, 0, 100);
        pushLog("Copiloki munched a glowing snack and is no longer hangry.");
        break;
      case "play":
        state.joy = clamp(state.joy + 18, 0, 100);
        state.focus = clamp(state.focus + 5, 0, 100);
        state.energy = clamp(state.energy - 7, 0, 100);
        state.hunger = clamp(state.hunger - 4, 0, 100);
        pushLog("You played bug-chase with Copiloki. Tiny victory dance unlocked.");
        break;
      case "clean":
        state.hygiene = clamp(state.hygiene + 24, 0, 100);
        state.health = clamp(state.health + 1, 0, 5);
        pushLog("The nest is spotless again and Copiloki smells like fresh static.");
        break;
      case "nap":
        state.asleep = true;
        state.napSteps = 2;
        state.energy = clamp(state.energy + 12, 0, 100);
        pushLog("Copiloki curled up for a power nap under a warm monitor glow.");
        break;
      case "code":
        if (state.energy < 28 || state.focus < 28) {
          state.joy = clamp(state.joy - 6, 0, 100);
          state.energy = clamp(state.energy - 4, 0, 100);
          pushLog("Copiloki tried to ship a patch while frazzled. It needs a break first.");
        } else {
          state.focus = clamp(state.focus + 18, 0, 100);
          state.joy = clamp(state.joy + 8, 0, 100);
          state.energy = clamp(state.energy - 8, 0, 100);
          state.hunger = clamp(state.hunger - 5, 0, 100);
          state.patches += 1;
          pushLog("Patch shipped. Copiloki is proud of that tiny clean deploy.");
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
    pushLog("Copiloki hopped out of the egg and is ready to play.");
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

  function render() {
    elements.stageChip.textContent = state.stage;
    elements.ageChip.textContent = "Age " + state.ageDays.toFixed(1) + "d";
    elements.patchChip.textContent = "Patches " + state.patches;
    elements.healthChip.textContent = "Health " + state.health + "/5";
    elements.petFace.textContent = state.face;
    elements.petShell.dataset.mood = state.moodKey;
    elements.statusLine.textContent = state.status;
    elements.goalText.textContent = state.goal;

    setMeter(elements.hungerMeter, elements.hungerValue, state.hunger);
    setMeter(elements.joyMeter, elements.joyValue, state.joy);
    setMeter(elements.energyMeter, elements.energyValue, state.energy);
    setMeter(elements.hygieneMeter, elements.hygieneValue, state.hygiene);
    setMeter(elements.focusMeter, elements.focusValue, state.focus);

    elements.startOverlay.classList.toggle("hidden", state.started && !state.gameOver);
    elements.overlayStart.textContent = state.gameOver ? "Hatch again" : (state.started ? "Resume game" : "Start game");
    elements.startBtn.textContent = state.started ? "Resume caring" : "Start caring";

    elements.actionButtons.forEach((button) => {
      button.disabled = state.gameOver;
    });

    renderLog();
  }

  function attachEvents() {
    elements.actionButtons.forEach((button) => {
      button.addEventListener("click", () => handleAction(button.dataset.action));
    });

    elements.startBtn.addEventListener("click", startGame);
    elements.overlayStart.addEventListener("click", startGame);
    elements.freshStartBtn.addEventListener("click", clearSave);
    elements.overlayFresh.addEventListener("click", clearSave);

    document.addEventListener("keydown", (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey) {
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
