import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { must, dbError } from '../lib/db';
import { money, durationBR } from '../lib/format';
import { Modal, Field, Badge, ErrorBox, Empty, useAsync, useSubmit, Confirm, SkeletonTabela } from '../ui/kit';
import { IcPlus, IcEdit, IcTrash } from '../ui/icons';
import type { Service } from '../lib/types';

const CATS = ['corte', 'barba', 'combo', 'pacote', 'extra', 'geral'];

export default function Servicos() {
  const [editing, setEditing] = useState<Service | null>(null);
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<Service | null>(null);
  const { error, run } = useSubmit();

  const list = useAsync(
    () => must(supabase.from('services').select('*').order('order_index')) as Promise<Service[]>, []
  );

  const toggle = (s: Service) => run(null, async () => {
    const { error: e } = await supabase.from('services').update({ active: !s.active }).eq('id', s.id);
    if (e) throw new Error(dbError(e));
    list.reload();
  });

  const remove = (s: Service) => run(null, async () => {
    const { error: e } = await supabase.from('services').delete().eq('id', s.id);
    if (e) throw new Error(dbError(e));
    setRemoving(null); list.reload();
  });

  return (
    <>
      <div className="row-b wrap mb16">
        <p className="mut" style={{ fontSize: '.84rem' }}>
          A tabela de preços do site público usa estes mesmos serviços.
        </p>
        <button className="btn pri sm" onClick={() => setCreating(true)}><IcPlus />Novo serviço</button>
      </div>

      {error && <div className="mb16"><ErrorBox msg={error} /></div>}
      {list.loading && <SkeletonTabela />}
      {list.error && <ErrorBox msg={list.error} />}
      {!list.loading && !(list.data ?? []).length && <Empty msg="Nenhum serviço cadastrado." />}

      {!!(list.data ?? []).length && (
        <div className="tw">
          <table>
            <thead>
              <tr><th>#</th><th>Serviço</th><th>Categoria</th><th>Duração</th>
                  <th className="num">Preço</th><th>Situação</th><th /></tr>
            </thead>
            <tbody>
              {(list.data ?? []).map((s, i) => (
                <tr key={s.id}>
                  <td className="tnum mut2">{String(i + 1).padStart(2, '0')}</td>
                  <td>{s.name}</td>
                  <td className="mut">{s.category}</td>
                  <td>{durationBR(s.duration_min)}</td>
                  <td className="num">{money(s.price)}</td>
                  <td>
                    <button onClick={() => toggle(s)} title="Alternar">
                      <Badge text={s.active ? 'Ativo' : 'Inativo'} tone={s.active ? 'ok' : ''} />
                    </button>
                  </td>
                  <td className="num">
                    <div className="row gap4" style={{ justifyContent: 'flex-end' }}>
                      <button className="x" onClick={() => setEditing(s)} title="Editar"><IcEdit /></button>
                      <button className="x" onClick={() => setRemoving(s)} title="Excluir"><IcTrash /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(creating || editing) && (
        <ServiceForm service={editing} count={(list.data ?? []).length}
                     onClose={() => { setCreating(false); setEditing(null); }}
                     onDone={() => { setCreating(false); setEditing(null); list.reload(); }} />
      )}
      {removing && (
        <Confirm danger title="Excluir serviço"
                 message={`Excluir "${removing.name}"? Se já houver atendimentos com ele, prefira desativar.`}
                 onCancel={() => setRemoving(null)} onConfirm={() => remove(removing)} />
      )}
    </>
  );
}

function ServiceForm({ service, count, onClose, onDone }: {
  service: Service | null; count: number; onClose: () => void; onDone: () => void;
}) {
  const [name, setName] = useState(service?.name ?? '');
  const [duration, setDuration] = useState(String(service?.duration_min ?? 30));
  const [price, setPrice] = useState(String(service?.price ?? ''));
  const [category, setCategory] = useState(service?.category ?? 'corte');
  const { busy, error, run } = useSubmit();

  const save = () => run(null, async () => {
    const d = parseInt(duration, 10), p = Number(price.replace(',', '.'));
    if (name.trim().length < 2) throw new Error('Informe o nome do serviço.');
    if (!d || d <= 0) throw new Error('Duração deve ser maior que zero.');
    if (Number.isNaN(p) || p < 0) throw new Error('Informe um preço válido.');
    const payload = { name: name.trim(), duration_min: d, price: p, category };
    const { error: e } = service
      ? await supabase.from('services').update(payload).eq('id', service.id)
      : await supabase.from('services').insert({ ...payload, order_index: count + 1 });
    if (e) throw new Error(dbError(e));
    onDone();
  });

  return (
    <Modal title={service ? 'Editar serviço' : 'Novo serviço'} onClose={onClose} footer={
      <>
        <button className="btn ghost" onClick={onClose}>Cancelar</button>
        <button className="btn pri" onClick={save} disabled={busy}>{busy ? 'Salvando…' : 'Salvar'}</button>
      </>
    }>
      {error && <div className="mb16"><ErrorBox msg={error} /></div>}
      <div className="form-grid">
        <Field label="Nome" full><input className="inp" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Duração (minutos)">
          <input className="inp" inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} />
        </Field>
        <Field label="Preço (R$)">
          <input className="inp" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
        <Field label="Categoria" full>
          <select className="inp" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
      </div>
    </Modal>
  );
}
