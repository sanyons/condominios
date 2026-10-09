import { redirect } from "next/navigation";
import { mensajeError } from "@/lib/formato";
import { dic } from "@/lib/i18n";

/** Redirige a `ruta` con un mensaje de éxito o error (traducido) en la URL. */
export async function volverCon(ruta: string, tipo: "ok" | "error", mensaje: unknown): Promise<never> {
  const texto = tipo === "error" ? mensajeError(mensaje, await dic()) : String(mensaje);
  const sep = ruta.includes("?") ? "&" : "?";
  redirect(`${ruta}${sep}${tipo}=${encodeURIComponent(texto)}`);
}
