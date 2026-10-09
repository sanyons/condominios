import { cookies, headers } from "next/headers";
import { es, type Dict } from "./es";
import { en } from "./en";

export type { Dict };
export type Idioma = "es" | "en";
export type Tema = "sistema" | "claro" | "oscuro";

/** Idioma elegido (cookie `idioma`); si no hay, el del navegador; por defecto español. */
export async function idioma(): Promise<Idioma> {
  const elegido = (await cookies()).get("idioma")?.value;
  if (elegido === "es" || elegido === "en") return elegido;
  const navegador = (await headers()).get("accept-language") ?? "";
  return /^en\b/i.test(navegador) ? "en" : "es";
}

/** Diccionario de textos del idioma actual. */
export async function dic(): Promise<Dict> {
  return (await idioma()) === "en" ? en : es;
}

/** Tema elegido (cookie `tema`); "sistema" sigue la configuración del dispositivo. */
export async function tema(): Promise<Tema> {
  const t = (await cookies()).get("tema")?.value;
  return t === "claro" || t === "oscuro" ? t : "sistema";
}
