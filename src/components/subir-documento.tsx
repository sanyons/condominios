"use client";

import { useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clienteNavegador } from "@/lib/supabase/navegador";
import { registrarArchivo } from "@/app/admin/documentos/acciones";

const MAX = 25 * 1024 * 1024;
const TIPOS = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
];

export type TextosSubir = {
  archivo: string;
  notaArchivo: string;
  nombre: string;
  carpeta: string;
  descripcion: string;
  visible: string;
  subir: string;
  reemplazar: string;
  subiendo: string;
  errPeso: string;
  errTipo: string;
  errSinArchivo: string;
  errSubir: string; // con {m}
};

/**
 * Sube el archivo directo del navegador a Storage (RLS: solo administración)
 * y luego lo registra en la tabla documentos. Con `documentoId` reemplaza el
 * archivo de un documento existente.
 */
export function SubirDocumento({
  condominioId,
  documentoId,
  carpetas,
  carpetaInicial,
  textos,
}: {
  condominioId: string;
  documentoId?: string;
  carpetas: string[];
  carpetaInicial?: string;
  textos: TextosSubir;
}) {
  const router = useRouter();
  const formulario = useRef<HTMLFormElement>(null);
  const [mensaje, setMensaje] = useState<{ ok?: string; error?: string } | null>(null);
  const [nombre, setNombre] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  const [, startTransition] = useTransition();
  const idLista = useId();

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMensaje(null);
    const fd = new FormData(e.currentTarget);
    const archivo = fd.get("archivo");
    if (!(archivo instanceof File) || archivo.size === 0) return setMensaje({ error: textos.errSinArchivo });
    if (archivo.size > MAX) return setMensaje({ error: textos.errPeso });
    if (archivo.type && !TIPOS.includes(archivo.type)) return setMensaje({ error: textos.errTipo });

    setSubiendo(true);
    try {
      const ext = (archivo.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin";
      const ruta = `${condominioId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await clienteNavegador()
        .storage.from("documentos")
        .upload(ruta, archivo, { contentType: archivo.type || "application/octet-stream", upsert: false });
      if (error) return setMensaje({ error: textos.errSubir.replace("{m}", error.message) });

      const r = await registrarArchivo({
        id: documentoId,
        ruta,
        archivoNombre: archivo.name,
        tamano: archivo.size,
        tipo: archivo.type || "application/octet-stream",
        nombre: String(fd.get("nombre") ?? ""),
        carpeta: String(fd.get("carpeta") ?? ""),
        descripcion: String(fd.get("descripcion") ?? ""),
        visible: fd.get("visible") === "on",
      });
      setMensaje(r);
      if (r.ok) {
        formulario.current?.reset();
        setNombre("");
        startTransition(() => router.refresh());
      }
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <form ref={formulario} onSubmit={enviar} className="flex flex-col gap-3">
      <label className="etiqueta">
        {textos.archivo}
        <input
          type="file"
          name="archivo"
          required
          accept={TIPOS.join(",")}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f && !documentoId && !nombre) setNombre(f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "));
          }}
          className="campo py-2 file:mr-3 file:rounded-md file:border-0 file:bg-marca-clara file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-acento-fuerte"
        />
        <span className="text-xs font-normal text-suave">{textos.notaArchivo}</span>
      </label>
      {!documentoId && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="etiqueta">
              {textos.nombre}
              <input className="campo" name="nombre" maxLength={160} value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </label>
            <label className="etiqueta">
              {textos.carpeta}
              <input className="campo" name="carpeta" list={idLista} maxLength={60} defaultValue={carpetaInicial ?? carpetas[0]} required />
              <datalist id={idLista}>
                {carpetas.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>
          </div>
          <label className="etiqueta">
            {textos.descripcion}
            <input className="campo" name="descripcion" maxLength={300} />
          </label>
          <label className="flex min-h-10 items-center gap-2 text-sm">
            <input type="checkbox" name="visible" defaultChecked className="size-5 accent-[var(--marca)]" />
            {textos.visible}
          </label>
        </>
      )}
      {mensaje && (
        <p role={mensaje.error ? "alert" : "status"} className={`rounded-lg px-3 py-2 text-sm font-medium ${mensaje.error ? "tono-peligro" : "tono-ok"}`}>
          {mensaje.error ?? mensaje.ok}
        </p>
      )}
      <button className={documentoId ? "btn-secundario self-start" : "btn-primario self-start"} disabled={subiendo}>
        {subiendo ? textos.subiendo : documentoId ? textos.reemplazar : textos.subir}
      </button>
    </form>
  );
}
