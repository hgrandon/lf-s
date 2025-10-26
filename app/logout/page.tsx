'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { clearAuth } from '@/app/components/auth';

export default function LogoutPage() {
  const router = useRouter();
  useEffect(() => {
    clearAuth();
    router.replace('/login');
  }, [router]);
  return (
    <div className="flex h-screen items-center justify-center text-purple-700">
      Cerrando sesión…
    </div>
  );
}



