"use client";

import { useEffect, useRef } from "react";
import { doneOnTablet } from "../actions";

/** Send the tablet back to the keypad after a period without touches. */
export function IdleReturn({ seconds }: { seconds: number }) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    const reset = () => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void doneOnTablet(), seconds * 1000);
    };
    reset();
    const events = ["pointerdown", "keydown"] as const;
    events.forEach((e) => window.addEventListener(e, reset));
    return () => {
      clearTimeout(timer.current);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [seconds]);
  return null;
}
