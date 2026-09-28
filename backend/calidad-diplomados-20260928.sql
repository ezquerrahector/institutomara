-- Corrige sólo la clasificación de los dos diplomados nuevos.
-- No modifica inscripciones, avances, precios ni contenido de otros cursos.
BEGIN;
UPDATE cursos SET nivel='Diplomados',familia='Diplomados',periodo_tipo=NULL,periodo_num=NULL
WHERE id IN ('diplomado-persuasion-etica','diplomado-estoicismo-vida-moderna');
COMMIT;
SELECT id,nivel,familia,periodo_tipo,periodo_num,publicado FROM cursos
WHERE id IN ('diplomado-persuasion-etica','diplomado-estoicismo-vida-moderna');
