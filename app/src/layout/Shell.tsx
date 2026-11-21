import { useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { initials } from '../lib/format';
import {
  IcDash, IcCal, IcCash, IcTicket, IcUsers, IcScissor, IcMoney, IcDebt,
  IcPack, IcBox, IcTruck, IcChart, IcGear, IcOut, IcMenu, IcUser, IcClock,
} from '../ui/icons';

type Item = { to: string; label: string; Icon: (p: { className?: string }) => JSX.Element; show: boolean };
type Group = { title: string; items: Item[] };

export default function Shell({ children }: { children: ReactNode }) {
  const { profile, barber, signOut, isOwner, isStaff, isBarber, can } = useAuth();
  const [open, setOpen] = useState(false);
  const loc = useLocation();

  const groups: Group[] = isBarber
    ? [{
        title: 'Meu painel',
        items: [
          { to: '/', label: 'Resumo', Icon: IcDash, show: true },
          { to: '/minha-agenda', label: 'Minha agenda', Icon: IcCal, show: true },
          { to: '/meus-clientes', label: 'Meus clientes', Icon: IcUsers, show: true },
          { to: '/minhas-comissoes', label: 'Minhas comissões', Icon: IcMoney, show: true },
          { to: '/disponibilidade', label: 'Disponibilidade', Icon: IcClock, show: true },
        ],
      }]
    : [
        {
          title: 'Operação',
          items: [
            { to: '/', label: 'Dashboard', Icon: IcDash, show: isOwner || can('reports') },
            { to: '/agenda', label: 'Agenda', Icon: IcCal, show: isStaff },
            { to: '/caixa', label: 'Caixa', Icon: IcCash, show: isStaff },
            { to: '/comandas', label: 'Comandas', Icon: IcTicket, show: isStaff },
          ],
        },
        {
          title: 'Cadastros',
          items: [
            { to: '/clientes', label: 'Clientes', Icon: IcUsers, show: isStaff },
            { to: '/servicos', label: 'Serviços', Icon: IcScissor, show: isStaff },
            { to: '/profissionais', label: 'Profissionais', Icon: IcUser, show: isOwner },
            { to: '/pacotes', label: 'Pacotes', Icon: IcPack, show: isStaff },
          ],
        },
        {
          title: 'Financeiro',
          items: [
            { to: '/comissoes', label: 'Comissões', Icon: IcMoney, show: isOwner || can('commissions') },
            { to: '/fiados', label: 'Fiados', Icon: IcDebt, show: isStaff },
            { to: '/despesas', label: 'Despesas', Icon: IcMoney, show: can('financial') },
            { to: '/relatorios', label: 'Relatórios', Icon: IcChart, show: isOwner || can('reports') },
          ],
        },
        {
          title: 'Estoque',
          items: [
            { to: '/estoque', label: 'Produtos', Icon: IcBox, show: can('stock') },
            { to: '/fornecedores', label: 'Fornecedores', Icon: IcTruck, show: can('stock') },
          ],
        },
        {
          title: 'Sistema',
          items: [{ to: '/config', label: 'Configurações', Icon: IcGear, show: isOwner }],
        },
      ];

  const roleLabel = profile?.role === 'owner' ? 'Proprietário'
    : profile?.role === 'admin' ? 'Administrador' : 'Barbeiro';
  const current = groups.flatMap((g) => g.items).find((i) => i.to === loc.pathname);

  return (
    <div className="shell">
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <aside className={'side' + (open ? ' open' : '')}>
        <div className="side-top">
          <img src="/logo-badge.png" alt="" width={38} height={38} />
          <div><b>Diamond</b><span>Gestão</span></div>
        </div>

        <nav className="side-nav">
          {groups.map((g) => {
            const items = g.items.filter((i) => i.show);
            if (!items.length) return null;
            return (
              <div className="nav-group" key={g.title}>
                <p>{g.title}</p>
                {items.map(({ to, label, Icon }) => (
                  <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)}
                           className={({ isActive }) => 'nav-item' + (isActive ? ' on' : '')}>
                    <Icon /><span>{label}</span>
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>

        <div className="side-foot">
          <div className="who">
            <span className="avatar">{initials(profile?.full_name ?? '?')}</span>
            <div className="grow" style={{ minWidth: 0 }}>
              <b style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {barber?.display_name ?? profile?.full_name}
              </b>
              <span>{roleLabel}</span>
            </div>
            <button className="x" onClick={() => void signOut()} title="Sair" aria-label="Sair"><IcOut /></button>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="burger-btn" onClick={() => setOpen((v) => !v)} aria-label="Menu"><IcMenu /></button>
          <h1 style={{ fontSize: '.92rem', letterSpacing: '.14em' }}>{current?.label ?? 'Diamond'}</h1>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
