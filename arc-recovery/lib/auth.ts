// Autenticación simple con PIN de 4 dígitos.
// No es grado bancario, pero alcanza para un uso interno de equipo.

export async function hashPin(pin: string): Promise<string> {
  const enc = new TextEncoder().encode(pin);
  const digest = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export type SessionUser = {
  id: string;
  nombre: string;
  rol: "jugador" | "admin";
};

const STORAGE_KEY = "arc_recovery_user";

export function saveSession(user: SessionUser) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

export function getSession(): SessionUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}
