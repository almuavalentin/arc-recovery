"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { clearSession, getSession, SessionUser } from "@/lib/auth";
import { horariosDisponibles } from "@/lib/schedule";

type SessionRow = {
  id: string;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  hielo: boolean;
  sauna: boolean;
  botas: boolean;
  estado: string;
};

type SessionPlayerRow = {
  id: string;
  session_id: string;
  slot_index: number | null;
  hora_asignada: string | null;
  confirmado: boolean;
};

export default function PlayerPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [mensajeOk, setMensajeOk] = useState("");

  const [misSesiones, setMisSesiones] = useState<
    { session: SessionRow; convocatoria: SessionPlayerRow; ocupados: number[] }[]
  >([]);

  useEffect(() => {
    const u = getSession();
    if (!u) {
      router.replace("/login");
      return;
    }
    setUser(u);
    cargarSesiones(u.id);
  }, [router]);

  async function cargarSesiones(userId: string) {
    const { data: convocatorias } = await supabase
      .from("session_players")
      .select("id, session_id, slot_index, hora_asignada, confirmado")
      .eq("user_id", userId);

    if (!convocatorias || convocatorias.length === 0) {
      setMisSesiones([]);
      return;
    }

    const sessionIds = convocatorias.map((c) => c.session_id);
    const { data: sesiones } = await supabase
      .from("sessions")
      .select("*")
      .in("id", sessionIds)
      .eq("estado", "abierta");

    if (!sesiones) return;

    const result = [];
    for (const s of sesiones) {
      const { data: todos } = await supabase
        .from("session_players")
        .select("slot_index")
        .eq("session_id", s.id)
        .not("slot_index", "is", null);

      const ocupados = (todos || []).map((t) => t.slot_index as number);
      const conv = convocatorias.find((c) => c.session_id === s.id)!;
      result.push({ session: s, convocatoria: conv, ocupados });
    }
    setMisSesiones(result);
  }

  async function solicitarRecovery() {
    if (!user) return;
    setEnviando(true);
    setMensajeOk("");
    const { error } = await supabase.from("recovery_requests").insert({
      user_id: user.id,
      comentario: comentario.trim() || null
    });
    setEnviando(false);
    if (!error) {
      setMensajeOk("Solicitud enviada. El kinesiólogo la va a ver al armar la próxima sesión.");
      setComentario("");
    }
  }

  async function elegirHorario(sessionPlayerId: string, slotIndex: number) {
    await supabase
      .from("session_players")
      .update({ slot_index: slotIndex, confirmado: true })
      .eq("id", sessionPlayerId);
    if (user) cargarSesiones(user.id);
  }

  function logout() {
    clearSession();
    router.push("/login");
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6 max-w-lg mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-bold text-arc">ARC Recovery</h1>
          <p className="text-sm text-gray-500">Hola, {user.nombre}</p>
        </div>
        <button onClick={logout} className="text-sm text-gray-400">
          Salir
        </button>
      </div>

      {/* Solicitar recovery */}
      <div className="bg-white rounded-2xl p-5 shadow mb-6">
        <h2 className="font-semibold mb-3">Solicitar recovery</h2>
        <textarea
          className="w-full border rounded-lg px-3 py-2 text-sm mb-3"
          rows={2}
          placeholder="Comentario opcional (ej: dolor en gemelo derecho)"
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
        />
        <button
          onClick={solicitarRecovery}
          disabled={enviando}
          className="w-full bg-arc text-white rounded-lg py-2 font-medium disabled:opacity-50"
        >
          {enviando ? "Enviando..." : "Solicitar recovery"}
        </button>
        {mensajeOk && <p className="text-green-600 text-sm mt-2">{mensajeOk}</p>}
      </div>

      {/* Sesiones convocado */}
      <div className="space-y-4">
        <h2 className="font-semibold">Tus sesiones convocadas</h2>
        {misSesiones.length === 0 && (
          <p className="text-sm text-gray-500">
            Todavía no fuiste convocado a ninguna sesión abierta.
          </p>
        )}
        {misSesiones.map(({ session, convocatoria, ocupados }) => {
          const totalJugadores = ocupados.length + (convocatoria.slot_index === null ? 1 : 0);
          // Para calcular disponibles necesitamos el total de convocados de la sesión
          return (
            <div key={session.id} className="bg-white rounded-2xl p-5 shadow">
              <p className="font-medium">
                {session.fecha} · {session.hora_inicio} a {session.hora_fin}
              </p>
              <p className="text-sm text-gray-500 mb-3">
                {[
                  session.hielo && "Hielo",
                  session.sauna && "Sauna",
                  session.botas && "Botas"
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>

              {convocatoria.confirmado ? (
                <p className="text-sm bg-green-50 text-green-700 rounded-lg px-3 py-2">
                  Tu horario: <b>{convocatoria.hora_asignada}</b>
                </p>
              ) : (
                <SelectorHorario
                  sessionId={session.id}
                  horaInicio={session.hora_inicio}
                  ocupados={ocupados}
                  onElegir={(slot) => elegirHorario(convocatoria.id, slot)}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SelectorHorario({
  sessionId,
  horaInicio,
  ocupados,
  onElegir
}: {
  sessionId: string;
  horaInicio: string;
  ocupados: number[];
  onElegir: (slot: number) => void;
}) {
  // Rango razonable de slots a mostrar: ocupados + 6 posiciones más para elegir
  const maxSlot = Math.max(6, ...ocupados.map((o) => o + 3));
  const opciones = horariosDisponibles(horaInicio, maxSlot, ocupados);

  return (
    <div>
      <p className="text-sm text-gray-600 mb-2">Elegí tu horario:</p>
      <div className="grid grid-cols-3 gap-2">
        {opciones.slice(0, 6).map((op) => (
          <button
            key={op.slotIndex}
            onClick={() => onElegir(op.slotIndex)}
            className="border border-arc text-arc rounded-lg py-2 text-sm font-medium"
          >
            {op.hora}
          </button>
        ))}
      </div>
    </div>
  );
}
