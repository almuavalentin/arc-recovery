"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { clearSession, getSession, SessionUser } from "@/lib/auth";
import { calcularHoraFin, generarMensaje } from "@/lib/schedule";

type Player = { id: string; nombre: string; posicion: string | null };

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);

  const [fecha, setFecha] = useState("");
  const [horaInicio, setHoraInicio] = useState("");
  const [hielo, setHielo] = useState(true);
  const [sauna, setSauna] = useState(true);
  const [botas, setBotas] = useState(true);

  const [players, setPlayers] = useState<Player[]>([]);
  const [prioridadIds, setPrioridadIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busqueda, setBusqueda] = useState("");
  const [creando, setCreando] = useState(false);
  const [sesionesAbiertas, setSesionesAbiertas] = useState<any[]>([]);

  useEffect(() => {
    const u = getSession();
    if (!u || u.rol !== "admin") {
      router.replace("/login");
      return;
    }
    setUser(u);
    cargarDatos();
  }, [router]);

  async function cargarDatos() {
    const { data: jugadores } = await supabase
      .from("users")
      .select("id, nombre, posicion")
      .eq("rol", "jugador")
      .eq("activo", true)
      .order("nombre");
    setPlayers(jugadores || []);

    const { data: pendientes } = await supabase
      .from("recovery_requests")
      .select("user_id")
      .eq("estado", "pendiente");
    setPrioridadIds(new Set((pendientes || []).map((p) => p.user_id)));

    const { data: abiertas } = await supabase
      .from("sessions")
      .select("id, fecha, hora_inicio, hora_fin, estado")
      .eq("estado", "abierta")
      .order("fecha", { ascending: false });
    setSesionesAbiertas(abiertas || []);
  }

  const jugadoresOrdenados = useMemo(() => {
    const filtrados = players.filter((p) =>
      p.nombre.toLowerCase().includes(busqueda.toLowerCase())
    );
    return filtrados.sort((a, b) => {
      const aPrio = prioridadIds.has(a.id) ? 0 : 1;
      const bPrio = prioridadIds.has(b.id) ? 0 : 1;
      if (aPrio !== bPrio) return aPrio - bPrio;
      return a.nombre.localeCompare(b.nombre);
    });
  }, [players, busqueda, prioridadIds]);

  function toggleJugador(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function crearSesion() {
    if (!user || !fecha || !horaInicio || selectedIds.size === 0) return;
    setCreando(true);

    const seleccionados = players.filter((p) => selectedIds.has(p.id));
    const horaFin = calcularHoraFin(horaInicio, seleccionados.length);

    const mensaje = generarMensaje({
      fecha,
      horaInicio,
      horaFin,
      hielo,
      sauna,
      botas,
      jugadores: seleccionados.map((p) => p.nombre)
    });

    const { data: sesion, error } = await supabase
      .from("sessions")
      .insert({
        fecha,
        hora_inicio: horaInicio,
        hora_fin: horaFin,
        hielo,
        sauna,
        botas,
        mensaje,
        created_by: user.id
      })
      .select()
      .single();

    if (error || !sesion) {
      setCreando(false);
      return;
    }

    const rows = seleccionados.map((p) => ({
      session_id: sesion.id,
      user_id: p.id,
      prioridad: prioridadIds.has(p.id)
    }));
    await supabase.from("session_players").insert(rows);

    // marcar como atendidas las solicitudes de los seleccionados con prioridad
    const idsConPrioridad = seleccionados.filter((p) => prioridadIds.has(p.id)).map((p) => p.id);
    if (idsConPrioridad.length > 0) {
      await supabase
        .from("recovery_requests")
        .update({ estado: "atendida" })
        .in("user_id", idsConPrioridad)
        .eq("estado", "pendiente");
    }

    setCreando(false);
    router.push(`/admin/session/${sesion.id}`);
  }

  function logout() {
    clearSession();
    router.push("/login");
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6 max-w-lg mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold text-arc">ARC Recovery · Admin</h1>
        <button onClick={logout} className="text-sm text-gray-400">
          Salir
        </button>
      </div>

      {sesionesAbiertas.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow mb-6">
          <p className="font-semibold mb-2 text-sm">Sesiones abiertas</p>
          {sesionesAbiertas.map((s) => (
            <button
              key={s.id}
              onClick={() => router.push(`/admin/session/${s.id}`)}
              className="block w-full text-left text-sm py-1 text-arc"
            >
              {s.fecha} · {s.hora_inicio}-{s.hora_fin} →
            </button>
          ))}
        </div>
      )}

      <div className="bg-white rounded-2xl p-5 shadow mb-6 space-y-4">
        <h2 className="font-semibold">Nueva sesión</h2>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Fecha</label>
            <input
              type="date"
              className="w-full border rounded-lg px-3 py-2"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Hora inicio</label>
            <input
              type="time"
              className="w-full border rounded-lg px-3 py-2"
              value={horaInicio}
              onChange={(e) => setHoraInicio(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Material disponible</label>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={hielo} onChange={(e) => setHielo(e.target.checked)} />
              Hielo
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={sauna} onChange={(e) => setSauna(e.target.checked)} />
              Sauna
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={botas} onChange={(e) => setBotas(e.target.checked)} />
              Botas
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Buscar jugador</label>
          <input
            className="w-full border rounded-lg px-3 py-2 mb-2"
            placeholder="Filtrar por nombre..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          <div className="max-h-64 overflow-y-auto border rounded-lg divide-y">
            {jugadoresOrdenados.map((p) => (
              <label key={p.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(p.id)}
                    onChange={() => toggleJugador(p.id)}
                  />
                  {p.nombre}
                  {p.posicion && <span className="text-gray-400 text-xs">({p.posicion})</span>}
                </span>
                {prioridadIds.has(p.id) && (
                  <span className="text-xs bg-arc-accent/20 text-arc-accent font-medium px-2 py-0.5 rounded-full">
                    Solicitó recovery
                  </span>
                )}
              </label>
            ))}
            {jugadoresOrdenados.length === 0 && (
              <p className="px-3 py-2 text-sm text-gray-400">Sin resultados.</p>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-1">{selectedIds.size} jugador(es) seleccionado(s)</p>
        </div>

        <button
          onClick={crearSesion}
          disabled={creando || !fecha || !horaInicio || selectedIds.size === 0}
          className="w-full bg-arc text-white rounded-lg py-2 font-medium disabled:opacity-50"
        >
          {creando ? "Creando..." : "Crear sesión y generar mensaje"}
        </button>
      </div>
    </div>
  );
}
