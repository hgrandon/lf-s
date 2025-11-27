// app/pedido/correlativo/Correlativo.tsx
type Props = {
  nro?: number;
  fechaIngreso?: string;
  fechaEntrega?: string;
};

export default function Correlativo({ nro, fechaIngreso, fechaEntrega }: Props) {
  return (
    <div className="flex items-start justify-between">
      <h1 className="text-4xl sm:text-5xl font-extrabold">
        N° {nro ?? '—'}
      </h1>
      <div className="text-right">
        <div className="text-xl sm:text-2xl">
          {fechaIngreso ?? ''}
        </div>
        <div className="text-xl sm:text-2xl">
          {fechaEntrega ?? ''}
        </div>
      </div>
    </div>
  );
}
