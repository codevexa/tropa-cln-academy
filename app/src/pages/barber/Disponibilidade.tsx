import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { must, dbError } from '../../lib/db';
import { useAuth } from '../../auth/AuthProvider';
import { weekdayBR, dateTimeBR } from '../../lib/format';
import { Modal, Field, Loading, ErrorBox, Empty, useAsync, useSubmit, Banner } from '../../ui/kit';
import { IcPlus, IcTrash } from '../../ui/icons';
import type { BarberSchedule, BarberTimeOff, BusinessHour } from '../../lib/types';

export default function Disponibilidade({ barberId }: { barberId?: string }) {
  const { barber } = useAuth();
  const id = barberId ?? barber?.id;

  const hours = useAsync(
    () => must(supabase.from('business_hours').select('*').order('weekday')) as Promise<BusinessHour[]>, []
  );
  const sched = useAsync(async () => {
    if (!id) return [];
    return must(supabase.from('barber_schedules').select('*').eq('barber_id', id)
      .order('weekday')) as Promise<BarberSchedule[]>;
  }, [id ?? '']);
  const off = useAsync(async () => {
    if (!id) return [];
    return must(supabase.from('barber_time_off').select('*').eq('barber_id', id)
      .gte('ends_at', new Date().toISOString()).order('starts_at')) as Promise<BarberTimeOff[]>;
  }, [id ?? '']);

  const [addSched, setAddSched] = useState<number | null>(null);
  const [addOff, setAddOff] = useState(false);
  const { busy, error, run } = useSubmit();

  if (!id) return <Banner tone="warn">Login sem barbeiro vinculado.</Banner>;

  const delSched = (sid: string) => run(null, async () => {
    const { error: e } = await supabase.from('barber_schedules').delete().eq('id', sid);
    if (e) throw new Error(dbError(e));
    sched.reload();
  });
  const delOff = (oid: string) => run(null, async () => {
    const { error: e } = await supabase.from('barber_time_off').delete().eq('id', oid);
    if (e) throw new Error(dbError(e));
    off.reload();
  });

  return (
    <>
      <div className="mb16">
        <Banner>
          Sem jornada cadastrada num dia, vale o horário da barbearia. Ao cadastrar, a sua jornada
          tem prioridade — é ela que define os horários oferecidos no site.
        </Banner>
      </div>

      {error && <div className="mb16"><ErrorBox msg={error} /></div>}

      <div className="grid g2">
        <div className="card">
          <div className="card-h"><h3>Minha jornada semanal</h3></div>
          {(hours.loading || sched.loading) && <Loading />}
          {(hours.data ?? []).map((h) => {
            const mine = (sched.data ?? []).filter((s) => s.weekday === h.weekday);
            return (
              <div className="list-row" key={h.weekday}>
                <b style={{ flex: '0 0 100px', fontWeight: 500, fontSize: '.86rem' }}>{weekdayBR(h.weekday)}</b>
                <div className="grow">
                  {mine.length ? mine.map((s) => (
                    <div className="row gap8" key={s.id} style={{ fontSize: '.84rem' }}>
                      <span className="tnum">{s.starts.slice(0, 5)} – {s.ends.slice(0, 5)}</span>
                      <button className="x" style={{ width: 26, height: 26 }} disabled={busy}
                              onClick={() => delSched(s.id)} title="Remover"><IcTrash /></button>
                    </div>
                  )) : (
                    <span className="mut2" style={{ fontSize: '.8rem' }}>
                      {h.closed ? 'Barbearia fechada' : `Segue a casa: ${h.opens?.slice(0, 5)} – ${h.closes?.slice(0, 5)}`}
                    </span>
                  )}
                </div>
                <button className="x" onClick={() => setAddSched(h.weekday)} title="Adicionar faixa"><IcPlus /></button>
              </div>
            );
          })}
        </div>

        <div className="card">
          <div className="card-h">
            <h3>Folgas e bloqueios</h3>
            <button className="btn sm" onClick={() => setAddOff(true)}><IcPlus />Nova folga</button>
          </div>
          {off.loading && <Loading />}
          {!off.loading && !(off.data ?? []).length && <Empty msg="Nenhuma folga futura." />}
          {(off.data ?? []).map((o) => (
            <div className="list-row" key={o.id}>
              <div className="grow">
                <b style={{ fontSize: '.84rem', fontWeight: 500 }}>
                  {dateTimeBR(o.starts_at)} → {dateTimeBR(o.ends_at)}
                </b>
                <div className="hint">{o.reason ?? 'Sem motivo informado'}</div>
              </div>
              <button className="x" disabled={busy} onClick={() => delOff(o.id)} title="Remover"><IcTrash /></button>
            </div>
          ))}
        </div>
      </div>

      {addSched !== null && (
        <SchedForm barberId={id} weekday={addSched} onClose={() => setAddSched(null)}
                   onDone={() => { setAddSched(null); sched.reload(); }} />
      )}
      {addOff && (
        <OffForm barberId={id} onClose={() => setAddOff(false)}
                 onDone={() => { setAddOff(false); off.reload(); }} />
      )}
    </>
  );
}

function SchedForm({ barberId, weekday, onClose, onDone }: {
  barberId: string; weekday: number; onClose: () => void; onDone: () => void;
}) {
  const [starts, setStarts] = useState('09:00');
  const [ends, setEnds] = useState('19:00');
  const { busy, error, run } = useSubmit();

  const save = () => run(null, async () => {
    if (ends <= starts) throw new Error('O fim deve ser depois do início.');
    const { error: e } = await supabase.from('barber_schedules')
      .insert({ barber_id: barberId, weekday, starts, ends });
    if (e) throw new Error(dbError(e));
    onDone();
  });

  return (
    <Modal title={`Jornada — ${weekdayBR(weekday)}`} onClose={onClose} footer={
      <>
        <button className="btn ghost" onClick={onClose}>Cancelar</button>
        <button className="btn pri" onClick={save} disabled={busy}>{busy ? 'Salvando…' : 'Adicionar'}</button>
      </>
    }>
      {error && <div className="mb16"><ErrorBox msg={error} /></div>}
      <div className="form-grid">
        <Field label="Início"><input className="inp" type="time" value={starts} onChange={(e) => setStarts(e.target.value)} /></Field>
        <Field label="Fim"><input className="inp" type="time" value={ends} onChange={(e) => setEnds(e.target.value)} /></Field>
      </div>
      <p className="hint mt16">Para intervalo de almoço, cadastre duas faixas no mesmo dia.</p>
    </Modal>
  );
}

function OffForm({ barberId, onClose, onDone }: {
  barberId: string; onClose: () => void; onDone: () => void;
}) {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const local = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const [startsAt, setStartsAt] = useState(local(now));
  const [endsAt, setEndsAt] = useState(local(new Date(now.getTime() + 3600000)));
  const [reason, setReason] = useState('');
  const { busy, error, run } = useSubmit();

  const save = () => run(null, async () => {
    const s = new Date(startsAt), e2 = new Date(endsAt);
    if (e2 <= s) throw new Error('O fim deve ser depois do início.');
    const { error: e } = await supabase.from('barber_time_off').insert({
      barber_id: barberId, starts_at: s.toISOString(), ends_at: e2.toISOString(),
      reason: reason.trim() || null,
    });
    if (e) throw new Error(dbError(e));
    onDone();
  });

  return (
    <Modal title="Nova folga / bloqueio" onClose={onClose} footer={
      <>
        <button className="btn ghost" onClick={onClose}>Cancelar</button>
        <button className="btn pri" onClick={save} disabled={busy}>{busy ? 'Salvando…' : 'Salvar'}</button>
      </>
    }>
      {error && <div className="mb16"><ErrorBox msg={error} /></div>}
      <div className="form-grid">
        <Field label="Início"><input className="inp" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /></Field>
        <Field label="Fim"><input className="inp" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} /></Field>
        <Field label="Motivo" full>
          <input className="inp" value={reason} onChange={(e) => setReason(e.target.value)}
                 placeholder="Folga, consulta, curso…" />
        </Field>
      </div>
      <p className="hint mt16">Horários dentro do bloqueio deixam de ser oferecidos no site.</p>
    </Modal>
  );
}
