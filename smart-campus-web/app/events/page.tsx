"use client";

import { useEffect, useState, useCallback } from "react";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  GraduationCap,
  History,
  RefreshCw,
  Search,
  UserRound,
  Users,
} from "lucide-react";
import { getRecognitionEvents } from "@/lib/api";

interface EventPerson {
  id: number;
  full_name: string;
  role: string;
  enrollment_no: string | null;
  branch: string | null;
  year: string | null;
}

interface RecognitionEventItem {
  id: number;
  person_id: number | null;
  camera_id: string;
  confidence: number;
  status: string;
  timestamp: string | null;
  person?: EventPerson | null;
}

export default function EventsPage() {
  const [events, setEvents] = useState<RecognitionEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "recognized" | "unknown">("all");

  const loadEvents = useCallback(async () => {
    try {
      const data = await getRecognitionEvents();
      setEvents(data);
      setError("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load recognition events."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
    const interval = setInterval(loadEvents, 5000);
    return () => clearInterval(interval);
  }, [loadEvents]);

  const filteredEvents = events.filter((ev) => {
    const isRecognized =
      ev.status?.toLowerCase() === "recognized" ||
      ev.status?.toUpperCase() === "MATCHED";

    if (statusFilter === "recognized" && !isRecognized) return false;
    if (statusFilter === "unknown" && isRecognized) return false;

    if (!search.trim()) return true;
    const query = search.toLowerCase();

    return (
      ev.person?.full_name?.toLowerCase().includes(query) ||
      ev.person?.enrollment_no?.toLowerCase().includes(query) ||
      ev.person?.branch?.toLowerCase().includes(query) ||
      ev.camera_id?.toLowerCase().includes(query) ||
      ev.status?.toLowerCase().includes(query)
    );
  });

  const totalCount = events.length;
  const recognizedCount = events.filter(
    (e) =>
      e.status?.toLowerCase() === "recognized" ||
      e.status?.toUpperCase() === "MATCHED"
  ).length;
  const unknownCount = totalCount - recognizedCount;
  const matchRate = totalCount > 0 ? ((recognizedCount / totalCount) * 100).toFixed(0) : "0";

  return (
    <div className="mx-auto max-w-[1500px]">
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#7168c9]">
            <History size={14} />
            Audit Trail
          </div>

          <h2 className="text-3xl font-bold tracking-tight">
            Recognition Events
          </h2>

          <p className="mt-2 text-sm text-[#747c90]">
            Real-time feed of face recognition attempts captured by campus cameras.
          </p>
        </div>

        <button
          onClick={loadEvents}
          disabled={loading}
          className="flex items-center gap-2 self-start rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-2.5 text-sm text-[#b5bbca] transition hover:bg-white/[0.06] hover:text-white md:self-auto disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Refresh Feed
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-[#ef4444]/20 bg-[#ef4444]/5 p-4 text-sm text-[#fca5a5]">
          {error}
          <div className="mt-1 text-xs text-[#9a6b70]">
            Make sure the backend is active on port 8000.
          </div>
        </div>
      )}

      {/* Mini metric stats */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/[0.07] bg-[#0d111b] p-4">
          <div className="text-xs text-[#737b8f]">Total Events</div>
          <div className="mt-2 text-2xl font-bold text-white">{totalCount}</div>
        </div>
        <div className="rounded-2xl border border-[#22c55e]/15 bg-[#22c55e]/[0.02] p-4">
          <div className="text-xs text-[#86efac]">Recognized</div>
          <div className="mt-2 text-2xl font-bold text-[#86efac]">{recognizedCount}</div>
        </div>
        <div className="rounded-2xl border border-[#ef4444]/15 bg-[#ef4444]/[0.02] p-4">
          <div className="text-xs text-[#fca5a5]">Unknown</div>
          <div className="mt-2 text-2xl font-bold text-[#fca5a5]">{unknownCount}</div>
        </div>
        <div className="rounded-2xl border border-white/[0.07] bg-[#0d111b] p-4">
          <div className="text-xs text-[#737b8f]">Match Accuracy</div>
          <div className="mt-2 text-2xl font-bold text-[#a69eff]">{matchRate}%</div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0d111b]">
        {/* Filter bar */}
        <div className="flex flex-col justify-between gap-4 border-b border-white/[0.07] p-5 md:flex-row md:items-center">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setStatusFilter("all")}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-medium transition ${
                statusFilter === "all"
                  ? "bg-[#6d5dfc] text-white"
                  : "bg-white/[0.03] text-[#747c90] hover:text-white"
              }`}
            >
              All Events ({totalCount})
            </button>
            <button
              onClick={() => setStatusFilter("recognized")}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-medium transition ${
                statusFilter === "recognized"
                  ? "bg-[#22c55e]/20 text-[#86efac] border border-[#22c55e]/30"
                  : "bg-white/[0.03] text-[#747c90] hover:text-white"
              }`}
            >
              Recognized ({recognizedCount})
            </button>
            <button
              onClick={() => setStatusFilter("unknown")}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-medium transition ${
                statusFilter === "unknown"
                  ? "bg-[#ef4444]/20 text-[#fca5a5] border border-[#ef4444]/30"
                  : "bg-white/[0.03] text-[#747c90] hover:text-white"
              }`}
            >
              Unknown ({unknownCount})
            </button>
          </div>

          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555d70]"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, ID, camera..."
              className="w-full rounded-xl border border-white/[0.07] bg-white/[0.025] py-2 pl-9 pr-4 text-xs outline-none placeholder:text-[#555d70] focus:border-[#6d5dfc]/40 md:w-72"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px]">
            <thead>
              <tr className="border-b border-white/[0.05] text-left text-[10px] uppercase tracking-wider text-[#626a7e]">
                <th className="px-5 py-4">Time</th>
                <th className="px-5 py-4">Person</th>
                <th className="px-5 py-4">Role</th>
                <th className="px-5 py-4">Enrollment / ID</th>
                <th className="px-5 py-4">Camera</th>
                <th className="px-5 py-4">Confidence</th>
                <th className="px-5 py-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading && events.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-16 text-center text-sm text-[#626a7e]"
                  >
                    Loading events...
                  </td>
                </tr>
              ) : filteredEvents.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-16 text-center text-sm text-[#626a7e]"
                  >
                    No recognition events found.
                  </td>
                </tr>
              ) : (
                filteredEvents.map((event) => {
                  const isRecognized =
                    event.status?.toLowerCase() === "recognized" ||
                    event.status?.toUpperCase() === "MATCHED";

                  return (
                    <tr
                      key={event.id}
                      className="border-b border-white/[0.04] transition hover:bg-white/[0.015]"
                    >
                      <td className="px-5 py-4 font-mono text-xs text-[#8e96aa]">
                        {event.timestamp
                          ? new Date(event.timestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })
                          : "—"}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-full ${
                              isRecognized
                                ? "bg-[#6d5dfc]/10 text-[#9185ff]"
                                : "bg-white/[0.04] text-[#626a7e]"
                            }`}
                          >
                            {isRecognized ? (
                              event.person?.role === "teacher" ? (
                                <UserRound size={15} />
                              ) : (
                                <GraduationCap size={16} />
                              )
                            ) : (
                              <Users size={15} />
                            )}
                          </div>

                          <div>
                            <div className="text-sm font-medium text-white">
                              {event.person?.full_name || "Unknown Person"}
                            </div>
                            {event.person?.branch && (
                              <div className="text-[11px] text-[#626a7e]">
                                {event.person.branch}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-xs capitalize text-[#aab0bf]">
                        {event.person?.role || "—"}
                      </td>

                      <td className="px-5 py-4 font-mono text-xs text-[#8e96aa]">
                        {event.person?.enrollment_no || "—"}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 text-xs text-[#747c90]">
                          <Camera size={13} className="text-[#596176]" />
                          <span>{event.camera_id}</span>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/[0.05]">
                            <div
                              className={`h-full rounded-full ${
                                isRecognized ? "bg-[#22c55e]" : "bg-[#ef4444]"
                              }`}
                              style={{
                                width: `${Math.min(
                                  Math.max(event.confidence * 100, 5),
                                  100
                                )}%`,
                              }}
                            />
                          </div>
                          <span className="font-mono text-xs text-[#d7dbe5]">
                            {(event.confidence * 100).toFixed(1)}%
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                            isRecognized
                              ? "bg-[#22c55e]/10 text-[#86efac]"
                              : "bg-[#ef4444]/10 text-[#fca5a5]"
                          }`}
                        >
                          {isRecognized ? (
                            <>
                              <CheckCircle2 size={11} />
                              RECOGNIZED
                            </>
                          ) : (
                            <>
                              <AlertCircle size={11} />
                              UNKNOWN
                            </>
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
