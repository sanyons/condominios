import { Preferencias } from "@/components/preferencias";

export function MarcoAuth({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <img src="/icon.svg" alt="" width={36} height={36} />
            <span className="text-xl font-bold tracking-tight">Vecindo</span>
          </div>
          <Preferencias compacto />
        </div>
        <div className="tarjeta flex flex-col gap-5">
          <h1 className="text-xl font-bold">{titulo}</h1>
          {children}
        </div>
      </div>
    </main>
  );
}
