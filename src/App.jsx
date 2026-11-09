import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import StoreLayout from './layouts/StoreLayout';
import ProtectedRoute from './components/ProtectedRoute';
import ScrollToTop from './components/ScrollToTop';
import { PageLoader } from './components/Spinner';
import { supabaseConfigurado } from './services/supabase';

// Páginas carregadas sob demanda (lazy loading)
const Home = lazy(() => import('./pages/Home'));
const Produtos = lazy(() => import('./pages/Produtos'));
const Produto = lazy(() => import('./pages/Produto'));
const Carrinho = lazy(() => import('./pages/Carrinho'));
const Login = lazy(() => import('./pages/Login'));
const Cadastro = lazy(() => import('./pages/Cadastro'));
const EsqueciSenha = lazy(() => import('./pages/EsqueciSenha'));
const RedefinirSenha = lazy(() => import('./pages/RedefinirSenha'));
const Checkout = lazy(() => import('./pages/Checkout'));
const NotFound = lazy(() => import('./pages/NotFound'));

const AccountLayout = lazy(() => import('./layouts/AccountLayout'));
const MinhaConta = lazy(() => import('./pages/account/MinhaConta'));
const MeusPedidos = lazy(() => import('./pages/account/MeusPedidos'));
const PedidoDetalhe = lazy(() => import('./pages/account/PedidoDetalhe'));
const Favoritos = lazy(() => import('./pages/account/Favoritos'));
const Notificacoes = lazy(() => import('./pages/account/Notificacoes'));
const Atendimento = lazy(() => import('./pages/account/Atendimento'));

const AdminLayout = lazy(() => import('./layouts/AdminLayout'));
const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminProdutos = lazy(() => import('./pages/admin/Produtos'));
const AdminCategorias = lazy(() => import('./pages/admin/Categorias'));
const AdminPedidos = lazy(() => import('./pages/admin/Pedidos'));
const AdminPedidoDetalhe = lazy(() => import('./pages/admin/PedidoDetalhe'));
const AdminChat = lazy(() => import('./pages/admin/Chat'));
const AdminEstoque = lazy(() => import('./pages/admin/Estoque'));
const AdminEstoqueEntrada = lazy(() => import('./pages/admin/EstoqueEntrada'));
const AdminEstoqueSaida = lazy(() => import('./pages/admin/EstoqueSaida'));
const AdminRelatorios = lazy(() => import('./pages/admin/Relatorios'));
const AdminConfiguracoes = lazy(() => import('./pages/admin/Configuracoes'));
const AdminClientes = lazy(() => import('./pages/admin/Clientes'));
const AdminUsuarios = lazy(() => import('./pages/admin/Usuarios'));
const AdminPerfis = lazy(() => import('./pages/admin/Perfis'));

function AvisoConfiguracao() {
  if (supabaseConfigurado) return null;
  return (
    <div className="aviso-config" role="alert">
      Supabase não configurado: defina <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> no{' '}
      <code>.env</code> (ou nas variáveis de ambiente do Vercel).
    </div>
  );
}

const admin = (modulo, elemento, acao = 'ver') => (
  <ProtectedRoute modulo={modulo} acao={acao}>
    {elemento}
  </ProtectedRoute>
);

export default function App() {
  return (
    <>
      <ScrollToTop />
      <AvisoConfiguracao />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Loja */}
          <Route element={<StoreLayout />}>
            <Route index element={<Home />} />
            <Route path="produtos" element={<Produtos />} />
            <Route path="produto/:id" element={<Produto />} />
            <Route path="carrinho" element={<Carrinho />} />
            <Route path="login" element={<Login />} />
            <Route path="cadastro" element={<Cadastro />} />
            <Route path="esqueci-senha" element={<EsqueciSenha />} />
            <Route path="redefinir-senha" element={<RedefinirSenha />} />

            {/* Cliente logado */}
            <Route element={<ProtectedRoute />}>
              <Route path="checkout" element={<Checkout />} />
              <Route path="minha-conta" element={<AccountLayout />}>
                <Route index element={<MinhaConta />} />
                <Route path="pedidos" element={<MeusPedidos />} />
                <Route path="pedidos/:id" element={<PedidoDetalhe />} />
                <Route path="favoritos" element={<Favoritos />} />
                <Route path="notificacoes" element={<Notificacoes />} />
                <Route path="atendimento" element={<Atendimento />} />
              </Route>
            </Route>

            <Route path="*" element={<NotFound />} />
          </Route>

          {/* Painel administrativo */}
          <Route
            path="admin"
            element={
              <ProtectedRoute requireStaff>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="produtos" element={admin('produtos', <AdminProdutos />)} />
            <Route path="categorias" element={admin('categorias', <AdminCategorias />)} />
            <Route path="pedidos" element={admin('pedidos', <AdminPedidos />)} />
            <Route path="pedidos/:id" element={admin('pedidos', <AdminPedidoDetalhe />)} />
            <Route path="chat" element={admin('chat', <AdminChat />)} />
            <Route path="estoque" element={admin('estoque', <AdminEstoque />)} />
            <Route path="estoque/entrada" element={admin('estoque', <AdminEstoqueEntrada />, 'movimentar')} />
            <Route path="estoque/saida" element={admin('estoque', <AdminEstoqueSaida />, 'movimentar')} />
            <Route path="relatorios" element={admin('relatorios', <AdminRelatorios />)} />
            <Route
              path="configuracoes"
              element={
                <ProtectedRoute somenteAdmin>
                  <AdminConfiguracoes />
                </ProtectedRoute>
              }
            />
            <Route path="clientes" element={admin('clientes', <AdminClientes />)} />
            <Route path="usuarios" element={admin('usuarios', <AdminUsuarios />)} />
            <Route path="perfis" element={admin('perfis', <AdminPerfis />)} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  );
}
