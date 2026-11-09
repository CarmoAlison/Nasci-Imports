// Definição dos relatórios: consulta, colunas, resumo e filtros.
// A mesma definição alimenta a tela, o PDF e o Excel.
import { supabase } from './supabase';
import { unwrap } from '../utils/errors';
import { STATUS_PEDIDO } from '../utils/constants';
import { formatarData, formatarDataHora, formatarMoeda } from '../utils/format';
import { mascaraTelefone } from '../utils/masks';

// ------------------------------------------------------------- período

export const PERIODOS = [
  { valor: 'hoje', rotulo: 'Hoje' },
  { valor: '7d', rotulo: 'Últimos 7 dias' },
  { valor: '30d', rotulo: 'Últimos 30 dias' },
  { valor: 'mes', rotulo: 'Este mês' },
  { valor: 'mes_anterior', rotulo: 'Mês passado' },
  { valor: 'ano', rotulo: 'Este ano' },
  { valor: 'personalizado', rotulo: 'Personalizado' },
];

const paraInput = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Datas (yyyy-mm-dd) de início e fim (inclusivo) de um período pré-definido */
export function datasDoPeriodo(periodo) {
  const hoje = new Date();
  const y = hoje.getFullYear();
  const m = hoje.getMonth();
  const menos = (dias) => new Date(y, m, hoje.getDate() - dias);
  switch (periodo) {
    case 'hoje':
      return { inicio: paraInput(hoje), fim: paraInput(hoje) };
    case '7d':
      return { inicio: paraInput(menos(6)), fim: paraInput(hoje) };
    case '30d':
      return { inicio: paraInput(menos(29)), fim: paraInput(hoje) };
    case 'mes_anterior':
      return { inicio: paraInput(new Date(y, m - 1, 1)), fim: paraInput(new Date(y, m, 0)) };
    case 'ano':
      return { inicio: paraInput(new Date(y, 0, 1)), fim: paraInput(hoje) };
    case 'mes':
    default:
      return { inicio: paraInput(new Date(y, m, 1)), fim: paraInput(hoje) };
  }
}

/** Converte as datas locais em intervalo [início, fim) para o banco */
function intervalo({ inicio, fim }) {
  const de = new Date(`${inicio}T00:00:00`);
  const ate = new Date(`${fim}T00:00:00`);
  ate.setDate(ate.getDate() + 1);
  return { p_inicio: de.toISOString(), p_fim: ate.toISOString() };
}

export function descreverPeriodo({ inicio, fim }) {
  const a = formatarData(`${inicio}T12:00:00`);
  const b = formatarData(`${fim}T12:00:00`);
  return a === b ? a : `${a} a ${b}`;
}

// ------------------------------------------------------- formatação

const SITUACAO = { ok: 'OK', baixo: 'Estoque baixo', esgotado: 'Esgotado' };
const TIPO_MOV = { entrada: 'Entrada', saida: 'Saída' };

/** Texto exibido para um valor, conforme o tipo da coluna (tela e PDF) */
export function formatarCelula(valor, tipo) {
  if (valor === null || valor === undefined || valor === '') return '—';
  switch (tipo) {
    case 'moeda':
      return formatarMoeda(valor);
    case 'inteiro':
      return Number(valor).toLocaleString('pt-BR');
    case 'data':
      return formatarData(valor);
    case 'datahora':
      return formatarDataHora(valor);
    case 'status':
      return STATUS_PEDIDO[valor]?.label || valor;
    case 'situacao':
      return SITUACAO[valor] || valor;
    case 'tipoMov':
      return TIPO_MOV[valor] || valor;
    case 'telefone':
      return mascaraTelefone(valor);
    case 'pedido':
      return `#${valor}`;
    case 'simnao':
      return valor ? 'Sim' : 'Não';
    default:
      return String(valor);
  }
}

/** Tom de cor de uma célula (verde/amarelo/vermelho/azul), usado na tela, no PDF e no Excel */
export function tomCelula(valor, tipo) {
  if (tipo === 'status') return { pendente: 'aviso', indo_entrega: 'info', enviado: 'sucesso' }[valor];
  if (tipo === 'situacao') return { ok: 'sucesso', baixo: 'aviso', esgotado: 'perigo' }[valor];
  if (tipo === 'tipoMov') return valor === 'entrada' ? 'sucesso' : 'aviso';
  return undefined;
}

// soma arredondada em centavos (evita 67754.70000000001)
const soma = (linhas, campo) => Math.round(linhas.reduce((s, l) => s + Number(l[campo] || 0), 0) * 100) / 100;

// ------------------------------------------------------- relatórios

const FILTRO_STATUS = {
  chave: 'status',
  rotulo: 'Status do pedido',
  opcoes: [
    { valor: '', rotulo: 'Todos' },
    { valor: 'pagos', rotulo: 'Pagos (em entrega + enviados)' },
    ...Object.entries(STATUS_PEDIDO).map(([valor, s]) => ({ valor, rotulo: s.label })),
  ],
};

export const RELATORIOS = [
  {
    id: 'vendas',
    titulo: 'Vendas',
    descricao: 'Pedidos realizados no período, com cliente, itens, valor e status.',
    usaPeriodo: true,
    filtro: FILTRO_STATUS,
    orientacao: 'landscape',
    colunas: [
      { chave: 'numero', titulo: 'Pedido', tipo: 'pedido', largura: 10 },
      { chave: 'created_at', titulo: 'Data', tipo: 'datahora', largura: 17 },
      { chave: 'cliente_nome', titulo: 'Cliente', largura: 28 },
      { chave: 'cliente_email', titulo: 'E-mail', largura: 30 },
      { chave: 'cliente_telefone', titulo: 'Telefone', tipo: 'telefone', largura: 16 },
      { chave: 'itens', titulo: 'Itens', tipo: 'inteiro', largura: 8, soma: true },
      { chave: 'total', titulo: 'Total', tipo: 'moeda', largura: 15, soma: true },
      { chave: 'status', titulo: 'Status', tipo: 'status', largura: 18 },
    ],
    async carregar({ periodo, filtro }) {
      return unwrap(await supabase.rpc('relatorio_vendas', { ...intervalo(periodo), p_status: filtro || null }));
    },
    resumo(linhas) {
      const pagos = linhas.filter((l) => l.status !== 'pendente');
      const total = soma(linhas, 'total');
      return [
        { rotulo: 'Pedidos', valor: linhas.length, tipo: 'inteiro' },
        { rotulo: 'Valor total', valor: total, tipo: 'moeda', destaque: true },
        { rotulo: 'Faturado (pagos)', valor: soma(pagos, 'total'), tipo: 'moeda' },
        { rotulo: 'Ticket médio', valor: linhas.length ? total / linhas.length : 0, tipo: 'moeda' },
        { rotulo: 'Itens vendidos', valor: soma(linhas, 'itens'), tipo: 'inteiro' },
      ];
    },
  },
  {
    id: 'produtos',
    titulo: 'Produtos mais vendidos',
    descricao: 'Ranking de produtos por quantidade vendida e receita no período.',
    usaPeriodo: true,
    filtro: FILTRO_STATUS,
    orientacao: 'portrait',
    ranking: true,
    colunas: [
      { chave: 'produto_nome', titulo: 'Produto', largura: 40 },
      { chave: 'categoria', titulo: 'Categoria', largura: 18 },
      { chave: 'quantidade', titulo: 'Qtd. vendida', tipo: 'inteiro', largura: 13, soma: true },
      { chave: 'pedidos', titulo: 'Pedidos', tipo: 'inteiro', largura: 10 },
      { chave: 'preco_medio', titulo: 'Preço médio', tipo: 'moeda', largura: 14 },
      { chave: 'receita', titulo: 'Receita', tipo: 'moeda', largura: 16, soma: true },
    ],
    async carregar({ periodo, filtro }) {
      return unwrap(await supabase.rpc('relatorio_produtos_vendidos', { ...intervalo(periodo), p_status: filtro || null }));
    },
    resumo(linhas) {
      return [
        { rotulo: 'Produtos diferentes', valor: linhas.length, tipo: 'inteiro' },
        { rotulo: 'Unidades vendidas', valor: soma(linhas, 'quantidade'), tipo: 'inteiro' },
        { rotulo: 'Receita', valor: soma(linhas, 'receita'), tipo: 'moeda', destaque: true },
        { rotulo: 'Mais vendido', valor: linhas[0]?.produto_nome || '—', tipo: 'texto' },
      ];
    },
  },
  {
    id: 'estoque',
    titulo: 'Posição de estoque',
    descricao: 'Quantidade atual, mínimo e valor parado em estoque de cada produto.',
    usaPeriodo: false,
    filtro: {
      chave: 'situacao',
      rotulo: 'Situação',
      opcoes: [
        { valor: '', rotulo: 'Todos' },
        { valor: 'ok', rotulo: 'OK' },
        { valor: 'baixo', rotulo: 'Estoque baixo' },
        { valor: 'esgotado', rotulo: 'Esgotados' },
      ],
    },
    orientacao: 'landscape',
    colunas: [
      { chave: 'nome', titulo: 'Produto', largura: 40 },
      { chave: 'categoria', titulo: 'Categoria', largura: 18 },
      { chave: 'preco', titulo: 'Preço', tipo: 'moeda', largura: 14 },
      { chave: 'estoque', titulo: 'Estoque', tipo: 'inteiro', largura: 10, soma: true },
      { chave: 'estoque_minimo', titulo: 'Mínimo', tipo: 'inteiro', largura: 10 },
      { chave: 'valor_estoque', titulo: 'Valor em estoque', tipo: 'moeda', largura: 18, soma: true },
      { chave: 'ativo', titulo: 'Ativo', tipo: 'simnao', largura: 8 },
      { chave: 'situacao', titulo: 'Situação', tipo: 'situacao', largura: 15 },
    ],
    async carregar({ filtro }) {
      return unwrap(await supabase.rpc('relatorio_estoque', { p_situacao: filtro || null }));
    },
    resumo(linhas) {
      return [
        { rotulo: 'Produtos', valor: linhas.length, tipo: 'inteiro' },
        { rotulo: 'Unidades', valor: soma(linhas, 'estoque'), tipo: 'inteiro' },
        { rotulo: 'Valor em estoque', valor: soma(linhas, 'valor_estoque'), tipo: 'moeda', destaque: true },
        { rotulo: 'Estoque baixo', valor: linhas.filter((l) => l.situacao === 'baixo').length, tipo: 'inteiro' },
        { rotulo: 'Esgotados', valor: linhas.filter((l) => l.situacao === 'esgotado').length, tipo: 'inteiro' },
      ];
    },
  },
  {
    id: 'movimentacoes',
    titulo: 'Movimentações de estoque',
    descricao: 'Entradas e saídas registradas no período, com motivo e responsável.',
    usaPeriodo: true,
    filtro: {
      chave: 'tipo',
      rotulo: 'Tipo',
      opcoes: [
        { valor: '', rotulo: 'Entradas e saídas' },
        { valor: 'entrada', rotulo: 'Somente entradas' },
        { valor: 'saida', rotulo: 'Somente saídas' },
      ],
    },
    orientacao: 'landscape',
    colunas: [
      { chave: 'created_at', titulo: 'Data', tipo: 'datahora', largura: 17 },
      { chave: 'produto_nome', titulo: 'Produto', largura: 34 },
      { chave: 'tipo', titulo: 'Tipo', tipo: 'tipoMov', largura: 10 },
      { chave: 'quantidade', titulo: 'Qtd.', tipo: 'inteiro', largura: 8 },
      { chave: 'estoque_anterior', titulo: 'Antes', tipo: 'inteiro', largura: 8 },
      { chave: 'estoque_novo', titulo: 'Depois', tipo: 'inteiro', largura: 8 },
      { chave: 'motivo', titulo: 'Motivo', largura: 32 },
      { chave: 'usuario_nome', titulo: 'Usuário', largura: 20 },
    ],
    async carregar({ periodo, filtro }) {
      return unwrap(await supabase.rpc('relatorio_movimentacoes', { ...intervalo(periodo), p_tipo: filtro || null }));
    },
    resumo(linhas) {
      const entradas = linhas.filter((l) => l.tipo === 'entrada');
      const saidas = linhas.filter((l) => l.tipo === 'saida');
      return [
        { rotulo: 'Movimentações', valor: linhas.length, tipo: 'inteiro' },
        { rotulo: 'Unidades que entraram', valor: soma(entradas, 'quantidade'), tipo: 'inteiro', destaque: true },
        { rotulo: 'Unidades que saíram', valor: soma(saidas, 'quantidade'), tipo: 'inteiro' },
        { rotulo: 'Saldo', valor: soma(entradas, 'quantidade') - soma(saidas, 'quantidade'), tipo: 'inteiro' },
      ];
    },
  },
  {
    id: 'clientes',
    titulo: 'Clientes',
    descricao: 'Clientes que compraram no período, com número de pedidos e valor gasto.',
    usaPeriodo: true,
    filtro: FILTRO_STATUS,
    orientacao: 'landscape',
    ranking: true,
    colunas: [
      { chave: 'nome', titulo: 'Cliente', largura: 30 },
      { chave: 'email', titulo: 'E-mail', largura: 32 },
      { chave: 'telefone', titulo: 'Telefone', tipo: 'telefone', largura: 16 },
      { chave: 'cidade', titulo: 'Cidade', largura: 20 },
      { chave: 'pedidos', titulo: 'Pedidos', tipo: 'inteiro', largura: 10, soma: true },
      { chave: 'total', titulo: 'Total gasto', tipo: 'moeda', largura: 16, soma: true },
      { chave: 'ultimo_pedido', titulo: 'Último pedido', tipo: 'data', largura: 14 },
    ],
    async carregar({ periodo, filtro }) {
      return unwrap(await supabase.rpc('relatorio_clientes', { ...intervalo(periodo), p_status: filtro || null }));
    },
    resumo(linhas) {
      const total = soma(linhas, 'total');
      return [
        { rotulo: 'Clientes', valor: linhas.length, tipo: 'inteiro' },
        { rotulo: 'Pedidos', valor: soma(linhas, 'pedidos'), tipo: 'inteiro' },
        { rotulo: 'Total gasto', valor: total, tipo: 'moeda', destaque: true },
        { rotulo: 'Média por cliente', valor: linhas.length ? total / linhas.length : 0, tipo: 'moeda' },
      ];
    },
  },
];

/** Linha de totais (colunas com `soma: true`) */
export function linhaTotais(relatorio, linhas) {
  const totais = {};
  relatorio.colunas.forEach((c) => {
    if (c.soma) totais[c.chave] = soma(linhas, c.chave);
  });
  return totais;
}
