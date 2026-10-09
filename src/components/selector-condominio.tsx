import { cookies } from "next/headers";
import { dic } from "@/lib/i18n";
import { CambiarCondominio } from "@/components/cambiar-condominio";

/**
 * Condominio activo. Con un solo condominio (y sin poder agregar) muestra solo el nombre;
 * si no, un selector con buscador, recientes y atajo Ctrl+K.
 */
export async function SelectorCondominio({
  actual,
  condominios,
  puedeAgregar = false,
  mostrarCartera = false,
}: {
  actual: string;
  condominios: { id: string; nombre: string }[];
  puedeAgregar?: boolean;
  mostrarCartera?: boolean;
}) {
  const [t, jar] = await Promise.all([dic(), cookies()]);
  const nombreActual = condominios.find((c) => c.id === actual)?.nombre ?? "";

  if (condominios.length < 2 && !puedeAgregar) {
    return <p className="text-sm leading-snug font-semibold">{nombreActual}</p>;
  }

  const recientes = (jar.get("condos_recientes")?.value ?? "").split(",").filter(Boolean);

  return (
    <CambiarCondominio
      actual={{ id: actual, nombre: nombreActual }}
      condominios={condominios}
      recientes={recientes}
      puedeAgregar={puedeAgregar}
      mostrarCartera={mostrarCartera}
      textos={{
        condominio: t.comun.condominio,
        cambiar: t.comun.cambiarCondominio,
        buscar: t.comun.buscarCondominio,
        recientes: t.comun.recientes,
        todos: t.comun.todos,
        sinResultados: t.comun.sinResultados,
        agregar: t.comun.agregarCondominio,
        verCartera: t.comun.verCartera,
        atajo: t.comun.atajo,
      }}
    />
  );
}
