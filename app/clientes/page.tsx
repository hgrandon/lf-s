import ClientesVisual, { Cliente } from './ClientesVisual';

const demo: Cliente[] = [
  { telefono: '955512345', nombre: 'Eleanor Vance', direccion: '456 Oak Ave, Springfield' },
  { telefono: '955598765', nombre: 'Marcus Holloway', direccion: '789 Pine St, Metropolis' },
  { telefono: '952345678', nombre: 'Anya Sharma', direccion: '101 Maple Dr, Gotham' },
];

export default function Page() {
  return (
    <ClientesVisual
      items={demo}
      onBack={() => history.back()}
      onAdd={() => alert('Agregar')}
      onFilter={() => alert('Filtros')}
      onSelect={(c) => alert(`Seleccionado: ${c.nombre}`)}
      onEdit={(c) => alert(`Editar: ${c.nombre}`)}
      onDelete={(c) => confirm(`Eliminar ${c.nombre}?`)}
      compact={typeof window !== 'undefined' && window.innerWidth > 900}
    />
  );
}



