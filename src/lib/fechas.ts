/**
 * Fechas en hora de Costa Rica (UTC−6 todo el año, sin horario de verano).
 * Las fechas "de calendario" se manejan como texto AAAA-MM-DD para no
 * depender de la zona horaria del servidor.
 */
export const ZONA = "America/Costa_Rica";

/** AAAA-MM-DD + HH:MM en Costa Rica → ISO con desplazamiento. */
export function isoCR(fecha: string, hora = "00:00") {
  return `${fecha}T${hora.slice(0, 5)}:00-06:00`;
}

/** Fecha de calendario en Costa Rica (AAAA-MM-DD) de un instante. */
export function diaCR(valor: string | Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(new Date(valor));
}

/** Hora en Costa Rica como HH:MM (24 h). */
export function horaCR24(valor: string | Date) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: ZONA, hour: "2-digit", minute: "2-digit", hour12: false }).format(
    new Date(valor)
  );
}

/** Hora legible en el idioma de la persona (3:00 p. m. / 3:00 PM). */
export function hora(valor: string | Date, locale: string) {
  return new Intl.DateTimeFormat(locale, { timeZone: ZONA, hour: "numeric", minute: "2-digit" }).format(new Date(valor));
}

/** "HH:MM:SS" de Postgres → hora legible. */
export function horaDeTexto(t: string, locale: string) {
  const [h, m] = t.split(":").map(Number);
  return new Intl.DateTimeFormat(locale, { timeZone: "UTC", hour: "numeric", minute: "2-digit" }).format(
    new Date(Date.UTC(2000, 0, 1, h, m))
  );
}

function utc(fecha: string) {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function texto(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function sumarDias(fecha: string, n: number) {
  const d = utc(fecha);
  d.setUTCDate(d.getUTCDate() + n);
  return texto(d);
}

/** Fecha larga: "martes 14 de octubre". */
export function fechaLarga(fecha: string, locale: string, conAnio = false) {
  return new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(conAnio ? { year: "numeric" } : {}),
  }).format(utc(fecha));
}

/** Fecha corta con día: "mar 14 oct". */
export function fechaCorta(fecha: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(
    utc(fecha)
  );
}

export type Mes = {
  clave: string; // AAAA-MM
  desde: string; // primer día
  hasta: string; // primer día del mes siguiente
  anterior: string;
  siguiente: string;
  nombre: string;
};

/** Mes pedido por parámetro (?mes=AAAA-MM) o el actual en Costa Rica. */
export function mesDe(param: string | undefined, locale: string): Mes {
  const hoy = diaCR(new Date());
  const clave = param && /^\d{4}-(0[1-9]|1[0-2])$/.test(param) ? param : hoy.slice(0, 7);
  const desde = `${clave}-01`;
  const [y, m] = clave.split("-").map(Number);
  const sig = new Date(Date.UTC(y, m, 1));
  const ant = new Date(Date.UTC(y, m - 2, 1));
  return {
    clave,
    desde,
    hasta: texto(sig),
    anterior: texto(ant).slice(0, 7),
    siguiente: texto(sig).slice(0, 7),
    nombre: new Intl.DateTimeFormat(locale, { timeZone: "UTC", month: "long", year: "numeric" }).format(utc(desde)),
  };
}

/** Semanas (lunes a domingo) que cubren el mes. */
export function semanasDelMes(mes: Mes) {
  const primero = utc(mes.desde);
  const corrimiento = (primero.getUTCDay() + 6) % 7; // lunes = 0
  let dia = sumarDias(mes.desde, -corrimiento);
  const semanas: { fecha: string; delMes: boolean }[][] = [];
  while (semanas.length === 0 || dia < mes.hasta) {
    const semana = [];
    for (let i = 0; i < 7; i++) {
      semana.push({ fecha: dia, delMes: dia >= mes.desde && dia < mes.hasta });
      dia = sumarDias(dia, 1);
    }
    semanas.push(semana);
  }
  return semanas;
}

/** Nombres cortos de los días, empezando en lunes. */
export function nombresDias(locale: string) {
  return Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { timeZone: "UTC", weekday: "short" }).format(new Date(Date.UTC(2024, 0, 1 + i)))
  );
}
