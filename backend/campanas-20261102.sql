-- Instituto Mara · Campañas por correo a prospectos (2 nov 2026).
-- Ejecutar una vez en Supabase → SQL Editor → Run. Requiere backend/prospectos-piloto.sql y es_admin().
-- Una campaña se envía a TODOS los prospectos con correo que NO pidieron baja ni marcaron «No le interesó».
create table if not exists campanas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  asunto text not null,
  texto text not null,                 -- admite {empresa}; el pie de baja se agrega solo
  segmento text,                       -- null = todos los giros
  estado text not null default 'borrador' check (estado in ('borrador','enviando','enviada')),
  enviados int not null default 0,
  creada_en timestamptz not null default now(),
  enviada_en timestamptz
);
create table if not exists campana_envios (
  campana_id uuid not null references campanas(id) on delete cascade,
  prospecto_id uuid not null references prospectos(id) on delete cascade,
  correo text,
  resultado text not null default 'enviado',   -- enviado | falla
  detalle text,
  mensaje_id text,                              -- id de Brevo para rastrear entrega
  fecha timestamptz not null default now(),
  primary key (campana_id, prospecto_id)
);
alter table campanas enable row level security;
alter table campana_envios enable row level security;
drop policy if exists "campanas admin" on campanas;
drop policy if exists "campana_envios admin" on campana_envios;
create policy "campanas admin" on campanas for all using (es_admin()) with check (es_admin());
create policy "campana_envios admin" on campana_envios for all using (es_admin()) with check (es_admin());

-- Primera campaña (borrador editable desde Administración → Prospectos → Campañas).
insert into campanas (nombre, asunto, texto)
select 'Navidad 2026 · Regala un diplomado a tu equipo',
  '{empresa}: este fin de año, regálale a tu equipo un diplomado',
  'Buen día, equipo de {empresa}:

Se acerca fin de año y muchas empresas buscan un detalle para su gente que de verdad se aproveche. Les propongo uno distinto a la canasta o el bono: un diplomado o curso en línea de Instituto Mara.

Cómo funciona el regalo:
1. Ustedes eligen el programa para cada persona (o un monto para que cada quien escoja el suyo).
2. Cada colaborador recibe su tarjeta de regalo por correo o WhatsApp, en la fecha que ustedes decidan (por ejemplo, la cena de fin de año).
3. Estudian desde el celular, a su ritmo, y al terminar reciben su constancia con folio y QR verificable.

Es un regalo que suma a su desarrollo profesional y que también fortalece al equipo para 2027.

Si me dicen cuántas personas y qué temas les interesan (ventas, liderazgo, atención a clientes, Excel, recursos humanos, etc.), les envío la propuesta con el costo por volumen. También pueden regalar uno desde aquí: https://institutomara.com/#regalar

Basta con responder este correo o escribirme por WhatsApp.'
where not exists (select 1 from campanas);
