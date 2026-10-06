// Extrae las preguntas de 2 opciones a lotes JSON para agregar distractores.
global.window={};const fs=require('fs'),path=require('path');
const dir=path.join(__dirname,'..','..','plataforma','cursos');
for(const f of fs.readdirSync(dir)){ if(f==='rutas.js')continue; eval(fs.readFileSync(path.join(dir,f),'utf8')); }
const items=[];
for(const c of window.CURSOS_MARA){ c.modulos.forEach((m,mi)=>{
  (m.lecciones||[]).forEach((l,li)=>(l.bloques||[]).forEach((b,bi)=>(b.preguntas||[]).forEach((q,qi)=>{
    if(q.ops&&q.ops.length===2) items.push({k:[c.id,mi,'l',li,bi,qi].join('|'),curso:c.nombre,leccion:l.titulo,p:q.p,ops:q.ops,correcta:q.correcta,explica:q.explica||''}); })));
  if(m.quiz) (m.quiz.preguntas||[]).forEach((q,qi)=>{ if(q.ops&&q.ops.length===2) items.push({k:[c.id,mi,'q',qi].join('|'),curso:c.nombre,leccion:m.quiz.titulo,p:q.p,ops:q.ops,correcta:q.correcta,explica:q.explica||''}); });
});}
const N=4, tam=Math.ceil(items.length/N);
for(let i=0;i<N;i++) fs.writeFileSync(path.join(__dirname,`lote${i+1}.json`),JSON.stringify(items.slice(i*tam,(i+1)*tam),null,1));
console.log(items.length,'preguntas en',N,'lotes de',tam);
