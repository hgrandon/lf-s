'use client';

import { CLP } from '@/lib/clp'; // si ya usas CLP, si no me dices
// si NO tienes CLP, luego lo arreglamos

export default function ContenidoDesglose({
  pedidos,
  openId,
  setOpenId,
}: {
  pedidos: any[];
  openId: number | null;
  setOpenId: (id: number | null) => void;
}) {
  return (
    <main className="space-y-6">
      {pedidos.map((p) => (
        <div
          key={p.id}
          className="border rounded-lg p-4 bg-white"
        >
          <button
            onClick={() => setOpenId(openId === p.id ? null : p.id)}
            className="w-full flex justify-between font-bold"
          >
            <span>Pedido #{p.id}</span>
            <span>{CLP.format(p.total ?? 0)}</span>
          </button>

          {openId === p.id && (
            <table className="w-full mt-3 text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left">Artículo</th>
                  <th className="text-right">Cant</th>
                  <th className="text-right">Valor</th>
                  <th className="text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {p.items?.map((i: any, idx: number) => (
                  <tr key={idx} className="border-t">
                    <td>{i.articulo}</td>
                    <td className="text-right">{i.qty}</td>
                    <td className="text-right">
                      {CLP.format(i.valor)}
                    </td>
                    <td className="text-right">
                      {CLP.format(i.qty * i.valor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </main>
  );
}
