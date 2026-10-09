"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { volverCon } from "@/lib/redirigir";
import { origen } from "@/lib/origen";

export async function iniciarSesion(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) volverCon("/login", "error", "Correo o contraseña incorrectos.");
  redirect("/");
}

export async function registrarse(formData: FormData) {
  const nombre = String(formData.get("nombre") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) volverCon("/registro", "error", "La contraseña debe tener al menos 8 caracteres.");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nombre }, emailRedirectTo: `${await origen()}/auth/confirm?next=/onboarding` },
  });
  if (error) volverCon("/registro", "error", error);
  // Con confirmación de correo activa no hay sesión todavía
  if (!data.session) volverCon("/login", "ok", "Le enviamos un correo para confirmar su cuenta.");
  redirect("/onboarding");
}

export async function enviarEnlaceRecuperacion(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await origen()}/auth/confirm?next=/cuenta/clave`,
  });
  volverCon("/login", "ok", "Si el correo existe, le llegará un enlace para cambiar la contraseña.");
}

export async function cambiarClave(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) volverCon("/cuenta/clave", "error", "Use al menos 8 caracteres.");
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) volverCon("/cuenta/clave", "error", error);
  volverCon("/", "ok", "Contraseña guardada.");
}

export async function cerrarSesion() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
