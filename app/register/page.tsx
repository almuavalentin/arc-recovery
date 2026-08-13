"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { hashPin, saveSession } from "@/lib/auth";

export default function RegisterPage() {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [posicion, setPosicion] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (pin.length !== 4) {
      setError("El PIN debe tener 4 dígitos.");
      return;
    }
    if (pin !== pin2) {
      setError("Los PIN no coinciden.");
      return;
    }

    setLoading(true);
    const pinHash = await hashPin(pin);

    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .ilike("nombre", nombre.trim())
      .maybeSingle();

    if (existing) {
      setLoading(false);
      setError("Ya existe un usuario con ese nombre. Iniciá sesión o usá otro nombre.");
      return;
    }

    const { data, error: dbError } = await supabase
      .from("users")
      .insert({ nombre: nombre.trim(), posicion, pin_hash: pinHash, rol: "jugador" })
      .select("id, nombre, rol")
      .single();

    setLoading(false);

    if (dbError || !data) {
      setError("No se pudo crear el usuario. Intentá de nuevo.");
      return;
    }

    saveSession({ id: data.id, nombre: data.nombre, rol: "jugador" });
    router.push("/player");
  }

  return (
    <div className="min-h-screen bg-arc flex flex-col items-center justify-center px-6">
      <h1 className="text-3xl font-bold text-white mb-8">Crear cuenta</h1>

      <form
        onSubmit={handleRegister}
        className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-lg space-y-4"
      >
        <div>
          <label className="block text-sm font-medium mb-1">Nombre y apellido</label>
          <input
            className="w-full border rounded-lg px-3 py-2"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Posición (opcional)</label>
          <input
            className="w-full border rounded-lg px-3 py-2"
            value={posicion}
            onChange={(e) => setPosicion(e.target.value)}
            placeholder="Ej: Pilar, Apertura..."
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">PIN (4 dígitos)</label>
          <input
            className="w-full border rounded-lg px-3 py-2 tracking-widest"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            inputMode="numeric"
            maxLength={4}
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Repetir PIN</label>
          <input
            className="w-full border rounded-lg px-3 py-2 tracking-widest"
            value={pin2}
            onChange={(e) => setPin2(e.target.value.replace(/\D/g, "").slice(0, 4))}
            inputMode="numeric"
            maxLength={4}
            required
          />
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-arc text-white rounded-lg py-2 font-medium disabled:opacity-50"
        >
          {loading ? "Creando..." : "Crear cuenta"}
        </button>

        <p className="text-center text-sm text-gray-500">
          ¿Ya tenés cuenta?{" "}
          <Link href="/login" className="text-arc font-medium">
            Iniciar sesión
          </Link>
        </p>
      </form>
    </div>
  );
}
