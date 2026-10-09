import type { createClient } from "@/lib/supabase/server";
import type { Dict } from "@/lib/i18n";
import type { ItemCalendario, TipoItem } from "@/components/calendario-mes";
import { diaCR, hora, isoCR, sumarDias, type Mes } from "@/lib/fechas";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type Evento = {
  id: string;
  titulo: string;
  descripcion: string | null;
  ubicacion: string | null;
  categoria: string;
  inicio: string;
  fin: string | null;
  todo_el_dia: boolean;
};

const TIPO_CATEGORIA: Record<string, TipoItem> = {
  asamblea: "asamblea",
  mantenimiento: "servicio",
  servicios: "servicio",
  pagos: "pago",
};

/** Hora o "Todo el día", y el lugar si lo hay. */
export function detalleEvento(e: Evento, t: Dict) {
  const cuando = e.todo_el_dia
    ? t.calendario.todoElDia
    : e.fin && diaCR(e.fin) === diaCR(e.inicio)
      ? `${hora(e.inicio, t.locale)} – ${hora(e.fin, t.locale)}`
      : hora(e.inicio, t.locale);
  return [cuando, e.ubicacion].filter(Boolean).join(" · ");
}

/** Un evento de varios días aparece en cada día (máximo 31). */
function diasDeEvento(e: Evento) {
  const ini = diaCR(e.inicio);
  const fin = e.fin ? diaCR(e.fin) : ini;
  const dias = [ini];
  while (dias.length < 31 && dias[dias.length - 1] < fin) dias.push(sumarDias(dias[dias.length - 1], 1));
  return dias;
}

export function itemsDeEventos(eventos: Evento[], t: Dict): ItemCalendario[] {
  return eventos.flatMap((e) =>
    diasDeEvento(e).map((fecha, i) => ({
      id: `e-${e.id}-${i}`,
      fecha,
      titulo: e.titulo,
      detalle: [t.categoriasEvento[e.categoria], detalleEvento(e, t)].filter(Boolean).join(" · "),
      tipo: TIPO_CATEGORIA[e.categoria] ?? "evento",
    }))
  );
}

/** Eventos que tocan el mes (los de varios días que empezaron antes también). */
export async function eventosDelMes(supabase: SupabaseClient, condominioId: string, mes: Mes) {
  const { data } = await supabase
    .from("eventos")
    .select("id, titulo, descripcion, ubicacion, categoria, inicio, fin, todo_el_dia")
    .eq("condominio_id", condominioId)
    .gte("inicio", isoCR(sumarDias(mes.desde, -31)))
    .lt("inicio", isoCR(mes.hasta))
    .order("inicio");
  return ((data ?? []) as Evento[]).filter((e) => diaCR(e.fin ?? e.inicio) >= mes.desde);
}

/** Reservas del mes como elementos del calendario. */
export async function itemsDeReservas(
  supabase: SupabaseClient,
  condominioId: string,
  mes: Mes,
  t: Dict,
  unidades?: string[]
): Promise<ItemCalendario[]> {
  let q = supabase
    .from("reservas")
    .select("id, inicio, fin, estado, areas_comunes(nombre), unidades(codigo)")
    .eq("condominio_id", condominioId)
    .in("estado", ["solicitada", "confirmada"])
    .gte("inicio", isoCR(mes.desde))
    .lt("inicio", isoCR(mes.hasta))
    .order("inicio");
  if (unidades) q = q.in("unidad_id", unidades.length ? unidades : ["00000000-0000-0000-0000-000000000000"]);
  const { data } = await q;
  return ((data ?? []) as any[]).map((r) => ({
    id: `r-${r.id}`,
    fecha: diaCR(r.inicio),
    titulo: unidades ? r.areas_comunes?.nombre : t.calendario.reservaDe(r.areas_comunes?.nombre ?? "", r.unidades?.codigo ?? ""),
    detalle: `${hora(r.inicio, t.locale)} – ${hora(r.fin, t.locale)} · ${t.estadosReserva[r.estado]}`,
    tipo: (r.estado === "solicitada" ? "solicitud" : "reserva") as TipoItem,
  }));
}
