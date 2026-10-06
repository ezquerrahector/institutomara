const fs=require('fs'),path=require('path');const n=process.argv[2];
const L=JSON.parse(fs.readFileSync(path.join(__dirname,n+'.json')));const S=JSON.parse(fs.readFileSync(path.join(__dirname,n+'.salida.json')));
const m=new Map(S.map(x=>[x.k,x]));const err=[];
for(const q of L){const s=m.get(q.k);if(!s){err.push('falta '+q.k);continue;}
 if(!Array.isArray(s.nuevas)||s.nuevas.length!==2)err.push('nuevas!=2 '+q.k);
 const all=[...q.ops,...(s.nuevas||[])].map(x=>String(x).trim().toLowerCase());if(new Set(all).size!==all.length)err.push('duplicada '+q.k);
 if(!s.explica||s.explica.length<20)err.push('explica corta '+q.k);
 for(const t of [...(s.nuevas||[]),s.explica||'',s.p||''])if(/"/.test(t))err.push('comilla recta '+q.k);}
if(S.length!==L.length)err.push(`cantidad ${S.length} vs ${L.length}`);
console.log(err.length?err.slice(0,30).join('\n')+`\n${err.length} errores`:'OK '+L.length);
