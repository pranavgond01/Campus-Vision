import {
  ArrowUpRight,
  LucideIcon,
} from "lucide-react";

interface StatCardProps {
  title: string;
  value: number | string;
  subtitle: string;
  icon: LucideIcon;
}

export default function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
}: StatCardProps) {
  return (
    <div className="group rounded-2xl border border-white/[0.07] bg-[#0d111b] p-5 transition hover:border-white/[0.12] hover:bg-[#101522]">
      <div className="mb-5 flex items-start justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#6d5dfc]/10 text-[#9185ff]">
          <Icon size={21} />
        </div>

        <ArrowUpRight
          size={16}
          className="text-[#454c5d] transition group-hover:text-[#8b93a7]"
        />
      </div>

      <div className="text-3xl font-bold tracking-tight">
        {value}
      </div>

      <div className="mt-1 text-sm font-medium">
        {title}
      </div>

      <div className="mt-2 text-xs text-[#737b8f]">
        {subtitle}
      </div>
    </div>
  );
}