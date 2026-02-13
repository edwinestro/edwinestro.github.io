export function createAlzJaimeGame({ mount, statusBar, controls, message }){
  // Gentle simultaneous triple pattern game
  const state={ pattern:[], cleared:0, level:0, active:false, hint:true, pool:12, lang:'en' };
  const board=document.createElement('div'); board.className='board alz-jaime'; mount.appendChild(board);
  const tiles=[]; for(let i=0;i<state.pool;i++){ const t=document.createElement('button'); t.className='tile'; t.dataset.index=i; t.setAttribute('aria-label', 'Tile ' + (i+1)); t.style.background=`linear-gradient(140deg, hsl(${(i*37)%360} 70% 55%), #10141f 80%)`; t.addEventListener('click',()=> select(i,t)); board.appendChild(t); tiles.push(t);} 
  const startBtn=btn('START','start',start); controls.appendChild(startBtn);
  const hintBtn=btn('HINT ON','',()=>{ state.hint=!state.hint; hintBtn.textContent= state.hint?'HINT ON':'HINT OFF'; renderHint(); }); controls.appendChild(hintBtn);
  const langBtn=btn('ES','',()=>{ state.lang = state.lang==='en' ? 'es':'en'; langBtn.textContent = state.lang==='en'?'ES':'EN'; syncTexts(); }); controls.appendChild(langBtn);
  const levelChip = chip('<strong>Stage:</strong><span>0</span>'); statusBar.appendChild(levelChip);
  const progChip = chip('<strong>Progress:</strong><span>0/3</span>'); statusBar.appendChild(progChip);
  const levelSpan = levelChip.querySelector('span');
  const progSpan = progChip.querySelector('span');
  const hintBox=document.createElement('div'); hintBox.style.cssText='font-size:.6rem;letter-spacing:.6px;min-height:30px;opacity:.85;margin-bottom:4px;line-height:1.4;'; board.parentElement.insertBefore(hintBox, board);

  const text = {
    en:{ observe:'Watch the 3 tiles lighting up', yourTurn:'Tap the 3 lit tiles (any order)', good:'Great ✔', retry:'Try again calmly', hint:'Hint', start:'START' },
    es:{ observe:'Observa las 3 fichas encendidas', yourTurn:'Toca las 3 fichas encendidas (cualquier orden)', good:'Muy bien ✔', retry:'Intenta de nuevo con calma', hint:'Pista', start:'INICIAR' }
  };
  function syncTexts(){ startBtn.textContent=text[state.lang].start; renderHint(); if(!state.active) message.textContent=''; }

  function start(){ state.level=0; next(); }
  function next(){ state.level++; levelSpan.textContent=state.level; newPattern(); state.cleared=0; progSpan.textContent='0/3'; lightPattern(); state.active=true; message.textContent=text[state.lang].yourTurn; renderHint(); }
  function newPattern(){ const set=new Set(); while(set.size<3){ set.add(Math.floor(Math.random()*state.pool)); } state.pattern=[...set]; }
  function lightPattern(){ state.pattern.forEach(idx=> tiles[idx].classList.add('active')); }
  function select(i,t){ if(!state.active) return; if(state.pattern.includes(i) && t.classList.contains('active')){ t.classList.remove('active'); t.classList.add('correct'); setTimeout(()=> t.classList.remove('correct'),480); state.cleared++; progSpan.textContent=`${state.cleared}/3`; if(state.cleared===3){ state.active=false; message.textContent=text[state.lang].good; setTimeout(next,1000); } } else { t.classList.add('wrong'); setTimeout(()=> t.classList.remove('wrong'),520); message.textContent=text[state.lang].retry; // relight any that were cleared? keep remaining as-is; gentle approach
    // re-light remaining pattern tiles to reduce frustration
    state.pattern.forEach(idx=>{ if(tiles[idx].classList.contains('active')) tiles[idx].classList.add('active'); }); }
  }
  function renderHint(){ hintBox.textContent = state.hint ? `${text[state.lang].hint}: ` + state.pattern.map(p=>p+1).join(' • ') : ''; }
  /* eslint-disable no-restricted-syntax */
function btn(label,cls,fn){ const b=document.createElement('button'); b.textContent=label; b.className=cls; b.addEventListener('click',fn); return b;} function chip(html){ const d=document.createElement('div'); d.className='status-chip'; d.innerHTML=html; return d; }
  syncTexts();
  return { destroy(){ while(mount.firstChild) mount.removeChild(mount.firstChild); hintBox.remove(); } };
}
