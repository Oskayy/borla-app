"use client";

import { useRef, useState } from "react";
import { compressImage } from "@/lib/compress-image";

interface PhotoCaptureProps {
  onCapture: (file: File, gpsLat: number | null, gpsLng: number | null, gpsAccuracyM?: number | null) => void;
  label?: string;
  buttonClassName?: string; // redesigned screens pass their own button style
}

export default function PhotoCapture({ onCapture, label = "Take Photo", buttonClassName = "btn-primary" }: PhotoCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const original = e.target.files?.[0];
    if (!original) return;
    // Reset so selecting the same file again still fires onChange
    e.target.value = "";

    setError(null);
    setGettingLocation(true);
    const file = await compressImage(original);

    if (!navigator.geolocation) {
      setGettingLocation(false);
      setError("This device doesn't support location detection. Photo will be uploaded without GPS.");
      onCapture(file, null, null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGettingLocation(false);
        onCapture(file, position.coords.latitude, position.coords.longitude, position.coords.accuracy);
      },
      (err) => {
        setGettingLocation(false);
        setError("Couldn't get your location (" + err.message + "). Photo will be uploaded without GPS.");
        onCapture(file, null, null);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <div>
      <button
        type="button"
        className={buttonClassName}
        onClick={() => inputRef.current?.click()}
        disabled={gettingLocation}
      >
        {gettingLocation ? "Getting location..." : label}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelected}
        style={{ display: "none" }}
      />
      {error && (
        <p role="status" style={{ color: "#b42318", fontSize: "0.85rem", marginTop: 6 }}>{error}</p>
      )}
    </div>
  );
}