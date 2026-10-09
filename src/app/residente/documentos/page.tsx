import type { Metadata } from "next";
import { contextoResidente } from "@/lib/contexto";
import { dic } from "@/lib/i18n";
import { formatos } from "@/lib/formato";
import { IconoArchivo, peso } from "@/components/icono-archivo";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await dic()).documentos.titulo };
}

/** Documentos publicados para los condóminos (RLS oculta los de solo administración). */
export default async function DocumentosResidente() {
  const [ctx, t] = await Promise.all([contextoResidente(), dic()]);
  const { fecha } = formatos(t);
  const d = t.documentos;

  const { data } = await ctx.supabase
    .from("documentos")
    .select("id, carpeta, nombre, descripcion, archivo_nombre, tamano_bytes, tipo_mime, actualizado_en")
    .eq("condominio_id", ctx.condominioId)
    .eq("visible_residentes", true)
    .order("carpeta")
    .order("nombre");
  const docs = (data ?? []) as any[];
  const carpetas = Array.from(new Set(docs.map((x) => x.carpeta as string)));

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">{d.titulo}</h1>
      {docs.length === 0 && <p className="tarjeta text-sm text-suave">{d.sinDocumentosRes}</p>}
      {carpetas.map((c) => (
        <section key={c} className="flex flex-col gap-2" aria-labelledby={`c-${c}`}>
          <h2 id={`c-${c}`} className="text-base font-bold">
            {c}
          </h2>
          <ul className="tarjeta flex flex-col divide-y divide-linea-suave p-0">
            {docs
              .filter((x) => x.carpeta === c)
              .map((doc) => (
                <li key={doc.id} className="flex items-center gap-3 px-4 py-3">
                  <IconoArchivo tipo={doc.tipo_mime} />
                  <a href={`/documentos/${doc.id}`} target="_blank" rel="noopener" className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold hover:underline">{doc.nombre}</span>
                    {doc.descripcion && <span className="block text-xs text-suave">{doc.descripcion}</span>}
                    <span className="block text-xs text-suave">
                      {[peso(doc.tamano_bytes, t.locale), d.actualizado(fecha(doc.actualizado_en))].filter(Boolean).join(" · ")}
                    </span>
                  </a>
                  <a
                    href={`/documentos/${doc.id}?descargar=1`}
                    className="btn-suave min-h-9 shrink-0 px-3 text-xs"
                    aria-label={`${d.abrir}: ${doc.nombre}`}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14" />
                    </svg>
                  </a>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </>
  );
}
