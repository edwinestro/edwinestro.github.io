// components/game.js
export function renderGame() {
  return `
    <section class="game-section" id="game-section">
      <h2>Interactive Project: Memory Sequence Game</h2>
      <p>
        Test your memory with this interactive game built with JavaScript.
        Choose a difficulty, click the middle tile to start, then follow the sequence.
        Difficulty 1: Classic memory sequence - tiles light up in sequence, press them in order.
        Difficulty 2: Board glows with tile colors in sequence, click the tile with the matching color.
        Each level adds a new step to the sequence.
      </p>
      
      <div id="difficulty-selector">
        <select id="difficulty">
          <option value="1" selected>Difficulty 1</option>
          <option value="2">Difficulty 2</option>
        </select>
      </div>

      <div id="board-size-selector" style="margin-top:12px;">
        <label for="board-size">Board size:</label>
        <select id="board-size">
          <option value="2">2 x 2</option>
          <option value="3" selected>3 x 3</option>
          <option value="4">4 x 4</option>
          <option value="5">5 x 5</option>
          <option value="6">6 x 6</option>
          <option value="7">7 x 7</option>
        </select>
      </div>

      <div id="lives-selector" style="margin-top:8px;">
        <label for="lives">Lives:</label>
        <select id="lives">
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3" selected>3</option>
          <option value="4">4</option>
          <option value="5">5</option>
        </select>
      </div>
      
      <div id="game-message">
        Select Difficulty and Click the middle tile to Begin
      </div>
      
      <div id="game-container"></div>
      <div id="led">Start</div>
      <div style="margin-top:12px;"><button id="game-reset" aria-label="Reset game">Reset</button></div>

      <div style="margin-top:8px;">
        <button id="view-leaderboard" aria-label="View leaderboard">View leaderboard</button>
      </div>

      <!-- Leaderboard modal (hidden by default) -->
      <div id="leaderboard-modal" class="leaderboard-modal hidden" role="dialog" aria-modal="true" aria-labelledby="leaderboard-title">
        <div class="leaderboard-inner">
          <h3 id="leaderboard-title">Leaderboard</h3>
          <p id="leaderboard-result" style="margin-top:6px;font-size:14px;color:#222"></p>
          <label for="leader-name" style="display:block;margin-top:8px;font-size:13px;color:#333">Enter your name to save:</label>
          <input id="leader-name" type="text" maxlength="32" placeholder="Your name" style="width:100%;padding:8px;margin-top:6px;border-radius:6px;border:1px solid #ccc" />
          <div style="display:flex;gap:8px;margin-top:10px;">
            <button id="leader-save">Save</button>
            <button id="leader-skip">Skip</button>
            <button id="leader-clear" title="Clear leaderboard">Clear</button>
          </div>

          <hr style="margin:10px 0">
          <div style="max-height:220px;overflow:auto;">
            <ol id="leader-list" style="padding-left:18px;margin:0 0 8px 0;"></ol>
          </div>
          <div style="text-align:right;margin-top:8px;"><button id="leader-close">Close</button></div>
        </div>
      </div>

      <!-- Magical Clinical Mode Banner -->
      <div class="magical-clinical-banner">
        <div class="magic-sparkles">
          <div class="sparkle sparkle-1">✨</div>
          <div class="sparkle sparkle-2">⭐</div>
          <div class="sparkle sparkle-3">🌟</div>
          <div class="sparkle sparkle-4">💫</div>
          <div class="sparkle sparkle-5">✨</div>
        </div>
        <div class="magic-content">
          <h3>🧠✨ Discover the Magic of Gentle Memory Care</h3>
          <p>🌸 Our therapeutic Alz-Jaime game creates moments of joy and connection. Watch as cognitive pathways gently strengthen through playful, pressure-free interaction.</p>
          <div class="magic-stats">
            <div class="stat">
              <span class="stat-number">∞</span>
              <span class="stat-label">Patience</span>
            </div>
            <div class="stat">
              <span class="stat-number">💝</span>
              <span class="stat-label">Care</span>
            </div>
            <div class="stat">
              <span class="stat-number">🌈</span>
              <span class="stat-label">Joy</span>
            </div>
          </div>
          <a href="AlzJaime.html" class="magic-portal" target="_blank">
            <span class="portal-text">Enter the Healing Portal</span>
            <span class="portal-arrow">✨→</span>
          </a>
        </div>
        <div class="magic-orb"></div>
      </div>
    </section>
  `;
}
