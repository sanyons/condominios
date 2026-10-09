import { headers } from "next/headers";

/**
 * URL pública de la app (para enlaces en correos).
 * Usa NEXT_PUBLIC_SITE_URL si existe; si no, la dirección con la que se abrió la app.
 */
export async function origen() {
  const fija = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "");
  if (fija) return fija;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
