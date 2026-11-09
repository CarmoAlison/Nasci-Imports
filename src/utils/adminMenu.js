import {
  ArrowDownCircle,
  ArrowUpCircle,
  Boxes,
  FileBarChart,
  FolderTree,
  LayoutDashboard,
  MessageCircle,
  Package,
  Settings,
  ShieldCheck,
  ShoppingBag,
  UserCog,
  Users,
} from 'lucide-react';

// Itens do menu do painel. Cada um aparece somente com a permissão indicada
// (acao padrão: "ver"). `sub: true` mostra o item recuado, como subitem.
export const MENU_ADMIN = [
  { to: '/admin', label: 'Dashboard', icone: LayoutDashboard, modulo: 'dashboard', end: true },
  { to: '/admin/pedidos', label: 'Pedidos', icone: ShoppingBag, modulo: 'pedidos' },
  { to: '/admin/chat', label: 'Atendimento', icone: MessageCircle, modulo: 'chat' },
  { to: '/admin/produtos', label: 'Produtos', icone: Package, modulo: 'produtos' },
  { to: '/admin/categorias', label: 'Categorias', icone: FolderTree, modulo: 'categorias' },
  { to: '/admin/estoque', label: 'Estoque', icone: Boxes, modulo: 'estoque', end: true },
  { to: '/admin/estoque/entrada', label: 'Entrada', icone: ArrowUpCircle, modulo: 'estoque', acao: 'movimentar', sub: true },
  { to: '/admin/estoque/saida', label: 'Saída', icone: ArrowDownCircle, modulo: 'estoque', acao: 'movimentar', sub: true },
  { to: '/admin/relatorios', label: 'Relatórios', icone: FileBarChart, modulo: 'relatorios' },
  { to: '/admin/clientes', label: 'Clientes', icone: Users, modulo: 'clientes' },
  { to: '/admin/usuarios', label: 'Usuários internos', icone: UserCog, modulo: 'usuarios' },
  { to: '/admin/perfis', label: 'Perfis de acesso', icone: ShieldCheck, modulo: 'perfis' },
  { to: '/admin/configuracoes', label: 'Configurações', icone: Settings, somenteAdmin: true },
];
