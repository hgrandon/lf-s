'use client';

import { type ComponentType } from 'react';

type Props = {
  title: string;
  subtitle?: string;
  Icon: ComponentType<{ className?: string; size?: number }>;
  onClick?: () => void;
};

export default function StatusCard({ title, subtitle, Icon, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="text-left bg-white border border-gray-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition grid gap-2"
    >
      <div className="flex items-center gap-2">
        <Icon className="w-6 h-6 text-violet-600" />
        <span className="font-semibold text-gray-800">{title}</span>
      </div>
      {subtitle ? (
        <span className="text-sm text-gray-500">{subtitle}</span>
      ) : null}
    </button>
  );
}
