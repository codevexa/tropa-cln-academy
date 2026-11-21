import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { must, dbError } from '../lib/db';
import { removerImagem } from '../lib/storage';
import { Field, Loading, ErrorBox, Empty, useAsync, useSubmit, Banner, Modal } from '../ui/kit';
import { FotoUpload } from '../ui/FotoUpload';
import { SeletorDeFotos, AMBIENTES_DO_SITE } from '../ui/FotosDoSite';
import { IcPlus, IcTrash, IcEdit } from '../ui/icons';
import type { GalleryImage, SiteContent } from '../lib/types';

export default function Site() {
  const [aba, setAba] = useState<'textos' | 'galeria' | 'contato'>('textos');
  return (
    <>
      <div className="mb16">
        <Banner>
          Tudo desta tela aparece no <b>site público</b>. As alterações valem assim que o
          visitante recarrega a página — não precisa publicar nada.
        </Banner>
      </div>
      <div className="tabs">
        <button className={'tab' + (aba === 'textos' ? ' on' : '')} onClick={() => setAba('textos')}>Textos</button>
        <button className={'tab' + (aba === 'galeria' ? ' on' : '')} onClick={() => setAba('galeria')}>Galeria</button>
        <button className={'tab' + (aba === 'contato' ? ' on' : '')} onClick={() => setAba('contato')}>Contato</button>
      </div>
      {aba === 'textos' ? <Textos /> : aba === 'galeria' ? <Galeria /> : <Contato />}
    </>
  );
}

/* ------------------------------------------------------------- textos --- */
function Textos() {
  const cfg = useAsync(
    () => must(supabase.from('settings').select('value').eq('key', 'site').maybeSingle()) as Promise<{ value: SiteContent } | null>,
    []
  );
  const [v, setV] = useState<SiteContent>({});
  const { busy, error, run } = useSubmit();
  const [salvo, setSalvo] = useState(false);

  useEffect(() => { if (cfg.data?.value) setV(cfg.data.value); }, [cfg.data]);

  const set = <S extends keyof SiteContent>(secao: S, campo: string, valor: string) =>
    setV((a) => ({ ...a, [secao]: { ...(a[secao] ?? {}), [campo]: valor } }));

  const salvar = () => run(null, async () => {
    const { data: u } = await supabase.auth.getUser();
    const { error: e } = await supabase.from('settings').upsert({
      key: 'site', value: v, updated_by: u.user?.id, updated_at: new Date().toISOString(),
    });
    if (e) throw new Error(dbError(e));
    setSalvo(true); setTimeout(() => setSalvo(false), 2500);
  });

  if (cfg.loading) return <Loading />;
  if (cfg.error) return <ErrorBox msg={cfg.error} />;

  return (
    <>
      {error && <div className="mb16"><ErrorBox msg={error} /></div>}
      {salvo && <div className="mb16"><div className="ok-msg">Textos salvos. Recarregue o site para ver.</div></div>}

      <div className="card mb16">
        <div className="card-h"><h3>Abertura</h3></div>
        <div className="form-grid">
          <Field label="Primeira linha" hint="Aparece grande, no topo.">
            <input className="inp" value={v.hero?.titulo1 ?? ''} onChange={(e) => set('hero', 'titulo1', e.target.value)} />
          </Field>
          <Field label="Segunda linha">
            <input className="inp" value={v.hero?.titulo2 ?? ''} onChange={(e) => set('hero', 'titulo2', e.target.value)} />
          </Field>
          <Field label="Assinatura" full>
            <input className="inp" value={v.hero?.subtitulo ?? ''} onChange={(e) => set('hero', 'subtitulo', e.target.value)} />
          </Field>
          <Field label="Linha de tradição" full>
            <input className="inp" value={v.hero?.desde ?? ''} onChange={(e) => set('hero', 'desde', e.target.value)} />
          </Field>
        </div>
      </div>

      <div className="card mb16">
        <div className="card-h"><h3>Apresentação</h3></div>
        <div className="form-grid">
          <div className="full">
            <FotoUpload label="Foto da seção" url={v.sobre?.foto ?? null} pasta="galeria"
                        altura={200} onChange={(u) => set('sobre', 'foto', u ?? '')} />
          </div>
          <div className="full">
            <SeletorDeFotos titulo="Ou aproveite uma foto já publicada"
                            fotos={AMBIENTES_DO_SITE} atual={v.sobre?.foto ?? null}
                            onPick={(u) => set('sobre', 'foto', u)} />
          </div>
          <Field label="Título" full>
            <input className="inp" value={v.sobre?.titulo ?? ''} onChange={(e) => set('sobre', 'titulo', e.target.value)} />
          </Field>
          <Field label="Primeiro parágrafo" full>
            <textarea className="inp" value={v.sobre?.paragrafo1 ?? ''} onChange={(e) => set('sobre', 'paragrafo1', e.target.value)} />
          </Field>
          <Field label="Segundo parágrafo" full>
            <textarea className="inp" value={v.sobre?.paragrafo2 ?? ''} onChange={(e) => set('sobre', 'paragrafo2', e.target.value)} />
          </Field>
        </div>
      </div>

      <div className="card mb16">
        <div className="card-h"><h3>Manifesto</h3></div>
        <div className="form-grid">
          <Field label="Título" full>
            <input className="inp" value={v.manifesto?.titulo ?? ''} onChange={(e) => set('manifesto', 'titulo', e.target.value)} />
          </Field>
          <Field label="Texto" full>
            <textarea className="inp" value={v.manifesto?.texto ?? ''} onChange={(e) => set('manifesto', 'texto', e.target.value)} />
          </Field>
        </div>
      </div>

      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn pri" onClick={salvar} disabled={busy}>{busy ? 'Salvando…' : 'Salvar textos'}</button>
      </div>
    </>
  );
}

/* ------------------------------------------------------------ contato --- */
interface Negocio {
  name?: string; since?: number; phone?: string; address?: string;
  city?: string; state?: string; instagram?: string | null;
}

function Contato() {
  const cfg = useAsync(
    () => must(supabase.from('settings').select('value').eq('key', 'business').maybeSingle()) as Promise<{ value: Negocio } | null>,
    []
  );
  const site = useAsync(
    () => must(supabase.from('settings').select('value').eq('key', 'site').maybeSingle()) as Promise<{ value: SiteContent } | null>,
    []
  );
  const [v, setV] = useState<Negocio>({});
  const [horarios, setHorarios] = useState('');
  const { busy, error, run } = useSubmit();
  const [salvo, setSalvo] = useState(false);

  useEffect(() => { if (cfg.data?.value) setV(cfg.data.value); }, [cfg.data]);
  useEffect(() => { setHorarios(site.data?.value?.contato?.horarios ?? ''); }, [site.data]);

  const salvar = () => run(null, async () => {
    const { data: u } = await supabase.auth.getUser();
    const atual = site.data?.value ?? {};
    const [a, b] = await Promise.all([
      supabase.from('settings').upsert({ key: 'business', value: v, updated_by: u.user?.id, updated_at: new Date().toISOString() }),
      supabase.from('settings').upsert({
        key: 'site',
        value: { ...atual, contato: { ...(atual.contato ?? {}), horarios: horarios.trim() || null, instagram: v.instagram ?? null } },
        updated_by: u.user?.id, updated_at: new Date().toISOString(),
      }),
    ]);
    if (a.error) throw new Error(dbError(a.error));
    if (b.error) throw new Error(dbError(b.error));
    setSalvo(true); setTimeout(() => setSalvo(false), 2500);
  });

  if (cfg.loading || site.loading) return <Loading />;

  return (
    <>
      {error && <div className="mb16"><ErrorBox msg={error} /></div>}
      {salvo && <div className="mb16"><div className="ok-msg">Dados salvos.</div></div>}
      <div className="card">
        <div className="form-grid">
          <Field label="Nome"><input className="inp" value={v.name ?? ''} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
          <Field label="Desde (ano)">
            <input className="inp" inputMode="numeric" value={v.since ?? ''}
                   onChange={(e) => setV({ ...v, since: Number(e.target.value) || undefined })} />
          </Field>
          <Field label="Telefone / WhatsApp" hint="Só números e símbolos; vira o link do WhatsApp.">
            <input className="inp" value={v.phone ?? ''} onChange={(e) => setV({ ...v, phone: e.target.value })} />
          </Field>
          <Field label="Instagram" hint="Com @ ou o endereço completo.">
            <input className="inp" value={v.instagram ?? ''} onChange={(e) => setV({ ...v, instagram: e.target.value })} />
          </Field>
          <Field label="Endereço" full><input className="inp" value={v.address ?? ''} onChange={(e) => setV({ ...v, address: e.target.value })} /></Field>
          <Field label="Cidade"><input className="inp" value={v.city ?? ''} onChange={(e) => setV({ ...v, city: e.target.value })} /></Field>
          <Field label="Estado"><input className="inp" value={v.state ?? ''} onChange={(e) => setV({ ...v, state: e.target.value })} /></Field>
          <Field label="Horário de funcionamento" full
                 hint="Texto livre, como aparece no site. Ex.: Seg a Sáb, 9h às 20h.">
            <textarea className="inp" value={horarios} onChange={(e) => setHorarios(e.target.value)} />
          </Field>
        </div>
        <div className="row mt16" style={{ justifyContent: 'flex-end' }}>
          <button className="btn pri" onClick={salvar} disabled={busy}>{busy ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------ galeria --- */
function Galeria() {
  const lista = useAsync(
    () => must(supabase.from('gallery_images').select('*').order('order_index')) as Promise<GalleryImage[]>,
    []
  );
  const [editando, setEditando] = useState<GalleryImage | null>(null);
  const [nova, setNova] = useState(false);
  const { busy, error, run } = useSubmit();

  const excluir = (img: GalleryImage) => run(null, async () => {
    const { error: e } = await supabase.from('gallery_images').delete().eq('id', img.id);
    if (e) throw new Error(dbError(e));
    await removerImagem(img.url);
    lista.reload();
  });

  const alternar = (img: GalleryImage) => run(null, async () => {
    const { error: e } = await supabase.from('gallery_images')
      .update({ active: !img.active }).eq('id', img.id);
    if (e) throw new Error(dbError(e));
    lista.reload();
  });

  const itens = lista.data ?? [];

  return (
    <>
      <div className="row-b wrap mb16">
        <p className="mut" style={{ fontSize: '.84rem' }}>
          {itens.length} foto(s) · {itens.filter((i) => i.active).length} visível(is) no site
        </p>
        <button className="btn pri sm" onClick={() => setNova(true)}><IcPlus />Nova foto</button>
      </div>

      {error && <div className="mb16"><ErrorBox msg={error} /></div>}
      {lista.loading && <Loading />}
      {!lista.loading && !itens.length && <Empty msg="Nenhuma foto na galeria. O site mostra espaços reservados." />}

      <div className="gal-admin">
        {itens.map((img) => (
          <div className="gal-card" key={img.id}>
            <div className="capa"><img src={img.url} alt={img.caption ?? ''} loading="lazy" /></div>
            <div className="corpo">
              <b style={{ fontSize: '.82rem', fontWeight: 500 }}>{img.caption || <span className="mut2">sem legenda</span>}</b>
              <div className="row gap4 wrap">
                <button className="btn sm ghost" onClick={() => alternar(img)} disabled={busy}>
                  {img.active ? 'Visível' : 'Oculta'}
                </button>
                <button className="x" onClick={() => setEditando(img)} title="Editar"><IcEdit /></button>
                <button className="x" onClick={() => excluir(img)} disabled={busy} title="Excluir"><IcTrash /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {(nova || editando) && (
        <FotoForm img={editando} proximaOrdem={itens.length + 1}
                  onClose={() => { setNova(false); setEditando(null); }}
                  onDone={() => { setNova(false); setEditando(null); lista.reload(); }} />
      )}
    </>
  );
}

function FotoForm({ img, proximaOrdem, onClose, onDone }: {
  img: GalleryImage | null; proximaOrdem: number; onClose: () => void; onDone: () => void;
}) {
  const [url, setUrl] = useState<string | null>(img?.url ?? null);
  const [caption, setCaption] = useState(img?.caption ?? '');
  const [ordem, setOrdem] = useState(String(img?.order_index ?? proximaOrdem));
  const { busy, error, run } = useSubmit();

  const salvar = () => run(null, async () => {
    if (!url) throw new Error('Envie a imagem antes de salvar.');
    const dados = {
      url, caption: caption.trim() || null,
      order_index: parseInt(ordem, 10) || 0, active: true,
    };
    const { error: e } = img
      ? await supabase.from('gallery_images').update(dados).eq('id', img.id)
      : await supabase.from('gallery_images').insert(dados);
    if (e) throw new Error(dbError(e));
    onDone();
  });

  return (
    <Modal title={img ? 'Editar foto' : 'Nova foto da galeria'} onClose={onClose} footer={
      <>
        <button className="btn ghost" onClick={onClose}>Cancelar</button>
        <button className="btn pri" onClick={salvar} disabled={busy}>{busy ? 'Salvando…' : 'Salvar'}</button>
      </>
    }>
      {error && <div className="mb16"><ErrorBox msg={error} /></div>}
      <FotoUpload label="Imagem" url={url} pasta="galeria" altura={220} onChange={setUrl} />
      <div className="form-grid mt16">
        <Field label="Legenda" full hint="Aparece sobre a foto no site.">
          <input className="inp" value={caption} onChange={(e) => setCaption(e.target.value)}
                 placeholder="Ambiente, resultado, equipe…" />
        </Field>
        <Field label="Ordem" hint="Menor aparece primeiro.">
          <input className="inp" inputMode="numeric" value={ordem} onChange={(e) => setOrdem(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
