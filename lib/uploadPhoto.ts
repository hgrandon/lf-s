// appweb/lib/uploadPhoto.ts
import { supabase } from '@/lib/supabaseClient';

export async function uploadPhoto(file: File, orderId: string | number) {
  if (!file) throw new Error('Archivo vacío');

  const path = `pedido-${orderId}/${crypto.randomUUID()}-${(file.name || 'foto').replace(/\s+/g, '_')}`;

  const { error } = await supabase
    .storage
    .from('fotos') // ← debe coincidir con el bucket
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type || 'image/jpeg',
    });

  if (error) throw error;

  const { data: pub } = supabase.storage.from('fotos').getPublicUrl(path);
  return { path, publicUrl: pub.publicUrl };
}
