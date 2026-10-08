import { elegirCondominio } from "@/app/acciones-comunes";

/** Cambia de condominio (solo se muestra si el usuario pertenece a varios). */
export function SelectorCondominio({
  actual,
  condominios,
}: {
  actual: string;
  condominios: { id: string; nombre: string }[];
}) {
  if (condominios.length < 2) return <p className="truncate text-sm font-semibold">{condominios[0]?.nombre}</p>;
  return (
    <form action={elegirCondominio} className="flex gap-2">
      <label className="sr-only" htmlFor="condominio_id">
        Condominio
      </label>
      <select id="condominio_id" name="condominio_id" defaultValue={actual} className="campo font-semibold">
        {condominios.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nombre}
          </option>
        ))}
      </select>
      <button className="btn-secundario">Ir</button>
    </form>
  );
}
