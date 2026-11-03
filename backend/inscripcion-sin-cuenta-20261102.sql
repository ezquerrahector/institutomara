-- Inscripción sin cuenta (2 nov 2026)
-- Reutiliza el flujo de «regalo sin cuenta»: quien compra es también quien recibe (para_mi = true).
-- Paga en Mercado Pago sin crear cuenta; al aprobarse el pago recibe por correo su código y la liga
-- para activar el programa (crea su cuenta con ese mismo correo y el programa se aplica solo).
alter table regalos add column if not exists para_mi boolean not null default false;
comment on column regalos.para_mi is 'Compra sin cuenta para uno mismo (inscripción desde la página del kit u otra landing): se entrega como acceso propio, no como regalo.';
