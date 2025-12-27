// memorySequenceGames.js
// We're starting to understand the mythic resolution of the ecosystem complex communication systems. Hopefully we can pause Alz Heimer advance.

export function initMemoryGame() {
  const container = document.getElementById('game-container');
  const led = document.getElementById('led');
  const message = document.getElementById('game-message');
  const difficultySelect = document.getElementById('difficulty');
  const boardSizeSelect = document.getElementById('board-size');

  const state = {
    sequence: [],
    playerSequence: [],
    level: 0,
    difficulty: 1,
    tiles: [],
    active: false,
    retries: 0,
    simon: {
      lit: new Set(),
      pressed: new Set(),
      timerId: null,
      timeLeft: 10,
      countdownInterval: null
    }
  };
  const MAX_RETRIES = 2;

  // playback timers for sequence animation (so we can clear them if needed)
  let playbackTimers = [];

  // default board size
  state.boardSize = boardSizeSelect ? parseInt(boardSizeSelect.value, 10) : 3;

  // read lives selector
  const livesSelect = document.getElementById('lives');
  state.lives = livesSelect ? parseInt(livesSelect.value, 10) : 3;

  // helper: compute tile size in px and apply grid columns
  function applyBoardLayout() {
    const cols = state.boardSize;
    const gap = 8;
    const maxGridWidth = 480; // available area to fit tiles (tweakable)
    const tileSizePx = Math.max(40, Math.floor((maxGridWidth - (cols - 1) * gap) / cols));

    container.style.setProperty('--tile-size', `${tileSizePx}px`);
    container.style.setProperty('--grid-gap', `${gap}px`);
    container.style.setProperty('--cols', cols);
    container.style.gridTemplateColumns = `repeat(${cols}, var(--tile-size))`;
    container.style.gridGap = `${gap}px`;

    // adjust LED width to match board width if LED present
    if (led) {
      led.style.width = `${cols * tileSizePx + (cols - 1) * gap}px`;
    }
  }

  // 🎯 Dibuja el tablero inicial
  function drawBoard() {
    clearSimonTimers();
    while(container.firstChild) container.removeChild(container.firstChild);
    state.tiles = [];

    // apply layout based on selected board size
    applyBoardLayout();

    const total = state.boardSize * state.boardSize;
    for (let i = 0; i < total; i++) {
      const tile = document.createElement('div');
      tile.className = `tile tile-${i}`;
      tile.dataset.index = i;
      tile.setAttribute('role', 'button');
      tile.setAttribute('tabindex', '0');
      tile.addEventListener('click', handleTileClick);
      tile.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') handleTileClick(ev); });
      container.appendChild(tile);
      state.tiles.push(tile);
    }

    // give some padding between tiles and board edge via CSS var
    container.style.setProperty('--board-padding', '12px');

    // label the start tile (middle) so user knows where to click to begin
    const startIdx = getStartIndex();
    if (state.tiles[startIdx]) {
      state.tiles[startIdx].textContent = 'Start';
      state.tiles[startIdx].classList.add('start-tile');
      state.tiles[startIdx].setAttribute('aria-label', 'Start tile');
      // allow pointer events on tile (so clicks work) but label itself not intercept
      state.tiles[startIdx].style.pointerEvents = 'auto';
    }

    // ensure tiles reflect current difficulty visuals
    updateTileStyles();

    // hide the separate LED/start button (we'll use the middle tile as start)
    if (led) {
      led.classList.add('pulse');
      led.textContent = '';
      led.style.display = 'none';
    }

    message.textContent = 'Select Difficulty and click the middle tile to start';
  }

  // Update tile visuals depending on difficulty
  function updateTileStyles() {
    const total = state.tiles.length;
    state.tiles.forEach((tile, i) => {
      tile.style.transition = 'box-shadow 0.2s, transform 0.15s, background-color 0.2s, filter 0.2s, opacity 0.2s';
      tile.style.width = '';
      tile.style.height = '';
      // helper class for neutral difficulty 1
      tile.classList.toggle('difficulty1', state.difficulty === 1);

      if (state.difficulty === 1) {
        // difficulty 1: all tiles neutral green, only light when highlighted
        tile.style.backgroundColor = '#2e7d32'; // default green
        tile.style.opacity = '1';
        tile.style.filter = 'saturate(1)';
      } else if (state.difficulty === 2) {
        // difficulty 2: tiles permanently show individual colors
        tile.style.backgroundColor = getTileColor(i);
        tile.style.opacity = '1';
        tile.style.filter = 'none';
      }
      // remove any highlight classes lingering
      if (state.difficulty !== 3) {
        tile.classList.remove('active', 'active-strong', 'reflect');
        tile.style.transform = '';
      }
    });
  }

  // compute start tile index (middle-ish)
  function getStartIndex() {
    const total = state.tiles.length;
    return Math.floor((total - 1) / 2);
  }

  function hexToRgba(hex, a) {
    hex = (hex || '#1e88e5').replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(h => h + h).join('');
    const bigint = parseInt(hex, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  // Set board glow for difficulty 2
  function setBoardGlow(color) {
    if (container) {
      container.style.boxShadow = `inset 0 0 40px ${color}, 0 0 80px ${hexToRgba(color, 0.5)}`;
      container.style.border = `3px solid ${color}`;
    }
  }

  // Clear board glow
  function clearBoardGlow() {
    if (container) {
      container.style.boxShadow = '';
      container.style.border = '';
    }
  }

  // 🎯 Inicia un nuevo juego
  function startGame() {
    // cleanup any prior simon timers
    clearSimonTimers();

    state.sequence = [];
    state.level = 0;
    state.retries = 0;
    state.active = true;
    state.difficulty = parseInt(difficultySelect.value, 10);
    updateTileStyles();

    // Non-clinical flows
    message.textContent = 'Watch the sequence...';
    nextRound();
  }

  // Clinical mode: start a round with N tiles lit (no timer)
  function startClinicalRound() {
    clearSimonState();

    const total = state.tiles.length;
    // determine number of lit tiles based on level (similar to Simon but no timer)
    const n = Math.min(Math.max(1, state.level), Math.min(9, total));

    // pick n unique random indexes
    const picks = new Set();
    while (picks.size < n) {
      picks.add(Math.floor(Math.random() * total));
    }
    // mark lit tiles
    picks.forEach(idx => setTileLit(idx, true));
    state.simon.lit = new Set(picks);
    state.simon.pressed = new Set();

    message.textContent = `Clinical Mode: press the ${n} lit tile${n>1?'s':''} to turn them off.`;
    // no timer, just wait for user
    state.active = true;
  }

  function clearSimonTimers() {
    if (state.simon.timerId) {
      clearTimeout(state.simon.timerId);
      state.simon.timerId = null;
    }
    if (state.simon.countdownInterval) {
      clearInterval(state.simon.countdownInterval);
      state.simon.countdownInterval = null;
    }
  }

  function clearSimonState() {
    // clear lit visuals
    state.simon.lit.forEach(idx => setTileLit(idx, false));
    state.simon.lit.clear();
    state.simon.pressed.clear();
    clearSimonTimers();
  }

  // set a tile lit/unlit (for clinical mode)
  function setTileLit(index, lit) {
    const tile = state.tiles[index];
    if (!tile) return;
    const color = getTileColor(index);
    const neon = hexToRgba(color, 0.85);
    if (lit) {
      tile.style.opacity = '1';
      tile.classList.add('active-strong', 'reflect');
      tile.style.setProperty('--tile-neon', neon);
      tile.style.boxShadow = `0 8px 34px rgba(0,0,0,0.12), 0 0 40px 8px ${neon}`;
    } else {
      // return to dim state
      tile.classList.remove('active-strong', 'reflect');
      tile.style.removeProperty('--tile-neon');
      tile.style.boxShadow = '';
      tile.style.opacity = state.difficulty === 0 ? '0.10' : '1';
    }
  }

  // ➕ Añade un paso y reproduce la secuencia (non-Simon)
  function nextRound() {
    state.level++;
    // ensure a valid total based on selected board size (defensive)
    const total = Math.max(1, (state.boardSize || 3) * (state.boardSize || 3));
    const choice = Math.floor(Math.random() * total);
    state.sequence.push(choice);
    state.playerSequence = [];
    // debug: ensure sequence values are integers
    // console.debug('nextRound', { level: state.level, sequence: state.sequence, total });
    playSequence();
  }

  // ▶️ Reproduce la secuencia visualmente
  function playSequence() {
    // clear any previously scheduled timers
    playbackTimers.forEach(id => clearTimeout(id));
    playbackTimers = [];

    let delay = 0;
    // During playback we disable player input
    state.active = false;
    message.textContent = state.difficulty === 2 ? 'Watch the board glow...' : 'Watching...';
    // disable clicks during playback
    if (container) container.style.pointerEvents = 'none';

    // Defensive copy of sequence to avoid mutation during playback
    const seq = Array.from(state.sequence);

    seq.forEach((rawIndex, idx) => {
      const index = Number.isFinite(rawIndex) ? Number(rawIndex) : 0;
      const t = setTimeout(() => {
        try {
          // if index out of bounds, fallback to start index
          const safeIndex = (index >= 0 && index < state.tiles.length) ? index : getStartIndex() || 0;

          // difficulty 1: highlight the tile visually
          if (state.difficulty === 1) {
            highlightTile(safeIndex);
          }

          // difficulty 2: glow the board with the target tile's color
          if (state.difficulty === 2) {
            const color = getTileColor(safeIndex);
            setBoardGlow(color);
            // short flash then reset
            const clearId = setTimeout(() => {
              try {
                clearBoardGlow();
              } catch (e) { console.error(e); }
            }, 600);
            playbackTimers.push(clearId);
          }
        } catch (err) {
          console.error('Error during sequence playback step', err);
        }
      }, delay);
      playbackTimers.push(t);
      delay += 700; // fixed friendly pacing
    });

    // final timer to finish playback
    const finishTimer = setTimeout(() => {
      try {
        if (state.difficulty === 2) {
          clearBoardGlow();
        }
        message.textContent = state.difficulty === 2 ? 'Click the tile with the matching color!' : 'Your turn!';
        state.active = true;
      } catch (err) {
        console.error('Error finishing playback', err);
      } finally {
        if (container) container.style.pointerEvents = '';
        // clear playback timers array
        playbackTimers.forEach(id => clearTimeout(id));
        playbackTimers = [];
      }
    }, delay + 150);

    playbackTimers.push(finishTimer);
  }

  // ✨ Resalta un tile
  function highlightTile(index) {
    const tile = state.tiles[index];
    if (!tile) return;

    // Ensure difficulty1 class present so animation colors match
    if (state.difficulty === 1 && !tile.classList.contains('difficulty1')) {
      tile.classList.add('difficulty1');
    }

    // Use CSS classes for consistent styling and to avoid inline style conflicts
    if (state.difficulty === 1) {
      // Strong inline flash to ensure visible brightness across browsers/devices
      const prevBg = tile.style.backgroundColor || '';
      const prevBox = tile.style.boxShadow || '';
      const prevTransform = tile.style.transform || '';
      const prevOpacity = tile.style.opacity || '';

      // apply bright green flash with heavy glow
      tile.style.backgroundColor = '#66bb6a';
      tile.style.boxShadow = '0 12px 60px rgba(102,187,106,0.9), 0 0 120px rgba(102,187,106,0.45)';
      tile.style.transform = 'scale(1.08)';
      tile.style.opacity = '1';

      // ensure accessibility: briefly add active class
      tile.classList.add('active');

      // remove visual after short duration and restore previous inline styles
      setTimeout(() => {
        tile.classList.remove('active');
        tile.style.backgroundColor = prevBg;
        tile.style.boxShadow = prevBox;
        tile.style.transform = prevTransform;
        tile.style.opacity = prevOpacity;
      }, 480);

      return;
    } else {
      // small flash for other modes
      tile.classList.add('active');
      setTimeout(() => tile.classList.remove('active'), 420);
    }
  }

  // 🎨 Colores para dificultad 2/3
  // generate a palette of unique colors for tiles up to N
  function generatePalette(n) {
    const base = ['#e53935', '#1e88e5', '#43a047', '#fdd835', '#fb8c00', '#8e24aa', '#00bcd4', '#f06292', '#cddc39'];
    const palette = [];
    for (let i = 0; i < n; i++) {
      if (i < base.length) palette.push(base[i]);
      else {
        // generate more colors by rotating hue
        const hue = (i * 37) % 360;
        palette.push(`hsl(${hue} 75% 50%)`);
      }
    }
    return palette;
  }

  // cache palette per board size
  let paletteCache = {};

  function getPaletteForSize(size) {
    if (!paletteCache[size]) {
      paletteCache[size] = generatePalette(size * size);
    }
    return paletteCache[size];
  }

  function getTileColor(index) {
    const total = state.tiles.length || (state.boardSize * state.boardSize);
    const palette = getPaletteForSize(state.boardSize);
    return palette[index % palette.length];
  }

  // 👆 Maneja clics del jugador
  function handleTileClick(e) {
    const target = e.currentTarget || e.target;
    const idx = parseInt(target.dataset.index, 10);

    // if game isn't active, treat middle tile as start
    if (!state.active) {
      const startIdx = getStartIndex();
      if (idx === startIdx) {
        // remove the Start label immediately so the tile visuals are visible
        target.textContent = '';
        target.classList.remove('start-tile');
        // add a quick fade class for label transition (removed after)
        target.classList.add('start-fade');
        setTimeout(() => { try { target.classList.remove('start-fade'); } catch (e) {} }, 420);

        // small delay to allow DOM to repaint and the label fade to start
        setTimeout(() => {
          state.level = 1;
          // ensure sequence empty
          state.sequence = [];
          // flush any playback timers
          playbackTimers.forEach(id => clearTimeout(id));
          playbackTimers = [];
          startGame();
        }, 160);
      }
      return;
    }

    // Non-clinical click behavior
    if (!state.active) return;

    // visual feedback on click (player pressing)
    if (state.difficulty === 1) {
      // small click pop
      const tile = state.tiles[idx];
      tile.style.transform = 'scale(1.04)';
      setTimeout(() => (tile.style.transform = ''), 140);
    } else {
      highlightTile(idx);
    }

    state.playerSequence.push(idx);

    // Verifica paso actual
    const currentStep = state.playerSequence.length - 1;
    let isCorrect = false;
    if (state.difficulty === 2) {
      // For difficulty 2, check if the clicked tile's color matches the expected tile's color
      const expectedIndex = state.sequence[currentStep];
      const expectedColor = getTileColor(expectedIndex);
      const clickedColor = getTileColor(idx);
      isCorrect = (expectedColor === clickedColor);
    } else {
      // For other difficulties, check index match
      isCorrect = (state.playerSequence[currentStep] === state.sequence[currentStep]);
    }

    if (!isCorrect) {
      // when user is incorrect, consume a life (if present) and replay the sequence
      state.lives = (typeof state.lives === 'number') ? state.lives - 1 : 0;
      if (state.lives > 0) {
        message.textContent = `Incorrect — lives remaining: ${state.lives}`;
        state.active = false;
        setTimeout(() => {
          state.playerSequence = [];
          // visually update any UI that might show lives (if implemented)
          playSequence();
        }, 900);
        return;
      }

      // no lives left -> end game
      gameOver();
      return;
    }

    // Si completó la secuencia
    if (state.playerSequence.length === state.sequence.length) {
      message.textContent = 'Good job! Next round...';
      state.active = false;
      state.retries = 0; // reset retries on success
      setTimeout(nextRound, 900);
    }
  }

  // 💥 Fin del juego
  function gameOver() {
    message.textContent = `Game Over! You reached level ${state.level}`;
    state.active = false;
    // small visual feedback on board
    container.classList.add('game-over');
    setTimeout(() => container.classList.remove('game-over'), 900);
    // cleanup simon timers if any
    clearSimonTimers();
    // clear board glow
    clearBoardGlow();
    // reset tiles visuals when game ends
    updateTileStyles();

    // check if this score beats the top score
    const leaderboard = loadLeaderboard();
    const topEntry = leaderboard[0];
    if (!topEntry || state.level > topEntry.level) {
      // open leaderboard modal only if better than top
      openLeaderboardModal({ level: state.level, boardSize: state.boardSize, difficulty: state.difficulty });
    } else {
      // just show a message
      message.textContent = `Game Over! You reached level ${state.level}. Top score is level ${topEntry.level}.`;
    }
  }

  // Leaderboard helpers (localStorage)
  const LB_KEY = 'memoryGame_leaderboard_v1';

/* eslint-disable no-unused-vars, no-empty, no-restricted-syntax */
/* eslint-disable no-unused-vars, no-empty */
  function loadLeaderboard() {
    try {
      const raw = localStorage.getItem(LB_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      console.error('Failed to load leaderboard', err);
      return [];
    }
  }

  function saveLeaderboardEntry(entry) {
    const list = loadLeaderboard();
    list.push(entry);
    // sort by level desc, then date asc
    list.sort((a,b) => b.level - a.level || (new Date(a.date) - new Date(b.date)));
    // keep only top 1
    const trimmed = list.slice(0,1);
    try {
      localStorage.setItem(LB_KEY, JSON.stringify(trimmed));
    } catch (err) {
      console.error('Failed to save leaderboard', err);
    }
  }

  function clearLeaderboard() {
    try { localStorage.removeItem(LB_KEY); } catch (err) { console.error(err); }
    renderLeaderboard();
  }

  function renderLeaderboard() {
    const listEl = document.getElementById('leader-list');
    if (!listEl) return;
    const items = loadLeaderboard();
    while(listEl.firstChild) listEl.removeChild(listEl.firstChild);
    if (!items.length) {
      const li = document.createElement('li'); li.textContent = 'No entries yet.'; listEl.appendChild(li);
      return;
    }
    items.slice(0,20).forEach((it, idx) => {
      const li = document.createElement('li');
      li.textContent = `${idx+1}. ${it.name} — Level ${it.level} (${it.boardSize}x${it.boardSize}) — ${it.difficulty === 0 ? 'Clinical' : 'Normal'} — ${new Date(it.date).toLocaleString()}`;
      listEl.appendChild(li);
    });
  }

  function openLeaderboardModal(result) {
    const modal = document.getElementById('leaderboard-modal');
    const resultP = document.getElementById('leaderboard-result');
    const nameInput = document.getElementById('leader-name');
    const listEl = document.getElementById('leader-list');
    if (!modal || !resultP || !nameInput) return;

    resultP.textContent = `You reached level ${result.level} (${result.boardSize}x${result.boardSize})`;
    nameInput.value = '';
    modal.classList.remove('hidden');
    renderLeaderboard();

    // attach handlers
    const saveBtn = document.getElementById('leader-save');
    const skipBtn = document.getElementById('leader-skip');
    const closeBtn = document.getElementById('leader-close');
    const clearBtn = document.getElementById('leader-clear');

    function doClose() { modal.classList.add('hidden'); }

    function onSave() {
      const name = (nameInput.value || 'Anonymous').trim().slice(0,32);
      saveLeaderboardEntry({ name, level: result.level, boardSize: result.boardSize, difficulty: result.difficulty, date: (new Date()).toISOString() });
      renderLeaderboard();
      doClose();
    }

    saveBtn && (saveBtn.onclick = onSave);
    skipBtn && (skipBtn.onclick = doClose);
    closeBtn && (closeBtn.onclick = doClose);
    clearBtn && (clearBtn.onclick = () => { clearLeaderboard(); });
  }

  // wire view leaderboard button
  const viewLB = document.getElementById('view-leaderboard');
  if (viewLB) {
    viewLB.addEventListener('click', (e) => { e.preventDefault(); renderLeaderboard(); document.getElementById('leaderboard-modal').classList.remove('hidden'); });
  }

  // wire modal buttons defensively (for cases where openLeaderboardModal not used)
  document.getElementById('leader-save')?.addEventListener('click', (e) => { e.preventDefault(); document.getElementById('leader-save').click(); });

  // Attach reset control and implement reset behavior
  function resetGame() {
    // stop any running timers and clear Simon state
    clearSimonTimers();
    clearSimonState();

    // reset core state
    state.sequence = [];
    state.playerSequence = [];
    state.level = 0;
    state.retries = 0;
    state.active = false;

    // clear visual helpers
    clearBoardGlow();
    updateTileStyles();

    // restore LED visible state if present
    if (led) {
      led.classList.remove('led-active');
      led.classList.remove('pulse');
      led.textContent = 'Start';
    }

    // remove start text from any tiles and re-label middle tile
    state.tiles.forEach(t => { t.textContent = ''; t.classList.remove('start-tile'); });
    const startIdx = getStartIndex();
    if (state.tiles[startIdx]) {
      state.tiles[startIdx].textContent = 'Start';
      state.tiles[startIdx].classList.add('start-tile');
    }

    message.textContent = 'Game reset. Select difficulty and click the middle tile to start.';
  }

  // wire reset button
  const resetBtn = document.getElementById('game-reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', (e) => {
      e.preventDefault();
      resetGame();
    });
  }

  if (livesSelect) {
    livesSelect.addEventListener('change', (e) => {
      state.lives = parseInt(e.target.value, 10) || 3;
    });
  }

  if (boardSizeSelect) {
    boardSizeSelect.addEventListener('change', (e) => {
      state.boardSize = parseInt(e.target.value, 10) || 3;
      drawBoard();
    });
  }

  // 🖌 Inicializa tablero al cargar
  drawBoard();

  // Clinical / adapted mode: embed AlzJaime behavior as a modal
  function openClinicalModal() {
    // if modal exists, reuse
    let modal = document.getElementById('clinical-modal');
    if (modal) { modal.classList.remove('hidden'); return; }

    modal = document.createElement('div');
    modal.id = 'clinical-modal';
    modal.className = 'clinical-modal';
    /* eslint-disable-next-line no-restricted-syntax */
    modal.innerHTML = `
      <div class="clinical-inner">
        <h3>Clinical Mode — Adapted Memory Game</h3>
        <p style="margin:6px 0 8px 0;font-size:13px;color:#222">Calming interaction: tiles light up, press lit tiles to turn them off. No timer.</p>
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
          <label style="font-size:13px">Grid:</label>
          <select id="clinical-size">${[2,3,4,5,6,7].map(n=>`<option value="${n}" ${n===4? 'selected':''}>${n} x ${n}</option>`).join('')}</select>
          <label style="font-size:13px">Intensity:</label>
          <select id="clinical-difficulty"><option value="easy">Easy</option><option value="medium" selected>Medium</option><option value="hard">Hard</option></select>
          <button id="clinical-start">Start</button>
          <button id="clinical-close">Close</button>
        </div>
        <div id="clinical-status" style="font-size:13px;margin-bottom:8px;color:#224">Ready</div>
        <div id="clinical-board" class="clinical-board"></div>
      </div>
    `;
    document.body.appendChild(modal);

    const boardEl = modal.querySelector('#clinical-board');
    const statusEl = modal.querySelector('#clinical-status');
    const sizeSel = modal.querySelector('#clinical-size');
    const diffSel = modal.querySelector('#clinical-difficulty');
    const startBtn = modal.querySelector('#clinical-start');
    const closeBtn = modal.querySelector('#clinical-close');

    // ClinicalGame class
    class ClinicalGame {
      constructor(boardEl, statusEl) {
        this.boardEl = boardEl;
        this.statusEl = statusEl;
        this.size = parseInt(sizeSel.value,10) || 4;
        this.difficulty = diffSel.value || 'medium';
        this.tiles = [];
        this.lit = new Set();
      }
      initBoard() {
        while(this.boardEl.firstChild) this.boardEl.removeChild(this.boardEl.firstChild);
        this.tiles = [];
        this.boardEl.style.display = 'grid';
        this.boardEl.style.gridTemplateColumns = `repeat(${this.size}, 1fr)`;
        this.boardEl.style.gap = '8px';
        for (let i=0;i<this.size*this.size;i++) {
          const t = document.createElement('div');
          t.className = 'clinical-tile';
          t.dataset.index = i;
          t.tabIndex = 0;
          t.addEventListener('click', (e)=> this.onTileClick(e));
          this.boardEl.appendChild(t);
          this.tiles.push(t);
        }
        this.statusEl.textContent = 'Board ready. Press Start.';
      }
      pickCount() {
        const total = this.size * this.size;
        if (this.difficulty === 'easy') return Math.max(1, Math.floor(total * 0.12));
        if (this.difficulty === 'hard') return Math.max(2, Math.floor(total * 0.35));
        return Math.max(1, Math.floor(total * 0.22)); // medium
      }
      lightTiles() {
        this.clearLit();
        const count = this.pickCount();
        const total = this.size * this.size;
        const picks = new Set();
        while (picks.size < Math.min(count, total)) {
          picks.add(Math.floor(Math.random()*total));
        }
        picks.forEach(idx => {
          const tile = this.tiles[idx];
          if (!tile) return;
          tile.classList.add('clinical-lit');
          tile.style.backgroundColor = '#ffd54f';
          tile.style.boxShadow = '0 12px 48px rgba(255,213,79,0.6), 0 0 96px rgba(255,213,79,0.25)';
          this.lit.add(idx);
        });
        this.statusEl.textContent = `Lit tiles: ${this.lit.size} — click to turn off.`;
      }
      onTileClick(e) {
        const idx = parseInt(e.currentTarget.dataset.index,10);
        if (this.lit.has(idx)) {
          this.lit.delete(idx);
          const tile = this.tiles[idx];
          tile.classList.remove('clinical-lit');
          tile.style.backgroundColor = '';
          tile.style.boxShadow = '';
          this.statusEl.textContent = `Remaining lit: ${this.lit.size}`;
          if (this.lit.size === 0) {
            this.statusEl.textContent = 'Round complete — want to start again?';
          }
        }
      }
      clearLit() {
        this.lit.forEach(i => {
          const t = this.tiles[i]; if (t) { t.classList.remove('clinical-lit'); t.style.backgroundColor=''; t.style.boxShadow=''; }
        });
        this.lit.clear();
      }
      start() {
        this.size = parseInt(sizeSel.value,10) || this.size;
        this.difficulty = diffSel.value || this.difficulty;
        this.initBoard();
        setTimeout(()=> this.lightTiles(), 180);
      }
      destroy() {
        this.clearLit();
        this.tiles.forEach(t => t.remove());
        this.tiles = [];
      }
    }

    let clinicalGame = new ClinicalGame(boardEl, statusEl);
    clinicalGame.initBoard();

    startBtn.addEventListener('click', () => clinicalGame.start());
    closeBtn.addEventListener('click', () => { modal.classList.add('hidden'); clinicalGame.destroy(); });

    // wire external link and preview
    const anchor = document.querySelector('.alz-link');
    anchor && anchor.addEventListener('click', (e) => { e.preventDefault(); modal.classList.remove('hidden'); });
  }

  // wire preview button
  const alzPreview = document.getElementById('alz-preview');
  if (alzPreview) alzPreview.addEventListener('click', (e) => { e.preventDefault(); openClinicalModal(); });
}
