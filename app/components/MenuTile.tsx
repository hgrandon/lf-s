"use client";

import Link from "next/link";
import { ReactNode } from "react";

type MenuTileProps = {
  href: string;
  icon: ReactNode;
  title: string;
  subtitle?: string;
  disabled?: boolean; // por si aún no está implementado
};

export default function MenuTile({
  href,
  icon,
  title,
  subtitle,
  disabled,
}: MenuTileProps) {
  const common = (
    <div
      className={[
        "group relative overflow-hidden rounded-2xl p-5",
        "bg-white/10 backdrop-blur",
        "ring-1 ring-white/20 hover:ring-white/40",
        "transition-all duration-200",
        "hover:shadow-lg hover:shadow-black/10",
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
      ].join(" ")}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 text-white">
          {icon}
        </div>
        <div className="flex-1">
          <div className="text-base font-semibold text-white/95">{title}</div>
          {subtitle && (
            <div className="text-xs text-white/70 mt-0.5">{subtitle}</div>
          )}
        </div>
      </div>
    </div>
  );

  if (disabled) return <div aria-disabled>{common}</div>;
  return <Link href={href}>{common}</Link>;
}

