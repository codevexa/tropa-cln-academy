const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const NUM = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

export const money = (v: number | null | undefined) => BRL.format(Number(v ?? 0));
export const num = (v: number | null | undefined) => NUM.format(Number(v ?? 0));

export const dateBR = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR') : '—';

export const timeBR = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—';

export const dateTimeBR = (iso: string | null | undefined) =>
  iso ? `${dateBR(iso)} ${timeBR(iso)}` : '—';

export const weekdayBR = (w: number) =>
  ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][w] ?? '';

export const durationBR = (min: number) =>
  min >= 60 ? `${Math.floor(min / 60)}h${min % 60 ? ` ${min % 60}min` : ''}` : `${min} min`;

/** AAAA-MM-DD no fuso local (não em UTC). */
export const isoDay = (d: Date) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};

export const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export const endOfDay = (d: Date) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };
export const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const startOfWeek = (d: Date) => addDays(startOfDay(d), -d.getDay());
export const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
export const startOfYear = (d: Date) => new Date(d.getFullYear(), 0, 1);

export const phoneBR = (p: string | null | undefined) => {
  if (!p) return '—';
  const d = p.replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return p;
};

export const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase() ?? '').join('');

export const STATUS_LABEL: Record<string, string> = {
  aguardando: 'Aguardando', confirmado: 'Confirmado', em_atendimento: 'Em atendimento',
  concluido: 'Concluído', cancelado: 'Cancelado',
  aberta: 'Aberta', fechada: 'Fechada', cancelada: 'Cancelada',
  aberto: 'Aberto', fechado: 'Fechado',
  pendente: 'Pendente', parcial: 'Parcial', quitado: 'Quitado', paga: 'Paga',
  ativo: 'Ativo', esgotado: 'Esgotado', expirado: 'Expirado',
  dinheiro: 'Dinheiro', pix: 'PIX', credito: 'Crédito', debito: 'Débito', fiado: 'Fiado',
  entrada: 'Entrada', saida: 'Saída', ajuste: 'Ajuste',
};
export const label = (k: string | null | undefined) => (k ? STATUS_LABEL[k] ?? k : '—');
