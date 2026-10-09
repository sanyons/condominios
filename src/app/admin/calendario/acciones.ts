"use server";

import { revalidatePath } from "next/cache";
import { contextoAdmin } from "@/lib/contexto";
import { volverCon } from "@/lib/redirigir";
import { dic } from "@/lib/i18n";
import { isoCR } from "@/lib/fechas";

const RUTA = "/admin/calendario";
const CATEGORIAS = ["general", "asamblea", "mantenimiento", "social", "pagos", "servicios"];

function texto(v: FormDataEntryValue | null) {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}

export async function guardarEvento(formData: FormData) {
  const [ctx, t] = await Promise.all([contextoAdmin(), dic()]);
  const id = texto(formData.get("id"));
  const titulo = texto(formData.get("titulo"));
  const fecha = texto(formData.get("fecha"));
  const volver = `${RUTA}${fecha ? `?mes=${fecha.slice(0, 7)}` : ""}`;
  if (!titulo || !fecha) return volverCon(volver, "error", t.calendario.errDatos);

  const horaInicio = texto(formData.get("hora_inicio"));
  const todoElDia = formData.get("todo_el_dia") === "on" || !horaInicio;
  const fechaFin = texto(formData.get("fecha_fin"));
  const horaFin = texto(formData.get("hora_fin"));

  const inicio = isoCR(fecha, todoElDia ? "00:00" : horaInicio!);
  let fin: string | null = null;
  if (todoElDia && fechaFin && fechaFin !== fecha) fin = isoCR(fechaFin, "00:00");
  if (!todoElDia && (horaFin || fechaFin)) fin = isoCR(fechaFin ?? fecha, horaFin ?? horaInicio!);
  if (fin && new Date(fin) < new Date(inicio)) return volverCon(volver, "error", t.calendario.errFin);

  const categoria = String(formData.get("categoria") ?? "general");
  const datos = {
    titulo: titulo.slice(0, 160),
    descripcion: texto(formData.get("descripcion")),
    ubicacion: texto(formData.get("ubicacion")),
    categoria: CATEGORIAS.includes(categoria) ? categoria : "general",
    inicio,
    fin,
    todo_el_dia: todoElDia,
  };

  const { error } = id
    ? await ctx.supabase.from("eventos").update(datos).eq("id", id).eq("condominio_id", ctx.condominioId)
    : await ctx.supabase.from("eventos").insert({ ...datos, condominio_id: ctx.condominioId });
  if (error) return volverCon(volver, "error", error);
  revalidatePath(RUTA);
  return volverCon(volver, "ok", id ? t.calendario.okGuardado : t.calendario.okCreado);
}

export async function eliminarEvento(formData: FormData) {
  const [ctx, t] = await Promise.all([contextoAdmin(), dic()]);
  const { error } = await ctx.supabase
    .from("eventos")
    .delete()
    .eq("id", String(formData.get("id") ?? ""))
    .eq("condominio_id", ctx.condominioId);
  if (error) return volverCon(RUTA, "error", error);
  revalidatePath(RUTA);
  return volverCon(RUTA, "ok", t.calendario.okEliminado);
}
