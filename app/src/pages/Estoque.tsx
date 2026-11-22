import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { must, dbError } from '../lib/db';
import { money, num, dateTimeBR, label } from '../lib/format';
import { Modal, Field, Badge, Kpi, ErrorBox, Empty, useAsync, useSubmit, Banner, SkeletonTabela } from '../ui/kit';
import { IcPlus, IcEdit } from '../ui/icons';
import type { Product, Supplier, StockMove, StockMoveType } from '../lib/types';

interface ProductRow extends Product { suppliers: { name: string } | null }

export default function Estoque() {
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [moving, setMoving] = useState<Product | null>(null);
  const [history, setHistory] = useState<Product | null>(null);

  const list = useAsync(
    () => must(supabase.from('products').select('*, suppliers(name)').order('name')) as Promise<ProductRow[]>, []
  );
  const rows = list.data ?? [];
  const low = rows.filter((p) => p.active && Number(p.stock_qty) <= Number(p.min_qty));
  const value = rows.reduce((a, p) => a + Number(p.stock_qty) * Number(p.cost_price), 0);

  return (
    <>
      <div className="grid g4 mb16">
        <Kpi label="Produtos ativos" value={num(rows.filter((p) => p.active).length)} />
        <Kpi label="Estoque baixo" value={num(low.length)} tone={low.length ? 'bad' : 'ok'}
             hint={low.length ? 'repor com urgência' : 'tudo acima do mínimo'} />
        <Kpi label="Valor em estoque" value={money(value)} hint="pelo preço de custo" />
        <div className="kpi">
          <p>Ação</p>
          <button className="btn pri block" style={{ marginTop: 4 }} onClick={() => setCreating(true)}>
            <IcPlus />Novo produto
          </button>
        </div>
      </div>

      {!!low.length && (
        <div className="mb16"><Banner tone="warn">
          <b>{low.length} produto(s) no mínimo ou abaixo:</b> {low.map((p) => p.name).join(', ')}.
        </Banner></div>
      )}

      {list.loading && <SkeletonTabela />}
      {list.error && <ErrorBox msg={list.error} />}
      {!list.loading && !rows.length && <Empty msg="Nenhum produto cadastrado." />}

      {!!rows.length && (
        <div className="tw">
          <table>
            <thead>
              <tr><th>Produto</th><th>Fornecedor</th><th className="num">Estoque</th>
                  <th className="num">Mínimo</th><th className="num">Custo</th>
                  <th className="num">Venda</th><th>Situação</th><th /></tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const isLow = Number(p.stock_qty) <= Number(p.min_qty);
                return (
                  <tr key={p.id}>
                    <td>{p.name}{p.sku && <div className="hint">{p.sku}</div>}</td>
                    <td className="mut">{p.suppliers?.name ?? '—'}</td>
                    <td className="num" style={{ color: isLow ? '#e3a0a0' : undefined }}>
                      {num(p.stock_qty)} {p.unit}
                    </td>
                    <td className="num mut">{num(p.min_qty)}</td>
                    <td className="num">{money(p.cost_price)}</td>
                    <td className="num">{money(p.sale_price)}</td>
                    <td><Badge text={isLow ? 'Repor' : 'OK'} tone={isLow ? 'bad' : 'ok'} /></td>
                    <td className="num">
                      <div className="row gap4" style={{ justifyContent: 'flex-end' }}>
                        <button className="btn sm ghost" onClick={() => setHistory(p)}>Movimentos</button>
                        <button className="btn sm" onClick={() => setMoving(p)}>Movimentar</button>
                        <button className="x" onClick={() => setEditing(p)} title="Editar"><IcEdit /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {(creating || editing) && (
        <ProductForm product={editing} onClose={() => { setCreating(false); setEditing(null); }}
                     onDone={() => { setCreating(false); setEditing(null); list.reload(); }} />
      )}
      {moving && <MoveForm product={moving} onClose={() => setMoving(null)}
                           onDone={() => { setMoving(null); list.reload(); }} />}
      {history && <MoveHistory product={history} onClose={() => setHistory(null)} />}
    </>
  );
}

function ProductForm({ product, onClose, onDone }: {
  product: Product | null; onClose: () => void; onDone: () => void;
}) {
  const [name, setName] = useState(product?.name ?? '');
  const [sku, setSku] = useState(product?.sku ?? '');
  const [unit, setUnit] = useState(product?.unit ?? 'un');
  const [minQty, setMinQty] = useState(String(product?.min_qty ?? 0));
  const [cost, setCost] = useState(String(product?.cost_price ?? ''));
  const [sale, setSale] = useState(String(product?.sale_price ?? ''));
  const [supplierId, setSupplierId] = useState(product?.supplier_id ?? '');
  const [active, setActive] = useState(product?.active ?? true);
  const { busy, error, run } = useSubmit();

  const suppliers = useAsync(
    () => must(supabase.from('suppliers').select('*').eq('active', true).order('name')) as Promise<Supplier[]>, []
  );

  const save = () => run(null, async () => {
    if (name.trim().length < 2) throw new Error('Informe o nome do produto.');
    const payload = {
      name: name.trim(), sku: sku.trim() || null, unit: unit.trim() || 'un',
      min_qty: Number(minQty.replace(',', '.')) || 0,
      cost_price: Number(cost.replace(',', '.')) || 0,
      sale_price: Number(sale.replace(',', '.')) || 0,
      supplier_id: supplierId || null, active,
    };
    const { error: e } = product
      ? await supabase.from('products').update(payload).eq('id', product.id)
      : await supabase.from('products').insert(payload);
    if (e) throw new Error(dbError(e));
    onDone();
  });

  return (
    <Modal title={product ? 'Editar produto' : 'Novo produto'} onClose={onClose} footer={
      <>
        <button className="btn ghost" onClick={onClose}>Cancelar</button>
        <button className="btn pri" onClick={save} disabled={busy}>{busy ? 'Salvando…' : 'Salvar'}</button>
      </>
    }>
      {error && <div className="mb16"><ErrorBox msg={error} /></div>}
      {!product && (
        <div className="mb16"><Banner>
          O saldo inicial entra como <b>movimentação de entrada</b> depois de salvar. Produtos nascem zerados.
        </Banner></div>
      )}
      <div className="form-grid">
        <Field label="Nome" full><input className="inp" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Código / SKU"><input className="inp" value={sku} onChange={(e) => setSku(e.target.value)} /></Field>
        <Field label="Unidade"><input className="inp" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="un, ml, g" /></Field>
        <Field label="Estoque mínimo"><input className="inp" inputMode="decimal" value={minQty} onChange={(e) => setMinQty(e.target.value)} /></Field>
        <Field label="Preço de custo"><input className="inp" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} /></Field>
        <Field label="Preço de venda"><input className="inp" inputMode="decimal" value={sale} onChange={(e) => setSale(e.target.value)} /></Field>
        <Field label="Fornecedor">
          <select className="inp" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">Sem fornecedor</option>
            {(suppliers.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
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

function MoveForm({ product, onClose, onDone }: { product: Product; onClose: () => void; onDone: () => void }) {
  const [type, setType] = useState<StockMoveType>('entrada');
  const [qty, setQty] = useState('');
  const [cost, setCost] = useState(String(product.cost_price));
  const [reason, setReason] = useState('');
  const { busy, error, run } = useSubmit();

  const save = () => run(null, async () => {
    const q = Number(qty.replace(',', '.'));
    if (!q || q <= 0) throw new Error('Informe a quantidade.');
    const { error: e } = await supabase.from('stock_moves').insert({
      product_id: product.id, type, qty: q,
      unit_cost: type === 'entrada' ? Number(cost.replace(',', '.')) || null : null,
      reason: reason.trim() || null,
    });
    if (e) throw new Error(dbError(e));
    onDone();
  });

  return (
    <Modal title={`Movimentar — ${product.name}`} onClose={onClose} footer={
      <>
        <button className="btn ghost" onClick={onClose}>Cancelar</button>
        <button className="btn pri" onClick={save} disabled={busy}>{busy ? 'Salvando…' : 'Registrar'}</button>
      </>
    }>
      {error && <div className="mb16"><ErrorBox msg={error} /></div>}
      <p className="hint mb16">Saldo atual: <b>{num(product.stock_qty)} {product.unit}</b></p>
      <div className="form-grid">
        <Field label="Tipo">
          <select className="inp" value={type} onChange={(e) => setType(e.target.value as StockMoveType)}>
            <option value="entrada">Entrada</option>
            <option value="saida">Saída</option>
            <option value="ajuste">Ajuste de saldo</option>
          </select>
        </Field>
        <Field label={type === 'ajuste' ? 'Novo saldo' : 'Quantidade'}>
          <input className="inp" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />
        </Field>
        {type === 'entrada' && (
          <Field label="Custo unitário">
            <input className="inp" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} />
          </Field>
        )}
        <Field label="Motivo" full>
          <input className="inp" value={reason} onChange={(e) => setReason(e.target.value)}
                 placeholder="Compra, uso interno, perda, contagem…" />
        </Field>
      </div>
      {type === 'saida' && (
        <p className="hint mt16">Saída maior que o saldo é recusada pelo sistema.</p>
      )}
    </Modal>
  );
}

function MoveHistory({ product, onClose }: { product: Product; onClose: () => void }) {
  const moves = useAsync(
    () => must(supabase.from('stock_moves').select('*').eq('product_id', product.id)
      .order('created_at', { ascending: false }).limit(100)) as Promise<StockMove[]>, [product.id]
  );
  return (
    <Modal title={`Movimentações — ${product.name}`} onClose={onClose} footer={
      <button className="btn ghost" onClick={onClose}>Fechar</button>
    }>
      {moves.loading && <SkeletonTabela />}
      {!moves.loading && !(moves.data ?? []).length && <Empty msg="Nenhuma movimentação." />}
      {!!(moves.data ?? []).length && (
        <div className="tw">
          <table>
            <thead><tr><th>Data</th><th>Tipo</th><th className="num">Qtd</th><th>Motivo</th></tr></thead>
            <tbody>
              {(moves.data ?? []).map((m) => (
                <tr key={m.id}>
                  <td>{dateTimeBR(m.created_at)}</td>
                  <td><Badge text={label(m.type)}
                             tone={m.type === 'entrada' ? 'ok' : m.type === 'saida' ? 'bad' : 'info'} /></td>
                  <td className="num">{num(m.qty)}</td>
                  <td className="mut">{m.reason ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
