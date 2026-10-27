/* Instituto Mara — clasificación única de programas (26 oct 2026).
   Dos niveles (área → tema) + nivel de entrada. La usan el sitio (sitio-web/index.html) y el aula
   (catálogo y administración). La base (`cursos.area`, `cursos.tema`, `cursos.dificultad`) manda:
   si un programa trae esos datos del servidor, se usan; si no, se toma este mapa; si tampoco está aquí,
   se traduce su familia vieja (VIEJAS). Un área que no exista en AREAS aparece sola como área nueva.
   Para un programa nuevo: llena area/tema/dificultad en su meta.json (o en Administración → Cursos). */
(function(){
  var T = window.TAXO = {};
  T.AREAS = [
    { k:"Psicología y terapia", ico:"🧠", d:"Terapia, duelo, ansiedad, pareja", temas:["Terapia y clínica", "Duelo y crisis", "Salud emocional", "Pareja y relaciones", "Psicología social"] },
    { k:"Comunicación e influencia", ico:"🎤", d:"Oratoria, persuasión, negociación", temas:["Hablar en público", "Persuasión e influencia", "Negociación", "Lenguaje no verbal", "Habilidades sociales"] },
    { k:"Crecimiento personal", ico:"🌱", d:"Emociones, hábitos, imagen", temas:["Emociones y bienestar", "Hábitos y productividad", "Imagen y atracción"] },
    { k:"Liderazgo y RH", ico:"👥", d:"Liderazgo, nómina, NOM-035, calidad", temas:["Liderazgo", "Recursos humanos", "Normas y seguridad laboral", "Calidad y procesos", "Proyectos"] },
    { k:"Ventas y marketing", ico:"📈", d:"Ventas, redes, Canva, fotografía", temas:["Ventas y atención", "Marketing digital", "Diseño y fotografía"] },
    { k:"Tecnología e IA", ico:"🤖", d:"Excel, Power BI, Office, IA", temas:["Excel y Office", "Datos y Power BI", "Inteligencia artificial", "Ciberseguridad"] },
    { k:"IA para tu profesión", ico:"🧩", d:"IA aplicada a tu oficio", temas:["Oficina y negocios", "Ventas y marketing", "Salud y psicología", "Educación", "Industria y logística", "Profesiones y servicios"] },
    { k:"Idiomas", ico:"🌎", d:"Inglés A1 a B2 y 4 idiomas más", temas:["Inglés", "Inglés para el trabajo", "Inglés para niños", "Francés", "Portugués", "Italiano", "Alemán"] },
    { k:"Administración y finanzas", ico:"🗂️", d:"Contabilidad, administración, finanzas", temas:["Contabilidad y fiscal", "Administración", "Logística", "Finanzas personales"] },
    { k:"Criminología y forense", ico:"🔎", d:"Forense, perfilación, engaño", temas:["Forense", "Criminología", "Detección de engaño"] },
    { k:"Cuidado, infancia y educación", ico:"🤲", d:"Adulto mayor, niños, inclusión", temas:["Adulto mayor", "Infancia y adolescencia", "Educación inclusiva"] }
  ];
  T.NIVELES = { desde_cero:'Desde cero', intermedio:'Intermedio', profesional:'Para profesionales' };
  T.DURACION = [ ['corto','Menos de 10 h'], ['medio','10 a 20 h'], ['largo','30 h o más'] ];
  /* Áreas nuevas previstas (tanda 2): icono para cuando aparezcan */
  T.ICONOS = { 'Cocina y gastronomía':'🍳', 'Creatividad y contenido':'🎬', 'Salud y nutrición':'🥗', 'Oficios y técnica':'🛠️',
    'Hogar, familia y mascotas':'🏡', 'Dinero y derecho':'⚖️', 'Turismo y hospitalidad':'🏨' };
  /* Familias y áreas viejas → área nueva */
  T.VIEJAS = { 'Psicología y salud':'Psicología y terapia', 'Salud y bienestar':'Psicología y terapia', 'Desarrollo humano':'Crecimiento personal',
    'Negocios y oficina':'Administración y finanzas', 'Negocios y finanzas':'Administración y finanzas', 'Administración y oficina':'Administración y finanzas',
    'Administración y contabilidad':'Administración y finanzas', 'Recursos Humanos y empresa':'Liderazgo y RH', 'Liderazgo, RH y seguridad laboral':'Liderazgo y RH',
    'Tecnología':'Tecnología e IA', 'IA aplicada':'Tecnología e IA', 'IA por profesión':'IA para tu profesión' };
  /* id → [área, tema, nivel] */
  T.MAPA = {
    "d-tcc":["Psicología y terapia", "Terapia y clínica", "profesional"],
    "d-terapias-contextuales":["Psicología y terapia", "Terapia y clínica", "profesional"],
    "d-evaluacion-clinica":["Psicología y terapia", "Terapia y clínica", "profesional"],
    "d-tanatologia":["Psicología y terapia", "Duelo y crisis", "intermedio"],
    "c-pap":["Psicología y terapia", "Duelo y crisis", "desde_cero"],
    "c-ansiedad-depresion":["Psicología y terapia", "Salud emocional", "desde_cero"],
    "d-psicologia-pareja":["Psicología y terapia", "Pareja y relaciones", "desde_cero"],
    "d-psicologia-social":["Psicología y terapia", "Psicología social", "desde_cero"],
    "c-comunicacion":["Comunicación e influencia", "Hablar en público", "desde_cero"],
    "d-oratoria":["Comunicación e influencia", "Hablar en público", "desde_cero"],
    "d-storytelling":["Comunicación e influencia", "Hablar en público", "desde_cero"],
    "diplomado-persuasion-etica":["Comunicación e influencia", "Persuasión e influencia", "desde_cero"],
    "d-psicologia-influencia":["Comunicación e influencia", "Persuasión e influencia", "desde_cero"],
    "d-negociacion":["Comunicación e influencia", "Negociación", "desde_cero"],
    "d-conversaciones-dificiles":["Comunicación e influencia", "Negociación", "desde_cero"],
    "d-lenguaje-corporal":["Comunicación e influencia", "Lenguaje no verbal", "desde_cero"],
    "d-leer-personas":["Comunicación e influencia", "Lenguaje no verbal", "desde_cero"],
    "d-inteligencia-social":["Comunicación e influencia", "Habilidades sociales", "desde_cero"],
    "c-inteligencia-emocional":["Crecimiento personal", "Emociones y bienestar", "desde_cero"],
    "d-confianza-seguridad":["Crecimiento personal", "Emociones y bienestar", "desde_cero"],
    "diplomado-estoicismo-vida-moderna":["Crecimiento personal", "Emociones y bienestar", "desde_cero"],
    "c-productividad":["Crecimiento personal", "Hábitos y productividad", "desde_cero"],
    "c-neurociencia":["Crecimiento personal", "Hábitos y productividad", "desde_cero"],
    "d-imagen-personal":["Crecimiento personal", "Imagen y atracción", "desde_cero"],
    "d-seduccion-atraccion":["Crecimiento personal", "Imagen y atracción", "desde_cero"],
    "d-liderazgo":["Liderazgo y RH", "Liderazgo", "intermedio"],
    "d-recursos-humanos":["Liderazgo y RH", "Recursos humanos", "desde_cero"],
    "d-nom035":["Liderazgo y RH", "Normas y seguridad laboral", "desde_cero"],
    "d-seguridad-higiene":["Liderazgo y RH", "Normas y seguridad laboral", "desde_cero"],
    "d-calidad-lean":["Liderazgo y RH", "Calidad y procesos", "intermedio"],
    "d-proyectos":["Liderazgo y RH", "Proyectos", "intermedio"],
    "c-atencion-ventas":["Ventas y marketing", "Ventas y atención", "desde_cero"],
    "c-venta-en-linea":["Ventas y marketing", "Ventas y atención", "desde_cero"],
    "d-marketing-digital":["Ventas y marketing", "Marketing digital", "desde_cero"],
    "c-canva":["Ventas y marketing", "Diseño y fotografía", "desde_cero"],
    "c-fotografia-producto":["Ventas y marketing", "Diseño y fotografía", "desde_cero"],
    "c-office":["Tecnología e IA", "Excel y Office", "desde_cero"],
    "c-excel-avanzado":["Tecnología e IA", "Excel y Office", "intermedio"],
    "c-power-bi":["Tecnología e IA", "Datos y Power BI", "intermedio"],
    "d-datos-ia":["Tecnología e IA", "Datos y Power BI", "intermedio"],
    "c-ia":["Tecnología e IA", "Inteligencia artificial", "desde_cero"],
    "c-ciberseguridad":["Tecnología e IA", "Ciberseguridad", "desde_cero"],
    "c-ia-oficina":["IA para tu profesión", "Oficina y negocios", "desde_cero"],
    "c-ia-emprendedores":["IA para tu profesión", "Oficina y negocios", "desde_cero"],
    "c-ia-finanzas":["IA para tu profesión", "Oficina y negocios", "desde_cero"],
    "c-ia-rh":["IA para tu profesión", "Oficina y negocios", "desde_cero"],
    "c-ia-directivos":["IA para tu profesión", "Oficina y negocios", "desde_cero"],
    "c-ia-proyectos":["IA para tu profesión", "Oficina y negocios", "desde_cero"],
    "c-ia-automatizacion":["IA para tu profesión", "Oficina y negocios", "desde_cero"],
    "c-ia-freelance":["IA para tu profesión", "Oficina y negocios", "desde_cero"],
    "c-ia-ventas":["IA para tu profesión", "Ventas y marketing", "desde_cero"],
    "c-ia-marketing":["IA para tu profesión", "Ventas y marketing", "desde_cero"],
    "c-ia-atencion-cliente":["IA para tu profesión", "Ventas y marketing", "desde_cero"],
    "c-ia-ecommerce":["IA para tu profesión", "Ventas y marketing", "desde_cero"],
    "c-ia-callcenter":["IA para tu profesión", "Ventas y marketing", "desde_cero"],
    "c-ia-diseno":["IA para tu profesión", "Ventas y marketing", "desde_cero"],
    "c-ia-salud":["IA para tu profesión", "Salud y psicología", "desde_cero"],
    "c-ia-psicologos":["IA para tu profesión", "Salud y psicología", "desde_cero"],
    "c-ia-docentes":["IA para tu profesión", "Educación", "desde_cero"],
    "c-ia-estudiantes":["IA para tu profesión", "Educación", "desde_cero"],
    "c-ia-manufactura":["IA para tu profesión", "Industria y logística", "desde_cero"],
    "c-ia-compras":["IA para tu profesión", "Industria y logística", "desde_cero"],
    "c-ia-logistica":["IA para tu profesión", "Industria y logística", "desde_cero"],
    "c-ia-construccion":["IA para tu profesión", "Industria y logística", "desde_cero"],
    "c-ia-campo":["IA para tu profesión", "Industria y logística", "desde_cero"],
    "c-ia-contadores":["IA para tu profesión", "Profesiones y servicios", "desde_cero"],
    "c-ia-abogados":["IA para tu profesión", "Profesiones y servicios", "desde_cero"],
    "c-ia-inmobiliarias":["IA para tu profesión", "Profesiones y servicios", "desde_cero"],
    "c-ia-arquitectura":["IA para tu profesión", "Profesiones y servicios", "desde_cero"],
    "c-ia-programadores":["IA para tu profesión", "Profesiones y servicios", "desde_cero"],
    "c-ia-turismo":["IA para tu profesión", "Profesiones y servicios", "desde_cero"],
    "c-ingles":["Idiomas", "Inglés", "desde_cero"],
    "c-ingles-a2":["Idiomas", "Inglés", "intermedio"],
    "c-ingles-b1":["Idiomas", "Inglés", "intermedio"],
    "c-ingles-b2":["Idiomas", "Inglés", "intermedio"],
    "c-ingles-servicio":["Idiomas", "Inglés para el trabajo", "intermedio"],
    "c-ingles-kids":["Idiomas", "Inglés para niños", "desde_cero"],
    "c-frances-a1":["Idiomas", "Francés", "desde_cero"],
    "c-portugues-a1":["Idiomas", "Portugués", "desde_cero"],
    "c-italiano-a1":["Idiomas", "Italiano", "desde_cero"],
    "c-aleman-a1":["Idiomas", "Alemán", "desde_cero"],
    "d-contabilidad-resico":["Administración y finanzas", "Contabilidad y fiscal", "desde_cero"],
    "d-asistente-administrativo":["Administración y finanzas", "Administración", "desde_cero"],
    "c-logistica":["Administración y finanzas", "Logística", "desde_cero"],
    "c-finanzas-personales":["Administración y finanzas", "Finanzas personales", "desde_cero"],
    "d-psicologia-forense":["Criminología y forense", "Forense", "profesional"],
    "d-criminologia":["Criminología y forense", "Criminología", "intermedio"],
    "d-detectar-mentiras":["Criminología y forense", "Detección de engaño", "desde_cero"],
    "d-manipulacion":["Criminología y forense", "Detección de engaño", "desde_cero"],
    "d-adulto-mayor":["Cuidado, infancia y educación", "Adulto mayor", "desde_cero"],
    "d-infancia-adolescencia":["Cuidado, infancia y educación", "Infancia y adolescencia", "profesional"],
    "d-neurodiversidad":["Cuidado, infancia y educación", "Educación inclusiva", "profesional"]
  };
  /* Clasifica un programa: { area, tema, nivel }. «c» puede traer area/tema/dificultad del servidor y familia/a. */
  T.de = function(c){
    var m = T.MAPA[c.id] || [];
    var area = c.area || m[0] || T.VIEJAS[c.a] || T.VIEJAS[c.familia] || c.a || c.familia || 'Otros';
    if(T.VIEJAS[area]) area = T.VIEJAS[area];
    return { area:area, tema:c.tema || m[1] || '', nivel:c.dificultad || m[2] || 'desde_cero' };
  };
  /* Lista de áreas con las nuevas que aparezcan en «lista» (programas ya clasificados con .area) */
  T.areasCon = function(lista){
    var out = T.AREAS.slice();
    lista.forEach(function(c){ if(c.area && !out.some(function(a){ return a.k === c.area; }))
      out.push({ k:c.area, ico:T.ICONOS[c.area] || '📚', d:'Nuevo', temas:[] }); });
    out.forEach(function(a){ lista.forEach(function(c){ if(c.area === a.k && c.tema && a.temas.indexOf(c.tema) < 0) a.temas = a.temas.concat([c.tema]); }); });
    return out;
  };
  T.duracion = function(h){ h = Number(h) || 0; return h < 10 ? 'corto' : h < 25 ? 'medio' : 'largo'; };
})();
