import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { must, dbError } from '../lib/db';
import { money, dateBR, phoneBR, num } from '../lib/format';
import {
  Modal, Field, Badge, Loading, ErrorBox, Empty, useAsync, useSubmit, Kpi, SkeletonTabela,
  useListaProgressiva, FimDaLista,
} from '../ui/kit';
import { IcPlus, IcSearch } from '../ui/icons';
import type { ClientStats, Client, AppointmentFull } from '../lib/types';

const DAY = 86400000;

export default function Clientes() {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'todos' | 'frequentes' | 'inativos' | 'aniversario'>('todos');
  const [editing, setEditing] = useState<Client | null>(null);
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const abrirDetalhe = useCallback((id: string) => setDetail(id), []);


  const list = useAsync(
    () => must(supabase.from('v_client_stats').select('client_id,name,phone,birthdate,visits,total_spent,last_visit,first_visit,avg_days_between').order('name')) as Promise<ClientStats[]>, []
  );

  const now = Date.now();

  /* Debounce de 180 ms na busca.
     Tentei antes com useDeferredValue e MEDI uma piora: 1724 -> 2426 ms para
     digitar 9 letras com 2000 clientes. O valor diferido faz o React
     renderizar duas vezes por tecla (uma com o valor velho, uma com o novo),
     e quando o conteudo velho e uma tabela de 2000 linhas isso dobra a
     reconciliacao. Com debounce a lista e refiltrada uma vez, quando o
     usuario para de digitar. */
  const [qBusca, setQBusca] = useState('');
  useEffect(() => {
    const t = window.setTimeout(() => setQBusca(q), 180);
    return () => window.clearTimeout(t);
  }, [q]);

  /* Antes isto rodava no corpo do componente a cada tecla: tres varreduras
     completas da lista, com `new Date` e `toLowerCase` por cliente em cada
     uma. Agora e uma passagem so, memoizada, e o que nao depende da busca
     nao e recalculado quando a busca muda. */
  const preparados = useMemo(() => {
    const mesAtual = new Date().getMonth();
    return (list.data ?? []).map((c) => ({
      c,
      busca: `${c.name} ${c.phone ?? ''}`.toLowerCase(),
      days: c.last_visit ? (now - new Date(c.last_visit).getTime()) / DAY : Infinity,
      ehAniversariante: c.birthdate ? new Date(c.birthdate).getMonth() === mesAtual : false,
    }));
    // `now` muda a cada render; so a lista importa para este recorte
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.data]);

  const { freq, inat } = useMemo(() => ({
    freq: preparados.filter((p) => p.c.visits >= 3 && p.c.last_visit && p.days <= 60).length,
    inat: preparados.filter((p) => p.c.visits > 0 && p.c.last_visit && p.days > 60).length,
  }), [preparados]);

  const rows = useMemo(() => {
    const termo = qBusca.trim().toLowerCase();
    return preparados.filter((p) => {
      if (termo && !p.busca.includes(termo)) return false;
      if (filter === 'frequentes') return p.c.visits >= 3 && p.days <= 60;
      if (filter === 'inativos') return p.c.visits > 0 && p.days > 60;
      if (filter === 'aniversario') return p.ehAniversariante;
      return true;
    }).map((p) => p.c);
  }, [preparados, qBusca, filter]);

  /* Só um pedaço da lista vai para o DOM de cada vez; o resto entra ao rolar.
     Busca e filtros continuam percorrendo a lista inteira. */
  const pagina = useListaProgressiva(rows);

  return (
    <>
      <div className="grid g4 mb16">
        <Kpi label="Clientes cadastrados" value={num((list.data ?? []).length)} />
        <Kpi label="Frequentes" value={num(freq)} tone="ok" hint="3+ visitas nos últimos 60 dias" />
        <Kpi label="Inativos" value={num(inat)} tone="bad" hint="sem visita há mais de 60 dias" />
        <Kpi label="Total faturado" value={money((list.data ?? []).reduce((a, c) => a + Number(c.total_spent), 0))} />
      </div>

      <div className="row-b wrap mb16">
        <div className="row gap8 grow" style={{ maxWidth: 460 }}>
          <div className="row grow" style={{ position: 'relative' }}>
            <IcSearch className="" />
            <input className="inp" placeholder="Buscar por nome ou telefone…"
                   value={q} onChange={(e) => setQ(e.target.value)} style={{ marginLeft: 8 }} />
          </div>
        </div>
        <div className="row gap8 wrap">
          <div className="seg">
            {(['todos', 'frequentes', 'inativos', 'aniversario'] as const).map((f) => (
              <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
                {f === 'aniversario' ? 'Aniversariantes' : f}
              </button>
            ))}
          </div>
          <button className="btn pri sm" onClick={() => setCreating(true)}><IcPlus />Novo cliente</button>
        </div>
      </div>

      {list.loading && <SkeletonTabela />}
      {list.error && <ErrorBox msg={list.error} />}
      {!list.loading && !rows.length && <Empty msg="Nenhum cliente encontrado." />}

      {!!rows.length && (
        <>
          <TabelaClientes rows={pagina.visiveis} onAbrir={abrirDetalhe} />
          <FimDaLista estado={pagina} />
        </>
      )}

      {(creating || editing) && (
        <ClientForm client={editing} onClose={() => { setCreating(false); setEditing(null); }}
                    onDone={() => { setCreating(false); setEditing(null); list.reload(); }} />
      )}
      {detail && (
        <ClientDetail id={detail} onClose={() => setDetail(null)}
                      onEdit={(c) => { setDetail(null); setEditing(c); }} />
      )}
    </>
  );
}

/* A tabela so re-renderiza quando as linhas mudam de verdade. Sem isto,
   cada tecla digitada na busca re-renderizava as 2000 linhas, mesmo com a
   lista filtrada sendo exatamente a mesma. */
const TabelaClientes = memo(function TabelaClientes({ rows, onAbrir }: {
  rows: ClientStats[]; onAbrir: (id: string) => void;
}) {
  const now = Date.now();
  return (
    <div className="tw">
      <table>
        <thead>
          <tr>
            <th>Nome</th><th>Telefone</th><th className="num">Visitas</th>
            <th className="num">Total gasto</th><th>Última visita</th>
            <th className="num">Frequência</th><th>Situação</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => {
            const days = c.last_visit ? (now - new Date(c.last_visit).getTime()) / DAY : null;
            const tone = days === null ? '' : days > 60 ? 'bad' : c.visits >= 3 ? 'ok' : 'info';
            const text = days === null ? 'Sem visita' : days > 60 ? 'Inativo' : c.visits >= 3 ? 'Frequente' : 'Ativo';
            return (
              <tr key={c.client_id} onClick={() => onAbrir(c.client_id)} style={{ cursor: 'pointer' }}>
                <td>{c.name}</td>
                <td>{phoneBR(c.phone)}</td>
                <td className="num">{c.visits}</td>
                <td className="num">{money(c.total_spent)}</td>
                <td>{c.last_visit ? dateBR(c.last_visit) : '—'}</td>
                <td className="num">{c.avg_days_between ? `${c.avg_days_between} dias` : '—'}</td>
                <td><Badge text={text} tone={tone} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
});

function ClientForm({ client, onClose, onDone }: {
  client: Client | null; onClose: () => void; onDone: () => void;
}) {
  const [name, setName] = useState(client?.name ?? '');
  const [phone, setPhone] = useState(client?.phone ?? '');
  const [birthdate, setBirthdate] = useState(client?.birthdate ?? '');
  const [preferences, setPreferences] = useState(client?.preferences ?? '');
  const [notes, setNotes] = useState(client?.notes ?? '');
  const { busy, error, run } = useSubmit();

  const save = () => run(null, async () => {
    if (name.trim().length < 2) throw new Error('Informe o nome do cliente.');
    const payload = {
      name: name.trim(), phone: phone.trim() || null,
      birthdate: birthdate || null,
      preferences: preferences.trim() || null, notes: notes.trim() || null,
    };
    const { error: e } = client
      ? await supabase.from('clients').update(payload).eq('id', client.id)
      : await supabase.from('clients').insert(payload);
    if (e) throw new Error(dbError(e));
    onDone();
  });

  return (
    <Modal title={client ? 'Editar cliente' : 'Novo cliente'} onClose={onClose} footer={
      <>
        <button className="btn ghost" onClick={onClose}>Cancelar</button>
        <button className="btn pri" onClick={save} disabled={busy}>{busy ? 'Salvando…' : 'Salvar'}</button>
      </>
    }>
      {error && <div className="mb16"><ErrorBox msg={error} /></div>}
      <div className="form-grid">
        <Field label="Nome" full><input className="inp" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Telefone"><input className="inp" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(51) 90000-0000" /></Field>
        <Field label="Aniversário"><input className="inp" type="date" value={birthdate} onChange={(e) => setBirthdate(e.target.value)} /></Field>
        <Field label="Preferências" full hint="Corte preferido, máquina, produtos…">
          <input className="inp" value={preferences} onChange={(e) => setPreferences(e.target.value)} />
        </Field>
        <Field label="Observações" full>
          <textarea className="inp" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

function ClientDetail({ id, onClose, onEdit }: {
  id: string; onClose: () => void; onEdit: (c: Client) => void;
}) {
  const client = useAsync(
    () => must(supabase.from('clients').select('id,name,phone,birthdate,notes,preferences,created_at').eq('id', id).single()) as Promise<Client>, [id]
  );
  const stats = useAsync(
    () => must(supabase.from('v_client_stats').select('client_id,name,phone,birthdate,visits,total_spent,last_visit,first_visit,avg_days_between').eq('client_id', id).maybeSingle()) as Promise<ClientStats | null>, [id]
  );
  const history = useAsync(
    () => must(supabase.from('appointments')
      .select('*, barbers(id,display_name), services(id,name,duration_min,price), clients(id,name,phone)')
      .eq('client_id', id).order('starts_at', { ascending: false }).limit(50)) as Promise<AppointmentFull[]>, [id]
  );

  return (
    <Modal wide title={client.data?.name ?? 'Cliente'} onClose={onClose} footer={
      <>
        <button className="btn ghost" onClick={onClose}>Fechar</button>
        {client.data && <button className="btn pri" onClick={() => onEdit(client.data!)}>Editar</button>}
      </>
    }>
      {(client.loading || stats.loading) && <Loading />}
      {client.data && (
        <>
          <div className="grid g4 mb16" style={{ gap: 10 }}>
            <Kpi label="Visitas" value={num(stats.data?.visits ?? 0)} />
            <Kpi label="Total gasto" value={money(stats.data?.total_spent ?? 0)} tone="gold" />
            <Kpi label="Última visita" value={stats.data?.last_visit ? dateBR(stats.data.last_visit) : '—'} />
            <Kpi label="Frequência média"
                 value={stats.data?.avg_days_between ? `${stats.data.avg_days_between} d` : '—'} />
          </div>
          <div className="grid g2 mb16" style={{ gap: 10 }}>
            <div className="field"><label>Telefone</label><span>{phoneBR(client.data.phone)}</span></div>
            <div className="field"><label>Aniversário</label><span>{client.data.birthdate ? dateBR(client.data.birthdate) : '—'}</span></div>
            <div className="field"><label>Preferências</label><span>{client.data.preferences || '—'}</span></div>
            <div className="field"><label>Observações</label><span>{client.data.notes || '—'}</span></div>
          </div>

          <h3 className="mb16">Histórico de atendimentos</h3>
          {history.loading && <SkeletonTabela />}
          {!history.loading && !(history.data ?? []).length && <Empty msg="Sem atendimentos registrados." />}
          {!!(history.data ?? []).length && (
            <div className="tw">
              <table>
                <thead><tr><th>Data</th><th>Serviço</th><th>Profissional</th><th>Status</th><th className="num">Valor</th></tr></thead>
                <tbody>
                  {(history.data ?? []).map((a) => (
                    <tr key={a.id}>
                      <td>{dateBR(a.starts_at)}</td>
                      <td>{a.services?.name ?? '—'}</td>
                      <td>{a.barbers?.display_name ?? '—'}</td>
                      <td><Badge value={a.status} /></td>
                      <td className="num">{money(a.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
