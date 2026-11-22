import { useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { must, dbError } from '../lib/db';
import { useAuth } from '../auth/AuthProvider';
import {
  money, timeBR, dateBR, isoDay, addDays, startOfDay, endOfDay, startOfWeek,
  weekdayBR, label, durationBR,
} from '../lib/format';
import { Modal, Field, Badge, Loading, ErrorBox, Empty, useAsync, useSubmit, Banner } from '../ui/kit';
import { IcLeft, IcRight, IcPlus } from '../ui/icons';
import type { AppointmentFull, AppointmentStatus, Barber, Service, Client } from '../lib/types';

type View = 'dia' | 'semana' | 'mes';
const H_START = 7, H_END = 22, SLOT_PX = 56;

export default function Agenda({ barberOnly }: { barberOnly?: string }) {
  const { isStaff } = useAuth();
  const [view, setView] = useState<View>('dia');
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [editing, setEditing] = useState<AppointmentFull | null>(null);
  const [creating, setCreating] = useState<{ at: Date; barber?: string } | null>(null);

  const range = useMemo(() => {
    if (view === 'dia') return { from: startOfDay(anchor), to: endOfDay(anchor) };
    if (view === 'semana') return { from: startOfWeek(anchor), to: endOfDay(addDays(startOfWeek(anchor), 6)) };
    const f = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    return { from: f, to: endOfDay(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)) };
  }, [view, anchor]);

  const barbers = useAsync(
    () => must(supabase.from('barbers').select('id,profile_id,display_name,specialty,bio,photo_url,active,order_index').eq('active', true).order('order_index')),
    []
  );

  const appts = useAsync(async () => {
    let q = supabase.from('appointments')
      .select('*, clients(id,name,phone), barbers(id,display_name), services(id,name,duration_min,price)')
      .gte('starts_at', range.from.toISOString())
      .lte('starts_at', range.to.toISOString())
      .order('starts_at');
    if (barberOnly) q = q.eq('barber_id', barberOnly);
    return must(q) as Promise<AppointmentFull[]>;
  }, [range.from.getTime(), range.to.getTime(), barberOnly ?? '']);

  const cols: { key: string; title: string; sub: string }[] = useMemo(() => {
    if (view === 'semana') {
      return Array.from({ length: 7 }, (_, i) => {
        const d = addDays(startOfWeek(anchor), i);
        return { key: isoDay(d), title: weekdayBR(d.getDay()).slice(0, 3), sub: `${d.getDate()}/${d.getMonth() + 1}` };
      });
    }
    const list = (barbers.data ?? []).filter((b) => !barberOnly || b.id === barberOnly);
    return list.map((b) => ({ key: b.id, title: b.display_name, sub: '' }));
  }, [view, anchor, barbers.data, barberOnly]);

  const move = (n: number) => setAnchor((d) =>
    view === 'dia' ? addDays(d, n) : view === 'semana' ? addDays(d, n * 7)
      : new Date(d.getFullYear(), d.getMonth() + n, 1));

  const title = view === 'mes'
    ? anchor.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    : view === 'semana'
      ? `${dateBR(startOfWeek(anchor).toISOString())} – ${dateBR(addDays(startOfWeek(anchor), 6).toISOString())}`
      : `${weekdayBR(anchor.getDay())}, ${dateBR(anchor.toISOString())}`;

  const reload = () => { appts.reload(); };

  return (
    <>
      <div className="row-b wrap mb16">
        <div className="row gap8">
          <button className="x" onClick={() => move(-1)} aria-label="Anterior"><IcLeft /></button>
          <button className="btn sm ghost" onClick={() => setAnchor(startOfDay(new Date()))}>Hoje</button>
          <button className="x" onClick={() => move(1)} aria-label="Próximo"><IcRight /></button>
          <b className="d" style={{ marginLeft: 6, textTransform: 'capitalize' }}>{title}</b>
        </div>
        <div className="row gap8 wrap">
          <div className="seg">
            {(['dia', 'semana', 'mes'] as View[]).map((v) => (
              <button key={v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>
                {v === 'mes' ? 'Mês' : v}
              </button>
            ))}
          </div>
          {isStaff && (
            <button className="btn pri sm" onClick={() => setCreating({ at: new Date() })}>
              <IcPlus />Novo agendamento
            </button>
          )}
        </div>
      </div>

      {(appts.loading || barbers.loading) && <Loading />}
      {appts.error && <ErrorBox msg={appts.error} />}

      {!appts.loading && !appts.error && (
        view === 'mes'
          ? <MonthList items={appts.data ?? []} onPick={setEditing} />
          : <Grid cols={cols} view={view} anchor={anchor} items={appts.data ?? []}
                  onPick={setEditing}
                  onSlot={isStaff ? (at, key) => setCreating({ at, barber: view === 'semana' ? undefined : key }) : undefined} />
      )}

      {editing && (
        <ApptModal appt={editing} onClose={() => setEditing(null)}
                   onSaved={() => { setEditing(null); reload(); }} />
      )}
      {creating && (
        <NewApptModal init={creating} barbers={barbers.data ?? []}
                      onClose={() => setCreating(null)}
                      onSaved={() => { setCreating(null); reload(); }} />
      )}
    </>
  );
}

/* --------------------------------------------------------------- grade -- */
function Grid({ cols, view, anchor, items, onPick, onSlot }: {
  cols: { key: string; title: string; sub: string }[];
  view: View; anchor: Date; items: AppointmentFull[];
  onPick: (a: AppointmentFull) => void;
  onSlot?: (at: Date, colKey: string) => void;
}) {
  const hours = Array.from({ length: H_END - H_START }, (_, i) => H_START + i);
  if (!cols.length) return <Empty msg="Cadastre um profissional para usar a agenda." />;

  const place = (a: AppointmentFull) => {
    const s = new Date(a.starts_at), e = new Date(a.ends_at);
    const top = ((s.getHours() + s.getMinutes() / 60) - H_START) * SLOT_PX;
    const h = Math.max(((e.getTime() - s.getTime()) / 3600000) * SLOT_PX - 3, 24);
    return { top, h };
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <div className="cal-head" style={{ ['--cols' as string]: cols.length }}>
        <div />
        {cols.map((c) => <div key={c.key}><b>{c.title}</b>{c.sub && <span>{c.sub}</span>}</div>)}
      </div>
      <div className="cal-body" style={{ ['--cols' as string]: cols.length }}>
        <div className="cal-hours">
          {hours.map((h) => <div className="cal-hour" key={h}>{String(h).padStart(2, '0')}:00</div>)}
        </div>
        {cols.map((c) => {
          const colItems = items.filter((a) =>
            view === 'semana' ? isoDay(new Date(a.starts_at)) === c.key : a.barber_id === c.key
          );
          return (
            <div className="cal-col" key={c.key}>
              {hours.map((h) => (
                <div className="cal-slot" key={h} onClick={() => {
                  if (!onSlot) return;
                  const base = view === 'semana' ? new Date(c.key + 'T00:00') : new Date(anchor);
                  const at = new Date(base); at.setHours(h, 0, 0, 0);
                  onSlot(at, c.key);
                }} />
              ))}
              {colItems.map((a) => {
                const { top, h } = place(a);
                return (
                  <div key={a.id} className={'appt s-' + a.status} style={{ top, height: h }}
                       onClick={() => onPick(a)} role="button" tabIndex={0}
                       onKeyDown={(e) => e.key === 'Enter' && onPick(a)}>
                    <b>{a.clients?.name ?? a.client_name ?? 'Sem cliente'}</b>
                    <span>{timeBR(a.starts_at)} · {a.services?.name}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ mês/lista -- */
function MonthList({ items, onPick }: { items: AppointmentFull[]; onPick: (a: AppointmentFull) => void }) {
  if (!items.length) return <Empty msg="Nenhum agendamento neste mês." />;
  const byDay = new Map<string, AppointmentFull[]>();
  for (const a of items) {
    const k = isoDay(new Date(a.starts_at));
    byDay.set(k, [...(byDay.get(k) ?? []), a]);
  }
  return (
    <div className="grid" style={{ gap: 12 }}>
      {[...byDay.entries()].map(([day, list]) => (
        <div className="card" key={day}>
          <div className="card-h">
            <h3 style={{ textTransform: 'capitalize' }}>
              {weekdayBR(new Date(day + 'T12:00').getDay())}, {dateBR(day)}
            </h3>
            <span className="mut" style={{ fontSize: '.78rem' }}>{list.length} atendimento(s)</span>
          </div>
          <div className="tw">
            <table>
              <thead><tr><th>Hora</th><th>Cliente</th><th>Profissional</th><th>Serviço</th><th>Status</th><th className="num">Valor</th></tr></thead>
              <tbody>
                {list.map((a) => (
                  <tr key={a.id} onClick={() => onPick(a)} style={{ cursor: 'pointer' }}>
                    <td className="tnum">{timeBR(a.starts_at)}</td>
                    <td>{a.clients?.name ?? a.client_name ?? '—'}</td>
                    <td>{a.barbers?.display_name ?? '—'}</td>
                    <td>{a.services?.name ?? '—'}</td>
                    <td><Badge value={a.status} text={label(a.status)} /></td>
                    <td className="num">{money(a.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ----------------------------------------------------- detalhe / status -- */
const FLOW: AppointmentStatus[] = ['aguardando', 'confirmado', 'em_atendimento', 'concluido'];

function ApptModal({ appt, onClose, onSaved }: {
  appt: AppointmentFull; onClose: () => void; onSaved: () => void;
}) {
  const { isStaff } = useAuth();
  const { busy, error, setError, run } = useSubmit();
  const [reason, setReason] = useState('');
  const [askCancel, setAskCancel] = useState(false);

  const setStatus = (status: AppointmentStatus) => run(null, async () => {
    const patch: Record<string, unknown> = { status };
    if (status === 'cancelado') patch.cancel_reason = reason || null;
    const { error: e } = await supabase.from('appointments').update(patch).eq('id', appt.id);
    if (e) throw new Error(dbError(e));
    onSaved();
  });

  const idx = FLOW.indexOf(appt.status);
  const next = idx >= 0 && idx < FLOW.length - 1 ? FLOW[idx + 1] : null;
  const done = appt.status === 'concluido' || appt.status === 'cancelado';

  return (
    <Modal title={`Atendimento · ${timeBR(appt.starts_at)}`} onClose={onClose} footer={
      <>
        <button className="btn ghost" onClick={onClose}>Fechar</button>
        {!done && isStaff && (
          <button className="btn bad" onClick={() => setAskCancel(true)} disabled={busy}>Cancelar atendimento</button>
        )}
        {next && (
          <button className="btn pri" onClick={() => setStatus(next)} disabled={busy}>
            {next === 'confirmado' ? 'Confirmar'
              : next === 'em_atendimento' ? 'Iniciar atendimento' : 'Concluir'}
          </button>
        )}
      </>
    }>
      {error && <div className="mb16"><ErrorBox msg={error} /></div>}

      <div className="grid g2" style={{ gap: 12 }}>
        <Info k="Cliente" v={appt.clients?.name ?? appt.client_name ?? '—'} />
        <Info k="Telefone" v={appt.clients?.phone ?? appt.client_phone ?? '—'} />
        <Info k="Profissional" v={appt.barbers?.display_name ?? '—'} />
        <Info k="Serviço" v={appt.services?.name ?? '—'} />
        <Info k="Data" v={dateBR(appt.starts_at)} />
        <Info k="Horário" v={`${timeBR(appt.starts_at)} – ${timeBR(appt.ends_at)}`} />
        <Info k="Duração" v={durationBR(appt.services?.duration_min ?? 0)} />
        <Info k="Valor" v={money(appt.price)} />
        <Info k="Origem" v={appt.source === 'site' ? 'Site' : 'Painel'} />
        <div className="field">
          <label>Status</label>
          <div><Badge value={appt.status} text={label(appt.status)} /></div>
        </div>
      </div>

      {appt.notes && <div className="mt16"><Field label="Observações"><p className="mut">{appt.notes}</p></Field></div>}

      {appt.status === 'concluido' && (
        <div className="mt16">
          <Banner>Atendimento concluído já foi lançado na comanda do cliente. O faturamento aparece em Comandas.</Banner>
        </div>
      )}

      {askCancel && (
        <Modal title="Cancelar atendimento" onClose={() => setAskCancel(false)} footer={
          <>
            <button className="btn ghost" onClick={() => setAskCancel(false)}>Voltar</button>
            <button className="btn bad" disabled={busy}
                    onClick={() => { setError(null); setAskCancel(false); setStatus('cancelado'); }}>
              Confirmar cancelamento
            </button>
          </>
        }>
          <Field label="Motivo (opcional)">
            <input className="inp" value={reason} onChange={(e) => setReason(e.target.value)}
                   placeholder="Cliente desmarcou, imprevisto…" />
          </Field>
          <p className="hint mt8">O horário volta a ficar livre na agenda.</p>
        </Modal>
      )}
    </Modal>
  );
}

const Info = ({ k, v }: { k: string; v: string }) => (
  <div className="field"><label>{k}</label><span>{v}</span></div>
);

/* ---------------------------------------------------------- novo agend. -- */
function NewApptModal({ init, barbers, onClose, onSaved }: {
  init: { at: Date; barber?: string }; barbers: Barber[];
  onClose: () => void; onSaved: () => void;
}) {
  const { busy, error, run } = useSubmit();
  const [barberId, setBarberId] = useState(init.barber ?? barbers[0]?.id ?? '');
  const [serviceId, setServiceId] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [day, setDay] = useState(isoDay(init.at));
  const [time, setTime] = useState(
    `${String(init.at.getHours()).padStart(2, '0')}:${String(init.at.getMinutes()).padStart(2, '0')}`
  );
  const [notes, setNotes] = useState('');

  const services = useAsync(
    () => must(supabase.from('services').select('id,name,duration_min,price,category,active,order_index').eq('active', true).order('order_index')) as Promise<Service[]>, []
  );
  const clients = useAsync(
    () => must(supabase.from('clients').select('id,name,phone').order('name').limit(500)) as Promise<Client[]>, []
  );

  const svc = services.data?.find((s) => s.id === serviceId);

  const save = () => run(null, async () => {
    if (!barberId || !serviceId) throw new Error('Escolha o profissional e o serviço.');
    if (!clientId && !clientName.trim()) throw new Error('Informe o cliente.');
    const starts = new Date(`${day}T${time}`);
    if (Number.isNaN(starts.getTime())) throw new Error('Data ou horário inválido.');
    const ends = new Date(starts.getTime() + (svc?.duration_min ?? 30) * 60000);

    let cid: string | null = clientId || null;
    if (!cid && clientName.trim()) {
      const { data, error: ce } = await supabase.from('clients')
        .insert({ name: clientName.trim(), phone: clientPhone.trim() || null })
        .select('id').single();
      if (ce) throw new Error(dbError(ce));
      cid = data.id;
    }

    const { error: ae } = await supabase.from('appointments').insert({
      client_id: cid, barber_id: barberId, service_id: serviceId,
      starts_at: starts.toISOString(), ends_at: ends.toISOString(),
      price: svc?.price ?? 0, status: 'confirmado', source: 'painel',
      notes: notes.trim() || null,
      client_name: clientName.trim() || null, client_phone: clientPhone.trim() || null,
    });
    if (ae) throw new Error(dbError(ae));
    onSaved();
  });

  return (
    <Modal title="Novo agendamento" onClose={onClose} footer={
      <>
        <button className="btn ghost" onClick={onClose}>Cancelar</button>
        <button className="btn pri" onClick={save} disabled={busy}>{busy ? 'Salvando…' : 'Agendar'}</button>
      </>
    }>
      {error && <div className="mb16"><ErrorBox msg={error} /></div>}
      <div className="form-grid">
        <Field label="Profissional">
          <select className="inp" value={barberId} onChange={(e) => setBarberId(e.target.value)}>
            <option value="">Selecione</option>
            {barbers.map((b) => <option key={b.id} value={b.id}>{b.display_name}</option>)}
          </select>
        </Field>
        <Field label="Serviço">
          <select className="inp" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
            <option value="">Selecione</option>
            {(services.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>{s.name} — {money(s.price)} ({s.duration_min}min)</option>
            ))}
          </select>
        </Field>
        <Field label="Cliente cadastrado" full hint="Ou preencha nome e telefone abaixo para cadastrar na hora.">
          <select className="inp" value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">— novo cliente —</option>
            {(clients.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        {!clientId && (
          <>
            <Field label="Nome do cliente">
              <input className="inp" value={clientName} onChange={(e) => setClientName(e.target.value)} />
            </Field>
            <Field label="Telefone">
              <input className="inp" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)}
                     placeholder="(51) 90000-0000" />
            </Field>
          </>
        )}
        <Field label="Data"><input className="inp" type="date" value={day} onChange={(e) => setDay(e.target.value)} /></Field>
        <Field label="Horário"><input className="inp" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></Field>
        <Field label="Observações" full>
          <textarea className="inp" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
      {svc && (
        <p className="hint mt16">
          Duração {durationBR(svc.duration_min)} · encerra às{' '}
          {timeBR(new Date(new Date(`${day}T${time}`).getTime() + svc.duration_min * 60000).toISOString())}
        </p>
      )}
    </Modal>
  );
}
