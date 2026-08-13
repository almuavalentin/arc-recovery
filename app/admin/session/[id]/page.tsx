"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getSession } from "@/lib/auth";

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [sesion, setSesion] = useState<any>(null);
  const [jugadores, setJugadores] = useState<any[]>([]);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    const u = getSession();
    if (!u || u.rol !== "admin") {
      router.replace("/login");
      return;
    }
    cargar();
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

  async function cerrarSesion() {
    await supabase.from("sessions").update({ estado: "cerrada" }).eq("id", id);
    router.push("/admin");
  }

  if (!sesion) return null;

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

      <button onClick={cerrarSesion} className="w-full border border-gray-300 rounded-lg py-2 text-sm text-gray-600">
        Cerrar sesión
      </button>
    </div>
  );
}
