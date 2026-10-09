-- Indicadores por condominio para quien administra varios (respeta RLS: SECURITY INVOKER)
CREATE OR REPLACE FUNCTION public.resumen_cartera(p_desde date, p_hasta date)
RETURNS TABLE (
  condominio_id uuid,
  nombre text,
  moneda public.moneda,
  unidades bigint,
  facturado numeric,
  recaudado numeric,
  mora numeric,
  unidades_morosas bigint,
  por_revisar bigint,
  monto_por_revisar numeric
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT c.id, c.nombre, c.moneda_base,
    (SELECT count(*) FROM public.unidades u WHERE u.condominio_id = c.id),
    (SELECT coalesce(sum(k.monto), 0) FROM public.cargos k
      WHERE k.condominio_id = c.id AND k.estado <> 'anulado' AND k.periodo >= p_desde AND k.periodo < p_hasta),
    (SELECT coalesce(sum(p.monto), 0) FROM public.pagos p
      WHERE p.condominio_id = c.id AND p.estado = 'aplicado' AND p.fecha_pago >= p_desde AND p.fecha_pago < p_hasta),
    (SELECT coalesce(sum(k.saldo), 0) FROM public.cargos k WHERE k.condominio_id = c.id AND k.estado = 'vencido'),
    (SELECT count(DISTINCT k.unidad_id) FROM public.cargos k WHERE k.condominio_id = c.id AND k.estado = 'vencido'),
    (SELECT count(*) FROM public.pagos p WHERE p.condominio_id = c.id AND p.estado = 'en_revision'),
    (SELECT coalesce(sum(p.monto), 0) FROM public.pagos p WHERE p.condominio_id = c.id AND p.estado = 'en_revision')
  FROM public.condominios c
  WHERE public.tiene_rol(c.id, '{administrador,junta,contador}')
  ORDER BY c.nombre
$$;

REVOKE EXECUTE ON FUNCTION public.resumen_cartera(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resumen_cartera(date, date) TO authenticated;

-- Índices para que el resumen sea rápido con muchos condominios
CREATE INDEX IF NOT EXISTS idx_cargos_condo_estado ON public.cargos (condominio_id, estado);
CREATE INDEX IF NOT EXISTS idx_cargos_condo_periodo ON public.cargos (condominio_id, periodo);
CREATE INDEX IF NOT EXISTS idx_pagos_condo_estado_fecha ON public.pagos (condominio_id, estado, fecha_pago);
