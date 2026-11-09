// Serviços do painel administrativo (dashboard, estoque, clientes, usuários e perfis)
import { supabase } from './supabase';
import { unwrap } from '../utils/errors';

// -------------------------------------------------------------- dashboard
export async function resumoDashboard() {
  return unwrap(await supabase.rpc('dashboard_resumo'));
}

// ---------------------------------------------------------------- estoque
export async function listarEstoque({ busca = '', apenasBaixo = false }) {
  let q = supabase
    .from('produtos')
    .select('id, nome, estoque, estoque_minimo, ativo, categoria:categorias(nome)')
    .order('nome');
  const termo = String(busca).replace(/[,()*%\\]/g, ' ').trim();
  if (termo) q = q.ilike('nome', `%${termo}%`);
  const dados = unwrap(await q);
  return apenasBaixo ? dados.filter((p) => p.estoque <= p.estoque_minimo) : dados;
}

export async function movimentarEstoque({ produtoId, tipo, quantidade, motivo }) {
  return unwrap(
    await supabase.rpc('movimentar_estoque', {
      p_produto_id: produtoId,
      p_tipo: tipo,
      p_quantidade: Number(quantidade),
      p_motivo: motivo,
    }),
  );
}

export async function listarMovimentacoes({ produtoId = null, tipo = null, limite = 50 } = {}) {
  let q = supabase
    .from('estoque_movimentacoes')
    .select('id, tipo, quantidade, motivo, estoque_anterior, estoque_novo, usuario_nome, created_at, produto:produtos(id, nome)')
    .order('created_at', { ascending: false })
    .limit(limite);
  if (produtoId) q = q.eq('produto_id', produtoId);
  if (tipo) q = q.eq('tipo', tipo);
  return unwrap(await q);
}

// --------------------------------------------------------------- clientes
export async function listarClientes({ busca = '', pagina = 1, porPagina = 20 }) {
  const dados = unwrap(
    await supabase.rpc('admin_listar_clientes', {
      p_busca: busca || null,
      p_limite: porPagina,
      p_offset: (pagina - 1) * porPagina,
    }),
  );
  return { clientes: dados || [], total: Number(dados?.[0]?.total_registros || 0) };
}

export async function detalheCliente(id) {
  return unwrap(await supabase.rpc('admin_cliente_detalhe', { p_id: id }));
}

// ------------------------------------------------------- usuários internos
export async function listarUsuariosInternos() {
  return unwrap(
    await supabase
      .from('profiles')
      .select('id, nome_completo, email, username, telefone, role, ativo, created_at, perfil_acesso_id, perfil:perfis_acesso(id, nome)')
      .in('role', ['funcionario', 'admin'])
      .order('role')
      .order('nome_completo'),
  );
}

/** Chama a Edge Function que usa a service_role no servidor */
export async function chamarFuncaoUsuarios(corpo) {
  const { data, error } = await supabase.functions.invoke('criar-usuario-interno', { body: corpo });
  if (error) {
    // Extrai a mensagem enviada pela função (respostas 4xx/5xx)
    let mensagem = error.message;
    try {
      const ctx = await error.context?.json?.();
      if (ctx?.error) mensagem = ctx.error;
    } catch {
      // mantém a mensagem original
    }
    throw new Error(mensagem);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

// -------------------------------------------------------- perfis de acesso
export async function listarPerfisAcesso() {
  return unwrap(await supabase.rpc('listar_perfis_acesso'));
}

export async function salvarPerfilAcesso({ id = null, nome, descricao, permissoes }) {
  return unwrap(
    await supabase.rpc('salvar_perfil_acesso', {
      p_id: id,
      p_nome: nome,
      p_descricao: descricao || null,
      p_permissoes: permissoes,
    }),
  );
}

export async function excluirPerfilAcesso(id) {
  return unwrap(await supabase.from('perfis_acesso').delete().eq('id', id));
}
