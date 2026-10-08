import { MarcoAuth } from "@/components/marco-auth";
import { Aviso, type BuscarParams } from "@/components/aviso";
import { cambiarClave } from "@/app/(auth)/acciones";

export const metadata = { title: "Definir contraseña" };

export default async function Clave({ searchParams }: { searchParams: BuscarParams }) {
  const { error } = await searchParams;
  return (
    <MarcoAuth titulo="Defina su contraseña">
      <Aviso error={error} />
      <form action={cambiarClave} className="flex flex-col gap-4">
        <label className="etiqueta">
          Nueva contraseña (mínimo 8 caracteres)
          <input className="campo" type="password" name="password" minLength={8} autoComplete="new-password" required />
        </label>
        <button className="btn-primario">Guardar y continuar</button>
      </form>
    </MarcoAuth>
  );
}
