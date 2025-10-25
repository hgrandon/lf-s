'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LogoutPage() {
  const router = useRouter();
  useEffect(() => {
    localStorage.removeItem('access_ok');
    router.replace('/login');
  }, [router]);

  return null;
}