// Unsupervised 3D has been rebuilt as a standalone Three.js game.
// This wrapper launches the new version.

export function createUnsupervised3DGame({ mount, statusBar, controls, message }) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#0b0420;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;font-family:system-ui,sans-serif;color:#e6f0ff;text-align:center;';
  wrap.innerHTML = [
    '<h2 style="font-size:1.3rem;background:linear-gradient(90deg,#ff6ec7,#7b61ff,#00e5ff);-webkit-background-clip:text;-webkit-text-fill-color:transparent">Neon Vault \u2014 Unsupervised 3D</h2>',
    '<p style="font-size:.9rem;opacity:.8;max-width:360px;line-height:1.5">This game has been rebuilt with proper 3D graphics (Three.js + WebGL).<br>Click below to play the new version.</p>',
    '<a href="../../Projects/games/unsupervised-3d/index.html" style="display:inline-block;padding:10px 32px;border-radius:12px;background:linear-gradient(135deg,#7b61ff,#ff6ec7);color:#fff;font-weight:700;font-size:1rem;text-decoration:none">Play Neon Vault</a>',
    '<button class="btn" style="opacity:.6;font-size:.8rem;margin-top:4px" id="unsup3dClose">Stay on this page</button>',
  ].join('');
  mount.appendChild(wrap);

  wrap.querySelector('#unsup3dClose').addEventListener('click', () => { wrap.remove(); });

  const chip = document.createElement('div');
  chip.className = 'status-chip';
  chip.innerHTML = '<strong>Room:</strong> Neon Vault (3D)';
  statusBar.appendChild(chip);
  message.textContent = 'Neon Vault rebuilt with Three.js';

  function destroy() { try { wrap.remove(); } catch (_) { /* ok */ } }
  return { destroy };
}
