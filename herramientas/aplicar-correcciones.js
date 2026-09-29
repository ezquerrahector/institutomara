const {editar}=require('./editar-curso');const L=require(process.argv[2]);let n=0;
for(const x of L)editar(x.id,c=>{const b=c.modulos[x.m].lecciones[x.l].bloques;const s=JSON.stringify(b[x.b]);
 if(s.split(x.buscar).length!==2)throw new Error('no único: '+x.id+' '+x.buscar);b[x.b]=JSON.parse(s.replace(x.buscar,()=>x.reemplazar));n++;});
console.log(n+' correcciones aplicadas');
