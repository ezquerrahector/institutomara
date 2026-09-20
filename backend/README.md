# Backend de Instituto Mara (Supabase + Mercado Pago)

Esta carpeta no se publica en el sitio web: es la "trastienda" que le da a la
plataforma lo que un archivo HTML solo no puede hacer de forma segura ni
multi-dispositivo: acceso desde cualquier equipo, fotos de perfil en la nube,
verificación pública de constancias y cobro en línea automático.

Mientras no conectes esto, la plataforma sigue funcionando exactamente como
hoy: todo vive en el navegador (localStorage) de cada quien.

## 1. Crea el proyecto en Supabase

1. Entra a [supabase.com](https://supabase.com) y crea una cuenta gratuita.
2. "New project" → elige un nombre (ej. `instituto-mara`) y una contraseña de
   base de datos (guárdala en un lugar seguro).
3. Espera 1-2 minutos a que aprovisione el proyecto.

## 2. Crea las tablas

1. En el panel de Supabase, ve a **SQL Editor**.
2. Pega el contenido completo de [`schema.sql`](./schema.sql) y dale **Run**.
3. Verifica en **Table Editor** que aparecieron: `perfiles`, `cursos`,
   `inscripciones`, `avances`, `pagos`, `constancias`, `dudas`.

## 3. Activa el login por correo y contraseña

1. **Authentication → Providers** → confirma que "Email" esté activado.
2. **Authentication → Settings** → si no quieres que pida confirmar el correo
   antes de poder entrar (recomendable al inicio, para no trabarte), desactiva
   "Confirm email".

## 4. Copia las llaves del proyecto

En **Project Settings → API** copia:
- `Project URL` (algo como `https://xxxxxxxx.supabase.co`)
- `anon public` key (una cadena larga)

Estas dos son públicas por diseño (RLS las protege) y son las que se pegan en
la app: `plataforma/index.html` → Administración → Ajustes, en los campos que
dejamos preparados (`BD.config.supabaseUrl` y `BD.config.supabaseAnonKey`), y
también dentro de `verificar.html` en las constantes `SUPABASE_URL` /
`SUPABASE_ANON_KEY`.

> Nota para quien continúe el desarrollo: la versión actual de
> `plataforma/index.html` sigue leyendo y escribiendo en `localStorage` como
> capa principal (para no romper nada mientras se prueba). El siguiente paso
> de ingeniería es sustituir las funciones `cargar()`/`guardar()` y los
> formularios de acceso por llamadas a `supabase-js`, usando la sesión de
> Supabase Auth en vez de comparar contraseñas a mano. La estructura de datos
> (`BD.cursos`, `BD.usuarios`, etc.) ya coincide con las tablas de
> `schema.sql` para que ese cambio sea mecánico.

## 5. Cuenta de Mercado Pago

1. Crea o entra a tu cuenta de [Mercado Pago](https://www.mercadopago.com.mx).
2. Ve al [panel de desarrolladores](https://www.mercadopago.com.mx/developers/panel)
   → "Tus integraciones" → crea una aplicación.
3. Copia el **Access Token** de producción (empieza con `APP_USR-...`). Este
   es secreto: nunca lo pegues en `plataforma/index.html` ni en ningún archivo
   que se publique.

## 6. Publica las dos funciones de nube (Edge Functions)

Necesitas la [CLI de Supabase](https://supabase.com/docs/guides/cli) instalada
una sola vez (`npm install -g supabase`).

```bash
supabase login
supabase link --project-ref TU-PROJECT-REF   # está en la URL del proyecto
supabase secrets set MP_ACCESS_TOKEN=APP_USR-tu-access-token
supabase secrets set PRECIOS="$(cat backend/precios.json)"
supabase functions deploy crear-preferencia
supabase functions deploy webhook-mercadopago --no-verify-jwt
```

### Los precios los pone el servidor, no el navegador

`backend/precios.json` es la lista de precios oficial (`{"id-del-curso": precio}`).
`crear-preferencia` **ignora** el precio que manda el navegador y cobra el que
diga la tabla `cursos` de Supabase o, si esa tabla todavía no tiene datos, el de
esta lista. Así nadie puede abrir las herramientas del navegador, cambiar el
precio a $1 y pagar eso. `webhook-mercadopago` revisa lo mismo antes de dar
acceso: si el monto pagado no alcanza el precio, registra el pago con la nota
«REVISAR» y **no** inscribe al alumno.

Cada vez que cambies un precio en Administración → Ajustes, actualiza también la
lista y vuelve a subir el secreto:

```bash
supabase secrets set PRECIOS="$(cat backend/precios.json)"
```

Si un curso no aparece ni en la tabla `cursos` ni en `PRECIOS`, el cobro en
línea no se crea y el alumno ve un aviso para inscribirse por WhatsApp.

Al desplegar, la CLI te da la URL de cada función, algo como:

```
https://TU-PROJECT-REF.functions.supabase.co/crear-preferencia
https://TU-PROJECT-REF.functions.supabase.co/webhook-mercadopago
```

## 7. Conecta todo

- En Mercado Pago (panel de desarrolladores → tu app → Webhooks) registra la
  URL de `webhook-mercadopago` para el evento **Pagos**.
- En la plataforma, Administración → Ajustes → pega la URL de
  `crear-preferencia` en "URL de la función crear preferencia".

A partir de aquí, cuando un alumno haga clic en "Pagar con Mercado Pago":
1. El front llama a `crear-preferencia`, que crea el cobro y regresa el link
   de pago.
2. El alumno paga en Mercado Pago.
3. Mercado Pago avisa a `webhook-mercadopago`, que confirma el pago de verdad
   (no confía en lo que diga la URL de regreso) y da de alta la inscripción.
4. El alumno regresa a la plataforma con acceso ya activo — sin WhatsApp de
   por medio.

## 8. Constancias verificables

Con Supabase conectado, cada constancia que se emite se puede insertar también
en la tabla `constancias` (pública para lectura, por RLS). Esto permite que
`verificar.html`, además de leer los datos que ya trae el propio QR, los
contraste contra la base de datos real con las constantes `SUPABASE_URL` /
`SUPABASE_ANON_KEY` que están al final de ese archivo. Mientras no las
configures, `verificar.html` sigue funcionando con los datos que trae el QR y,
como respaldo, con el archivo `registro-publico.json` que se descarga desde
Administración → Constancias → "Descargar registro público" y se sube junto a
`verificar.html`.

## Costos

El plan gratuito de Supabase y el uso normal de Mercado Pago (que cobra una
comisión por transacción, no una cuota fija) alcanzan perfectamente para
arrancar. Revisa las condiciones vigentes en las páginas de cada proveedor
antes de operar con alumnos reales.
