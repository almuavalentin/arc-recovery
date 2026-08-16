"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { generarMensajeFinal } from "@/lib/schedule";

type Player = { id: string; nombre: string; dni: string };

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [sesion, setSesion] = useState<any>(null);
  const [jugadores, setJugadores] = useState<any[]>([]);
  const [jugadoresDisponibles, setJugadoresDisponibles] = useState<Player[]>([]);
  const [busquedaAgregar, setBusquedaAgregar] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [copiadoFinal, setCopiadoFinal] = useState(false);

  useEffect(() => {
    const u = getSession();
    if (!u || u.rol !== "admin") {
      router.replace("/login");
      return;
    }
    cargar();
  }, [id]);

  // Realtime: ver en vivo cómo los jugadores van eligiendo su horario o
  // avisando que no asisten.
  useEffect(() => {
    const channel = supabase
      .channel(`session_players_admin_${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "session_players", filter: `session_id=eq.${id}` },
        () => cargar()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  async function cargar() {
    const { data: s } = await supabase.from("sessions").select("*").eq("id", id).single();
    setSesion(s);

    const { data: sp } = await supabase
      .from("session_players")
      .select("id, user_id, prioridad, hora_asignada, confirmado, no_asiste, users(nombre)")
      .eq("session_id", id);
    setJugadores(sp || []);

    const { data: todos } = await supabase
      .from("users")
      .select("id, nombre, dni")
      .eq("rol", "jugador")
      .eq("activo", true)
      .order("nombre");

    const idsEnSesion = new Set((sp || []).map((j) => j.user_id));
    setJugadoresDisponibles((todos || []).filter((p) => !idsEnSesion.has(p.id)));
  }

  async function agregarJugador(userId: string) {
    await supabase.from("session_players").insert({ session_id: id, user_id: userId });
    cargar();
  }

  async function quitarJugador(sessionPlayerId: string, nombre: string) {
    if (!confirm(`¿Seguro que querés quitar a ${nombre} de esta sesión?`)) return;
    await supabase.from("session_players").delete().eq("id", sessionPlayerId);
    cargar();
  }

  async function readmitirJugador(sessionPlayerId: string) {
    await supabase.from("session_players").update({ no_asiste: false }).eq("id", sessionPlayerId);
    cargar();
  }

  async function copiarMensaje() {
    if (!sesion?.mensaje) return;
    await navigator.clipboard.writeText(sesion.mensaje);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  function mensajeFinal(): string | null {
    if (!sesion || jugadores.length === 0) return null;
    const activos = jugadores.filter((j) => !j.no_asiste);
    if (activos.length === 0 || !activos.every((j) => j.confirmado)) return null;
    return generarMensajeFinal({
      fecha: sesion.fecha,
      jugadores: activos.map((j) => ({ nombre: j.users?.nombre ?? "?", hora: j.hora_asignada }))
    });
  }

  async function copiarMensajeFinal() {
    const mensaje = mensajeFinal();
    if (!mensaje) return;
    await navigator.clipboard.writeText(mensaje);
    setCopiadoFinal(true);
    setTimeout(() => setCopiadoFinal(false), 2000);
  }

  async function cerrarSesion() {
    await supabase.from("sessions").update({ estado: "cerrada" }).eq("id", id);
    router.push("/admin");
  }

  if (!sesion) return null;

  const mensajeFinalTexto = mensajeFinal();
  const disponiblesFiltrados = jugadoresDisponibles.filter(
    (p) =>
      p.nombre.toLowerCase().includes(busquedaAgregar.toLowerCase()) ||
      p.dni.includes(busquedaAgregar)
  );

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6 max-w-lg mx-auto">
      <button onClick={() => router.push("/admin")} className="text-sm text-arc mb-4">
        ← Volver
      </button>

      <div className="bg-white rounded-2xl p-5 shadow mb-6">
        <h2 className="font-semibold mb-2">Mensaje para reenviar</h2>
        <pre className="whitespace-pre-wrap text-sm bg-gray-50 rounded-lg p-3 border">
          {sesion.mensaje}
        </pre>
        <button
          onClick={copiarMensaje}
          className="w-full mt-3 bg-arc text-white rounded-lg py-2 font-medium"
        >
          {copiado ? "¡Copiado!" : "Copiar mensaje"}
        </button>
      </div>

      <div className="bg-white rounded-2xl p-5 shadow mb-6">
        <h2 className="font-semibold mb-3">Estado de horarios</h2>
        <div className="space-y-2">
          {jugadores.map((j) => (
            <div key={j.id} className="flex justify-between items-center text-sm border-b pb-2">
              <span>
                {j.users?.nombre}
                {j.prioridad && <span className="text-arc-accent ml-1">★</span>}
              </span>
              <span className="flex items-center gap-2">
                {j.no_asiste ? (
                  <>
                    <span className="text-red-400">No asiste</span>
                    <button
                      onClick={() => readmitirJugador(j.id)}
                      className="text-xs text-arc underline"
                    >
                      Readmitir
                    </button>
                  </>
                ) : (
                  <span className={j.confirmado ? "text-green-600 font-medium" : "text-gray-400"}>
                    {j.confirmado ? j.hora_asignada : "Sin elegir"}
                  </span>
                )}
                <button
                  onClick={() => quitarJugador(j.id, j.users?.nombre ?? "este jugador")}
                  className="text-xs text-gray-400 hover:text-red-500"
                  title="Quitar de la sesión"
                >
                  ✕
                </button>
              </span>
            </div>
          ))}
          {jugadores.length === 0 && (
            <p className="text-sm text-gray-400">Todavía no hay jugadores convocados.</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl p-5 shadow mb-6">
        <h2 className="font-semibold mb-3">Agregar jugador a esta sesión</h2>
        <input
          className="w-full border rounded-lg px-3 py-2 mb-2"
          placeholder="Filtrar por nombre o DNI..."
          value={busquedaAgregar}
          onChange={(e) => setBusquedaAgregar(e.target.value)}
        />
        <div className="max-h-56 overflow-y-auto border rounded-lg divide-y">
          {disponiblesFiltrados.map((p) => (
            <div key={p.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <span>
                {p.nombre} <span className="text-gray-400 text-xs">DNI {p.dni}</span>
              </span>
              <button
                onClick={() => agregarJugador(p.id)}
                className="text-xs bg-arc text-white rounded-full px-3 py-1"
              >
                Agregar
              </button>
            </div>
          ))}
          {disponiblesFiltrados.length === 0 && (
            <p className="px-3 py-2 text-sm text-gray-400">Sin resultados.</p>
          )}
        </div>
      </div>

      {mensajeFinalTexto && (
        <div className="bg-white rounded-2xl p-5 shadow mb-6">
          <h2 className="font-semibold mb-2">Todos eligieron — mensaje final</h2>
          <pre className="whitespace-pre-wrap text-sm bg-gray-50 rounded-lg p-3 border">
            {mensajeFinalTexto}
          </pre>
          <button
            onClick={copiarMensajeFinal}
            className="w-full mt-3 bg-arc text-white rounded-lg py-2 font-medium"
          >
            {copiadoFinal ? "¡Copiado!" : "Copiar mensaje final"}
          </button>
        </div>
      )}

      <button onClick={cerrarSesion} className="w-full border border-gray-300 rounded-lg py-2 text-sm text-gray-600">
        Cerrar sesión
      </button>
    </div>
  );
}