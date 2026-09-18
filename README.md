# Instituto Mara

Escuela 100% en línea. Este repositorio tiene todo lo necesario para publicar
el sitio y el aula virtual en internet de forma gratuita con **GitHub Pages**.

## Qué hay aquí

- `index.html` — redirige a `sitio-web/index.html` (la página pública).
- `sitio-web/` — sitio de mercadeo: cursos, precios, preguntas frecuentes.
- `plataforma/` — el aula virtual (login de alumnos y administración).
- `verificar.html` — página pública para verificar constancias por folio o QR.
- `marca/` — logos en SVG.
- `backend/` — esquema de base de datos y funciones de nube (Supabase +
  Mercado Pago) para cuando quieras acceso multi-dispositivo real y cobro en
  línea automático. Ver `backend/README.md`.

## Publicar en GitHub Pages (gratis)

Esta carpeta ya está inicializada como repositorio git (con un primer commit
hecho), así que no hace falta `git init`.

1. Entra a [github.com](https://github.com) y crea una cuenta si no tienes.
2. Crea un repositorio nuevo, público, llamado por ejemplo `institutomara`
   (botón verde "New" en tu perfil). No marques ninguna casilla de
   inicialización (README, .gitignore, licencia): déjalo vacío.
3. En tu computadora, dentro de esta carpeta, ejecuta:

   ```bash
   git remote add origin https://github.com/TU-USUARIO/institutomara.git
   git push -u origin main
   ```

   (Sustituye `TU-USUARIO` por tu usuario de GitHub. Si nunca has usado git
   desde esa computadora, te pedirá iniciar sesión la primera vez. Si más
   adelante le sigues haciendo cambios al proyecto, usa `git init` solo si
   empiezas una copia nueva desde cero.)

4. En GitHub, entra al repositorio → **Settings → Pages**.
5. En "Build and deployment" elige **Deploy from a branch**, rama **main**,
   carpeta **/ (root)** → **Save**.
6. Espera 1-2 minutos. GitHub te va a dar la URL pública, algo como:

   ```
   https://TU-USUARIO.github.io/institutomara/
   ```

7. Abre esa URL: debe verse el sitio público, y "Ingresar" debe llevarte al
   aula virtual en `.../plataforma/`.
8. Entra al aula como administrador y ve a **Ajustes** → pega esa misma URL en
   "URL pública del sitio". Así los códigos QR de las constancias apuntan al
   lugar correcto.

### Actualizar el sitio después de hacerle cambios

```bash
git add .
git commit -m "Descripción breve del cambio"
git push
```

GitHub Pages se actualiza solo, uno o dos minutos después de cada `git push`.

### ¿Y el subdominio de instintofragancias.com?

Cuando quieras usar algo como `instintomara.instintofragancias.com` en vez de
la URL de github.io, el cambio es en dos lugares:
1. Donde tengas contratado el dominio `instintofragancias.com`: agrega un
   registro DNS tipo `CNAME` que apunte `instintomara` a
   `TU-USUARIO.github.io`.
2. En GitHub: Settings → Pages → "Custom domain" → escribe
   `instintomara.instintofragancias.com` → Save (esto crea un archivo `CNAME`
   en el repositorio automáticamente).

## Antes de anunciar la escuela al público

- [ ] Cambia la contraseña de administrador (Administración → Ajustes).
- [ ] Revisa el catálogo de cursos y los precios.
- [ ] Configura el WhatsApp de contacto y la URL pública (Ajustes).
- [ ] Decide si activas el cobro en línea con Mercado Pago (`backend/README.md`)
      o si de momento sigues cobrando manual y solo registras el pago.
- [ ] Si quieres acceso multi-dispositivo real (no solo en este navegador),
      sigue `backend/README.md` para conectar Supabase.
