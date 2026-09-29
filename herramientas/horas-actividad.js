// Estimación de horas por actividad (cursos y diplomados): lectura a 130 ppm + tiempo por interacción.
const fs=require('fs'),path=require('path');global.window={};const dir=path.join(__dirname,'../plataforma/cursos');
for(const f of fs.readdirSync(dir).filter(f=>/\.js$/.test(f)&&f!=='rutas.js'))eval(fs.readFileSync(path.join(dir,f),'utf8'));
function est(c){let min=0;const B=c.modulos.flatMap(m=>m.lecciones).flatMap(l=>l.bloques);
 const w=JSON.stringify(c.modulos).replace(/"(tipo|texto|rotulo|titulo|p|ops|explica|frase|es|en|resp|items|pares|filas|encabezados|pregunta|ayuda|nota|correcta|mal|bien|malTitulo|bienTitulo|datos|retos|celda|formula|esperado|requiere|pista|pasos|frases|voz|preguntas)":/g,' ').replace(/<[^>]+>/g,' ').split(/\s+/).filter(Boolean).length;
 min+=w/130;
 for(const b of B){const n=(b.preguntas||[]).length;
  if(b.tipo==='reflexion')min+=10; if(b.tipo==='plantilla')min+=4; if(b.tipo==='practica')min+=1.5*n;
  if(b.retos)min+=4*b.retos.length; if(b.tipo==='completar')min+=1*(b.items||[]).length;
  if(b.tipo==='relacionar')min+=0.8*(b.pares||[]).length; if(b.tipo==='ordenar')min+=2;
  if(b.tipo==='tarjetas')min+=0.6*(b.items||b.tarjetas||[]).length; if(b.tipo==='pronunciar')min+=1.5*(b.frases||[]).length;
  if(b.tipo==='comparar')min+=1.5;}
 min+=c.modulos.reduce((a,m)=>a+((m.quiz||{}).preguntas||[]).length*1.5,0);
 return min/60;}
module.exports=est;
if(require.main===module){const rows=window.CURSOS_MARA.map(c=>({id:c.id,tipo:c.tipo||'',h:c.horas,e:est(c),precio:c.precio}));
 rows.forEach(r=>r.ratio=r.e/r.h);rows.sort((a,b)=>a.ratio-b.ratio);
 for(const r of rows)console.log(r.id.padEnd(34),String(r.h).padStart(3),'h  est',r.e.toFixed(1).padStart(5),' ratio',r.ratio.toFixed(2),' $'+r.precio);}
