'use client';

type Props = {
  articulo: {
    nombre: string;
    cantidad: number;
    valor: number;
    subtotal: number;
    estado: string;
  };
};

export default function PedidoDetalleCard({ articulo }: Props) {
  return (
    <div className="mb-2 rounded-xl border border-violet-100 bg-violet-50/50 p-3 shadow-sm">
      <div className="flex justify-between text-sm">
        <span className="font-semibold text-violet-800">{articulo.nombre}</span>
        <span className="text-slate-500">{articulo.estado}</span>
      </div>
      <div className="mt-1 grid grid-cols-3 text-xs text-slate-600">
        <div>Cant: {articulo.cantidad}</div>
        <div>Valor: {articulo.valor}</div>
        <div className="text-right font-semibold text-violet-700">
          Subtotal: {articulo.subtotal}
        </div>
      </div>
    </div>
  );
}
