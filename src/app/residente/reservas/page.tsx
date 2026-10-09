import Link from "next/link";
import type { Metadata } from "next";
import { contextoResidente } from "@/lib/contexto";
import { dic } from "@/lib/i18n";
import { Aviso, type BuscarParams } from "@/components/aviso";
import { formatos } from "@/lib/formato";
import { diaCR, fechaCorta, fechaLarga, hora, horaDeTexto, isoCR, sumarDias } from "@/lib/fechas";
import { cancelarReserva, reservar } from "./acciones";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await dic()).reservar.titulo };
}

const TONO: Record<string, string> = {
  solicitada: "tono-alerta",
  confirmada: "tono-ok",
  cancelada: "tono-neutro",
  rechazada: "tono-peligro",
  completada: "tono-neutro",
};

export default async function Reservas({ searchParams }: { searchParams: BuscarParams }) {
  const params = await searchParams;
  const [ctx, t] = await Promise.all([contextoResidente(), dic()]);
  const { dinero } = formatos(t);
  const r = t.reservar;
  const a = t.amenidades;
  const ids = ctx.unidades.map((u) => u.id);
  const hoy = diaCR(new Date());
  const fecha = params.fecha && /^\d{4}-\d{2}-\d{2}$/.test(params.fecha) && params.fecha >= hoy ? params.fecha : hoy;

  const [{ data: areas }, { data: mias }, { data: estado }, { data: condo }] = await Promise.all([
    ctx.supabase.from("areas_comunes").select("*").eq("condominio_id", ctx.condominioId).eq("activa", true).order("nombre"),
    ctx.supabase
      .from("reservas")
      .select("id, inicio, fin, estado, invitados, motivo_respuesta, areas_comunes(nombre), unidades(codigo)")
      .in("unidad_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"])
      .gte("inicio", isoCR(sumarDias(hoy, -60)))
      .order("inicio", { ascending: false })
      .limit(30),
    ctx.supabase.from("v_estado_cuenta_unidad").select("unidad_id, condicion").in("unidad_id", ids),
    ctx.supabase.from("condominios").select("moneda_base").eq("id", ctx.condominioId).single(),
  ]);

  const moneda = condo?.moneda_base ?? "CRC";
  const lista = (areas ?? []) as any[];
  const area = lista.find((x) => x.id === params.area);
  const moroso = (estado ?? []).some((e: any) => e.condicion === "moroso");

  const { data: ocupadas } = area
    ? await ctx.supabase
        .from("reservas")
        .select("inicio, fin, estado")
        .eq("area_id", area.id)
        .in("estado", ["solicitada", "confirmada"])
        .gte("inicio", isoCR(fecha))
        .lt("inicio", isoCR(sumarDias(fecha, 1)))
        .order("inicio")
    : { data: [] };

  const ahora = new Date().toISOString();
  const proximas = (mias ?? []).filter((x: any) => x.fin >= ahora && ["solicitada", "confirmada"].includes(x.estado)).reverse();
  const anteriores = (mias ?? []).filter((x: any) => !(x.fin >= ahora && ["solicitada", "confirmada"].includes(x.estado))).slice(0, 8);
  const cuando = (x: any) => `${fechaCorta(diaCR(x.inicio), t.locale)} · ${hora(x.inicio, t.locale)} – ${hora(x.fin, t.locale)}`;

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">{r.titulo}</h1>
      <Aviso ok={params.ok} error={params.error} />

      <section aria-labelledby="h-mias" className="flex flex-col gap-2.5">
        <h2 id="h-mias" className="text-base font-bold">
          {r.misReservas}
        </h2>
        {proximas.length === 0 ? (
          <p className="tarjeta text-sm text-suave">{r.sinReservas}</p>
        ) : (
          proximas.map((x: any) => (
            <article key={x.id} className="tarjeta flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {x.areas_comunes?.nombre}
                  {ids.length > 1 && <span className="font-normal text-suave"> · {x.unidades?.codigo}</span>}
                </p>
                <p className="text-xs text-suave capitalize">{cuando(x)}</p>
                <span className={`pastilla mt-1 ${TONO[x.estado]}`}>{t.estadosReserva[x.estado]}</span>
              </div>
              {x.inicio > ahora && (
                <form action={cancelarReserva} className="shrink-0">
                  <input type="hidden" name="id" value={x.id} />
                  <button className="btn-secundario min-h-9 px-3 text-xs">{a.cancelar}</button>
                </form>
              )}
            </article>
          ))
        )}
      </section>

      <section aria-labelledby="h-areas" className="flex flex-col gap-2.5">
        <h2 id="h-areas" className="text-base font-bold">
          {r.areas}
        </h2>
        {lista.length === 0 && <p className="tarjeta text-sm text-suave">{r.sinAreas}</p>}
        {lista.map((x) => {
          const elegida = area?.id === x.id;
          return (
            <article key={x.id} className={`tarjeta flex flex-col gap-3 p-4 ${elegida ? "border-marca" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-bold">{x.nombre}</h3>
                  {x.descripcion && <p className="text-sm text-suave">{x.descripcion}</p>}
                </div>
                {elegida ? (
                  <span className="pastilla tono-ok shrink-0">{r.elegida}</span>
                ) : (
                  <Link href={`/residente/reservas?area=${x.id}&fecha=${fecha}#reservar`} className="btn-suave min-h-9 shrink-0 px-3 text-xs">
                    {r.elegir}
                  </Link>
                )}
              </div>
              <ul className="flex flex-wrap gap-1.5">
                <li className="pastilla tono-neutro">{a.horario(horaDeTexto(x.hora_apertura, t.locale), horaDeTexto(x.hora_cierre, t.locale))}</li>
                <li className="pastilla tono-neutro">{a.maxHoras(x.duracion_max_horas)}</li>
                <li className="pastilla tono-neutro">{Number(x.costo) > 0 ? dinero(x.costo, moneda) : a.gratis}</li>
                {Number(x.deposito) > 0 && <li className="pastilla tono-neutro">{a.depositoN(dinero(x.deposito, moneda))}</li>}
                {x.capacidad && <li className="pastilla tono-neutro">{a.capacidadN(x.capacidad)}</li>}
                {x.requiere_aprobacion && <li className="pastilla tono-alerta">{a.conAprobacion}</li>}
              </ul>

              {elegida && (
                <div id="reservar" className="flex scroll-mt-4 flex-col gap-4 border-t border-linea pt-3">
                  {x.reglas && (
                    <div className="text-sm">
                      <p className="font-semibold">{r.reglas}</p>
                      <p className="whitespace-pre-line text-suave">{x.reglas}</p>
                    </div>
                  )}
                  {moroso && x.bloquear_morosos && <p className="tono-alerta rounded-lg px-3 py-2 text-sm font-medium">{r.avisoMoroso}</p>}

                  <form action="/residente/reservas" className="flex items-end gap-2">
                    <input type="hidden" name="area" value={x.id} />
                    <label className="etiqueta flex-1">
                      {r.fecha}
                      <input className="campo" type="date" name="fecha" min={hoy} defaultValue={fecha} required />
                    </label>
                    <button className="btn-secundario">{r.verDia}</button>
                  </form>

                  <div className="text-sm">
                    <p className="font-semibold capitalize">{fechaLarga(fecha, t.locale)}</p>
                    {(ocupadas ?? []).length === 0 ? (
                      <p className="text-suave">{r.libre}</p>
                    ) : (
                      <>
                        <p className="text-suave">{r.ocupado}:</p>
                        <ul className="mt-1 flex flex-wrap gap-1.5">
                          {(ocupadas ?? []).map((o: any, i: number) => (
                            <li key={i} className={`pastilla ${o.estado === "solicitada" ? "tono-alerta" : "tono-peligro"}`}>
                              {hora(o.inicio, t.locale)} – {hora(o.fin, t.locale)}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>

                  <form action={reservar} className="flex flex-col gap-3">
                    <input type="hidden" name="area_id" value={x.id} />
                    <input type="hidden" name="fecha" value={fecha} />
                    {ctx.unidades.length > 1 && (
                      <label className="etiqueta">
                        {r.unidad}
                        <select className="campo" name="unidad_id">
                          {ctx.unidades.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.codigo}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <div className="grid grid-cols-3 gap-3">
                      <label className="etiqueta">
                        {r.desde}
                        <input
                          className="campo"
                          type="time"
                          name="desde"
                          step={1800}
                          required
                          min={x.hora_apertura.slice(0, 5)}
                          max={x.hora_cierre.slice(0, 5)}
                          defaultValue={x.hora_apertura.slice(0, 5)}
                        />
                      </label>
                      <label className="etiqueta">
                        {r.hasta}
                        <input
                          className="campo"
                          type="time"
                          name="hasta"
                          step={1800}
                          required
                          min={x.hora_apertura.slice(0, 5)}
                          max={x.hora_cierre.slice(0, 5)}
                        />
                      </label>
                      <label className="etiqueta">
                        {r.invitados}
                        <input className="campo" type="number" name="invitados" min={0} max={x.capacidad ?? undefined} defaultValue={0} />
                      </label>
                    </div>
                    <label className="etiqueta">
                      {r.notas}
                      <input className="campo" name="notas" maxLength={200} />
                    </label>
                    {x.requiere_aprobacion && <p className="text-xs text-suave">{r.notaAprobacion}</p>}
                    {Number(x.costo) > 0 && <p className="text-xs text-suave">{r.notaCosto(dinero(x.costo, moneda))}</p>}
                    <button className="btn-primario" disabled={moroso && x.bloquear_morosos}>
                      {x.requiere_aprobacion ? r.solicitar : r.enviar}
                    </button>
                  </form>
                </div>
              )}
            </article>
          );
        })}
      </section>

      {anteriores.length > 0 && (
        <section aria-labelledby="h-ant" className="flex flex-col gap-2">
          <h2 id="h-ant" className="text-base font-bold">
            {r.anteriores}
          </h2>
          <ul className="tarjeta flex flex-col divide-y divide-linea-suave p-0">
            {anteriores.map((x: any) => (
              <li key={x.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{x.areas_comunes?.nombre}</p>
                  <p className="text-xs text-suave capitalize">{cuando(x)}</p>
                  {x.motivo_respuesta && <p className="text-xs text-suave">{x.motivo_respuesta}</p>}
                </div>
                <span className={`pastilla shrink-0 ${TONO[x.estado]}`}>{t.estadosReserva[x.estado]}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
