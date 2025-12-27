// difficulty1.js - Classic Memory Sequence Game
// A tile lights up, player presses it, then two tiles, then three, etc.
// Each level adds one more step to the sequence.

export function initDifficulty1() {
  const container = document.getElementById('game-container');
  const message = document.getElementById('game-message');
  const difficultySelect = document.getElementById('difficulty');
  const boardSizeSelect = document.getElementById('board-size');
  const livesSelect = document.getElementById('lives');

  // Game state
  const state = {
    sequence: [],           // The pattern to remember
    playerSequence: [],     // What the player has clicked
    level: 0,              // Current level
    active: false,         // Is the game accepting input?
    tiles: [],             // Array of tile elements
    boardSize: 3,          // Default 3x3 grid
    lives: 3,              // Number of lives
    playbackActive: false, // Is sequence currently playing?
    timers: []             // Store timeouts for cleanup
  };

  // Colors for tiles
  const tileColors = {
    default: '#2e7d32',    // Dark green default
    highlight: '#66bb6a',  // Bright green when lit
    player: '#4caf50',     // Medium green for player input
    error: '#f44336'       // Red for mistakes
  };

  // Initialize the game
  function init() {
    state.boardSize = parseInt(boardSizeSelect?.value || 3);
    state.lives = parseInt(livesSelect?.value || 3);
    createBoard();
    setupEventListeners();
    updateMessage('Click the center tile to start!');
  }

  // Create the game board
  function createBoard() {
    while(container.firstChild) container.removeChild(container.firstChild);
    state.tiles = [];

    const totalTiles = state.boardSize * state.boardSize;
    container.style.gridTemplateColumns = `repeat(${state.boardSize}, 1fr)`;
    container.style.gap = '8px';

    for (let i = 0; i < totalTiles; i++) {
      const tile = document.createElement('div');
      tile.className = 'tile difficulty1-tile';
      tile.dataset.index = i;
      tile.style.backgroundColor = tileColors.default;
      tile.style.borderRadius = '8px';
      tile.style.cursor = 'pointer';
      tile.style.transition = 'all 0.2s ease';
      tile.style.minHeight = '60px';
      tile.style.display = 'flex';
      tile.style.alignItems = 'center';
      tile.style.justifyContent = 'center';
      tile.style.fontSize = '18px';
      tile.style.fontWeight = 'bold';
      tile.style.color = 'white';
      tile.style.userSelect = 'none';

      // Mark center tile as start
      if (i === getCenterIndex()) {
        tile.textContent = 'START';
        tile.classList.add('start-tile');
        tile.style.backgroundColor = '#1976d2';
      }

      tile.addEventListener('click', handleTileClick);
      container.appendChild(tile);
      state.tiles.push(tile);
    }
  }

  // Get the center tile index
  function getCenterIndex() {
    const rows = state.boardSize;
    const cols = state.boardSize;
    const centerRow = Math.floor(rows / 2);
    const centerCol = Math.floor(cols / 2);
    return centerRow * cols + centerCol;
  }

  // Setup event listeners
  function setupEventListeners() {
    // Board size changes
    if (boardSizeSelect) {
      boardSizeSelect.addEventListener('change', () => {
        state.boardSize = parseInt(boardSizeSelect.value);
        resetGame();
      });
    }

    // Lives changes
    if (livesSelect) {
      livesSelect.addEventListener('change', () => {
        state.lives = parseInt(livesSelect.value);
        updateLivesDisplay();
      });
    }

    // Difficulty changes (reset if not difficulty 1)
    if (difficultySelect) {
      difficultySelect.addEventListener('change', () => {
        if (parseInt(difficultySelect.value) !== 1) {
          resetGame();
        }
      });
    }
  }

  // Start a new game
  function startGame() {
    clearAllTimers();
    state.sequence = [];
    state.playerSequence = [];
    state.level = 0;
    state.active = false;
    state.playbackActive = false;

    // Remove start text
    const startTile = state.tiles[getCenterIndex()];
    if (startTile) {
      startTile.textContent = '';
      startTile.classList.remove('start-tile');
      startTile.style.backgroundColor = tileColors.default;
    }

    updateMessage('Get ready...');
    setTimeout(() => nextLevel(), 1000);
  }

  // Move to next level
  function nextLevel() {
    state.level++;
    state.playerSequence = [];

    // Add one more step to the sequence
    const randomIndex = Math.floor(Math.random() * state.tiles.length);
    state.sequence.push(randomIndex);

    updateMessage(`Level ${state.level} - Watch the sequence...`);
    setTimeout(() => playSequence(), 1500);
  }

  // Play the current sequence
  function playSequence() {
    state.playbackActive = true;
    state.active = false;

    let delay = 0;
    const sequenceDelay = 600; // Time between tile highlights
    const highlightDuration = 400; // How long each tile stays lit

    state.sequence.forEach((tileIndex) => {
      const timer1 = setTimeout(() => {
        highlightTile(tileIndex, highlightDuration);
      }, delay);

      delay += sequenceDelay;
      state.timers.push(timer1);
    });

    // After sequence finishes, allow player input
    const endTimer = setTimeout(() => {
      state.playbackActive = false;
      state.active = true;
      updateMessage(`Level ${state.level} - Your turn! Repeat the sequence.`);
    }, delay);

    state.timers.push(endTimer);
  }

  // Highlight a tile (for sequence playback)
  function highlightTile(index, duration = 400) {
    const tile = state.tiles[index];
    if (!tile) return;

    // Store original color
    const originalColor = tile.style.backgroundColor;

    // Highlight the tile
    tile.style.backgroundColor = tileColors.highlight;
    tile.style.transform = 'scale(1.1)';
    tile.style.boxShadow = '0 0 20px rgba(102, 187, 106, 0.6)';

    // Add a subtle animation
    tile.style.animation = 'pulse 0.4s ease-in-out';

    // Reset after duration
    const timer = setTimeout(() => {
      tile.style.backgroundColor = originalColor;
      tile.style.transform = 'scale(1)';
      tile.style.boxShadow = 'none';
      tile.style.animation = 'none';
    }, duration);

    state.timers.push(timer);
  }

  // Handle player clicking on tiles
  function handleTileClick(event) {
    const tile = event.currentTarget;
    const index = parseInt(tile.dataset.index);

    // If game not started, check if center tile clicked
    if (!state.active && !state.playbackActive) {
      if (index === getCenterIndex()) {
        startGame();
      }
      return;
    }

    // If sequence is playing, ignore clicks
    if (state.playbackActive) {
      return;
    }

    // If game is not active, ignore clicks
    if (!state.active) {
      return;
    }

    // Player input phase
    const expectedIndex = state.sequence[state.playerSequence.length];

    // Visual feedback for player click
    playerHighlightTile(index);

    // Check if correct
    if (index === expectedIndex) {
      state.playerSequence.push(index);

      // Check if sequence is complete
      if (state.playerSequence.length === state.sequence.length) {
        // Level complete!
        state.active = false;
        updateMessage(`Level ${state.level} complete! Get ready for next level...`);

        // Brief pause then next level
        setTimeout(() => {
          nextLevel();
        }, 2000);
      } else {
        // Continue with sequence
        updateMessage(`Level ${state.level} - ${state.playerSequence.length}/${state.sequence.length} correct`);
      }
    } else {
      // Wrong tile!
      state.lives--;

      if (state.lives <= 0) {
        gameOver();
      } else {
        // Show error and replay sequence
        showError(index);
        updateMessage(`Wrong! ${state.lives} lives remaining. Watch again...`);

        setTimeout(() => {
          state.playerSequence = [];
          playSequence();
        }, 2000);
      }
    }
  }

  // Visual feedback for player clicks
  function playerHighlightTile(index) {
    const tile = state.tiles[index];
    if (!tile) return;

    const originalColor = tile.style.backgroundColor;

    tile.style.backgroundColor = tileColors.player;
    tile.style.transform = 'scale(0.95)';
    tile.style.boxShadow = '0 0 15px rgba(76, 175, 80, 0.4)';

    const timer = setTimeout(() => {
      tile.style.backgroundColor = originalColor;
      tile.style.transform = 'scale(1)';
      tile.style.boxShadow = 'none';
    }, 200);

    state.timers.push(timer);
  }

  // Show error feedback
  function showError(index) {
    const tile = state.tiles[index];
    if (!tile) return;

    tile.style.backgroundColor = tileColors.error;
    tile.style.animation = 'shake 0.5s ease-in-out';

    const timer = setTimeout(() => {
      tile.style.backgroundColor = tileColors.default;
      tile.style.animation = 'none';
    }, 500);

    state.timers.push(timer);
  }

  // Game over
  function gameOver() {
    state.active = false;
    updateMessage(`Game Over! You reached level ${state.level}. Click center tile to play again.`);

    // Reset start tile
    const startTile = state.tiles[getCenterIndex()];
    if (startTile) {
      startTile.textContent = 'START';
      startTile.classList.add('start-tile');
      startTile.style.backgroundColor = '#1976d2';
    }
  }

  // Reset game
  function resetGame() {
    clearAllTimers();
    state.sequence = [];
    state.playerSequence = [];
    state.level = 0;
    state.active = false;
    state.playbackActive = false;

    // Reset all tiles
    state.tiles.forEach(tile => {
      tile.style.backgroundColor = tileColors.default;
      tile.style.transform = 'scale(1)';
      tile.style.boxShadow = 'none';
      tile.style.animation = 'none';
      tile.textContent = '';
      tile.classList.remove('start-tile');
    });

    // Set start tile
    const startTile = state.tiles[getCenterIndex()];
    if (startTile) {
      startTile.textContent = 'START';
      startTile.classList.add('start-tile');
      startTile.style.backgroundColor = '#1976d2';
    }

    updateMessage('Click the center tile to start!');
  }

  // Clear all timers
  function clearAllTimers() {
    state.timers.forEach(timer => clearTimeout(timer));
    state.timers = [];
  }

  // Update message
  function updateMessage(text) {
    if (message) {
      message.textContent = text;
    }
  }

  // Update lives display (if we add a lives counter later)
  function updateLivesDisplay() {
    // Could add visual lives counter here
  }

  // Add CSS animations
  function addCSSAnimations() {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.15); }
        100% { transform: scale(1); }
      }

      @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
        20%, 40%, 60%, 80% { transform: translateX(5px); }
      }

      .difficulty1-tile {
        border: 2px solid #1b5e20;
      }

      .difficulty1-tile:hover {
        border-color: #4caf50;
      }

      .start-tile {
        border-color: #1976d2 !important;
        box-shadow: 0 0 10px rgba(25, 118, 210, 0.3);
      }
    `;
    document.head.appendChild(style);
  }

  // Initialize
  addCSSAnimations();
  init();

  // Return public methods
  return {
    reset: resetGame,
    getState: () => ({ ...state })
  };
}
