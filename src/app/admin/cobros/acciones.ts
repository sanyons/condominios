"use server";

import { revalidatePath } from "next/cache";
import { contextoAdmin } from "@/lib/contexto";
import { volverCon } from "@/lib/redirigir";
import { dic } from "@/lib/i18n";

const RUTA = "/admin/cobros";

export async function crearPlan(formData: FormData) {
  const [ctx, t] = await Promise.all([contextoAdmin(), dic()]);
  const metodo = String(formData.get("metodo") ?? "coeficiente");
  const monto = Number(formData.get("monto") ?? 0);
  if (!(monto > 0)) return volverCon(RUTA, "error", t.cobros.errMonto);
  const { error } = await ctx.supabase.from("planes_cuota").insert({
    condominio_id: ctx.condominioId,
    nombre: String(formData.get("nombre") ?? "").trim(),
    tipo: String(formData.get("tipo") ?? "cuota_ordinaria"),
    metodo,
    monto_total: metodo === "fija" ? null : monto,
    monto_unidad: metodo === "fija" ? monto : null,
    moneda: String(formData.get("moneda") ?? "CRC"),
    periodicidad: String(formData.get("periodicidad") ?? "mensual"),
    vigente_desde: String(formData.get("vigente_desde") ?? new Date().toISOString().slice(0, 10)),
  });
  if (error) return volverCon(RUTA, "error", error);
  revalidatePath(RUTA);
  return volverCon(RUTA, "ok", t.cobros.okPlan);
}

export async function generarCuotas(formData: FormData) {
  const [ctx, t] = await Promise.all([contextoAdmin(), dic()]);
  const plan = String(formData.get("plan_id") ?? "");
  const mes = String(formData.get("mes") ?? ""); // AAAA-MM
  const { data, error } = await ctx.supabase.rpc("generar_cuotas", { p_plan: plan, p_periodo: `${mes}-01` });
  if (error) return volverCon(RUTA, "error", error);
  revalidatePath("/admin", "layout");
  return volverCon(RUTA, "ok", data === 0 ? t.cobros.okYaGeneradas : t.cobros.okGeneradas(Number(data), mes));
}

export async function crearCargo(formData: FormData) {
  const [ctx, t] = await Promise.all([contextoAdmin(), dic()]);
  const monto = Number(formData.get("monto") ?? 0);
  const { error } = await ctx.supabase.from("cargos").insert({
    condominio_id: ctx.condominioId,
    unidad_id: String(formData.get("unidad_id") ?? ""),
    tipo: String(formData.get("tipo") ?? "multa"),
    concepto: String(formData.get("concepto") ?? "").trim(),
    monto,
    saldo: monto,
    moneda: String(formData.get("moneda") ?? "CRC"),
    fecha_vence: String(formData.get("fecha_vence") ?? ""),
    creado_por: ctx.user.id,
  });
  if (error) return volverCon(RUTA, "error", error);
  revalidatePath("/admin", "layout");
  return volverCon(RUTA, "ok", t.cobros.okCargo);
}

export async function procesarMora() {
  const [ctx, t] = await Promise.all([contextoAdmin(), dic()]);
  const { data, error } = await ctx.supabase.rpc("procesar_morosidad", { p_condo: ctx.condominioId });
  if (error) return volverCon(RUTA, "error", error);
  revalidatePath("/admin", "layout");
  return volverCon(RUTA, "ok", t.cobros.okMora(Number(data)));
}
