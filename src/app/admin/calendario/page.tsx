import type { Metadata } from "next";
import { contextoAdmin } from "@/lib/contexto";
import { dic, type Dict } from "@/lib/i18n";
import { Encabezado } from "@/components/encabezado";
import { Aviso, type BuscarParams } from "@/components/aviso";
import { CalendarioMes, type ItemCalendario } from "@/components/calendario-mes";
import { diaCR, fechaCorta, horaCR24, isoCR, mesDe } from "@/lib/fechas";
import { detalleEvento, eventosDelMes, itemsDeEventos, itemsDeReservas, type Evento } from "@/lib/calendario";
import { eliminarEvento, guardarEvento } from "./acciones";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await dic()).calendario.titulo };
}

const CATEGORIAS = ["general", "asamblea", "mantenimiento", "social", "pagos", "servicios"];

function FormularioEvento({ t, evento, fechaInicial }: { t: Dict; evento?: Evento; fechaInicial: string }) {
  const c = t.calendario;
  const fecha = evento ? diaCR(evento.inicio) : fechaInicial;
  const conHora = evento && !evento.todo_el_dia;
  return (
    <form action={guardarEvento} className="flex flex-col gap-3">
      {evento && <input type="hidden" name="id" value={evento.id} />}
      <label className="etiqueta">
        {c.tituloEvento}
        <input className="campo" name="titulo" required maxLength={160} defaultValue={evento?.titulo} placeholder={c.tituloEjemplo} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="etiqueta">
          {c.categoria}
          <select className="campo" name="categoria" defaultValue={evento?.categoria ?? "general"}>
            {CATEGORIAS.map((k) => (
              <option key={k} value={k}>
                {t.categoriasEvento[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="etiqueta">
          {c.fecha}
          <input className="campo" type="date" name="fecha" required defaultValue={fecha} />
        </label>
        <label className="etiqueta">
          {c.horaInicio}
          <input className="campo" type="time" name="hora_inicio" step={900} defaultValue={conHora ? horaCR24(evento!.inicio) : ""} />
        </label>
        <label className="etiqueta">
          {c.horaFin}
          <input className="campo" type="time" name="hora_fin" step={900} defaultValue={conHora && evento?.fin ? horaCR24(evento.fin) : ""} />
        </label>
        <label className="etiqueta col-span-2">
          {c.fechaFin}
          <input
            className="campo"
            type="date"
            name="fecha_fin"
            defaultValue={evento?.fin && diaCR(evento.fin) !== fecha ? diaCR(evento.fin) : ""}
          />
        </label>
      </div>
      <label className="flex min-h-10 items-center gap-2 text-sm">
        <input type="checkbox" name="todo_el_dia" defaultChecked={evento ? evento.todo_el_dia : false} className="size-5 accent-[var(--marca)]" />
        {c.todoElDia}
      </label>
      <label className="etiqueta">
        {c.ubicacion}
        <input className="campo" name="ubicacion" maxLength={120} defaultValue={evento?.ubicacion ?? ""} />
      </label>
      <label className="etiqueta">
        {c.descripcion}
        <textarea className="campo min-h-20 py-2" name="descripcion" rows={3} defaultValue={evento?.descripcion ?? ""} />
      </label>
      <button className="btn-primario self-start">{evento ? c.guardar : c.crear}</button>
    </form>
  );
}

export default async function Calendario({ searchParams }: { searchParams: BuscarParams }) {
  const params = await searchParams;
  const [ctx, t] = await Promise.all([contextoAdmin(), dic()]);
  const c = t.calendario;
  const mes = mesDe(params.mes, t.locale);
  const hoy = diaCR(new Date());

  const [eventos, reservas, { data: condo }, { data: proximos }] = await Promise.all([
    eventosDelMes(ctx.supabase, ctx.condominioId, mes),
    itemsDeReservas(ctx.supabase, ctx.condominioId, mes, t),
    ctx.supabase.from("condominios").select("dia_vencimiento").eq("id", ctx.condominioId).single(),
    ctx.supabase
      .from("eventos")
      .select("id, titulo, descripcion, ubicacion, categoria, inicio, fin, todo_el_dia")
      .eq("condominio_id", ctx.condominioId)
      .gte("inicio", isoCR(hoy))
      .order("inicio")
      .limit(30),
  ]);

  const items: ItemCalendario[] = [...itemsDeEventos(eventos, t), ...reservas];
  if (condo?.dia_vencimiento) {
    items.push({
      id: "vence",
      fecha: `${mes.clave}-${String(condo.dia_vencimiento).padStart(2, "0")}`,
      titulo: c.venceCuota,
      tipo: "pago",
    });
  }

  return (
    <>
      <Encabezado titulo={c.titulo} subtitulo={c.subtitulo} />
      <Aviso ok={params.ok} error={params.error} />

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[1fr_22rem]">
        <CalendarioMes
          mes={mes}
          items={items}
          ruta="/admin/calendario"
          locale={t.locale}
          textos={{ anterior: c.anterior, siguiente: c.siguiente, hoy: c.hoy, agenda: c.agenda, vacio: c.vacio, mas: c.mas }}
          leyenda={[
            { tipo: "evento", texto: c.leyEvento },
            { tipo: "asamblea", texto: c.leyAsamblea },
            { tipo: "servicio", texto: c.leyServicio },
            { tipo: "pago", texto: c.leyPago },
            { tipo: "solicitud", texto: c.leySolicitud },
          ]}
        />

        <div className="flex flex-col gap-4">
          <section className="tarjeta flex flex-col gap-4" aria-labelledby="h-nuevo">
            <h2 id="h-nuevo" className="text-lg font-bold">
              {c.nuevoEvento}
            </h2>
            <FormularioEvento t={t} fechaInicial={mes.clave === hoy.slice(0, 7) ? hoy : mes.desde} />
          </section>

          <section className="tarjeta flex flex-col gap-2" aria-labelledby="h-prox">
            <h2 id="h-prox" className="text-base font-bold">
              {c.proximos}
            </h2>
            {(proximos ?? []).length === 0 ? (
              <p className="text-sm text-suave">{c.sinProximos}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-linea-suave">
                {((proximos ?? []) as Evento[]).map((e) => (
                  <li key={e.id} className="flex flex-col gap-1 py-3">
                    <span className="text-xs font-semibold text-suave capitalize">
                      {fechaCorta(diaCR(e.inicio), t.locale)} · {t.categoriasEvento[e.categoria]}
                    </span>
                    <span className="text-sm font-semibold">{e.titulo}</span>
                    <span className="text-xs text-suave">{detalleEvento(e, t)}</span>
                    <details>
                      <summary className="cursor-pointer text-sm font-semibold text-acento">{c.editar}</summary>
                      <div className="mt-3 flex flex-col gap-3">
                        <FormularioEvento t={t} evento={e} fechaInicial={hoy} />
                        <form action={eliminarEvento}>
                          <input type="hidden" name="id" value={e.id} />
                          <button className="text-sm font-semibold text-peligro-texto hover:underline">{c.eliminar}</button>
                        </form>
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
