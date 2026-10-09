import Link from "next/link";
import { elegirCondominio } from "@/app/acciones-comunes";
import { dic } from "@/lib/i18n";

/**
 * Condominio activo. Con varios condominios (o si puede agregar más) es un menú desplegable
 * que muestra el nombre completo; si no, solo el nombre.
 */
export async function SelectorCondominio({
  actual,
  condominios,
  puedeAgregar = false,
}: {
  actual: string;
  condominios: { id: string; nombre: string }[];
  puedeAgregar?: boolean;
}) {
  const t = await dic();
  const nombreActual = condominios.find((c) => c.id === actual)?.nombre ?? "";

  if (condominios.length < 2 && !puedeAgregar) {
    return <p className="text-sm font-semibold leading-snug">{nombreActual}</p>;
  }

  return (
    <details className="group relative">
      <summary
        className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg border border-linea bg-superficie px-3 py-2.5 hover:border-campo [&::-webkit-details-marker]:hidden"
        aria-label={t.comun.cambiarCondominio}
      >
        <span className="min-w-0">
          <span className="block text-[11px] font-semibold tracking-wide text-suave uppercase">{t.comun.condominio}</span>
          <span className="block text-sm leading-snug font-semibold">{nombreActual}</span>
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0 text-suave transition-transform group-open:rotate-180"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <div className="absolute inset-x-0 z-30 mt-1 rounded-lg border border-linea bg-superficie p-1 shadow-lg">
        <ul className="flex flex-col">
          {condominios.map((c) => (
            <li key={c.id}>
              <form action={elegirCondominio}>
                <input type="hidden" name="condominio_id" value={c.id} />
                <button
                  className={`flex min-h-10 w-full cursor-pointer items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm leading-snug hover:bg-linea-suave ${
                    c.id === actual ? "font-bold text-acento-fuerte" : "font-medium text-tinta"
                  }`}
                  aria-current={c.id === actual ? "true" : undefined}
                >
                  <span>{c.nombre}</span>
                  {c.id === actual && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </button>
              </form>
            </li>
          ))}
        </ul>
        {puedeAgregar && (
          <Link
            href="/onboarding"
            className="mt-1 flex min-h-10 items-center gap-2 rounded-md border-t border-linea px-3 pt-2 text-sm font-semibold text-acento hover:bg-linea-suave"
          >
            <span aria-hidden="true">+</span> {t.comun.agregarCondominio}
          </Link>
        )}
      </div>
    </details>
  );
}
