-- Diplomado en Evaluación Psicológica y Formulación de Casos Clínicos: ampliado a 30 horas reales (opción B).
BEGIN;
UPDATE cursos SET horas=30, descripcion='Para psicólogos con cédula y estudiantes de los últimos semestres que no saben por dónde empezar cuando llega un paciente. Aprende a conducir la primera consulta, evaluar el estado mental y el riesgo, usar la CIE-11 y el DSM-5-TR con criterio, formular el caso con el modelo de las 5 P, medir resultados sesión a sesión y documentar bien tu expediente. Incluye 20 casos clínicos ficticios con decisiones guiadas, 4 laboratorios de simulación de consulta y un proyecto final en el que integras la evaluación completa de un caso, del encuadre al informe. No sustituye la supervisión clínica.' WHERE id='d-evaluacion-clinica';
UPDATE cursos SET horas=95 WHERE id='r-psicologia';
COMMIT;
