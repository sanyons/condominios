import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Abre un documento: verifica el permiso al momento del clic (RLS sobre la
 * tabla y el bucket) y redirige a un enlace firmado que dura un minuto.
 * ?descargar=1 fuerza la descarga con el nombre original.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: doc } = await supabase.from("documentos").select("archivo_url, archivo_nombre, nombre").eq("id", id).maybeSingle();
  if (!doc) return new NextResponse("No encontrado", { status: 404 });

  const descargar = req.nextUrl.searchParams.get("descargar") === "1";
  const { data, error } = await supabase.storage
    .from("documentos")
    .createSignedUrl(doc.archivo_url, 60, descargar ? { download: doc.archivo_nombre ?? doc.nombre } : undefined);
  if (error || !data) return new NextResponse("No encontrado", { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
