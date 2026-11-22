import { useMemo, useState } from 'react';
import { loadDashboard, type Period } from '../lib/db';
import { money, num, isoDay, startOfDay, endOfDay, startOfMonth } from '../lib/format';
import { Kpi, ErrorBox, Empty, useAsync, SkeletonCartoes } from '../ui/kit';

type Tab = 'financeiro' | 'profissionais' | 'servicos' | 'pagamentos';

function toCsv(rows: Record<string, string | number>[]): string {
  if (!rows.length) return '';
  const head = Object.keys(rows[0]);
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  return [head.join(';'), ...rows.map((r) => head.map((h) => esc(r[h])).join(';'))].join('\n');
}

function download(name: string, content: string) {
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function Relatorios() {
  const [tab, setTab] = useState<Tab>('financeiro');
  const [from, setFrom] = useState(isoDay(startOfMonth(new Date())));
  const [to, setTo] = useState(isoDay(new Date()));

  const period: Period = useMemo(() => ({
    from: startOfDay(new Date(from + 'T00:00')),
    to: endOfDay(new Date(to + 'T00:00')),
  }), [from, to]);

  const { data, loading, error } = useAsync(() => loadDashboard(period),
    [period.from.getTime(), period.to.getTime()]);

  const exportCsv = () => {
    if (!data) return;
    const map: Record<Tab, Record<string, string | number>[]> = {
      financeiro: data.byDay.map((d) => ({ Dia: d.day, Receita: d.receita })),
      profissionais: data.byBarber.map((b) => ({ Profissional: b.name, Receita: b.receita })),
      servicos: data.byService.map((s) => ({ Serviço: s.name, Quantidade: s.qtd, Receita: s.receita })),
      pagamentos: data.byMethod.map((m) => ({ Forma: m.name, Valor: m.valor })),
    };
    download(`diamond-${tab}-${from}-a-${to}.csv`, toCsv(map[tab]));
  };

  return (
    <>
      <div className="row-b wrap mb16">
        <div className="row gap8 wrap">
          <input className="inp" type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ maxWidth: 170 }} />
          <span className="mut2">até</span>
          <input className="inp" type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ maxWidth: 170 }} />
        </div>
        <button className="btn sm" onClick={exportCsv} disabled={!data}>Exportar CSV</button>
      </div>

      {loading && <SkeletonCartoes cartoes={6} />}
      {error && <ErrorBox msg={error} />}

      {data && !loading && (
        <>
          <div className="grid g4 mb16">
            <Kpi label="Receita" value={money(data.revenue)} tone="gold" />
            <Kpi label="Despesas" value={money(data.expenses)} tone="bad" />
            <Kpi label="Comissões" value={money(data.commissionsPending + data.commissionsPaid)} />
            <Kpi label="Resultado" value={money(data.profit)} tone={data.profit >= 0 ? 'ok' : 'bad'} />
          </div>

          <div className="tabs">
            {(['financeiro', 'profissionais', 'servicos', 'pagamentos'] as Tab[]).map((t) => (
              <button key={t} className={'tab' + (tab === t ? ' on' : '')} onClick={() => setTab(t)}>
                {t === 'servicos' ? 'Serviços' : t}
              </button>
            ))}
          </div>

          {tab === 'financeiro' && (
            <Table head={['Dia', 'Receita']} rows={data.byDay.map((d) => [d.day, money(d.receita)])}
                   empty="Sem movimentação no período." />
          )}
          {tab === 'profissionais' && (
            <Table head={['Profissional', 'Receita', 'Participação']}
                   rows={data.byBarber.map((b) => [
                     b.name, money(b.receita),
                     data.revenue ? `${((b.receita / data.byBarber.reduce((a, x) => a + x.receita, 0)) * 100).toFixed(1)}%` : '—',
                   ])}
                   empty="Nenhum atendimento lançado." />
          )}
          {tab === 'servicos' && (
            <Table head={['Serviço', 'Quantidade', 'Receita']}
                   rows={data.byService.map((s) => [s.name, num(s.qtd), money(s.receita)])}
                   empty="Nenhum serviço lançado." />
          )}
          {tab === 'pagamentos' && (
            <Table head={['Forma', 'Valor', 'Participação']}
                   rows={data.byMethod.map((m) => [
                     m.name, money(m.valor),
                     data.revenue ? `${((m.valor / data.revenue) * 100).toFixed(1)}%` : '—',
                   ])}
                   empty="Nenhum pagamento no período." />
          )}
        </>
      )}
    </>
  );
}

function Table({ head, rows, empty }: { head: string[]; rows: (string | number)[][]; empty: string }) {
  if (!rows.length) return <Empty msg={empty} />;
  return (
    <div className="tw">
      <table>
        <thead><tr>{head.map((h, i) => <th key={h} className={i ? 'num' : ''}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{r.map((c, j) => <td key={j} className={j ? 'num' : ''}>{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
