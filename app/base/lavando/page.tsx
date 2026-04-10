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

const botonesLavando: BotonAccionDef[] = [
  {
    id: 'guardado',
    title: 'Guardado',
    Icon: CheckCircle2,
    onClick: (id, t) => {
      const p = t.pedidos.find((x) => x.id === id);
      if (p) t.setAskWaForGuardado(p);
    },
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
    id: 'pago',
    title: (id, t) => (t.pedidos.find((p) => p.id === id)?.pagado ? 'Pagado' : 'Pendiente'),
    Icon: CreditCard,
    onClick: (id, t) => t.togglePago(id),
    activeFn: (id, t) => !!t.pedidos.find((p) => p.id === id)?.pagado,
  },
];

export default function LavandoPage() {
  return (
    <Suspense>
      <TableroUI
        titulo="Lavando"
        backURL="/base"
        opciones={{ estadoBase: 'LAVANDO', usarRealtime: false, ordenDescendente: false }}
        botonesAccion={botonesLavando}
        permiteImprimirRotulo={true}
      />
    </Suspense>
  );
}
