"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Camera, CameraOff, Loader2, LogIn, LogOut } from "lucide-react";
import { cx } from "@/components/ui";
import { tap } from "../actions";

/**
 * Clock-in / clock-out button with a live front-camera preview. Pressing it
 * grabs one small frame and sends it with the tap, so managers can see who
 * actually clocked in. If the camera is unavailable the tap still goes through.
 */
const LOOK = {
  clock_in: { label: "Clock in", icon: LogIn, tone: "bg-ok text-white hover:brightness-110" },
  clock_out: { label: "Clock out", icon: LogOut, tone: "bg-ink text-white hover:bg-ink-2" },
};

export function PhotoTap({ type }: { type: "clock_in" | "clock_out" }) {
  const { label, icon: Icon, tone } = LOOK[type];
  const video = useRef<HTMLVideoElement>(null);
  const [camera, setCamera] = useState<"starting" | "ready" | "unavailable">("starting");
  const [pending, start] = useTransition();
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    (navigator.mediaDevices
      ? navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 320 }, height: { ideal: 240 } }, audio: false })
      : Promise.reject(new Error("no camera"))
    )
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        if (video.current) {
          video.current.srcObject = s;
          video.current.play().catch(() => {});
        }
        setCamera("ready");
      })
      .catch(() => setCamera("unavailable"));
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function snap(): string | null {
    const v = video.current;
    if (camera !== "ready" || !v || !v.videoWidth) return null;
    const canvas = document.createElement("canvas");
    const w = 320;
    const h = Math.round((v.videoHeight / v.videoWidth) * w);
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    // Mirror back to a true (non-selfie) orientation.
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(v, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.72);
  }

  function submit() {
    if (pending) return;
    const data = new FormData();
    data.set("type", type);
    const photo = snap();
    if (photo) {
      data.set("photo", photo);
      setFlash(true);
      setTimeout(() => setFlash(false), 180);
    }
    start(() => tap(data));
  }

  return (
    <div>
      <div className="flex items-stretch gap-3">
        <div className="relative h-14 w-[74px] shrink-0 overflow-hidden rounded-[12px] border border-line-strong bg-sunken">
          <video ref={video} muted playsInline className={cx("h-full w-full -scale-x-100 object-cover", camera !== "ready" && "hidden")} />
          {camera !== "ready" && (
            <span className="absolute inset-0 flex items-center justify-center text-faint">
              {camera === "starting" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CameraOff className="h-4 w-4" />}
            </span>
          )}
          {camera === "ready" && (
            <span className="absolute bottom-1 left-1 flex items-center gap-1 rounded bg-black/55 px-1 py-px text-[9px] font-medium text-white">
              <span className="h-1 w-1 animate-pulse rounded-full bg-red-400" /> LIVE
            </span>
          )}
          {flash && <span className="absolute inset-0 bg-white" />}
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className={cx(
            "flex h-14 flex-1 items-center justify-center gap-2 rounded-[14px] text-[16px] font-semibold shadow-pop transition disabled:opacity-60",
            tone,
          )}
        >
          {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}
          {pending ? "Saving…" : label}
          {!pending && camera === "ready" && <Camera className="h-4 w-4 opacity-70" />}
        </button>
      </div>
      <p className="mt-2 text-xs text-muted">
        {camera === "unavailable"
          ? "Camera unavailable on this tablet. Your tap still counts, and your manager will see it was taken without a photo."
          : "A quick photo is taken when you tap, so only you can clock yourself in."}
      </p>
    </div>
  );
}
