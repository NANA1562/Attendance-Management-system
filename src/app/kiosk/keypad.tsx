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
    <div className="w-full max-w-[400px] rounded-[24px] border border-line bg-subtle p-[3px] shadow-pop">
      <div className="rounded-[21px] border border-line bg-surface p-5 sm:p-6">
        {/* steps, as underline tabs */}
        <div className="mb-5 grid grid-cols-2 border-b border-line font-mono text-[11px] uppercase tracking-[0.12em]">
          {(["id", "pin"] as const).map((s, i) => (
            <span key={s} className={cx("-mb-px border-b-2 pb-2.5 text-center", step === s ? "border-ink text-ink" : "border-transparent text-faint")}>
              0{i + 1} · {s === "id" ? "Staff ID" : "PIN"}
            </span>
          ))}
        </div>

        {/* display */}
        <div className={cx("flex h-[72px] items-center justify-center rounded-[14px] border bg-subtle transition", error ? "border-red-300 bg-red-50" : "border-line-strong")}>
          {step === "id" ? (
            staffCode ? <span className="font-mono text-[34px] font-medium tracking-[0.25em]">{staffCode}</span> : <span className="text-[15px] text-faint">Enter your staff ID</span>
          ) : pending ? (
            <Loader2 className="h-7 w-7 animate-spin text-muted" />
          ) : (
            <div className="flex gap-4">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={cx("h-3.5 w-3.5 rounded-full transition", i < pin.length ? "scale-110 bg-ink" : "border-2 border-line-strong bg-surface")} />
              ))}
            </div>
          )}
        </div>
        <div className="mt-2.5 h-5 text-center text-[13px]">
          {error ? <span className="font-medium text-red-600">{error}</span> : step === "pin" && <span className="text-muted">Staff ID <b className="font-mono font-medium text-ink">{staffCode}</b></span>}
        </div>

        {/* keys */}
        <div className="mt-3 grid grid-cols-3 gap-2.5">
          {KEYS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => press(k)}
              aria-label={k === "back" ? "Delete" : k === "clear" ? "Clear" : k}
              className={cx(
                "flex h-[68px] items-center justify-center rounded-[14px] transition active:scale-95",
                k === "clear" || k === "back"
                  ? "text-muted hover:bg-subtle"
                  : "border border-line-strong bg-surface text-[28px] font-medium shadow-card hover:bg-subtle active:bg-ink active:text-white",
              )}
            >
              {k === "clear" ? <span className="text-[13px] font-medium">Clear</span> : k === "back" ? <Delete className="h-6 w-6" strokeWidth={1.75} /> : k}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {step === "id" ? (
            <button
              type="button"
              disabled={!staffCode}
              onClick={() => setStep("pin")}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-[14px] bg-ink text-[16px] font-medium text-white shadow-pop transition hover:bg-ink-2 disabled:opacity-25"
            >
              Continue <ArrowRight className="h-5 w-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setStep("id");
                setPin("");
              }}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-[14px] border border-line-strong bg-surface text-[15px] font-medium text-ink-2 shadow-card hover:bg-subtle"
            >
              <ArrowLeft className="h-5 w-5" /> Not you? Change ID
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
