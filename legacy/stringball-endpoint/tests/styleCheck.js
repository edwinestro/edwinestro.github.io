#!/usr/bin/env node
/**
 * Simple style presence test for index.html
 * Checks that critical selectors & properties exist in the embedded <style> tag.
 * This does NOT fully compute CSS; it validates authoring integrity.
 */
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname,'..','index.html');
if(!fs.existsSync(file)) { console.error('index.html not found'); process.exit(1); }
const html = fs.readFileSync(file,'utf8');
// extract the first <style>...</style>
const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
if(!styleMatch){ console.error('No <style> block found'); process.exit(1); }
const css = styleMatch[1];

const tests = [
  { name: '.lang-switch fixed position', re: /\.lang-switch\s*{[^}]*position:fixed/i },
  { name: '.wa-nudge transition', re: /\.wa-nudge\s*{[^}]*transition:[^;]+var\(--transition\)/i },
  { name: '.games-cta h2 gradient text', re: /\.games-cta h2\s*{[^}]*background:linear-gradient\(/i },
  { name: '.games-cta-btn hover transform', re: /\.games-cta-btn:hover{[^}]*transform:translateY\(-3px\)/i },
  { name: 'floatPulse keyframes', re: /@keyframes\s+floatPulse/i },
  { name: 'btnFloat keyframes', re: /@keyframes\s+btnFloat/i },
  { name: 'ctaGlow keyframes', re: /@keyframes\s+ctaGlow/i },
  { name: 'role-tile active conic gradient border', re: /\.role-tile::after{[^}]*conic-gradient/i },
  { name: 'details-shell background radial', re: /\.details-shell::before{[^}]*radial-gradient/i },
  { name: 'education-shell before radial', re: /\.education-shell::before{[^}]*radial-gradient/i },
  { name: 'subscribe-modal transition', re: /\.subscribe-modal\s*{[^}]*transition:[^;]+var\(--transition\)/i },
  { name: 'scroll-progress fixed', re: /\.scroll-progress\s*{[^}]*position:fixed/i }
];

let pass = 0; const failures = [];
for(const t of tests){
  if(t.re.test(css)) pass++; else failures.push(t.name);
}

console.log(`Style checks passed: ${pass}/${tests.length}`);
if(failures.length){
  console.log('Missing / failing rules:');
  failures.forEach(f=>console.log(' - '+f));
  process.exit(2);
} else {
  console.log('All style presence tests passed.');
}
