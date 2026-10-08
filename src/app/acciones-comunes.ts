"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { volverCon } from "@/lib/redirigir";

export async function elegirCondominio(formData: FormData) {
  const id = String(formData.get("condominio_id") ?? "");
  (await cookies()).set("condo_id", id, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  redirect("/");
}

export async function crearCondominio(formData: FormData) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crear_condominio", {
    p_nombre: String(formData.get("nombre") ?? ""),
    p_provincia: String(formData.get("provincia") ?? "") || null,
    p_canton: String(formData.get("canton") ?? "") || null,
    p_moneda: String(formData.get("moneda") ?? "CRC"),
    p_dia_vencimiento: Number(formData.get("dia_vencimiento") ?? 10),
    p_tasa_mora: Number(formData.get("tasa_mora") ?? 2),
  });
  if (error) volverCon("/onboarding", "error", error);
  (await cookies()).set("condo_id", String(data), { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  volverCon("/admin/unidades", "ok", "Condominio creado. Ahora agregue las unidades.");
}
