"use server";

import { revalidatePath } from "next/cache";
import { contextoAdmin } from "@/lib/contexto";
import { volverCon } from "@/lib/redirigir";
import { mensajeError } from "@/lib/formato";
import { dic } from "@/lib/i18n";

const RUTA = "/admin/documentos";

function texto(v: FormDataEntryValue | null) {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}

export type ResultadoArchivo = { ok?: string; error?: string };

/**
 * Registra un archivo que el navegador ya subió a Storage (bucket "documentos").
 * Con `id` reemplaza el archivo de un documento existente y borra el anterior.
 */
export async function registrarArchivo(datos: {
  id?: string;
  ruta: string;
  archivoNombre: string;
  tamano: number;
  tipo: string;
  nombre?: string;
  carpeta?: string;
  descripcion?: string;
  visible?: boolean;
}): Promise<ResultadoArchivo> {
  const [ctx, t] = await Promise.all([contextoAdmin(), dic()]);
  const d = t.documentos;
  // Solo rutas dentro de la carpeta del condominio activo
  if (!datos.ruta.startsWith(`${ctx.condominioId}/`) || datos.ruta.includes("..")) return { error: d.errRuta };

  const archivo = {
    archivo_url: datos.ruta,
    archivo_nombre: datos.archivoNombre.slice(0, 200),
    tamano_bytes: Math.round(datos.tamano),
    tipo_mime: datos.tipo.slice(0, 120),
    actualizado_en: new Date().toISOString(),
  };

  if (datos.id) {
    const { data: previo } = await ctx.supabase
      .from("documentos")
      .select("archivo_url")
      .eq("id", datos.id)
      .eq("condominio_id", ctx.condominioId)
      .maybeSingle();
    const { error } = await ctx.supabase.from("documentos").update(archivo).eq("id", datos.id).eq("condominio_id", ctx.condominioId);
    if (error || !previo) {
      await ctx.supabase.storage.from("documentos").remove([datos.ruta]);
      return { error: error ? mensajeError(error, t) : d.errRuta };
    }
    if (previo.archivo_url !== datos.ruta) await ctx.supabase.storage.from("documentos").remove([previo.archivo_url]);
    revalidatePath(RUTA);
    return { ok: d.okReemplazado };
  }

  const nombre = (datos.nombre ?? "").trim() || datos.archivoNombre.replace(/\.[^.]+$/, "");
  const { error } = await ctx.supabase.from("documentos").insert({
    ...archivo,
    condominio_id: ctx.condominioId,
    nombre: nombre.slice(0, 160),
    carpeta: (datos.carpeta ?? "").trim().slice(0, 60) || "General",
    descripcion: (datos.descripcion ?? "").trim() || null,
    visible_residentes: datos.visible ?? true,
    subido_por: ctx.user.id,
  });
  if (error) {
    await ctx.supabase.storage.from("documentos").remove([datos.ruta]);
    return { error: mensajeError(error, t) };
  }
  revalidatePath(RUTA);
  return { ok: d.okSubido };
}

export async function guardarDocumento(formData: FormData) {
  const [ctx, t] = await Promise.all([contextoAdmin(), dic()]);
  const id = String(formData.get("id") ?? "");
  const nombre = texto(formData.get("nombre"));
  if (!nombre) return volverCon(RUTA, "error", t.documentos.errSinArchivo);
  const { error } = await ctx.supabase
    .from("documentos")
    .update({
      nombre: nombre.slice(0, 160),
      carpeta: (texto(formData.get("carpeta")) ?? "General").slice(0, 60),
      descripcion: texto(formData.get("descripcion")),
      visible_residentes: formData.get("visible") === "on",
      actualizado_en: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("condominio_id", ctx.condominioId);
  if (error) return volverCon(RUTA, "error", error);
  revalidatePath(RUTA);
  return volverCon(RUTA, "ok", t.documentos.okGuardado);
}

export async function cambiarVisibilidad(formData: FormData) {
  const [ctx, t] = await Promise.all([contextoAdmin(), dic()]);
  const visible = formData.get("visible") === "1";
  const { error } = await ctx.supabase
    .from("documentos")
    .update({ visible_residentes: visible })
    .eq("id", String(formData.get("id") ?? ""))
    .eq("condominio_id", ctx.condominioId);
  if (error) return volverCon(RUTA, "error", error);
  revalidatePath(RUTA);
  return volverCon(RUTA, "ok", visible ? t.documentos.okPublicado : t.documentos.okOculto);
}

export async function eliminarDocumento(formData: FormData) {
  const [ctx, t] = await Promise.all([contextoAdmin(), dic()]);
  const id = String(formData.get("id") ?? "");
  const { data: doc } = await ctx.supabase
    .from("documentos")
    .select("archivo_url")
    .eq("id", id)
    .eq("condominio_id", ctx.condominioId)
    .maybeSingle();
  const { error } = await ctx.supabase.from("documentos").delete().eq("id", id).eq("condominio_id", ctx.condominioId);
  if (error) return volverCon(RUTA, "error", error);
  if (doc?.archivo_url) await ctx.supabase.storage.from("documentos").remove([doc.archivo_url]);
  revalidatePath(RUTA);
  return volverCon(RUTA, "ok", t.documentos.okEliminado);
}
