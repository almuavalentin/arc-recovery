"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { hashPin, saveSession } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const pinHash = await hashPin(pin);
    const { data, error: dbError } = await supabase
      .from("users")
      .select("id, nombre, rol, pin_hash, activo")
      .ilike("nombre", nombre.trim())
      .maybeSingle();

    setLoading(false);

    if (dbError || !data) {
      setError("Usuario no encontrado.");
      return;
    }
    if (!data.activo) {
      setError("Usuario inactivo. Hablá con el kinesiólogo.");
      return;
    }
    if (data.pin_hash !== pinHash) {
      setError("PIN incorrecto.");
      return;
    }

    saveSession({ id: data.id, nombre: data.nombre, rol: data.rol });
    router.push(data.rol === "admin" ? "/admin" : "/player");
  }

  return (
    <div className="min-h-screen bg-arc flex flex-col items-center justify-center px-6">
      <h1 className="text-3xl font-bold text-white mb-1">ARC Recovery</h1>
      <p className="text-arc-accent mb-8 text-sm">Sala de recuperación del equipo</p>

      <form
        onSubmit={handleLogin}
        className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-lg space-y-4"
      >
        <div>
          <label className="block text-sm font-medium mb-1">Nombre</label>
          <input
            className="w-full border rounded-lg px-3 py-2"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Tu nombre y apellido"
            required
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
            placeholder="••••"
            required
          />
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-arc text-white rounded-lg py-2 font-medium disabled:opacity-50"
        >
          {loading ? "Ingresando..." : "Ingresar"}
        </button>

        <p className="text-center text-sm text-gray-500">
          ¿No tenés cuenta?{" "}
          <Link href="/register" className="text-arc font-medium">
            Registrate
          </Link>
        </p>
      </form>
    </div>
  );
}
