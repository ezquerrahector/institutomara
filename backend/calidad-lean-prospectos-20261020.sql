-- Instituto Mara — Diplomado en Calidad y Mejora Continua en ventas a empresas (20 oct 2026). Se puede repetir.
-- 1) Número de lecciones del diplomado (regla del 50 % para dejar reseña; sin esto se usaba 10 por omisión).
update cursos set lecciones = 40 where id = 'd-calidad-lean';

-- 2) Recomendarlo a las empresas de planta (calzado, curtiduría e industria): entra como 3.er programa
--    de su giro, así aparece en el guion de llamada, en los correos y en el WhatsApp.
update prospectos
   set cursos_ids = coalesce(cursos_ids[1:2], '{}') || array['d-calidad-lean'] || coalesce(cursos_ids[3:], '{}')
 where segmento in ('Manufactura de calzado', 'Curtiduría / proveeduría de piel', 'Industria / manufactura')
   and not ('d-calidad-lean' = any(coalesce(cursos_ids, '{}')));

-- 3) Comprobación: debe salir lecciones = 40 y todas las empresas de planta con el diplomado.
select 'lecciones' as que, lecciones::text as valor from cursos where id = 'd-calidad-lean'
union all
select segmento, count(*) filter (where 'd-calidad-lean' = any(cursos_ids)) || ' de ' || count(*)
  from prospectos
 where segmento in ('Manufactura de calzado', 'Curtiduría / proveeduría de piel', 'Industria / manufactura')
 group by segmento;
