import Link from "next/link";
import { MarcoAuth } from "@/components/marco-auth";
import { Aviso, type BuscarParams } from "@/components/aviso";
import { iniciarSesion, enviarEnlaceRecuperacion } from "../acciones";

export const metadata = { title: "Iniciar sesión" };

export default async function Login({ searchParams }: { searchParams: BuscarParams }) {
  const { ok, error } = await searchParams;
  return (
    <MarcoAuth titulo="Iniciar sesión">
      <Aviso ok={ok} error={error} />
      <form action={iniciarSesion} className="flex flex-col gap-4">
        <label className="etiqueta">
          Correo
          <input className="campo" type="email" name="email" autoComplete="email" required />
        </label>
        <label className="etiqueta">
          Contraseña
          <input className="campo" type="password" name="password" autoComplete="current-password" required />
        </label>
        <button className="btn-primario">Entrar</button>
      </form>
      <details className="text-sm">
        <summary className="cursor-pointer font-semibold text-marca">¿Olvidó su contraseña?</summary>
        <form action={enviarEnlaceRecuperacion} className="mt-3 flex flex-col gap-3">
          <label className="etiqueta">
            Correo
            <input className="campo" type="email" name="email" required />
          </label>
          <button className="btn-secundario">Enviar enlace</button>
        </form>
      </details>
      <p className="text-sm text-suave">
        ¿Administra un condominio y no tiene cuenta?{" "}
        <Link href="/registro" className="font-semibold text-marca">
          Crear cuenta
        </Link>
      </p>
    </MarcoAuth>
  );
}
