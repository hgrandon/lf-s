'use client';

export default function ConfirmEditPedido({
  open,
  pedidoId,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  pedidoId: number | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open || !pedidoId) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50">
      <div className="w-[420px] max-w-[92vw] rounded-2xl bg-white p-5 text-violet-900 shadow-2xl">
        <h3 className="text-lg font-bold">¿Editar pedido #{pedidoId}?</h3>
        <p className="mt-2 text-sm text-violet-700">
          Serás llevado a la ventana de edición del pedido.
        </p>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-xl px-3 py-2 text-sm hover:bg-violet-50"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
          >
            Editar
          </button>
        </div>
      </div>
    </div>
  );
}
