import { Suspense, lazy } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import Login from './auth/Login';
import Shell from './layout/Shell';
import { Loading, Banner } from './ui/kit';
import type { AdminPermission } from './lib/types';

/* Cada tela vira um arquivo próprio, buscado só quando o usuário abre a rota.
   Antes as 20 telas vinham no primeiro arquivo: quem só usa a agenda baixava
   o dashboard, os relatórios, o estoque e o CMS do site junto. O pacote de
   gráficos (425 KB) chegava a ser baixado na tela de login, antes de existir
   sessão, porque o dashboard o importava de forma estática. */
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Agenda = lazy(() => import('./pages/Agenda'));
const Caixa = lazy(() => import('./pages/Caixa'));
const Comandas = lazy(() => import('./pages/Comandas'));
const Clientes = lazy(() => import('./pages/Clientes'));
const Servicos = lazy(() => import('./pages/Servicos'));
const Profissionais = lazy(() => import('./pages/Profissionais'));
const Comissoes = lazy(() => import('./pages/Comissoes'));
const Fiados = lazy(() => import('./pages/Fiados'));
const Pacotes = lazy(() => import('./pages/Pacotes'));
const Estoque = lazy(() => import('./pages/Estoque'));
const Fornecedores = lazy(() => import('./pages/Fornecedores'));
const Despesas = lazy(() => import('./pages/Despesas'));
const Relatorios = lazy(() => import('./pages/Relatorios'));
const Config = lazy(() => import('./pages/Config'));
const Site = lazy(() => import('./pages/Site'));

const MeuPainel = lazy(() => import('./pages/barber/MeuPainel'));
const MinhasComissoes = lazy(() => import('./pages/barber/MinhasComissoes'));
const MeusClientes = lazy(() => import('./pages/barber/MeusClientes'));
const Disponibilidade = lazy(() => import('./pages/barber/Disponibilidade'));

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
      <Suspense fallback={<Loading />}>
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
              <Route path="/site" element={<StaffOnly><Site /></StaffOnly>} />
              <Route path="/comissoes" element={isOwner || can('commissions') ? <Comissoes /> : <Denied />} />
              <Route path="/relatorios" element={isOwner || can('reports') ? <Relatorios /> : <Denied />} />
              <Route path="/despesas" element={<Need perm="financial"><Despesas /></Need>} />
              <Route path="/estoque" element={<Need perm="stock"><Estoque /></Need>} />
              <Route path="/fornecedores" element={<Need perm="stock"><Fornecedores /></Need>} />
            </>
          )}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
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
