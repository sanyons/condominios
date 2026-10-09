-- Las funciones de trigger no deben llamarse por la API (/rest/v1/rpc).
-- Los triggers siguen funcionando: PostgreSQL no revisa EXECUTE al dispararlos.
REVOKE EXECUTE ON FUNCTION public.tg_ticket_numero()   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_validar_reserva() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_validar_voto()    FROM PUBLIC, anon, authenticated;
