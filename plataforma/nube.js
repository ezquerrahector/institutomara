/* ============================================================================
   Instituto Mara — cuentas en la nube (Supabase)
   ----------------------------------------------------------------------------
   Este archivo es el puente entre el aula (que trabaja en memoria, como antes)
   y Supabase. Con él, el alumno se registra solo, confirma su correo, paga con
   Mercado Pago y entra desde cualquier dispositivo con su avance intacto: nadie
   tiene que darle de alta a mano.

   Cómo funciona, en corto:
   - Entrar / crear cuenta usan Supabase Auth (correo y contraseña).
   - Al entrar se descargan del servidor el perfil, las inscripciones, el avance,
     los pagos, las constancias y las dudas de ese alumno, y se cargan en la
     misma estructura BD que ya usaba la app.
   - Cada vez que la app guarda (guardar()), se suben al servidor los datos de
     ese usuario. La subida va con retraso de un segundo para no saturar.
   - Las inscripciones de cursos de paga NO las crea el navegador: las crea el
     webhook de Mercado Pago cuando el pago queda aprobado. Por eso, al volver
     de pagar, el aula consulta al servidor hasta que aparece el acceso.

   Requisitos en Supabase: backend/schema.sql y backend/nube.sql ejecutados.
   ========================================================================== */
(function(){
'use strict';

var LL_SES = 'institutoMara.nubeSesion';   /* tokens de la sesión */
var cfg = { url:'', key:'' };
var ses = null;            /* { access_token, refresh_token, expira, uid } */
var pendiente = null;      /* temporizador de la subida */
var ultimoEnvio = '';      /* huella del último envío, para no repetir */

/* ------------------------------- utilidades ------------------------------ */
function limpiaUrl(u){ return String(u||'').replace(/\/+$/,''); }
function activa(){ return !!(cfg.url && cfg.key); }

function guardarSesionLocal(){
  try{ localStorage.setItem(LL_SES, JSON.stringify(ses)); }catch(e){}
}
function borrarSesionLocal(){
  try{ localStorage.removeItem(LL_SES); }catch(e){}
}
function leerSesionLocal(){
  try{ return JSON.parse(localStorage.getItem(LL_SES) || 'null'); }catch(e){ return null; }
}

function mensajeError(d, porDefecto){
  var m = (d && (d.error_description || d.msg || d.message || d.error)) || '';
  if(/Invalid login credentials/i.test(m)) return 'Ese correo o esa contraseña no coinciden.';
  if(/Email not confirmed/i.test(m)) return 'Todavía no confirmas tu correo. Busca el mensaje de Instituto Mara en tu bandeja (revisa también spam).';
  if(/User already registered|already been registered/i.test(m)) return 'Ya existe una cuenta con ese correo. Entra con tu contraseña o usa «Olvidé mi contraseña».';
  if(/Password should be at least/i.test(m)) return 'La contraseña debe tener al menos 6 caracteres.';
  if(/rate limit|too many/i.test(m)) return 'Demasiados intentos seguidos. Espera unos minutos y vuelve a intentar.';
  if(/Unable to validate email|invalid format/i.test(m)) return 'Ese correo no parece válido. Revísalo.';
  return m || porDefecto || 'No se pudo completar la operación.';
}

/* ------------------------------ autenticación ---------------------------- */
function auth(ruta, cuerpo, query){
  return fetch(cfg.url + '/auth/v1/' + ruta + (query||''), {
    method:'POST',
    headers:{ 'Content-Type':'application/json', apikey:cfg.key },
    body: JSON.stringify(cuerpo)
  }).then(function(r){
    return r.json().catch(function(){ return {}; }).then(function(d){
      if(!r.ok) throw new Error(mensajeError(d));
      return d;
    });
  });
}

function fijarSesion(d){
  if(!d || !d.access_token) return null;
  ses = {
    access_token: d.access_token,
    refresh_token: d.refresh_token,
    expira: Date.now() + ((d.expires_in || 3600) * 1000) - 60000,
    uid: (d.user && d.user.id) || (ses && ses.uid) || null
  };
  guardarSesionLocal();
  return ses;
}

/* Devuelve un token vigente, renovándolo si ya venció. */
function token(){
  if(!ses) return Promise.reject(new Error('Sin sesión'));
  if(Date.now() < ses.expira) return Promise.resolve(ses.access_token);
  return auth('token', { refresh_token: ses.refresh_token }, '?grant_type=refresh_token')
    .then(function(d){ fijarSesion(d); return ses.access_token; })
    .catch(function(e){ ses = null; borrarSesionLocal(); throw e; });
}

/* --------------------------- consultas a las tablas ---------------------- */
function rest(ruta, opciones){
  opciones = opciones || {};
  return token().then(function(t){
    var h = {
      apikey: cfg.key,
      Authorization: 'Bearer ' + t,
      'Content-Type': 'application/json'
    };
    if(opciones.prefer) h.Prefer = opciones.prefer;
    return fetch(cfg.url + '/rest/v1/' + ruta, {
      method: opciones.metodo || 'GET',
      headers: h,
      body: opciones.cuerpo ? JSON.stringify(opciones.cuerpo) : undefined
    });
  }).then(function(r){
    return r.text().then(function(txt){
      var d = null; try{ d = txt ? JSON.parse(txt) : null; }catch(e){ d = txt; }
      if(!r.ok) throw new Error(mensajeError(d, 'Error del servidor (' + r.status + ')'));
      return d;
    });
  });
}

function upsert(tabla, filas, conflicto){
  if(!filas || !filas.length) return Promise.resolve([]);
  return rest(tabla + (conflicto ? '?on_conflict=' + conflicto : ''), {
    metodo:'POST', cuerpo:filas, prefer:'resolution=merge-duplicates,return=minimal'
  });
}

/* ------------------------ conversión entre formatos ---------------------- */
/* En la nube las columnas van en minúsculas con guion bajo; en la app los
   nombres son los de siempre. Aquí se traduce en ambos sentidos. */
function perfilDesde(f){
  return { id:f.id, nombre:f.nombre, correo:f.correo, tel:f.telefono || '',
           rol:f.rol || 'alumno', alta:(f.creado_en||'').slice(0,10), folio:f.folio || '',
           foto:f.foto_url || '', pass:'' };
}
function perfilHacia(u){
  return { id:u.id, nombre:u.nombre, correo:u.correo, telefono:u.tel || null,
           rol:u.rol || 'alumno', folio:u.folio || null, foto_url:u.foto || null };
}

/* ------------------------------- API pública ----------------------------- */
var Nube = {
  activa: activa,

  iniciar: function(url, key){
    cfg.url = limpiaUrl(url); cfg.key = key || '';
    ses = leerSesionLocal();
    /* Si el alumno llega desde el correo de confirmación, Supabase manda los
       tokens en el # de la dirección. Se guardan y se limpia la barra. */
    if(location.hash && location.hash.indexOf('error') >= 0 && location.hash.indexOf('access_token=') < 0){
      var pe = new URLSearchParams(location.hash.slice(1));
      Nube.errorEnlace = { codigo: pe.get('error_code') || pe.get('error') || '', texto: pe.get('error_description') || '' };
      history.replaceState(null, '', location.pathname + location.search);
    }
    if(location.hash && location.hash.indexOf('access_token=') >= 0){
      var p = new URLSearchParams(location.hash.slice(1));
      if(p.get('access_token')){
        fijarSesion({ access_token:p.get('access_token'), refresh_token:p.get('refresh_token'),
                      expires_in: Number(p.get('expires_in')||3600) });
        history.replaceState(null, '', location.pathname + location.search);
      }
    }
    return activa();
  },

  haySesion: function(){ return !!(ses && ses.refresh_token); },

  /* Vuelve a mandar el correo de confirmación (el enlace anterior ya se usó o venció). */
  reenviarConfirmacion: function(correo){
    return auth('resend', { type:'signup', email: correo,
      options:{ email_redirect_to: location.origin + location.pathname } },
      '?redirect_to=' + encodeURIComponent(location.origin + location.pathname));
  },

  /* Crear cuenta. Si el proyecto pide confirmar el correo (lo recomendado),
     regresa {confirmar:true} y el alumno todavía no entra. */
  registrar: function(datos){
    var destino = location.origin + location.pathname;
    return auth('signup', {
      email: datos.correo, password: datos.pass,
      data: { nombre: datos.nombre, telefono: datos.tel || '' }
    }, '?redirect_to=' + encodeURIComponent(destino))
    .then(function(d){
      if(d && d.access_token){ fijarSesion(d); return { confirmar:false }; }
      return { confirmar:true };
    });
  },

  entrar: function(correo, pass){
    return auth('token', { email:correo, password:pass }, '?grant_type=password')
      .then(function(d){ fijarSesion(d); return true; });
  },

  recuperar: function(correo){
    return auth('recover', { email: correo },
      '?redirect_to=' + encodeURIComponent(location.origin + location.pathname));
  },

  cambiarPass: function(nueva){
    return token().then(function(t){
      return fetch(cfg.url + '/auth/v1/user', {
        method:'PUT',
        headers:{ 'Content-Type':'application/json', apikey:cfg.key, Authorization:'Bearer ' + t },
        body: JSON.stringify({ password: nueva })
      }).then(function(r){
        return r.json().catch(function(){ return {}; }).then(function(d){
          if(!r.ok) throw new Error(mensajeError(d));
          return true;
        });
      });
    });
  },

  salir: function(){
    var t = ses && ses.access_token;
    ses = null; ultimoEnvio = ''; borrarSesionLocal();
    if(t){
      fetch(cfg.url + '/auth/v1/logout', {
        method:'POST', headers:{ apikey:cfg.key, Authorization:'Bearer ' + t }
      }).catch(function(){});
    }
  },

  /* Descarga todo lo del alumno que inició sesión y lo mete en BD. */
  cargarAlumno: function(BD){
    var uid;
    return token().then(function(t){
      /* Si la sesión vino del enlace del correo, todavía no sabemos el id del
         usuario: se lo preguntamos a Supabase. */
      if(ses.uid) return ses.uid;
      return fetch(cfg.url + '/auth/v1/user', {
        headers:{ apikey:cfg.key, Authorization:'Bearer ' + t }
      }).then(function(r){ return r.json(); }).then(function(d){
        if(!d || !d.id) throw new Error('No se pudo leer tu cuenta. Vuelve a entrar con tu correo y contraseña.');
        ses.uid = d.id; guardarSesionLocal();
        return d.id;
      });
    }).then(function(id){
      uid = id;
      return rest('perfiles?select=*&id=eq.' + uid);
    }).then(function(filas){
      if(!filas || !filas.length) throw new Error('Tu cuenta todavía se está creando. Espera unos segundos y vuelve a entrar.');
      var u = perfilDesde(filas[0]);
      /* el perfil vive en BD.usuarios como cualquier otro */
      var i, hay = false;
      for(i=0;i<BD.usuarios.length;i++) if(BD.usuarios[i].id === u.id){ BD.usuarios[i] = u; hay = true; }
      if(!hay) BD.usuarios.push(u);
      return Promise.all([
        rest('inscripciones?select=*&usuario_id=eq.' + uid),
        rest('avances?select=*&usuario_id=eq.' + uid),
        rest('pagos?select=*&usuario_id=eq.' + uid),
        rest('constancias?select=*&usuario_id=eq.' + uid),
        rest('dudas?select=*&usuario_id=eq.' + uid)
      ]).then(function(r){
        Nube.volcar(BD, { inscripciones:r[0], avances:r[1], pagos:r[2], constancias:r[3], dudas:r[4] });
        ultimoEnvio = huella(BD, u);
        return u;
      });
    });
  },

  /* El administrador ve a todos: alumnos, inscripciones, pagos y dudas. */
  cargarAdmin: function(BD){
    return Promise.all([
      rest('perfiles?select=*&order=creado_en.desc'),
      rest('inscripciones?select=*'),
      rest('avances?select=*'),
      rest('pagos?select=*&order=fecha.desc'),
      rest('constancias?select=*'),
      rest('dudas?select=*&order=fecha.desc')
    ]).then(function(r){
      var i, mios = {};
      for(i=0;i<BD.usuarios.length;i++) mios[BD.usuarios[i].id] = true;
      for(i=0;i<r[0].length;i++){
        var u = perfilDesde(r[0][i]);
        if(mios[u.id]){
          for(var j=0;j<BD.usuarios.length;j++) if(BD.usuarios[j].id === u.id) BD.usuarios[j] = u;
        } else BD.usuarios.push(u);
      }
      Nube.volcar(BD, { inscripciones:r[1], avances:r[2], pagos:r[3], constancias:r[4], dudas:r[5] });
      return true;
    });
  },

  /* Mete en BD las filas que vienen del servidor (reemplazando las que ya
     estaban del mismo id, para no duplicar). */
  volcar: function(BD, d){
    var i;
    if(d.inscripciones){
      for(i=0;i<d.inscripciones.length;i++){
        var f = d.inscripciones[i], hay = false;
        for(var a=0;a<BD.inscripciones.length;a++){
          if(BD.inscripciones[a].usuarioId === f.usuario_id && BD.inscripciones[a].cursoId === f.curso_id){
            BD.inscripciones[a].id = f.id; BD.inscripciones[a].fecha = f.fecha;
            BD.inscripciones[a].estatus = f.estatus; hay = true;
          }
        }
        if(!hay) BD.inscripciones.push({ id:f.id, usuarioId:f.usuario_id, cursoId:f.curso_id,
                                         fecha:f.fecha, estatus:f.estatus });
      }
    }
    if(d.avances){
      for(i=0;i<d.avances.length;i++){
        var v = d.avances[i];
        if(!BD.avances[v.usuario_id]) BD.avances[v.usuario_id] = {};
        BD.avances[v.usuario_id][v.curso_id] = {
          lecciones: v.lecciones_vistas || [],
          quizzes: v.calificaciones_modulo || {}
        };
      }
    }
    if(d.pagos){
      for(i=0;i<d.pagos.length;i++){
        var p = d.pagos[i], hayP = false;
        for(var b=0;b<BD.pagos.length;b++) if(BD.pagos[b].id === p.id) hayP = true;
        if(!hayP) BD.pagos.push({ id:p.id, usuarioId:p.usuario_id, cursoId:p.curso_id,
                                  monto:Number(p.monto)||0, medio:p.medio, nota:p.nota||'', fecha:p.fecha });
      }
    }
    if(d.constancias){
      for(i=0;i<d.constancias.length;i++){
        var k = d.constancias[i], hayK = false;
        for(var c=0;c<BD.constancias.length;c++)
          if(BD.constancias[c].usuarioId === k.usuario_id && BD.constancias[c].cursoId === k.curso_id){
            BD.constancias[c].folio = k.folio; BD.constancias[c].fecha = k.fecha; hayK = true;
          }
        if(!hayK) BD.constancias.push({ id:k.id, folio:k.folio, usuarioId:k.usuario_id, cursoId:k.curso_id,
                                        nombreAlumno:k.nombre_alumno, nombreCurso:k.nombre_curso,
                                        horas:Number(k.horas)||0, fecha:k.fecha });
      }
    }
    if(d.dudas){
      for(i=0;i<d.dudas.length;i++){
        var q = d.dudas[i], hayQ = false;
        for(var e=0;e<BD.dudas.length;e++) if(BD.dudas[e].id === q.id){
          BD.dudas[e].respuesta = q.respuesta || ''; BD.dudas[e].estatus = q.estatus; hayQ = true;
        }
        if(!hayQ) BD.dudas.push({ id:q.id, usuarioId:q.usuario_id, cursoId:q.curso_id,
                                  moduloId:q.modulo_id, leccionId:q.leccion_id, pregunta:q.pregunta,
                                  respuesta:q.respuesta || '', estatus:q.estatus, fecha:q.fecha,
                                  fechaRespuesta:q.fecha_respuesta });
      }
    }
  },

  /* Sube al servidor lo del usuario en sesión. Se llama desde guardar(), así
     que se agrupa: espera un segundo y manda una sola vez. */
  sincronizar: function(BD, u){
    if(!activa() || !ses || !u || !u.id) return;
    if(pendiente) clearTimeout(pendiente);
    pendiente = setTimeout(function(){
      pendiente = null;
      var h = huella(BD, u);
      if(h === ultimoEnvio) return;
      ultimoEnvio = h;
      enviar(BD, u).catch(function(e){
        ultimoEnvio = '';    /* para reintentar en el siguiente guardado */
        console.warn('No se pudo sincronizar con el servidor:', e.message);
      });
    }, 1000);
  },

  /* Vuelve a consultar las inscripciones del alumno (se usa al regresar de
     Mercado Pago: el acceso lo da el webhook, no el navegador). */
  refrescarInscripciones: function(BD, uid){
    return rest('inscripciones?select=*&usuario_id=eq.' + uid).then(function(filas){
      Nube.volcar(BD, { inscripciones: filas });
      return filas;
    });
  },

  /* Inscripción directa: solo funciona en cursos gratuitos (lo impone el
     servidor) o si quien la hace es administrador. */
  inscribir: function(uid, cid){
    return upsert('inscripciones', [{ usuario_id:uid, curso_id:cid, estatus:'activa' }],
                  'usuario_id,curso_id');
  },

  /* El administrador cambia el precio o el nombre de un curso: se copia a la
     tabla `cursos`, que es de donde el cobro toma el precio real. */
  guardarCurso: function(c){
    return upsert('cursos', [{ id:c.id, nombre:c.nombre, descripcion:c.desc || '', color:c.color || '#6D28D9',
      nivel:c.nivel || 'Cursos libres de capacitación', familia:c.familia || 'General',
      periodo_tipo:c.periodoTipo || null, periodo_num:c.periodoNum == null ? null : c.periodoNum,
      horas:Number(c.horas)||0, precio:Number(c.precio)||0,
      publicado:!!c.publicado, proximamente:!!c.proximamente }], 'id');
  },

  /* El precio, el nombre y el estado de cada curso los manda el servidor
     (tabla `cursos`), que es de donde se cobra. Así todos los dispositivos
     muestran lo mismo aunque el administrador lo haya cambiado en otro lado.
     Funciona sin sesión: los cursos publicados son de lectura pública. */
  cargarCatalogo: function(BD){
    var cab = { apikey: cfg.key };
    var listo = (ses && Date.now() < ses.expira)
      ? Promise.resolve(ses.access_token)
      : (ses ? token().catch(function(){ return null; }) : Promise.resolve(null));
    return listo.then(function(t){
      cab.Authorization = 'Bearer ' + (t || cfg.key);
      return fetch(cfg.url + '/rest/v1/cursos?select=id,nombre,descripcion,horas,precio,publicado,proximamente',
                   { headers: cab });
    }).then(function(r){ return r.ok ? r.json() : []; })
      .then(function(filas){
        var n = 0;
        for(var i=0;i<(filas||[]).length;i++){
          var f = filas[i];
          for(var j=0;j<BD.cursos.length;j++){
            var c = BD.cursos[j];
            if(c.id !== f.id) continue;
            if(f.precio != null) c.precio = Number(f.precio);
            if(f.horas != null) c.horas = Number(f.horas);
            if(f.nombre) c.nombre = f.nombre;
            if(f.descripcion) c.desc = f.descripcion;
            c.publicado = !!f.publicado;
            c.proximamente = !!f.proximamente;
            n++;
          }
          /* Rutas de aprendizaje (paquetes): precio y estado también del servidor */
          var R = window.RUTAS_MARA || [];
          for(var k=0;k<R.length;k++){
            if(R[k].id !== f.id) continue;
            if(f.precio != null) R[k].precio = Number(f.precio);
            R[k].publicado = !!f.publicado;
          }
        }
        return n;
      }).catch(function(){ return 0; });
  },

  /* ---------------------------- Cupones ----------------------------
     El alumno solo puede probar un código a la vez (la base valida y
     calcula el descuento); la lista completa la ve nada más el admin. */
  validarCupon: function(codigo, cursoId){
    return rest('rpc/aplicar_cupon', { metodo:'POST',
      cuerpo:{ p_codigo: codigo, p_curso_id: cursoId } })
      .then(function(f){ return Array.isArray(f) ? f[0] : f; });
  },
  listarCupones: function(){
    return rest('cupones?select=*&order=creado_en.desc');
  },
  guardarCupon: function(c){
    return upsert('cupones', [{ codigo:String(c.codigo).trim().toUpperCase(),
      descripcion:c.descripcion || null, tipo:c.tipo, valor:Number(c.valor),
      curso_id:c.cursoId || null, usos_max:c.usosMax == null ? null : Number(c.usosMax),
      vence:c.vence || null, activo:c.activo !== false }], 'codigo');
  },
  cambiarCupon: function(codigo, cambios){
    return rest('cupones?codigo=eq.' + encodeURIComponent(codigo),
      { metodo:'PATCH', cuerpo:cambios, prefer:'return=minimal' });
  },
  borrarCupon: function(codigo){
    return rest('cupones?codigo=eq.' + encodeURIComponent(codigo),
      { metodo:'DELETE', prefer:'return=minimal' });
  },

  registrarPago: function(p){
    return upsert('pagos', [{ usuario_id:p.usuarioId, curso_id:p.cursoId, monto:p.monto,
                              medio:p.medio || 'Manual', nota:p.nota || '', fecha:p.fecha }]);
  },

  borrarPago: function(id){
    return rest('pagos?id=eq.' + encodeURIComponent(id), { metodo:'DELETE', prefer:'return=minimal' });
  },

  responderDuda: function(id, respuesta){
    return rest('dudas?id=eq.' + id, { metodo:'PATCH',
      cuerpo:{ respuesta: respuesta, estatus:'respondida', fecha_respuesta: new Date().toISOString() },
      prefer:'return=minimal' });
  }
};

/* Huella de lo que se va a subir: si no cambió, no se manda. */
function huella(BD, u){
  var av = BD.avances[u.id] || {};
  return JSON.stringify([u.nombre, u.tel, (u.foto||'').length, av,
    filtrar(BD.inscripciones, u.id), filtrar(BD.constancias, u.id), filtrar(BD.dudas, u.id)]);
}
function filtrar(lista, uid){
  var r = [], i;
  for(i=0;i<lista.length;i++) if(lista[i].usuarioId === uid) r.push(lista[i]);
  return r;
}

function enviar(BD, u){
  var tareas = [];

  /* perfil (nombre, teléfono y foto; el correo y el rol los manda el servidor) */
  var perfil = perfilHacia(u);
  if(perfil.foto_url && perfil.foto_url.length > 400000) delete perfil.foto_url;
  tareas.push(rest('perfiles?id=eq.' + u.id, { metodo:'PATCH', prefer:'return=minimal',
    cuerpo:{ nombre:perfil.nombre, telefono:perfil.telefono, foto_url:perfil.foto_url } }));

  /* avance de cada curso */
  var av = BD.avances[u.id] || {}, filasAv = [];
  for(var cid in av){
    if(!av.hasOwnProperty(cid)) continue;
    filasAv.push({ usuario_id:u.id, curso_id:cid,
                   lecciones_vistas: av[cid].lecciones || [],
                   calificaciones_modulo: av[cid].quizzes || {},
                   actualizado_en: new Date().toISOString() });
  }
  if(filasAv.length) tareas.push(upsert('avances', filasAv, 'usuario_id,curso_id'));

  /* constancias nuevas */
  var cons = filtrar(BD.constancias, u.id).map(function(k){
    return { folio:k.folio, usuario_id:k.usuarioId, curso_id:k.cursoId,
             nombre_alumno:k.nombreAlumno, nombre_curso:k.nombreCurso,
             horas:k.horas, fecha:k.fecha };
  });
  if(cons.length) tareas.push(upsert('constancias', cons, 'folio'));

  /* dudas nuevas (las que todavía no tienen id del servidor) */
  var dudasNuevas = filtrar(BD.dudas, u.id).filter(function(q){ return !q.subida; });
  if(dudasNuevas.length){
    tareas.push(Promise.all(dudasNuevas.map(function(q){
      return rest('dudas', { metodo:'POST', prefer:'return=representation',
        cuerpo:{ usuario_id:u.id, curso_id:q.cursoId, modulo_id:q.moduloId, leccion_id:q.leccionId,
                 pregunta:q.pregunta, estatus:q.estatus || 'pendiente' } })
        .then(function(f){ if(f && f[0]){ q.id = f[0].id; } q.subida = true; });
    })));
  }

  return Promise.all(tareas);
}

window.Nube = Nube;
})();
