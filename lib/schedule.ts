// Lógica del circuito de recovery.
// Circuito: 5 min hielo -> 5 min sauna -> 5 min botas (15 min total por jugador).
// Como hay 1 unidad de cada material, un jugador nuevo puede entrar cada 5 min
// (apenas el anterior libera el hielo), permitiendo hasta 3 jugadores en simultáneo.
//
// slot_index 0 = hora_inicio, slot_index 1 = hora_inicio + 5min, etc.

export const SLOT_MINUTES = 5;
export const CIRCUIT_MINUTES = 15; // hielo + sauna + botas

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Calcula la hora asignada para un slot dado
export function slotToTime(horaInicio: string, slotIndex: number): string {
  return minutesToTime(timeToMinutes(horaInicio) + slotIndex * SLOT_MINUTES);
}

// Calcula la hora de fin de la sesión según la cantidad de jugadores
export function calcularHoraFin(horaInicio: string, cantidadJugadores: number): string {
  if (cantidadJugadores === 0) return horaInicio;
  const finMinutos =
    timeToMinutes(horaInicio) + (cantidadJugadores - 1) * SLOT_MINUTES + CIRCUIT_MINUTES;
  return minutesToTime(finMinutos);
}

// Genera la lista de horarios disponibles para que un jugador elija,
// excluyendo los ya tomados y los que no entrarían completos antes
// del cierre de la sala (hora_fin). El circuito dura 15 min, así que
// el último horario habilitado es: hora_fin - 15 min.
export function horariosDisponibles(
  horaInicio: string,
  horaFin: string,
  slotsOcupados: number[]
): { slotIndex: number; hora: string }[] {
  const disponibles: { slotIndex: number; hora: string }[] = [];
  const limiteInicioMinutos = timeToMinutes(horaFin) - CIRCUIT_MINUTES;

  let i = 0;
  while (true) {
    const inicioMinutos = timeToMinutes(horaInicio) + i * SLOT_MINUTES;
    if (inicioMinutos > limiteInicioMinutos) break;
    if (!slotsOcupados.includes(i)) {
      disponibles.push({ slotIndex: i, hora: minutesToTime(inicioMinutos) });
    }
    i++;
  }
  return disponibles;
}

export function generarMensaje(params: {
  fecha: string;
  horaInicio: string;
  horaFin: string;
  hielo: boolean;
  sauna: boolean;
  botas: boolean;
  jugadores: string[];
}): string {
  const materiales = [
    params.hielo ? "Hielo" : null,
    params.sauna ? "Sauna" : null,
    params.botas ? "Botas de compresión" : null
  ]
    .filter(Boolean)
    .join(", ");

  const [y, m, d] = params.fecha.split("-");
  const fechaLegible = `${d}/${m}/${y}`;

  return `🏉 ARC Recovery - Sesión convocada

📅 Fecha: ${fechaLegible}
🕐 Horario de sala: ${params.horaInicio} a ${params.horaFin}
🧊 Material disponible: ${materiales}

Circuito: 5 min hielo + 5 min sauna + 5 min botas de compresión.
Ingresá a la app y elegí tu horario dentro de la ventana disponible.
Por favor sé puntual: si llegás tarde, tu lugar puede ser ocupado por otro jugador en espera.

Convocados:
${params.jugadores.map((n) => `• ${n}`).join("\n")}

Cualquier duda, hablá con el kinesiólogo.`;
}

// Mensaje final con la lista completa de horarios ya confirmados,
// ordenados cronológicamente, para reenviar una vez que todos eligieron.
export function generarMensajeFinal(params: {
  fecha: string;
  jugadores: { nombre: string; hora: string }[];
}): string {
  const [y, m, d] = params.fecha.split("-");
  const fechaLegible = `${d}/${m}/${y}`;

  const ordenados = [...params.jugadores].sort((a, b) => a.hora.localeCompare(b.hora));

  return `🏉 ARC Recovery - Horarios confirmados

📅 Fecha: ${fechaLegible}

${ordenados.map((j) => `• ${j.hora} - ${j.nombre}`).join("\n")}

¡Nos vemos en la sala!`;
}

// Formatea fecha ISO (YYYY-MM-DD, tal como la guarda Postgres) a DD-MM-YYYY
export function formatFecha(fecha: string): string {
  const [y, m, d] = fecha.split("-");
  return `${d}-${m}-${y}`;
}

// Postgres devuelve las columnas `time` como "HH:MM:SS" — recortamos los segundos
export function formatHora(hora: string): string {
  return hora.slice(0, 5);
}

// Calcula cuántos jugadores entran en una ventana fija de horario,
// completando cada uno el circuito completo (15 min) antes de hora_fin.
export function capacidadMaxima(horaInicio: string, horaFin: string): number {
  const diff = timeToMinutes(horaFin) - timeToMinutes(horaInicio);
  if (diff < CIRCUIT_MINUTES) return 0;
  return Math.floor((diff - CIRCUIT_MINUTES) / SLOT_MINUTES) + 1;
}