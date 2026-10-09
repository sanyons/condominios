import { redirect } from "next/navigation";
import { obtenerContexto } from "@/lib/contexto";

export default async function Inicio() {
  const ctx = await obtenerContexto();
  if (!ctx.condominioId) redirect("/onboarding");
  if (ctx.condominiosAdmin > 1) redirect("/admin/condominios");
  // Propietario con casas en varios condominios: primero el resumen de todas
  if (ctx.condominiosAdmin === 0 && ctx.condominios.length > 1 && ctx.propiedades > 1) redirect("/residente/propiedades");
  redirect(ctx.esAdmin ? "/admin" : "/residente");
}
