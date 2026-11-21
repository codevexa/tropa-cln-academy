import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { must, dbError } from '../lib/db';
import { money } from '../lib/format';
import { Modal, Field, Badge, Loading, ErrorBox, Empty, useAsync, useSubmit, Banner } from '../ui/kit';
import { FotoUpload } from '../ui/FotoUpload';
import { IcPlus, IcEdit } from '../ui/icons';
import type { Barber, Profile, CommissionRule, Service, CommissionBasis, AdminPermission } from '../lib/types';

interface Row extends Barber {
  profiles: Pick<Profile, 'id' | 'full_name' | 'email' | 'role' | 'active'> | null;
  barber_commission_rules: CommissionRule | null;
}

const PERMS: { key: AdminPermission; label: string; hint: string }[] = [
  { key: 'reports',     label: 'Relatórios',  hint: 'Dashboard e relatórios gerenciais' },
  { key: 'financial',   label: 'Financeiro',  hint: 'Despesas e dados financeiros' },
  { key: 'commissions', label: 'Comissões',   hint: 'Ver comissões de todos' },
  { key: 'stock',       label: 'Estoque',     hint: 'Produtos, compras e fornecedores' },
];

export default function Profissionais() {
  const [tab, setTab] = useState<'barbeiros' | 'acessos'>('barbeiros');
  return (
    <>
      <div className="tabs">
        <button className={'tab' + (tab === 'barbeiros' ? ' on' : '')} onClick={() => setTab('barbeiros')}>Barbeiros</button>
        <button className={'tab' + (tab === 'acessos' ? ' on' : '')} onClick={() => setTab('acessos')}>Acessos ao sistema</button>
      </div>
      {tab === 'barbeiros' ? <Barbeiros /> : <Acessos />}
    </>
  );
}

/* ------------------------------------------------------------ barbeiros -- */
function Barbeiros() {
  const [editing, setEditing] = useState<Row | null>(null);
  const [creating, setCreating] = useState(false);
  const [rules, setRules] = useState<Row | null>(null);

  const list = useAsync(
    () => must(supabase.from('barbers')
      .select('*, profiles(id,full_name,email,role,active), barber_commission_rules(*)')
      .order('order_index')) as Promise<Row[]>, []
  );

  return (
    <>
      <div className="row-b wrap mb16">
        <p className="mut" style={{ fontSize: '.84rem' }}>
          Cada barbeiro pode ter um login próprio, vinculado na aba Acessos.
        </p>
        <button className="btn pri sm" onClick={() => setCreating(true)}><IcPlus />Novo barbeiro</button>
      </div>

      {list.loading && <Loading />}
      {list.error && <ErrorBox msg={list.error} />}
      {!list.loading && !(list.data ?? []).length && <Empty msg="Nenhum barbeiro cadastrado." />}

      {!!(list.data ?? []).length && (
        <div className="tw">
          <table>
            <thead>
              <tr><th style={{ width: 54 }}>Foto</th><th>Nome</th><th>Especialidade</th>
                  <th>Login vinculado</th><th>Comissão</th><th>Situação</th><th /></tr>
            </thead>
            <tbody>
              {(list.data ?? []).map((b) => (
                <tr key={b.id}>
                  <td>
                    {b.photo_url
                      ? <img src={b.photo_url} alt="" width={38} height={38}
                             style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover',
                                      border: '1px solid var(--line-2)' }} />
                      : <span className="avatar">{b.display_name.slice(0, 2).toUpperCase()}</span>}
                  </td>
                  <td>{b.display_name}</td>
                  <td className="mut">{b.specialty || '—'}</td>
                  <td className="mut">{b.profiles?.email ?? <span className="mut2">sem login</span>}</td>
                  <td>
                    {b.barber_commission_rules
                      ? b.barber_commission_rules.basis === 'percent'
                        ? `${b.barber_commission_rules.value}%`
                        : money(b.barber_commission_rules.value)
                      : <span className="mut2">não definida</span>}
                  </td>
                  <td><Badge text={b.active ? 'Ativo' : 'Inativo'} tone={b.active ? 'ok' : ''} /></td>
                  <td className="num">
                    <div className="row gap4" style={{ justifyContent: 'flex-end' }}>
                      <button className="btn sm ghost" onClick={() => setRules(b)}>Comissão</button>
                      <button className="x" onClick={() => setEditing(b)} title="Editar"><IcEdit /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(creating || editing) && (
        <BarberForm barber={editing} count={(list.data ?? []).length}
                    onClose={() => { setCreating(false); setEditing(null); }}
                    onDone={() => { setCreating(false); setEditing(null); list.reload(); }} />
      )}
      {rules && <RulesModal barber={rules} onClose={() => setRules(null)}
                            onDone={() => { setRules(null); list.reload(); }} />}
    </>
  );
}

function BarberForm({ barber, count, onClose, onDone }: {
  barber: Row | null; count: number; onClose: () => void; onDone: () => void;
}) {
  const [name, setName] = useState(barber?.display_name ?? '');
  const [specialty, setSpecialty] = useState(barber?.specialty ?? '');
  const [bio, setBio] = useState(barber?.bio ?? '');
  const [photoUrl, setPhotoUrl] = useState<string | null>(barber?.photo_url ?? null);
  const [active, setActive] = useState(barber?.active ?? true);
  const { busy, error, run } = useSubmit();

  const save = () => run(null, async () => {
    if (name.trim().length < 2) throw new Error('Informe o nome do profissional.');
    const payload = {
      display_name: name.trim(), specialty: specialty.trim() || null,
      bio: bio.trim() || null, photo_url: photoUrl, active,
    };
    const { error: e } = barber
      ? await supabase.from('barbers').update(payload).eq('id', barber.id)
      : await supabase.from('barbers').insert({ ...payload, order_index: count + 1 });
    if (e) throw new Error(dbError(e));
    onDone();
  });

  return (
    <Modal title={barber ? 'Editar barbeiro' : 'Novo barbeiro'} onClose={onClose} footer={
      <>
        <button className="btn ghost" onClick={onClose}>Cancelar</button>
        <button className="btn pri" onClick={save} disabled={busy}>{busy ? 'Salvando…' : 'Salvar'}</button>
      </>
    }>
      {error && <div className="mb16"><ErrorBox msg={error} /></div>}
      <div className="mb16">
        <Banner>A foto aparece no site público, na seção <b>Nosso time</b>. Use retrato, de preferência vertical.</Banner>
      </div>
      <div className="form-grid">
        <div className="full">
          <FotoUpload label="Foto do profissional" url={photoUrl} pasta="barbeiros"
                      altura={210} onChange={setPhotoUrl} />
        </div>
        <Field label="Nome" full><input className="inp" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Especialidade" full>
          <input className="inp" value={specialty} onChange={(e) => setSpecialty(e.target.value)} />
        </Field>
        <Field label="Apresentação" full>
          <textarea className="inp" value={bio} onChange={(e) => setBio(e.target.value)} />
        </Field>
        <Field label="Situação" full>
          <select className="inp" value={active ? '1' : '0'} onChange={(e) => setActive(e.target.value === '1')}>
            <option value="1">Ativo</option><option value="0">Inativo</option>
          </select>
        </Field>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------ comissões -- */
function RulesModal({ barber, onClose, onDone }: { barber: Row; onClose: () => void; onDone: () => void }) {
  const rule = barber.barber_commission_rules;
  const [basis, setBasis] = useState<CommissionBasis>(rule?.basis ?? 'percent');
  const [value, setValue] = useState(String(rule?.value ?? ''));
  const [svcId, setSvcId] = useState('');
  const [svcBasis, setSvcBasis] = useState<CommissionBasis>('percent');
  const [svcValue, setSvcValue] = useState('');
  const { busy, error, run } = useSubmit();

  const services = useAsync(
    () => must(supabase.from('services').select('*').eq('active', true).order('order_index')) as Promise<Service[]>, []
  );
  const overrides = useAsync(
    () => must(supabase.from('barber_service_commissions')
      .select('*, services(name)').eq('barber_id', barber.id)) as Promise<
        { barber_id: string; service_id: string; basis: CommissionBasis; value: number; services: { name: string } | null }[]>,
    [barber.id]
  );

  const saveDefault = () => run(null, async () => {
    const v = Number(value.replace(',', '.'));
    if (Number.isNaN(v) || v < 0) throw new Error('Informe um valor válido.');
    const { error: e } = await supabase.from('barber_commission_rules')
      .upsert({ barber_id: barber.id, basis, value: v });
    if (e) throw new Error(dbError(e));
    onDone();
  });

  const addOverride = () => run(null, async () => {
    if (!svcId) throw new Error('Escolha o serviço.');
    const v = Number(svcValue.replace(',', '.'));
    if (Number.isNaN(v) || v < 0) throw new Error('Informe um valor válido.');
    const { error: e } = await supabase.from('barber_service_commissions')
      .upsert({ barber_id: barber.id, service_id: svcId, basis: svcBasis, value: v });
    if (e) throw new Error(dbError(e));
    setSvcId(''); setSvcValue(''); overrides.reload();
  });

  const delOverride = (serviceId: string) => run(null, async () => {
    const { error: e } = await supabase.from('barber_service_commissions')
      .delete().eq('barber_id', barber.id).eq('service_id', serviceId);
    if (e) throw new Error(dbError(e));
    overrides.reload();
  });

  return (
    <Modal wide title={`Comissão — ${barber.display_name}`} onClose={onClose} footer={
      <>
        <button className="btn ghost" onClick={onClose}>Fechar</button>
        <button className="btn pri" onClick={saveDefault} disabled={busy}>Salvar regra padrão</button>
      </>
    }>
      {error && <div className="mb16"><ErrorBox msg={error} /></div>}
      <Banner>
        A comissão é calculada automaticamente quando a comanda é <b>quitada</b>. O barbeiro
        enxerga a própria regra, mas não pode alterá-la.
      </Banner>

      <h3 className="mt24 mb16">Regra padrão</h3>
      <div className="form-grid">
        <Field label="Tipo">
          <select className="inp" value={basis} onChange={(e) => setBasis(e.target.value as CommissionBasis)}>
            <option value="percent">Percentual sobre o serviço</option>
            <option value="fixed">Valor fixo por serviço</option>
          </select>
        </Field>
        <Field label={basis === 'percent' ? 'Percentual (%)' : 'Valor (R$)'}>
          <input className="inp" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} />
        </Field>
      </div>

      <h3 className="mt24 mb16">Comissão diferente por serviço</h3>
      <div className="form-grid mb16">
        <Field label="Serviço">
          <select className="inp" value={svcId} onChange={(e) => setSvcId(e.target.value)}>
            <option value="">Selecione</option>
            {(services.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Tipo">
          <select className="inp" value={svcBasis} onChange={(e) => setSvcBasis(e.target.value as CommissionBasis)}>
            <option value="percent">Percentual</option><option value="fixed">Valor fixo</option>
          </select>
        </Field>
        <Field label={svcBasis === 'percent' ? 'Percentual (%)' : 'Valor (R$)'}>
          <input className="inp" inputMode="decimal" value={svcValue} onChange={(e) => setSvcValue(e.target.value)} />
        </Field>
        <div className="field" style={{ justifyContent: 'flex-end' }}>
          <button className="btn" onClick={addOverride} disabled={busy}>Adicionar</button>
        </div>
      </div>

      {!(overrides.data ?? []).length ? (
        <p className="hint">Nenhuma exceção: todos os serviços usam a regra padrão.</p>
      ) : (
        <div className="tw">
          <table>
            <thead><tr><th>Serviço</th><th>Tipo</th><th className="num">Valor</th><th /></tr></thead>
            <tbody>
              {(overrides.data ?? []).map((o) => (
                <tr key={o.service_id}>
                  <td>{o.services?.name ?? '—'}</td>
                  <td className="mut">{o.basis === 'percent' ? 'Percentual' : 'Fixo'}</td>
                  <td className="num">{o.basis === 'percent' ? `${o.value}%` : money(o.value)}</td>
                  <td className="num">
                    <button className="btn sm ghost" onClick={() => delOverride(o.service_id)}>Remover</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

/* -------------------------------------------------------------- acessos -- */
function Acessos() {
  const list = useAsync(
    () => must(supabase.from('profiles').select('*').order('full_name')) as Promise<Profile[]>, []
  );
  const barbers = useAsync(
    () => must(supabase.from('barbers').select('*').order('order_index')) as Promise<Barber[]>, []
  );
  const [editing, setEditing] = useState<Profile | null>(null);

  return (
    <>
      <div className="mb16">
        <Banner>
          O cadastro de login é feito no painel do Supabase (Authentication → Users). Depois que o
          e-mail existir, o perfil aparece aqui para você definir o papel, as permissões e o vínculo
          com o barbeiro. Nenhuma senha passa por esta tela.
        </Banner>
      </div>

      {list.loading && <Loading />}
      {list.error && <ErrorBox msg={list.error} />}
      {!list.loading && !(list.data ?? []).length && <Empty msg="Nenhum perfil encontrado." />}

      {!!(list.data ?? []).length && (
        <div className="tw">
          <table>
            <thead><tr><th>Nome</th><th>E-mail</th><th>Papel</th><th>Barbeiro vinculado</th><th>Situação</th><th /></tr></thead>
            <tbody>
              {(list.data ?? []).map((p) => {
                const b = (barbers.data ?? []).find((x) => x.profile_id === p.id);
                return (
                  <tr key={p.id}>
                    <td>{p.full_name}</td>
                    <td className="mut">{p.email ?? '—'}</td>
                    <td><Badge text={p.role === 'owner' ? 'Proprietário' : p.role === 'admin' ? 'Administrador' : 'Barbeiro'}
                               tone={p.role === 'owner' ? 'gold' : p.role === 'admin' ? 'info' : ''} /></td>
                    <td className="mut">{b?.display_name ?? '—'}</td>
                    <td><Badge text={p.active ? 'Ativo' : 'Inativo'} tone={p.active ? 'ok' : ''} /></td>
                    <td className="num">
                      <button className="x" onClick={() => setEditing(p)} title="Editar"><IcEdit /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <AccessForm profile={editing} barbers={barbers.data ?? []}
                    onClose={() => setEditing(null)}
                    onDone={() => { setEditing(null); list.reload(); barbers.reload(); }} />
      )}
    </>
  );
}

function AccessForm({ profile, barbers, onClose, onDone }: {
  profile: Profile; barbers: Barber[]; onClose: () => void; onDone: () => void;
}) {
  const [role, setRole] = useState(profile.role);
  const [active, setActive] = useState(profile.active);
  const [fullName, setFullName] = useState(profile.full_name);
  const [perms, setPerms] = useState<Record<string, boolean>>(
    Object.fromEntries(PERMS.map((p) => [p.key, Boolean(profile.permissions?.[p.key])]))
  );
  const linked = barbers.find((b) => b.profile_id === profile.id);
  const [barberId, setBarberId] = useState(linked?.id ?? '');
  const { busy, error, run } = useSubmit();

  const save = () => run(null, async () => {
    const { error: e } = await supabase.from('profiles')
      .update({ role, active, full_name: fullName.trim(), permissions: role === 'admin' ? perms : {} })
      .eq('id', profile.id);
    if (e) throw new Error(dbError(e));

    if (role === 'barber') {
      if (linked && linked.id !== barberId) {
        await supabase.from('barbers').update({ profile_id: null }).eq('id', linked.id);
      }
      if (barberId) {
        const { error: be } = await supabase.from('barbers')
          .update({ profile_id: profile.id }).eq('id', barberId);
        if (be) throw new Error(dbError(be));
      }
    } else if (linked) {
      await supabase.from('barbers').update({ profile_id: null }).eq('id', linked.id);
    }
    onDone();
  });

  return (
    <Modal title={`Acesso — ${profile.full_name}`} onClose={onClose} footer={
      <>
        <button className="btn ghost" onClick={onClose}>Cancelar</button>
        <button className="btn pri" onClick={save} disabled={busy}>{busy ? 'Salvando…' : 'Salvar'}</button>
      </>
    }>
      {error && <div className="mb16"><ErrorBox msg={error} /></div>}
      <div className="form-grid">
        <Field label="Nome" full>
          <input className="inp" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </Field>
        <Field label="Papel">
          <select className="inp" value={role} onChange={(e) => setRole(e.target.value as Profile['role'])}>
            <option value="owner">Proprietário</option>
            <option value="admin">Administrador</option>
            <option value="barber">Barbeiro</option>
          </select>
        </Field>
        <Field label="Situação">
          <select className="inp" value={active ? '1' : '0'} onChange={(e) => setActive(e.target.value === '1')}>
            <option value="1">Ativo</option><option value="0">Inativo</option>
          </select>
        </Field>
        {role === 'barber' && (
          <Field label="Barbeiro vinculado" full hint="Define de quem é a agenda e as comissões deste login.">
            <select className="inp" value={barberId} onChange={(e) => setBarberId(e.target.value)}>
              <option value="">Nenhum</option>
              {barbers.map((b) => <option key={b.id} value={b.id}>{b.display_name}</option>)}
            </select>
          </Field>
        )}
      </div>

      {role === 'admin' && (
        <>
          <h3 className="mt24 mb16">Permissões do administrador</h3>
          {PERMS.map((p) => (
            <label className="list-row" key={p.key} style={{ cursor: 'pointer' }}>
              <input type="checkbox" checked={perms[p.key] ?? false}
                     onChange={(e) => setPerms((v) => ({ ...v, [p.key]: e.target.checked }))} />
              <div className="grow">
                <b style={{ fontSize: '.85rem', fontWeight: 500 }}>{p.label}</b>
                <div className="hint">{p.hint}</div>
              </div>
            </label>
          ))}
        </>
      )}
      {role === 'owner' && (
        <div className="mt16"><Banner>O proprietário tem acesso irrestrito a todos os módulos.</Banner></div>
      )}
      {role === 'barber' && (
        <div className="mt16"><Banner>
          O barbeiro enxerga apenas a própria agenda, os próprios clientes e as próprias comissões.
          Caixa, fiados, estoque e dados dos colegas ficam bloqueados pelo banco de dados, não só pela tela.
        </Banner></div>
      )}
    </Modal>
  );
}
