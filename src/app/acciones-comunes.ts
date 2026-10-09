"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { volverCon } from "@/lib/redirigir";
import { dic } from "@/lib/i18n";

const UN_ANIO = 60 * 60 * 24 * 365;

/** Vuelve a la página desde la que se hizo la acción (solo rutas internas). */
async function regresar(): Promise<never> {
  const ref = (await headers()).get("referer");
  let destino = "/";
  try {
    if (ref) {
      const u = new URL(ref);
      u.searchParams.delete("ok");
      u.searchParams.delete("error");
      destino = u.pathname + (u.search || "");
    }
  } catch {
    destino = "/";
  }
  redirect(destino.startsWith("/") && !destino.startsWith("//") ? destino : "/");
}

/** Ruta interna segura (evita redirecciones a otros sitios). */
function rutaInterna(valor: unknown, porDefecto: string) {
  const r = String(valor ?? "");
  return r.startsWith("/") && !r.startsWith("//") ? r : porDefecto;
}

export async function elegirCondominio(formData: FormData) {
  const id = String(formData.get("condominio_id") ?? "");
  const jar = await cookies();
  jar.set("condo_id", id, { path: "/", httpOnly: true, sameSite: "lax", maxAge: UN_ANIO });
  // Últimos 5 condominios abiertos, el más reciente primero
  const previos = (jar.get("condos_recientes")?.value ?? "").split(",").filter((x) => x && x !== id);
  jar.set("condos_recientes", [id, ...previos].slice(0, 5).join(","), {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: UN_ANIO,
  });
  redirect(rutaInterna(formData.get("destino"), "/admin"));
}

export async function cambiarIdioma(formData: FormData) {
  const valor = String(formData.get("idioma") ?? "");
  if (valor === "es" || valor === "en") {
    (await cookies()).set("idioma", valor, { path: "/", sameSite: "lax", maxAge: UN_ANIO });
  }
  return regresar();
}

export async function cambiarTema(formData: FormData) {
  const valor = String(formData.get("tema") ?? "");
  const jar = await cookies();
  if (valor === "claro" || valor === "oscuro") jar.set("tema", valor, { path: "/", sameSite: "lax", maxAge: UN_ANIO });
  else jar.delete("tema");
  return regresar();
}

export async function crearCondominio(formData: FormData) {
  const t = await dic();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crear_condominio", {
    p_nombre: String(formData.get("nombre") ?? ""),
    p_provincia: String(formData.get("provincia") ?? "") || null,
    p_canton: String(formData.get("canton") ?? "") || null,
    p_moneda: String(formData.get("moneda") ?? "CRC"),
    p_dia_vencimiento: Number(formData.get("dia_vencimiento") ?? 10),
    p_tasa_mora: Number(formData.get("tasa_mora") ?? 2),
  });
  if (error) return volverCon("/onboarding", "error", error);
  (await cookies()).set("condo_id", String(data), { path: "/", httpOnly: true, sameSite: "lax", maxAge: UN_ANIO });
  return volverCon("/admin/unidades", "ok", t.onboarding.ok);
}
