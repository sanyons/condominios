export function Encabezado({
  titulo,
  subtitulo,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1">
        {subtitulo && <span className="text-sm font-medium text-suave">{subtitulo}</span>}
        <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">{titulo}</h1>
      </div>
      {children && <div className="flex flex-wrap items-center gap-3">{children}</div>}
    </header>
  );
}
