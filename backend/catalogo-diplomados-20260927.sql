-- Publicación autorizada: sólo nuevos programas y ruta.
BEGIN;
INSERT INTO cursos (id,nombre,descripcion,color,nivel,familia,periodo_tipo,periodo_num,horas,precio,publicado,proximamente) VALUES
('diplomado-persuasion-etica','Diplomado en Técnicas de Persuasión y Comunicación Ética','Argumentar con evidencia, escuchar y comunicar propuestas con respeto a la autonomía.','#6c24dd','Diplomado','Diplomados','Módulo',10,60,2490,true,false),
('diplomado-estoicismo-vida-moderna','Diplomado en Estoicismo para la Vida Moderna','Examina decisiones, incertidumbre, emociones y relaciones mediante lecturas críticas, casos y prácticas de filosofía cotidiana.','#375C62','Diplomado','Diplomados','Módulo',6,48,1990,true,false),
('r-comunicacion-persuasiva','Ruta Comunicación, Persuasión y Servicio','Practica regulación emocional, argumentación ética y atención al cliente.','#0F766E','Rutas','Rutas',null,null,84,3290,true,false)
ON CONFLICT (id) DO NOTHING;
INSERT INTO rutas_cursos(ruta_id,curso_id,orden) VALUES
('r-comunicacion-persuasiva','c-inteligencia-emocional',1),
('r-comunicacion-persuasiva','diplomado-persuasion-etica',2),
('r-comunicacion-persuasiva','c-atencion-ventas',3)
ON CONFLICT(ruta_id,curso_id) DO NOTHING;
COMMIT;
SELECT id,nombre,horas,precio,publicado FROM cursos WHERE id IN ('diplomado-persuasion-etica','diplomado-estoicismo-vida-moderna','r-comunicacion-persuasiva');
