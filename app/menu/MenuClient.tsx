'use client';

import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

type MenuTileProps = {
  href: string;
  icon: ReactNode;
  title: string;
  subtitle?: ReactNode;
  disabled?: boolean;
};

export default function MenuTile({
  href,
  icon,
  title,
  subtitle,
  disabled = false,        // 👈 por defecto *NO* está deshabilitado
}: MenuTileProps) {
  const router = useRouter();

  const handleClick = () => {
    if (disabled) return;
    if (!href || href === '#') return;
    router.push(href);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={[
        'group w-full rounded-2xl bg-white/10 border border-white/15 backdrop-blur-md',
        'shadow-[0_4px_16px_rgba(0,0,0,0.20)] transition p-4 text-left h-[6.25rem] active:scale-[.99]',
        disabled
          ? 'opacity-50 cursor-not-allowed'
          : 'hover:bg-white/14 hover:shadow-[0_6px_22px_rgba(0,0,0,0.25)]',
      ].join(' ')}
      aria-label={title}
    >
      <div className="h-full flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/10 border border-white/20">
            {icon}
          </div>
          <div className="min-w-0">
            <span className="block text-base sm:text-lg font-extrabold tracking-tight truncate">
              {title}
            </span>
            {subtitle ? (
              <span className="mt-0.5 block text-[0.8rem] text-white/80 truncate">
                {subtitle}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </button>
  );
}
