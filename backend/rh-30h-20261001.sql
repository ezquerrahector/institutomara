-- Recursos Humanos ampliado a 30 horas reales (opción B).
BEGIN;
UPDATE cursos SET horas=30, descripcion='Aprende a contratar bien, calcular aguinaldo, vacaciones, horas extra y finiquitos en hoja de cálculo, cumplir con lo básico de la Ley Federal del Trabajo y desarrollar a tu equipo con indicadores claros. Incluye 20 casos de empresas mexicanas con cálculos verificados, 5 laboratorios y un proyecto final en el que armas el plan anual de RH de una empresa real. Pensado para auxiliares y generalistas de RH, dueños de pymes y administradores que llevan el personal; no sustituye la asesoría de un abogado laboral ni de un contador.' WHERE id='d-recursos-humanos';
COMMIT;
