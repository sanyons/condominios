import Link from "next/link";
import { MarcoAuth } from "@/components/marco-auth";
import { Aviso, type BuscarParams } from "@/components/aviso";
import { registrarse } from "../acciones";

export const metadata = { title: "Crear cuenta" };

export default async function Registro({ searchParams }: { searchParams: BuscarParams }) {
  const { error } = await searchParams;
  return (
    <MarcoAuth titulo="Crear cuenta de administración">
      <p className="text-sm text-suave">
        Los residentes no se registran aquí: la administración los invita por correo.
      </p>
      <Aviso error={error} />
      <form action={registrarse} className="flex flex-col gap-4">
        <label className="etiqueta">
          Nombre
          <input className="campo" name="nombre" autoComplete="name" required />
        </label>
        <label className="etiqueta">
          Correo
          <input className="campo" type="email" name="email" autoComplete="email" required />
        </label>
        <label className="etiqueta">
          Contraseña (mínimo 8 caracteres)
          <input className="campo" type="password" name="password" minLength={8} autoComplete="new-password" required />
        </label>
        <button className="btn-primario">Crear cuenta</button>
      </form>
      <p className="text-sm text-suave">
        ¿Ya tiene cuenta?{" "}
        <Link href="/login" className="font-semibold text-marca">
          Iniciar sesión
        </Link>
      </p>
    </MarcoAuth>
  );
}
