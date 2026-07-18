"use client";

import { useEffect, useState } from "react";
import { todayIso } from "@/lib/data";

/**
 * Devuelve la fecha ISO de HOY y re-renderiza cuando cambia el día — aunque la
 * app quede abierta de un día para otro. Detecta el cambio con un chequeo
 * liviano cada 30 s y al volver a la pestaña (focus / visibilitychange), así
 * los contadores diarios (historias, tareas, rotaciones) vuelven a 0 solos.
 */
export function useToday(): string {
  const [today, setToday] = useState(todayIso);

  useEffect(() => {
    const check = () =>
      setToday((prev) => {
        const now = todayIso();
        return now === prev ? prev : now;
      });
    const id = setInterval(check, 30_000);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, []);

  return today;
}
