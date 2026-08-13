"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { clearSession, getSession, SessionUser } from "@/lib/auth";
import { horariosDisponibles, slotToTime } from "@/lib/schedule";

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
  user_id: string;
  slot_index: number | null;
  hora_asignada: string | null;
  confirmado: boolean;
  users?: { nombre: string } | null;
};

type MiSesionRow = {
  session: SessionRow;
  convocados: SessionPlayerRow[];
  miConvocatoria: SessionPlayerRow;
};

export default function PlayerPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [mensajeOk, setMensajeOk] = useState("");

  const [misSesiones, setMisSesiones] = useState<MiSesionRow[]>([]);
  const [errores, setErrores] = useState<Record<string, string>>({});

  useEffect(() => {
    const u = getSession();
    if (!u) {
      router.replace("/login");
      return;
    }
    setUser(u);
    cargarSesiones(u.id);
  }, [router]);

  // Realtime: cuando cualquier jugador elige o cambia su horario, refrescamos
  // la lista para que todos vean los picks del grupo sin recargar la página.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("session_players_player_view")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "session_players" },
        () => cargarSesiones(user.id)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  async function cargarSesiones(userId: string) {
    const { data: convocatorias } = await supabase
      .from("session_players")
      .select("id, session_id")
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
        .select("id, session_id, user_id, slot_index, hora_asignada, confirmado, users(nombre)")
        .eq("session_id", s.id);

      const convocados = (todos || []) as unknown as SessionPlayerRow[];
      const miConvocatoria = convocados.find((c) => c.user_id === userId);
      if (!miConvocatoria) continue;
      result.push({ session: s, convocados, miConvocatoria });
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

  async function elegirHorario(
    sessionPlayerId: string,
    slotIndex: number,
    horaInicio: string,
    sessionId: string
  ) {
    if (!user) return;
    setErrores((prev) => ({ ...prev, [sessionId]: "" }));

    const hora = slotToTime(horaInicio, slotIndex);

    // El filtro .is("slot_index", null) evita pisar tu propia elección si
    // llegaran a dispararse dos clicks. La unicidad entre DISTINTOS
    // jugadores la garantiza el índice único de la base (session_id, slot_index).
    const { error } = await supabase
      .from("session_players")
      .update({ slot_index: slotIndex, hora_asignada: hora, confirmado: true })
      .eq("id", sessionPlayerId)
      .is("slot_index", null);

    if (error) {
      const msg =
        error.code === "23505"
          ? "Ese horario ya fue tomado por otro jugador, elegí otro."
          : "No se pudo guardar tu horario. Intentá de nuevo.";
      setErrores((prev) => ({ ...prev, [sessionId]: msg }));
    }
    cargarSesiones(user.id);
  }

  function logout() {
    clearSession();
    router.push("/login");
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6 max-w-lg mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="" className="w-9 h-9 rounded-full" />
          <div>
            <h1 className="text-xl font-bold text-arc">ARC Recovery</h1>
            <p className="text-sm text-gray-500">Hola, {user.nombre}</p>
          </div>
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
        {misSesiones.map(({ session, convocados, miConvocatoria }) => {
          const ocupados = convocados
            .filter((c) => c.slot_index !== null)
            .map((c) => c.slot_index as number);

          const listaOrdenada = [...convocados].sort((a, b) => {
            if (a.slot_index === null && b.slot_index === null) return 0;
            if (a.slot_index === null) return 1;
            if (b.slot_index === null) return -1;
            return a.slot_index - b.slot_index;
          });

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

              {miConvocatoria.confirmado ? (
                <p className="text-sm bg-green-50 text-green-700 rounded-lg px-3 py-2 mb-3">
                  Tu horario: <b>{miConvocatoria.hora_asignada}</b>
                </p>
              ) : (
                <div className="mb-3">
                  <SelectorHorario
                    horaInicio={session.hora_inicio}
                    ocupados={ocupados}
                    onElegir={(slot) =>
                      elegirHorario(miConvocatoria.id, slot, session.hora_inicio, session.id)
                    }
                  />
                  {errores[session.id] && (
                    <p className="text-red-600 text-sm mt-2">{errores[session.id]}</p>
                  )}
                </div>
              )}

              {/* Resumen: quién eligió cada horario, para coordinar entre jugadores.
                  Se muestra siempre, aunque el jugador ya haya elegido el suyo. */}
              <div className="border-t pt-3">
                <p className="text-sm text-gray-600 mb-2">Horarios del grupo:</p>
                <div className="space-y-1">
                  {listaOrdenada.map((c) => (
                    <div
                      key={c.id}
                      className={`flex justify-between text-sm ${
                        c.user_id === user.id ? "font-semibold text-arc" : ""
                      }`}
                    >
                      <span>{c.users?.nombre}</span>
                      <span className={c.confirmado ? "text-green-600" : "text-gray-400"}>
                        {c.confirmado ? c.hora_asignada : "Sin elegir"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SelectorHorario({
  horaInicio,
  ocupados,
  onElegir
}: {
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