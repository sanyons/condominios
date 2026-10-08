/** Muestra ?ok= o ?error= que dejan las acciones del servidor al redirigir. */
export function Aviso({ ok, error }: { ok?: string; error?: string }) {
  if (!ok && !error) return null;
  return (
    <div
      role={error ? "alert" : "status"}
      className={`rounded-lg px-4 py-3 text-sm font-medium ${
        error ? "bg-peligro-clara text-[#8e2a23]" : "bg-marca-clara text-marca-oscura"
      }`}
    >
      {error ?? ok}
    </div>
  );
}

export type BuscarParams = Promise<{ ok?: string; error?: string; [k: string]: string | undefined }>;
