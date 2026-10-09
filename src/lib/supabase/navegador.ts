"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Cliente en el navegador con la sesión del usuario (RLS). Se usa solo para
 * subir archivos grandes directo a Storage, sin pasar por el servidor de la app
 * (Vercel limita el tamaño de las peticiones a ~4 MB).
 */
export function clienteNavegador() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
