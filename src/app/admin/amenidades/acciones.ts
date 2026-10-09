"use server";

import { revalidatePath } from "next/cache";
import { contextoAdmin } from "@/lib/contexto";
import { volverCon } from "@/lib/redirigir";
import { dic } from "@/lib/i18n";
import { isoCR } from "@/lib/fechas";

const RUTA = "/admin/amenidades";

function numero(v: FormDataEntryValue | null, porDefecto: number | null = null) {
  const s = String(v ?? "").trim();
  if (s === "") return porDefecto;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : porDefecto;
}

function texto(v: FormDataEntryValue | null) {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}

export async function guardarArea(formData: FormData) {
  const [ctx, t] = await Promise.all([contextoAdmin(), dic()]);
  const id = texto(formData.get("id"));
  const nombre = texto(formData.get("nombre"));
  if (!nombre) return volverCon(RUTA, "error", t.amenidades.errDatos);

  const datos = {
    nombre,
    descripcion: texto(formData.get("descripcion")),
    capacidad: numero(formData.get("capacidad")),
    costo: Math.max(0, numero(formData.get("costo"), 0)!),
    deposito: Math.max(0, numero(formData.get("deposito"), 0)!),
    hora_apertura: String(formData.get("hora_apertura") || "08:00"),
    hora_cierre: String(formData.get("hora_cierre") || "22:00"),
    duracion_max_horas: Math.max(1, Math.min(24, numero(formData.get("duracion_max_horas"), 4)!)),
    reservas_max_mes: numero(formData.get("reservas_max_mes")),
    requiere_aprobacion: formData.get("requiere_aprobacion") === "on",
    bloquear_morosos: formData.get("bloquear_morosos") === "on",
    reglas: texto(formData.get("reglas")),
    activa: formData.get("activa") === "on",
  };
  if (datos.hora_cierre <= datos.hora_apertura) return volverCon(RUTA, "error", t.amenidades.errHoras);

  const { error } = id
    ? await ctx.supabase.from("areas_comunes").update(datos).eq("id", id).eq("condominio_id", ctx.condominioId)
    : await ctx.supabase.from("areas_comunes").insert({ ...datos, condominio_id: ctx.condominioId });
  if (error) return volverCon(RUTA, "error", error);
  revalidatePath(RUTA);
  return volverCon(RUTA, "ok", id ? t.amenidades.okAreaGuardada : t.amenidades.okArea);
}

export async function eliminarArea(formData: FormData) {
  const [ctx, t] = await Promise.all([contextoAdmin(), dic()]);
  const id = String(formData.get("id") ?? "");
  const { count } = await ctx.supabase.from("reservas").select("id", { count: "exact", head: true }).eq("area_id", id);
  if (count) return volverCon(RUTA, "error", t.amenidades.errAreaConReservas);
  const { error } = await ctx.supabase.from("areas_comunes").delete().eq("id", id).eq("condominio_id", ctx.condominioId);
  if (error) return volverCon(RUTA, "error", error);
  revalidatePath(RUTA);
  return volverCon(RUTA, "ok", t.amenidades.okAreaEliminada);
}

export async function responderReserva(formData: FormData) {
  const [ctx, t] = await Promise.all([contextoAdmin(), dic()]);
  const aprobar = formData.get("aprobar") === "1";
  const { error } = await ctx.supabase.rpc("responder_reserva", {
    p_reserva: String(formData.get("id") ?? ""),
    p_aprobar: aprobar,
    p_motivo: texto(formData.get("motivo")),
  });
  if (error) return volverCon(RUTA, "error", error);
  revalidatePath("/admin", "layout");
  return volverCon(RUTA, "ok", aprobar ? t.amenidades.okAprobada : t.amenidades.okRechazada);
}

export async function cancelarReservaAdmin(formData: FormData) {
  const [ctx, t] = await Promise.all([contextoAdmin(), dic()]);
  const { error } = await ctx.supabase.rpc("cancelar_reserva", {
    p_reserva: String(formData.get("id") ?? ""),
    p_motivo: texto(formData.get("motivo")),
  });
  if (error) return volverCon(RUTA, "error", error);
  revalidatePath("/admin", "layout");
  return volverCon(RUTA, "ok", t.amenidades.okCancelada);
}

export async function reservarParaUnidad(formData: FormData) {
  const [ctx, t] = await Promise.all([contextoAdmin(), dic()]);
  const fecha = String(formData.get("fecha") ?? "");
  const desde = String(formData.get("desde") ?? "");
  const hasta = String(formData.get("hasta") ?? "");
  const areaId = String(formData.get("area_id") ?? "");
  const unidadId = String(formData.get("unidad_id") ?? "");
  if (!fecha || !desde || !hasta || !areaId || !unidadId) return volverCon(RUTA, "error", t.amenidades.errDatos);
  if (hasta <= desde) return volverCon(RUTA, "error", t.amenidades.errHoras);

  const { error } = await ctx.supabase.from("reservas").insert({
    condominio_id: ctx.condominioId,
    area_id: areaId,
    unidad_id: unidadId,
    usuario_id: ctx.user.id,
    inicio: isoCR(fecha, desde),
    fin: isoCR(fecha, hasta),
    invitados: numero(formData.get("invitados"), 0),
    notas: texto(formData.get("notas")),
  });
  if (error) return volverCon(RUTA, "error", error);
  revalidatePath(RUTA);
  return volverCon(RUTA, "ok", t.amenidades.okReservada);
}
