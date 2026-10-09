import { redirect } from "next/navigation";
import { obtenerContexto } from "@/lib/contexto";

export default async function Inicio() {
  const ctx = await obtenerContexto();
  if (!ctx.condominioId) redirect("/onboarding");
  if (ctx.condominiosAdmin > 1) redirect("/admin/condominios");
  redirect(ctx.esAdmin ? "/admin" : "/residente");
}
