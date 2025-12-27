export function createMemorySequenceGame({ mount, statusBar, controls, message }){
  const state = { pattern: [], userIdx: 0, level: 0, speed: 1, strict:false, colors:['r','g','b','y'], animating:false, active:false };
  const board = document.createElement('div'); board.className='board memory-sequence'; mount.appendChild(board);
  const tiles = state.colors.map(c=>{ const t=document.createElement('button'); t.className='tile'; t.dataset.color=c; t.setAttribute('aria-label', c); board.appendChild(t); t.addEventListener('click',()=> handleUser(c,t)); return t; });
  const startBtn = btn('START','start',start); controls.appendChild(startBtn);
  const strictBtn = btn('STRICT OFF','',()=>{ state.strict=!state.strict; strictBtn.textContent = state.strict?'STRICT ON':'STRICT OFF'; }); controls.appendChild(strictBtn);
  const speedBtn = btn('SPEED x1','',()=>{ state.speed = state.speed===1?1.5: state.speed===1.5?2:1; speedBtn.textContent='SPEED x'+state.speed; }); controls.appendChild(speedBtn);
  const levelChip = chip('<strong>Level:</strong><span id="msLevel">0</span>'); statusBar.appendChild(levelChip);
  const progChip = chip('<strong>Progress:</strong><span id="msProg">0/0</span>'); statusBar.appendChild(progChip);
  function start(){ state.pattern=[]; state.level=0; next(); }
  function next(){ state.level++; qs('#msLevel').textContent=state.level; state.pattern.push(rand()); state.userIdx=0; qs('#msProg').textContent=`0/${state.pattern.length}`; play(); }
  function rand(){ return state.colors[Math.floor(Math.random()*state.colors.length)]; }
  function play(){ state.active=false; state.animating=true; let i=0; const d=650/state.speed; message.textContent='Observe'; (function step(){ if(i>=state.pattern.length){ state.animating=false; state.active=true; message.textContent='Your turn'; return;} const col=state.pattern[i]; const tile=tiles.find(t=>t.dataset.color===col); flash(tile,d*0.55); i++; setTimeout(step,d); })(); }
  function flash(tile, dur){ tile.classList.add('active'); setTimeout(()=> tile.classList.remove('active'), dur); }
  function handleUser(color,tile){ if(!state.active||state.animating) return; flash(tile,250); const expected=state.pattern[state.userIdx]; if(color===expected){ state.userIdx++; qs('#msProg').textContent=`${state.userIdx}/${state.pattern.length}`; if(state.userIdx===state.pattern.length){ message.textContent='Correct'; setTimeout(next,700);} } else { message.textContent='Wrong'; tile.classList.add('wrong'); setTimeout(()=> tile.classList.remove('wrong'),600); if(state.strict){ setTimeout(start,900);} else { state.userIdx=0; setTimeout(play,900);} } }
  function qs(sel){ return mount.ownerDocument.querySelector(sel); }
  function btn(label, cls, fn){ const b=document.createElement('button'); b.textContent=label; b.className=cls?cls:''; b.addEventListener('click',fn); return b; }
  /* eslint-disable no-restricted-syntax */
function chip(html){ const d=document.createElement('div'); d.className='status-chip'; d.innerHTML=html; return d; }
  return { destroy(){ while(mount.firstChild) mount.removeChild(mount.firstChild); } };
}
