// Constantes de negócio compartilhadas pelo front-end

export const STATUS_PEDIDO = {
  pendente: { label: 'Pendente', classe: 'badge--warning' },
  indo_entrega: { label: 'Indo pra entrega', classe: 'badge--info' },
  enviado: { label: 'Pedido enviado', classe: 'badge--success' },
};

export const ORDEM_STATUS = ['pendente', 'indo_entrega', 'enviado'];

export const MODULOS = [
  { chave: 'dashboard', nome: 'Dashboard' },
  { chave: 'produtos', nome: 'Produtos' },
  { chave: 'categorias', nome: 'Categorias' },
  { chave: 'pedidos', nome: 'Pedidos' },
  { chave: 'chat', nome: 'Chat / Atendimento' },
  { chave: 'estoque', nome: 'Estoque' },
  { chave: 'clientes', nome: 'Clientes' },
  { chave: 'usuarios', nome: 'Usuários internos' },
  { chave: 'perfis', nome: 'Perfis de acesso' },
  { chave: 'relatorios', nome: 'Relatórios' },
];

export const ACOES_BASICAS = [
  { chave: 'ver', nome: 'Ver' },
  { chave: 'criar', nome: 'Criar' },
  { chave: 'editar', nome: 'Editar' },
  { chave: 'excluir', nome: 'Excluir' },
];

export const PERMISSOES_EXTRAS = [
  { modulo: 'pedidos', acao: 'alterar_status', nome: 'Alterar status do pedido' },
  { modulo: 'pedidos', acao: 'enviar_pix', nome: 'Enviar código Pix' },
  { modulo: 'estoque', acao: 'movimentar', nome: 'Dar baixa / entrada no estoque' },
  { modulo: 'dashboard', acao: 'ver_faturamento', nome: 'Ver faturamento' },
  { modulo: 'clientes', acao: 'ver_cpf', nome: 'Ver dados pessoais (CPF) dos clientes' },
];

export const ORDENACOES = [
  { valor: 'recentes', nome: 'Mais recentes' },
  { valor: 'menor_preco', nome: 'Menor preço' },
  { valor: 'maior_preco', nome: 'Maior preço' },
];

export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

export const PRODUTOS_POR_PAGINA = 12;
export const CARRINHO_STORAGE_KEY = 'nasci_carrinho';
export const TAMANHO_MAX_IMAGEM = 5 * 1024 * 1024; // 5 MB
export const TIPOS_IMAGEM = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
