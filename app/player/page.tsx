"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { clearSession, getSession, SessionUser } from "@/lib/auth";
import { horariosDisponibles, slotToTime, formatFecha, formatHora } from "@/lib/schedule";

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
  no_asiste: boolean;
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

  // Realtime: cuando cualquier jugador elige, cambia o avisa que no asiste,
  // refrescamos para que todos vean el estado del grupo sin recargar.
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

    const result: MiSesionRow[] = [];
    for (const s of sesiones) {
      const { data: todos } = await supabase
        .from("session_players")
        .select(
          "id, session_id, user_id, slot_index, hora_asignada, confirmado, no_asiste, users(nombre)"
        )
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

  async function noPuedoAsistir(sessionPlayerId: string) {
    if (!user) return;
    if (!confirm("¿Confirmás que no podés asistir a esta sesión? Vas a liberar tu horario si ya habías elegido uno.")) {
      return;
    }
    // Se libera el horario automáticamente. Una vez marcado, solo el
    // kinesiólogo puede revertirlo (readmitir) desde el panel de admin.
    await supabase
      .from("session_players")
      .update({ no_asiste: true, slot_index: null, hora_asignada: null, confirmado: false })
      .eq("id", sessionPlayerId);
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
                {formatFecha(session.fecha)} · {formatHora(session.hora_inicio)} a {formatHora(session.hora_fin)}
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

              {miConvocatoria.no_asiste ? (
                <p className="text-sm bg-gray-100 text-gray-500 rounded-lg px-3 py-2 mb-3">
                  Avisaste que no podés asistir a esta sesión.
                </p>
              ) : (
                <div className="mb-3">
                  {miConvocatoria.confirmado ? (
                    <p className="text-sm bg-green-50 text-green-700 rounded-lg px-3 py-2 mb-2">
                      Tu horario: <b>{miConvocatoria.hora_asignada}</b>
                    </p>
                  ) : (
                    <>
                      <SelectorHorario
                        horaInicio={session.hora_inicio}
                        horaFin={session.hora_fin}
                        ocupados={ocupados}
                        onElegir={(slot) =>
                          elegirHorario(miConvocatoria.id, slot, session.hora_inicio, session.id)
                        }
                      />
                      {errores[session.id] && (
                        <p className="text-red-600 text-sm mt-2">{errores[session.id]}</p>
                      )}
                    </>
                  )}
                  <button
                    onClick={() => noPuedoAsistir(miConvocatoria.id)}
                    className="text-sm text-red-500 underline mt-2"
                  >
                    No puedo asistir
                  </button>
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
                      {c.no_asiste ? (
                        <span className="text-red-400">No asiste</span>
                      ) : (
                        <span className={c.confirmado ? "text-green-600" : "text-gray-400"}>
                          {c.confirmado ? c.hora_asignada : "Sin elegir"}
                        </span>
                      )}
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
  horaFin,
  ocupados,
  onElegir
}: {
  horaInicio: string;
  horaFin: string;
  ocupados: number[];
  onElegir: (slot: number) => void;
}) {
  const opciones = horariosDisponibles(horaInicio, horaFin, ocupados);

  return (
    <div>
      <p className="text-sm text-gray-600 mb-2">Elegí tu horario:</p>
      {opciones.length === 0 ? (
        <p className="text-sm text-gray-400">
          No quedan horarios disponibles dentro del rango de la sesión.
        </p>
      ) : (
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
      )}
    </div>
  );
}