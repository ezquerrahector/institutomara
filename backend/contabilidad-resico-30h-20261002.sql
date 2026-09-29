-- Diplomado en Contabilidad Básica, RESICO y Facturación CFDI 4.0: ampliado a 30 horas reales (opción B).
BEGIN;
UPDATE cursos SET horas=30, descripcion='Aprende a llevar las cuentas de tu negocio, leer tus números en hoja de cálculo, calcular tu ISR en el RESICO y tu IVA, y facturar bien en CFDI 4.0. Incluye 20 casos de negocios mexicanos (taquerías, estéticas, talleres, tiendas en línea) con decisiones guiadas, 4 laboratorios y un proyecto final en el que armas el tablero contable y fiscal de un negocio real. Es práctico y para personas físicas con negocios pequeños; no sustituye la asesoría de un contador público.' WHERE id='d-contabilidad-resico';
UPDATE cursos SET horas=56 WHERE id='r-emprende';
COMMIT;
