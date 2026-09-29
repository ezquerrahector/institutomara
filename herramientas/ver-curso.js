// Uso: node herramientas/ver-curso.js <id> [regex] [largo]  → imprime módulo lección bloque | JSON
global.window={CURSOS_MARA:[]};const fs=require('fs'),path=require('path');const d=path.join(__dirname,'../plataforma/cursos/');
for(const f of fs.readdirSync(d).filter(f=>f.endsWith('.js')&&f!=='rutas.js'))eval(fs.readFileSync(d+f,'utf8'));
const [id,pat='.',largo='4000']=process.argv.slice(2);const c=window.CURSOS_MARA.find(x=>x.id==id);
console.log(c.nombre,'·',c.horas,'h · $'+c.precio,'·',c.nivel||'');console.log(c.desc);
c.modulos.forEach((m,mi)=>{console.log('\n## ['+mi+'] '+m.id+' '+m.titulo);m.lecciones.forEach((l,li)=>{console.log('\n### '+l.id+' — '+l.titulo);l.bloques.forEach((b,bi)=>{const s=JSON.stringify(b);if(new RegExp(pat,'i').test(s))console.log(mi,li,bi,s.slice(0,+largo))})});if(m.quiz)console.log('quiz:',JSON.stringify(m.quiz).slice(0,+largo))});
