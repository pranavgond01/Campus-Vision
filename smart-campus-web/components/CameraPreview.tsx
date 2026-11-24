"use client";

import { Activity } from "lucide-react";
import { CameraStatus } from "@/lib/api";

interface CameraPreviewProps {
  status: CameraStatus | null;
  streamUrl?: string;
}

export default function CameraPreview({
  status,
  streamUrl = "http://127.0.0.1:8000/api/camera/stream",
}: CameraPreviewProps) {
  const isRunning = Boolean(status?.running);

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0d111b]">
      <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
        <div>
          <div className="font-semibold text-white">Local Camera</div>
          <div className="mt-1 text-xs text-[#747c90]">
            {status?.camera_id || "LOCAL-CAMERA-01"}
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-full border border-white/[0.07] px-3 py-1.5 text-xs">
          <span
            className={`h-2 w-2 rounded-full ${
              isRunning ? "bg-[#22c55e]" : "bg-[#ef4444]"
            }`}
          />
          <span className="text-[#d7dbe5]">{isRunning ? "Live" : "Offline"}</span>
        </div>
      </div>

      <div className="relative flex aspect-video items-center justify-center bg-[#06080d]">
        {isRunning ? (
          <img
            src={streamUrl}
            alt="Local camera stream"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.04]">
              <Activity size={24} className="text-[#596176]" />
            </div>

            <div className="text-sm font-medium text-[#b4bac8]">
              Camera is offline
            </div>

            <div className="mt-1 text-xs text-[#5f6678]">
              Start the camera from the Live Camera controls.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
