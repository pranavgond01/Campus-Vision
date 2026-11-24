"use client";

import { useEffect, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  GraduationCap,
  Mail,
  Phone,
  ShieldCheck,
  Sparkles,
  Trash2,
  User,
  UserCheck,
  UserRound,
  X,
} from "lucide-react";
import { Person, getPerson } from "@/lib/api";

export interface PersonModalData {
  id?: number | null;
  full_name: string;
  role?: string | null;
  enrollment_no?: string | null;
  branch?: string | null;
  year?: string | null;
  date_of_birth?: string | null;
  contact_number?: string | null;
  validity?: string | null;
  face_image?: string | null;
  consent_status?: boolean;
  created_at?: string | null;
  confidence?: number | null;
}

interface PersonDetailsModalProps {
  person: PersonModalData | null;
  onClose: () => void;
  onDelete?: (id: number, name: string) => void;
}

export default function PersonDetailsModal({
  person,
  onClose,
  onDelete,
}: PersonDetailsModalProps) {
  const [fullPerson, setFullPerson] = useState<PersonModalData | null>(person);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setFullPerson(person);
    // If person has an ID but lacks some details (e.g. from live CCTV), fetch full details
    if (person?.id && (!person.date_of_birth || !person.validity || !person.face_image)) {
      setLoading(true);
      getPerson(person.id)
        .then((data) => {
          setFullPerson((prev) => ({
            ...prev,
            ...data,
            confidence: person.confidence ?? prev?.confidence,
          }));
        })
        .catch(() => {
          // Silently retain current data if fetch fails
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [person]);

  if (!person) return null;

  const p = fullPerson || person;
  const isTeacher = p.role?.toLowerCase() === "teacher";
  const isStaff = p.role?.toLowerCase() === "staff";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-white/[0.1] bg-[#0d111b] shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Card Style */}
        <div className="relative overflow-hidden border-b border-white/[0.08] bg-gradient-to-r from-[#6d5dfc]/15 via-[#9185ff]/10 to-transparent p-6">
          <button
            onClick={onClose}
            className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] text-[#8b93a7] transition hover:bg-white/[0.15] hover:text-white"
            aria-label="Close modal"
          >
            <X size={16} />
          </button>

          <div className="flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-[#a69eff]">
            <CreditCard size={14} />
            <span>Smart Campus ID Card Profile</span>
          </div>

          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
            {/* Portrait / Face Photo */}
            <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-2 border-[#6d5dfc]/40 bg-black/40 shadow-lg">
              {p.face_image ? (
                <img
                  src={p.face_image}
                  alt={p.full_name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-[#6d5dfc]/20 text-[#a69eff]">
                  {isTeacher ? <UserRound size={36} /> : <GraduationCap size={38} />}
                </div>
              )}

              {p.consent_status !== false && (
                <div className="absolute bottom-1 right-1 rounded-full bg-[#22c55e] p-1 text-black shadow-sm" title="Consent Verified">
                  <CheckCircle2 size={12} strokeWidth={3} />
                </div>
              )}
            </div>

            {/* Basic Info */}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-bold tracking-tight text-white truncate">
                  {p.full_name}
                </h3>

                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${
                    isTeacher
                      ? "bg-[#22c55e]/15 text-[#4ade80]"
                      : isStaff
                      ? "bg-[#f59e0b]/15 text-[#fbbf24]"
                      : "bg-[#6d5dfc]/20 text-[#c7c0ff]"
                  }`}
                >
                  {p.role || "Student"}
                </span>
              </div>

              {p.enrollment_no && (
                <div className="mt-1 flex items-center gap-1.5 text-xs font-mono text-[#aab0bf]">
                  <span className="text-[#64748b]">ID:</span>
                  <span className="font-semibold text-white">{p.enrollment_no}</span>
                </div>
              )}

              {/* Confidence Badge (if live CCTV recognition) */}
              {p.confidence != null && (
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[#22c55e]/10 border border-[#22c55e]/20 px-2.5 py-1 text-xs font-semibold text-[#4ade80]">
                  <Sparkles size={12} />
                  <span>Real-time Match: {(p.confidence * 100).toFixed(1)}%</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Detailed Info Grid */}
        <div className="p-6">
          <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[#6f778b]">
            Official ID Card Information
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {/* Branch / Department */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3.5">
              <div className="flex items-center gap-2 text-xs text-[#717a8e]">
                <GraduationCap size={15} className="text-[#a69eff]" />
                <span>Branch / Department</span>
              </div>
              <div className="mt-1 text-sm font-semibold text-white">
                {p.branch || "—"}
              </div>
            </div>

            {/* Academic Year */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3.5">
              <div className="flex items-center gap-2 text-xs text-[#717a8e]">
                <Calendar size={15} className="text-[#a69eff]" />
                <span>Academic Year</span>
              </div>
              <div className="mt-1 text-sm font-semibold text-white">
                {p.year || "—"}
              </div>
            </div>

            {/* Date of Birth */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3.5">
              <div className="flex items-center gap-2 text-xs text-[#717a8e]">
                <Calendar size={15} className="text-[#a69eff]" />
                <span>Date of Birth (D.O.B.)</span>
              </div>
              <div className="mt-1 text-sm font-semibold text-white">
                {p.date_of_birth || "—"}
              </div>
            </div>

            {/* Contact / Phone */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3.5">
              <div className="flex items-center gap-2 text-xs text-[#717a8e]">
                <Phone size={15} className="text-[#a69eff]" />
                <span>Contact Number</span>
              </div>
              <div className="mt-1 text-sm font-semibold text-white">
                {p.contact_number || "—"}
              </div>
            </div>

            {/* ID Validity */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3.5">
              <div className="flex items-center gap-2 text-xs text-[#717a8e]">
                <ShieldCheck size={15} className="text-[#a69eff]" />
                <span>ID Card Validity</span>
              </div>
              <div className="mt-1 text-sm font-semibold text-white">
                {p.validity || "—"}
              </div>
            </div>

            {/* Consent & Enrollment Status */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3.5">
              <div className="flex items-center gap-2 text-xs text-[#717a8e]">
                <UserCheck size={15} className="text-[#22c55e]" />
                <span>Consent & Biometric</span>
              </div>
              <div className="mt-1 text-sm font-semibold text-[#86efac]">
                Active &amp; Verified
              </div>
            </div>
          </div>

          {/* Registration Timestamp (if available) */}
          {p.created_at && (
            <div className="mt-4 flex items-center justify-between text-[11px] text-[#6f778b] border-t border-white/[0.06] pt-3">
              <div className="flex items-center gap-1.5">
                <Clock size={12} />
                <span>Enrolled on {new Date(p.created_at).toLocaleString()}</span>
              </div>
              {p.id && <span className="font-mono">DB ID #{p.id}</span>}
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-between border-t border-white/[0.07] bg-[#0c101a] px-6 py-4">
          {onDelete && p.id ? (
            <button
              type="button"
              onClick={() => {
                if (p.id) onDelete(p.id, p.full_name);
              }}
              className="flex items-center gap-1.5 text-xs text-[#ef4444] transition hover:text-[#f87171]"
            >
              <Trash2 size={14} />
              <span>Delete Person</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/[0.1] bg-white/[0.03] px-4 py-2 text-xs font-semibold text-[#8b93a7] transition hover:bg-white/[0.08] hover:text-white"
            >
              Close
            </button>

            <a
              href="/live"
              className="rounded-xl bg-[#6d5dfc] px-4 py-2 text-xs font-semibold text-white shadow transition hover:bg-[#7b6bff]"
            >
              Live Camera ➔
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
