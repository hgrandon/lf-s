'use client';

import PedidoPage from '../pedido/page';

export default function EmpresaPage() {
  // usamos el mismo formulario de pedido pero marcado como EMPRESA
  return <PedidoPage empresaMode />;
}