/**
 * Fotos que já vieram com o site, servidas pelo próprio endereço público.
 * Ficam aqui para que o proprietário possa reaproveitá-las sem precisar
 * reenviar nada — era exatamente o que faltava para "ajustar o que já existe".
 */
const BASE = 'https://diamond-barbearia.vercel.app/assets/img';

export const RETRATOS_DO_SITE = [
  { url: `${BASE}/p1-portrait.webp`, nome: 'Retrato 1' },
  { url: `${BASE}/p2-portrait.webp`, nome: 'Retrato 2' },
  { url: `${BASE}/p3-portrait.webp`, nome: 'Retrato 3' },
  { url: `${BASE}/p4-portrait.webp`, nome: 'Retrato 4' },
  { url: `${BASE}/p5-portrait.webp`, nome: 'Retrato 5' },
];

export const AMBIENTES_DO_SITE = [
  { url: `${BASE}/p3.webp`, nome: 'Estação de trabalho' },
  { url: `${BASE}/p1.webp`, nome: 'Atendimento' },
  { url: `${BASE}/p2.webp`, nome: 'Acabamento' },
  { url: `${BASE}/p5.webp`, nome: 'Profissional' },
  { url: `${BASE}/p4.webp`, nome: 'Profissional' },
];

export function SeletorDeFotos({ fotos, atual, onPick, titulo }: {
  fotos: { url: string; nome: string }[];
  atual: string | null;
  onPick: (url: string) => void;
  titulo: string;
}) {
  return (
    <div className="field">
      <label>{titulo}</label>
      <div className="fotos-site">
        {fotos.map((f) => (
          <button type="button" key={f.url} title={f.nome}
                  className={'foto-chip' + (atual === f.url ? ' on' : '')}
                  onClick={() => onPick(f.url)}>
            <img src={f.url} alt={f.nome} loading="lazy" />
          </button>
        ))}
      </div>
      <span className="hint">Clique para usar uma foto que já está no site.</span>
    </div>
  );
}
