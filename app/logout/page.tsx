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

  return null;
}



