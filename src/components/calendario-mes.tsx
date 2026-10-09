import Link from "next/link";
import { diaCR, fechaCorta, nombresDias, semanasDelMes, type Mes } from "@/lib/fechas";

export type TipoItem = "evento" | "asamblea" | "reserva" | "solicitud" | "pago" | "servicio";

export type ItemCalendario = {
  id: string;
  fecha: string; // AAAA-MM-DD
  titulo: string;
  detalle?: string; // hora, lugar…
  tipo: TipoItem;
};

const PUNTO: Record<TipoItem, string> = {
  evento: "bg-acento",
  asamblea: "bg-marca",
  reserva: "bg-acento-fuerte",
  solicitud: "bg-alerta",
  pago: "bg-peligro",
  servicio: "bg-alerta",
};

const FICHA: Record<TipoItem, string> = {
  evento: "bg-linea-suave text-tinta",
  asamblea: "bg-marca text-white",
  reserva: "tono-ok",
  solicitud: "tono-alerta",
  pago: "tono-peligro",
  servicio: "tono-alerta",
};

/**
 * Calendario mensual (lunes a domingo) con navegación por ?mes=AAAA-MM y la
 * agenda del mes debajo. En el teléfono cada día muestra puntos; desde
 * tabletas, los títulos.
 */
export function CalendarioMes({
  mes,
  items,
  ruta,
  locale,
  textos,
  leyenda,
}: {
  mes: Mes;
  items: ItemCalendario[];
  ruta: string;
  locale: string;
  textos: { anterior: string; siguiente: string; hoy: string; agenda: string; vacio: string; mas: (n: number) => string };
  leyenda: { tipo: TipoItem; texto: string }[];
}) {
  const hoy = diaCR(new Date());
  const porDia = new Map<string, ItemCalendario[]>();
  for (const it of items) {
    if (!porDia.has(it.fecha)) porDia.set(it.fecha, []);
    porDia.get(it.fecha)!.push(it);
  }
  const delMes = [...porDia.entries()].filter(([f]) => f >= mes.desde && f < mes.hasta).sort(([a], [b]) => a.localeCompare(b));
  const dias = nombresDias(locale);

  return (
    <div className="flex flex-col gap-5">
      <section className="tarjeta flex flex-col gap-3 p-3 sm:p-5" aria-label={mes.nombre}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold capitalize">{mes.nombre}</h2>
          <div className="flex items-center gap-1">
            <Link href={`${ruta}?mes=${mes.anterior}`} className="btn-suave min-h-9 px-3" aria-label={textos.anterior}>
              ‹
            </Link>
            <Link href={ruta} className="btn-suave min-h-9 px-3 text-xs">
              {textos.hoy}
            </Link>
            <Link href={`${ruta}?mes=${mes.siguiente}`} className="btn-suave min-h-9 px-3" aria-label={textos.siguiente}>
              ›
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-7 text-center text-[11px] font-semibold tracking-wide text-suave uppercase" aria-hidden="true">
          {dias.map((d) => (
            <span key={d} className="py-1">
              {d.replace(".", "")}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-linea bg-linea">
          {semanasDelMes(mes).flat().map(({ fecha, delMes: enMes }) => {
            const lista = porDia.get(fecha) ?? [];
            const esHoy = fecha === hoy;
            return (
              <div
                key={fecha}
                className={`flex min-h-14 flex-col gap-1 p-1 sm:min-h-24 sm:p-1.5 ${enMes ? "bg-superficie" : "bg-fondo text-suave"}`}
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                    esHoy ? "bg-marca text-white" : ""
                  }`}
                >
                  {Number(fecha.slice(8))}
                </span>
                {lista.length > 0 && (
                  <>
                    <span className="flex flex-wrap gap-0.5 px-1 sm:hidden" aria-label={lista.map((i) => i.titulo).join(", ")}>
                      {lista.slice(0, 4).map((i) => (
                        <span key={i.id} className={`h-1.5 w-1.5 rounded-full ${PUNTO[i.tipo]}`} />
                      ))}
                    </span>
                    <span className="hidden flex-col gap-0.5 sm:flex">
                      {lista.slice(0, 3).map((i) => (
                        <span key={i.id} title={i.titulo} className={`truncate rounded px-1.5 py-0.5 text-[11px] leading-tight font-semibold ${FICHA[i.tipo]}`}>
                          {i.titulo}
                        </span>
                      ))}
                      {lista.length > 3 && <span className="px-1 text-[11px] text-suave">{textos.mas(lista.length - 3)}</span>}
                    </span>
                  </>
                )}
              </div>
            );
          })}
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-suave">
          {leyenda.map((l) => (
            <li key={l.tipo} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${PUNTO[l.tipo]}`} aria-hidden="true" />
              {l.texto}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2.5" aria-labelledby="h-agenda">
        <h2 id="h-agenda" className="text-base font-bold">
          {textos.agenda}
        </h2>
        {delMes.length === 0 ? (
          <p className="tarjeta text-sm text-suave">{textos.vacio}</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {delMes.map(([fecha, lista]) => (
              <li key={fecha} className={`tarjeta flex gap-4 p-4 ${fecha < hoy ? "opacity-70" : ""}`}>
                <span className="w-16 shrink-0 text-sm font-bold capitalize">{fechaCorta(fecha, locale)}</span>
                <ul className="flex min-w-0 flex-1 flex-col gap-2">
                  {lista.map((i) => (
                    <li key={i.id} className="flex items-start gap-2">
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${PUNTO[i.tipo]}`} aria-hidden="true" />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{i.titulo}</span>
                        {i.detalle && <span className="block text-xs text-suave">{i.detalle}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
