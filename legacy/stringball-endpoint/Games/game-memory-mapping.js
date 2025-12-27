export function createMemoryMappingGame({ mount, statusBar, controls, message }){
  const state={ pattern:[], userIdx:0, level:0, size:9, reveal:1000, gap:350, active:false, assist:false, playing:false, lang:'en' };
  const palette=[ '#ff4d5d','#14c979','#3c6dff','#ffd749','#b16dff','#ff9949','#4dd4ff','#ff7fb3','#7eff9a' ];
  const texts={
    en:{observe:'Watch the board glow sequence',repeat:'Repeat the order by clicking colors',good:'Correct ✔',again:'We will replay',level:'Level',remain:'Remain',assistOn:'ASSIST ON',assistOff:'ASSIST OFF',start:'START'},
    es:{observe:'Observa la secuencia de brillos',repeat:'Repite el orden pulsando los colores',good:'Correcto ✔',again:'Repetimos de nuevo',level:'Nivel',remain:'Faltan',assistOn:'ASISTE ON',assistOff:'ASISTE OFF',start:'INICIAR'}
  };
  function T(k){return texts[state.lang][k];}
  const board=document.createElement('div'); board.className='board memory-mapping'; board.style.position='relative'; board.style.setProperty('--mm-bg','#10141f'); mount.appendChild(board);
  const glow=document.createElement('div'); glow.style.cssText='position:absolute;inset:0;border-radius:20px;pointer-events:none;transition:.35s;mix-blend-mode:plus-lighter;filter:blur(35px) saturate(140%);opacity:0;'; board.appendChild(glow);
  const grid=document.createElement('div'); grid.style.cssText='position:relative;display:grid;grid-template-columns:repeat(3,100px);gap:12px;z-index:2;padding:10px;'; board.appendChild(grid);
  const cells=[]; for(let i=0;i<state.size;i++){ const btn=document.createElement('button'); btn.className='tile'; btn.style.background=`linear-gradient(140deg, ${palette[i]}, #0b0f18 80%)`; btn.dataset.index=i; btn.addEventListener('click',()=> select(i,btn)); grid.appendChild(btn); cells.push(btn); }
  const startBtn=button(T('start'),'start',start); controls.appendChild(startBtn);
  const assistBtn=button(texts.en.assistOff,'',()=>{ state.assist=!state.assist; assistBtn.textContent= state.assist?T('assistOn'):T('assistOff'); }); controls.appendChild(assistBtn);
  const langBtn=button('ES','',()=>{ state.lang= state.lang==='en'?'es':'en'; langBtn.textContent= state.lang==='en'?'ES':'EN'; refreshStatic(); }); controls.appendChild(langBtn);
  statusBar.appendChild(chip(`<strong>${T('level')}:</strong><span id="mmLevel">0</span>`));
  statusBar.appendChild(chip(`<strong>${T('remain')}:</strong><span id="mmRemain">0</span>`));

  function refreshStatic(){ startBtn.textContent=T('start'); assistBtn.textContent= state.assist?T('assistOn'):T('assistOff'); // update label headings
    const chips=statusBar.querySelectorAll('.status-chip'); if(chips[0]) chips[0].querySelector('strong').firstChild.textContent=`${T('level')}:`; if(chips[1]) chips[1].querySelector('strong').firstChild.textContent=`${T('remain')}:`; message.textContent=''; }

  function start(){ state.pattern=[]; state.level=0; next(); }
  function next(){ state.level++; qs('#mmLevel').textContent=state.level; let idx; do{ idx=Math.floor(Math.random()*state.size);} while(state.pattern[state.pattern.length-1]===idx); state.pattern.push(idx); state.userIdx=0; qs('#mmRemain').textContent=state.pattern.length; playSequence(); }

  function playSequence(){ state.active=false; state.playing=true; message.textContent=T('observe'); let i=0; function step(){ if(i>=state.pattern.length){ state.playing=false; state.active=true; glow.style.opacity=0; message.textContent=T('repeat'); return;} const index=state.pattern[i]; const color=palette[index]; glow.style.background=`radial-gradient(circle at 50% 50%, ${hexToRgba(color,0.55)}, transparent 65%)`; glow.style.opacity=1; setTimeout(()=>{ glow.style.opacity=0; }, state.reveal*0.6); i++; setTimeout(step, state.reveal+state.gap); } step(); }

  function select(i,cell){ if(!state.active) return; const expected=state.pattern[state.userIdx]; if(i===expected){ cell.classList.add('correct'); setTimeout(()=> cell.classList.remove('correct'),450); state.userIdx++; qs('#mmRemain').textContent=state.pattern.length - state.userIdx; if(state.userIdx===state.pattern.length){ message.textContent=T('good'); state.active=false; setTimeout(next,700);} } else { cell.classList.add('wrong'); setTimeout(()=> cell.classList.remove('wrong'),500); message.textContent=T('again'); state.active=false; setTimeout(()=> { if(state.assist){ state.userIdx=0; playSequence(); } else start(); }, 900); } }

  function qs(sel){ return mount.ownerDocument.querySelector(sel); }
  function button(label,cls,fn){ const b=document.createElement('button'); b.textContent=label; b.className=cls; b.addEventListener('click',fn); return b; }
  /* eslint-disable no-restricted-syntax */
function chip(html){ const d=document.createElement('div'); d.className='status-chip'; d.innerHTML=html; return d; }
  function hexToRgba(hex,a){ const h=hex.replace('#',''); const bigint=parseInt(h,16); const r=(bigint>>16)&255; const g=(bigint>>8)&255; const b=bigint&255; return `rgba(${r},${g},${b},${a})`; }
  return { destroy(){ while(mount.firstChild) mount.removeChild(mount.firstChild); } };
}
