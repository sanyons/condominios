import type { Dict } from "@/lib/i18n";

export function dinero(monto: number | string | null | undefined, moneda: string = "CRC", locale = "es-CR") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: moneda,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(monto ?? 0));
}

export function fecha(valor: string | Date | null | undefined, locale = "es-CR") {
  if (!valor) return "—";
  const d = typeof valor === "string" && valor.length === 10 ? new Date(valor + "T12:00:00") : new Date(valor);
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "America/Costa_Rica",
  }).format(d);
}

/** Mes actual en Costa Rica como AAAA-MM. */
export function mesActual() {
  const ahora = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Costa_Rica" }));
  return `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}`;
}

/** Fecha de hoy en Costa Rica como AAAA-MM-DD. */
export function hoyCR() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Costa_Rica" }).format(new Date());
}

/** Formateadores ligados al idioma actual. */
export function formatos(t: Dict) {
  return {
    dinero: (monto: number | string | null | undefined, moneda?: string) => dinero(monto, moneda, t.locale),
    fecha: (valor: string | Date | null | undefined) => fecha(valor, t.locale),
  };
}

/** Mensaje legible a partir de un error de Supabase/Postgres, en el idioma actual. */
export function mensajeError(e: unknown, t?: Dict) {
  const msg = (e as { message?: string })?.message ?? String(e);
  if (msg.includes("exclusion constraint") || msg.includes("conflicting key value"))
    return t?.errores.traslape ?? "Ese horario ya está reservado. Elija otro.";
  if (msg.includes("duplicate key")) return t?.errores.duplicado ?? "Ya existe un registro con esos datos.";
  if (msg.includes("row-level security")) return t?.errores.sinPermiso ?? "No tiene permiso para esta acción.";
  return t?.errores.db[msg] ?? msg;
}
