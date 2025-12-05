// app/finanzas/empresa/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ChevronLeft } from 'lucide-react';

type AuthMode = 'clave' | 'usuario';

type LfSession = {
  mode: AuthMode;
  display: string;
  rol?: string | null;
  ts: number;
  ttl: number;
};

function readSessionSafely(): LfSession | null {
  try {
    const raw = localStorage.getItem('lf_auth');
    if (!raw) return null;
    const s = JSON.parse(raw) as LfSession;
    if (!s || !s.ts || !s.ttl) return null;

    const expired = Date.now() - s.ts > s.ttl;
    if (expired) {
      localStorage.removeItem('lf_auth');
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export default function FinanzasEmpresaPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [roleOk, setRoleOk] = useState(false);

  useEffect(() => {
    const sess = readSessionSafely();
    if (!sess) {
      router.replace('/login?next=/finanzas/empresa');
      setAuthChecked(true);
      return;
    }
    if ((sess.rol || '').toUpperCase() !== 'ADMIN') {
      router.replace('/base');
      setAuthChecked(true);
      return;
    }
    setRoleOk(true);
    setAuthChecked(true);
  }, [router]);

  if (!authChecked) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-900 via-fuchsia-800 to-violet-900 text-white">
        <Loader2 className="animate-spin" size={26} />
      </main>
    );
  }

  if (!roleOk) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-900 via-fuchsia-800 to-violet-900 text-white">
        <span className="text-sm opacity-80">Sin acceso…</span>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-900 via-fuchsia-800 to-violet-900 text-white px-4 py-4">
      {/* HEADER */}
      <header className="flex items-center gap-3 mb-5">
        <button
          onClick={() => router.back()}
          className="rounded-full bg-white/10 hover:bg-white/20 p-2 border border-white/30"
        >
          <ChevronLeft size={18} />
        </button>
        <div>
          <h1 className="font-bold text-lg">Finanzas Empresa</h1>
          <p className="text-xs text-white/80">
            Reportes de pedidos de empresas (quincenas, meses, año).
          </p>
        </div>
      </header>

      {/* Aquí después agregamos: quincenas, mensual, anual, PDF, gráficos, etc. */}
      <section className="grid gap-4 text-sm">
        <div className="rounded-2xl bg-black/25 border border-white/25 px-4 py-3">
          <p className="text-white/85">
            Esta sección mostrará:
          </p>
          <ul className="mt-2 list-disc list-inside text-white/80 text-xs sm:text-sm">
            <li>Histórico por quincenas (1–15 y 16–fin de mes)</li>
            <li>Resumen mensual y anual</li>
            <li>Gráficos por día, quincena, mes y año</li>
            <li>Opción para exportar reporte a PDF</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
