import { clamp } from './orbitals.js';

export function makeTextures() {
  // Offscreen textures used for floor/ceiling scanline projection.
  const floor = document.createElement('canvas');
  const ceil = document.createElement('canvas');
  floor.width = floor.height = 256;
  ceil.width = ceil.height = 256;

  const f = floor.getContext('2d');
  const c = ceil.getContext('2d');

  // Floor: neon circuit grid
  f.fillStyle = '#050a12';
  f.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 16) {
    for (let x = 0; x < 256; x += 16) {
      const on = ((x / 16 + y / 16) % 2) === 0;
      f.strokeStyle = on ? 'rgba(154,230,255,0.22)' : 'rgba(122,162,255,0.12)';
      f.lineWidth = 1;
      f.strokeRect(x + 0.5, y + 0.5, 15, 15);
      if (on) {
        f.fillStyle = 'rgba(138,255,168,0.08)';
        f.fillRect(x + 3, y + 3, 2, 2);
        f.fillRect(x + 10, y + 8, 2, 2);
      }
    }
  }
  // Add subtle traces
  for (let i = 0; i < 80; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const len = 20 + Math.random() * 60;
    const ang = Math.random() * Math.PI * 2;
    f.strokeStyle = 'rgba(154,230,255,0.08)';
    f.beginPath();
    f.moveTo(x, y);
    f.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    f.stroke();
  }

  // Ceiling: star-field + hex glow
  c.fillStyle = '#070a14';
  c.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 220; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const a = 0.15 + Math.random() * 0.55;
    c.fillStyle = `rgba(255,255,255,${a})`;
    c.fillRect(x, y, 1, 1);
  }
  // faint hex tiling
  c.strokeStyle = 'rgba(154,230,255,0.06)';
  c.lineWidth = 1;
  const hexR = 16;
  for (let yy = -hexR; yy < 256 + hexR; yy += hexR * 1.5) {
    for (let xx = -hexR; xx < 256 + hexR; xx += hexR * Math.sqrt(3)) {
      const ox = ((yy / (hexR * 1.5)) % 2) ? hexR * Math.sqrt(3) * 0.5 : 0;
      hexPath(c, xx + ox, yy, hexR);
      c.stroke();
    }
  }

  return { floor, ceil };
}

function hexPath(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function drawRoomBackdrop(ctx, w, h, theme, tex, time, camera) {
  // Draw ceiling + floor using scanline perspective mapping.
  // This gives a strong "room" feel without a full raycaster.

  const mid = Math.floor(h * 0.56);

  // Walls gradient
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.15, `rgba(154,230,255,0.06)`);
  g.addColorStop(0.55, `rgba(0,0,0,0.00)`);
  g.addColorStop(1, `rgba(0,0,0,0.35)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const wallG = ctx.createRadialGradient(w * 0.5, mid, 60, w * 0.5, mid, Math.max(w, h) * 0.9);
  wallG.addColorStop(0, 'rgba(255,255,255,0.05)');
  wallG.addColorStop(0.45, 'rgba(10,14,22,0.0)');
  wallG.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = wallG;
  ctx.fillRect(0, 0, w, h);

  // Room "light bars"
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = `rgba(154,230,255,0.08)`;
  ctx.fillRect(w * 0.08, mid - 80, 2, 180);
  ctx.fillRect(w * 0.92, mid - 80, 2, 180);
  ctx.fillStyle = `rgba(138,255,168,0.06)`;
  ctx.fillRect(w * 0.14, mid - 50, 1, 120);
  ctx.fillRect(w * 0.86, mid - 50, 1, 120);
  ctx.restore();

  // Floor/ceiling projection
  drawPlane(ctx, w, h, mid, tex.floor, time, camera, true);
  drawPlane(ctx, w, h, mid, tex.ceil, time, camera, false);

  // Horizon glow line
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = `rgba(154,230,255,0.14)`;
  ctx.fillRect(0, mid - 1, w, 2);
  ctx.restore();

  // Element-themed vignette
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const v = ctx.createRadialGradient(w * 0.5, mid, 10, w * 0.5, mid, Math.max(w, h) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(0.45, 'rgba(0,0,0,0)');
  v.addColorStop(1, `rgba(0,0,0,0.55)`);
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // Theme tint
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = `hsla(${theme.hue}, 90%, 60%, 0.07)`;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function drawPlane(ctx, w, h, mid, textureCanvas, time, camera, isFloor) {
  const texW = textureCanvas.width;
  const texH = textureCanvas.height;

  // Camera parameters
  const yaw = camera.yaw;
  const pitch = camera.pitch;
  const zoom = camera.zoom;

  // We render scanlines. For each y, compute texture coords.
  const startY = isFloor ? mid : 0;
  const endY = isFloor ? h : mid;

  const inv = isFloor ? 1 : -1;

  for (let y = startY; y < endY; y++) {
    const dy = (y - mid) * inv;
    const denom = Math.max(6, dy + (isFloor ? 30 : 40));
    const p = (320 / denom) * zoom;

    // parallax offsets
    const ox = Math.cos(yaw) * p * 0.6;
    const oy = Math.sin(yaw) * p * 0.6;

    // texture row with time drift
    const ty = ((p * 10 + time * 0.002 + pitch * 60 + oy) % texH + texH) % texH;

    // draw a single scanline by sampling texture across x
    // keep it fast: use drawImage with 1px src height stretched.
    const sx = ((ox * 12) % texW + texW) % texW;

    ctx.globalAlpha = isFloor ? clamp(0.95 - (y - mid) / (h - mid) * 0.55, 0.25, 0.95) : clamp(0.75 - (mid - y) / mid * 0.55, 0.20, 0.75);

    // Slice from texture and stretch to screen width.
    // Using a full-width draw each row keeps things simple.
    ctx.drawImage(textureCanvas, sx, ty, 1, 1, 0, y, w, 1);
  }

  ctx.globalAlpha = 1;
}

export function drawWallDecals(ctx, w, h, el, theme, time) {
  // Neon wall decals: repeating symbol + atom number.
  const mid = h * 0.56;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.font = '900 52px ui-sans-serif, system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const pulse = 0.45 + Math.sin(time * 0.0012) * 0.08;
  ctx.fillStyle = `rgba(154,230,255,${pulse * 0.16})`;
  ctx.fillText(el.symbol, w * 0.5, mid - 140);

  ctx.font = '800 14px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
  ctx.fillStyle = `rgba(138,255,168,${pulse * 0.18})`;
  ctx.fillText(`#${el.number} · ${el.name.toUpperCase()}`, w * 0.5, mid - 92);

  // side labels
  ctx.globalAlpha = 0.55;
  ctx.save();
  ctx.translate(w * 0.09, mid);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = `rgba(154,230,255,0.14)`;
  ctx.fillText(`SCIENCE LAB 5.2`, 0, 0);
  ctx.restore();

  ctx.save();
  ctx.translate(w * 0.91, mid);
  ctx.rotate(Math.PI / 2);
  ctx.fillStyle = `rgba(154,230,255,0.14)`;
  ctx.fillText(`ROOM ${el.symbol}`, 0, 0);
  ctx.restore();

  ctx.restore();
}
