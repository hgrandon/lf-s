// app/clientes/page.tsx
import Link from 'next/link';

type Props = {
  searchParams: { tel?: string };
};

// Si usabas themeColor en metadata, muévelo a viewport:
export const viewport = {
  themeColor: '#7c3aed',
};

// (Opcional) fuerza página dinámica si la usas como entrada siempre viva
export const dynamic = 'force-dynamic';

export default function ClientesPage({ searchParams }: Props) {
  const tel = (searchParams.tel || '').replace(/\D+/g, '').slice(0, 9);
  const isValidTel = tel.length === 9;

  return (
    <main className="min-h-screen bg-gradient-to-br from-violet-800 via-fuchsia-700 to-indigo-800 flex flex-col items-center justify-center p-4 text-white">
      <div className="bg-white/10 backdrop-blur-md p-6 rounded-2xl shadow-lg w-full max-w-md text-center">
        <h1 className="text-2xl font-bold mb-4">Nuevo Pedido</h1>

        <div className="text-lg font-semibold mb-2">Buscar Cliente</div>
        <div className="text-sm text-white/80 mb-2">Teléfono detectado</div>

        <div className="bg-white text-violet-800 rounded-lg py-2 px-3 font-bold tracking-wide mb-6">
          {tel || '—'}
        </div>

        <Link
          href={isValidTel ? `/pedido/nuevo?tel=${tel}` : '#'}
          aria-disabled={!isValidTel}
          className={[
            'inline-block rounded-lg px-6 py-3 font-semibold transition',
            isValidTel
              ? 'bg-white text-violet-700 hover:bg-violet-50'
              : 'bg-white/40 text-white/70 cursor-not-allowed pointer-events-none',
          ].join(' ')}
        >
          Continuar al Pedido
        </Link>

        {!isValidTel && (
          <p className="mt-3 text-xs text-white/80">
            Ingresa a esta página con el parámetro <code className="px-1 rounded bg-white/20">?tel=XXXXXXXXX</code> para continuar.
          </p>
        )}
      </div>
    </main>
  );
}


