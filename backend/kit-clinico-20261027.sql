-- Kit de formatos clínicos (campaña para psicólogos) — 27 oct 2026
-- Registro de quien descarga el kit, secuencia de 5 correos y cupón KITCLINICO.

-- ---------- Registros ----------
create table if not exists kit_registros (
  id uuid primary key default gen_random_uuid(),
  recurso text not null default 'kit-clinico',
  nombre text not null,
  correo text not null,
  whatsapp text,
  perfil text,                       -- psicologo | estudiante | otro
  utm jsonb not null default '{}'::jsonb,
  token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  paso int not null default 0,       -- último correo enviado (1 a 5)
  siguiente_en timestamptz,          -- cuándo toca el siguiente correo
  baja boolean not null default false,
  baja_en timestamptz,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (recurso, correo)
);
create index if not exists kit_registros_siguiente on kit_registros (siguiente_en) where not baja;
alter table kit_registros enable row level security;
drop policy if exists kit_registros_admin on kit_registros;
create policy kit_registros_admin on kit_registros for select using (es_admin());

-- Los correos 2 a 5 salen solo cuando administración lo enciende.
alter table ajustes add column if not exists kit_secuencia boolean not null default false;

-- ---------- Cupón de la campaña ----------
insert into cupones (codigo, descripcion, tipo, valor, cursos, vence, activo, piloto, usos)
values ('KITCLINICO', 'Oferta del kit clínico: 60% en programas clínicos', 'porcentaje', 60,
  array['d-tcc','d-terapias-contextuales','d-evaluacion-clinica','c-pap','c-ia-psicologos'], '2026-11-30', true, false, 0)
on conflict (codigo) do nothing;

-- ---------- aplicar_cupon: mensaje claro cuando el programa no está incluido ----------
CREATE OR REPLACE FUNCTION public.aplicar_cupon(p_codigo text, p_curso_id text)
 RETURNS TABLE(valido boolean, motivo text, precio_original numeric, descuento numeric, precio_final numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  c cupones%rowtype;
  p numeric;
  d numeric;
begin
  select precio into p from cursos where id = p_curso_id and publicado;
  if p is null then
    return query select false, 'Ese curso no está disponible.', 0::numeric, 0::numeric, 0::numeric; return;
  end if;
  select * into c from cupones where upper(codigo) = upper(btrim(p_codigo));
  if not found or not c.activo then
    return query select false, 'Ese cupón no existe o ya no está activo.', p, 0::numeric, p; return;
  end if;
  if c.vence is not null and c.vence < current_date then
    return query select false, 'Ese cupón ya venció.', p, 0::numeric, p; return;
  end if;
  if c.usos_max is not null and c.usos >= c.usos_max then
    return query select false, 'Ese cupón ya llegó a su límite de usos.', p, 0::numeric, p; return;
  end if;
  if c.cursos is not null and array_length(c.cursos, 1) > 0 then
    if not (p_curso_id = any(c.cursos)) then
      return query select false,
        case when coalesce(c.piloto, false) then 'Este lugar es para otros programas. Revisa la lista que te compartió tu empresa.'
             else 'Este cupón aplica solo a algunos programas; este no está incluido.' end,
        p, 0::numeric, p; return;
    end if;
  elsif c.curso_id is not null and c.curso_id <> p_curso_id then
    return query select false, 'Ese cupón no aplica a este curso.', p, 0::numeric, p; return;
  end if;
  if c.curso_id is null and c.cursos is null and p_curso_id like 'r-%' then
    return query select false, 'Las rutas ya tienen precio especial; este cupón es para programas individuales.', p, 0::numeric, p; return;
  end if;
  d := case when c.tipo = 'porcentaje' then round(p * least(c.valor, 100) / 100, 2) else least(c.valor, p) end;
  return query select true, coalesce(c.descripcion, 'Cupón aplicado'), p, d, round(p - d, 2);
end; $function$;

-- ---------- Tarea diaria: 10:05 a. m. (hora de México) ----------
select cron.unschedule('mara-kit') where exists (select 1 from cron.job where jobname = 'mara-kit');
select cron.schedule('mara-kit', '5 16 * * *', $$
  select net.http_post(
    url := 'https://xvihjhfvwjgpesxpdtnl.supabase.co/functions/v1/kit',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' ||
      (select decrypted_secret from vault.decrypted_secrets where name='mara_service_role')),
    body := '{"accion":"secuencia"}'::jsonb)
$$);

select 'ok' as resultado;
