"use client";

import { startTransition, useActionState, useState } from "react";
import { ArrowLeft, ArrowRight, Delete, Loader2 } from "lucide-react";
import type { ActionState } from "@/components/action-form";
import { cx } from "@/components/ui";
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

  const error = step === "pin" && !pending ? state?.error : null;

  return (
    <div className="w-full max-w-[400px] rounded-[28px] bg-white/[0.04] p-6 ring-1 ring-inset ring-white/10 backdrop-blur-sm sm:p-7">
      {/* steps */}
      <div className="mb-5 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em]">
        <span className={cx("rounded-full px-2.5 py-1", step === "id" ? "bg-gold-400 text-forest-950" : "bg-white/10 text-forest-200")}>1 · Staff ID</span>
        <span className="h-px flex-1 bg-white/15" />
        <span className={cx("rounded-full px-2.5 py-1", step === "pin" ? "bg-gold-400 text-forest-950" : "bg-white/10 text-forest-200")}>2 · PIN</span>
      </div>

      {/* display */}
      <div className={cx("flex h-20 items-center justify-center rounded-2xl bg-forest-950/60 ring-1 ring-inset transition", error ? "ring-red-400/60" : "ring-white/10")}>
        {step === "id" ? (
          staffCode ? (
            <span className="font-mono text-4xl font-semibold tracking-[0.3em] text-white">{staffCode}</span>
          ) : (
            <span className="text-base text-forest-200">Type your staff ID</span>
          )
        ) : pending ? (
          <Loader2 className="h-8 w-8 animate-spin text-gold-400" />
        ) : (
          <div className="flex gap-4">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={cx("h-4 w-4 rounded-full transition", i < pin.length ? "scale-110 bg-gold-400" : "bg-white/15")}
              />
            ))}
          </div>
        )}
      </div>
      <div className="mt-3 h-5 text-center text-sm font-medium">
        {error ? <span className="text-red-300">{error}</span> : step === "pin" && <span className="text-forest-200">Staff ID {staffCode}</span>}
      </div>

      {/* keys */}
      <div className="mt-3 grid grid-cols-3 gap-3">
        {KEYS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => press(k)}
            className={cx(
              "flex h-[72px] items-center justify-center rounded-2xl text-white ring-1 ring-inset ring-white/10 transition active:scale-95",
              k === "clear" || k === "back" ? "bg-transparent text-forest-200 hover:bg-white/5" : "bg-white/[0.07] font-display text-[32px] font-medium hover:bg-white/[0.12] active:bg-gold-400 active:text-forest-950",
            )}
            aria-label={k === "back" ? "Delete" : k === "clear" ? "Clear" : k}
          >
            {k === "clear" ? <span className="text-sm font-semibold">Clear</span> : k === "back" ? <Delete className="h-6 w-6" /> : k}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {step === "id" ? (
          <button
            type="button"
            disabled={!staffCode}
            onClick={() => setStep("pin")}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gold-500 text-lg font-bold text-forest-950 shadow-lift transition hover:bg-gold-400 disabled:opacity-30"
          >
            Next <ArrowRight className="h-5 w-5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setStep("id");
              setPin("");
            }}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-semibold text-forest-100 ring-1 ring-inset ring-white/15 hover:bg-white/5"
          >
            <ArrowLeft className="h-5 w-5" /> Not you? Change ID
          </button>
        )}
      </div>
    </div>
  );
}
