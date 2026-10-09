"use server";

import { revalidatePath } from "next/cache";
import { contextoAdmin } from "@/lib/contexto";
import { volverCon } from "@/lib/redirigir";
import { dic } from "@/lib/i18n";

const RUTA = "/admin/ajustes";

export async function guardarCondominio(formData: FormData) {
  const [ctx, t] = await Promise.all([contextoAdmin(), dic()]);
  const { error } = await ctx.supabase
    .from("condominios")
    .update({
      nombre: String(formData.get("nombre") ?? "").trim(),
      cedula_juridica: String(formData.get("cedula_juridica") ?? "").trim() || null,
      direccion: String(formData.get("direccion") ?? "").trim() || null,
      dia_vencimiento: Number(formData.get("dia_vencimiento") ?? 10),
      dias_gracia: Number(formData.get("dias_gracia") ?? 0),
      tasa_mora_mensual: Number(formData.get("tasa_mora_mensual") ?? 0),
    })
    .eq("id", ctx.condominioId);
  if (error) return volverCon(RUTA, "error", error);
  revalidatePath("/", "layout");
  return volverCon(RUTA, "ok", t.ajustes.okDatos);
}

export async function agregarCuenta(formData: FormData) {
  const [ctx, t] = await Promise.all([contextoAdmin(), dic()]);
  const { error } = await ctx.supabase.from("cuentas_bancarias").insert({
    condominio_id: ctx.condominioId,
    banco: String(formData.get("banco") ?? "").trim(),
    iban: String(formData.get("iban") ?? "").replace(/\s+/g, "").toUpperCase(),
    moneda: String(formData.get("moneda") ?? "CRC"),
    sinpe_movil: String(formData.get("sinpe_movil") ?? "").trim() || null,
    titular: String(formData.get("titular") ?? "").trim(),
  });
  if (error) return volverCon(RUTA, "error", error);
  revalidatePath(RUTA);
  return volverCon(RUTA, "ok", t.ajustes.okCuenta);
}

export async function desactivarCuenta(formData: FormData) {
  const [ctx, t] = await Promise.all([contextoAdmin(), dic()]);
  const { error } = await ctx.supabase
    .from("cuentas_bancarias")
    .update({ activa: false })
    .eq("id", String(formData.get("id") ?? ""))
    .eq("condominio_id", ctx.condominioId);
  if (error) return volverCon(RUTA, "error", error);
  revalidatePath(RUTA);
  return volverCon(RUTA, "ok", t.ajustes.okCuentaQuitada);
}
