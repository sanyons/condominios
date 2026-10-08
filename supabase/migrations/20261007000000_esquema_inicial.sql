-- =====================================================================
--  Plataforma de administración de condominios — esquema inicial
--  Destino: Supabase (PostgreSQL 15+). Tablas en el esquema public,
--  protegidas con Row Level Security. Usuario actual = auth.uid().
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;  -- reservas sin traslapes

-- ---------------------------------------------------------------------
-- 0. TIPOS ENUMERADOS
-- ---------------------------------------------------------------------
CREATE TYPE rol_usuario       AS ENUM ('super_admin','administrador','junta','contador','residente','seguridad','mantenimiento');
CREATE TYPE tipo_unidad       AS ENUM ('casa','apartamento','local','oficina','lote','parqueo','bodega');
CREATE TYPE relacion_unidad   AS ENUM ('propietario','inquilino','familiar','apoderado');
CREATE TYPE moneda            AS ENUM ('CRC','USD');
CREATE TYPE estado_cargo      AS ENUM ('pendiente','parcial','pagado','vencido','anulado');
CREATE TYPE tipo_cargo        AS ENUM ('cuota_ordinaria','cuota_extraordinaria','multa','interes_mora','reserva','agua','otro');
CREATE TYPE metodo_pago       AS ENUM ('sinpe_movil','transferencia','tarjeta','efectivo','deposito');
CREATE TYPE estado_pago       AS ENUM ('en_revision','aplicado','rechazado','reversado');
CREATE TYPE estado_gasto      AS ENUM ('borrador','por_aprobar','aprobado','pagado','rechazado');
CREATE TYPE estado_reserva    AS ENUM ('solicitada','confirmada','cancelada','rechazada','completada');
CREATE TYPE estado_ticket     AS ENUM ('abierto','asignado','en_proceso','en_espera','resuelto','cerrado');
CREATE TYPE prioridad         AS ENUM ('baja','media','alta','urgente');
CREATE TYPE tipo_visita       AS ENUM ('visita','proveedor','delivery','servicio','taxi');
CREATE TYPE estado_acceso     AS ENUM ('preautorizado','ingreso','salida','denegado','expirado');
CREATE TYPE tipo_asamblea     AS ENUM ('ordinaria','extraordinaria');
CREATE TYPE estado_asamblea   AS ENUM ('convocada','en_curso','finalizada','cancelada');
CREATE TYPE canal_notif       AS ENUM ('app','email','push','whatsapp','sms');

-- ---------------------------------------------------------------------
-- 1. ORGANIZACIÓN (TENANTS) Y USUARIOS
-- ---------------------------------------------------------------------
CREATE TABLE empresas_administradoras (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre          text NOT NULL,
  cedula_juridica text UNIQUE,
  email           text,
  telefono        text,
  plan            text NOT NULL DEFAULT 'basico',   -- basico | pro | enterprise
  activo          boolean NOT NULL DEFAULT true,
  creado_en       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE condominios (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id           uuid REFERENCES empresas_administradoras(id) ON DELETE SET NULL,
  nombre               text NOT NULL,
  cedula_juridica      text,
  finca_matriz         text,                        -- número de finca matriz (Registro Nacional)
  provincia            text, canton text, distrito text,
  direccion            text,
  moneda_base          moneda NOT NULL DEFAULT 'CRC',
  dia_vencimiento      smallint NOT NULL DEFAULT 10 CHECK (dia_vencimiento BETWEEN 1 AND 28),
  tasa_mora_mensual    numeric(5,2) NOT NULL DEFAULT 2.00,  -- % mensual, según reglamento
  dias_gracia          smallint NOT NULL DEFAULT 0,
  logo_url             text,
  reglamento_url       text,
  configuracion        jsonb NOT NULL DEFAULT '{}',  -- flags de módulos, colores, textos
  activo               boolean NOT NULL DEFAULT true,
  creado_en            timestamptz NOT NULL DEFAULT now()
);

-- Usuarios: perfil público de auth.users (se crea con un trigger al registrarse)
CREATE TABLE usuarios (
  id             uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email          text UNIQUE NOT NULL,
  nombre         text NOT NULL,
  apellidos      text,
  tipo_id        text DEFAULT 'fisica',   -- fisica | juridica | dimex | pasaporte
  identificacion text,
  telefono       text,
  avatar_url     text,
  idioma         text NOT NULL DEFAULT 'es',
  activo         boolean NOT NULL DEFAULT true,
  ultimo_acceso  timestamptz,
  creado_en      timestamptz NOT NULL DEFAULT now()
);

-- Un usuario puede tener distintos roles en distintos condominios
CREATE TABLE membresias (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id    uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  condominio_id uuid NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
  rol           rol_usuario NOT NULL,
  cargo_junta   text,                      -- presidente, tesorero, fiscal...
  activo        boolean NOT NULL DEFAULT true,
  creado_en     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (usuario_id, condominio_id, rol)
);

-- ---------------------------------------------------------------------
-- 2. ESTRUCTURA FÍSICA: TORRES / UNIDADES (FINCAS FILIALES)
-- ---------------------------------------------------------------------
CREATE TABLE torres (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id uuid NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
  nombre        text NOT NULL,             -- Torre A, Etapa 2, Bloque Norte
  pisos         smallint,
  UNIQUE (condominio_id, nombre)
);

CREATE TABLE unidades (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id      uuid NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
  torre_id           uuid REFERENCES torres(id) ON DELETE SET NULL,
  codigo             text NOT NULL,              -- "A-302", "Casa 14"
  tipo               tipo_unidad NOT NULL DEFAULT 'apartamento',
  finca_filial       text,                       -- número de finca filial
  area_m2            numeric(10,2),
  coeficiente        numeric(9,6) NOT NULL DEFAULT 0  -- % de participación (proporcionalidad)
                     CHECK (coeficiente >= 0 AND coeficiente <= 100),
  cuota_fija         numeric(14,2),               -- si no se usa coeficiente
  habitada           boolean NOT NULL DEFAULT true,
  notas              text,
  creado_en          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (condominio_id, codigo)
);

CREATE TABLE unidad_personas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidad_id     uuid NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
  usuario_id    uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  relacion      relacion_unidad NOT NULL,
  es_responsable_pago boolean NOT NULL DEFAULT false,
  puede_votar   boolean NOT NULL DEFAULT false,
  desde         date NOT NULL DEFAULT current_date,
  hasta         date,
  UNIQUE (unidad_id, usuario_id, relacion)
);

CREATE TABLE vehiculos (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidad_id  uuid NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
  placa      text NOT NULL,
  marca      text, modelo text, color text,
  tag_acceso text,                              -- TAG / RFID del portón
  activo     boolean NOT NULL DEFAULT true
);
CREATE INDEX idx_vehiculos_placa ON vehiculos (upper(placa));

CREATE TABLE mascotas (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidad_id  uuid NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
  nombre     text NOT NULL,
  especie    text NOT NULL,
  raza       text,
  vacunas_al_dia boolean,
  foto_url   text
);

-- ---------------------------------------------------------------------
-- 3. FINANZAS: CUOTAS, CARGOS, PAGOS, GASTOS, PRESUPUESTO
-- ---------------------------------------------------------------------
CREATE TABLE cuentas_bancarias (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id uuid NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
  banco         text NOT NULL,
  iban          text NOT NULL,
  moneda        moneda NOT NULL,
  sinpe_movil   text,                           -- número asociado
  titular       text NOT NULL,
  activa        boolean NOT NULL DEFAULT true
);

-- Define cómo se generan las cuotas periódicas
CREATE TABLE planes_cuota (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id uuid NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
  nombre        text NOT NULL,                  -- "Cuota mantenimiento 2026"
  tipo          tipo_cargo NOT NULL DEFAULT 'cuota_ordinaria',
  metodo        text NOT NULL DEFAULT 'coeficiente' CHECK (metodo IN ('coeficiente','fija','area')),
  monto_total   numeric(14,2),                  -- base a prorratear (metodo coeficiente)
  monto_unidad  numeric(14,2),                  -- monto fijo por unidad
  moneda        moneda NOT NULL DEFAULT 'CRC',
  periodicidad  text NOT NULL DEFAULT 'mensual' CHECK (periodicidad IN ('mensual','trimestral','anual','unica')),
  vigente_desde date NOT NULL,
  vigente_hasta date,
  activo        boolean NOT NULL DEFAULT true
);

CREATE TABLE cargos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id  uuid NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
  unidad_id      uuid NOT NULL REFERENCES unidades(id) ON DELETE RESTRICT,
  plan_id        uuid REFERENCES planes_cuota(id) ON DELETE SET NULL,
  tipo           tipo_cargo NOT NULL,
  concepto       text NOT NULL,
  periodo        date,                           -- primer día del mes facturado
  monto          numeric(14,2) NOT NULL CHECK (monto > 0),
  saldo          numeric(14,2) NOT NULL,
  moneda         moneda NOT NULL DEFAULT 'CRC',
  fecha_emision  date NOT NULL DEFAULT current_date,
  fecha_vence    date NOT NULL,
  estado         estado_cargo NOT NULL DEFAULT 'pendiente',
  cargo_origen_id uuid REFERENCES cargos(id),    -- interés de mora ligado al cargo original
  creado_por     uuid REFERENCES usuarios(id),
  creado_en      timestamptz NOT NULL DEFAULT now(),
  CHECK (saldo >= 0 AND saldo <= monto)
);
-- Evita duplicar la cuota de un mismo plan en el mismo periodo
CREATE UNIQUE INDEX uq_cargo_plan_periodo ON cargos (unidad_id, plan_id, periodo)
  WHERE plan_id IS NOT NULL AND estado <> 'anulado';
CREATE INDEX idx_cargos_unidad_estado ON cargos (unidad_id, estado);
CREATE INDEX idx_cargos_condo_vence   ON cargos (condominio_id, fecha_vence) WHERE saldo > 0;

CREATE TABLE pagos (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id    uuid NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
  unidad_id        uuid NOT NULL REFERENCES unidades(id) ON DELETE RESTRICT,
  pagado_por       uuid REFERENCES usuarios(id),
  cuenta_id        uuid REFERENCES cuentas_bancarias(id),
  metodo           metodo_pago NOT NULL,
  monto            numeric(14,2) NOT NULL CHECK (monto > 0),
  moneda           moneda NOT NULL DEFAULT 'CRC',
  tipo_cambio      numeric(10,4),               -- si moneda <> moneda_base
  referencia       text,                        -- # comprobante SINPE / transferencia
  comprobante_url  text,
  fecha_pago       date NOT NULL DEFAULT current_date,
  estado           estado_pago NOT NULL DEFAULT 'en_revision',
  revisado_por     uuid REFERENCES usuarios(id),
  revisado_en      timestamptz,
  motivo_rechazo   text,
  pasarela_id      text,                        -- id de transacción con tarjeta
  creado_en        timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_pago_referencia ON pagos (condominio_id, metodo, referencia)
  WHERE referencia IS NOT NULL AND estado <> 'rechazado';

-- Un pago se distribuye entre uno o varios cargos (FIFO por antigüedad)
CREATE TABLE pago_aplicaciones (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pago_id   uuid NOT NULL REFERENCES pagos(id) ON DELETE CASCADE,
  cargo_id  uuid NOT NULL REFERENCES cargos(id) ON DELETE RESTRICT,
  monto     numeric(14,2) NOT NULL CHECK (monto > 0),
  UNIQUE (pago_id, cargo_id)
);

-- Saldo a favor (pagos adelantados / excedentes)
CREATE TABLE saldos_favor (
  unidad_id  uuid PRIMARY KEY REFERENCES unidades(id) ON DELETE CASCADE,
  monto      numeric(14,2) NOT NULL DEFAULT 0 CHECK (monto >= 0),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE categorias_gasto (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id uuid NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
  nombre        text NOT NULL,                  -- Seguridad, Jardinería, Agua, Electricidad...
  UNIQUE (condominio_id, nombre)
);

CREATE TABLE proveedores (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id   uuid NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
  nombre          text NOT NULL,
  identificacion  text,
  contacto        text, telefono text, email text,
  iban            text,
  categoria_id    uuid REFERENCES categorias_gasto(id),
  activo          boolean NOT NULL DEFAULT true
);

CREATE TABLE presupuestos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id uuid NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
  anio          smallint NOT NULL,
  aprobado_en_asamblea uuid,                    -- FK a asambleas (se agrega abajo)
  UNIQUE (condominio_id, anio)
);

CREATE TABLE presupuesto_lineas (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  presupuesto_id uuid NOT NULL REFERENCES presupuestos(id) ON DELETE CASCADE,
  categoria_id   uuid NOT NULL REFERENCES categorias_gasto(id),
  monto_anual    numeric(14,2) NOT NULL,
  UNIQUE (presupuesto_id, categoria_id)
);

CREATE TABLE gastos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id  uuid NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
  proveedor_id   uuid REFERENCES proveedores(id),
  categoria_id   uuid NOT NULL REFERENCES categorias_gasto(id),
  descripcion    text NOT NULL,
  monto          numeric(14,2) NOT NULL CHECK (monto > 0),
  moneda         moneda NOT NULL DEFAULT 'CRC',
  fecha          date NOT NULL DEFAULT current_date,
  factura_numero text,                          -- consecutivo / clave de factura electrónica
  factura_url    text,
  estado         estado_gasto NOT NULL DEFAULT 'borrador',
  solicitado_por uuid REFERENCES usuarios(id),
  aprobado_por   uuid REFERENCES usuarios(id),
  aprobado_en    timestamptz,
  pagado_en      date,
  ticket_id      uuid,                          -- FK a tickets (se agrega abajo)
  creado_en      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_gastos_condo_fecha ON gastos (condominio_id, fecha);

-- ---------------------------------------------------------------------
-- 4. ÁREAS COMUNES Y RESERVAS
-- ---------------------------------------------------------------------
CREATE TABLE areas_comunes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id     uuid NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
  nombre            text NOT NULL,              -- Piscina, Rancho BBQ, Salón de eventos
  descripcion       text,
  capacidad         smallint,
  costo             numeric(14,2) NOT NULL DEFAULT 0,
  deposito          numeric(14,2) NOT NULL DEFAULT 0,
  requiere_aprobacion boolean NOT NULL DEFAULT false,
  hora_apertura     time NOT NULL DEFAULT '08:00',
  hora_cierre       time NOT NULL DEFAULT '22:00',
  duracion_max_horas smallint NOT NULL DEFAULT 4,
  reservas_max_mes  smallint,                   -- por unidad
  bloquear_morosos  boolean NOT NULL DEFAULT true,
  reglas            text,
  foto_url          text,
  activa            boolean NOT NULL DEFAULT true
);

CREATE TABLE reservas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id uuid NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
  area_id       uuid NOT NULL REFERENCES areas_comunes(id) ON DELETE CASCADE,
  unidad_id     uuid NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
  usuario_id    uuid NOT NULL REFERENCES usuarios(id),
  inicio        timestamptz NOT NULL,
  fin           timestamptz NOT NULL,
  invitados     smallint DEFAULT 0,
  estado        estado_reserva NOT NULL DEFAULT 'solicitada',
  cargo_id      uuid REFERENCES cargos(id),     -- cobro de la reserva
  notas         text,
  creado_en     timestamptz NOT NULL DEFAULT now(),
  CHECK (fin > inicio),
  -- Nunca dos reservas activas traslapadas en la misma área
  EXCLUDE USING gist (area_id WITH =, tstzrange(inicio, fin) WITH &&)
    WHERE (estado IN ('solicitada','confirmada'))
);

-- ---------------------------------------------------------------------
-- 5. CONTROL DE ACCESO (GARITA)
-- ---------------------------------------------------------------------
CREATE TABLE accesos (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id    uuid NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
  unidad_id        uuid NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
  autorizado_por   uuid REFERENCES usuarios(id),
  tipo             tipo_visita NOT NULL DEFAULT 'visita',
  nombre_visitante text NOT NULL,
  identificacion   text,
  placa            text,
  codigo_qr        text UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  valido_desde     timestamptz NOT NULL DEFAULT now(),
  valido_hasta     timestamptz NOT NULL DEFAULT now() + interval '12 hours',
  recurrente       boolean NOT NULL DEFAULT false,  -- empleada doméstica, niñera...
  dias_semana      smallint[],                      -- 1=lunes ... 7=domingo
  estado           estado_acceso NOT NULL DEFAULT 'preautorizado',
  hora_ingreso     timestamptz,
  hora_salida      timestamptz,
  oficial_id       uuid REFERENCES usuarios(id),
  foto_url         text,
  notas            text,
  creado_en        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_accesos_condo_estado ON accesos (condominio_id, estado, valido_hasta);

CREATE TABLE paqueteria (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id uuid NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
  unidad_id     uuid NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
  transportista text,
  descripcion   text,
  foto_url      text,
  recibido_por  uuid REFERENCES usuarios(id),
  recibido_en   timestamptz NOT NULL DEFAULT now(),
  entregado_a   text,
  entregado_en  timestamptz
);

CREATE TABLE bitacora_seguridad (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id uuid NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
  oficial_id    uuid REFERENCES usuarios(id),
  tipo          text NOT NULL,                    -- ronda, incidente, novedad, cambio_turno
  descripcion   text NOT NULL,
  unidad_id     uuid REFERENCES unidades(id),
  adjuntos      text[],
  creado_en     timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 6. MANTENIMIENTO Y SOLICITUDES (TICKETS)
-- ---------------------------------------------------------------------
CREATE TABLE tickets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id uuid NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
  numero        integer NOT NULL,                 -- consecutivo por condominio
  unidad_id     uuid REFERENCES unidades(id),
  area_id       uuid REFERENCES areas_comunes(id),
  reportado_por uuid NOT NULL REFERENCES usuarios(id),
  asignado_a    uuid REFERENCES usuarios(id),
  proveedor_id  uuid REFERENCES proveedores(id),
  categoria     text NOT NULL,                    -- plomería, electricidad, queja, sugerencia
  titulo        text NOT NULL,
  descripcion   text,
  prioridad     prioridad NOT NULL DEFAULT 'media',
  estado        estado_ticket NOT NULL DEFAULT 'abierto',
  es_privado    boolean NOT NULL DEFAULT false,   -- quejas confidenciales
  fotos         text[],
  calificacion  smallint CHECK (calificacion BETWEEN 1 AND 5),
  creado_en     timestamptz NOT NULL DEFAULT now(),
  resuelto_en   timestamptz,
  UNIQUE (condominio_id, numero)
);

CREATE TABLE ticket_comentarios (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id  uuid NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL REFERENCES usuarios(id),
  mensaje    text NOT NULL,
  interno    boolean NOT NULL DEFAULT false,      -- solo visible para administración
  adjuntos   text[],
  creado_en  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE gastos ADD CONSTRAINT fk_gasto_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE SET NULL;

CREATE TABLE mantenimiento_preventivo (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id   uuid NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
  equipo          text NOT NULL,                  -- bomba de agua, ascensor, planta eléctrica
  proveedor_id    uuid REFERENCES proveedores(id),
  frecuencia_dias integer NOT NULL,
  ultima_vez      date,
  proxima_vez     date NOT NULL,
  notas           text
);

-- ---------------------------------------------------------------------
-- 7. COMUNICACIÓN: AVISOS, DOCUMENTOS, NOTIFICACIONES
-- ---------------------------------------------------------------------
CREATE TABLE avisos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id uuid NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
  autor_id      uuid NOT NULL REFERENCES usuarios(id),
  titulo        text NOT NULL,
  contenido     text NOT NULL,
  categoria     text NOT NULL DEFAULT 'general',  -- general, urgente, mantenimiento, evento
  fijado        boolean NOT NULL DEFAULT false,
  audiencia     jsonb NOT NULL DEFAULT '{"todos":true}',  -- {"torres":[...]} | {"roles":[...]}
  adjuntos      text[],
  publicado_en  timestamptz NOT NULL DEFAULT now(),
  expira_en     timestamptz
);

CREATE TABLE aviso_lecturas (
  aviso_id   uuid NOT NULL REFERENCES avisos(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  leido_en   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (aviso_id, usuario_id)
);

CREATE TABLE documentos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id uuid NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
  carpeta       text NOT NULL DEFAULT 'General',  -- Reglamentos, Actas, Estados financieros, Contratos
  nombre        text NOT NULL,
  archivo_url   text NOT NULL,
  visible_residentes boolean NOT NULL DEFAULT true,
  subido_por    uuid REFERENCES usuarios(id),
  creado_en     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notificaciones (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id    uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  condominio_id uuid REFERENCES condominios(id) ON DELETE CASCADE,
  canal         canal_notif NOT NULL DEFAULT 'app',
  titulo        text NOT NULL,
  cuerpo        text,
  enlace        text,                              -- ruta interna: /pagos/123
  leida         boolean NOT NULL DEFAULT false,
  enviada_en    timestamptz,
  creado_en     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notif_usuario ON notificaciones (usuario_id, leida, creado_en DESC);

CREATE TABLE dispositivos_push (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token      text NOT NULL UNIQUE,
  plataforma text NOT NULL,                         -- web | ios | android
  creado_en  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 8. GOBIERNO: ASAMBLEAS, VOTACIONES, ACTAS
-- ---------------------------------------------------------------------
CREATE TABLE asambleas (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id      uuid NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
  tipo               tipo_asamblea NOT NULL,
  titulo             text NOT NULL,
  fecha_primera      timestamptz NOT NULL,          -- primera convocatoria
  fecha_segunda      timestamptz,                   -- segunda convocatoria
  lugar              text,
  enlace_virtual     text,
  agenda             text NOT NULL,
  quorum_requerido   numeric(5,2) NOT NULL DEFAULT 66.67,  -- % del valor del condominio
  estado             estado_asamblea NOT NULL DEFAULT 'convocada',
  acta_url           text,
  creado_por         uuid REFERENCES usuarios(id),
  creado_en          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE presupuestos ADD CONSTRAINT fk_presupuesto_asamblea
  FOREIGN KEY (aprobado_en_asamblea) REFERENCES asambleas(id) ON DELETE SET NULL;

CREATE TABLE asistencia_asamblea (
  asamblea_id uuid NOT NULL REFERENCES asambleas(id) ON DELETE CASCADE,
  unidad_id   uuid NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
  asistente_id uuid REFERENCES usuarios(id),
  es_apoderado boolean NOT NULL DEFAULT false,
  poder_url   text,
  registrado_en timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (asamblea_id, unidad_id)
);

CREATE TABLE votaciones (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominio_id   uuid NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
  asamblea_id     uuid REFERENCES asambleas(id) ON DELETE CASCADE,  -- null = consulta en línea
  pregunta        text NOT NULL,
  descripcion     text,
  opciones        text[] NOT NULL DEFAULT ARRAY['A favor','En contra','Abstención'],
  ponderada       boolean NOT NULL DEFAULT true,     -- pondera por coeficiente
  mayoria_requerida numeric(5,2) NOT NULL DEFAULT 50.01,
  abre_en         timestamptz NOT NULL DEFAULT now(),
  cierra_en       timestamptz NOT NULL,
  secreta         boolean NOT NULL DEFAULT false
);

CREATE TABLE votos (
  votacion_id uuid NOT NULL REFERENCES votaciones(id) ON DELETE CASCADE,
  unidad_id   uuid NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,  -- un voto por unidad
  usuario_id  uuid NOT NULL REFERENCES usuarios(id),
  opcion      text NOT NULL,
  peso        numeric(9,6) NOT NULL,                -- coeficiente al momento de votar
  emitido_en  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (votacion_id, unidad_id)
);

-- ---------------------------------------------------------------------
-- 9. AUDITORÍA
-- ---------------------------------------------------------------------
CREATE TABLE auditoria (
  id            bigserial PRIMARY KEY,
  condominio_id uuid,
  usuario_id    uuid,
  tabla         text NOT NULL,
  registro_id   uuid,
  accion        text NOT NULL,                      -- INSERT | UPDATE | DELETE
  antes         jsonb,
  despues       jsonb,
  creado_en     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_auditoria_registro ON auditoria (tabla, registro_id);

-- =====================================================================
-- 10. FUNCIONES DE APOYO PARA PERMISOS
-- =====================================================================

CREATE OR REPLACE FUNCTION public.usuario_actual() RETURNS uuid
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.tiene_rol(p_condo uuid, p_roles public.rol_usuario[]) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.membresias m
    WHERE m.usuario_id = auth.uid()
      AND m.activo
      AND ((m.condominio_id = p_condo AND m.rol = ANY(p_roles)) OR m.rol = 'super_admin')
  )
$$;

CREATE OR REPLACE FUNCTION public.es_miembro(p_condo uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.membresias m
                 WHERE m.usuario_id = auth.uid() AND m.activo
                   AND (m.condominio_id = p_condo OR m.rol = 'super_admin'))
$$;

CREATE OR REPLACE FUNCTION public.mis_unidades() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT up.unidad_id FROM public.unidad_personas up
  WHERE up.usuario_id = auth.uid()
    AND (up.hasta IS NULL OR up.hasta >= current_date)
$$;

CREATE OR REPLACE FUNCTION public.condo_de_unidad(p_unidad uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT condominio_id FROM public.unidades WHERE id = p_unidad
$$;

-- ¿Comparte el usuario actual algún condominio con p_usuario?
CREATE OR REPLACE FUNCTION public.comparte_condominio(p_usuario uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.membresias a
    JOIN public.membresias b ON b.condominio_id = a.condominio_id
    WHERE a.usuario_id = auth.uid() AND b.usuario_id = p_usuario AND a.activo AND b.activo
  )
$$;

-- =====================================================================
-- 11. ALTA DE USUARIOS Y CONDOMINIOS
-- =====================================================================

-- Crea el perfil público cuando alguien se registra o es invitado
CREATE OR REPLACE FUNCTION public.tg_nuevo_usuario() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.usuarios (id, email, nombre, apellidos, telefono)
  VALUES (NEW.id, NEW.email,
          coalesce(nullif(NEW.raw_user_meta_data->>'nombre', ''), split_part(NEW.email, '@', 1)),
          NEW.raw_user_meta_data->>'apellidos',
          NEW.raw_user_meta_data->>'telefono')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_nuevo_usuario AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.tg_nuevo_usuario();

-- El usuario actual crea un condominio y queda como administrador
CREATE OR REPLACE FUNCTION public.crear_condominio(
  p_nombre text, p_provincia text DEFAULT NULL, p_canton text DEFAULT NULL,
  p_moneda public.moneda DEFAULT 'CRC', p_dia_vencimiento smallint DEFAULT 10,
  p_tasa_mora numeric DEFAULT 2.00
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Debe iniciar sesión'; END IF;
  IF coalesce(trim(p_nombre), '') = '' THEN RAISE EXCEPTION 'El nombre es obligatorio'; END IF;

  INSERT INTO public.condominios (nombre, provincia, canton, moneda_base, dia_vencimiento, tasa_mora_mensual)
  VALUES (trim(p_nombre), p_provincia, p_canton, p_moneda, p_dia_vencimiento, p_tasa_mora)
  RETURNING id INTO v_id;

  INSERT INTO public.membresias (usuario_id, condominio_id, rol) VALUES (auth.uid(), v_id, 'administrador');

  INSERT INTO public.categorias_gasto (condominio_id, nombre)
  SELECT v_id, x FROM unnest(ARRAY['Seguridad','Limpieza','Jardinería','Agua','Electricidad',
                                   'Mantenimiento','Administración','Seguros','Otros']) AS x;
  RETURN v_id;
END $$;

-- =====================================================================
-- 12. REGLAS DE NEGOCIO (validan permisos por dentro)
-- =====================================================================

CREATE OR REPLACE FUNCTION public._generar_cuotas(p_plan uuid, p_periodo date) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_plan  public.planes_cuota%ROWTYPE;
  v_condo public.condominios%ROWTYPE;
  v_total_coef numeric;
  v_total_area numeric;
  v_count integer;
BEGIN
  SELECT * INTO v_plan FROM public.planes_cuota WHERE id = p_plan AND activo;
  IF NOT FOUND THEN RAISE EXCEPTION 'El plan de cuota no existe o está inactivo'; END IF;
  SELECT * INTO v_condo FROM public.condominios WHERE id = v_plan.condominio_id;

  SELECT sum(coeficiente), sum(area_m2) INTO v_total_coef, v_total_area
  FROM public.unidades WHERE condominio_id = v_plan.condominio_id;

  INSERT INTO public.cargos (condominio_id, unidad_id, plan_id, tipo, concepto, periodo,
                             monto, saldo, moneda, fecha_vence, creado_por)
  SELECT u.condominio_id, u.id, v_plan.id, v_plan.tipo,
         v_plan.nombre || ' ' || to_char(p_periodo, 'MM/YYYY'),
         date_trunc('month', p_periodo)::date,
         m.monto, m.monto, v_plan.moneda,
         (date_trunc('month', p_periodo) + (v_condo.dia_vencimiento - 1) * interval '1 day')::date,
         auth.uid()
  FROM public.unidades u
  CROSS JOIN LATERAL (
    SELECT round(CASE v_plan.metodo
      WHEN 'fija'        THEN coalesce(u.cuota_fija, v_plan.monto_unidad)
      WHEN 'coeficiente' THEN v_plan.monto_total * u.coeficiente / nullif(v_total_coef, 0)
      WHEN 'area'        THEN v_plan.monto_total * u.area_m2   / nullif(v_total_area, 0)
    END, 2) AS monto
  ) m
  WHERE u.condominio_id = v_plan.condominio_id
    AND m.monto > 0
  ON CONFLICT (unidad_id, plan_id, periodo) WHERE plan_id IS NOT NULL AND estado <> 'anulado'
  DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

-- Versión para usuarios: valida el rol y llama a la interna
CREATE OR REPLACE FUNCTION public.generar_cuotas(p_plan uuid, p_periodo date) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_condo uuid;
BEGIN
  SELECT condominio_id INTO v_condo FROM public.planes_cuota WHERE id = p_plan;
  IF v_condo IS NULL OR NOT public.tiene_rol(v_condo, '{administrador,contador}') THEN
    RAISE EXCEPTION 'No tiene permiso para generar cuotas';
  END IF;
  RETURN public._generar_cuotas(p_plan, p_periodo);
END $$;

-- Para la tarea programada: genera el mes actual de todos los planes mensuales activos
CREATE OR REPLACE FUNCTION public._generar_cuotas_del_mes() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE p record; v_total integer := 0;
BEGIN
  FOR p IN SELECT id FROM public.planes_cuota
           WHERE activo AND periodicidad = 'mensual'
             AND vigente_desde <= current_date AND (vigente_hasta IS NULL OR vigente_hasta >= current_date)
  LOOP
    v_total := v_total + public._generar_cuotas(p.id, current_date);
  END LOOP;
  RETURN v_total;
END $$;

CREATE OR REPLACE FUNCTION public.aplicar_pago(p_pago uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_pago  public.pagos%ROWTYPE;
  v_resto numeric;
  c       record;
  v_abono numeric;
BEGIN
  SELECT * INTO v_pago FROM public.pagos WHERE id = p_pago FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'El pago no existe'; END IF;
  IF NOT public.tiene_rol(v_pago.condominio_id, '{administrador,contador}') THEN
    RAISE EXCEPTION 'No tiene permiso para aprobar pagos';
  END IF;
  IF v_pago.estado = 'aplicado' THEN RETURN; END IF;
  IF v_pago.estado <> 'en_revision' THEN
    RAISE EXCEPTION 'El pago está en estado %', v_pago.estado;
  END IF;

  v_resto := v_pago.monto;
  FOR c IN
    SELECT id, saldo FROM public.cargos
    WHERE unidad_id = v_pago.unidad_id AND saldo > 0
      AND moneda = v_pago.moneda AND estado <> 'anulado'
    ORDER BY fecha_vence, fecha_emision
    FOR UPDATE
  LOOP
    EXIT WHEN v_resto <= 0;
    v_abono := least(v_resto, c.saldo);
    INSERT INTO public.pago_aplicaciones (pago_id, cargo_id, monto) VALUES (p_pago, c.id, v_abono);
    UPDATE public.cargos SET saldo = saldo - v_abono,
                      estado = CASE WHEN saldo - v_abono = 0 THEN 'pagado'::public.estado_cargo
                                    ELSE 'parcial'::public.estado_cargo END
    WHERE id = c.id;
    v_resto := v_resto - v_abono;
  END LOOP;

  IF v_resto > 0 THEN
    INSERT INTO public.saldos_favor (unidad_id, monto) VALUES (v_pago.unidad_id, v_resto)
    ON CONFLICT (unidad_id) DO UPDATE SET monto = public.saldos_favor.monto + EXCLUDED.monto,
                                          actualizado_en = now();
  END IF;

  UPDATE public.pagos SET estado = 'aplicado', revisado_por = auth.uid(), revisado_en = now()
  WHERE id = p_pago;
END $$;

CREATE OR REPLACE FUNCTION public.rechazar_pago(p_pago uuid, p_motivo text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_pago public.pagos%ROWTYPE;
BEGIN
  SELECT * INTO v_pago FROM public.pagos WHERE id = p_pago FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'El pago no existe'; END IF;
  IF NOT public.tiene_rol(v_pago.condominio_id, '{administrador,contador}') THEN
    RAISE EXCEPTION 'No tiene permiso para rechazar pagos';
  END IF;
  IF v_pago.estado <> 'en_revision' THEN RAISE EXCEPTION 'Solo se rechazan pagos en revisión'; END IF;
  UPDATE public.pagos SET estado = 'rechazado', motivo_rechazo = p_motivo,
                          revisado_por = auth.uid(), revisado_en = now()
  WHERE id = p_pago;
END $$;

-- Marca vencidos y genera intereses de mora. Sin p_condo: todos (tarea programada).
CREATE OR REPLACE FUNCTION public._procesar_morosidad(p_fecha date DEFAULT current_date, p_condo uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_count integer;
BEGIN
  UPDATE public.cargos c SET estado = 'vencido'
  FROM public.condominios co
  WHERE co.id = c.condominio_id
    AND (p_condo IS NULL OR c.condominio_id = p_condo)
    AND c.saldo > 0 AND c.estado IN ('pendiente','parcial')
    AND c.fecha_vence + co.dias_gracia < p_fecha;

  INSERT INTO public.cargos (condominio_id, unidad_id, tipo, concepto, periodo, monto, saldo,
                             moneda, fecha_vence, cargo_origen_id)
  SELECT c.condominio_id, c.unidad_id, 'interes_mora',
         'Interés por mora - ' || c.concepto,
         date_trunc('month', p_fecha)::date,
         round(c.saldo * co.tasa_mora_mensual / 100, 2),
         round(c.saldo * co.tasa_mora_mensual / 100, 2),
         c.moneda, p_fecha + 10, c.id
  FROM public.cargos c JOIN public.condominios co ON co.id = c.condominio_id
  WHERE c.estado = 'vencido' AND c.tipo IN ('cuota_ordinaria','cuota_extraordinaria')
    AND (p_condo IS NULL OR c.condominio_id = p_condo)
    AND co.tasa_mora_mensual > 0
    AND round(c.saldo * co.tasa_mora_mensual / 100, 2) > 0
    AND NOT EXISTS (SELECT 1 FROM public.cargos i
                    WHERE i.cargo_origen_id = c.id
                      AND i.periodo = date_trunc('month', p_fecha)::date);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

-- Versión para usuarios: solo su condominio
CREATE OR REPLACE FUNCTION public.procesar_morosidad(p_condo uuid) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.tiene_rol(p_condo, '{administrador,contador}') THEN
    RAISE EXCEPTION 'No tiene permiso para procesar la morosidad';
  END IF;
  RETURN public._procesar_morosidad(current_date, p_condo);
END $$;

-- Consecutivo de tiquetes por condominio
CREATE OR REPLACE FUNCTION public.tg_ticket_numero() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.numero IS NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(NEW.condominio_id::text));
    SELECT coalesce(max(numero), 0) + 1 INTO NEW.numero
    FROM public.tickets WHERE condominio_id = NEW.condominio_id;
  END IF;
  IF NEW.estado IN ('resuelto','cerrado') AND NEW.resuelto_en IS NULL THEN
    NEW.resuelto_en := now();
  END IF;
  RETURN NEW;
END $$;
ALTER TABLE public.tickets ALTER COLUMN numero DROP NOT NULL;
CREATE TRIGGER trg_ticket_numero BEFORE INSERT OR UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.tg_ticket_numero();

-- Validación de reservas: horario, duración, morosidad
CREATE OR REPLACE FUNCTION public.tg_validar_reserva() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a public.areas_comunes%ROWTYPE;
BEGIN
  SELECT * INTO a FROM public.areas_comunes WHERE id = NEW.area_id;
  IF NOT a.activa THEN RAISE EXCEPTION 'El área % no está disponible', a.nombre; END IF;
  IF (NEW.inicio AT TIME ZONE 'America/Costa_Rica')::time < a.hora_apertura
     OR (NEW.fin AT TIME ZONE 'America/Costa_Rica')::time > a.hora_cierre THEN
    RAISE EXCEPTION 'Fuera del horario del área (% - %)', a.hora_apertura, a.hora_cierre;
  END IF;
  IF NEW.fin - NEW.inicio > a.duracion_max_horas * interval '1 hour' THEN
    RAISE EXCEPTION 'Excede la duración máxima de % horas', a.duracion_max_horas;
  END IF;
  IF a.bloquear_morosos AND EXISTS (
       SELECT 1 FROM public.cargos WHERE unidad_id = NEW.unidad_id AND estado = 'vencido') THEN
    RAISE EXCEPTION 'La unidad tiene saldos vencidos y no puede reservar';
  END IF;
  IF NOT a.requiere_aprobacion THEN
    NEW.estado := 'confirmada';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_validar_reserva BEFORE INSERT ON public.reservas
  FOR EACH ROW EXECUTE FUNCTION public.tg_validar_reserva();

-- Voto: peso = coeficiente, solo dentro del periodo y solo quien puede votar
CREATE OR REPLACE FUNCTION public.tg_validar_voto() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v public.votaciones%ROWTYPE;
BEGIN
  SELECT * INTO v FROM public.votaciones WHERE id = NEW.votacion_id;
  IF now() NOT BETWEEN v.abre_en AND v.cierra_en THEN
    RAISE EXCEPTION 'La votación no está abierta';
  END IF;
  IF NOT (NEW.opcion = ANY(v.opciones)) THEN
    RAISE EXCEPTION 'Opción inválida';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.unidad_personas
                 WHERE unidad_id = NEW.unidad_id AND usuario_id = NEW.usuario_id
                   AND puede_votar AND (hasta IS NULL OR hasta >= current_date)) THEN
    RAISE EXCEPTION 'El usuario no tiene derecho a voto por esta unidad';
  END IF;
  SELECT CASE WHEN v.ponderada THEN coeficiente ELSE 1 END INTO NEW.peso
  FROM public.unidades WHERE id = NEW.unidad_id;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_validar_voto BEFORE INSERT ON public.votos
  FOR EACH ROW EXECUTE FUNCTION public.tg_validar_voto();

-- Auditoría de tablas sensibles
CREATE OR REPLACE FUNCTION public.tg_auditoria() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r jsonb := to_jsonb(coalesce(NEW, OLD));
BEGIN
  INSERT INTO public.auditoria (condominio_id, usuario_id, tabla, registro_id, accion, antes, despues)
  VALUES ((r->>'condominio_id')::uuid, auth.uid(), TG_TABLE_NAME, (r->>'id')::uuid, TG_OP,
          CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END,
          CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END);
  RETURN coalesce(NEW, OLD);
END $$;
CREATE TRIGGER aud_cargos   AFTER INSERT OR UPDATE OR DELETE ON public.cargos   FOR EACH ROW EXECUTE FUNCTION public.tg_auditoria();
CREATE TRIGGER aud_pagos    AFTER INSERT OR UPDATE OR DELETE ON public.pagos    FOR EACH ROW EXECUTE FUNCTION public.tg_auditoria();
CREATE TRIGGER aud_gastos   AFTER INSERT OR UPDATE OR DELETE ON public.gastos   FOR EACH ROW EXECUTE FUNCTION public.tg_auditoria();
CREATE TRIGGER aud_unidades AFTER INSERT OR UPDATE OR DELETE ON public.unidades FOR EACH ROW EXECUTE FUNCTION public.tg_auditoria();

-- Las funciones internas (prefijo _) solo las usa el rol de servicio o tareas programadas
REVOKE EXECUTE ON FUNCTION public._generar_cuotas(uuid, date)      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._generar_cuotas_del_mes()        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._procesar_morosidad(date, uuid)  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_nuevo_usuario()               FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_auditoria()                   FROM PUBLIC, anon, authenticated;
-- Las funciones de negocio requieren sesión iniciada
REVOKE EXECUTE ON FUNCTION public.generar_cuotas(uuid, date)       FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.aplicar_pago(uuid)               FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.rechazar_pago(uuid, text)        FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.procesar_morosidad(uuid)         FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.crear_condominio(text, text, text, public.moneda, smallint, numeric) FROM PUBLIC, anon;

-- =====================================================================
-- 13. VISTAS (security_invoker: respetan los permisos de quien consulta)
-- =====================================================================
CREATE OR REPLACE VIEW public.v_estado_cuenta_unidad WITH (security_invoker = true) AS
SELECT u.condominio_id, u.id AS unidad_id, u.codigo,
       coalesce(sum(c.saldo) FILTER (WHERE c.estado <> 'anulado'), 0)          AS saldo_total,
       coalesce(sum(c.saldo) FILTER (WHERE c.estado = 'vencido'), 0)           AS saldo_vencido,
       min(c.fecha_vence) FILTER (WHERE c.estado = 'vencido')                  AS vencido_desde,
       coalesce(sf.monto, 0)                                                   AS saldo_favor,
       CASE WHEN bool_or(c.estado = 'vencido') THEN 'moroso' ELSE 'al_dia' END AS condicion
FROM public.unidades u
LEFT JOIN public.cargos c        ON c.unidad_id = u.id AND c.saldo > 0
LEFT JOIN public.saldos_favor sf ON sf.unidad_id = u.id
GROUP BY u.condominio_id, u.id, u.codigo, sf.monto;

CREATE OR REPLACE VIEW public.v_antiguedad_saldos WITH (security_invoker = true) AS
SELECT c.condominio_id, c.unidad_id,
       sum(c.saldo) FILTER (WHERE current_date - c.fecha_vence <= 0)              AS corriente,
       sum(c.saldo) FILTER (WHERE current_date - c.fecha_vence BETWEEN 1 AND 30)  AS d1_30,
       sum(c.saldo) FILTER (WHERE current_date - c.fecha_vence BETWEEN 31 AND 60) AS d31_60,
       sum(c.saldo) FILTER (WHERE current_date - c.fecha_vence BETWEEN 61 AND 90) AS d61_90,
       sum(c.saldo) FILTER (WHERE current_date - c.fecha_vence > 90)              AS mas_90
FROM public.cargos c WHERE c.saldo > 0 AND c.estado <> 'anulado'
GROUP BY c.condominio_id, c.unidad_id;

CREATE OR REPLACE VIEW public.v_resultado_votacion WITH (security_invoker = true) AS
SELECT v.id AS votacion_id, v.pregunta, vo.opcion,
       count(*) AS unidades, sum(vo.peso) AS peso_total,
       round(100 * sum(vo.peso) / nullif(sum(sum(vo.peso)) OVER (PARTITION BY v.id), 0), 2) AS porcentaje
FROM public.votaciones v JOIN public.votos vo ON vo.votacion_id = v.id
GROUP BY v.id, v.pregunta, vo.opcion;

-- =====================================================================
-- 14. SEGURIDAD A NIVEL DE FILA (RLS) EN TODAS LAS TABLAS
-- =====================================================================
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;
-- empresas_administradoras: sin políticas → solo el rol de servicio

-- Usuarios: cada quien ve su perfil y el de personas de sus condominios
CREATE POLICY usuarios_propio   ON usuarios FOR SELECT USING (id = auth.uid() OR comparte_condominio(id));
CREATE POLICY usuarios_editar   ON usuarios FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Condominios y membresías
CREATE POLICY condo_lectura ON condominios FOR SELECT USING (es_miembro(id));
CREATE POLICY condo_admin   ON condominios FOR UPDATE USING (tiene_rol(id, '{administrador}'));
CREATE POLICY memb_admin    ON membresias  FOR ALL    USING (tiene_rol(condominio_id, '{administrador}'));
CREATE POLICY memb_propia   ON membresias  FOR SELECT USING (usuario_id = auth.uid() OR es_miembro(condominio_id));

-- Datos generales legibles por cualquier miembro
CREATE POLICY torres_lect   ON torres            FOR SELECT USING (es_miembro(condominio_id));
CREATE POLICY areas_lect    ON areas_comunes     FOR SELECT USING (es_miembro(condominio_id));
CREATE POLICY cuentas_lect  ON cuentas_bancarias FOR SELECT USING (es_miembro(condominio_id));
CREATE POLICY avisos_lect   ON avisos            FOR SELECT USING (es_miembro(condominio_id));
CREATE POLICY votac_lect    ON votaciones        FOR SELECT USING (es_miembro(condominio_id));
CREATE POLICY asamb_lect    ON asambleas         FOR SELECT USING (es_miembro(condominio_id));
CREATE POLICY docs_lect     ON documentos        FOR SELECT
  USING (es_miembro(condominio_id) AND (visible_residentes OR tiene_rol(condominio_id, '{administrador,junta,contador}')));

-- Gestión para administración
CREATE POLICY torres_admin  ON torres            FOR ALL USING (tiene_rol(condominio_id, '{administrador}'));
CREATE POLICY areas_admin   ON areas_comunes     FOR ALL USING (tiene_rol(condominio_id, '{administrador}'));
CREATE POLICY cuentas_admin ON cuentas_bancarias FOR ALL USING (tiene_rol(condominio_id, '{administrador,contador}'));
CREATE POLICY avisos_admin  ON avisos            FOR ALL USING (tiene_rol(condominio_id, '{administrador,junta}'));
CREATE POLICY votac_admin   ON votaciones        FOR ALL USING (tiene_rol(condominio_id, '{administrador}'));
CREATE POLICY asamb_admin   ON asambleas         FOR ALL USING (tiene_rol(condominio_id, '{administrador}'));
CREATE POLICY docs_admin    ON documentos        FOR ALL USING (tiene_rol(condominio_id, '{administrador,junta}'));
CREATE POLICY planes_lect   ON planes_cuota      FOR SELECT USING (es_miembro(condominio_id));
CREATE POLICY planes_admin  ON planes_cuota      FOR ALL USING (tiene_rol(condominio_id, '{administrador,contador,junta}'));
CREATE POLICY categ_lect    ON categorias_gasto  FOR SELECT USING (es_miembro(condominio_id));
CREATE POLICY categ_admin   ON categorias_gasto  FOR ALL USING (tiene_rol(condominio_id, '{administrador,contador,junta}'));
CREATE POLICY presup_lect   ON presupuestos      FOR SELECT USING (es_miembro(condominio_id));
CREATE POLICY presup_admin  ON presupuestos      FOR ALL USING (tiene_rol(condominio_id, '{administrador,contador,junta}'));
CREATE POLICY plinea_lect   ON presupuesto_lineas FOR SELECT USING (EXISTS (SELECT 1 FROM presupuestos p WHERE p.id = presupuesto_id));
CREATE POLICY plinea_admin  ON presupuesto_lineas FOR ALL
  USING (EXISTS (SELECT 1 FROM presupuestos p WHERE p.id = presupuesto_id AND tiene_rol(p.condominio_id, '{administrador,contador,junta}')));
CREATE POLICY prov_admin    ON proveedores       FOR ALL USING (tiene_rol(condominio_id, '{administrador,contador,junta}'));
CREATE POLICY gastos_admin  ON gastos            FOR ALL USING (tiene_rol(condominio_id, '{administrador,contador,junta}'));
CREATE POLICY gastos_resid  ON gastos            FOR SELECT USING (es_miembro(condominio_id) AND estado IN ('aprobado','pagado'));
CREATE POLICY mprev_admin   ON mantenimiento_preventivo FOR ALL USING (tiene_rol(condominio_id, '{administrador,mantenimiento}'));
CREATE POLICY audit_admin   ON auditoria         FOR SELECT USING (tiene_rol(condominio_id, '{administrador,junta,contador}'));

-- Unidades y sus personas
CREATE POLICY unid_staff  ON unidades FOR SELECT
  USING (tiene_rol(condominio_id, '{administrador,junta,contador,seguridad,mantenimiento}'));
CREATE POLICY unid_propia ON unidades FOR SELECT USING (id IN (SELECT mis_unidades()));
CREATE POLICY unid_admin  ON unidades FOR ALL USING (tiene_rol(condominio_id, '{administrador}'));

CREATE POLICY up_staff  ON unidad_personas FOR SELECT
  USING (tiene_rol(condo_de_unidad(unidad_id), '{administrador,junta,contador,seguridad}'));
CREATE POLICY up_admin  ON unidad_personas FOR ALL USING (tiene_rol(condo_de_unidad(unidad_id), '{administrador}'));
CREATE POLICY up_propia ON unidad_personas FOR SELECT USING (unidad_id IN (SELECT mis_unidades()));

CREATE POLICY veh_staff  ON vehiculos FOR SELECT USING (tiene_rol(condo_de_unidad(unidad_id), '{administrador,seguridad}'));
CREATE POLICY veh_admin  ON vehiculos FOR ALL USING (tiene_rol(condo_de_unidad(unidad_id), '{administrador}'));
CREATE POLICY veh_propio ON vehiculos FOR ALL USING (unidad_id IN (SELECT mis_unidades()));
CREATE POLICY mas_staff  ON mascotas  FOR SELECT USING (tiene_rol(condo_de_unidad(unidad_id), '{administrador,seguridad}'));
CREATE POLICY mas_propio ON mascotas  FOR ALL USING (unidad_id IN (SELECT mis_unidades()));

-- Finanzas por unidad
CREATE POLICY cargos_staff  ON cargos FOR ALL    USING (tiene_rol(condominio_id, '{administrador,contador}'));
CREATE POLICY cargos_junta  ON cargos FOR SELECT USING (tiene_rol(condominio_id, '{junta}'));
CREATE POLICY cargos_propio ON cargos FOR SELECT USING (unidad_id IN (SELECT mis_unidades()));
CREATE POLICY pagos_staff   ON pagos  FOR ALL    USING (tiene_rol(condominio_id, '{administrador,contador}'));
CREATE POLICY pagos_junta   ON pagos  FOR SELECT USING (tiene_rol(condominio_id, '{junta}'));
CREATE POLICY pagos_propio  ON pagos  FOR SELECT USING (unidad_id IN (SELECT mis_unidades()));
CREATE POLICY pagos_reporta ON pagos  FOR INSERT
  WITH CHECK (unidad_id IN (SELECT mis_unidades()) AND estado = 'en_revision'
              AND condominio_id = condo_de_unidad(unidad_id) AND pagado_por = auth.uid());
CREATE POLICY papl_lect     ON pago_aplicaciones FOR SELECT USING (EXISTS (SELECT 1 FROM pagos p WHERE p.id = pago_id));
CREATE POLICY sfavor_lect   ON saldos_favor FOR SELECT
  USING (unidad_id IN (SELECT mis_unidades()) OR tiene_rol(condo_de_unidad(unidad_id), '{administrador,contador,junta}'));

-- Reservas
CREATE POLICY reser_lect   ON reservas FOR SELECT USING (es_miembro(condominio_id));
CREATE POLICY reser_crear  ON reservas FOR INSERT
  WITH CHECK (unidad_id IN (SELECT mis_unidades()) AND usuario_id = auth.uid() AND condominio_id = condo_de_unidad(unidad_id));
CREATE POLICY reser_propia ON reservas FOR UPDATE USING (usuario_id = auth.uid());
CREATE POLICY reser_admin  ON reservas FOR ALL USING (tiene_rol(condominio_id, '{administrador}'));

-- Accesos, paquetería y bitácora
CREATE POLICY acc_seg    ON accesos FOR ALL USING (tiene_rol(condominio_id, '{administrador,seguridad}'));
CREATE POLICY acc_propio ON accesos FOR ALL USING (unidad_id IN (SELECT mis_unidades()))
  WITH CHECK (unidad_id IN (SELECT mis_unidades()) AND condominio_id = condo_de_unidad(unidad_id));
CREATE POLICY paq_seg    ON paqueteria FOR ALL USING (tiene_rol(condominio_id, '{administrador,seguridad}'));
CREATE POLICY paq_propio ON paqueteria FOR SELECT USING (unidad_id IN (SELECT mis_unidades()));
CREATE POLICY bit_seg    ON bitacora_seguridad FOR ALL USING (tiene_rol(condominio_id, '{administrador,seguridad,junta}'));

-- Solicitudes (tiquetes)
CREATE POLICY tick_staff   ON tickets FOR ALL USING (tiene_rol(condominio_id, '{administrador,mantenimiento}'));
CREATE POLICY tick_propio  ON tickets FOR SELECT USING (reportado_por = auth.uid());
CREATE POLICY tick_publico ON tickets FOR SELECT USING (es_miembro(condominio_id) AND NOT es_privado AND area_id IS NOT NULL);
CREATE POLICY tick_crear   ON tickets FOR INSERT WITH CHECK (es_miembro(condominio_id) AND reportado_por = auth.uid());
CREATE POLICY tcom_staff   ON ticket_comentarios FOR ALL
  USING (EXISTS (SELECT 1 FROM tickets t WHERE t.id = ticket_id AND tiene_rol(t.condominio_id, '{administrador,mantenimiento}')));
CREATE POLICY tcom_propio  ON ticket_comentarios FOR SELECT
  USING (NOT interno AND EXISTS (SELECT 1 FROM tickets t WHERE t.id = ticket_id AND t.reportado_por = auth.uid()));
CREATE POLICY tcom_crear   ON ticket_comentarios FOR INSERT
  WITH CHECK (usuario_id = auth.uid() AND NOT interno
              AND EXISTS (SELECT 1 FROM tickets t WHERE t.id = ticket_id AND t.reportado_por = auth.uid()));

-- Comunicación
CREATE POLICY lect_propia  ON aviso_lecturas    FOR ALL USING (usuario_id = auth.uid());
CREATE POLICY notif_propia ON notificaciones    FOR ALL USING (usuario_id = auth.uid());
CREATE POLICY push_propio  ON dispositivos_push FOR ALL USING (usuario_id = auth.uid());

-- Asambleas y votos
CREATE POLICY asist_lect  ON asistencia_asamblea FOR SELECT
  USING (EXISTS (SELECT 1 FROM asambleas a WHERE a.id = asamblea_id AND es_miembro(a.condominio_id)));
CREATE POLICY asist_admin ON asistencia_asamblea FOR ALL
  USING (EXISTS (SELECT 1 FROM asambleas a WHERE a.id = asamblea_id AND tiene_rol(a.condominio_id, '{administrador}')));
CREATE POLICY votos_lect  ON votos FOR SELECT
  USING (EXISTS (SELECT 1 FROM votaciones v WHERE v.id = votacion_id AND es_miembro(v.condominio_id)));
CREATE POLICY votos_emitir ON votos FOR INSERT WITH CHECK (usuario_id = auth.uid());

-- =====================================================================
-- 15. ARCHIVOS (Supabase Storage): comprobantes de pago
--     Ruta: <condominio_id>/<unidad_id>/<archivo>
-- =====================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'storage') THEN
    INSERT INTO storage.buckets (id, name, public) VALUES ('comprobantes', 'comprobantes', false)
    ON CONFLICT (id) DO NOTHING;

    EXECUTE $p$
      CREATE POLICY comprobantes_subir ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'comprobantes'
                  AND ((storage.foldername(name))[2])::uuid IN (SELECT public.mis_unidades()))
    $p$;
    EXECUTE $p$
      CREATE POLICY comprobantes_ver ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'comprobantes'
             AND (((storage.foldername(name))[2])::uuid IN (SELECT public.mis_unidades())
                  OR public.tiene_rol(((storage.foldername(name))[1])::uuid, '{administrador,contador,junta}')))
    $p$;
  END IF;
END $$;
