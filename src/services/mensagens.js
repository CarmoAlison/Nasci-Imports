import { supabase } from './supabase';
import { unwrap } from '../utils/errors';
import { TAMANHO_MAX_IMAGEM, TIPOS_IMAGEM } from '../utils/constants';

const CAMPOS = 'id, cliente_id, pedido_id, remetente_id, remetente_equipe, texto, imagem_url, tipo, evento, lida, created_at';

export async function listarMensagens(clienteId, pedidoId) {
  let q = supabase.from('mensagens').select(CAMPOS).eq('cliente_id', clienteId);
  q = pedidoId ? q.eq('pedido_id', pedidoId) : q.is('pedido_id', null);
  const dados = unwrap(await q.order('created_at', { ascending: false }).limit(300));
  return (dados || []).reverse();
}

export function validarImagem(arquivo) {
  if (!arquivo) return '';
  if (!TIPOS_IMAGEM.includes(arquivo.type)) return 'Envie uma imagem JPG, PNG, WEBP ou GIF.';
  if (arquivo.size > TAMANHO_MAX_IMAGEM) return 'A imagem deve ter no máximo 5 MB.';
  return '';
}

/** Envia imagem para o bucket privado na pasta do cliente e retorna o caminho */
export async function enviarAnexo(clienteId, arquivo) {
  const erro = validarImagem(arquivo);
  if (erro) throw new Error(erro);
  const ext = (arquivo.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${clienteId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from('chat-anexos')
    .upload(path, arquivo, { contentType: arquivo.type });
  if (error) throw error;
  return path;
}

export async function enviarMensagem({ clienteId, pedidoId = null, remetenteId, texto = '', arquivo = null, tipo = 'normal' }) {
  const imagemPath = arquivo ? await enviarAnexo(clienteId, arquivo) : null;
  return unwrap(
    await supabase
      .from('mensagens')
      .insert({
        cliente_id: clienteId,
        pedido_id: pedidoId,
        remetente_id: remetenteId,
        texto: texto.trim() || null,
        imagem_url: imagemPath,
        tipo,
      })
      .select(CAMPOS)
      .single(),
  );
}

export async function marcarLidas(clienteId, pedidoId) {
  const { error } = await supabase.rpc('marcar_mensagens_lidas', {
    p_cliente_id: clienteId,
    p_pedido_id: pedidoId || null,
  });
  if (error) console.warn('Falha ao marcar mensagens como lidas', error);
}

// Cache simples de URLs assinadas (válidas por 1h)
const cacheUrls = new Map();

export async function urlAssinada(path) {
  const emCache = cacheUrls.get(path);
  if (emCache && emCache.expira > Date.now()) return emCache.url;
  const { data, error } = await supabase.storage.from('chat-anexos').createSignedUrl(path, 3600);
  if (error) throw error;
  cacheUrls.set(path, { url: data.signedUrl, expira: Date.now() + 55 * 60 * 1000 });
  return data.signedUrl;
}

// ------------------------------------------------------------ atendimento

export async function adminListarConversas(busca = '') {
  return unwrap(await supabase.rpc('admin_conversas', { p_busca: busca || null }));
}

export async function finalizarConversa(clienteId, pedidoId, mensagem) {
  return unwrap(
    await supabase.rpc('conversa_finalizar', {
      p_cliente_id: clienteId,
      p_pedido_id: pedidoId || null,
      p_mensagem: mensagem?.trim() || null,
    }),
  );
}

export async function reabrirConversa(clienteId, pedidoId) {
  return unwrap(await supabase.rpc('conversa_reabrir', { p_cliente_id: clienteId, p_pedido_id: pedidoId || null }));
}

/** atendenteId nulo = assumir para si */
export async function atribuirConversa(clienteId, pedidoId, atendenteId = null) {
  return unwrap(
    await supabase.rpc('conversa_atribuir', {
      p_cliente_id: clienteId,
      p_pedido_id: pedidoId || null,
      p_atendente_id: atendenteId,
    }),
  );
}

export async function infoClienteConversa(clienteId) {
  return unwrap(await supabase.rpc('admin_conversa_info', { p_cliente_id: clienteId }));
}

export async function listarAtendentes() {
  return unwrap(await supabase.rpc('admin_atendentes'));
}

// ------------------------------------------------------- respostas rápidas

export async function listarRespostasRapidas() {
  return unwrap(
    await supabase.from('respostas_rapidas').select('id, titulo, texto, ordem').order('ordem').order('titulo'),
  );
}

export async function salvarRespostaRapida(id, dados) {
  if (id) return unwrap(await supabase.from('respostas_rapidas').update(dados).eq('id', id).select().single());
  return unwrap(await supabase.from('respostas_rapidas').insert(dados).select().single());
}

export async function excluirRespostaRapida(id) {
  return unwrap(await supabase.from('respostas_rapidas').delete().eq('id', id));
}

/** Substitui variáveis da resposta rápida: {nome} → primeiro nome do cliente */
export function aplicarVariaveis(texto, { nome = '' } = {}) {
  const primeiro = String(nome).trim().split(/\s+/)[0] || '';
  return texto.replace(/\{nome\}/gi, primeiro);
}

/**
 * A conversa está finalizada? Olha a última mensagem relevante:
 * se for o evento "finalizada", sim; qualquer mensagem depois disso reabre.
 */
export function conversaFinalizada(mensagens) {
  for (let i = mensagens.length - 1; i >= 0; i--) {
    const m = mensagens[i];
    if (m.tipo === 'sistema' && m.evento === 'atribuida') continue;
    return m.tipo === 'sistema' && m.evento === 'finalizada';
  }
  return false;
}
