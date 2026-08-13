"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { generarMensajeFinal } from "@/lib/schedule";

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [sesion, setSesion] = useState<any>(null);
  const [jugadores, setJugadores] = useState<any[]>([]);
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

  // Realtime: ver en vivo cómo los jugadores van eligiendo su horario.
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
      .select("id, user_id, prioridad, hora_asignada, confirmado, users(nombre)")
      .eq("session_id", id);
    setJugadores(sp || []);
  }

  async function copiarMensaje() {
    if (!sesion?.mensaje) return;
    await navigator.clipboard.writeText(sesion.mensaje);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  function mensajeFinal(): string | null {
    if (!sesion || jugadores.length === 0) return null;
    const todosConfirmaron = jugadores.every((j) => j.confirmado);
    if (!todosConfirmaron) return null;
    return generarMensajeFinal({
      fecha: sesion.fecha,
      jugadores: jugadores.map((j) => ({ nombre: j.users?.nombre ?? "?", hora: j.hora_asignada }))
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
              <span className={j.confirmado ? "text-green-600 font-medium" : "text-gray-400"}>
                {j.confirmado ? j.hora_asignada : "Sin elegir"}
              </span>
            </div>
          ))}
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