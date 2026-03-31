import { useEffect, useState, useMemo, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export type Item = { articulo: string; qty: number; valor: number };
export type PedidoEstado =
  | 'LAVAR'
  | 'LAVANDO'
  | 'GUARDAR'
  | 'GUARDADO'
  | 'ENTREGADO'
  | 'ENTREGAR';

export type Pedido = {
  id: number;
  cliente: string;
  telefono?: string | null;
  total: number | null;
  estado: PedidoEstado;
  detalle?: string | null;
  foto_url?: string | null;
  fotos?: string[];
  pagado?: boolean | null;
  items?: Item[];
  token_servicio?: string | null;
  tipo_entrega?: string | null;
  direccion?: string | null;
};

export type TableroOpciones = {
  estadoBase: PedidoEstado;
  tipoEntregaFilter?: 'LOCAL' | 'DOMICILIO' | null;
  ordenDescendente?: boolean;
  usarRealtime?: boolean;
};

export function firstFotoFromMixed(input: unknown): string | null {
  const all = allFotosFromMixed(input);
  return all[0] ?? null;
}

export function allFotosFromMixed(input: unknown): string[] {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input.filter((x): x is string => typeof x === 'string' && x.trim() !== '');
  }
  if (typeof input === 'string') {
    const s = input.trim();
    if (!s) return [];
    if (s.startsWith('[')) {
      try {
        const arr = JSON.parse(s);
        if (Array.isArray(arr)) {
          return arr.filter(
            (x: unknown): x is string => typeof x === 'string' && x.trim() !== ''
          );
        }
      } catch {
        // Fallback a string simple si falla el JSON
      }
    }
    return [s];
  }
  return [];
}

export function esPedidoDomicilio(p?: Pedido | null): boolean {
  if (!p || !Array.isArray(p.items)) return false;
  return p.items.some((it) =>
    (it.articulo || '').toUpperCase().includes('RETIRO Y ENTREGA')
  );
}

export function toE164CL(raw?: string | null): string | null {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 9) return `56${digits}`;
  if (digits.length === 11 && digits.startsWith('56')) return digits;
  if (digits.length === 13 && digits.startsWith('0056')) return digits.slice(2);
  if (digits.startsWith('56')) return digits;
  return `56${digits}`;
}

export function normalizarDireccion(raw?: string | null): string | null {
  if (!raw) return null;
  const txt = String(raw).trim();
  if (!txt) return null;
  const match = txt.match(/^(.+?\d+)/); 
  if (match && match[1]) return match[1].trim();
  return txt;
}

function getBaseUrl() {
  if (typeof window !== 'undefined') return window.location.origin;
  return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
}

export function useTableroPedidos({
  estadoBase,
  tipoEntregaFilter,
  ordenDescendente = false,
  usarRealtime = false,
}: TableroOpciones) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [openId, setOpenId] = useState<number | null>(null);
  const [openDetail, setOpenDetail] = useState<Record<number, boolean>>({});
  const [imageError, setImageError] = useState<Record<number, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [pickerForPedido, setPickerForPedido] = useState<number | null>(null);
  const [pickerFotoUrl, setPickerFotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState<Record<number, boolean>>({});
  const inputCamRef = useRef<HTMLInputElement>(null);
  const inputFileRef = useRef<HTMLInputElement>(null);

  const [askEditForId, setAskEditForId] = useState<number | null>(null);
  const [askPaidForId, setAskPaidForId] = useState<number | null>(null);
  const [currentSlide, setCurrentSlide] = useState<Record<number, number>>({});
  const [initialScrollDone, setInitialScrollDone] = useState(false);

  const pedidoAbierto = useMemo(
    () => pedidos.find((p) => p.id === openId) ?? null,
    [pedidos, openId]
  );

  async function fetchPedidos(cancelled = false) {
    try {
      setLoading(true);
      setErrMsg(null);

      let query = supabase
        .from('pedido')
        .select('id:nro, telefono, total, estado, detalle, pagado, foto_url, tipo_entrega, token_servicio')
        .eq('estado', estadoBase)
        .order('nro', { ascending: !ordenDescendente });

      if (tipoEntregaFilter === 'LOCAL') {
        query = query.or('tipo_entrega.is.null,tipo_entrega.eq.LOCAL');
      } else if (tipoEntregaFilter === 'DOMICILIO') {
        query = query.eq('tipo_entrega', 'DOMICILIO');
      }

      const { data: rows, error: e1 } = await query;
      if (e1) throw e1;

      const ids = (rows ?? []).map((r) => r.id);
      const tels = (rows ?? []).map((r) => r.telefono).filter(Boolean);

      if (!rows?.length) {
        if (!cancelled) {
          setPedidos([]);
          setLoading(false);
        }
        return;
      }

      const { data: lineas, error: e2 } = await supabase
        .from('pedido_linea')
        .select('pedido_id, articulo, cantidad, valor')
        .in('pedido_id', ids);
      if (e2) throw e2;

      const { data: fotos, error: e3 } = await supabase
        .from('pedido_foto')
        .select('pedido_id, url')
        .in('pedido_id', ids);
      if (e3) throw e3;

      const { data: cli, error: e4 } = await supabase
        .from('clientes')
        .select('telefono, nombre, direccion')
        .in('telefono', tels);
      if (e4) throw e4;

      const cliByTel = new Map<string, { nombre: string; direccion: string | null }>();
      (cli ?? []).forEach((c) =>
        cliByTel.set(String(c.telefono), {
          nombre: c.nombre ?? 'SIN NOMBRE',
          direccion: c.direccion ?? null,
        })
      );

      const itemsByPedido = new Map<number, Item[]>();
      (lineas ?? []).forEach((l: any) => {
        const pid = Number(l.pedido_id ?? l.pedido_nro ?? l.nro);
        if (!pid) return;

        const label = String(
          l.articulo ?? l.nombre ?? l.descripcion ?? l.item ?? l.articulo_nombre ?? l.articulo_id ?? ''
        ).trim() || 'SIN NOMBRE';
        const qty = Number(l.cantidad ?? l.qty ?? l.cantidad_item ?? 0);
        const valor = Number(l.valor ?? l.precio ?? l.monto ?? 0);

        const arr = itemsByPedido.get(pid) ?? [];
        arr.push({ articulo: label, qty, valor });
        itemsByPedido.set(pid, arr);
      });

      const fotosMapByPedido = new Map<number, string[]>();
      (fotos ?? []).forEach((f: any) => {
        const pid = Number(f.pedido_id ?? f.nro);
        const url = typeof f.url === 'string' ? f.url.trim() : '';
        if (!pid || !url) return;
        const arr = fotosMapByPedido.get(pid) ?? [];
        arr.push(url);
        fotosMapByPedido.set(pid, arr);
      });

      const mapped: Pedido[] = (rows ?? []).map((r: any) => {
        const telStr = r.telefono ? String(r.telefono) : null;
        const cliInfo = telStr ? cliByTel.get(telStr) : undefined;
        
        const baseFotos = allFotosFromMixed(r.foto_url);
        const extraFotos = fotosMapByPedido.get(r.id) ?? [];
        const fotosArr: string[] = [];
        baseFotos.forEach((u) => { if (u && !fotosArr.includes(u)) fotosArr.push(u); });
        extraFotos.forEach((u) => { if (u && !fotosArr.includes(u)) fotosArr.push(u); });
        
        const principal = fotosArr[0] ?? firstFotoFromMixed(r.foto_url) ?? null;

        return {
          id: r.id,
          cliente: cliInfo?.nombre ?? telStr ?? 'SIN NOMBRE',
          telefono: telStr,
          direccion: cliInfo?.direccion ?? null,
          total: r.total ?? null,
          estado: r.estado,
          detalle: r.detalle ?? null,
          foto_url: principal,
          fotos: fotosArr,
          pagado: r.pagado ?? false,
          items: itemsByPedido.get(r.id) ?? [],
          tipo_entrega: r.tipo_entrega ?? null,
          token_servicio: r.token_servicio ?? null,
        };
      });

      // Orden secundario (pagado, id) para entregado/entregar si es descendente
      if (ordenDescendente) {
        mapped.sort((a, b) => {
          const ap = !!a.pagado;
          const bp = !!b.pagado;
          if (ap !== bp) return ap ? 1 : -1; // pendientes primero
          return (b.id ?? 0) - (a.id ?? 0); // descendente general (o invertido, dependiendo)
        });
      }

      if (!cancelled) {
        setPedidos(mapped);
        setLoading(false);
      }
    } catch (err: any) {
      console.error(err);
      if (!cancelled) {
        setErrMsg(err?.message ?? 'Error al cargar pedidos');
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetchPedidos(cancelled);

    let channel: any;
    if (usarRealtime) {
      channel = supabase
        .channel(`realtime-tablero-${estadoBase}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pedido' }, () => {
          fetchPedidos();
        })
        .subscribe();
    }

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [estadoBase, tipoEntregaFilter, ordenDescendente, usarRealtime]);

  // Manejo de ?nro= en URL
  useEffect(() => {
    let nroParam = searchParams?.get('nro');
    
    // Fallback manual a window.location.search por si hook falla
    if (!nroParam && typeof window !== 'undefined') {
       const sp = new URLSearchParams(window.location.search);
       nroParam = sp.get('nro');
    }

    if (!pedidos.length || initialScrollDone || !nroParam) return;

    const nroNum = Number(nroParam);
    if (!nroNum) return;

    const target = pedidos.find((p) => p.id === nroNum);
    if (!target) return;

    setOpenId(target.id);
    setOpenDetail((prev) => ({ ...prev, [target.id]: true }));

    setTimeout(() => {
      const el = document.getElementById(`pedido-${target.id}`) || document.querySelector(`[data-pedido-id="${target.id}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 200);

    setInitialScrollDone(true);
  }, [pedidos, searchParams, initialScrollDone]);

  function snack(msg: string) {
    setNotice(msg);
    setTimeout(() => setNotice(null), 1800);
  }

  async function changeEstado(id: number, next: PedidoEstado) {
    if (!id) return;
    const pedido = pedidos.find((p) => p.id === id);
    if (!pedido) return;

    setSaving(true);
    const prev = pedidos;
    setPedidos(prev.map((p) => (p.id === id ? { ...p, estado: next } : p)));

    const update: any = { estado: next };
    // Lógica especial si pasa a GUARDADO
    if (next === 'GUARDADO') {
      update.tipo_entrega = esPedidoDomicilio(pedido) ? 'DOMICILIO' : 'LOCAL';
    }

    const { error } = await supabase.from('pedido').update(update).eq('nro', id);
    if (error) {
      console.error('No se pudo actualizar estado:', error);
      setPedidos(prev);
      setSaving(false);
      snack('Error al cambiar de estado.');
      return;
    }

    if (next !== estadoBase) {
      setPedidos((curr) => curr.filter((p) => p.id !== id));
      setOpenId(null);
      if (next === 'GUARDADO') {
        const esDom = esPedidoDomicilio(pedido);
        snack(`Pedido #${id} movido a GUARDADO ${esDom ? 'DOMICILIO' : 'LOCAL'}`);
      } else {
        snack(`Pedido #${id} movido a ${next}`);
      }
    }
    setSaving(false);
  }

  async function togglePago(id: number) {
    if (!id) return;
    setSaving(true);
    const prev = pedidos;
    const actual = prev.find((p) => p.id === id)?.pagado ?? false;
    setPedidos(prev.map((p) => (p.id === id ? { ...p, pagado: !actual } : p)));

    const { error } = await supabase.from('pedido').update({ pagado: !actual }).eq('nro', id);
    if (error) {
      console.error('Error actualizando pago:', error);
      setPedidos(prev);
      setSaving(false);
      return;
    }

    snack(`Pedido #${id} marcado como ${!actual ? 'Pagado' : 'Pendiente'}`);
    setSaving(false);
  }

  // --- FOTOS ---
  function openPickerFor(pid: number, fotoUrl?: string | null) {
    setPickerForPedido(pid);
    setPickerFotoUrl(fotoUrl ?? null);
  }

  async function handlePick(kind: 'camera' | 'file') {
    if (!pickerForPedido) return;
    if (kind === 'camera') inputCamRef.current?.click();
    else inputFileRef.current?.click();
  }

  async function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    e.target.value = '';
    const pid = pickerForPedido;
    if (!pid || !file) {
      setPickerForPedido(null);
      return;
    }

    try {
      setUploading((prev) => ({ ...prev, [pid]: true }));
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `pedido-${pid}/${Date.now()}.${ext}`;

      const { data: up, error: upErr } = await supabase.storage.from('fotos').upload(path, file, { cacheControl: '3600', upsert: false });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from('fotos').getPublicUrl(up!.path);
      const publicUrl = pub.publicUrl;

      // Insertar en pedido_foto
      const { error: insErr } = await supabase.from('pedido_foto').insert({ pedido_id: pid, url: publicUrl });
      if (insErr) throw insErr;

      const pedidoActual = pedidos.find((p) => p.id === pid);
      const fotosActuales = pedidoActual?.fotos ?? [];
      const nuevasFotos = [...fotosActuales, publicUrl];

      await supabase.from('pedido').update({ foto_url: JSON.stringify(nuevasFotos) }).eq('nro', pid);

      setPedidos((prev) =>
        prev.map((p) =>
          p.id === pid ? { ...p, foto_url: publicUrl, fotos: nuevasFotos } : p
        )
      );
      setImageError((prev) => ({ ...prev, [pid]: false }));
      setCurrentSlide((prev) => ({ ...prev, [pid]: nuevasFotos.length - 1 }));
      snack(`Foto subida al pedido #${pid}`);
    } catch (err: any) {
      console.error(err);
      snack('No se pudo subir la foto.');
    } finally {
      setUploading((prev) => ({ ...prev, [pid]: false }));
      setPickerForPedido(null);
      setPickerFotoUrl(null);
    }
  }

  async function handleDeleteFoto(pedidoId: number, fotoUrl?: string | null) {
    if (!pedidoId) return;
    try {
      const pedidoActual = pedidos.find((p) => p.id === pedidoId);
      const fotosActuales = pedidoActual?.fotos ?? [];
      const targetUrl = fotoUrl || fotosActuales[0] || null;
      if (!targetUrl) return snack('No hay foto para eliminar.');

      try {
        const urlObj = new URL(targetUrl);
        const marker = '/object/public/';
        const idx = urlObj.pathname.indexOf(marker);
        if (idx >= 0) {
          let path = urlObj.pathname.substring(idx + marker.length);
          if (path.startsWith('fotos/')) path = path.substring('fotos/'.length);
          if (path) await supabase.storage.from('fotos').remove([path]);
        }
      } catch (e) { console.warn(e); }

      await supabase.from('pedido_foto').delete().match({ pedido_id: pedidoId, url: targetUrl });
      const nuevasFotos = fotosActuales.filter((u) => u !== targetUrl);
      await supabase.from('pedido').update({ foto_url: nuevasFotos.length ? JSON.stringify(nuevasFotos) : null }).eq('nro', pedidoId);

      setPedidos((prev) =>
        prev.map((p) => p.id === pedidoId ? { ...p, fotos: nuevasFotos, foto_url: nuevasFotos[0] ?? null } : p)
      );
      setCurrentSlide((prev) => {
        const next = { ...prev };
        if (!nuevasFotos.length) delete next[pedidoId];
        else next[pedidoId] = Math.min(prev[pedidoId] ?? 0, nuevasFotos.length - 1);
        return next;
      });
      setImageError((prev) => ({ ...prev, [pedidoId]: false }));
      snack('Foto eliminada.');
    } catch (err) {
      console.error(err);
      snack('No se pudo eliminar la foto.');
    }
  }

  function changeSlide(pedidoId: number, direction: -1 | 1) {
    const pedido = pedidos.find((p) => p.id === pedidoId);
    if (!pedido || (pedido.fotos?.length ?? 0) <= 1) return;
    const total = pedido.fotos!.length;
    setCurrentSlide((prev) => ({
      ...prev,
      [pedidoId]: ((prev[pedidoId] ?? 0) + direction + total) % total,
    }));
  }

  // --- WHATSAPP COMPROBANTE ---
  async function ensureServicioToken(p: Pedido): Promise<string | null> {
    if (p.token_servicio) return p.token_servicio;
    const newToken = `${p.id}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const { error } = await supabase.from('pedido').update({ token_servicio: newToken }).eq('nro', p.id);
    if (error) {
      snack('No se pudo generar un link seguro para este pedido.');
      return null;
    }
    setPedidos((prev) => prev.map((x) => (x.id === p.id ? { ...x, token_servicio: newToken } : x)));
    return newToken;
  }

  async function sendComprobanteLink(p?: Pedido | null) {
    if (!p) return;
    setSaving(true);
    try {
      const token = await ensureServicioToken(p);
      if (!token) return;
      const link = `${getBaseUrl()}/servicio?token=${encodeURIComponent(token)}`;
      const texto = [
        `*SERVICIO N° ${p.id}*`,
        estadoBase === 'ENTREGAR' ? 'Tu detalle está aquí:' : 'Ya está listo, puedes revisarlo aquí.:',
        link,
        '',
        'Gracias por preferirnos 💜',
      ].join('\n');

      const backup = (process.env.NEXT_PUBLIC_WA_BACKUP || '56991335828').trim();
      const telE164 = toE164CL(p.telefono) || toE164CL(backup);
      if (!telE164) {
        navigator.clipboard?.writeText(link);
        alert('No hay teléfono. Copié el link al portapapeles.');
        return;
      }
      const encoded = encodeURIComponent(texto);
      const waUrl = `https://wa.me/${telE164}?text=${encoded}`;
      const w = window.open(waUrl, '_blank');
      if (!w || w.closed || typeof w.closed === 'undefined') {
        window.open(`https://api.whatsapp.com/send?phone=${telE164}&text=${encoded}`, '_blank');
      }
    } finally {
      setSaving(false);
    }
  }

  // RUTA
  function openRuta(p: Pedido) {
    const baseDir = normalizarDireccion(p.direccion || p.detalle) || (p.cliente !== 'SIN NOMBRE' ? p.cliente : null);
    if (!baseDir) return snack('Este cliente no tiene dirección registrada.');
    const query = encodeURIComponent(`${baseDir}, La Serena, Chile`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
  }

  // EDICION
  const goEdit = (idFromButton?: number) => {
    const target = idFromButton ?? askEditForId;
    if (!target) return;
    if (!idFromButton) setAskEditForId(null);
    router.push(`/editar?nro=${target}`);
  };

  return {
    pedidos, loading, errMsg, notice,
    openId, setOpenId, openDetail, setOpenDetail,
    imageError, setImageError, saving,
    pickerForPedido, setPickerForPedido, pickerFotoUrl, setPickerFotoUrl, uploading,
    inputCamRef, inputFileRef, askEditForId, setAskEditForId, askPaidForId, setAskPaidForId,
    currentSlide, changeSlide,
    changeEstado, togglePago, handleDeleteFoto, handlePick, onFileSelected, openPickerFor,
    sendComprobanteLink, openRuta, goEdit,
    router
  };
}
