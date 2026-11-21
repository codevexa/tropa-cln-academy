import { useRef, useState } from 'react';
import { enviarImagem, removerImagem, type Pasta } from '../lib/storage';
import { IcTrash, IcPlus } from './icons';

/**
 * Campo de foto: pré-visualiza, envia para o armazenamento e devolve a URL.
 * A imagem antiga é apagada quando substituída, para não acumular lixo.
 */
export function FotoUpload({ url, pasta, onChange, altura = 150, label }: {
  url: string | null;
  pasta: Pasta;
  onChange: (url: string | null) => void;
  altura?: number;
  label?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function escolher(file: File | undefined) {
    if (!file) return;
    setEnviando(true); setErro(null);
    try {
      const anterior = url;
      const nova = await enviarImagem(file, pasta);
      onChange(nova);
      if (anterior) await removerImagem(anterior);
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setEnviando(false);
      if (input.current) input.current.value = '';
    }
  }

  async function limpar() {
    const anterior = url;
    onChange(null);
    if (anterior) await removerImagem(anterior);
  }

  return (
    <div className="field">
      {label && <label>{label}</label>}
      <div className="foto-box" style={{ height: altura }}>
        {url
          ? <img src={url} alt="" />
          : <span className="foto-vazia">{enviando ? 'Enviando…' : 'Sem foto'}</span>}
        {enviando && <span className="foto-carregando" />}
      </div>
      <div className="row gap8 mt8">
        <button type="button" className="btn sm" disabled={enviando}
                onClick={() => input.current?.click()}>
          <IcPlus />{url ? 'Trocar' : 'Enviar foto'}
        </button>
        {url && (
          <button type="button" className="btn sm bad" disabled={enviando} onClick={limpar}>
            <IcTrash />Remover
          </button>
        )}
      </div>
      <input ref={input} type="file" hidden accept="image/jpeg,image/png,image/webp,image/avif"
             onChange={(e) => void escolher(e.target.files?.[0])} />
      {erro && <span className="hint" style={{ color: '#e3a0a0' }}>{erro}</span>}
      <span className="hint">JPG, PNG, WebP ou AVIF · até 5 MB</span>
    </div>
  );
}
