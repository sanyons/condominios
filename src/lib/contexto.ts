import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Rol =
  | "super_admin"
  | "administrador"
  | "junta"
  | "contador"
  | "residente"
  | "seguridad"
  | "mantenimiento";

export const ROLES_ADMIN: Rol[] = ["administrador", "contador", "junta"];

export type Membresia = { condominio_id: string; rol: Rol; nombre: string };

/** Usuario, sus membresías y el condominio activo (cookie `condo_id`). */
export async function obtenerContexto() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: perfil }, { data: filas }] = await Promise.all([
    supabase.from("usuarios").select("id, nombre, apellidos, email").eq("id", user.id).maybeSingle(),
    supabase
      .from("membresias")
      .select("condominio_id, rol, condominios(nombre)")
      .eq("usuario_id", user.id)
      .eq("activo", true),
  ]);

  const membresias: Membresia[] = (filas ?? []).map((m: any) => ({
    condominio_id: m.condominio_id,
    rol: m.rol,
    nombre: Array.isArray(m.condominios) ? m.condominios[0]?.nombre : m.condominios?.nombre,
  }));

  const elegido = (await cookies()).get("condo_id")?.value;
  const condominioId =
    membresias.find((m) => m.condominio_id === elegido)?.condominio_id ?? membresias[0]?.condominio_id ?? null;

  const roles = membresias.filter((m) => m.condominio_id === condominioId).map((m) => m.rol);
  const condominios = Array.from(new Map(membresias.map((m) => [m.condominio_id, m.nombre])).entries()).map(
    ([id, nombre]) => ({ id, nombre })
  );

  const condominiosAdmin = new Set(
    membresias.filter((m) => ROLES_ADMIN.includes(m.rol) || m.rol === "super_admin").map((m) => m.condominio_id)
  ).size;

  return {
    supabase,
    user,
    perfil,
    condominiosAdmin,
    condominioId,
    condominioNombre: condominios.find((c) => c.id === condominioId)?.nombre ?? "",
    condominios,
    roles,
    esAdmin: roles.some((r) => ROLES_ADMIN.includes(r)),
    puedeEditar: roles.includes("administrador") || roles.includes("contador"),
    esResidente: roles.includes("residente"),
  };
}

/** Exige rol de administración en el condominio activo. */
export async function contextoAdmin() {
  const ctx = await obtenerContexto();
  if (!ctx.condominioId) redirect("/onboarding");
  if (!ctx.esAdmin) redirect("/residente");
  return ctx as typeof ctx & { condominioId: string };
}

/** Exige que el usuario tenga al menos una unidad en el condominio activo. */
export async function contextoResidente() {
  const ctx = await obtenerContexto();
  if (!ctx.condominioId) redirect("/onboarding");
  const { data: unidades } = await ctx.supabase
    .from("unidad_personas")
    .select("unidad_id, relacion, unidades!inner(id, codigo, condominio_id)")
    .eq("usuario_id", ctx.user.id)
    .eq("unidades.condominio_id", ctx.condominioId);
  const lista = (unidades ?? []).map((u: any) => ({
    id: u.unidades.id as string,
    codigo: u.unidades.codigo as string,
    relacion: u.relacion as string,
  }));
  return { ...ctx, condominioId: ctx.condominioId as string, unidades: lista };
}
