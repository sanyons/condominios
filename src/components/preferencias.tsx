import { cambiarIdioma, cambiarTema } from "@/app/acciones-comunes";
import { dic, idioma, tema } from "@/lib/i18n";

const segmento =
  "min-h-9 flex-1 cursor-pointer rounded-md px-2 text-xs font-semibold transition-colors aria-pressed:bg-superficie aria-pressed:text-tinta aria-pressed:shadow-sm text-suave hover:text-tinta";

/** Selectores de idioma (ES/EN) y tema (automático/claro/oscuro). */
export async function Preferencias({ compacto = false }: { compacto?: boolean }) {
  const [t, actualIdioma, actualTema] = await Promise.all([dic(), idioma(), tema()]);
  const temas = [
    { valor: "sistema", etiqueta: t.comun.temaSistema, icono: "M12 3v18M12 3a9 9 0 0 1 0 18" },
    { valor: "claro", etiqueta: t.comun.temaClaro, icono: "M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" },
    { valor: "oscuro", etiqueta: t.comun.temaOscuro, icono: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" },
  ];
  return (
    <div className={`flex gap-2 ${compacto ? "flex-row" : "flex-col"}`}>
      <form action={cambiarIdioma} className="flex rounded-lg bg-linea-suave p-0.5" aria-label={t.comun.idioma}>
        {(["es", "en"] as const).map((v) => (
          <button key={v} name="idioma" value={v} aria-pressed={actualIdioma === v} className={segmento} title={t.comun.idioma}>
            {v.toUpperCase()}
          </button>
        ))}
      </form>
      <form action={cambiarTema} className="flex rounded-lg bg-linea-suave p-0.5" aria-label={t.comun.tema}>
        {temas.map((o) => (
          <button
            key={o.valor}
            name="tema"
            value={o.valor}
            aria-pressed={actualTema === o.valor}
            aria-label={o.etiqueta}
            title={o.etiqueta}
            className={`${segmento} flex items-center justify-center`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {o.valor === "sistema" ? (
                <>
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" />
                </>
              ) : (
                <path d={o.icono} />
              )}
            </svg>
          </button>
        ))}
      </form>
    </div>
  );
}
