// Aplica los distractores: 4 opciones con orden mezclado de forma determinista, explicación y revisión de contenido.
const fs=require('fs'),path=require('path');const {editar}=require('../editar-curso');
const sal=[];for(const n of [1,2,3,4])sal.push(...JSON.parse(fs.readFileSync(path.join(__dirname,`lote${n}.salida.json`))));
const porCurso={};for(const s of sal){(porCurso[s.k.split('|')[0]]=porCurso[s.k.split('|')[0]]||[]).push(s);}
const h=s=>{let x=2166136261;for(const ch of s){x^=ch.charCodeAt(0);x=Math.imul(x,16777619)>>>0;}return x;};
let n=0;const pos=[0,0,0,0];
for(const [id,lista] of Object.entries(porCurso)) editar(id,c=>{
 for(const s of lista){const [,mi,t,a,b,qi]=s.k.split('|');
  const q=t==='l'?c.modulos[+mi].lecciones[+a].bloques[+b].preguntas[+qi]:c.modulos[+mi].quiz.preguntas[+a];
  if(q.ops.length!==2)throw new Error('ya cambiada '+s.k);
  const correcta=q.ops[q.correcta];const ops=[...q.ops,...s.nuevas];
  // orden determinista: la correcta cae en la posición h(k)%4
  const otras=ops.filter(o=>o!==correcta);const p=h(s.k)%4;let r=h(s.k+'x');
  for(let i=otras.length-1;i>0;i--){const j=r%(i+1);r=Math.floor(r/7)+i;[otras[i],otras[j]]=[otras[j],otras[i]];}
  otras.splice(p,0,correcta);q.ops=otras;q.correcta=p;pos[p]++;
  q.explica=s.explica;if(s.p)q.p=s.p;n++;}
 c.revisionContenido=20261006;});
console.log(n,'preguntas ampliadas; posiciones correctas',pos.join('/'));
