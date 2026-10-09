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

-- ---------- Amenidades y reservas ----------
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
INSERT INTO public.areas_comunes (id, condominio_id, nombre, costo, requiere_aprobacion, hora_apertura, hora_cierre,
                                  duracion_max_horas, reservas_max_mes, capacidad)
SELECT '00000000-0000-0000-0000-0000000000f1', id, 'Rancho', 15000, true, '08:00', '22:00', 4, 1, 30 FROM public.condominios;
INSERT INTO public.areas_comunes (id, condominio_id, nombre, costo, requiere_aprobacion, duracion_max_horas)
SELECT '00000000-0000-0000-0000-0000000000f2', id, 'Piscina', 0, false, 3 FROM public.condominios;

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
CREATE TEMP TABLE IF NOT EXISTS _dia AS SELECT (date_trunc('month', current_date) + interval '1 month' + interval '9 days')::date AS d;
GRANT SELECT ON _dia TO PUBLIC;
INSERT INTO public.reservas (id, condominio_id, area_id, unidad_id, usuario_id, inicio, fin, invitados, estado)
SELECT '00000000-0000-0000-0000-0000000000f3', u.condominio_id, '00000000-0000-0000-0000-0000000000f1', u.id,
       '00000000-0000-0000-0000-0000000000b1',
       ((SELECT d FROM _dia) + time '10:00') AT TIME ZONE 'America/Costa_Rica',
       ((SELECT d FROM _dia) + time '14:00') AT TIME ZONE 'America/Costa_Rica', 12, 'confirmada'
FROM public.unidades u WHERE u.codigo = 'A-101';
DO $$ BEGIN
  ASSERT (SELECT estado FROM public.reservas WHERE id = '00000000-0000-0000-0000-0000000000f3') = 'solicitada',
         'con aprobación queda solicitada aunque pida confirmada';
  ASSERT (SELECT cargo_id FROM public.reservas WHERE id = '00000000-0000-0000-0000-0000000000f3') IS NULL, 'sin cobro aún';
  UPDATE public.reservas SET estado = 'confirmada' WHERE id = '00000000-0000-0000-0000-0000000000f3';
  ASSERT (SELECT estado FROM public.reservas WHERE id = '00000000-0000-0000-0000-0000000000f3') = 'solicitada',
         'el residente no se autoconfirma';
  BEGIN
    INSERT INTO public.reservas (condominio_id, area_id, unidad_id, usuario_id, inicio, fin)
    SELECT u.condominio_id, '00000000-0000-0000-0000-0000000000f1', u.id, '00000000-0000-0000-0000-0000000000b1',
           ((SELECT d FROM _dia) + 1 + time '10:00') AT TIME ZONE 'America/Costa_Rica',
           ((SELECT d FROM _dia) + 1 + time '12:00') AT TIME ZONE 'America/Costa_Rica'
    FROM public.unidades u WHERE u.codigo = 'A-101';
    RAISE EXCEPTION 'FALLO: superó el límite mensual';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FALLO%' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO public.reservas (condominio_id, area_id, unidad_id, usuario_id, inicio, fin)
    SELECT u.condominio_id, '00000000-0000-0000-0000-0000000000f2', u.id, '00000000-0000-0000-0000-0000000000b1',
           ((SELECT d FROM _dia) + time '09:00') AT TIME ZONE 'America/Costa_Rica',
           ((SELECT d FROM _dia) + time '14:00') AT TIME ZONE 'America/Costa_Rica'
    FROM public.unidades u WHERE u.codigo = 'A-101';
    RAISE EXCEPTION 'FALLO: excedió la duración';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE 'FALLO%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.responder_reserva('00000000-0000-0000-0000-0000000000f3', true);
    RAISE EXCEPTION 'FALLO: un residente aprobó su reserva';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

-- Piscina sin aprobación: queda confirmada y no admite traslapes
INSERT INTO public.reservas (condominio_id, area_id, unidad_id, usuario_id, inicio, fin)
SELECT u.condominio_id, '00000000-0000-0000-0000-0000000000f2', u.id, '00000000-0000-0000-0000-0000000000b1',
       ((SELECT d FROM _dia) + time '10:00') AT TIME ZONE 'America/Costa_Rica',
       ((SELECT d FROM _dia) + time '12:00') AT TIME ZONE 'America/Costa_Rica'
FROM public.unidades u WHERE u.codigo = 'A-101';
DO $$ BEGIN
  ASSERT (SELECT estado FROM public.reservas WHERE area_id = '00000000-0000-0000-0000-0000000000f2') = 'confirmada',
         'sin aprobación queda confirmada';
  BEGIN
    INSERT INTO public.reservas (condominio_id, area_id, unidad_id, usuario_id, inicio, fin)
    SELECT u.condominio_id, '00000000-0000-0000-0000-0000000000f2', u.id, '00000000-0000-0000-0000-0000000000b1',
           ((SELECT d FROM _dia) + time '11:00') AT TIME ZONE 'America/Costa_Rica',
           ((SELECT d FROM _dia) + time '13:00') AT TIME ZONE 'America/Costa_Rica'
    FROM public.unidades u WHERE u.codigo = 'A-101';
    RAISE EXCEPTION 'FALLO: permitió un traslape';
  EXCEPTION WHEN exclusion_violation THEN NULL;
  END;
END $$;

-- Unidad morosa no reserva
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', false);
DO $$ BEGIN
  INSERT INTO public.reservas (condominio_id, area_id, unidad_id, usuario_id, inicio, fin)
  SELECT u.condominio_id, '00000000-0000-0000-0000-0000000000f2', u.id, '00000000-0000-0000-0000-0000000000b2',
         ((SELECT d FROM _dia) + time '15:00') AT TIME ZONE 'America/Costa_Rica',
         ((SELECT d FROM _dia) + time '16:00') AT TIME ZONE 'America/Costa_Rica'
  FROM public.unidades u WHERE u.codigo = 'A-102';
  RAISE EXCEPTION 'FALLO: una unidad morosa reservó';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM LIKE 'FALLO%' THEN RAISE; END IF;
END $$;

-- Aprobación con cobro y cancelación con anulación
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
SELECT public.responder_reserva('00000000-0000-0000-0000-0000000000f3', true);
DO $$ BEGIN
  ASSERT (SELECT estado FROM public.reservas WHERE id = '00000000-0000-0000-0000-0000000000f3') = 'confirmada', 'aprobada';
  ASSERT (SELECT c.monto FROM public.cargos c JOIN public.reservas r ON r.cargo_id = c.id
          WHERE r.id = '00000000-0000-0000-0000-0000000000f3' AND c.tipo = 'reserva') = 15000, 'cobro de la reserva';
END $$;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
SELECT public.cancelar_reserva('00000000-0000-0000-0000-0000000000f3');
DO $$ BEGIN
  ASSERT (SELECT estado FROM public.reservas WHERE id = '00000000-0000-0000-0000-0000000000f3') = 'cancelada', 'cancelada';
  ASSERT (SELECT c.estado FROM public.cargos c JOIN public.reservas r ON r.cargo_id = c.id
          WHERE r.id = '00000000-0000-0000-0000-0000000000f3') = 'anulado', 'cobro anulado';
END $$;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', false);
DO $$ BEGIN
  PERFORM public.cancelar_reserva((SELECT id FROM public.reservas WHERE area_id = '00000000-0000-0000-0000-0000000000f2'));
  RAISE EXCEPTION 'FALLO: canceló la reserva de otra unidad';
EXCEPTION WHEN insufficient_privilege THEN NULL;
END $$;

-- ---------- Calendario de eventos ----------
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
INSERT INTO public.eventos (condominio_id, titulo, categoria, inicio, todo_el_dia)
SELECT id, 'Asamblea ordinaria', 'asamblea', now() + interval '10 days', false FROM public.condominios;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.eventos) = 1, 'el residente ve los eventos';
  ASSERT (SELECT creado_por FROM public.eventos) = '00000000-0000-0000-0000-0000000000a1', 'autor por defecto';
  BEGIN
    INSERT INTO public.eventos (condominio_id, titulo, inicio) SELECT id, 'Fiesta', now() FROM public.condominios;
    RAISE EXCEPTION 'FALLO: un residente creó un evento';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  UPDATE public.eventos SET titulo = 'Cambiado';
  ASSERT (SELECT titulo FROM public.eventos) = 'Asamblea ordinaria', 'el residente no edita eventos';
END $$;

-- ---------- Documentos: los ocultos no se ven ----------
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
INSERT INTO public.documentos (condominio_id, carpeta, nombre, archivo_url, visible_residentes)
SELECT id, 'Reglamentos', 'Reglamento interno', id || '/reglamento.pdf', true FROM public.condominios;
INSERT INTO public.documentos (condominio_id, carpeta, nombre, archivo_url, visible_residentes)
SELECT id, 'Contratos', 'Contrato seguridad', id || '/contrato.pdf', false FROM public.condominios;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.documentos) = 1, 'el residente solo ve lo publicado';
END $$;

-- ---------- Un propietario con casas en dos condominios ----------
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
SELECT public.crear_condominio('Condominio Monte Verde') AS condo2 \gset
INSERT INTO public.unidades (id, condominio_id, codigo, tipo) VALUES
 ('00000000-0000-0000-0000-0000000000c9', :'condo2', 'Casa 7', 'casa');
INSERT INTO public.unidad_personas (unidad_id, usuario_id, relacion, es_responsable_pago) VALUES
 ('00000000-0000-0000-0000-0000000000c9', '00000000-0000-0000-0000-0000000000b1', 'propietario', true);
INSERT INTO public.membresias (usuario_id, condominio_id, rol) VALUES
 ('00000000-0000-0000-0000-0000000000b1', :'condo2', 'residente');
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.mis_propiedades()) = 2, 've sus dos propiedades';
  ASSERT (SELECT count(DISTINCT condominio_id) FROM public.mis_propiedades()) = 2, 'en dos condominios';
END $$;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', false);
DO $$ BEGIN
  ASSERT (SELECT count(*) FROM public.mis_propiedades()) = 1, 'el otro propietario solo ve la suya';
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
