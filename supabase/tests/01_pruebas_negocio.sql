-- Pruebas de reglas de negocio y permisos. Correr con: psql -v ON_ERROR_STOP=1 -f <archivo>
-- Cualquier ASSERT que falle detiene la ejecución con error.
\set ON_ERROR_STOP 1

-- Usuarios de prueba (el trigger crea su perfil en public.usuarios)
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
 ('00000000-0000-0000-0000-0000000000a1', 'admin@prueba.cr', '{"nombre":"Ana"}'),
 ('00000000-0000-0000-0000-0000000000b1', 'res1@prueba.cr',  '{"nombre":"Rafa"}'),
 ('00000000-0000-0000-0000-0000000000b2', 'res2@prueba.cr',  '{}');

DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.usuarios) = 3, 'el trigger debe crear 3 perfiles';
  ASSERT (SELECT nombre FROM public.usuarios WHERE email = 'res2@prueba.cr') = 'res2', 'nombre por defecto';
END $$;

-- ---------- Como administradora ----------
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);

SELECT public.crear_condominio('Condominio Las Palmas') AS condo \gset

INSERT INTO public.unidades (id, condominio_id, codigo, coeficiente, area_m2) VALUES
 ('00000000-0000-0000-0000-0000000000c1', :'condo', 'A-101', 40, 80),
 ('00000000-0000-0000-0000-0000000000c2', :'condo', 'A-102', 60, 120);
INSERT INTO public.unidad_personas (unidad_id, usuario_id, relacion, es_responsable_pago, puede_votar) VALUES
 ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1', 'propietario', true, true),
 ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000b2', 'propietario', true, true);
INSERT INTO public.membresias (usuario_id, condominio_id, rol) VALUES
 ('00000000-0000-0000-0000-0000000000b1', :'condo', 'residente'),
 ('00000000-0000-0000-0000-0000000000b2', :'condo', 'residente');
INSERT INTO public.planes_cuota (id, condominio_id, nombre, metodo, monto_total, vigente_desde) VALUES
 ('00000000-0000-0000-0000-0000000000d1', :'condo', 'Cuota mantenimiento', 'coeficiente', 1000000, '2026-01-01');

DO $$ BEGIN
  ASSERT public.generar_cuotas('00000000-0000-0000-0000-0000000000d1', '2026-08-01') = 2, 'agosto: 2 cuotas';
  ASSERT public.generar_cuotas('00000000-0000-0000-0000-0000000000d1', '2026-09-01') = 2, 'septiembre: 2 cuotas';
  ASSERT public.generar_cuotas('00000000-0000-0000-0000-0000000000d1', '2026-09-01') = 0, 'no duplica';
  ASSERT (SELECT monto FROM public.cargos WHERE unidad_id = '00000000-0000-0000-0000-0000000000c1' LIMIT 1) = 400000, 'prorrateo 40 %';
  ASSERT (SELECT count(*) FROM public.categorias_gasto) = 9, 'categorías por defecto';
END $$;

-- ---------- Tarea programada (rol de servicio) ----------
RESET ROLE;
DO $$ BEGIN
  ASSERT public._procesar_morosidad('2026-10-07') = 4, '4 cargos de interés';
END $$;

-- ---------- Como residente 1 ----------
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);

DO $$ BEGIN
  ASSERT (SELECT count(DISTINCT unidad_id) FROM public.cargos) = 1, 'el residente solo ve su unidad';
  ASSERT (SELECT count(*) FROM public.unidades) = 1, 'solo su unidad';
  ASSERT (SELECT saldo_total FROM public.v_estado_cuenta_unidad) = 816000, 'saldo con mora';
END $$;

INSERT INTO public.pagos (id, condominio_id, unidad_id, metodo, monto, referencia, pagado_por) VALUES
 ('00000000-0000-0000-0000-0000000000e1', :'condo', '00000000-0000-0000-0000-0000000000c1',
  'sinpe_movil', 850000, 'SINPE-123', '00000000-0000-0000-0000-0000000000b1');

DO $$ BEGIN
  BEGIN
    PERFORM public.aplicar_pago('00000000-0000-0000-0000-0000000000e1');
    RAISE EXCEPTION 'FALLO: un residente aprobó su propio pago';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FALLO%' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO public.pagos (condominio_id, unidad_id, metodo, monto, pagado_por)
    VALUES ((SELECT condominio_id FROM public.unidades LIMIT 1), '00000000-0000-0000-0000-0000000000c2',
            'sinpe_movil', 1, '00000000-0000-0000-0000-0000000000b1');
    RAISE EXCEPTION 'FALLO: reportó pago en una unidad ajena';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

-- ---------- La administradora aprueba ----------
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
SELECT public.aplicar_pago('00000000-0000-0000-0000-0000000000e1');
DO $$ BEGIN
  ASSERT (SELECT saldo_total FROM public.v_estado_cuenta_unidad WHERE codigo = 'A-101') = 0, 'A-101 saldada';
  ASSERT (SELECT saldo_favor FROM public.v_estado_cuenta_unidad WHERE codigo = 'A-101') = 34000, 'saldo a favor';
  ASSERT (SELECT condicion   FROM public.v_estado_cuenta_unidad WHERE codigo = 'A-102') = 'moroso', 'A-102 morosa';
  ASSERT (SELECT count(*) FROM public.auditoria) > 0, 'auditoría registrada';
END $$;

-- ---------- Resumen de cartera ----------
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.resumen_cartera('2026-09-01', '2026-10-01')) = 1, 'admin ve su condominio';
  ASSERT (SELECT facturado FROM public.resumen_cartera('2026-09-01', '2026-10-01')) = 1000000, 'facturado de septiembre';
  ASSERT (SELECT unidades_morosas FROM public.resumen_cartera('2026-09-01', '2026-10-01')) = 1, 'una unidad morosa';
END $$;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.resumen_cartera('2026-09-01', '2026-10-01')) = 0, 'un residente no ve la cartera';
END $$;
RESET ROLE;

-- ---------- Anónimo: no ve nada ni ejecuta reglas ----------
RESET ROLE;
SET ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', false);
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.cargos) = 0, 'anónimo no ve cargos';
  ASSERT (SELECT count(*) FROM public.usuarios) = 0, 'anónimo no ve usuarios';
  BEGIN
    PERFORM public.generar_cuotas('00000000-0000-0000-0000-0000000000d1', '2026-10-01');
    RAISE EXCEPTION 'FALLO: anónimo generó cuotas';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public._procesar_morosidad();
    RAISE EXCEPTION 'FALLO: anónimo procesó morosidad';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;

\echo 'Todas las pruebas pasaron'
