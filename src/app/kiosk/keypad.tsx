"use client";

import { startTransition, useActionState, useState } from "react";
import type { ActionState } from "@/components/action-form";
import { kioskLogin } from "./actions";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"];

export function Keypad() {
  const [step, setStep] = useState<"id" | "pin">("id");
  const [staffCode, setStaffCode] = useState("");
  const [pin, setPin] = useState("");
  const [state, action, pending] = useActionState(async (prev: ActionState, data: FormData) => {
    const res = await kioskLogin(prev, data);
    // Wrong PIN: clear it so they can try again.
    if (res?.error) setPin("");
    return res;
  }, null);

  const value = step === "id" ? staffCode : pin;
  const setValue = step === "id" ? setStaffCode : setPin;

  function press(key: string) {
    if (pending) return;
    if (key === "clear") return setValue("");
    if (key === "back") return setValue(value.slice(0, -1));
    if (step === "id") {
      if (staffCode.length < 8) setStaffCode(staffCode + key);
      return;
    }
    if (pin.length >= 4) return;
    const next = pin + key;
    setPin(next);
    // Submit as soon as the 4th digit is entered.
    if (next.length === 4) {
      const data = new FormData();
      data.set("staffCode", staffCode);
      data.set("pin", next);
      startTransition(() => action(data));
    }
  }

  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="text-center">
        <div className="text-lg font-medium text-stone-600">
          {step === "id" ? "Enter your staff ID" : `Staff ID ${staffCode} — enter your PIN`}
        </div>
        <div className="mt-4 flex h-16 items-center justify-center rounded-xl border border-stone-300 bg-white font-mono text-4xl tracking-[0.4em]">
          {step === "id" ? staffCode || <span className="text-stone-300">····</span> : "•".repeat(pin.length).padEnd(4, "·")}
        </div>
        <div className="mt-3 h-6 text-sm text-red-700">{step === "pin" && !pending ? state?.error : ""}</div>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-3">
        {KEYS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => press(k)}
            className="h-20 rounded-2xl border border-stone-200 bg-white text-3xl font-medium shadow-sm active:bg-stone-100"
          >
            {k === "clear" ? <span className="text-base text-stone-500">Clear</span> : k === "back" ? <span className="text-2xl text-stone-500">⌫</span> : k}
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {step === "pin" ? (
          <button
            type="button"
            onClick={() => {
              setStep("id");
              setPin("");
            }}
            className="h-14 rounded-2xl border border-stone-300 bg-white text-base"
          >
            ← Change ID
          </button>
        ) : (
          <span />
        )}
        {step === "id" ? (
          <button
            type="button"
            disabled={!staffCode}
            onClick={() => setStep("pin")}
            className="h-14 rounded-2xl bg-stone-900 text-lg font-medium text-white disabled:opacity-40"
          >
            Next →
          </button>
        ) : (
          pending && <span className="flex items-center justify-center text-stone-500">Checking…</span>
        )}
      </div>
    </div>
  );
}
