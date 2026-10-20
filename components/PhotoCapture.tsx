"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, RotateCcw, X } from "lucide-react";
import { compressImage } from "@/lib/compress-image";

interface PhotoCaptureProps {
  onCapture: (file: File, gpsLat: number | null, gpsLng: number | null, gpsAccuracyM?: number | null) => void;
  label?: string;
  buttonClassName?: string; // redesigned screens pass their own button style
}

type Gps = { lat: number; lng: number; accuracy: number } | null;

// Set while the phone's camera app is open. Android often closes the browser tab to free memory while the camera
// app runs; the page then reloads without the photo. If we find this marker on load, we say what happened.
const PENDING_KEY = "trashit:camera-app-open";

// Takes a photo inside the page: a full-screen live camera with a shutter, so the page never goes to the background
// (opening the phone's camera app made some Android phones reload the page and lose the photo). When the browser
// can't open the camera here (no permission, an old phone), the phone's camera app is offered instead. The location
// is looked up while the camera is open, so confirming doesn't wait for GPS. The camera is drawn straight into
// <body> (a portal): inside a card with a slide-in animation, "fixed" would be trapped in the card's box and the
// camera squeezed into a thin strip.
export default function PhotoCapture({ onCapture, label = "Take Photo", buttonClassName = "btn-primary" }: PhotoCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const gpsRef = useRef<Promise<Gps> | null>(null);
  const [open, setOpen] = useState(false);
  const [shot, setShot] = useState<{ file: File; url: string } | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // The page came back from the camera app without the photo: tell the driver, once.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(PENDING_KEY);
      if (!raw) return;
      sessionStorage.removeItem(PENDING_KEY);
      const at = Number(raw);
      if (Date.now() - at < 10 * 60_000) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from storage after a reload
        setNote("Your phone closed this page while its camera app was open, so the photo didn't arrive. Tap the button again: the camera now opens inside the page.");
      }
    } catch {
      // storage blocked: nothing to recover
    }
  }, []);

  function startGps() {
    gpsRef.current = new Promise<Gps>((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
      );
    });
  }

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => stopStream, [stopStream]);

  async function startStream() {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1440 } },
        audio: false,
      });
      streamRef.current = stream;
      const v = videoRef.current;
      if (v) {
        v.srcObject = stream;
        await v.play().catch(() => {});
      }
    } catch (e) {
      const name = (e as { name?: string })?.name;
      setCameraError(
        name === "NotAllowedError" || name === "SecurityError"
          ? "Trashit isn't allowed to use the camera. Allow it in your browser's site settings, or use the phone's camera app below."
          : "The camera couldn't start here. Use the phone's camera app below."
      );
    }
  }

  async function openCamera() {
    setNote(null);
    startGps();
    if (!navigator.mediaDevices?.getUserMedia) {
      openCameraApp();
      return;
    }
    setShot(null);
    setOpen(true);
    await startStream();
  }

  function closeCamera() {
    stopStream();
    if (shot) URL.revokeObjectURL(shot.url);
    setShot(null);
    setOpen(false);
    setCameraError(null);
  }

  async function takeShot() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d")?.drawImage(v, 0, 0);
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.9));
    if (!blob) return;
    const file = new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
    stopStream();
    setShot({ file, url: URL.createObjectURL(blob) });
  }

  async function retake() {
    if (shot) URL.revokeObjectURL(shot.url);
    setShot(null);
    await startStream();
  }

  async function finish(original: File) {
    setBusy(true);
    const file = await compressImage(original);
    if (!gpsRef.current) startGps();
    const gps = await gpsRef.current!;
    setBusy(false);
    if (!gps) setNote("Couldn't get your location, so the photo is sent without it. That's fine.");
    onCapture(file, gps?.lat ?? null, gps?.lng ?? null, gps?.accuracy ?? null);
  }

  async function usePhoto() {
    if (!shot) return;
    const file = shot.file;
    URL.revokeObjectURL(shot.url);
    setShot(null);
    setOpen(false);
    await finish(file);
  }

  // The fallback: the phone's own camera app (a file picker on a computer).
  function openCameraApp() {
    try {
      sessionStorage.setItem(PENDING_KEY, String(Date.now()));
    } catch {
      // storage blocked: we just can't explain a reload
    }
    stopStream();
    setOpen(false);
    if (!gpsRef.current) startGps();
    inputRef.current?.click();
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    try {
      sessionStorage.removeItem(PENDING_KEY);
    } catch {}
    const original = e.target.files?.[0];
    e.target.value = ""; // so choosing the same file again still fires
    if (!original) return;
    await finish(original);
  }

  // Escape closes the camera; the page behind doesn't scroll while it's open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeCamera();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
    // closeCamera only reads refs and setters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div>
      <button type="button" className={buttonClassName} onClick={openCamera} disabled={busy}>
        {busy ? "Getting location…" : label}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        aria-label={label}
        onChange={handleFileSelected}
        style={{ display: "none" }}
      />
      {note && (
        <p role="status" className="mt-1.5 max-w-prose text-sm text-ink-2">
          {note}
        </p>
      )}

      {open &&
        createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Camera"
          className="fixed inset-0 z-[100] flex flex-col bg-black text-white"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-[15px] font-semibold">{label}</span>
            <button type="button" onClick={closeCamera} aria-label="Close the camera" className="grid size-11 place-items-center rounded-full bg-white/15">
              <X aria-hidden className="size-5" />
            </button>
          </div>

          <div className="relative min-h-0 flex-1 overflow-hidden">
            {shot ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shot.url} alt="The photo you just took" className="absolute inset-0 size-full object-contain" />
            ) : (
              <video ref={videoRef} playsInline muted autoPlay className="absolute inset-0 size-full object-cover" />
            )}
            {cameraError && !shot && (
              <div className="absolute inset-0 grid place-items-center p-6 text-center">
                <p className="max-w-sm text-[15px] leading-relaxed">{cameraError}</p>
              </div>
            )}
          </div>

          <div className="grid gap-3 px-4 pb-4 pt-4">
            {shot ? (
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={retake} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-white/15 text-[16px] font-semibold">
                  <RotateCcw aria-hidden className="size-5" /> Retake
                </button>
                <button type="button" onClick={usePhoto} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-[#9be07a] text-[16px] font-bold text-[#0e1511]">
                  Use photo
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-center">
                <button
                  type="button"
                  onClick={takeShot}
                  disabled={!!cameraError}
                  aria-label="Take the photo"
                  className="grid size-20 place-items-center rounded-full border-4 border-white/70 bg-white disabled:opacity-30"
                >
                  <Camera aria-hidden className="size-7 text-black" />
                </button>
              </div>
            )}
            {!shot && (
              <button type="button" onClick={openCameraApp} className="min-h-11 text-sm font-semibold text-white/80 underline underline-offset-4">
                Use the phone&apos;s camera app instead
              </button>
            )}
          </div>
        </div>,
          document.body
        )}
    </div>
  );
}
