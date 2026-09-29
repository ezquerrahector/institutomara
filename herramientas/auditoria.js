// Auditoría automática de todo el catálogo: estructura, respuestas, horas, rutas y sitio.
const fs=require('fs'),path=require('path');const R=path.join(__dirname,'..');
global.window={};const dir=path.join(R,'plataforma/cursos');
for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.js')&&f!=='rutas.js')){const n0=(window.CURSOS_MARA||[]).length;eval(fs.readFileSync(path.join(dir,f),'utf8'));(window.CURSOS_MARA||[]).slice(n0).forEach(c=>c._f=f);}
eval(fs.readFileSync(path.join(dir,'rutas.js'),'utf8'));
// cursos base definidos dentro de plataforma/index.html
const cursos=window.CURSOS_MARA;const P=[];const add=(c,m)=>P.push((c?c.id+': ':'')+m);
const INTER=['practica','completar','relacionar','ordenar','tarjetas','pronunciar','excel'];
const txt=x=>{const o=[];(function w(v,k){if(typeof v==='string'){if(!['id','tipo','color','url','audio','voz'].includes(k))o.push(v)}else if(Array.isArray(v))v.forEach(e=>w(e,k));else if(v&&typeof v==='object')for(const kk in v)w(v[kk],kk)})(x.modulos);return o.map(s=>s.replace(/<[^>]+>/g,' ')).join('\n')};
const ids=new Set();const lecIds=new Set();const textos={};
for(const c of cursos){
 if(ids.has(c.id))add(c,'id duplicado');ids.add(c.id);
 if(!c.nombre||!c.desc||!c.horas||!c.precio)add(c,'faltan datos básicos');
 if(c.proximamente)add(c,'marcado como próximamente');
 if(!c.modulos||!c.modulos.length){add(c,'sin módulos');continue}
 c.modulos.forEach((m,mi)=>{
  if(!m.lecciones||!m.lecciones.length)add(c,`M${mi+1} sin lecciones`);
  const q=(m.quiz||{}).preguntas||[];if(q.length<5)add(c,`M${mi+1} evaluación con ${q.length} preguntas`);
  q.forEach((p,i)=>{if(!(p.correcta>=0&&p.correcta<p.ops.length))add(c,`M${mi+1} quiz ${i+1} correcta fuera de rango`);if(new Set(p.ops).size!==p.ops.length)add(c,`M${mi+1} quiz ${i+1} opciones repetidas`)});
  (m.lecciones||[]).forEach(l=>{
   if(lecIds.has(l.id))add(c,'lección id duplicado '+l.id);lecIds.add(l.id);
   if(!l.bloques||l.bloques.length<3)add(c,`lección corta ${l.id} (${(l.bloques||[]).length} bloques)`);
   (l.bloques||[]).forEach((b,bi)=>{
    const where=`${l.id} b${bi} ${b.tipo}`;
    (b.preguntas||[]).forEach((p,i)=>{if(!p.ops||!(p.correcta>=0&&p.correcta<p.ops.length))add(c,where+' correcta fuera de rango');else if(new Set(p.ops).size!==p.ops.length)add(c,where+' opciones repetidas');if(!p.p)add(c,where+' pregunta vacía')});
    if(b.tipo==='completar')(b.items||[]).forEach(it=>{if((it.frase||'').split('___').length!==2)add(c,where+' completar sin un solo ___')});
    if(b.tipo==='relacionar'){const d=(b.pares||[]).map(p=>p.der||p[1]);if(new Set(d).size!==d.length)add(c,where+' relacionar con derechas repetidas')}
    if(b.tipo==='excel')(b.retos||[]).forEach((r,i)=>{if(!r.formula&&!r.modelo&&!r.respuesta)add(c,where+` reto ${i+1} sin fórmula modelo`)});
    if(['texto','destacado'].includes(b.tipo)&&!(b.texto||'').trim())add(c,where+' vacío');
    if(['texto','destacado'].includes(b.tipo)&&(b.texto||'').length>80){const k=b.texto;(textos[k]=textos[k]||[]).push(c.id+'/'+l.id)}
   });
  });
 });
 const t=txt(c);
 for(const [re,msg] of [[/lorem ipsum|TODO|PLACEHOLDER|pendiente de redactar|\(próximamente\)/,'texto provisional'],[/\bundefined\b|\bnull\b|NaN/,'valor undefined/null en texto']]){const mm=t.match(re);if(mm)add(c,msg+': «'+t.slice(Math.max(0,mm.index-40),mm.index+40).replace(/\n/g,' ')+'»')}
}
// textos repetidos entre cursos distintos
for(const [k,v] of Object.entries(textos)){const cs=new Set(v.map(x=>x.split('/')[0]));if(v.length>1)add(null,`texto repetido ${v.length} veces (${[...cs].join(', ')}): «${k.replace(/<[^>]+>/g,'').slice(0,60)}…»`)}
// rutas
{const vis=new Set();for(const r of window.RUTAS_MARA){if(vis.has(r.id))add(null,'ruta repetida '+r.id);vis.add(r.id)}}
for(const r of window.RUTAS_MARA){const cs=r.cursos.map(i=>cursos.find(c=>c.id===i));
 if(cs.some(x=>!x)){add(null,`ruta ${r.id}: curso inexistente ${r.cursos.filter((i,k)=>!cs[k])}`);continue}
 const suma=cs.reduce((a,c)=>a+c.precio,0),h=cs.reduce((a,c)=>a+c.horas,0);
 if(suma!==r.suma)add(null,`ruta ${r.id}: suma ${r.suma} ≠ ${suma}`);if(h!==r.horas)add(null,`ruta ${r.id}: horas ${r.horas} ≠ ${h}`);
 if(r.ahorro!==r.suma-r.precio)add(null,`ruta ${r.id}: ahorro ${r.ahorro} ≠ ${r.suma-r.precio}`);if(r.precio>=r.suma)add(null,`ruta ${r.id}: precio no es menor que la suma`)}
// sitio
const T=JSON.parse(fs.readFileSync(path.join(R,'sitio-web/temarios.json')));const html=fs.readFileSync(path.join(R,'sitio-web/index.html'),'utf8');
for(const c of cursos){const t=T[c.id];if(!t){add(c,'sin temario en el sitio');continue}
 if(t.h!==c.horas)add(c,`sitio temario h=${t.h} vs ${c.horas}`);if(t.p!==c.precio)add(c,`sitio temario p=${t.p} vs ${c.precio}`);
 const nl=c.modulos.reduce((a,m)=>a+m.lecciones.length,0);if(t.s&&t.s.lec!==nl)add(c,`sitio temario lecciones ${t.s.lec} vs ${nl}`);
 if(t.m&&t.m.length!==c.modulos.length)add(c,`sitio temario módulos ${t.m.length} vs ${c.modulos.length}`);
 const re=new RegExp('\\{"id":"'+c.id+'"[^{}]*?"h":(\\d+)','g');let m;while((m=re.exec(html)))if(+m[1]!==c.horas)add(c,`sitio index h=${m[1]} vs ${c.horas}`);}
for(const r of window.RUTAS_MARA){const m=html.match(new RegExp('\\{"id":"'+r.id+'"[^{}]*?"horas":(\\d+)'));if(m&&+m[1]!==r.horas)add(null,`sitio ruta ${r.id} horas ${m[1]} vs ${r.horas}`)}
console.log(`Cursos: ${cursos.length} (${cursos.filter(c=>/^d-|diplomado/.test(c.id)).length} diplomados) · Rutas: ${window.RUTAS_MARA.length} · Lecciones: ${lecIds.size}`);
console.log(P.length?P.join('\n'):'Sin problemas');
