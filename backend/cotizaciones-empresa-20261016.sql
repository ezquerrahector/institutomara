-- ============================================================================
-- Cotización con liga de pago para empresas (precio negociado) — 16 oct 2026
-- Se puede correr más de una vez sin romper nada.
--
-- Administración arma una cotización con el monto negociado; la función
-- «tienda» (acción empresa_cotizacion) crea la liga de Mercado Pago y la
-- compra queda «Esperando pago». Cuando la empresa paga, el webhook genera
-- los lugares EMP- igual que una compra en línea.
-- ============================================================================

alter table empresas_compras add column if not exists liga_pago text;          -- init_point de Mercado Pago
alter table empresas_compras add column if not exists liga_vence timestamptz;  -- hasta cuándo se puede pagar
alter table empresas_compras add column if not exists mp_preferencia_id text;  -- para vencerla si se cancela
