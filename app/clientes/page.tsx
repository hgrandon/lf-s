'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import ClientesVisual, { Cliente } from './ClientesVisual';

export default function PageClientes() {
  const router = useRouter();
  const params = useSearchParams();

  // estado de listado y búsqueda
  const [items, setItems] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState<string>(params.get('q') ?? '');

  // cargar clientes desde Supabase
  const load = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('clientes')
        .select('telefono,nombre,direccion')
        .order('nombre', { ascending: true });

      if (error) throw error;

      const list: Cliente[] =
        (data ?? []).map((r: any) => ({
          telefono: String(r.telefono ?? ''),
          nombre: String(r.nombre ?? ''),
          direccion: String(r.direccion ?? ''),
        })) || [];

      setItems(list);
    } catch (e: any) {
      console.error(e);
      alert('No se pudieron cargar los clientes.\n' + (e?.message ?? ''));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // opcional: refresco ligero cada 60s
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handlers de navegación/acciones (no cambian tu lógica existente)
  const handleBack = () => {
    router.back();
  };

  const handleAdd = () => {
    // abre tu pantalla actual de clientes en modo "nuevo"
    router.push('/clientes?mode=new');
  };

  const handleSelect = (c: Cliente) => {
    // aquí solo mostramos detalle/flujo que quieras; de momento lo dejamos como editar
    router.push(`/clientes?tel=${encodeURIComponent(c.telefono)}`);
  };

  const handleEdit = (c: Cliente) => {
    router.push(`/clientes?tel=${encodeURIComponent(c.telefono)}`);
  };

  const handleDelete = async (c: Cliente) => {
    const ok = confirm(`¿Eliminar a ${c.nombre} (${c.telefono})? Esta acción no se puede deshacer.`);
    if (!ok) return;

    try {
      const { error } = await supabase
        .from('clientes')
        .delete()
        .eq('telefono', c.telefono);

      if (error) throw error;

      // optimista + recarga
      setItems((prev) => prev.filter((x) => x.telefono !== c.telefono));
    } catch (e: any) {
      console.error(e);
      alert('No se pudo eliminar.\n' + (e?.message ?? ''));
    }
  };

  // filtrado local (además de la búsqueda del componente)
  const visible = useMemo(() => {
    const t = (query || '').trim().toLowerCase();
    if (!t) return items;
    return items.filter(
      (c) =>
        c.telefono.toLowerCase().includes(t) ||
        c.nombre.toLowerCase().includes(t) ||
        c.direccion.toLowerCase().includes(t)
    );
  }, [items, query]);

  return (
    <div className="min-h-svh">
      <ClientesVisual
        items={visible}
        query={query}
        onQueryChange={setQuery}
        onBack={handleBack}
        onFilter={() => alert('Aquí puedes abrir tu modal/filtros avanzados')}
        onAdd={handleAdd}
        onSelect={handleSelect}
        onEdit={handleEdit}
        onDelete={handleDelete}
        // en desktop amplio, centra más ancho
        compact={typeof window !== 'undefined' && window.innerWidth > 1000}
      />
      {loading && (
        <div className="fixed inset-x-0 bottom-4 mx-auto w-fit px-3 py-1.5 rounded-full bg-slate-900/80 text-white text-sm shadow">
          Cargando clientes…
        </div>
      )}
    </div>
  );
}


