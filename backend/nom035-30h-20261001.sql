-- NOM-035 ampliada a 30 horas reales (opción B).
BEGIN;
UPDATE cursos SET horas=30, descripcion='Aprende a cumplir la NOM-035-STPS-2018 paso a paso: obligaciones según el tamaño del centro de trabajo, Guías de referencia I, II y III, calificación de cuestionarios en Excel, plan de acción y registros. Incluye 20 casos de empresas mexicanas con decisiones guiadas, 5 laboratorios y un proyecto final en el que armas el expediente NOM-035 de un centro de trabajo real. Incluye formatos listos para usar; no sustituye la lectura de la norma publicada en el DOF ni la asesoría legal o clínica.' WHERE id='d-nom035';
UPDATE cursos SET horas=46 WHERE id='r-lider';
COMMIT;
