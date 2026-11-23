"use client";

import {
  Bell,
  ShieldCheck,
} from "lucide-react";

export default function Topbar() {
  return (
    <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-white/[0.07] bg-[#07090f]/80 px-8 backdrop-blur-xl">
      <div>
        <h1 className="text-lg font-semibold">
          Campus Monitoring
        </h1>

        <p className="text-xs text-[#747c90]">
          Smart Campus Vision
        </p>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden items-center gap-2 rounded-full border border-[#22c55e]/15 bg-[#22c55e]/5 px-3 py-2 text-xs text-[#a8e9bd] sm:flex">
          <ShieldCheck size={14} />

          Consent-based mode
        </div>

        <button className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.025] text-[#8b93a7] transition hover:bg-white/[0.05] hover:text-white">
          <Bell size={18} />

          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#6d5dfc]" />
        </button>

        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#6d5dfc] to-[#9d72ff] text-sm font-bold">
          A
        </div>
      </div>
    </header>
  );
}