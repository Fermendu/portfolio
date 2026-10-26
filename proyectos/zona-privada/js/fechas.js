// ===== Fechas =====
// Las semanas se identifican por su lunes, escrito como "2026-10-26".
// Se trabaja siempre en hora local para que el lunes no se mueva por la zona horaria.

export const NOMBRES_DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

// Date → "2026-10-26"
export function aTexto(fecha) {
  const a = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  const d = String(fecha.getDate()).padStart(2, "0");
  return `${a}-${m}-${d}`;
}

// "2026-10-26" → Date (a las 12:00 para evitar líos con el cambio de hora)
export function deTexto(texto) {
  const [a, m, d] = texto.split("-").map(Number);
  return new Date(a, m - 1, d, 12);
}

// Lunes de la semana de una fecha
export function lunesDe(fecha = new Date()) {
  const copia = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 12);
  const diaSemana = (copia.getDay() + 6) % 7; // lunes = 0 … domingo = 6
  copia.setDate(copia.getDate() - diaSemana);
  return aTexto(copia);
}

export function sumarDias(texto, dias) {
  const fecha = deTexto(texto);
  fecha.setDate(fecha.getDate() + dias);
  return aTexto(fecha);
}

// "2026-10-26" → "26 oct"
export function fechaCorta(texto) {
  const fecha = deTexto(texto);
  return `${fecha.getDate()} ${MESES_CORTOS[fecha.getMonth()]}`;
}

// Número de semanas entre dos lunes (positivo si b es posterior)
export function semanasEntre(lunesA, lunesB) {
  const ms = deTexto(lunesB) - deTexto(lunesA);
  return Math.round(ms / (7 * 24 * 60 * 60 * 1000));
}
