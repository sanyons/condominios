import Link from "next/link";
import type { Metadata } from "next";
import { contextoAdmin } from "@/lib/contexto";
import { dic } from "@/lib/i18n";
import { Encabezado } from "@/components/encabezado";
import { Aviso, type BuscarParams } from "@/components/aviso";
import { formatos } from "@/lib/formato";
import { SubirDocumento, type TextosSubir } from "@/components/subir-documento";
import { IconoArchivo, peso } from "@/components/icono-archivo";
import { cambiarVisibilidad, eliminarDocumento, guardarDocumento } from "./acciones";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await dic()).documentos.titulo };
}

export default async function Documentos({ searchParams }: { searchParams: BuscarParams }) {
  const params = await searchParams;
  const [ctx, t] = await Promise.all([contextoAdmin(), dic()]);
  const { fecha } = formatos(t);
  const d = t.documentos;

  const { data } = await ctx.supabase
    .from("documentos")
    .select("id, carpeta, nombre, descripcion, archivo_nombre, tamano_bytes, tipo_mime, visible_residentes, actualizado_en")
    .eq("condominio_id", ctx.condominioId)
    .order("carpeta")
    .order("nombre");
  const docs = (data ?? []) as any[];

  const enUso = Array.from(new Set(docs.map((x) => x.carpeta as string)));
  const carpetas = Array.from(new Set([...enUso, ...d.carpetasSugeridas]));
  const carpeta = params.carpeta && enUso.includes(params.carpeta) ? params.carpeta : null;
  const visibles = carpeta ? docs.filter((x) => x.carpeta === carpeta) : docs;
  const grupos = Array.from(new Set(visibles.map((x) => x.carpeta as string)));

  const textos: TextosSubir = {
    archivo: d.archivo,
    notaArchivo: d.notaArchivo,
    nombre: d.nombre,
    carpeta: d.carpeta,
    descripcion: d.descripcion,
    visible: d.visible,
    subir: d.subir,
    reemplazar: d.reemplazar,
    subiendo: d.subiendo,
    errPeso: d.errPeso,
    errTipo: d.errTipo,
    errSinArchivo: d.errSinArchivo,
    errSubir: d.errSubir("{m}"),
  };

  return (
    <>
      <Encabezado titulo={d.titulo} subtitulo={d.subtitulo(docs.length)} />
      <Aviso ok={params.ok} error={params.error} />

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[1fr_22rem]">
        <section className="flex min-w-0 flex-col gap-4" aria-label={d.titulo}>
          {enUso.length > 1 && (
            <nav className="flex flex-wrap gap-1.5 text-sm" aria-label={d.carpeta}>
              {[null, ...enUso].map((c) => (
                <Link
                  key={c ?? "todas"}
                  href={c ? `/admin/documentos?carpeta=${encodeURIComponent(c)}` : "/admin/documentos"}
                  aria-current={carpeta === c ? "true" : undefined}
                  className={`rounded-full px-3 py-1.5 font-semibold ${carpeta === c ? "tono-ok" : "text-tenue hover:bg-linea-suave"}`}
                >
                  {c ?? d.todas}
                  <span className="ml-1.5 text-xs opacity-70">{c ? docs.filter((x) => x.carpeta === c).length : docs.length}</span>
                </Link>
              ))}
            </nav>
          )}

          {docs.length === 0 && <p className="tarjeta text-sm text-suave">{d.sinDocumentos}</p>}

          {grupos.map((g) => (
            <section key={g} className="tarjeta flex flex-col gap-1 p-3 sm:p-5" aria-labelledby={`c-${g}`}>
              <h2 id={`c-${g}`} className="px-2 pb-1 text-base font-bold sm:px-0">
                {g}
              </h2>
              <ul className="flex flex-col divide-y divide-linea-suave">
                {visibles
                  .filter((x) => x.carpeta === g)
                  .map((doc) => (
                    <li key={doc.id} className="flex flex-col gap-2 px-2 py-3 sm:px-0">
                      <div className="flex items-start gap-3">
                        <IconoArchivo tipo={doc.tipo_mime} />
                        <div className="min-w-0 flex-1">
                          <a href={`/documentos/${doc.id}`} target="_blank" rel="noopener" className="font-semibold hover:underline">
                            {doc.nombre}
                          </a>
                          {doc.descripcion && <p className="text-sm text-suave">{doc.descripcion}</p>}
                          <p className="text-xs text-suave">
                            {[doc.archivo_nombre, peso(doc.tamano_bytes, t.locale), d.actualizado(fecha(doc.actualizado_en))]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                        <form action={cambiarVisibilidad} className="shrink-0">
                          <input type="hidden" name="id" value={doc.id} />
                          <input type="hidden" name="visible" value={doc.visible_residentes ? "0" : "1"} />
                          <button
                            className={`pastilla cursor-pointer ${doc.visible_residentes ? "tono-ok" : "tono-neutro"}`}
                            title={doc.visible_residentes ? d.ocultar : d.publicar}
                          >
                            {doc.visible_residentes ? d.publicado : d.oculto}
                          </button>
                        </form>
                      </div>
                      <details className="pl-11">
                        <summary className="cursor-pointer text-sm font-semibold text-acento">{d.editar}</summary>
                        <div className="mt-3 grid grid-cols-1 gap-5 lg:grid-cols-2">
                          <form action={guardarDocumento} className="flex flex-col gap-3">
                            <input type="hidden" name="id" value={doc.id} />
                            <label className="etiqueta">
                              {d.nombre}
                              <input className="campo" name="nombre" required maxLength={160} defaultValue={doc.nombre} />
                            </label>
                            <label className="etiqueta">
                              {d.carpeta}
                              <input className="campo" name="carpeta" list="carpetas" required maxLength={60} defaultValue={doc.carpeta} />
                            </label>
                            <label className="etiqueta">
                              {d.descripcion}
                              <input className="campo" name="descripcion" maxLength={300} defaultValue={doc.descripcion ?? ""} />
                            </label>
                            <label className="flex min-h-10 items-center gap-2 text-sm">
                              <input type="checkbox" name="visible" defaultChecked={doc.visible_residentes} className="size-5 accent-[var(--marca)]" />
                              {d.visible}
                            </label>
                            <button className="btn-primario self-start">{d.guardar}</button>
                          </form>
                          <div className="flex flex-col gap-4">
                            <SubirDocumento condominioId={ctx.condominioId} documentoId={doc.id} carpetas={carpetas} textos={textos} />
                            <form action={eliminarDocumento} className="border-t border-linea pt-3">
                              <input type="hidden" name="id" value={doc.id} />
                              <button className="text-sm font-semibold text-peligro-texto hover:underline">{d.eliminar}</button>
                            </form>
                          </div>
                        </div>
                      </details>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
          <datalist id="carpetas">
            {carpetas.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </section>

        <section className="tarjeta flex flex-col gap-4 xl:sticky xl:top-6" aria-labelledby="h-subir">
          <h2 id="h-subir" className="text-lg font-bold">
            {d.subir}
          </h2>
          <SubirDocumento condominioId={ctx.condominioId} carpetas={carpetas} carpetaInicial={carpeta ?? undefined} textos={textos} />
        </section>
      </div>
    </>
  );
}
