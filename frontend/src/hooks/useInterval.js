// src/hooks/useInterval.js
import { useEffect, useRef } from "react";

/**
 * Ejecuta `callback` cada `delay` ms. Si `delay` es null el intervalo se pausa.
 */
export function useInterval(callback, delay) {
  const savedCb = useRef();

  // Guarda la última versión del callback
  useEffect(() => {
    savedCb.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null) return;

    const tick = () => savedCb.current?.();
    const id = setInterval(tick, delay);
    return () => clearInterval(id);
  }, [delay]);
}
