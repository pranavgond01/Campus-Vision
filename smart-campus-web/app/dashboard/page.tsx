"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  Activity,
  GraduationCap,
  Users,
  UserRound,
} from "lucide-react";

import StatCard from "@/components/StatCard";

import {
  getCameraStatus,
  getStatistics,
  Statistics,
  CameraStatus,
} from "@/lib/api";

export default function DashboardPage() {
  const [stats, setStats] =
    useState<Statistics | null>(null);

  const [camera, setCamera] =
    useState<CameraStatus | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  async function loadData() {
    try {
      setError("");

      const [
        statistics,
        cameraStatus,
      ] = await Promise.all([
        getStatistics(),
        getCameraStatus(),
      ]);

      setStats(statistics);
      setCamera(cameraStatus);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to connect to backend.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();

    const interval =
      setInterval(
        loadData,
        5000,
      );

    return () =>
      clearInterval(interval);
  }, []);

  return (
    <div className="mx-auto max-w-[1500px]">
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#7168c9]">
          <Activity size={14} />

          Overview
        </div>

        <h2 className="text-3xl font-bold tracking-tight">
          Campus Overview
        </h2>

        <p className="mt-2 text-sm text-[#747c90]">
          Monitor enrolled campus members
          and recognition activity.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-[#ef4444]/20 bg-[#ef4444]/5 p-4 text-sm text-[#fca5a5]">
          {error}

          <div className="mt-1 text-xs text-[#9a6b70]">
            Make sure FastAPI is running on
            port 8000.
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total People"
          value={
            loading
              ? "—"
              : stats?.total_people ?? 0
          }
          subtitle="Enrolled profiles"
          icon={Users}
        />

        <StatCard
          title="Students"
          value={
            loading
              ? "—"
              : stats?.total_students ?? 0
          }
          subtitle="Registered students"
          icon={GraduationCap}
        />

        <StatCard
          title="Teachers"
          value={
            loading
              ? "—"
              : stats?.total_teachers ?? 0
          }
          subtitle="Registered teachers"
          icon={UserRound}
        />

        <StatCard
          title="Events Today"
          value={
            loading
              ? "—"
              : stats?.events_today ?? 0
          }
          subtitle="Recognition events"
          icon={Activity}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0d111b]">
          <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
            <div>
              <div className="font-semibold">
                Local Camera
              </div>

              <div className="mt-1 text-xs text-[#747c90]">
                {camera?.camera_id ||
                  "LOCAL-CAMERA-01"}
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-full border border-white/[0.07] px-3 py-1.5 text-xs">
              <span
                className={`h-2 w-2 rounded-full ${
                  camera?.running
                    ? "bg-[#22c55e]"
                    : "bg-[#ef4444]"
                }`}
              />

              {camera?.running
                ? "Live"
                : "Offline"}
            </div>
          </div>

          <div className="relative flex aspect-video items-center justify-center bg-[#06080d]">
            {camera?.running ? (
              <img
                src="http://127.0.0.1:8000/api/camera/stream"
                alt="Local camera stream"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.04]">
                  <Activity
                    size={24}
                    className="text-[#596176]"
                  />
                </div>

                <div className="text-sm font-medium text-[#b4bac8]">
                  Camera is offline
                </div>

                <div className="mt-1 text-xs text-[#5f6678]">
                  Start the local camera from
                  the Live Camera page.
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-[#0d111b] p-6">
          <div className="mb-6">
            <div className="font-semibold">
              System Information
            </div>

            <div className="mt-1 text-xs text-[#747c90]">
              Current local environment
            </div>
          </div>

          <div className="space-y-4">
            <InfoRow
              label="Backend"
              value="FastAPI"
            />

            <InfoRow
              label="Database"
              value="SQLite"
            />

            <InfoRow
              label="Face Detector"
              value="YuNet"
            />

            <InfoRow
              label="Recognizer"
              value="SFace"
            />

            <InfoRow
              label="Camera"
              value="Local Webcam"
            />

            <InfoRow
              label="Mode"
              value="Test / Consent"
            />
          </div>

          <div className="mt-6 rounded-xl border border-[#22c55e]/10 bg-[#22c55e]/5 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-[#b5e8c4]">
              <span className="h-2 w-2 rounded-full bg-[#22c55e]" />

              Development environment
            </div>

            <p className="mt-2 text-xs leading-5 text-[#78917f]">
              This environment uses only
              locally enrolled test profiles.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.05] pb-3">
      <span className="text-sm text-[#747c90]">
        {label}
      </span>

      <span className="text-sm font-medium text-[#d7dbe5]">
        {value}
      </span>
    </div>
  );
}