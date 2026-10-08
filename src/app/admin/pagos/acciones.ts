"use server";

import { revalidatePath } from "next/cache";
import { contextoAdmin } from "@/lib/contexto";
import { volverCon } from "@/lib/redirigir";

const RUTA = "/admin/pagos";

export async function aprobarPago(formData: FormData) {
  const ctx = await contextoAdmin();
  const { error } = await ctx.supabase.rpc("aplicar_pago", { p_pago: String(formData.get("pago_id") ?? "") });
  if (error) volverCon(RUTA, "error", error);
  revalidatePath("/admin", "layout");
  volverCon(RUTA, "ok", "Pago aprobado y aplicado al estado de cuenta.");
}

export async function rechazarPago(formData: FormData) {
  const ctx = await contextoAdmin();
  const motivo = String(formData.get("motivo") ?? "").trim() || "Comprobante no válido";
  const { error } = await ctx.supabase.rpc("rechazar_pago", { p_pago: String(formData.get("pago_id") ?? ""), p_motivo: motivo });
  if (error) volverCon(RUTA, "error", error);
  revalidatePath("/admin", "layout");
  volverCon(RUTA, "ok", "Pago rechazado. El residente verá el motivo.");
}

/** Pago recibido directamente por la administración (efectivo, depósito…). Se aplica de inmediato. */
export async function registrarPago(formData: FormData) {
  const ctx = await contextoAdmin();
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
  if (error) volverCon(RUTA, "error", error);
  const { error: e2 } = await ctx.supabase.rpc("aplicar_pago", { p_pago: data.id });
  if (e2) volverCon(RUTA, "error", e2);
  revalidatePath("/admin", "layout");
  volverCon(RUTA, "ok", "Pago registrado y aplicado.");
}
