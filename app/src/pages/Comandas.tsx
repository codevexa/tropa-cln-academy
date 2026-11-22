import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { must, dbError } from '../lib/db';
import { money, dateTimeBR, label, timeBR } from '../lib/format';
import { Modal, Field, Badge, ErrorBox, Empty, useAsync, useSubmit, Banner, SkeletonTabela } from '../ui/kit';
import { IcPlus, IcTrash } from '../ui/icons';
import type {
  TicketFull, Service, Barber, Client, PaymentMethod, CashSession, ClientPackageFull,
} from '../lib/types';

const METHODS: PaymentMethod[] = ['dinheiro', 'pix', 'credito', 'debito', 'fiado'];

export default function Comandas() {
  const [tab, setTab] = useState<'aberta' | 'fechada'>('aberta');
  const [open, setOpen] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const cash = useAsync(
    () => must(supabase.from('cash_sessions').select('id,opened_by,opened_at,opening_amount,closed_by,closed_at,closing_amount,status,notes').eq('status', 'aberto').maybeSingle()) as Promise<CashSession | null>,
    []
  );
  const list = useAsync(
    () => must(supabase.from('tickets')
      .select('*, clients(id,name), barbers(id,display_name), ticket_items(*), payments(*)')
      .eq('status', tab).order('opened_at', { ascending: false }).limit(100)) as Promise<TicketFull[]>,
    [tab]
  );

  return (
    <>
      {!cash.loading && !cash.data && (
        <div className="mb16"><Banner tone="warn">
          <b>Caixa fechado.</b> Abra o caixa para criar comandas e registrar pagamentos.
        </Banner></div>
      )}

      <div className="row-b wrap mb16">
        <div className="tabs" style={{ margin: 0, border: 0 }}>
          <button className={'tab' + (tab === 'aberta' ? ' on' : '')} onClick={() => setTab('aberta')}>Abertas</button>
          <button className={'tab' + (tab === 'fechada' ? ' on' : '')} onClick={() => setTab('fechada')}>Fechadas</button>
        </div>
        <button className="btn pri sm" disabled={!cash.data} onClick={() => setCreating(true)}>
          <IcPlus />Nova comanda
        </button>
      </div>

      {list.loading && <SkeletonTabela />}
      {list.error && <ErrorBox msg={list.error} />}
      {!list.loading && !(list.data ?? []).length && (
        <Empty msg={tab === 'aberta' ? 'Nenhuma comanda aberta.' : 'Nenhuma comanda fechada.'} />
      )}

      {!!(list.data ?? []).length && (
        <div className="tw">
          <table>
            <thead>
              <tr>
                <th>#</th><th>Aberta em</th><th>Cliente</th><th>Profissional</th>
                <th className="num">Itens</th><th className="num">Total</th>
                <th className="num">Pago</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(list.data ?? []).map((t) => (
                <tr key={t.id} onClick={() => setOpen(t.id)} style={{ cursor: 'pointer' }}>
                  <td className="tnum">#{t.code}</td>
                  <td>{dateTimeBR(t.opened_at)}</td>
                  <td>{t.clients?.name ?? '—'}</td>
                  <td>{t.barbers?.display_name ?? '—'}</td>
                  <td className="num">{t.ticket_items?.length ?? 0}</td>
                  <td className="num">{money(t.total)}</td>
                  <td className="num">{money(t.paid_total)}</td>
                  <td><Badge value={t.status} text={label(t.status)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && <TicketModal id={open} onClose={() => setOpen(null)} onChanged={() => list.reload()} />}
      {creating && cash.data && (
        <NewTicket cash={cash.data} onClose={() => setCreating(false)}
                   onDone={(id) => { setCreating(false); list.reload(); setOpen(id); }} />
      )}
    </>
  );
}

/* ------------------------------------------------------------- detalhe -- */
function TicketModal({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const t = useAsync(
    () => must(supabase.from('tickets')
      .select('*, clients(id,name), barbers(id,display_name), ticket_items(*), payments(*)')
      .eq('id', id).single()) as Promise<TicketFull>,
    [id]
  );
  const [addItem, setAddItem] = useState(false);
  const [addPay, setAddPay] = useState(false);
  const { busy, error, run } = useSubmit();

  const refresh = () => { t.reload(); onChanged(); };

  const data = t.data;
  const saldo = data ? Number(data.total) - Number(data.paid_total) : 0;
  const canClose = data && data.status === 'aberta' && saldo <= 0.009 && (data.ticket_items?.length ?? 0) > 0;

  const closeTicket = () => run(null, async () => {
    const { error: e } = await supabase.from('tickets')
      .update({ status: 'fechada', closed_at: new Date().toISOString() }).eq('id', id);
    if (e) throw new Error(dbError(e));
    refresh(); onClose();
  });

  const removeItem = (itemId: string) => run(null, async () => {
    const { error: e } = await supabase.from('ticket_items').delete().eq('id', itemId);
    if (e) throw new Error(dbError(e));
    refresh();
  });

  return (
    <Modal wide title={data ? `Comanda #${data.code}` : 'Comanda'} onClose={onClose} footer={
      <>
        <button className="btn ghost" onClick={onClose}>Fechar</button>
        {data?.status === 'aberta' && (
          <>
            <button className="btn" onClick={() => setAddItem(true)} disabled={busy}>Adicionar serviço</button>
            <button className="btn gold" onClick={() => setAddPay(true)} disabled={busy || saldo <= 0.009}>
              Registrar pagamento
            </button>
            <button className="btn pri" onClick={closeTicket} disabled={busy || !canClose}>Finalizar comanda</button>
          </>
        )}
      </>
    }>
      {t.loading && <SkeletonTabela />}
      {t.error && <ErrorBox msg={t.error} />}
      {error && <div className="mb16"><ErrorBox msg={error} /></div>}

      {data && (
        <>
          <div className="grid g4 mb16" style={{ gap: 10 }}>
            <div className="field"><label>Cliente</label><span>{data.clients?.name ?? '—'}</span></div>
            <div className="field"><label>Profissional</label><span>{data.barbers?.display_name ?? '—'}</span></div>
            <div className="field"><label>Aberta em</label><span>{dateTimeBR(data.opened_at)}</span></div>
            <div className="field"><label>Status</label><span><Badge value={data.status} text={label(data.status)} /></span></div>
          </div>

          <h3 className="mb16">Itens</h3>
          {!(data.ticket_items ?? []).length ? <Empty msg="Nenhum item lançado." /> : (
            <div className="tw mb16">
              <table>
                <thead><tr><th>Descrição</th><th className="num">Qtd</th><th className="num">Unit.</th><th className="num">Total</th><th /></tr></thead>
                <tbody>
                  {(data.ticket_items ?? []).map((i) => (
                    <tr key={i.id}>
                      <td>
                        {i.description}
                        {i.covered_by_package && <> <Badge text="Pacote" tone="gold" /></>}
                        {i.appointment_id && <> <Badge text="Da agenda" tone="info" /></>}
                      </td>
                      <td className="num">{i.qty}</td>
                      <td className="num">{money(i.unit_price)}</td>
                      <td className="num">{money(i.total)}</td>
                      <td className="num">
                        {data.status === 'aberta' && (
                          <button className="x" title="Remover item" disabled={busy}
                                  onClick={() => removeItem(i.id)}><IcTrash /></button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="grid g4 mb16" style={{ gap: 10 }}>
            <div className="field"><label>Subtotal</label><b className="tnum">{money(data.subtotal)}</b></div>
            <div className="field"><label>Desconto</label><b className="tnum">{money(data.discount)}</b></div>
            <div className="field"><label>Total</label><b className="tnum">{money(data.total)}</b></div>
            <div className="field"><label>Saldo</label>
              <b className="tnum" style={{ color: saldo > 0.009 ? '#e0c07a' : '#8fd0a5' }}>{money(saldo)}</b>
            </div>
          </div>

          <h3 className="mb16">Pagamentos</h3>
          {!(data.payments ?? []).length ? <Empty msg="Nenhum pagamento registrado." /> : (
            <div className="tw">
              <table>
                <thead><tr><th>Hora</th><th>Forma</th><th className="num">Valor</th></tr></thead>
                <tbody>
                  {(data.payments ?? []).map((p) => (
                    <tr key={p.id}>
                      <td className="tnum">{timeBR(p.paid_at)}</td>
                      <td><Badge text={label(p.method)} tone="info" /></td>
                      <td className="num">{money(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data.status === 'aberta' && saldo <= 0.009 && (data.ticket_items?.length ?? 0) > 0 && (
            <div className="mt16"><Banner>
              Comanda quitada. Ao finalizar, as comissões dos profissionais são geradas automaticamente.
            </Banner></div>
          )}
        </>
      )}

      {addItem && data && (
        <AddItem ticket={data} onClose={() => setAddItem(false)}
                 onDone={() => { setAddItem(false); refresh(); }} />
      )}
      {addPay && data && (
        <AddPayment ticketId={data.id} saldo={saldo} clientId={data.client_id}
                    onClose={() => setAddPay(false)}
                    onDone={() => { setAddPay(false); refresh(); }} />
      )}
    </Modal>
  );
}

/* ----------------------------------------------------------- novo item -- */
function AddItem({ ticket, onClose, onDone }: { ticket: TicketFull; onClose: () => void; onDone: () => void }) {
  const [serviceId, setServiceId] = useState('');
  const [barberId, setBarberId] = useState(ticket.barber_id ?? '');
  const [price, setPrice] = useState('');
  const [usePackage, setUsePackage] = useState('');
  const { busy, error, run } = useSubmit();

  const services = useAsync(
    () => must(supabase.from('services').select('id,name,duration_min,price,category,active,order_index').eq('active', true).order('order_index')) as Promise<Service[]>, []
  );
  const barbers = useAsync(
    () => must(supabase.from('barbers').select('id,profile_id,display_name,specialty,bio,photo_url,active,order_index').eq('active', true).order('order_index')) as Promise<Barber[]>, []
  );
  const pkgs = useAsync(async () => {
    if (!ticket.client_id) return [] as ClientPackageFull[];
    return must(supabase.from('client_packages')
      .select('*, clients(id,name), packages(id,name)')
      .eq('client_id', ticket.client_id).eq('status', 'ativo')) as Promise<ClientPackageFull[]>;
  }, [ticket.client_id ?? '']);

  const svc = services.data?.find((s) => s.id === serviceId);

  const save = () => run(null, async () => {
    if (!serviceId) throw new Error('Escolha o serviço.');
    const unit = price !== '' ? Number(price.replace(',', '.')) : Number(svc?.price ?? 0);
    const { data, error: e } = await supabase.from('ticket_items').insert({
      ticket_id: ticket.id, service_id: serviceId, barber_id: barberId || null,
      description: svc?.name ?? 'Serviço', qty: 1, unit_price: unit, total: unit,
    }).select('id').single();
    if (e) throw new Error(dbError(e));

    if (usePackage) {
      const { error: pe } = await supabase.rpc('consume_package', {
        p_client_package: usePackage, p_ticket_item: data.id,
        p_barber: barberId || null, p_service: serviceId,
      });
      if (pe) throw new Error(dbError(pe));
    }
    onDone();
  });

  return (
    <Modal title="Adicionar serviço" onClose={onClose} footer={
      <>
        <button className="btn ghost" onClick={onClose}>Cancelar</button>
        <button className="btn pri" onClick={save} disabled={busy}>{busy ? 'Lançando…' : 'Lançar'}</button>
      </>
    }>
      {error && <div className="mb16"><ErrorBox msg={error} /></div>}
      <div className="form-grid">
        <Field label="Serviço" full>
          <select className="inp" value={serviceId} onChange={(e) => { setServiceId(e.target.value); setPrice(''); }}>
            <option value="">Selecione</option>
            {(services.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>{s.name} — {money(s.price)}</option>
            ))}
          </select>
        </Field>
        <Field label="Profissional">
          <select className="inp" value={barberId} onChange={(e) => setBarberId(e.target.value)}>
            <option value="">Sem profissional</option>
            {(barbers.data ?? []).map((b) => <option key={b.id} value={b.id}>{b.display_name}</option>)}
          </select>
        </Field>
        <Field label="Valor" hint={svc ? `Tabela: ${money(svc.price)}` : undefined}>
          <input className="inp" inputMode="decimal" value={price}
                 placeholder={svc ? String(svc.price) : '0,00'}
                 onChange={(e) => setPrice(e.target.value)} />
        </Field>
        {!!(pkgs.data ?? []).length && (
          <Field label="Usar pacote do cliente" full
                 hint="Ao usar o pacote, o item entra sem cobrança e um uso é debitado.">
            <select className="inp" value={usePackage} onChange={(e) => setUsePackage(e.target.value)}>
              <option value="">Não usar pacote</option>
              {(pkgs.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.packages?.name} — restam {p.uses_left} de {p.uses_total}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------ pagamento -- */
function AddPayment({ ticketId, saldo, clientId, onClose, onDone }: {
  ticketId: string; saldo: number; clientId: string | null;
  onClose: () => void; onDone: () => void;
}) {
  const [method, setMethod] = useState<PaymentMethod>('pix');
  const [amount, setAmount] = useState(saldo.toFixed(2));
  const { busy, error, run } = useSubmit();

  const save = () => run(null, async () => {
    const v = Number(amount.replace(',', '.'));
    if (!v || v <= 0) throw new Error('Informe um valor maior que zero.');

    if (method === 'fiado') {
      if (!clientId) throw new Error('Fiado exige um cliente identificado na comanda.');
      const { error: de } = await supabase.from('debts')
        .insert({ client_id: clientId, ticket_id: ticketId, original_amount: v,
                  notes: 'Gerado no fechamento da comanda' });
      if (de) throw new Error(dbError(de));
    }

    const { error: e } = await supabase.from('payments')
      .insert({ ticket_id: ticketId, method, amount: v });
    if (e) throw new Error(dbError(e));
    onDone();
  });

  return (
    <Modal title="Registrar pagamento" onClose={onClose} footer={
      <>
        <button className="btn ghost" onClick={onClose}>Cancelar</button>
        <button className="btn pri" onClick={save} disabled={busy}>{busy ? 'Registrando…' : 'Registrar'}</button>
      </>
    }>
      {error && <div className="mb16"><ErrorBox msg={error} /></div>}
      <div className="form-grid">
        <Field label="Forma de pagamento">
          <select className="inp" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {METHODS.map((m) => <option key={m} value={m}>{label(m)}</option>)}
          </select>
        </Field>
        <Field label="Valor" hint={`Saldo em aberto: ${money(saldo)}`}>
          <input className="inp" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
      </div>
      {method === 'fiado' && (
        <div className="mt16"><Banner tone="warn">
          O valor será registrado como <b>fiado do cliente</b> e aparece em Fiados para cobrança posterior.
        </Banner></div>
      )}
    </Modal>
  );
}

/* --------------------------------------------------------- nova comanda -- */
function NewTicket({ cash, onClose, onDone }: {
  cash: CashSession; onClose: () => void; onDone: (id: string) => void;
}) {
  const [clientId, setClientId] = useState('');
  const [barberId, setBarberId] = useState('');
  const { busy, error, run } = useSubmit();

  const clients = useAsync(
    () => must(supabase.from('clients').select('id,name').order('name').limit(500)) as Promise<Client[]>, []
  );
  const barbers = useAsync(
    () => must(supabase.from('barbers').select('id,profile_id,display_name,specialty,bio,photo_url,active,order_index').eq('active', true).order('order_index')) as Promise<Barber[]>, []
  );

  const save = () => run(null, async () => {
    const { data: u } = await supabase.auth.getUser();
    const { data, error: e } = await supabase.from('tickets').insert({
      client_id: clientId || null, barber_id: barberId || null,
      cash_session_id: cash.id, created_by: u.user?.id,
    }).select('id').single();
    if (e) throw new Error(dbError(e));
    onDone(data.id);
  });

  return (
    <Modal title="Nova comanda" onClose={onClose} footer={
      <>
        <button className="btn ghost" onClick={onClose}>Cancelar</button>
        <button className="btn pri" onClick={save} disabled={busy}>{busy ? 'Abrindo…' : 'Abrir comanda'}</button>
      </>
    }>
      {error && <div className="mb16"><ErrorBox msg={error} /></div>}
      <div className="form-grid">
        <Field label="Cliente" hint="Opcional para venda avulsa.">
          <select className="inp" value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">Sem cliente</option>
            {(clients.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Profissional">
          <select className="inp" value={barberId} onChange={(e) => setBarberId(e.target.value)}>
            <option value="">Definir por item</option>
            {(barbers.data ?? []).map((b) => <option key={b.id} value={b.id}>{b.display_name}</option>)}
          </select>
        </Field>
      </div>
    </Modal>
  );
}
