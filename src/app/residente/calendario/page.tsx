import type { Metadata } from "next";
import { contextoResidente } from "@/lib/contexto";
import { dic } from "@/lib/i18n";
import { type BuscarParams } from "@/components/aviso";
import { CalendarioMes, type ItemCalendario } from "@/components/calendario-mes";
import { mesDe } from "@/lib/fechas";
import { eventosDelMes, itemsDeEventos, itemsDeReservas } from "@/lib/calendario";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await dic()).calendario.titulo };
}

/** Fechas importantes del condominio, mis reservas y mis vencimientos. */
export default async function CalendarioResidente({ searchParams }: { searchParams: BuscarParams }) {
  const params = await searchParams;
  const [ctx, t] = await Promise.all([contextoResidente(), dic()]);
  const c = t.calendario;
  const mes = mesDe(params.mes, t.locale);
  const ids = ctx.unidades.map((u) => u.id);

  const [eventos, reservas, { data: cargos }] = await Promise.all([
    eventosDelMes(ctx.supabase, ctx.condominioId, mes),
    itemsDeReservas(ctx.supabase, ctx.condominioId, mes, t, ids),
    ctx.supabase
      .from("cargos")
      .select("id, concepto, fecha_vence, unidades(codigo)")
      .in("unidad_id", ids)
      .gt("saldo", 0)
      .neq("estado", "anulado")
      .gte("fecha_vence", mes.desde)
      .lt("fecha_vence", mes.hasta),
  ]);

  const items: ItemCalendario[] = [
    ...itemsDeEventos(eventos, t),
    ...reservas,
    ...((cargos ?? []) as any[]).map((k) => ({
      id: `c-${k.id}`,
      fecha: k.fecha_vence,
      titulo: c.venceCargo(k.concepto),
      detalle: ids.length > 1 ? k.unidades?.codigo : undefined,
      tipo: "pago" as const,
    })),
  ];

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">{c.titulo}</h1>
        <p className="text-sm text-suave">{c.subtitulo}</p>
      </div>
      <CalendarioMes
        mes={mes}
        items={items}
        ruta="/residente/calendario"
        locale={t.locale}
        textos={{ anterior: c.anterior, siguiente: c.siguiente, hoy: c.hoy, agenda: c.agenda, vacio: c.vacio, mas: c.mas }}
        leyenda={[
          { tipo: "evento", texto: c.leyEvento },
          { tipo: "asamblea", texto: c.leyAsamblea },
          { tipo: "servicio", texto: c.leyServicio },
          { tipo: "reserva", texto: c.leyReserva },
          { tipo: "pago", texto: c.leyPago },
        ]}
      />
    </>
  );
}
