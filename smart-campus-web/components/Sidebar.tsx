"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Camera,
  GraduationCap,
  LayoutDashboard,
  Radio,
  Users,
  UserPlus,
  History,
} from "lucide-react";
import ThemeToggle from "./ThemeToggle";

const navigation = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "Live Camera",
    href: "/live",
    icon: Camera,
  },
  {
    name: "People",
    href: "/people",
    icon: Users,
  },
  {
    name: "Enrollment",
    href: "/enrollment",
    icon: UserPlus,
  },
  {
    name: "Recognition Events",
    href: "/events",
    icon: History,
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-white/[0.07] bg-[#090c14]/95 backdrop-blur-xl">
      <div className="flex h-20 items-center gap-3 border-b border-white/[0.07] px-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#6d5dfc] shadow-lg shadow-[#6d5dfc]/20">
          <GraduationCap
            size={22}
            strokeWidth={2.5}
          />
        </div>

        <div>
          <div className="font-bold tracking-tight">
            Smart Campus
          </div>

          <div className="text-xs text-[#8b93a7]">
            Vision System
          </div>
        </div>
      </div>

      <div className="px-4 pt-6">
        <div className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#626a7e]">
          Main Menu
        </div>

        <nav className="space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;

            const active =
              pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition ${
                  active
                    ? "bg-[#6d5dfc]/15 text-white"
                    : "text-[#8b93a7] hover:bg-white/[0.04] hover:text-white"
                }`}
              >
                <Icon
                  size={18}
                  className={
                    active
                      ? "text-[#8b7fff]"
                      : "text-[#687186]"
                  }
                />

                <span>
                  {item.name}
                </span>

                {active && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#8b7fff]" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto p-4 space-y-2">
        <div className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2">
          <span className="text-xs text-[#8b93a7]">Theme Mode</span>
          <ThemeToggle showLabel={true} />
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
          <div className="mb-2 flex items-center gap-2">
            <Radio
              size={15}
              className="text-[#22c55e]"
            />

            <span className="text-xs font-semibold">
              System Status
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-[#8b93a7]">
            <span className="h-2 w-2 rounded-full bg-[#22c55e] shadow-lg shadow-[#22c55e]/40" />

            Backend connected
          </div>
        </div>
      </div>
    </aside>
  );
}