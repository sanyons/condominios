-- =====================================================================
-- Módulos de comunidad: amenidades (reservas), documentos, calendario
-- de eventos y propiedades en varios condominios.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. RESERVAS DE AMENIDADES
-- ---------------------------------------------------------------------
ALTER TABLE public.reservas ADD COLUMN IF NOT EXISTS motivo_respuesta text;
ALTER TABLE public.reservas ADD COLUMN IF NOT EXISTS respondida_por uuid REFERENCES public.usuarios(id);
CREATE INDEX IF NOT EXISTS idx_reservas_condo_inicio ON public.reservas (condominio_id, inicio);
CREATE INDEX IF NOT EXISTS idx_reservas_unidad ON public.reservas (unidad_id, inicio);

-- El residente ya no edita su reserva directamente (podía confirmarla sin
-- aprobación o moverla fuera de horario): cancela con cancelar_reserva().
ALTER POLICY reser_propia ON public.reservas USING (false);

-- Validación al reservar: área del mismo condominio, horario, duración,
-- capacidad, límite mensual, morosidad. El estado lo decide el sistema.
CREATE OR REPLACE FUNCTION public.tg_validar_reserva() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  a public.areas_comunes%ROWTYPE;
  es_admin boolean;
  ini_local timestamp := NEW.inicio AT TIME ZONE 'America/Costa_Rica';
  fin_local timestamp := NEW.fin AT TIME ZONE 'America/Costa_Rica';
BEGIN
  SELECT * INTO a FROM public.areas_comunes WHERE id = NEW.area_id;
  IF NOT FOUND OR a.condominio_id <> NEW.condominio_id
     OR public.condo_de_unidad(NEW.unidad_id) IS DISTINCT FROM NEW.condominio_id THEN
    RAISE EXCEPTION 'El área no pertenece a este condominio';
  END IF;
  es_admin := public.tiene_rol(NEW.condominio_id, '{administrador}');

  IF NOT a.activa THEN RAISE EXCEPTION 'El área no está disponible'; END IF;
  IF NOT es_admin AND NEW.inicio < now() THEN
    RAISE EXCEPTION 'No se puede reservar en el pasado';
  END IF;
  IF fin_local::date <> ini_local::date THEN
    RAISE EXCEPTION 'La reserva debe empezar y terminar el mismo día';
  END IF;
  IF ini_local::time < a.hora_apertura OR fin_local::time > a.hora_cierre THEN
    RAISE EXCEPTION 'Fuera del horario del área';
  END IF;
  IF NEW.fin - NEW.inicio > a.duracion_max_horas * interval '1 hour' THEN
    RAISE EXCEPTION 'Excede la duración máxima del área';
  END IF;
  IF a.capacidad IS NOT NULL AND coalesce(NEW.invitados, 0) > a.capacidad THEN
    RAISE EXCEPTION 'Excede la capacidad del área';
  END IF;
  IF a.reservas_max_mes IS NOT NULL AND (
       SELECT count(*) FROM public.reservas r
       WHERE r.area_id = NEW.area_id AND r.unidad_id = NEW.unidad_id
         AND r.estado IN ('solicitada','confirmada','completada')
         AND date_trunc('month', r.inicio AT TIME ZONE 'America/Costa_Rica') = date_trunc('month', ini_local)
     ) >= a.reservas_max_mes THEN
    RAISE EXCEPTION 'La unidad alcanzó el límite de reservas del mes para esta área';
  END IF;
  IF a.bloquear_morosos AND EXISTS (
       SELECT 1 FROM public.cargos WHERE unidad_id = NEW.unidad_id AND estado = 'vencido') THEN
    RAISE EXCEPTION 'La unidad tiene saldos vencidos y no puede reservar';
  END IF;

  NEW.estado := CASE WHEN a.requiere_aprobacion AND NOT es_admin THEN 'solicitada' ELSE 'confirmada' END::public.estado_reserva;
  NEW.cargo_id := NULL;
  NEW.motivo_respuesta := NULL;
  NEW.respondida_por := NULL;
  RETURN NEW;
END $$;

-- Cobro de la reserva confirmada: un cargo tipo "reserva" en el estado de cuenta.
CREATE OR REPLACE FUNCTION public._cobrar_reserva(p_reserva uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.reservas%ROWTYPE; a public.areas_comunes%ROWTYPE; v_moneda public.moneda; v_cargo uuid;
BEGIN
  SELECT * INTO r FROM public.reservas WHERE id = p_reserva;
  IF r.cargo_id IS NOT NULL OR r.estado <> 'confirmada' THEN RETURN r.cargo_id; END IF;
  SELECT * INTO a FROM public.areas_comunes WHERE id = r.area_id;
  IF a.costo <= 0 THEN RETURN NULL; END IF;
  SELECT moneda_base INTO v_moneda FROM public.condominios WHERE id = r.condominio_id;
  INSERT INTO public.cargos (condominio_id, unidad_id, tipo, concepto, monto, saldo, moneda,
                             fecha_vence, creado_por)
  VALUES (r.condominio_id, r.unidad_id, 'reserva',
          'Reserva ' || a.nombre || ' · ' || to_char(r.inicio AT TIME ZONE 'America/Costa_Rica', 'DD/MM/YYYY'),
          a.costo, a.costo, v_moneda,
          greatest(current_date, (r.inicio AT TIME ZONE 'America/Costa_Rica')::date), auth.uid())
  RETURNING id INTO v_cargo;
  UPDATE public.reservas SET cargo_id = v_cargo WHERE id = p_reserva;
  RETURN v_cargo;
END $$;

CREATE OR REPLACE FUNCTION public.tg_cobrar_reserva() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.estado = 'confirmada' THEN PERFORM public._cobrar_reserva(NEW.id); END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_cobrar_reserva AFTER INSERT ON public.reservas
  FOR EACH ROW EXECUTE FUNCTION public.tg_cobrar_reserva();

-- Aprobar o rechazar (administración)
CREATE OR REPLACE FUNCTION public.responder_reserva(p_reserva uuid, p_aprobar boolean, p_motivo text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.reservas%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.reservas WHERE id = p_reserva FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'La reserva no existe'; END IF;
  IF NOT public.tiene_rol(r.condominio_id, '{administrador}') THEN
    RAISE EXCEPTION 'No tiene permiso para responder reservas' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF r.estado <> 'solicitada' THEN RAISE EXCEPTION 'La reserva ya fue respondida'; END IF;
  UPDATE public.reservas
     SET estado = CASE WHEN p_aprobar THEN 'confirmada' ELSE 'rechazada' END::public.estado_reserva,
         motivo_respuesta = nullif(trim(p_motivo), ''),
         respondida_por = auth.uid()
   WHERE id = p_reserva;
  IF p_aprobar THEN PERFORM public._cobrar_reserva(p_reserva); END IF;
END $$;

-- Cancelar: la unidad (antes de que empiece) o la administración.
-- Si el cobro no tiene abonos, se anula.
CREATE OR REPLACE FUNCTION public.cancelar_reserva(p_reserva uuid, p_motivo text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.reservas%ROWTYPE; es_admin boolean;
BEGIN
  SELECT * INTO r FROM public.reservas WHERE id = p_reserva FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'La reserva no existe'; END IF;
  es_admin := public.tiene_rol(r.condominio_id, '{administrador}');
  IF NOT es_admin AND r.unidad_id NOT IN (SELECT public.mis_unidades()) THEN
    RAISE EXCEPTION 'No tiene permiso para cancelar esta reserva' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF r.estado NOT IN ('solicitada','confirmada') THEN RAISE EXCEPTION 'La reserva ya no está activa'; END IF;
  IF NOT es_admin AND r.inicio <= now() THEN
    RAISE EXCEPTION 'No se puede cancelar una reserva que ya empezó';
  END IF;
  UPDATE public.reservas SET estado = 'cancelada',
         motivo_respuesta = coalesce(nullif(trim(p_motivo), ''), motivo_respuesta)
   WHERE id = p_reserva;
  IF r.cargo_id IS NOT NULL THEN
    UPDATE public.cargos SET estado = 'anulado', saldo = 0
     WHERE id = r.cargo_id AND saldo = monto AND estado <> 'anulado';
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public._cobrar_reserva(uuid)  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_cobrar_reserva()    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_validar_reserva()   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.responder_reserva(uuid, boolean, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cancelar_reserva(uuid, text)           FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.responder_reserva(uuid, boolean, text) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.cancelar_reserva(uuid, text)           TO authenticated;

-- ---------------------------------------------------------------------
-- 2. CALENDARIO DE EVENTOS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.eventos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id uuid NOT NULL REFERENCES public.condominios(id) ON DELETE CASCADE,
  titulo        text NOT NULL CHECK (length(btrim(titulo)) BETWEEN 1 AND 160),
  descripcion   text,
  ubicacion     text,
  categoria     text NOT NULL DEFAULT 'general'
                CHECK (categoria IN ('general','asamblea','mantenimiento','social','pagos','servicios')),
  inicio        timestamptz NOT NULL,
  fin           timestamptz,
  todo_el_dia   boolean NOT NULL DEFAULT false,
  creado_por    uuid REFERENCES public.usuarios(id) ON DELETE SET NULL DEFAULT auth.uid(),
  creado_en     timestamptz NOT NULL DEFAULT now(),
  CHECK (fin IS NULL OR fin >= inicio)
);
CREATE INDEX IF NOT EXISTS idx_eventos_condo_inicio ON public.eventos (condominio_id, inicio);
ALTER TABLE public.eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY eventos_lect  ON public.eventos FOR SELECT USING (public.es_miembro(condominio_id));
CREATE POLICY eventos_admin ON public.eventos FOR ALL
  USING (public.tiene_rol(condominio_id, '{administrador,junta}'))
  WITH CHECK (public.tiene_rol(condominio_id, '{administrador,junta}'));

-- ---------------------------------------------------------------------
-- 3. DOCUMENTOS
-- ---------------------------------------------------------------------
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS descripcion    text;
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS archivo_nombre text;
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS tamano_bytes   bigint;
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS tipo_mime      text;
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS actualizado_en timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS idx_documentos_condo_carpeta ON public.documentos (condominio_id, carpeta);
CREATE INDEX IF NOT EXISTS idx_documentos_archivo ON public.documentos (archivo_url);

-- Archivos en Storage: bucket privado "documentos", ruta <condominio>/<archivo>.
-- Administración y junta suben y borran; los residentes solo descargan
-- lo publicado (visible_residentes) de su condominio.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'storage') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('documentos', 'documentos', false, 26214400, ARRAY[
      'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain', 'text/csv'])
    ON CONFLICT (id) DO UPDATE SET file_size_limit = EXCLUDED.file_size_limit,
                                   allowed_mime_types = EXCLUDED.allowed_mime_types;

    EXECUTE $p$
      CREATE POLICY documentos_subir ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'documentos'
                  AND public.tiene_rol(((storage.foldername(name))[1])::uuid, '{administrador,junta}'))
    $p$;
    EXECUTE $p$
      CREATE POLICY documentos_cambiar ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id = 'documentos'
             AND public.tiene_rol(((storage.foldername(name))[1])::uuid, '{administrador,junta}'))
    $p$;
    EXECUTE $p$
      CREATE POLICY documentos_borrar ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'documentos'
             AND public.tiene_rol(((storage.foldername(name))[1])::uuid, '{administrador,junta}'))
    $p$;
    EXECUTE $p$
      CREATE POLICY documentos_ver ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'documentos'
             AND (public.tiene_rol(((storage.foldername(name))[1])::uuid, '{administrador,junta,contador}')
                  OR EXISTS (SELECT 1 FROM public.documentos d
                             WHERE d.archivo_url = name AND d.visible_residentes
                               AND public.es_miembro(d.condominio_id))))
    $p$;
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 4. PROPIEDADES EN VARIOS CONDOMINIOS
-- ---------------------------------------------------------------------
-- Todas las unidades de la persona, en cualquier condominio, con su saldo.
CREATE OR REPLACE FUNCTION public.mis_propiedades()
RETURNS TABLE (condominio_id uuid, condominio text, moneda public.moneda, unidad_id uuid, codigo text,
               tipo public.tipo_unidad, relacion public.relacion_unidad, es_responsable_pago boolean,
               saldo_total numeric, saldo_vencido numeric, saldo_favor numeric, condicion text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT c.id, c.nombre, c.moneda_base, u.id, u.codigo, u.tipo, up.relacion, up.es_responsable_pago,
         coalesce(e.saldo_total, 0), coalesce(e.saldo_vencido, 0), coalesce(e.saldo_favor, 0),
         coalesce(e.condicion, 'al_dia')
  FROM public.unidad_personas up
  JOIN public.unidades u    ON u.id = up.unidad_id
  JOIN public.condominios c ON c.id = u.condominio_id
  LEFT JOIN public.v_estado_cuenta_unidad e ON e.unidad_id = u.id
  WHERE up.usuario_id = auth.uid()
    AND (up.hasta IS NULL OR up.hasta >= current_date)
  ORDER BY c.nombre, u.codigo
$$;
REVOKE EXECUTE ON FUNCTION public.mis_propiedades() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.mis_propiedades() TO authenticated;
