const fs=require('fs');
const js=fs.readFileSync('Projects/games/taskrunner/game.js','utf8');
const taskIds=[...js.matchAll(/id:\s*'([^']+)'/g)].map(function(m){return m[1]});
const handlers=[...js.matchAll(/tasks\.(\w+)\s*=/g)].map(function(m){return m[1]});
console.log('Task IDs in TASKS array:', taskIds.join(', '));
console.log('Task handler keys:', handlers.join(', '));
taskIds.forEach(function(id){
  const base=id.replace(/2$/,'');
  if(!handlers.includes(base)){console.log('WARNING: No handler for task ID: '+id+' (base: '+base+')');}
});
console.log('Handler check complete');
