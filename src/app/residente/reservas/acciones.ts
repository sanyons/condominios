"use server";

import { revalidatePath } from "next/cache";
import { contextoResidente } from "@/lib/contexto";
import { volverCon } from "@/lib/redirigir";
import { dic } from "@/lib/i18n";
import { isoCR } from "@/lib/fechas";

const RUTA = "/residente/reservas";

export async function reservar(formData: FormData) {
  const [ctx, t] = await Promise.all([contextoResidente(), dic()]);
  const areaId = String(formData.get("area_id") ?? "");
  const fecha = String(formData.get("fecha") ?? "");
  const desde = String(formData.get("desde") ?? "");
  const hasta = String(formData.get("hasta") ?? "");
  const unidadId = String(formData.get("unidad_id") ?? ctx.unidades[0]?.id ?? "");
  const volver = `${RUTA}?area=${encodeURIComponent(areaId)}&fecha=${encodeURIComponent(fecha)}`;

  if (!areaId || !fecha || !desde || !hasta) return volverCon(volver, "error", t.amenidades.errDatos);
  if (hasta <= desde) return volverCon(volver, "error", t.amenidades.errHoras);
  if (!ctx.unidades.some((u) => u.id === unidadId)) return volverCon(volver, "error", t.pagar.errUnidad);

  const { data, error } = await ctx.supabase
    .from("reservas")
    .insert({
      condominio_id: ctx.condominioId,
      area_id: areaId,
      unidad_id: unidadId,
      usuario_id: ctx.user.id,
      inicio: isoCR(fecha, desde),
      fin: isoCR(fecha, hasta),
      invitados: Math.max(0, Number(formData.get("invitados") ?? 0) || 0),
      notas: String(formData.get("notas") ?? "").trim() || null,
    })
    .select("estado")
    .single();
  if (error) return volverCon(volver, "error", error);
  revalidatePath("/residente", "layout");
  return volverCon(RUTA, "ok", data?.estado === "confirmada" ? t.reservar.okConfirmada : t.reservar.okSolicitada);
}

export async function cancelarReserva(formData: FormData) {
  const [ctx, t] = await Promise.all([contextoResidente(), dic()]);
  const { error } = await ctx.supabase.rpc("cancelar_reserva", { p_reserva: String(formData.get("id") ?? "") });
  if (error) return volverCon(RUTA, "error", error);
  revalidatePath("/residente", "layout");
  return volverCon(RUTA, "ok", t.amenidades.okCancelada);
}
