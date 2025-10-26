'use client';

import Image from 'next/image';

type Props = {
  className?: string;
  title?: string;
  size?: number;
  showName?: boolean;
  boxed?: boolean;
};

export default function Logo({
  className = '',
  title = 'LAVANDERÍA FABIOLA',
  size = 56,
  showName = true,
  boxed = true,
}: Props) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div
        className={[
          boxed ? 'bg-white ring-1 ring-black/5 shadow-lg' : '',
          'rounded-2xl p-3 flex items-center justify-center',
        ].join(' ')}
        style={{ width: size + 24, height: size + 24 }}
      >
        <Image
          src="/logo.png"
          alt="Logo Lavandería Fabiola"
          width={size}
          height={size}
          priority
          className="object-contain"
        />
      </div>

      {showName && (
        <span className="text-2xl font-bold tracking-tight uppercase text-white drop-shadow-sm">
          {title}
        </span>
      )}
    </div>
  );
}

