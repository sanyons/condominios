import { redirect } from "next/navigation";
import { mensajeError } from "@/lib/formato";

/** Redirige a `ruta` con un mensaje de éxito o error en la URL. */
export function volverCon(ruta: string, tipo: "ok" | "error", mensaje: unknown): never {
  const texto = tipo === "error" ? mensajeError(mensaje) : String(mensaje);
  const sep = ruta.includes("?") ? "&" : "?";
  redirect(`${ruta}${sep}${tipo}=${encodeURIComponent(texto)}`);
}
