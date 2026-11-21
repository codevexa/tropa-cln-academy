import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import Login from './auth/Login';
import Shell from './layout/Shell';
import { Loading, Banner } from './ui/kit';
import type { AdminPermission } from './lib/types';

import Dashboard from './pages/Dashboard';
import Agenda from './pages/Agenda';
import Caixa from './pages/Caixa';
import Comandas from './pages/Comandas';
import Clientes from './pages/Clientes';
import Servicos from './pages/Servicos';
import Profissionais from './pages/Profissionais';
import Comissoes from './pages/Comissoes';
import Fiados from './pages/Fiados';
import Pacotes from './pages/Pacotes';
import Estoque from './pages/Estoque';
import Fornecedores from './pages/Fornecedores';
import Despesas from './pages/Despesas';
import Relatorios from './pages/Relatorios';
import Config from './pages/Config';

import MeuPainel from './pages/barber/MeuPainel';
import MinhasComissoes from './pages/barber/MinhasComissoes';
import MeusClientes from './pages/barber/MeusClientes';
import Disponibilidade from './pages/barber/Disponibilidade';

/* Hospedagens estáticas (GitHub Pages, Netlify sem rewrite, visualizador de
   artifacts) não reescrevem rotas para o index. HashRouter funciona em todas. */
const Router = HashRouter;

const Denied = () => (
  <Banner tone="warn">
    <b>Sem permissão.</b> Seu perfil não tem acesso a esta área. Fale com o proprietário.
  </Banner>
);

function Need({ perm, children }: { perm: AdminPermission; children: JSX.Element }) {
  const { can } = useAuth();
  return can(perm) ? children : <Denied />;
}
function OwnerOnly({ children }: { children: JSX.Element }) {
  const { isOwner } = useAuth();
  return isOwner ? children : <Denied />;
}
function StaffOnly({ children }: { children: JSX.Element }) {
  const { isStaff } = useAuth();
  return isStaff ? children : <Denied />;
}

function Routed() {
  const { session, profile, loading, isBarber, isOwner, can, barber } = useAuth();

  if (loading) return <div className="login"><Loading /></div>;
  if (!session) return <Login />;

  if (!profile) {
    return (
      <div className="login">
        <div className="login-card">
          <Banner tone="warn">
            <b>Perfil não encontrado.</b> Este login existe na autenticação, mas ainda não tem um
            perfil no sistema. O proprietário precisa criá-lo em Profissionais → Acessos.
          </Banner>
        </div>
      </div>
    );
  }

  if (!profile.active) {
    return (
      <div className="login">
        <div className="login-card">
          <Banner tone="bad"><b>Acesso desativado.</b> Fale com o proprietário.</Banner>
        </div>
      </div>
    );
  }

  return (
    <Shell>
      <Routes>
        {isBarber ? (
          <>
            <Route path="/" element={<MeuPainel />} />
            <Route path="/minha-agenda" element={<Agenda barberOnly={barber?.id} />} />
            <Route path="/meus-clientes" element={<MeusClientes />} />
            <Route path="/minhas-comissoes" element={<MinhasComissoes />} />
            <Route path="/disponibilidade" element={<Disponibilidade />} />
          </>
        ) : (
          <>
            <Route path="/" element={isOwner || can('reports') ? <Dashboard /> : <Navigate to="/agenda" replace />} />
            <Route path="/agenda" element={<StaffOnly><Agenda /></StaffOnly>} />
            <Route path="/caixa" element={<StaffOnly><Caixa /></StaffOnly>} />
            <Route path="/comandas" element={<StaffOnly><Comandas /></StaffOnly>} />
            <Route path="/clientes" element={<StaffOnly><Clientes /></StaffOnly>} />
            <Route path="/servicos" element={<StaffOnly><Servicos /></StaffOnly>} />
            <Route path="/pacotes" element={<StaffOnly><Pacotes /></StaffOnly>} />
            <Route path="/fiados" element={<StaffOnly><Fiados /></StaffOnly>} />
            <Route path="/profissionais" element={<OwnerOnly><Profissionais /></OwnerOnly>} />
            <Route path="/config" element={<OwnerOnly><Config /></OwnerOnly>} />
            <Route path="/comissoes" element={isOwner || can('commissions') ? <Comissoes /> : <Denied />} />
            <Route path="/relatorios" element={isOwner || can('reports') ? <Relatorios /> : <Denied />} />
            <Route path="/despesas" element={<Need perm="financial"><Despesas /></Need>} />
            <Route path="/estoque" element={<Need perm="stock"><Estoque /></Need>} />
            <Route path="/fornecedores" element={<Need perm="stock"><Fornecedores /></Need>} />
          </>
        )}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router><Routed /></Router>
    </AuthProvider>
  );
}
