import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { must, dbError } from '../lib/db';
import { weekdayBR } from '../lib/format';
import { Field, ErrorBox, useAsync, useSubmit, Banner, SkeletonTabela } from '../ui/kit';
import type { BusinessHour } from '../lib/types';

interface Business {
  name?: string; since?: number; phone?: string; address?: string;
  city?: string; state?: string; instagram?: string | null; timezone?: string;
}

export default function Config() {
  const [tab, setTab] = useState<'horarios' | 'dados'>('horarios');
  return (
    <>
      <div className="tabs">
        <button className={'tab' + (tab === 'horarios' ? ' on' : '')} onClick={() => setTab('horarios')}>Horário de funcionamento</button>
        <button className={'tab' + (tab === 'dados' ? ' on' : '')} onClick={() => setTab('dados')}>Dados do estabelecimento</button>
      </div>
      {tab === 'horarios' ? <Horarios /> : <Dados />}
    </>
  );
}

function Horarios() {
  const list = useAsync(
    () => must(supabase.from('business_hours').select('*').order('weekday')) as Promise<BusinessHour[]>, []
  );
  const [rows, setRows] = useState<BusinessHour[]>([]);
  const { busy, error, run } = useSubmit();
  const [saved, setSaved] = useState(false);

  useEffect(() => { if (list.data) setRows(list.data); }, [list.data]);

  const set = (w: number, patch: Partial<BusinessHour>) =>
    setRows((rs) => rs.map((r) => (r.weekday === w ? { ...r, ...patch } : r)));

  const save = () => run(null, async () => {
    for (const r of rows) {
      if (!r.closed && (!r.opens || !r.closes)) {
        throw new Error(`Preencha abertura e fechamento de ${weekdayBR(r.weekday)} ou marque como fechado.`);
      }
      const { error: e } = await supabase.from('business_hours')
        .update({ opens: r.closed ? null : r.opens, closes: r.closed ? null : r.closes, closed: r.closed })
        .eq('weekday', r.weekday);
      if (e) throw new Error(dbError(e));
    }
    setSaved(true); setTimeout(() => setSaved(false), 2500);
    list.reload();
  });

  const allClosed = rows.every((r) => r.closed);

  return (
    <>
      {allClosed && (
        <div className="mb16"><Banner tone="warn">
          <b>Nenhum dia aberto.</b> Enquanto todos os dias estiverem fechados, o site não oferece
          horários para agendamento. Configure a jornada da barbearia abaixo.
        </Banner></div>
      )}
      {list.loading && <SkeletonTabela />}
      {error && <div className="mb16"><ErrorBox msg={error} /></div>}
      {saved && <div className="mb16"><div className="ok-msg">Horários salvos.</div></div>}

      <div className="card">
        {rows.map((r) => (
          <div className="list-row" key={r.weekday}>
            <b style={{ flex: '0 0 110px', fontWeight: 500, fontSize: '.86rem' }}>{weekdayBR(r.weekday)}</b>
            <label className="row gap8" style={{ flex: '0 0 110px', cursor: 'pointer', fontSize: '.82rem' }}>
              <input type="checkbox" checked={!r.closed} onChange={(e) => set(r.weekday, { closed: !e.target.checked })} />
              {r.closed ? 'Fechado' : 'Aberto'}
            </label>
            <input className="inp" type="time" style={{ maxWidth: 130 }} disabled={r.closed}
                   value={r.opens?.slice(0, 5) ?? ''} onChange={(e) => set(r.weekday, { opens: e.target.value })} />
            <span className="mut2">às</span>
            <input className="inp" type="time" style={{ maxWidth: 130 }} disabled={r.closed}
                   value={r.closes?.slice(0, 5) ?? ''} onChange={(e) => set(r.weekday, { closes: e.target.value })} />
          </div>
        ))}
        <div className="row mt16" style={{ justifyContent: 'flex-end' }}>
          <button className="btn pri" onClick={save} disabled={busy}>{busy ? 'Salvando…' : 'Salvar horários'}</button>
        </div>
      </div>

      <div className="mt16">
        <Banner>
          Cada barbeiro pode ter jornada própria em <b>Profissionais → Disponibilidade</b>. Quando
          existe jornada individual, ela tem prioridade sobre o horário da casa.
        </Banner>
      </div>
    </>
  );
}

function Dados() {
  const cfg = useAsync(
    () => must(supabase.from('settings').select('*').eq('key', 'business').maybeSingle()) as Promise<{ value: Business } | null>, []
  );
  const [v, setV] = useState<Business>({});
  const { busy, error, run } = useSubmit();
  const [saved, setSaved] = useState(false);

  useEffect(() => { if (cfg.data?.value) setV(cfg.data.value); }, [cfg.data]);

  const save = () => run(null, async () => {
    const { data: u } = await supabase.auth.getUser();
    const { error: e } = await supabase.from('settings')
      .upsert({ key: 'business', value: v, updated_by: u.user?.id, updated_at: new Date().toISOString() });
    if (e) throw new Error(dbError(e));
    setSaved(true); setTimeout(() => setSaved(false), 2500);
  });

  return (
    <>
      {cfg.loading && <SkeletonTabela />}
      {error && <div className="mb16"><ErrorBox msg={error} /></div>}
      {saved && <div className="mb16"><div className="ok-msg">Dados salvos.</div></div>}
      <div className="card">
        <div className="form-grid">
          <Field label="Nome"><input className="inp" value={v.name ?? ''} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
          <Field label="Desde (ano)"><input className="inp" inputMode="numeric" value={v.since ?? ''}
                 onChange={(e) => setV({ ...v, since: Number(e.target.value) || undefined })} /></Field>
          <Field label="Telefone"><input className="inp" value={v.phone ?? ''} onChange={(e) => setV({ ...v, phone: e.target.value })} /></Field>
          <Field label="Instagram" hint="Campo editável — informe o @perfil.">
            <input className="inp" value={v.instagram ?? ''} onChange={(e) => setV({ ...v, instagram: e.target.value })} placeholder="@diamondbarbearia" />
          </Field>
          <Field label="Endereço" full><input className="inp" value={v.address ?? ''} onChange={(e) => setV({ ...v, address: e.target.value })} /></Field>
          <Field label="Cidade"><input className="inp" value={v.city ?? ''} onChange={(e) => setV({ ...v, city: e.target.value })} /></Field>
          <Field label="Estado"><input className="inp" value={v.state ?? ''} onChange={(e) => setV({ ...v, state: e.target.value })} /></Field>
        </div>
        <div className="row mt16" style={{ justifyContent: 'flex-end' }}>
          <button className="btn pri" onClick={save} disabled={busy}>{busy ? 'Salvando…' : 'Salvar dados'}</button>
        </div>
      </div>
    </>
  );
}
