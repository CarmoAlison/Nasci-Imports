import { supabase } from './supabase';
import { unwrap } from '../utils/errors';

export const TIPOS_CHAVE_PIX = [
  { valor: 'cpf', rotulo: 'CPF' },
  { valor: 'cnpj', rotulo: 'CNPJ' },
  { valor: 'email', rotulo: 'E-mail' },
  { valor: 'telefone', rotulo: 'Telefone' },
  { valor: 'aleatoria', rotulo: 'Chave aleatória' },
];

export const MENSAGEM_PIX_PADRAO =
  'Olá, {nome}! Segue o Pix do pedido {pedido} no valor de {valor}. Depois de pagar, é só enviar o comprovante aqui no chat. 😉';

/** Configuração cadastrada (ou null se ainda não houver) */
export async function obterConfigPix() {
  return unwrap(await supabase.from('config_pix').select('*').maybeSingle());
}

export async function salvarConfigPix({ tipoChave, chave, nomeRecebedor, cidade, mensagem }) {
  return unwrap(
    await supabase.rpc('salvar_config_pix', {
      p_tipo_chave: tipoChave,
      p_chave: chave,
      p_nome_recebedor: nomeRecebedor,
      p_cidade: cidade,
      p_mensagem: mensagem || null,
    }),
  );
}

export async function gerarPixTeste(valor = 1) {
  return unwrap(await supabase.rpc('pix_gerar_teste', { p_valor: valor }));
}

/** Gera o "copia e cola" no banco e envia no chat do pedido. valor nulo = total do pedido */
export async function enviarPixPedido(pedidoId, valor = null) {
  return unwrap(await supabase.rpc('enviar_pix_pedido', { p_pedido_id: pedidoId, p_valor: valor }));
}
