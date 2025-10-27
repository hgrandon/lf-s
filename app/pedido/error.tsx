// app/pedido/error.tsx
'use client';

export default function Error({ error }: { error: Error }) {
  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold text-red-600">Se produjo un error en /pedido</h2>
      <pre className="mt-2 rounded bg-gray-100 p-3 text-sm text-gray-700 overflow-auto">
        {error?.message || String(error)}
      </pre>
    </div>
  );
}
