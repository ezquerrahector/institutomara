// Muestra títulos, objetivos y puntos clave de un diplomado (para redactar su ampliación).
const fs=require('fs'),path=require('path');global.window={};const dir=path.join(__dirname,'../plataforma/cursos');
for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.js')&&f!=='rutas.js'))eval(fs.readFileSync(path.join(dir,f),'utf8'));
const c=window.CURSOS_MARA.find(x=>x.id===process.argv[2]);console.log(c.nombre,'|',c.horas,'h |',c.desc);
c.modulos.forEach((m,i)=>{console.log(`\n## M${i+1} ${m.titulo} — ${m.resumen}`);m.lecciones.forEach((l,j)=>{const cl=l.bloques.find(b=>b.tipo==='clave');
console.log(`- L${j+1} ${l.titulo} | obj: ${l.objetivo}\n   clave: ${cl?(cl.items||[]).join(' / ').replace(/<[^>]+>/g,''):'-'}`)})});
