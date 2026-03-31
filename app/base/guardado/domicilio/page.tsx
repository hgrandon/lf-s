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
  MessageCircle
} from 'lucide-react';

const botonesGuardado: BotonAccionDef[] = [
  {
    id: 'comprobante',
    title: 'Comprobante',
    Icon: MessageCircle,
    onClick: (id, t) => {
      const p = t.pedidos.find((x) => x.id === id);
      t.sendComprobanteLink(p);
    },
    variant: 'success'
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
    onClick: (id, t) => {
       const p = t.pedidos.find(x => x.id === id);
       if (p?.pagado) t.changeEstado(id, 'ENTREGADO');
       else t.setAskPaidForId(id);
    },
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

export default function GuardadoDomicilioPage() {
  return (
    <Suspense>
      <TableroUI
        titulo="Guardado Domicilio"
        backURL="/base/guardado"
        backLabel="← Menú Guardado"
        opciones={{ estadoBase: 'GUARDADO', tipoEntregaFilter: 'DOMICILIO', ordenDescendente: true }}
        botonesAccion={botonesGuardado}
      />
    </Suspense>
  );
}
