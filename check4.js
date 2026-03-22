const fs=require('fs');
let html='';
try { html=fs.readFileSync('login.html','utf8'); } catch(e) { console.log('login.html not found at root, searching...'); 
  const glob=require('child_process').execSync('dir /s /b login.html', {encoding:'utf8'}).trim();
  console.log('Found:', glob);
  if(glob) html=fs.readFileSync(glob.split('\n')[0].trim(),'utf8');
}
if(!html){console.log('No login.html found'); process.exit(0);}
const authLink=[...html.matchAll(/href=['"]([^'"]*auth[^'"]*)['"]/g)].map(function(m){return m[1]});
console.log('Auth links found:', authLink.length ? authLink.join(', ') : 'NONE');
const hasAAD=authLink.some(function(l){return l.includes('/aad')});
console.log('Links to Entra ID (aad):', hasAAD ? 'YES' : 'NO');
const hasRedirect=authLink.some(function(l){return l.includes('post_login_redirect_uri')});
console.log('Has post-login redirect:', hasRedirect ? 'YES' : 'NO');
