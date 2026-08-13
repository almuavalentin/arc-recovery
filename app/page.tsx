"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSession } from "@/lib/auth";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const user = getSession();
    if (!user) {
      router.replace("/login");
    } else if (user.rol === "admin") {
      router.replace("/admin");
    } else {
      router.replace("/player");
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-arc">
      <p className="text-arc-accent">Cargando ARC Recovery...</p>
    </div>
  );
}
