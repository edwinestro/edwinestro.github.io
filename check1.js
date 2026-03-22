const fs=require('fs');
const js=fs.readFileSync('Projects/games/taskrunner/game.js','utf8');
const html=fs.readFileSync('Projects/games/taskrunner/index.html','utf8');
const idRefs=[...js.matchAll(/\$\(['"]([^'"]+)['"]\)/g)].map(function(m){return m[1]});
const unique=[...new Set(idRefs)];
const htmlIds=[...html.matchAll(/id=['"]([^'"]+)['"]/g)].map(function(m){return m[1]});
let missing=0;
unique.forEach(function(id){
  const found=htmlIds.includes(id);
  if(!found){console.log('MISSING ID in HTML: '+id); missing++;}
});
if(missing===0) console.log('All '+unique.length+' DOM IDs found in HTML');
else console.log(missing+' IDs MISSING out of '+unique.length);
