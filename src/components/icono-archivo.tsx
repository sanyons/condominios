/** Etiqueta de color según el tipo de archivo (PDF, DOC, XLS, IMG…). */
export function IconoArchivo({ tipo }: { tipo?: string | null }) {
  const t = tipo ?? "";
  const [texto, tono] = t.includes("pdf")
    ? ["PDF", "tono-peligro"]
    : t.includes("word")
      ? ["DOC", "tono-neutro"]
      : t.includes("sheet") || t.includes("excel") || t.includes("csv")
        ? ["XLS", "tono-ok"]
        : t.includes("presentation") || t.includes("powerpoint")
          ? ["PPT", "tono-alerta"]
          : t.startsWith("image/")
            ? ["IMG", "tono-neutro"]
            : ["DOC", "tono-neutro"];
  return (
    <span aria-hidden="true" className={`flex h-10 w-8 shrink-0 items-center justify-center rounded-md text-[10px] font-bold ${tono}`}>
      {texto}
    </span>
  );
}

/** Tamaño legible: 820 KB, 3,4 MB. */
export function peso(bytes: number | null | undefined, locale: string) {
  if (!bytes) return null;
  const n = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  return bytes < 1024 * 1024 ? `${n.format(Math.max(1, bytes / 1024))} KB` : `${n.format(bytes / 1024 / 1024)} MB`;
}
