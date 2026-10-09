"use server";

import { revalidatePath } from "next/cache";
import { contextoAdmin } from "@/lib/contexto";
import { volverCon } from "@/lib/redirigir";
import { dic } from "@/lib/i18n";

const RUTA = "/admin/pagos";

export async function aprobarPago(formData: FormData) {
  const [ctx, t] = await Promise.all([contextoAdmin(), dic()]);
  const { error } = await ctx.supabase.rpc("aplicar_pago", { p_pago: String(formData.get("pago_id") ?? "") });
  if (error) return volverCon(RUTA, "error", error);
  revalidatePath("/admin", "layout");
  return volverCon(RUTA, "ok", t.pagos.okAprobado);
}

export async function rechazarPago(formData: FormData) {
  const [ctx, t] = await Promise.all([contextoAdmin(), dic()]);
  const motivo = String(formData.get("motivo") ?? "").trim() || t.pagos.motivoPorDefecto;
  const { error } = await ctx.supabase.rpc("rechazar_pago", { p_pago: String(formData.get("pago_id") ?? ""), p_motivo: motivo });
  if (error) return volverCon(RUTA, "error", error);
  revalidatePath("/admin", "layout");
  return volverCon(RUTA, "ok", t.pagos.okRechazado);
}

/** Pago recibido directamente por la administración (efectivo, depósito…). Se aplica de inmediato. */
export async function registrarPago(formData: FormData) {
  const [ctx, t] = await Promise.all([contextoAdmin(), dic()]);
  const { data, error } = await ctx.supabase
    .from("pagos")
    .insert({
      condominio_id: ctx.condominioId,
      unidad_id: String(formData.get("unidad_id") ?? ""),
      metodo: String(formData.get("metodo") ?? "efectivo"),
      monto: Number(formData.get("monto") ?? 0),
      moneda: String(formData.get("moneda") ?? "CRC"),
      referencia: String(formData.get("referencia") ?? "").trim() || null,
      fecha_pago: String(formData.get("fecha_pago") ?? new Date().toISOString().slice(0, 10)),
      estado: "en_revision",
    })
    .select("id")
    .single();
  if (error || !data) return volverCon(RUTA, "error", error);
  const { error: e2 } = await ctx.supabase.rpc("aplicar_pago", { p_pago: data.id });
  if (e2) return volverCon(RUTA, "error", e2);
  revalidatePath("/admin", "layout");
  return volverCon(RUTA, "ok", t.pagos.okRegistrado);
}
