'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Protected({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    try {
      const ok = localStorage.getItem('access_ok') === '1';
      if (!ok) {
        router.replace('/login');
      } else {
        setAllowed(true);
      }
    } catch {
      router.replace('/login');
    }
  }, [router]);

  if (!allowed) return null; // o un spinner
  return <>{children}</>;
}
