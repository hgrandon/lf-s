'use client';

import Link from 'next/link';
import { ReactNode } from 'react';

type Props = {
  href: string;
  label: string;
  icon: ReactNode;
};

export default function MenuTile({ href, label, icon }: Props) {
  return (
    <Link
      href={href}
      className="group flex flex-col items-center gap-2"
      aria-label={label}
    >
      <div className="
        grid place-items-center size-20 rounded-full
        bg-gradient-to-br from-violet-600 to-fuchsia-600
        shadow-lg shadow-violet-200/40
        transition-transform group-active:scale-95 group-hover:scale-[0.98]
        text-white
      ">
        <div className="size-8">{icon}</div>
      </div>
      <span className="text-sm font-semibold text-violet-700">{label}</span>
    </Link>
  );
}
