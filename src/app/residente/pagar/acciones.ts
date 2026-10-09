"use server";

import { revalidatePath } from "next/cache";
import { contextoResidente } from "@/lib/contexto";
import { volverCon } from "@/lib/redirigir";
import { dic } from "@/lib/i18n";

const RUTA = "/residente/pagar";
const TIPOS = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];

export async function reportarPago(formData: FormData) {
  const [ctx, t] = await Promise.all([contextoResidente(), dic()]);
  const unidadId = String(formData.get("unidad_id") ?? "");
  if (!ctx.unidades.some((u) => u.id === unidadId)) return volverCon(RUTA, "error", t.pagar.errUnidad);

  const monto = Number(formData.get("monto") ?? 0);
  if (!(monto > 0)) return volverCon(RUTA, "error", t.pagar.errMonto);

  let ruta: string | null = null;
  const archivo = formData.get("comprobante");
  if (archivo instanceof File && archivo.size > 0) {
    if (archivo.size > 5 * 1024 * 1024) return volverCon(RUTA, "error", t.pagar.errPeso);
    if (!TIPOS.includes(archivo.type)) return volverCon(RUTA, "error", t.pagar.errTipo);
    const ext = archivo.name.split(".").pop()?.toLowerCase() || "jpg";
    ruta = `${ctx.condominioId}/${unidadId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await ctx.supabase.storage.from("comprobantes").upload(ruta, archivo, { contentType: archivo.type });
    if (error) return volverCon(RUTA, "error", t.pagar.errSubir(error.message));
  }

  const { error } = await ctx.supabase.from("pagos").insert({
    condominio_id: ctx.condominioId,
    unidad_id: unidadId,
    pagado_por: ctx.user.id,
    metodo: String(formData.get("metodo") ?? "sinpe_movil"),
    monto,
    moneda: String(formData.get("moneda") ?? "CRC"),
    referencia: String(formData.get("referencia") ?? "").trim() || null,
    fecha_pago: String(formData.get("fecha_pago") ?? new Date().toISOString().slice(0, 10)),
    comprobante_url: ruta,
    estado: "en_revision",
  });
  if (error) return volverCon(RUTA, "error", error);
  revalidatePath("/residente");
  return volverCon("/residente", "ok", t.pagar.ok);
}
