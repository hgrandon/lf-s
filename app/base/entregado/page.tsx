'use client';

import { Suspense } from 'react';
import { TableroUI, BotonAccionDef } from '@/app/components/tablero/TableroUI';
import {
  WashingMachine,
  Droplet,
  CheckCircle2,
  Truck,
  PackageCheck,
  CreditCard,
  Home
} from 'lucide-react';

const botonesEntregado: BotonAccionDef[] = [
  {
    id: 'volver',
    title: 'Volver',
    Icon: Home,
    onClick: (id, t) => t.router.push('/base')
  },
  {
    id: 'lavar',
    title: 'Lavar',
    Icon: Droplet,
    onClick: (id, t) => t.changeEstado(id, 'LAVAR'),
    activeFn: (id, t) => t.pedidos.find((p) => p.id === id)?.estado === 'LAVAR',
  },
  {
    id: 'lavando',
    title: 'Lavando',
    Icon: WashingMachine,
    onClick: (id, t) => t.changeEstado(id, 'LAVANDO'),
    activeFn: (id, t) => t.pedidos.find((p) => p.id === id)?.estado === 'LAVANDO',
  },
  {
    id: 'guardado',
    title: 'Guardado',
    Icon: CheckCircle2,
    onClick: (id, t) => t.changeEstado(id, 'GUARDADO'),
    activeFn: (id, t) => t.pedidos.find((p) => p.id === id)?.estado === 'GUARDADO',
  },
  {
    id: 'entregar',
    title: 'Entregar',
    Icon: Truck,
    onClick: (id, t) => t.changeEstado(id, 'ENTREGAR'),
    activeFn: (id, t) => t.pedidos.find((p) => p.id === id)?.estado === 'ENTREGAR',
  },
  {
    id: 'pago',
    title: (id, t) => (t.pedidos.find((p) => p.id === id)?.pagado ? 'Pagado' : 'Pendiente'),
    Icon: CreditCard,
    onClick: (id, t) => t.togglePago(id),
    activeFn: (id, t) => !!t.pedidos.find((p) => p.id === id)?.pagado,
  },
];

export default function EntregadoPage() {
  return (
    <Suspense>
      <TableroUI
        titulo="Entregado"
        backURL="/base"
        opciones={{ estadoBase: 'ENTREGADO', ordenDescendente: true }}
        botonesAccion={botonesEntregado}
      />
    </Suspense>
  );
}
