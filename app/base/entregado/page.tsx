'use client';
import { useRouter } from 'next/navigation';

export default function EntregadoPage() {
  const router = useRouter();
  return (
    <main className="min-h-screen bg-gray-50">
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b">
        <button className="text-violet-600 hover:underline" onClick={() => router.push('/base')}>← Volver</button>
        <h1 className="font-semibold text-gray-800">Entregado</h1>
        <div className="w-8" />
      </header>
      <section className="p-4 text-gray-700">
        Aquí listaremos pedidos en estado <b>ENTREGADO</b>.
      </section>
    </main>
  );
}
