import { makeChair } from './objects/chairObject.js';

export function createUnsupervised3DGame({ mount, statusBar, controls, message }){
  // Lightweight factual 3D renderer using canvas 2D (software projection)
  // full-screen fixed canvas
  const wrap = document.createElement('div'); wrap.style.cssText='position:fixed;inset:0;background:#03060a;display:flex;';
  const canvas = document.createElement('canvas'); canvas.style.cssText='flex:1;width:100vw;height:100vh;display:block;';
  wrap.appendChild(canvas);
  const ui = document.createElement('div'); ui.style.cssText='width:320px;display:flex;flex-direction:column;gap:10px;';
  const title = document.createElement('h3'); title.textContent='Unsupervised 3D — Memory Room'; ui.appendChild(title);
  const info = document.createElement('div'); info.style.cssText='font-size:.85rem;opacity:.9'; info.textContent='Small single-room 3D view with a memory matching task. Use mouse to look and click tiles to reveal.'; ui.appendChild(info);
  const restart = document.createElement('button'); restart.className='btn'; restart.textContent='Restart'; ui.appendChild(restart);
  const sitBtn = document.createElement('button'); sitBtn.className='btn'; sitBtn.textContent='Sit'; ui.appendChild(sitBtn);
  const lookBtn = document.createElement('button'); lookBtn.className='btn'; lookBtn.textContent='Enter Look Mode'; ui.appendChild(lookBtn);
  /* eslint-disable no-restricted-syntax */
/* eslint-disable no-unused-vars, no-empty, no-restricted-syntax */
/* eslint-disable no-unused-vars, no-empty */
const invDiv = document.createElement('div'); invDiv.style.cssText='margin-top:8px;padding:8px;background:rgba(0,0,0,0.25);border-radius:8px;color:#ddd;font-size:.9rem;'; invDiv.innerHTML = '<strong>Inventory</strong><div id="invSword">Sword: —</div><div id="invShield">Shield: —</div>'; ui.appendChild(invDiv);
  wrap.appendChild(ui);
  mount.appendChild(wrap);

  const ctx = canvas.getContext('2d');
  let raf = 0;

  // input state for movement
  const keys = { w:false,a:false,s:false,d:false };
  const moveSpeed = 2.4; // meters per second

  // scene objects (generic boxes) loaded from patterns
  const objects = [];

  // simple directional light in world space
  // directional key light and ambient for dungeon feel
  const lightDir = (function(){ const v=[0.35,0.82,0.42]; const l = Math.hypot(...v); return { x:v[0]/l, y:v[1]/l, z:v[2]/l }; })();
  const ambientLight = 0.28; // increase base ambient so scene is less dark
  // wall torches (warm colored point lights)
  const torches = [
    { x: -4.4, y: 1.6, z: -2.8, color: [1.0,0.6,0.25], intensity: 1.6, freq: 5.2, phase: 0.2 },
    { x: 4.4, y: 1.6, z: -2.8, color: [1.0,0.6,0.25], intensity: 1.4, freq: 4.8, phase: 1.1 },
    { x: -4.4, y: 1.6, z: 2.8, color: [1.0,0.55,0.2], intensity: 1.2, freq: 5.6, phase: 2.3 },
    { x: 4.4, y: 1.6, z: 2.8, color: [1.0,0.55,0.2], intensity: 1.2, freq: 5.0, phase: 0.7 }
  ];

  // hover state
  let hoverTarget = null;
  let pointerLocked = false;
  const inventory = { Sword: null, Shield: null };
  // start overlay to get user gesture for fullscreen + pointer lock
  const startOverlay = document.createElement('div'); startOverlay.style.cssText = 'position:fixed;inset:0;display:grid;place-items:center;background:linear-gradient(180deg,rgba(0,0,0,0.6),rgba(0,0,0,0.45));z-index:9999;cursor:pointer;';
  const startCard = document.createElement('div'); startCard.style.cssText='background:linear-gradient(180deg,#0b1220,#071017);padding:22px 28px;border-radius:14px;border:1px solid rgba(255,255,255,0.04);text-align:center;color:#e6f9ff;';
  startCard.innerHTML = '<div style="font-size:1.2rem;font-weight:700;margin-bottom:8px">Enter the Dungeon</div><div style="font-size:.9rem;opacity:.9;margin-bottom:12px">Click to start in fullscreen & enable mouse look (Esc to exit)</div><div class="btn start" style="cursor:pointer;">Start</div>';
  startOverlay.appendChild(startCard);
  wrap.appendChild(startOverlay);

  function onStartClick(e){
    try{ if(wrap.requestFullscreen) wrap.requestFullscreen(); else if(document.documentElement.requestFullscreen) document.documentElement.requestFullscreen(); }catch(err){}
    // request pointer lock on the canvas (user gesture)
    try{ if(canvas.requestPointerLock) canvas.requestPointerLock(); }catch(err){}
    // remove overlay after gesture
    startOverlay.removeEventListener('click', onStartClick);
    try{ startOverlay.remove(); }catch(e){}
  }
  startOverlay.addEventListener('click', onStartClick);

  function dot(a,b){return a[0]*b.x + a[1]*b.y + a[2]*b.z;}
  function shadeColor(hex, lam){
    // hex '#rrggbb' -> shaded rgb string
    if(typeof hex !== 'string') return hex;
    const n = hex.replace('#',''); const r=parseInt(n.substring(0,2),16), g=parseInt(n.substring(2,4),16), b=parseInt(n.substring(4,6),16);
    const rr = Math.min(255, Math.round(r * lam)); const gg = Math.min(255, Math.round(g * lam)); const bb = Math.min(255, Math.round(b * lam));
    return `rgb(${rr},${gg},${bb})`;
  }

  // Camera & projection
  const cam = { x: 0, y: 1.6, z: -3, yaw: 0, pitch: 0 };
  const fov = Math.PI/3; // 60deg

  function resize(){ const scale = Math.min(window.devicePixelRatio||1,2); const w = Math.max(320, window.innerWidth); const h = Math.max(240, window.innerHeight); canvas.width = Math.round(w * scale); canvas.height = Math.round(h * scale); ctx.setTransform(scale,0,0,scale,0,0); }
  window.addEventListener('resize', resize);
  resize();

  // Scene: room bounds and tiles grid
  const room = { w: 10, d: 10, h: 3.2 }; // larger dungeon room
  const tileGrid = { cols:4, rows:2, spacing:1.2, size:1.0, y:0.02 };

  // chairs data
  const chairs = [];
  let isSitting = false;
  let prevCam = null;

  // replace createChair with factory from objects module
  function createChair(x,z,width,depth,height,color){ const ch = makeChair(x,z,width,depth,height,color, tileGrid.y); chairs.push(ch); }

  // Build tiles with world positions
  let tiles = [];
  let revealed = new Set();
  let matched = new Set();
  let lock = false;
  let confetti = 0;

  function initBoard(){
    tiles = [];
    revealed.clear(); matched.clear(); lock=false; confetti=0;
    const pairCount = tileGrid.cols * tileGrid.rows;
    const colors = ['#f16262','#6db6ff','#ffd166','#8be28b','#d78bff','#7be0d6','#ff9fb7','#ffd8a8'];
    // create id pairs
    const pool = [];
    for(let i=0;i<pairCount;i++){ pool.push({id:i,color:colors[i%colors.length]}); pool.push({id:i,color:colors[i%colors.length]}); }
    // shuffle
    for(let i=pool.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [pool[i],pool[j]]=[pool[j],pool[i]]; }
    // place on floor centered at origin
    const startX = -((tileGrid.cols-1) * tileGrid.spacing)/2;
    const startZ = -1.0; // closer to back wall
    let idx=0;
    for(let r=0;r<tileGrid.rows;r++){
      for(let c=0;c<tileGrid.cols;c++){
        const p = pool[idx++];
        const x = startX + c * tileGrid.spacing;
        const z = startZ + r * tileGrid.spacing;
        tiles.push({ id: p.id, color: p.color, x, y: tileGrid.y, z, size: tileGrid.size, revealed:false, anim:0 });
      }
    }
  // create a chair near the tiles for interaction
  chairs.length = 0; // clear existing
  createChair(1.2, -0.2, 0.9, 0.9, 1.1, '#7b5cff');
  // sample object: small table
  objects.length = 0;
  loadPattern({
    parts: [
      { type: 'box', center: [0.0, 0.25, -0.6], size: [0.9, 0.08, 0.5], color: '#6b4cff' },
      { type: 'box', center: [-0.38, 0.12, -0.95], size: [0.06, 0.24, 0.06], color: '#2f2342' },
      { type: 'box', center: [0.38, 0.12, -0.95], size: [0.06, 0.24, 0.06], color: '#2f2342' },
      { type: 'box', center: [-0.38, 0.12, -0.25], size: [0.06, 0.24, 0.06], color: '#2f2342' },
      { type: 'box', center: [0.38, 0.12, -0.25], size: [0.06, 0.24, 0.06], color: '#2f2342' }
    ]
  });
  // add Sword and Shield as pickable items
  addPickable('Sword', -1.8, 0.4, -1.2, 0.9, 0.12, 0.18, '#c0c0c0');
  addPickable('Shield', 1.8, 0.6, -1.6, 0.9, 0.9, 0.08, '#7a5a2a');
    message.textContent = 'Find the pairs';
  }

  // Pattern loader: accepts simple JSON with parts: [{type:'box', center:[x,y,z], size:[w,h,d], color:'#hex'}]
  function loadPattern(pat){ if(!pat || !pat.parts) return; for(const part of pat.parts){ if(part.type==='box'){ const [cx,cy,cz]=part.center; const [w,h,d]=part.size; objects.push({ x:cx, y:cy, z:cz, w,h,d, color: part.color || '#999' }); } } }

  // helper: add pickable item
  function addPickable(name, x,y,z, w,h,d, color){ const o = { x, y, z, w, h, d, color, pickable:true, name, picked:false, held:false }; objects.push(o); }

  // Projection and camera transform
  function worldToCamera(wx, wy, wz){
    // translate
    let x = wx - cam.x;
    let y = wy - cam.y;
    let z = wz - cam.z;
    // rotate by -yaw and -pitch
    const cosy = Math.cos(-cam.yaw), siny = Math.sin(-cam.yaw);
    let rx = x * cosy - z * siny;
    let rz = x * siny + z * cosy;
    const cosp = Math.cos(-cam.pitch), sinp = Math.sin(-cam.pitch);
    let ry = y * cosp - rz * sinp;
    rz = y * sinp + rz * cosp;
    return { x: rx, y: ry, z: rz };
  }

  function project(wx, wy, wz, vw, vh){
    const camP = worldToCamera(wx, wy, wz);
    if(camP.z <= 0.05) return null; // behind camera or too close
    const h = vh, w = vw;
    const focal = (h/2) / Math.tan(fov/2);
    const sx = (camP.x * focal) / camP.z + w/2;
    const sy = -(camP.y * focal) / camP.z + h/2;
    return { x: sx, y: sy, z: camP.z };
  }

  // draw helper: draw quad in world coords (axis-aligned rectangle on floor or wall)
  function drawTileSurface(x, y, z, size, color, vw, vh, flipAlpha){
    // tile is square parallel to XZ plane centered at x,z
    const hs = size/2;
    const corners = [ [x-hs, y, z-hs], [x+hs,y,z-hs], [x+hs,y,z+hs], [x-hs,y,z+hs] ];
    const proj = corners.map(c => project(c[0],c[1],c[2],vw,vh)).filter(Boolean);
    if(proj.length<4) return null;
    // compute average depth
    const depth = proj.reduce((s,p)=>s+p.z,0)/proj.length;
    return { proj, depth, color, flipAlpha };
  }

  function drawWall(x1,z1,x2,z2,vw,vh,color){
    // draw vertical quad from floor y=0 to room.h
    const corners = [ [x1,0,z1], [x2,0,z2], [x2,room.h,z2], [x1,room.h,z1] ];
    const proj = corners.map(c=>project(c[0],c[1],c[2],vw,vh)).filter(Boolean);
    if(proj.length<4) return null;
    const depth = proj.reduce((s,p)=>s+p.z,0)/proj.length;
    return { proj, depth, color };
  }

  // Convert an axis-aligned box centered at x,y,z with sizes w,h,d into projected polygon and depth
  function boxToDrawable(cx, cy, cz, w, h, d, color, vw, vh){
    const hx = w/2, hy = h/2, hz = d/2;
    const corners = [
      [cx - hx, cy - hy, cz - hz], // 0
      [cx + hx, cy - hy, cz - hz], // 1
      [cx + hx, cy + hy, cz - hz], // 2
      [cx - hx, cy + hy, cz - hz], // 3
      [cx - hx, cy - hy, cz + hz], // 4
      [cx + hx, cy - hy, cz + hz], // 5
      [cx + hx, cy + hy, cz + hz], // 6
      [cx - hx, cy + hy, cz + hz]  // 7
    ];
    // faces defined as corner indices (quad)
      const facesIdx = [
      [0,1,2,3], // front (-z)
      [5,4,7,6], // back (+z)
      [4,0,3,7], // left
      [1,5,6,2], // right
      [3,2,6,7], // top
      [4,5,1,0]  // bottom
    ];

    const result = [];
    for(const fi of facesIdx){
      const w0 = corners[fi[0]], w1 = corners[fi[1]], w2 = corners[fi[2]];
      // compute face normal (world space)
      const e1 = [w1[0]-w0[0], w1[1]-w0[1], w1[2]-w0[2]];
      const e2 = [w2[0]-w0[0], w2[1]-w0[1], w2[2]-w0[2]];
      const nx = e1[1]*e2[2] - e1[2]*e2[1];
      const ny = e1[2]*e2[0] - e1[0]*e2[2];
      const nz = e1[0]*e2[1] - e1[1]*e2[0];
      const nl = Math.hypot(nx,ny,nz)||1; const normal = [nx/nl, ny/nl, nz/nl];
      // face center
      const cxF = (corners[fi[0]][0]+corners[fi[1]][0]+corners[fi[2]][0]+corners[fi[3]][0]) / 4;
      const cyF = (corners[fi[0]][1]+corners[fi[1]][1]+corners[fi[2]][1]+corners[fi[3]][1]) / 4;
      const czF = (corners[fi[0]][2]+corners[fi[1]][2]+corners[fi[2]][2]+corners[fi[3]][2]) / 4;
      // visible if normal faces camera
      const toCam = [ cam.x - cxF, cam.y - cyF, cam.z - czF ];
      const facing = (toCam[0]*normal[0] + toCam[1]*normal[1] + toCam[2]*normal[2]) > 0;
  if(!facing) continue;
      // project corners
      const proj = [];
      let skip=false; let camZSum=0;
      for(const idx of fi){ const c = corners[idx]; const p = project(c[0],c[1],c[2],vw,vh); if(!p){ skip=true; break; } proj.push(p); const camP = worldToCamera(c[0],c[1],c[2]); camZSum += camP.z; }
      if(skip) continue;
      const depth = camZSum / proj.length;
      result.push({ proj, depth, normal, color, center: [cxF,cyF,czF] });
    }
    if(result.length===0) return null;
    return result; // array of faces
  }

  // render loop
  function render(){
    resize();
    const time = performance.now() * 0.001;
    const vw = canvas.width / (window.devicePixelRatio||1);
    const vh = canvas.height / (window.devicePixelRatio||1);
    ctx.clearRect(0,0,vw,vh);

    // sky / backwall
    ctx.fillStyle = '#07131a'; ctx.fillRect(0,0,vw,vh);

    // collect drawables
    const drawables = [];

    // floor: draw as large quad
    const floorCorners = [ [-room.w/2,0,-room.d/2], [room.w/2,0,-room.d/2], [room.w/2,0,room.d/2], [-room.w/2,0,room.d/2] ];
    const floorProj = floorCorners.map(c=>project(c[0],c[1],c[2],vw,vh)).filter(Boolean);
    if(floorProj.length===4){ drawables.push({ proj: floorProj, depth: floorProj.reduce((s,p)=>s+p.z,0)/4, color: 'linear-floor' }); }

    // walls
    // back wall (z = -room.d/2)
    const w1 = drawWall(-room.w/2, -room.d/2, room.w/2, -room.d/2, vw, vh, '#0e2732'); if(w1) drawables.push(w1);
    // left wall
    const w2 = drawWall(-room.w/2, -room.d/2, -room.w/2, room.d/2, vw, vh, '#0b2630'); if(w2) drawables.push(w2);
    // right wall
    const w3 = drawWall(room.w/2, -room.d/2, room.w/2, room.d/2, vw, vh, '#0b2630'); if(w3) drawables.push(w3);

    // tiles
    for(let i=0;i<tiles.length;i++){
      const t = tiles[i];
      const surf = drawTileSurface(t.x, t.y+0.001, t.z, t.size, t.color, vw, vh, t.revealed?1:0);
      if(surf) drawables.push({ type:'tile', idx:i, proj:surf.proj, depth:surf.depth, color:t.color, revealed:t.revealed, anim:t.anim });
    }

    // chairs: draw parts (include metadata) - expand per-face
    for(const ch of chairs){
      const parts = [ {k:'seat', o:ch.seat}, {k:'back', o:ch.back}, ...ch.legs.map(l=>({k:'leg', o:l})) ];
      for(const part of parts){
        const faces = boxToDrawable(part.o.x, part.o.y, part.o.z, part.o.w, part.o.h, part.o.d||part.o.d, part.o.color, vw, vh);
        if(!faces) continue;
        for(const f of faces){ drawables.push({ type:'chair', proj:f.proj, depth:f.depth, color:part.o.color, normal: f.normal, meta:{ kind: part.k, chair: ch } }); }
      }
    }

  // objects from patterns (expand per-face)
  for(const obj of objects){ const faces = boxToDrawable(obj.x, obj.y, obj.z, obj.w, obj.h, obj.d, obj.color, vw, vh); if(!faces) continue; for(const f of faces) drawables.push({ type:'object', proj:f.proj, depth:f.depth, color:obj.color, normal:f.normal, center:f.center, meta: obj }); }

    // sort by depth (far to near)
    drawables.sort((a,b)=>b.depth - a.depth);

    // painting
    for(const d of drawables){
      if(d.color==='linear-floor'){
        // floor gradient
        const g = ctx.createLinearGradient(0,vh*0.45,0,vh);
        g.addColorStop(0,'#081722'); g.addColorStop(1,'#030a10'); ctx.fillStyle=g;
        ctx.beginPath(); const p0=d.proj[0]; ctx.moveTo(p0.x,p0.y); for(let j=1;j<d.proj.length;j++) ctx.lineTo(d.proj[j].x,d.proj[j].y); ctx.closePath(); ctx.fill();
      } else if(d.proj && d.proj.length){
        ctx.beginPath(); ctx.moveTo(d.proj[0].x,d.proj[0].y); for(let j=1;j<d.proj.length;j++) ctx.lineTo(d.proj[j].x,d.proj[j].y); ctx.closePath();
        if(d.type==='tile'){
          // tile fill with simple shading
          const baseColor = d.revealed ? d.color : '#0a1116';
          const lamTile = Math.max(0.15, 0.9); // tiles use flat lighting for now
          ctx.fillStyle = shadeColor(baseColor, lamTile);
          ctx.fill();
          // border
          ctx.lineWidth = 1; ctx.strokeStyle = d.revealed ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)'; ctx.stroke();
          if(d.revealed){
            // simple shine
            ctx.globalAlpha = Math.max(0, Math.min(1, d.anim));
            ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fill(); ctx.globalAlpha = 1;
          }
        } else {
          // objects / chairs: apply Lambert shading using provided normal
          const normal = d.normal || [0,1,0];
          const lamDir = Math.max(0, dot(normal, lightDir));
          // torch contributions (warm lights) with flicker
          let torchBoost = 0;
          let torchColorMix = [0,0,0];
          if(d.center){
            for(const t of torches){ const dx = t.x - d.center[0], dy = t.y - d.center[1], dz = t.z - d.center[2]; const dist2 = dx*dx+dy*dy+dz*dz + 0.001; const flick = 0.85 + 0.25 * Math.sin(time * t.freq + t.phase); const atten = (t.intensity * flick) / (1 + dist2*0.45); const nd = Math.max(0, ( (dx*normal[0] + dy*normal[1] + dz*normal[2]) / Math.sqrt(dist2) )); torchBoost += atten * nd; torchColorMix[0] += t.color[0] * atten; torchColorMix[1] += t.color[1] * atten; torchColorMix[2] += t.color[2] * atten; }
            torchBoost = Math.min(1.6, torchBoost);
          }
          // camera-headlamp (small forward light) for readability
          const camDir = [Math.sin(cam.yaw), Math.sin(cam.pitch), Math.cos(cam.yaw)];
          const headLamp = Math.max(0, dot(normal, { x: camDir[0], y: camDir[1], z: camDir[2] } )) * 0.7;
          const lam = Math.max(ambientLight, lamDir * 0.95) + torchBoost * 0.9 + headLamp * 0.6;
          // tint by torch color when strong
          let baseColor = d.color||'#10252f';
          if(torchColorMix[0]+torchColorMix[1]+torchColorMix[2] > 0.05){ // blend small amount
            // approximate blend by increasing r/g/b scale before shadeColor
            const avg = (torchColorMix[0]+torchColorMix[1]+torchColorMix[2])/3; const tint = Math.min(0.35, avg*0.12);
            // slightly warm the color by tint factor via simple multiply on rgb components
            const n = baseColor.replace('#',''); const r=parseInt(n.substring(0,2),16), g=parseInt(n.substring(2,4),16), b=parseInt(n.substring(4,6),16);
            const tr = Math.min(255, Math.round(r*(1 + tint*torchColorMix[0]))); const tg = Math.min(255, Math.round(g*(1 + tint*torchColorMix[1]))); const tb = Math.min(255, Math.round(b*(1 + tint*torchColorMix[2])));
            baseColor = `rgb(${tr},${tg},${tb})`;
          }
          // subtle rim lighting for better depth
          const rim = 0.03 * Math.max(0, 1 - Math.abs(dot(normal, [0,1,0])));
          ctx.fillStyle = shadeColor(baseColor, Math.min(1.4, lam + rim));
          ctx.fill(); ctx.lineWidth=1; ctx.strokeStyle='rgba(0,0,0,0.18)'; ctx.stroke();
          // hover highlight (simple outline)
          if(hoverTarget && hoverTarget === d.meta){ ctx.lineWidth=2; ctx.strokeStyle='rgba(255,220,120,0.95)'; ctx.stroke(); }
        }
      }
    }

    // crosshair
    ctx.save(); ctx.strokeStyle='rgba(255,220,120,0.6)'; ctx.lineWidth=1.2; const cx = vw/2, cy = vh/2; ctx.beginPath(); ctx.moveTo(cx-8,cy); ctx.lineTo(cx+8,cy); ctx.moveTo(cx,cy-8); ctx.lineTo(cx,cy+8); ctx.stroke(); ctx.restore();

  // vignette to enhance dungeon feel (darken edges)
  const vg = ctx.createRadialGradient(vw/2, vh/2, Math.min(vw,vh)*0.25, vw/2, vh/2, Math.max(vw,vh)*0.8);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)'); ctx.fillStyle = vg; ctx.fillRect(0,0,vw,vh);

    // confetti
    if(confetti>0){ confetti--; for(let i=0;i<8;i++){ ctx.fillStyle = `hsl(${(i*40+confetti*9)%360} 85% 60%)`; ctx.fillRect((Math.random()*vw), (vh*0.25 + Math.random()*vh*0.6), 4, 10); } }
  }

  // animate tiles (simple reveal animation)
  function update(dt){
    for(const t of tiles){ if(t.revealed && t.anim<1) t.anim += dt*0.008; if(!t.revealed && t.anim>0) t.anim = Math.max(0, t.anim - dt*0.01); }
    // movement (dt in ms)
    const secs = dt/1000;
    let vx=0, vz=0;
    if(keys.w) vz += 1; if(keys.s) vz -= 1; if(keys.a) vx -= 1; if(keys.d) vx += 1;
    if(vx!==0 || vz!==0){ const len = Math.hypot(vx,vz)||1; vx/=len; vz/=len; // normalize
      // rotate by camera yaw to world direction
      const cosy = Math.cos(cam.yaw), siny = Math.sin(cam.yaw);
      const wx = vx * cosy - vz * siny;
      const wz = vx * siny + vz * cosy;
      const speed = moveSpeed * secs;
      cam.x += wx * speed; cam.z += wz * speed;
      // keep inside room bounds
      cam.x = Math.max(-room.w/2 + 0.3, Math.min(room.w/2 - 0.3, cam.x));
      cam.z = Math.max(-room.d/2 + 0.3, Math.min(room.d/2 - 0.3, cam.z));
    }
  }

  let last = performance.now();
  function loop(now){ const dt = now - last; last = now; update(dt); render(); raf = requestAnimationFrame(loop); }

  // Input: mouse look and clicking
  let isPointerDown = false;
  let lastMouse = null;

  // pointer handlers (named so we can remove them on destroy)
  function onPointerDown(e){ canvas.setPointerCapture(e.pointerId); isPointerDown=true; lastMouse = {x:e.clientX, y:e.clientY}; }
  function onPointerUp(e){ canvas.releasePointerCapture && canvas.releasePointerCapture(e.pointerId); if(isPointerDown){ const rect = canvas.getBoundingClientRect(); const mx = (e.clientX - rect.left); const my = (e.clientY - rect.top); handleClick(mx, my); } isPointerDown=false; lastMouse=null; }
  function onPointerMove(e){ if(pointerLocked){ const dx = e.movementX || 0; const dy = e.movementY || 0; cam.yaw -= dx * 0.0025; cam.pitch = Math.max(-0.8, Math.min(0.6, cam.pitch - dy * 0.0025)); } else if(e.buttons===1){ const dx = e.movementX || (e.clientX - (lastMouse?lastMouse.x:e.clientX)); const dy = e.movementY || (e.clientY - (lastMouse?lastMouse.y:e.clientY)); cam.yaw -= dx * 0.002; cam.pitch = Math.max(-0.6, Math.min(0.45, cam.pitch - dy * 0.002)); lastMouse = {x:e.clientX, y:e.clientY}; } }
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointermove', onPointerMove);

  // pointer lock change handlers
  function onPointerLockChange(){ pointerLocked = (document.pointerLockElement === canvas); lookBtn.textContent = pointerLocked ? 'Exit Look Mode' : 'Enter Look Mode'; }
  function onPointerLockError(){ pointerLocked = false; lookBtn.textContent = 'Enter Look Mode'; }
  document.addEventListener('pointerlockchange', onPointerLockChange);
  document.addEventListener('pointerlockerror', onPointerLockError);

  lookBtn.addEventListener('click', ()=>{
    if(!pointerLocked){ canvas.requestPointerLock && canvas.requestPointerLock(); }
    else { document.exitPointerLock && document.exitPointerLock(); }
  });

  // hover detection: on pointer move (no button) cast ray and find object under cursor
  // hover pointer handler (named)
  function onHoverMove(e){ if(e.buttons) return; const rect = canvas.getBoundingClientRect(); const mx = e.clientX - rect.left; const my = e.clientY - rect.top; const ray = getRayFromScreen(mx,my);
    // check objects first
    let found = null;
    for(const obj of objects.concat(chairs)){ // chairs are stored separately as composite; use AABB of seat/back
      if(obj.seat){ // chair
        const ch = obj; const minX = Math.min(ch.seat.x - ch.seat.w/2, ch.back.x - ch.back.w/2); const maxX = Math.max(ch.seat.x + ch.seat.w/2, ch.back.x + ch.back.w/2);
        const minY = ch.seat.y - ch.seat.h/2 - 0.2; const maxY = ch.seat.y + ch.seat.h/2 + ch.back.h + 0.2; const minZ = Math.min(ch.seat.z - ch.seat.d/2, ch.back.z - ch.back.d/2); const maxZ = Math.max(ch.seat.z + ch.seat.d/2, ch.back.z + ch.back.d/2);
        const tmin = intersectAABB(cam,ray,minX,maxX,minY,maxY,minZ,maxZ);
        if(tmin !== null){ found = ch; break; }
      } else {
        const minX = obj.x - obj.w/2, maxX = obj.x + obj.w/2, minY = obj.y - obj.h/2, maxY = obj.y + obj.h/2, minZ = obj.z - obj.d/2, maxZ = obj.z + obj.d/2;
        const tmin = intersectAABB(cam,ray,minX,maxX,minY,maxY,minZ,maxZ);
        if(tmin !== null){ found = obj; break; }
      }
    }
    hoverTarget = found;
  }
  canvas.addEventListener('pointermove', onHoverMove);

  function intersectAABB(origin, dir, minX, maxX, minY, maxY, minZ, maxZ){ const inv = { x:1/(dir.x||1e-6), y:1/(dir.y||1e-6), z:1/(dir.z||1e-6) }; let t1=(minX-origin.x)*inv.x, t2=(maxX-origin.x)*inv.x; let tmin=Math.min(t1,t2), tmax=Math.max(t1,t2); t1=(minY-origin.y)*inv.y; t2=(maxY-origin.y)*inv.y; tmin=Math.max(tmin,Math.min(t1,t2)); tmax=Math.min(tmax,Math.max(t1,t2)); t1=(minZ-origin.z)*inv.z; t2=(maxZ-origin.z)*inv.z; tmin=Math.max(tmin,Math.min(t1,t2)); tmax=Math.min(tmax,Math.max(t1,t2)); if(tmax>=Math.max(0,tmin)) return tmin; return null; }

  // keyboard for movement
  function onMoveKeyDown(e){ if(e.key==='w'||e.key==='W') keys.w=true; if(e.key==='s'||e.key==='S') keys.s=true; if(e.key==='a'||e.key==='A') keys.a=true; if(e.key==='d'||e.key==='D') keys.d=true; }
  function onMoveKeyUp(e){ if(e.key==='w'||e.key==='W') keys.w=false; if(e.key==='s'||e.key==='S') keys.s=false; if(e.key==='a'||e.key==='A') keys.a=false; if(e.key==='d'||e.key==='D') keys.d=false; }
  window.addEventListener('keydown', onMoveKeyDown);
  window.addEventListener('keyup', onMoveKeyUp);

  // F-key to pick up / center items
  function onKeyDown(e){ if(e.key==='f' || e.key==='F'){ // cast center ray
      const vw = canvas.width / (window.devicePixelRatio||1); const vh = canvas.height / (window.devicePixelRatio||1); const sx = vw/2, sy = vh/2; const ray = getRayFromScreen(sx,sy);
      // test pickables
      for(const obj of objects){ if(!obj.pickable || obj.picked) continue; const minX = obj.x - obj.w/2, maxX = obj.x + obj.w/2, minY = obj.y - obj.h/2, maxY = obj.y + obj.h/2, minZ = obj.z - obj.d/2, maxZ = obj.z + obj.d/2; const tmin = intersectAABB(cam, ray, minX, maxX, minY, maxY, minZ, maxZ); if(tmin!==null){ // pick
            obj.picked = true; obj.held = true; inventory[obj.name] = obj; message.textContent = `${obj.name} picked up`; // move to camera front
            obj.x = cam.x + ray.x * 0.9; obj.y = cam.y - 0.1; obj.z = cam.z + ray.z * 0.9;
            // update UI
            const invSword = invDiv.querySelector('#invSword'); const invShield = invDiv.querySelector('#invShield'); if(obj.name==='Sword') invSword.textContent = 'Sword: Acquired'; if(obj.name==='Shield') invShield.textContent = 'Shield: Acquired';
            break; } }
    } }
  window.addEventListener('keydown', onKeyDown);

  function getRayFromScreen(sx, sy){
    const vw = canvas.width / (window.devicePixelRatio||1); const vh = canvas.height / (window.devicePixelRatio||1);
    const focal = (vh/2) / Math.tan(fov/2);
    const x_cam = (sx - vw/2) / focal;
    const y_cam = -(sy - vh/2) / focal;
    // camera space ray (dir)
    let dir = { x: x_cam, y: y_cam, z: 1 };
    // rotate by camera pitch then yaw to world
    // pitch
    const cosy = Math.cos(cam.yaw), siny = Math.sin(cam.yaw);
    const cosp = Math.cos(cam.pitch), sinp = Math.sin(cam.pitch);
    // apply inverse of worldToCamera: rotate by yaw then pitch
    // first rotate around X by pitch
    let rx = dir.x;
    let ry = dir.y * cosp + dir.z * sinp;
    let rz = -dir.y * sinp + dir.z * cosp;
    // then rotate around Y by yaw
    const wx = rx * cosy + rz * siny;
    const wz = -rx * siny + rz * cosy;
    const final = { x: wx, y: ry, z: wz };
    // normalize
    const len = Math.hypot(final.x, final.y, final.z) || 1; final.x/=len; final.y/=len; final.z/=len;
    return final;
  }

  function handleClick(mx,my){ if(lock) return; const rect = canvas.getBoundingClientRect(); const sx = mx; const sy = my; const ray = getRayFromScreen(sx,sy);
    // First check chairs via ray-AABB intersection
    for(let ci=0; ci<chairs.length; ci++){
      const ch = chairs[ci];
      // bounding box covering seat and back
      const minX = Math.min(ch.seat.x - ch.seat.w/2, ch.back.x - ch.back.w/2);
      const maxX = Math.max(ch.seat.x + ch.seat.w/2, ch.back.x + ch.back.w/2);
      const minY = Math.min(ch.seat.y - ch.seat.h/2, ch.back.y - ch.back.h/2 - ch.back.h);
      const maxY = Math.max(ch.seat.y + ch.seat.h/2 + 0.1, ch.back.y + ch.back.h/2 + 0.1);
      const minZ = Math.min(ch.seat.z - ch.seat.d/2, ch.back.z - ch.back.d/2);
      const maxZ = Math.max(ch.seat.z + ch.seat.d/2, ch.back.z + ch.back.d/2);
      // ray-box intersection (param t for ray: origin cam, dir ray)
      const invDir = { x: 1/(ray.x||1e-6), y: 1/(ray.y||1e-6), z: 1/(ray.z||1e-6) };
      let t1 = (minX - cam.x) * invDir.x, t2 = (maxX - cam.x) * invDir.x;
      let tmin = Math.min(t1,t2), tmax = Math.max(t1,t2);
      t1 = (minY - cam.y) * invDir.y; t2 = (maxY - cam.y) * invDir.y; tmin = Math.max(tmin, Math.min(t1,t2)); tmax = Math.min(tmax, Math.max(t1,t2));
      t1 = (minZ - cam.z) * invDir.z; t2 = (maxZ - cam.z) * invDir.z; tmin = Math.max(tmin, Math.min(t1,t2)); tmax = Math.min(tmax, Math.max(t1,t2));
      if(tmax >= Math.max(0,tmin)){
        // hit chair
        // sit/stand toggle
        if(!isSitting){ prevCam = { ...cam }; // move camera to seat
          cam.x = ch.seat.x; cam.z = ch.seat.z + 0.6; cam.y = ch.seat.y + 0.4; cam.yaw = 0; cam.pitch = -0.05; isSitting=true; message.textContent='Seated'; }
        else { // stand up restore
          if(prevCam) { cam.x = prevCam.x; cam.y = prevCam.y; cam.z = prevCam.z; cam.yaw = prevCam.yaw; cam.pitch = prevCam.pitch; } isSitting=false; message.textContent='Standing'; }
        return;
      }
    }

    // intersect ray with floor plane y = tileGrid.y
    const t = (tileGrid.y - cam.y) / ray.y; if(t<=0) return; const ix = cam.x + ray.x * t; const iz = cam.z + ray.z * t;
    // find tile under ix,iz
    for(let i=0;i<tiles.length;i++){
      const T = tiles[i]; const half = T.size/2; if(ix >= T.x-half && ix <= T.x+half && iz >= T.z-half && iz <= T.z+half){ // clicked tile i
        if(matched.has(i) || revealed.has(i)) return; revealed.add(i); T.revealed = true; T.anim = 0.0; const rev = Array.from(revealed).filter(x=>!matched.has(x)); if(rev.length>=2){ lock=true; setTimeout(()=>{ const [a,b] = rev; if(tiles[a].id === tiles[b].id){ matched.add(a); matched.add(b); message.textContent = `Matched ${matched.size/2} / ${tiles.length/2}`; } else { tiles[a].revealed = false; tiles[b].revealed = false; } revealed.clear(); if(matched.size === tiles.length){ message.textContent='Room cleared — well done!'; confetti = 160; } lock=false; }, 520); } return; }
    }
  }

  // restart wiring
  restart.addEventListener('click', ()=>{ initBoard(); });
  sitBtn.addEventListener('click', ()=>{
    if(chairs.length===0) return; const ch = chairs[0]; if(!isSitting){ prevCam = { ...cam }; cam.x = ch.seat.x; cam.z = ch.seat.z + 0.6; cam.y = ch.seat.y + 0.4; cam.yaw = 0; cam.pitch = -0.05; isSitting = true; sitBtn.textContent='Stand'; message.textContent='Seated'; } else { if(prevCam){ cam.x = prevCam.x; cam.y = prevCam.y; cam.z = prevCam.z; cam.yaw = prevCam.yaw; cam.pitch = prevCam.pitch; } isSitting = false; sitBtn.textContent='Sit'; message.textContent='Standing'; }
  });

  // --- Touch controls overlay (mobile d-pad + pick button) ---
  const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  let touchOverlay = null;
  if(isTouchDevice){
    touchOverlay = document.createElement('div');
    touchOverlay.style.cssText = 'position:fixed;bottom:18px;left:0;right:0;display:flex;justify-content:space-between;align-items:flex-end;padding:0 18px;pointer-events:none;z-index:10000;';
    // d-pad container
    const dpad = document.createElement('div');
    dpad.style.cssText = 'display:grid;grid-template-columns:repeat(3,54px);grid-template-rows:repeat(3,54px);gap:4px;pointer-events:auto;';
    const dirs = [
      {label:'',key:null,col:1,row:1},{label:'W',key:'w',col:2,row:1},{label:'',key:null,col:3,row:1},
      {label:'A',key:'a',col:1,row:2},{label:'',key:null,col:2,row:2},{label:'D',key:'d',col:3,row:2},
      {label:'',key:null,col:1,row:3},{label:'S',key:'s',col:2,row:3},{label:'',key:null,col:3,row:3}
    ];
    dirs.forEach(d => {
      const btn = document.createElement('button');
      btn.style.cssText = 'width:54px;height:54px;border-radius:12px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.08);color:#e6f9ff;font-size:1.1rem;font-weight:700;touch-action:none;-webkit-user-select:none;user-select:none;';
      btn.style.gridColumn = d.col; btn.style.gridRow = d.row;
      btn.textContent = d.label;
      if(!d.key){ btn.style.visibility = 'hidden'; }
      else {
        btn.setAttribute('aria-label', 'Move ' + d.label);
        const activate = (e) => { e.preventDefault(); keys[d.key] = true; };
        const deactivate = (e) => { e.preventDefault(); keys[d.key] = false; };
        btn.addEventListener('pointerdown', activate);
        btn.addEventListener('pointerup', deactivate);
        btn.addEventListener('pointerleave', deactivate);
        btn.addEventListener('pointercancel', deactivate);
      }
      dpad.appendChild(btn);
    });
    touchOverlay.appendChild(dpad);

    // Pick button (right side)
    const pickBtn = document.createElement('button');
    pickBtn.textContent = 'Pick (F)';
    pickBtn.setAttribute('aria-label', 'Pick up or interact');
    pickBtn.style.cssText = 'pointer-events:auto;width:80px;height:80px;border-radius:50%;border:1px solid rgba(255,255,255,0.15);background:rgba(100,200,255,0.15);color:#e6f9ff;font-size:1rem;font-weight:700;touch-action:none;-webkit-user-select:none;user-select:none;';
    pickBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      // Cast center ray (same as F-key handler)
      const vw = canvas.width / (window.devicePixelRatio||1);
      const vh = canvas.height / (window.devicePixelRatio||1);
      const sx = vw/2, sy = vh/2;
      const ray = getRayFromScreen(sx, sy);
      // Test pickables (same logic as F-key onKeyDown)
      for(const obj of objects){
        if(!obj.pickable || obj.picked) continue;
        const tmin = intersectAABB(cam, ray, obj.x-obj.w/2, obj.x+obj.w/2, obj.y-obj.h/2, obj.y+obj.h/2, obj.z-obj.d/2, obj.z+obj.d/2);
        if(tmin !== null){
          obj.picked = true; obj.held = true; inventory[obj.name] = obj;
          message.textContent = `${obj.name} picked up`;
          obj.x = cam.x + ray.x * 0.9; obj.y = cam.y - 0.1; obj.z = cam.z + ray.z * 0.9;
          const invSword = invDiv.querySelector('#invSword'); const invShield = invDiv.querySelector('#invShield');
          if(obj.name==='Sword') invSword.textContent = 'Sword: Acquired';
          if(obj.name==='Shield') invShield.textContent = 'Shield: Acquired';
          break;
        }
      }
    });
    touchOverlay.appendChild(pickBtn);
    wrap.appendChild(touchOverlay);
  }

  initBoard();
  last = performance.now();
  raf = requestAnimationFrame(loop);

  function destroy(){ cancelAnimationFrame(raf); window.removeEventListener('resize', resize); document.removeEventListener('pointerlockchange', onPointerLockChange); document.removeEventListener('pointerlockerror', onPointerLockError); canvas.removeEventListener('pointerdown', onPointerDown); canvas.removeEventListener('pointerup', onPointerUp); canvas.removeEventListener('pointermove', onPointerMove); canvas.removeEventListener('pointermove', onHoverMove); window.removeEventListener('keydown', onMoveKeyDown); window.removeEventListener('keyup', onMoveKeyUp); window.removeEventListener('keydown', onKeyDown); if(touchOverlay) try{ touchOverlay.remove(); }catch(e){} try{ wrap.remove(); }catch(e){} }
  // status chip
  const chip=document.createElement('div'); chip.className='status-chip'; chip.innerHTML='<strong>Room:</strong> Mahjong memory (3D)'; statusBar.appendChild(chip);
  return { destroy };
}
