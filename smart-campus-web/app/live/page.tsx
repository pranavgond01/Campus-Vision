"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  Camera,
  CircleStop,
  Play,
  RefreshCw,
  Wifi,
} from "lucide-react";

import {
  API_URL,
  CameraStatus,
  RecognitionResult,
  getCameraResults,
  getCameraStatus,
  startCamera,
  stopCamera,
} from "@/lib/api";

export default function LivePage() {
  const [status, setStatus] =
    useState<CameraStatus | null>(null);

  const [results, setResults] =
    useState<RecognitionResult[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [message, setMessage] =
    useState("");

  async function refresh() {
    try {
      const cameraStatus =
        await getCameraStatus();

      setStatus(cameraStatus);

      if (cameraStatus.running) {
        const recognition =
          await getCameraResults();

        setResults(recognition);
      } else {
        setResults([]);
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Connection failed.",
      );
    }
  }

  async function handleStart() {
    try {
      setLoading(true);
      setMessage("");

      await startCamera();

      await refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not start camera.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleStop() {
    try {
      setLoading(true);
      setMessage("");

      await stopCamera();

      await refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not stop camera.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();

    const interval =
      setInterval(
        refresh,
        1000,
      );

    return () =>
      clearInterval(interval);
  }, []);

  return (
    <div className="mx-auto max-w-[1500px]">
      <div className="mb-8 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#7168c9]">
            <Camera size={14} />

            Camera Monitoring
          </div>

          <h2 className="text-3xl font-bold tracking-tight">
            Live Camera
          </h2>

          <p className="mt-2 text-sm text-[#747c90]">
            Local webcam recognition simulator.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={refresh}
            className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-2.5 text-sm text-[#b5bbca] transition hover:bg-white/[0.06] hover:text-white"
          >
            <RefreshCw size={16} />

            Refresh
          </button>

          {!status?.running ? (
            <button
              onClick={handleStart}
              disabled={loading}
              className="flex items-center gap-2 rounded-xl bg-[#6d5dfc] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#6d5dfc]/20 transition hover:bg-[#7a6cff] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Play size={16} />

              Start Camera
            </button>
          ) : (
            <button
              onClick={handleStop}
              disabled={loading}
              className="flex items-center gap-2 rounded-xl bg-[#ef4444]/10 px-4 py-2.5 text-sm font-semibold text-[#fca5a5] transition hover:bg-[#ef4444]/20 disabled:opacity-50"
            >
              <CircleStop size={16} />

              Stop Camera
            </button>
          )}
        </div>
      </div>

      {message && (
        <div className="mb-5 rounded-xl border border-[#ef4444]/20 bg-[#ef4444]/5 p-4 text-sm text-[#fca5a5]">
          {message}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.6fr_0.8fr]">
        <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0d111b]">
          <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
            <div>
              <div className="font-semibold">
                Camera Feed
              </div>

              <div className="mt-1 flex items-center gap-2 text-xs text-[#6f778b]">
                <Wifi size={12} />

                {status?.camera_id ||
                  "LOCAL-CAMERA-01"}
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span
                className={`h-2 w-2 rounded-full ${
                  status?.running
                    ? "bg-[#22c55e] shadow-lg shadow-[#22c55e]/40"
                    : "bg-[#ef4444]"
                }`}
              />

              {status?.running
                ? "LIVE"
                : "OFFLINE"}
            </div>
          </div>

          <div className="relative aspect-video bg-black">
            {status?.running ? (
              <img
                src={`${API_URL}/api/camera/stream`}
                alt="Live camera"
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <Camera
                    size={40}
                    className="mx-auto mb-4 text-[#343b4c]"
                  />

                  <div className="font-medium text-[#858da0]">
                    Camera offline
                  </div>

                  <div className="mt-1 text-xs text-[#535b6e]">
                    Start the camera to begin.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-[#0d111b]">
          <div className="border-b border-white/[0.07] px-5 py-4">
            <div className="font-semibold">
              Detected People
            </div>

            <div className="mt-1 text-xs text-[#6f778b]">
              Current recognition results
            </div>
          </div>

          <div className="max-h-[600px] overflow-y-auto p-4">
            {results.length === 0 ? (
              <div className="flex min-h-[300px] items-center justify-center text-center">
                <div>
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.03]">
                    <Camera
                      size={21}
                      className="text-[#4d5568]"
                    />
                  </div>

                  <div className="text-sm font-medium text-[#8b93a7]">
                    No faces detected
                  </div>

                  <div className="mt-1 text-xs text-[#535b6e]">
                    Stand in front of the
                    camera.
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {results.map(
                  (
                    result,
                    index,
                  ) => (
                    <RecognitionCard
                      key={
                        result.person_id ??
                        `unknown-${index}`
                      }
                      result={result}
                    />
                  ),
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function RecognitionCard({
  result,
}: {
  result: RecognitionResult;
}) {
  const matched =
    result.status === "MATCHED";

  return (
    <div
      className={`rounded-xl border p-4 ${
        matched
          ? "border-[#22c55e]/15 bg-[#22c55e]/[0.04]"
          : "border-[#ef4444]/15 bg-[#ef4444]/[0.04]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">
            {result.full_name ||
              "Unknown Person"}
          </div>

          {matched && (
            <>
              <div className="mt-1 text-xs capitalize text-[#8b93a7]">
                {result.role}
              </div>

              <div className="mt-3 space-y-1 text-xs text-[#747c90]">
                <div>
                  Enrollment:{" "}
                  <span className="text-[#c7cbd6]">
                    {result.enrollment_no ||
                      "N/A"}
                  </span>
                </div>

                <div>
                  Year:{" "}
                  <span className="text-[#c7cbd6]">
                    {result.year ||
                      "N/A"}
                  </span>
                </div>

                <div>
                  Branch:{" "}
                  <span className="text-[#c7cbd6]">
                    {result.branch ||
                      "N/A"}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        <div
          className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
            matched
              ? "bg-[#22c55e]/10 text-[#86efac]"
              : "bg-[#ef4444]/10 text-[#fca5a5]"
          }`}
        >
          {matched
            ? "MATCHED"
            : "UNKNOWN"}
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-1 flex justify-between text-[10px] text-[#626a7e]">
          <span>Similarity</span>

          <span>
            {(result.confidence * 100).toFixed(
              1,
            )}
            %
          </span>
        </div>

        <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className={`h-full rounded-full ${
              matched
                ? "bg-[#22c55e]"
                : "bg-[#ef4444]"
            }`}
            style={{
              width: `${Math.min(
                result.confidence * 100,
                100,
              )}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}