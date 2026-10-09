"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { volverCon } from "@/lib/redirigir";
import { origen } from "@/lib/origen";
import { dic } from "@/lib/i18n";

export async function iniciarSesion(formData: FormData) {
  const t = await dic();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return volverCon("/login", "error", t.auth.errCredenciales);
  redirect("/");
}

export async function registrarse(formData: FormData) {
  const t = await dic();
  const nombre = String(formData.get("nombre") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return volverCon("/registro", "error", t.auth.errClaveCorta);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nombre }, emailRedirectTo: `${await origen()}/auth/confirm?next=/onboarding` },
  });
  if (error) return volverCon("/registro", "error", error);
  // Con confirmación de correo activa no hay sesión todavía
  if (!data.session) return volverCon("/login", "ok", t.auth.okConfirmar);
  redirect("/onboarding");
}

export async function enviarEnlaceRecuperacion(formData: FormData) {
  const t = await dic();
  const email = String(formData.get("email") ?? "").trim();
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await origen()}/auth/confirm?next=/cuenta/clave`,
  });
  return volverCon("/login", "ok", t.auth.okRecuperacion);
}

export async function cambiarClave(formData: FormData) {
  const t = await dic();
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return volverCon("/cuenta/clave", "error", t.auth.errClaveCorta);
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return volverCon("/cuenta/clave", "error", error);
  return volverCon("/", "ok", t.auth.okClave);
}

export async function cerrarSesion() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
