import { supabase } from './supabase';
import { dbError } from './db';

export const BUCKET = 'publico';
export type Pasta = 'barbeiros' | 'galeria';

const MAX_BYTES = 5 * 1024 * 1024;
const TIPOS = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

/** Envia a imagem e devolve a URL pública definitiva. */
export async function enviarImagem(file: File, pasta: Pasta): Promise<string> {
  if (!TIPOS.includes(file.type)) {
    throw new Error('Formato não aceito. Use JPG, PNG, WebP ou AVIF.');
  }
  if (file.size > MAX_BYTES) {
    throw new Error(`Imagem de ${(file.size / 1048576).toFixed(1)} MB. O limite é 5 MB.`);
  }

  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const nome = `${pasta}/${crypto.randomUUID()}.${ext || 'jpg'}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(nome, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(dbError(error));

  return supabase.storage.from(BUCKET).getPublicUrl(nome).data.publicUrl;
}

/** Remove do armazenamento a imagem apontada por uma URL pública nossa. */
export async function removerImagem(url: string | null | undefined): Promise<void> {
  if (!url) return;
  const marca = `/${BUCKET}/`;
  const i = url.indexOf(marca);
  if (i < 0) return; // não é nossa; nada a remover
  const caminho = decodeURIComponent(url.slice(i + marca.length).split('?')[0]);
  await supabase.storage.from(BUCKET).remove([caminho]);
}
