import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { dic } from "@/lib/i18n";

/**
 * Destino de los enlaces de correo (confirmación, invitación, recuperación).
 * Plantillas de Supabase: {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=<tipo>&next=<ruta>
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";

  const supabase = await createClient();
  let ok = false;
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    ok = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  }

  const destino = request.nextUrl.clone();
  destino.search = "";
  if (ok) {
    // Invitados y recuperación: deben definir su contraseña
    destino.pathname = type === "invite" || type === "recovery" ? "/cuenta/clave" : next;
  } else {
    destino.pathname = "/login";
    destino.searchParams.set("error", (await dic()).auth.errEnlace);
  }
  return NextResponse.redirect(destino);
}
