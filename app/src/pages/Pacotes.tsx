import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { must, dbError } from '../lib/db';
import { money, dateBR, label } from '../lib/format';
import { Modal, Field, Badge, ErrorBox, Empty, useAsync, useSubmit, Banner, Kpi, SkeletonTabela } from '../ui/kit';
import { IcPlus } from '../ui/icons';
import type { Package, ClientPackageFull, Client, Service } from '../lib/types';

export default function Pacotes() {
  const [tab, setTab] = useState<'vendidos' | 'catalogo'>('vendidos');
  return (
    <>
      <div className="tabs">
        <button className={'tab' + (tab === 'vendidos' ? ' on' : '')} onClick={() => setTab('vendidos')}>Pacotes dos clientes</button>
        <button className={'tab' + (tab === 'catalogo' ? ' on' : '')} onClick={() => setTab('catalogo')}>Catálogo</button>
      </div>
      {tab === 'vendidos' ? <Vendidos /> : <Catalogo />}
    </>
  );
}

function Vendidos() {
  const [selling, setSelling] = useState(false);
  const [onlyActive, setOnlyActive] = useState(true);

  const list = useAsync(async () => {
    const q = supabase.from('client_packages')
      .select('*, clients(id,name), packages(id,name)')
      .order('purchased_at', { ascending: false }).limit(300);
    return must(onlyActive ? q.eq('status', 'ativo') : q) as Promise<ClientPackageFull[]>;
  }, [onlyActive]);

  const rows = list.data ?? [];

  return (
    <>
      <div className="grid g4 mb16">
        <Kpi label="Pacotes ativos" value={String(rows.filter((r) => r.status === 'ativo').length)} />
        <Kpi label="Utilizações restantes" value={String(rows.reduce((a, r) => a + r.uses_left, 0))} tone="gold" />
        <Kpi label="Clientes com pacote" value={String(new Set(rows.map((r) => r.client_id)).size)} />
        <div className="kpi">
          <p>Ação</p>
          <button className="btn pri block" style={{ marginTop: 4 }} onClick={() => setSelling(true)}>
            <IcPlus />Vender pacote
          </button>
        </div>
      </div>

      <div className="seg mb16">
        <button className={onlyActive ? 'on' : ''} onClick={() => setOnlyActive(true)}>Ativos</button>
        <button className={!onlyActive ? 'on' : ''} onClick={() => setOnlyActive(false)}>Todos</button>
      </div>

      {list.loading && <SkeletonTabela />}
      {list.error && <ErrorBox msg={list.error} />}
      {!list.loading && !rows.length && <Empty msg="Nenhum pacote vendido." />}

      {!!rows.length && (
        <div className="tw">
          <table>
            <thead>
              <tr><th>Cliente</th><th>Pacote</th><th>Compra</th><th>Validade</th>
                  <th className="num">Usos</th><th>Situação</th></tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td>{p.clients?.name ?? '—'}</td>
                  <td>{p.packages?.name ?? '—'}</td>
                  <td>{dateBR(p.purchased_at)}</td>
                  <td>{p.expires_at ? dateBR(p.expires_at) : 'sem validade'}</td>
                  <td className="num">{p.uses_left} / {p.uses_total}</td>
                  <td><Badge value={p.status} text={label(p.status)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt24">
        <Banner>
          O consumo do pacote acontece ao lançar o serviço na comanda do cliente: escolha
          <b> Usar pacote</b> e o item entra sem cobrança, debitando uma utilização.
        </Banner>
      </div>

      {selling && <SellPackage onClose={() => setSelling(false)} onDone={() => { setSelling(false); list.reload(); }} />}
    </>
  );
}

function SellPackage({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [clientId, setClientId] = useState('');
  const [packageId, setPackageId] = useState('');
  const { busy, error, run } = useSubmit();

  const clients = useAsync(
    () => must(supabase.from('clients').select('id,name').order('name').limit(500)) as Promise<Client[]>, []
  );
  const packages = useAsync(
    () => must(supabase.from('packages').select('*').eq('active', true).order('name')) as Promise<Package[]>, []
  );
  const pkg = packages.data?.find((p) => p.id === packageId);

  const save = () => run(null, async () => {
    if (!clientId || !pkg) throw new Error('Escolha o cliente e o pacote.');
    const expires = pkg.validity_days
      ? new Date(Date.now() + pkg.validity_days * 86400000).toISOString() : null;
    const { error: e } = await supabase.from('client_packages').insert({
      client_id: clientId, package_id: pkg.id, uses_total: pkg.uses_total,
      uses_left: pkg.uses_total, expires_at: expires,
    });
    if (e) throw new Error(dbError(e));
    onDone();
  });

  return (
    <Modal title="Vender pacote" onClose={onClose} footer={
      <>
        <button className="btn ghost" onClick={onClose}>Cancelar</button>
        <button className="btn pri" onClick={save} disabled={busy}>{busy ? 'Salvando…' : 'Vender'}</button>
      </>
    }>
      {error && <div className="mb16"><ErrorBox msg={error} /></div>}
      <div className="form-grid">
        <Field label="Cliente" full>
          <select className="inp" value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">Selecione</option>
            {(clients.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Pacote" full>
          <select className="inp" value={packageId} onChange={(e) => setPackageId(e.target.value)}>
            <option value="">Selecione</option>
            {(packages.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>{p.name} — {money(p.price)} ({p.uses_total} usos)</option>
            ))}
          </select>
        </Field>
      </div>
      {pkg && (
        <p className="hint mt16">
          {pkg.uses_total} utilizações · {pkg.validity_days ? `validade de ${pkg.validity_days} dias` : 'sem prazo de validade'}
        </p>
      )}
    </Modal>
  );
}

function Catalogo() {
  const [editing, setEditing] = useState<Package | null>(null);
  const [creating, setCreating] = useState(false);
  const list = useAsync(
    () => must(supabase.from('packages').select('*').order('name')) as Promise<Package[]>, []
  );

  return (
    <>
      <div className="row-b wrap mb16">
        <p className="mut" style={{ fontSize: '.84rem' }}>Pacotes disponíveis para venda.</p>
        <button className="btn pri sm" onClick={() => setCreating(true)}><IcPlus />Novo pacote</button>
      </div>

      {list.loading && <SkeletonTabela />}
      {!list.loading && !(list.data ?? []).length && <Empty msg="Nenhum pacote cadastrado." />}

      {!!(list.data ?? []).length && (
        <div className="tw">
          <table>
            <thead><tr><th>Pacote</th><th className="num">Preço</th><th className="num">Usos</th>
                       <th>Validade</th><th>Situação</th><th /></tr></thead>
            <tbody>
              {(list.data ?? []).map((p) => (
                <tr key={p.id}>
                  <td>{p.name}<div className="hint">{p.description}</div></td>
                  <td className="num">{money(p.price)}</td>
                  <td className="num">{p.uses_total}</td>
                  <td>{p.validity_days ? `${p.validity_days} dias` : 'sem prazo'}</td>
                  <td><Badge text={p.active ? 'Ativo' : 'Inativo'} tone={p.active ? 'ok' : ''} /></td>
                  <td className="num"><button className="btn sm ghost" onClick={() => setEditing(p)}>Editar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(creating || editing) && (
        <PackageForm pkg={editing} onClose={() => { setCreating(false); setEditing(null); }}
                     onDone={() => { setCreating(false); setEditing(null); list.reload(); }} />
      )}
    </>
  );
}

function PackageForm({ pkg, onClose, onDone }: { pkg: Package | null; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState(pkg?.name ?? '');
  const [price, setPrice] = useState(String(pkg?.price ?? ''));
  const [uses, setUses] = useState(String(pkg?.uses_total ?? 4));
  const [validity, setValidity] = useState(pkg?.validity_days ? String(pkg.validity_days) : '');
  const [description, setDescription] = useState(pkg?.description ?? '');
  const [active, setActive] = useState(pkg?.active ?? true);
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const { busy, error, run } = useSubmit();

  const services = useAsync(
    () => must(supabase.from('services').select('*').eq('active', true).order('order_index')) as Promise<Service[]>, []
  );
  useAsync(async () => {
    if (!pkg) return [];
    const rows = await must(supabase.from('package_services').select('service_id').eq('package_id', pkg.id)) as { service_id: string }[];
    setServiceIds(rows.map((r) => r.service_id));
    return rows;
  }, [pkg?.id ?? '']);

  const save = () => run(null, async () => {
    const p = Number(price.replace(',', '.')), u = parseInt(uses, 10);
    if (name.trim().length < 2) throw new Error('Informe o nome do pacote.');
    if (!u || u <= 0) throw new Error('Informe a quantidade de utilizações.');
    const payload = {
      name: name.trim(), price: p || 0, uses_total: u,
      validity_days: validity ? parseInt(validity, 10) : null,
      description: description.trim() || null, active,
    };
    const id = pkg?.id;
    let pkgId = id;
    if (id) {
      const { error: e } = await supabase.from('packages').update(payload).eq('id', id);
      if (e) throw new Error(dbError(e));
    } else {
      const { data, error: e } = await supabase.from('packages').insert(payload).select('id').single();
      if (e) throw new Error(dbError(e));
      pkgId = data.id;
    }
    if (pkgId) {
      await supabase.from('package_services').delete().eq('package_id', pkgId);
      if (serviceIds.length) {
        const { error: se } = await supabase.from('package_services')
          .insert(serviceIds.map((s) => ({ package_id: pkgId, service_id: s })));
        if (se) throw new Error(dbError(se));
      }
    }
    onDone();
  });

  return (
    <Modal title={pkg ? 'Editar pacote' : 'Novo pacote'} onClose={onClose} footer={
      <>
        <button className="btn ghost" onClick={onClose}>Cancelar</button>
        <button className="btn pri" onClick={save} disabled={busy}>{busy ? 'Salvando…' : 'Salvar'}</button>
      </>
    }>
      {error && <div className="mb16"><ErrorBox msg={error} /></div>}
      <div className="form-grid">
        <Field label="Nome" full><input className="inp" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Preço (R$)"><input className="inp" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
        <Field label="Utilizações"><input className="inp" inputMode="numeric" value={uses} onChange={(e) => setUses(e.target.value)} /></Field>
        <Field label="Validade (dias)" hint="Deixe vazio para sem prazo.">
          <input className="inp" inputMode="numeric" value={validity} onChange={(e) => setValidity(e.target.value)} />
        </Field>
        <Field label="Situação">
          <select className="inp" value={active ? '1' : '0'} onChange={(e) => setActive(e.target.value === '1')}>
            <option value="1">Ativo</option><option value="0">Inativo</option>
          </select>
        </Field>
        <Field label="Descrição" full>
          <textarea className="inp" value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
      </div>

      <h3 className="mt24 mb16">Serviços cobertos</h3>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 6 }}>
        {(services.data ?? []).map((s) => (
          <label key={s.id} className="row gap8" style={{ cursor: 'pointer', fontSize: '.84rem' }}>
            <input type="checkbox" checked={serviceIds.includes(s.id)}
                   onChange={(e) => setServiceIds((v) => e.target.checked ? [...v, s.id] : v.filter((x) => x !== s.id))} />
            {s.name}
          </label>
        ))}
      </div>
    </Modal>
  );
}
