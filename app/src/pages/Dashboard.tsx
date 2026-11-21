import { useMemo, useState } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line,
} from 'recharts';
import { loadDashboard, type Period } from '../lib/db';
import { money, num, startOfDay, endOfDay, startOfWeek, startOfMonth, startOfYear, isoDay } from '../lib/format';
import { Kpi, Loading, ErrorBox, useAsync, Empty } from '../ui/kit';

type Range = 'dia' | 'semana' | 'mes' | 'ano' | 'custom';
const GOLD = '#c9a24a';
const AXIS = { stroke: '#5e6268', fontSize: 11 };
const PIE_COLORS = ['#c9a24a', '#8e9298', '#6c8fb8', '#4ca96b', '#c75c5c'];

const tooltipStyle = {
  background: '#16161a', border: '1px solid rgba(255,255,255,.16)',
  borderRadius: 3, fontSize: 12, color: '#fff',
} as const;

export default function Dashboard() {
  const [range, setRange] = useState<Range>('mes');
  const [from, setFrom] = useState(isoDay(startOfMonth(new Date())));
  const [to, setTo] = useState(isoDay(new Date()));

  const period: Period = useMemo(() => {
    const now = new Date();
    switch (range) {
      case 'dia':    return { from: startOfDay(now), to: endOfDay(now) };
      case 'semana': return { from: startOfWeek(now), to: endOfDay(now) };
      case 'mes':    return { from: startOfMonth(now), to: endOfDay(now) };
      case 'ano':    return { from: startOfYear(now), to: endOfDay(now) };
      default:       return { from: startOfDay(new Date(from + 'T00:00')), to: endOfDay(new Date(to + 'T00:00')) };
    }
  }, [range, from, to]);

  const { data, loading, error } = useAsync(() => loadDashboard(period), [period.from.getTime(), period.to.getTime()]);

  return (
    <>
      <div className="row-b wrap mb16">
        <div className="seg">
          {(['dia', 'semana', 'mes', 'ano', 'custom'] as Range[]).map((r) => (
            <button key={r} className={range === r ? 'on' : ''} onClick={() => setRange(r)}>
              {r === 'mes' ? 'Mês' : r === 'custom' ? 'Período' : r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>
        {range === 'custom' && (
          <div className="row gap8">
            <input className="inp" type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ width: 160 }} />
            <span className="mut2">até</span>
            <input className="inp" type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ width: 160 }} />
          </div>
        )}
      </div>

      {loading && <Loading />}
      {error && <ErrorBox msg={error} />}

      {data && !loading && (
        <>
          <div className="grid g4 mb16">
            <Kpi label="Faturamento de hoje" value={money(data.revenueToday)} />
            <Kpi label="Faturamento do mês" value={money(data.revenueMonth)} />
            <Kpi label="Faturamento anual" value={money(data.revenueYear)} />
            <Kpi label="No período" value={money(data.revenue)} tone="gold" />
          </div>

          <div className="grid g4 mb16">
            <Kpi label="Atendimentos" value={num(data.appointments)} hint="concluídos no período" />
            <Kpi label="Ticket médio" value={money(data.ticketAvg)} hint="por comanda fechada" />
            <Kpi label="Despesas" value={money(data.expenses)} tone={data.expenses > 0 ? 'bad' : undefined} />
            <Kpi label="Lucro líquido" value={money(data.profit)}
                 tone={data.profit >= 0 ? 'ok' : 'bad'}
                 hint="receita − despesas − comissões" />
          </div>

          <div className="grid g4 mb16">
            <Kpi label="Comissões pendentes" value={money(data.commissionsPending)} tone="gold" />
            <Kpi label="Comissões pagas" value={money(data.commissionsPaid)} />
            <Kpi label="Clientes novos" value={num(data.newClients)} hint="cadastrados no período" />
            <Kpi label="Clientes recorrentes" value={num(data.returningClients)} hint="já eram da casa" />
          </div>

          <div className="grid g2 mb16">
            <div className="card">
              <div className="card-h"><h3>Evolução financeira</h3></div>
              {data.byDay.length ? (
                <div className="chart-box">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.byDay}>
                      <defs>
                        <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={GOLD} stopOpacity={0.5} />
                          <stop offset="100%" stopColor={GOLD} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} />
                      <XAxis dataKey="day" tick={AXIS} tickLine={false} axisLine={false} />
                      <YAxis tick={AXIS} tickLine={false} axisLine={false} width={52} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => money(v)} />
                      <Area type="monotone" dataKey="receita" stroke={GOLD} strokeWidth={2} fill="url(#gRev)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : <Empty msg="Sem movimentação no período." />}
            </div>

            <div className="card">
              <div className="card-h"><h3>Faturamento por profissional</h3></div>
              {data.byBarber.length ? (
                <div className="chart-box">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.byBarber} layout="vertical" margin={{ left: 10 }}>
                      <CartesianGrid stroke="rgba(255,255,255,.06)" horizontal={false} />
                      <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="name" tick={AXIS} tickLine={false} axisLine={false} width={104} />
                      <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,255,255,.04)' }}
                               formatter={(v: number) => money(v)} />
                      <Bar dataKey="receita" fill={GOLD} radius={[0, 2, 2, 0]} maxBarSize={22} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : <Empty msg="Sem atendimentos lançados." />}
            </div>
          </div>

          <div className="grid g2 mb16">
            <div className="card">
              <div className="card-h"><h3>Serviços mais realizados</h3></div>
              {data.byService.length ? (
                <div>
                  {data.byService.slice(0, 8).map((s) => {
                    const max = data.byService[0].qtd || 1;
                    return (
                      <div className="list-row" key={s.name}>
                        <span style={{ flex: '0 0 42%', fontSize: '.84rem' }}>{s.name}</span>
                        <div className="bar"><i style={{ width: `${(s.qtd / max) * 100}%` }} /></div>
                        <span className="tnum mut" style={{ flex: '0 0 32px', textAlign: 'right' }}>{s.qtd}</span>
                        <span className="tnum" style={{ flex: '0 0 84px', textAlign: 'right' }}>{money(s.receita)}</span>
                      </div>
                    );
                  })}
                </div>
              ) : <Empty msg="Sem serviços lançados." />}
            </div>

            <div className="card">
              <div className="card-h"><h3>Formas de pagamento</h3></div>
              {data.byMethod.length ? (
                <div className="chart-box">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={data.byMethod} dataKey="valor" nameKey="name" innerRadius={56} outerRadius={88}
                           paddingAngle={2} stroke="#0a0a0b" strokeWidth={2}>
                        {data.byMethod.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => money(v)} />
                      <Legend wrapperStyle={{ fontSize: 12, color: '#8e9298' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : <Empty msg="Nenhum pagamento no período." />}
            </div>
          </div>

          <div className="card">
            <div className="card-h"><h3>Desempenho mensal — {new Date().getFullYear()}</h3></div>
            <div className="chart-box">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.byMonth}>
                  <CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} />
                  <XAxis dataKey="mes" tick={AXIS} tickLine={false} axisLine={false} />
                  <YAxis tick={AXIS} tickLine={false} axisLine={false} width={52} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => money(v)} />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#8e9298' }} />
                  <Line type="monotone" dataKey="receita" name="Receita" stroke={GOLD} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="despesa" name="Despesa" stroke="#c75c5c" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </>
  );
}
