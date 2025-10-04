export function createUnsupervised3DGame({ mount, statusBar, controls, message }){
  const wrap = document.createElement('div'); wrap.style.cssText='display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap;';
  const canvas = document.createElement('canvas'); canvas.width=720; canvas.height=420; canvas.style.cssText='background:#06121a;border-radius:12px;flex:1;max-width:720px;min-width:320px;';
  wrap.appendChild(canvas);
  const ui = document.createElement('div'); ui.style.cssText='width:320px;display:flex;flex-direction:column;gap:10px;';
  const title = document.createElement('h3'); title.textContent='Unsupervised 3D — Memory Room'; ui.appendChild(title);
  const info = document.createElement('div'); info.style.cssText='font-size:.85rem;opacity:.9'; info.textContent='Single room 3D view with a Mahjong-like memory task. Match all pairs to clear the room.'; ui.appendChild(info);
  const boardMount = document.createElement('div'); boardMount.style.cssText='display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:8px;border-radius:10px;background:linear-gradient(180deg,#07131a,#081822);'; ui.appendChild(boardMount);
  const restart = document.createElement('button'); restart.className='btn'; restart.textContent='Restart'; restart.addEventListener('click', initBoard); ui.appendChild(restart);
  wrap.appendChild(ui);
  mount.appendChild(wrap);

  const ctx = canvas.getContext('2d');
  let raf=0; let confettiT=0;
  function resize(){ const scale=Math.min(window.devicePixelRatio||1,2); const w=canvas.clientWidth||720; const h=canvas.clientHeight||420; canvas.width=Math.round(w*scale); canvas.height=Math.round(h*scale); ctx.setTransform(scale,0,0,scale,0,0); }
  window.addEventListener('resize', resize);

  function renderRoom(t){ resize(); const w=canvas.width/(window.devicePixelRatio||1); const h=canvas.height/(window.devicePixelRatio||1); ctx.clearRect(0,0,w,h);
    const g=ctx.createLinearGradient(0,0,0,h*0.6); g.addColorStop(0,'#072633'); g.addColorStop(1,'#03121a'); ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
    // floor trapezoid
    const fg=ctx.createLinearGradient(0,h*0.5,0,h); fg.addColorStop(0,'#081722'); fg.addColorStop(1,'#030a10'); ctx.fillStyle=fg; ctx.beginPath(); ctx.moveTo(w*0.12,h*0.6); ctx.lineTo(w*0.88,h*0.6); ctx.lineTo(w*0.95,h); ctx.lineTo(w*0.05,h); ctx.closePath(); ctx.fill();
    // back wall
    ctx.fillStyle='rgba(18,34,44,0.95)'; ctx.fillRect(w*0.22,h*0.08,w*0.56,h*0.52);
    ctx.fillStyle='#9fe6ff'; ctx.font='14px system-ui'; ctx.textAlign='center'; ctx.fillText('Memory Room — clear the pairs', w/2, h*0.18);
    if(confettiT>0){ confettiT--; for(let i=0;i<12;i++){ ctx.fillStyle=`hsl(${(i*30+confettiT*7)%360} 80% 60%)`; ctx.fillRect(Math.random()*w, h*0.3+Math.random()*h*0.6, 6, 12); } }
  }

  // Tiles
  let tiles=[]; let revealed=new Set(); let matched=new Set(); let lock=false;
  function initBoard(){ tiles=[]; revealed.clear(); matched.clear(); lock=false; boardMount.innerHTML=''; const pairCount=8; const palette=['#f16262','#6db6ff','#ffd166','#8be28b','#d78bff','#7be0d6','#ff9fb7','#ffd8a8']; const pool=[]; for(let i=0;i<pairCount;i++){ pool.push({id:i,color:palette[i%palette.length]}); pool.push({id:i,color:palette[i%palette.length]}); }
    for(let i=pool.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [pool[i],pool[j]]=[pool[j],pool[i]]; }
    pool.forEach((p,idx)=>{ const b=document.createElement('button'); b.className='tile'; b.style.cssText='aspect-ratio:1/1;border-radius:8px;background:#07121a;border:1px solid rgba(255,255,255,.03);position:relative;overflow:hidden;'; const face=document.createElement('div'); face.style.cssText='position:absolute;inset:6px;border-radius:6px;display:flex;align-items:center;justify-content:center;opacity:0;transition:.18s'; face.innerHTML=`<div style="width:70%;height:70%;border-radius:6px;background:${p.color};box-shadow:0 6px 18px ${p.color}33"></div>`; b.appendChild(face); b.addEventListener('click',()=> onTileClick(idx,p,b)); tiles.push({data:p,el:b,face}); boardMount.appendChild(b); });
    message.textContent='Find the pairs';
  }
  function onTileClick(idx,p,btn){ if(lock) return; const t=tiles[idx]; if(matched.has(idx) || revealed.has(idx)) return; revealed.add(idx); t.face.style.opacity='1'; const rev=Array.from(revealed).filter(i=>!matched.has(i)); if(rev.length>=2){ lock=true; setTimeout(()=>{ const [a,b]=rev; if(tiles[a].data.id===tiles[b].data.id){ matched.add(a); matched.add(b); message.textContent=`Matched ${matched.size/2} / 8`; } else { tiles[a].face.style.opacity='0'; tiles[b].face.style.opacity='0'; } revealed.clear(); if(matched.size===tiles.length){ message.textContent='Room cleared — well done!'; confettiT=160; } lock=false; },520); } }

  function loop(t=0){ renderRoom(t); raf=requestAnimationFrame(loop); }
  initBoard(); loop();

  function destroy(){ cancelAnimationFrame(raf); window.removeEventListener('resize', resize); try{ wrap.remove(); }catch(e){} }
  // status chip
  const chip=document.createElement('div'); chip.className='status-chip'; chip.innerHTML='<strong>Room:</strong> Mahjong memory'; statusBar.appendChild(chip);
  return { destroy };
}
