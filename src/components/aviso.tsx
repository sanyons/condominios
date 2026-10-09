/** Muestra ?ok= o ?error= que dejan las acciones del servidor al redirigir. */
export function Aviso({ ok, error }: { ok?: string; error?: string }) {
  if (!ok && !error) return null;
  return (
    <div role={error ? "alert" : "status"} className={`rounded-lg px-4 py-3 text-sm font-medium ${error ? "tono-peligro" : "tono-ok"}`}>
      {error ?? ok}
    </div>
  );
}

export type BuscarParams = Promise<{ ok?: string; error?: string; [k: string]: string | undefined }>;
