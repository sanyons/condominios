"use server";

import { revalidatePath } from "next/cache";
import { contextoAdmin } from "@/lib/contexto";
import { createAdminClient } from "@/lib/supabase/server";
import { volverCon } from "@/lib/redirigir";
import { origen } from "@/lib/origen";

const RUTA = "/admin/unidades";

export async function crearUnidad(formData: FormData) {
  const ctx = await contextoAdmin();
  const { error } = await ctx.supabase.from("unidades").insert({
    condominio_id: ctx.condominioId,
    codigo: String(formData.get("codigo") ?? "").trim(),
    tipo: String(formData.get("tipo") ?? "apartamento"),
    finca_filial: String(formData.get("finca_filial") ?? "").trim() || null,
    coeficiente: Number(formData.get("coeficiente") || 0),
    area_m2: formData.get("area_m2") ? Number(formData.get("area_m2")) : null,
    cuota_fija: formData.get("cuota_fija") ? Number(formData.get("cuota_fija")) : null,
  });
  if (error) volverCon(RUTA, "error", error);
  revalidatePath(RUTA);
  volverCon(RUTA, "ok", "Unidad agregada.");
}

/** Importa líneas "codigo,coeficiente,area_m2" (copiadas de Excel). */
export async function importarUnidades(formData: FormData) {
  const ctx = await contextoAdmin();
  const texto = String(formData.get("lineas") ?? "");
  const filas = texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !/^c[oó]digo/i.test(l))
    .map((l) => l.split(/[,;\t]/).map((c) => c.trim()))
    .map(([codigo, coef, area]) => ({
      condominio_id: ctx.condominioId,
      codigo,
      coeficiente: Number((coef ?? "0").replace(",", ".")) || 0,
      area_m2: area ? Number(area.replace(",", ".")) : null,
    }))
    .filter((f) => f.codigo);
  if (filas.length === 0) volverCon(RUTA, "error", "No se encontraron filas válidas.");
  const { error } = await ctx.supabase.from("unidades").insert(filas);
  if (error) volverCon(RUTA, "error", error);
  revalidatePath(RUTA);
  volverCon(RUTA, "ok", `${filas.length} unidades importadas.`);
}

/** Invita a una persona por correo y la vincula a una unidad. */
export async function invitarResidente(formData: FormData) {
  const ctx = await contextoAdmin();
  if (!ctx.roles.includes("administrador")) volverCon(RUTA, "error", "Solo la administración puede invitar residentes.");

  const unidadId = String(formData.get("unidad_id") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const nombre = String(formData.get("nombre") ?? "").trim();
  const relacion = String(formData.get("relacion") ?? "propietario");
  const puedeVotar = formData.get("puede_votar") === "on";
  const responsable = formData.get("responsable_pago") === "on";

  // La unidad debe pertenecer al condominio activo (consulta con RLS del administrador)
  const { data: unidad } = await ctx.supabase
    .from("unidades")
    .select("id")
    .eq("id", unidadId)
    .eq("condominio_id", ctx.condominioId)
    .maybeSingle();
  if (!unidad) volverCon(RUTA, "error", "Unidad no encontrada.");

  const admin = createAdminClient();
  let usuarioId: string | undefined;
  const { data: existente } = await admin.from("usuarios").select("id").eq("email", email).maybeSingle();
  let invitado = false;
  let reenvioFallido = false;
  const sitio = await origen();
  const invitar = () =>
    admin.auth.admin.inviteUserByEmail(email, {
      data: { nombre },
      redirectTo: `${sitio}/auth/confirm?next=/cuenta/clave`,
    });

  if (existente) {
    usuarioId = existente.id;
    // Si nunca ha entrado (invitación anterior sin usar), se le reenvía el correo
    const { data: cuenta } = await admin.auth.admin.getUserById(existente.id);
    if (cuenta?.user && !cuenta.user.last_sign_in_at) {
      const { error } = await invitar();
      if (error) reenvioFallido = true;
      else invitado = true;
    }
  } else {
    const { data, error } = await invitar();
    if (error || !data.user) volverCon(RUTA, "error", error ?? "No se pudo enviar la invitación.");
    usuarioId = data.user.id;
    invitado = true;
  }

  const { error: e1 } = await admin.from("unidad_personas").upsert(
    { unidad_id: unidadId, usuario_id: usuarioId, relacion, puede_votar: puedeVotar, es_responsable_pago: responsable },
    { onConflict: "unidad_id,usuario_id,relacion" }
  );
  if (e1) volverCon(RUTA, "error", e1);

  const { error: e2 } = await admin
    .from("membresias")
    .upsert(
      { usuario_id: usuarioId, condominio_id: ctx.condominioId, rol: "residente", activo: true },
      { onConflict: "usuario_id,condominio_id,rol" }
    );
  if (e2) volverCon(RUTA, "error", e2);

  revalidatePath(RUTA);
  if (reenvioFallido) {
    volverCon(
      RUTA,
      "ok",
      `${email} quedó vinculado, pero no se pudo reenviar el correo. Puede entrar con "¿Olvidó su contraseña?" en la pantalla de inicio.`
    );
  }
  volverCon(RUTA, "ok", invitado ? `Invitación enviada a ${email}.` : `${email} quedó vinculado a la unidad.`);
}
