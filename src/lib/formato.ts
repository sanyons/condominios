export function dinero(monto: number | string | null | undefined, moneda: string = "CRC") {
  const n = Number(monto ?? 0);
  return new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency: moneda,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

export function fecha(valor: string | Date | null | undefined) {
  if (!valor) return "—";
  const d = typeof valor === "string" && valor.length === 10 ? new Date(valor + "T12:00:00") : new Date(valor);
  return new Intl.DateTimeFormat("es-CR", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Costa_Rica" }).format(d);
}

export function mesActual() {
  const ahora = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Costa_Rica" }));
  return `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}`;
}

export const ETIQUETA_METODO: Record<string, string> = {
  sinpe_movil: "SINPE Móvil",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
  efectivo: "Efectivo",
  deposito: "Depósito",
};

export const ETIQUETA_ESTADO_CARGO: Record<string, string> = {
  pendiente: "Pendiente",
  parcial: "Parcial",
  pagado: "Pagado",
  vencido: "Vencido",
  anulado: "Anulado",
};

/** Mensaje legible a partir de un error de Supabase/Postgres. */
export function mensajeError(e: unknown) {
  const msg = (e as { message?: string })?.message ?? String(e);
  if (msg.includes("duplicate key")) return "Ya existe un registro con esos datos.";
  if (msg.includes("row-level security")) return "No tiene permiso para esta acción.";
  return msg;
}
