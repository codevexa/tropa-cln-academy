import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { must, dbError } from '../lib/db';
import { phoneBR } from '../lib/format';
import { Modal, Field, Badge, ErrorBox, Empty, useAsync, useSubmit, SkeletonTabela } from '../ui/kit';
import { IcPlus, IcEdit } from '../ui/icons';
import type { Supplier } from '../lib/types';

export default function Fornecedores() {
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [creating, setCreating] = useState(false);
  const list = useAsync(
    () => must(supabase.from('suppliers').select('id,name,phone,email,notes,active').order('name')) as Promise<Supplier[]>, []
  );

  return (
    <>
      <div className="row-b wrap mb16">
        <p className="mut" style={{ fontSize: '.84rem' }}>Fornecedores dos produtos do estoque.</p>
        <button className="btn pri sm" onClick={() => setCreating(true)}><IcPlus />Novo fornecedor</button>
      </div>

      {list.loading && <SkeletonTabela />}
      {list.error && <ErrorBox msg={list.error} />}
      {!list.loading && !(list.data ?? []).length && <Empty msg="Nenhum fornecedor cadastrado." />}

      {!!(list.data ?? []).length && (
        <div className="tw">
          <table>
            <thead><tr><th>Nome</th><th>Telefone</th><th>E-mail</th><th>Observações</th><th>Situação</th><th /></tr></thead>
            <tbody>
              {(list.data ?? []).map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td className="mut">{phoneBR(s.phone)}</td>
                  <td className="mut">{s.email ?? '—'}</td>
                  <td className="mut">{s.notes ?? '—'}</td>
                  <td><Badge text={s.active ? 'Ativo' : 'Inativo'} tone={s.active ? 'ok' : ''} /></td>
                  <td className="num"><button className="x" onClick={() => setEditing(s)} title="Editar"><IcEdit /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(creating || editing) && (
        <SupplierForm supplier={editing} onClose={() => { setCreating(false); setEditing(null); }}
                      onDone={() => { setCreating(false); setEditing(null); list.reload(); }} />
      )}
    </>
  );
}

function SupplierForm({ supplier, onClose, onDone }: {
  supplier: Supplier | null; onClose: () => void; onDone: () => void;
}) {
  const [name, setName] = useState(supplier?.name ?? '');
  const [phone, setPhone] = useState(supplier?.phone ?? '');
  const [email, setEmail] = useState(supplier?.email ?? '');
  const [notes, setNotes] = useState(supplier?.notes ?? '');
  const [active, setActive] = useState(supplier?.active ?? true);
  const { busy, error, run } = useSubmit();

  const save = () => run(null, async () => {
    if (name.trim().length < 2) throw new Error('Informe o nome do fornecedor.');
    const payload = {
      name: name.trim(), phone: phone.trim() || null,
      email: email.trim() || null, notes: notes.trim() || null, active,
    };
    const { error: e } = supplier
      ? await supabase.from('suppliers').update(payload).eq('id', supplier.id)
      : await supabase.from('suppliers').insert(payload);
    if (e) throw new Error(dbError(e));
    onDone();
  });

  return (
    <Modal title={supplier ? 'Editar fornecedor' : 'Novo fornecedor'} onClose={onClose} footer={
      <>
        <button className="btn ghost" onClick={onClose}>Cancelar</button>
        <button className="btn pri" onClick={save} disabled={busy}>{busy ? 'Salvando…' : 'Salvar'}</button>
      </>
    }>
      {error && <div className="mb16"><ErrorBox msg={error} /></div>}
      <div className="form-grid">
        <Field label="Nome" full><input className="inp" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Telefone"><input className="inp" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
        <Field label="E-mail"><input className="inp" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Observações" full><textarea className="inp" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
        <Field label="Situação" full>
          <select className="inp" value={active ? '1' : '0'} onChange={(e) => setActive(e.target.value === '1')}>
            <option value="1">Ativo</option><option value="0">Inativo</option>
          </select>
        </Field>
      </div>
    </Modal>
  );
}
