'use client';

import { Suspense } from 'react';
import { TableroUI, BotonAccionDef } from '@/app/components/tablero/TableroUI';
import {
  WashingMachine,
  Droplet,
  CheckCircle2,
  Truck,
  PackageCheck,
  CreditCard
} from 'lucide-react';

const botonesEntregar: BotonAccionDef[] = [
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
    id: 'entregado',
    title: 'Entregado',
    Icon: PackageCheck,
    onClick: (id, t) => t.changeEstado(id, 'ENTREGADO'),
    activeFn: (id, t) => t.pedidos.find((p) => p.id === id)?.estado === 'ENTREGADO',
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
    id: 'pago',
    title: (id, t) => (t.pedidos.find((p) => p.id === id)?.pagado ? 'Pagado' : 'Pendiente'),
    Icon: CreditCard,
    onClick: (id, t) => t.togglePago(id),
    activeFn: (id, t) => !!t.pedidos.find((p) => p.id === id)?.pagado,
  },
];

export default function EntregarPage() {
  return (
    <Suspense>
      <TableroUI
        titulo="Entregar"
        backURL="/base"
        opciones={{ estadoBase: 'ENTREGAR', ordenDescendente: true }}
        botonesAccion={botonesEntregar}
        permiteRuta={true}
      />
    </Suspense>
  );
}
