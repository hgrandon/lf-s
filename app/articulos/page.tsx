'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import {
  Tag,
  Plus,
  ArrowLeft,
  Loader2,
  AlertTriangle,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
  ArchiveRestore,
  Save,
  X,
  Search
} from 'lucide-react';

const CLP = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

type Articulo = {
  id: number;
  nombre: string;
  precio: number;
  activo: boolean;
};

export default function ArticulosPage() {
  const router = useRouter();

  const [items, setItems] = useState<Articulo[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<Articulo> | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [showInactivos, setShowInactivos] = useState(false);

  useEffect(() => {
    fetchArticulos();
  }, []);

  async function fetchArticulos() {
    try {
      setLoading(true);
      setErrorMsg(null);
      
      const { data, error } = await supabase
        .from('articulo')
        .select('*')
        .order('nombre', { ascending: true });

      if (error) throw error;
      setItems(data as Articulo[]);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message || 'Error al cargar artículos');
    } finally {
      setLoading(false);
    }
  }

  function handleOpenCrear() {
    setEditingItem({ nombre: '', precio: 0, activo: true });
    setIsModalOpen(true);
  }

  function handleOpenEditar(item: Articulo) {
    setEditingItem(item);
    setIsModalOpen(true);
  }

  async function handleAceptarBorrado(id: number, currentActivo: boolean) {
    try {
      setIsSaving(true);
      const { error } = await supabase
        .from('articulo')
        .update({ activo: !currentActivo })
        .eq('id', id);

      if (error) throw error;
      await fetchArticulos();
    } catch (err) {
      console.error(err);
      alert('Hubo un error al cambiar el estado del artículo');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleGuardar(e: React.FormEvent) {
    e.preventDefault();
    if (!editingItem?.nombre || editingItem.precio === undefined) {
      alert('Debes ingresar nombre y precio');
      return;
    }

    try {
      setIsSaving(true);
      if (editingItem.id) {
        // Actualizar
        const { error } = await supabase
          .from('articulo')
          .update({
            nombre: editingItem.nombre.toUpperCase(),
            precio: editingItem.precio,
            activo: editingItem.activo
          })
          .eq('id', editingItem.id);
        if (error) throw error;
      } else {
        // Crear
        const { error } = await supabase
          .from('articulo')
          .insert({
            nombre: editingItem.nombre.toUpperCase(),
            precio: editingItem.precio,
            activo: editingItem.activo
          });
        if (error) throw error;
      }

      setIsModalOpen(false);
      await fetchArticulos();
    } catch (err) {
      console.error(err);
      alert('Error al guardar el artículo');
    } finally {
      setIsSaving(false);
    }
  }

  const visibleItems = items.filter(it => 
    (showInactivos ? true : it.activo) && 
    it.nombre.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const activosCount = items.filter(it => it.activo).length;
  const inactivosCount = items.length - activosCount;

  return (
    <main className="min-h-screen text-white bg-gradient-to-br from-violet-900 via-fuchsia-800 to-indigo-900 pb-24 pt-16 lg:pt-24 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(255,255,255,0.10),transparent)]" />

      {/* Header Fijo */}
      <header className="fixed top-0 left-0 right-0 z-20 flex items-center justify-between px-4 lg:px-10 py-3 lg:py-4 bg-gradient-to-r from-violet-800/95 via-fuchsia-700/95 to-indigo-800/95 backdrop-blur-md border-b border-white/10 shadow-lg">
        <div className="flex flex-col gap-1 z-10 relative">
          <div className="flex items-center gap-2 text-white">
            <Tag size={26} />
            <h1 className="font-bold text-base lg:text-xl truncate">Catálogo de Artículos</h1>
          </div>
          <div className="text-[11px] lg:text-xs text-white/80 flex items-center gap-2 font-medium tracking-wide">
            <span>{activosCount} activos</span>
            {inactivosCount > 0 && (
              <>
                <span className="opacity-60">•</span>
                <span>{inactivosCount} inactivos</span>
              </>
            )}
          </div>
        </div>
        <button
          onClick={() => router.push('/menu')}
          className="text-xs lg:text-sm text-white/90 hover:text-white z-10 font-medium transition-colors bg-white/5 py-1.5 px-3 rounded-lg border border-white/10 hover:bg-white/10"
        >
          <span className="flex items-center gap-1.5"><ArrowLeft size={16} /> <span className="hidden sm:inline">Volver</span></span>
        </button>
      </header>

      {/* Container Listado */}
      <section className="relative z-10 w-full max-w-4xl mx-auto px-4 sm:px-6 mt-4">
        
        {/* Toolbar superior */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-2">
          <div className="relative flex-1 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50 group-focus-within:text-white/80 transition-colors" size={18} />
            <input
              type="text"
              placeholder="Buscar artículo..."
              className="w-full bg-black/20 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 outline-none focus:bg-black/40 focus:border-white/30 text-white placeholder:text-white/40 transition-all font-medium"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <button
            onClick={handleOpenCrear}
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-emerald-900/50 transition-all active:scale-95 border border-emerald-400/50 shrink-0"
          >
            <Plus size={18} strokeWidth={2.5} />
            <span>Nuevo Artículo</span>
          </button>
        </div>
        
        <div className="flex justify-end mb-4">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-white/70 hover:text-white transition-colors">
            <input 
              type="checkbox" 
              className="w-4 h-4 rounded bg-black/20 border-white/20 accent-violet-500 cursor-pointer"
              checked={showInactivos}
              onChange={(e) => setShowInactivos(e.target.checked)}
            />
            Incluir artículos inactivos
          </label>
        </div>

        {/* Estados de carga/error */}
        {loading && (
          <div className="mt-12 flex flex-col items-center justify-center gap-4 text-white/80">
            <Loader2 className="animate-spin" size={32} />
            <span className="animate-pulse font-medium">Cargando catálogo...</span>
          </div>
        )}

        {!loading && errorMsg && (
          <div className="mt-8 flex items-center gap-3 rounded-xl bg-red-500/20 border border-red-300/30 p-4 text-sm max-w-lg mx-auto backdrop-blur-md">
            <AlertTriangle className="text-red-400" size={24} />
            <span className="text-red-100">{errorMsg}</span>
          </div>
        )}

        {!loading && !errorMsg && visibleItems.length === 0 && (
          <div className="mt-12 flex flex-col items-center text-white/50 text-center gap-3">
            <Tag size={48} className="opacity-20" />
            <p className="text-lg font-medium">No se encontraron artículos</p>
            {searchQuery ? (
              <p className="text-sm opacity-80 max-w-xs">Prueba buscando con otras palabras.</p>
            ) : (
              <p className="text-sm opacity-80 max-w-xs">Usa el botón "Nuevo Artículo" para agregar cobros a tu sistema.</p>
            )}
          </div>
        )}

        {/* Listado Compacto */}
        <div className="flex flex-col gap-2 relative">
          {!loading && !errorMsg && visibleItems.map((item) => (
            <div
              key={item.id}
              className={[
                "group relative flex items-center justify-between gap-3 overflow-hidden rounded-xl border px-3 sm:px-4 py-2.5 sm:py-3 transition-all duration-300 hover:shadow-md",
                item.activo 
                  ? "bg-white/10 border-white/15 hover:border-white/30 backdrop-blur-md" 
                  : "bg-black/20 border-white/5 opacity-70 grayscale-[50%]"
              ].join(" ")}
            >
              {/* Contenido info */}
              <div className="flex-1 flex items-center gap-3 md:gap-6 min-w-0">
                <div className="flex flex-col flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm sm:text-base uppercase truncate text-white/95" title={item.nombre}>
                      {item.nombre}
                    </h3>
                    {!item.activo && (
                      <span className="shrink-0 inline-flex items-center justify-center bg-red-500/20 text-red-200 text-[9px] sm:text-[10px] uppercase font-bold px-1.5 py-0.5 rounded" title="Inactivo">
                        Inactivo
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-emerald-400 font-bold text-xs sm:text-sm tracking-tight mt-0.5">
                    {CLP.format(item.precio)}
                  </span>
                </div>
              </div>

              {/* Acciones */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <button
                  onClick={() => handleOpenEditar(item)}
                  className="flex justify-center items-center p-2 sm:px-3 sm:py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/90 hover:text-white transition-colors"
                  title="Editar"
                >
                  <Pencil size={15} /> <span className="hidden sm:inline ml-1 text-xs font-semibold">Editar</span>
                </button>
                <button
                  onClick={() => handleAceptarBorrado(item.id, item.activo)}
                  className={[
                    "flex justify-center items-center p-2 sm:px-3 sm:py-1.5 rounded-lg transition-colors border",
                    item.activo 
                      ? "bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20 hover:text-red-300" 
                      : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300"
                  ].join(" ")}
                  title={item.activo ? "Ocultar" : "Activar"}
                >
                  {item.activo ? (
                    <><Trash2 size={15} /> <span className="hidden sm:inline ml-1 text-xs font-semibold">Ocultar</span></>
                  ) : (
                    <><ArchiveRestore size={15} /> <span className="hidden sm:inline ml-1 text-xs font-semibold">Activar</span></>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Editor Modal */}
      {isModalOpen && editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white text-slate-800 w-full max-w-sm rounded-[24px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 bg-slate-50 border-b border-slate-100">
              <h2 className="font-bold text-lg text-indigo-900">
                {editingItem.id ? 'Editar Artículo' : 'Nuevo Artículo'}
              </h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 p-1.5 rounded-full transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            
            {/* Form */}
            <form onSubmit={handleGuardar} className="p-5 flex flex-col gap-4">
              <div className="grid gap-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">Nombre / Descripción</label>
                <input
                  type="text"
                  autoFocus
                  required
                  placeholder="Ej: ABRIGO HOMBRE"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all uppercase placeholder:normal-case font-medium text-slate-700"
                  value={editingItem.nombre || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, nombre: e.target.value })}
                />
              </div>

              <div className="grid gap-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">Precio Unitario ($)</label>
                <input
                  type="number"
                  required
                  min="0"
                  placeholder="Ej: 5000"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all font-mono font-bold text-slate-700 text-lg"
                  value={editingItem.precio === 0 ? '' : editingItem.precio}
                  onChange={(e) => setEditingItem({ ...editingItem, precio: Number(e.target.value) })}
                />
              </div>
              
              <label className="flex items-center gap-3 p-3 mt-1 rounded-xl bg-slate-50 border border-slate-100 cursor-pointer">
                <input 
                  type="checkbox"
                  className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                  checked={editingItem.activo}
                  onChange={(e) => setEditingItem({ ...editingItem, activo: e.target.checked })}
                />
                <div className="flex flex-col">
                  <span className="font-semibold text-slate-700 text-sm">Artículo Activo</span>
                  <span className="text-[11px] text-slate-500 leading-tight">Si está desmarcado, se ocultará al agregar cobros.</span>
                </div>
              </label>

              {/* Botones */}
              <div className="flex flex-col gap-2 mt-4">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full flex justify-center items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-95"
                >
                  {isSaving ? (
                    <><Loader2 className="animate-spin" size={18} /> Guardando...</>
                  ) : (
                    <><Save size={18} /> Guardar</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
