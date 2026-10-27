-- Instituto Mara — regalo sin crear cuenta (26 oct 2026). Ya aplicado en Supabase.
-- Quien regala deja su nombre y correo; recibe una liga privada (token) para cambiar destinatario, mensaje o fecha.
alter table regalos alter column comprador_id drop not null;
alter table regalos add column if not exists de_correo text;
alter table regalos add column if not exists token uuid not null default gen_random_uuid();
alter table regalos add column if not exists confirmado_en timestamptz;
alter table regalos add column if not exists actualizado_en timestamptz;
create unique index if not exists regalos_token on regalos(token);
create index if not exists regalos_de_correo on regalos(lower(de_correo));
