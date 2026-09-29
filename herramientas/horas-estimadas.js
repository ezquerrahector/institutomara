// Estima horas reales de un diplomado con el modelo ajustado a los diplomados ya calibrados
// (≈17 min por reflexión escrita, ≈4.5 min por pregunta, ≈7 min por reto de Excel).
const fs=require('fs'),path=require('path');global.window={};const dir=path.join(__dirname,'../plataforma/cursos');
for(const f of fs.readdirSync(dir).filter(f=>/\.js$/.test(f)&&f!=='rutas.js'))eval(fs.readFileSync(path.join(dir,f),'utf8'));
for(const id of process.argv.slice(2)){const c=window.CURSOS_MARA.find(x=>x.id===id);const B=c.modulos.flatMap(m=>m.lecciones).flatMap(l=>l.bloques);
let r=0,p=0,pl=0,x=0;B.forEach(b=>{if(b.tipo==='reflexion')r++;if(b.tipo==='plantilla')pl++;if(b.preguntas)p+=b.preguntas.length;if(b.retos)x+=b.retos.length});
p+=c.modulos.reduce((a,m)=>a+((m.quiz||{}).preguntas||[]).length,0);const w=JSON.stringify(c.modulos).replace(/<[^>]+>/g,' ').split(/\s+/).length/1000;
const h=-0.028*w+0.291*r+0.074*p-0.06*pl+0.115*x;console.log(`${id}: declaradas ${c.horas} h · estimadas ${h.toFixed(1)} h (reflexiones ${r}, preguntas ${p}, retos ${x}, palabras ${Math.round(w*1000)})`);}
