import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, ImagePlus, MessageCircle, Send, X, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { useChat } from '../../hooks/useChat';
import { aplicarVariaveis, conversaFinalizada, validarImagem } from '../../services/mensagens';
import { formatarData } from '../../utils/format';
import MessageBubble from './MessageBubble';
import Spinner from '../Spinner';
import EmptyState from '../EmptyState';

/**
 * Janela de chat reutilizada pelo cliente e pela equipe.
 *  perspectiva: 'cliente' | 'equipe'
 *  nomeCliente: exibido para a equipe nas mensagens do cliente (e usado em {nome})
 *  acoesExtras: elementos extras no cabeçalho (ex.: Finalizar, Enviar Pix)
 *  registrarEnvio: recebe a função `enviar` (usado para enviar Pix de fora)
 *  respostasRapidas: [{ id, titulo, texto }] — atalho "/" ou botão de raio
 *  aoMudarFinalizada: avisa o pai quando a conversa é finalizada/reaberta
 */
export default function ChatWindow({
  clienteId,
  pedidoId = null,
  perspectiva = 'cliente',
  titulo = 'Chat',
  subtitulo,
  nomeCliente = 'Cliente',
  podeEnviar = true,
  acoesExtras,
  registrarEnvio,
  respostasRapidas = [],
  aoMudarFinalizada,
}) {
  const { mensagens, carregando, enviando, erro, enviar } = useChat({ clienteId, pedidoId, perspectiva });
  const [texto, setTexto] = useState('');
  const [arquivo, setArquivo] = useState(null);
  const [preview, setPreview] = useState(null);
  const [rapidasAbertas, setRapidasAbertas] = useState(false);
  const listaRef = useRef(null);
  const inputArquivoRef = useRef(null);
  const textoRef = useRef(null);

  const finalizada = useMemo(() => conversaFinalizada(mensagens), [mensagens]);

  useEffect(() => {
    registrarEnvio?.(enviar);
  }, [registrarEnvio, enviar]);

  useEffect(() => {
    if (!carregando) aoMudarFinalizada?.(finalizada);
  }, [finalizada, carregando, aoMudarFinalizada]);

  // rola apenas a área de mensagens (não a página inteira)
  const rolarParaFim = useCallback((suave = true) => {
    const lista = listaRef.current;
    if (lista) lista.scrollTo({ top: lista.scrollHeight, behavior: suave ? 'smooth' : 'auto' });
  }, []);

  useEffect(() => {
    rolarParaFim(!carregando);
  }, [mensagens.length, carregando, rolarParaFim]);

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  // Respostas rápidas: abre pelo botão ou digitando "/" no início
  const termoRapido = texto.startsWith('/') ? texto.slice(1).toLowerCase() : '';
  const mostrarRapidas = respostasRapidas.length > 0 && (rapidasAbertas || texto.startsWith('/'));
  const rapidasFiltradas = respostasRapidas.filter(
    (r) => !termoRapido || r.titulo.toLowerCase().includes(termoRapido) || r.texto.toLowerCase().includes(termoRapido),
  );

  const usarRapida = (r) => {
    setTexto(aplicarVariaveis(r.texto, { nome: nomeCliente }));
    setRapidasAbertas(false);
    textoRef.current?.focus();
  };

  const escolherArquivo = (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const msgErro = validarImagem(f);
    if (msgErro) {
      toast.error(msgErro);
      return;
    }
    setArquivo(f);
    setPreview(URL.createObjectURL(f));
  };

  const removerArquivo = () => {
    setArquivo(null);
    setPreview(null);
  };

  const submeter = async (e) => {
    e?.preventDefault();
    if (enviando || (!texto.trim() && !arquivo)) return;
    const ok = await enviar({ texto, arquivo });
    if (ok) {
      setTexto('');
      removerArquivo();
    }
  };

  const aoTeclar = (e) => {
    if (e.key === 'Escape' && mostrarRapidas) {
      setRapidasAbertas(false);
      if (texto.startsWith('/')) setTexto('');
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (mostrarRapidas && rapidasFiltradas.length && texto.startsWith('/')) {
        usarRapida(rapidasFiltradas[0]);
        return;
      }
      submeter();
    }
  };

  const nomeDe = (m) => {
    if (perspectiva === 'cliente') return 'Equipe Nasci Imports';
    return m.remetente_equipe ? 'Equipe' : nomeCliente;
  };

  const ehMinha = (m) => (perspectiva === 'cliente' ? !m.remetente_equipe : m.remetente_equipe);

  return (
    <section className={`chat ${finalizada ? 'chat--finalizado' : ''}`} aria-label={titulo}>
      <header className="chat__header">
        <div className="chat__identidade">
          <h3 className="chat__titulo">
            <MessageCircle size={18} aria-hidden="true" /> {titulo}
          </h3>
          {subtitulo && <p className="chat__subtitulo">{subtitulo}</p>}
        </div>
        {acoesExtras && <div className="chat__acoes">{acoesExtras}</div>}
      </header>

      <div className="chat__mensagens" ref={listaRef} aria-live="polite">
        {carregando ? (
          <div className="centralizado">
            <Spinner />
          </div>
        ) : erro ? (
          <p className="texto-erro centralizado">{erro}</p>
        ) : mensagens.length === 0 ? (
          <EmptyState
            icone={MessageCircle}
            titulo="Nenhuma mensagem ainda"
            descricao={
              perspectiva === 'cliente'
                ? 'Envie uma mensagem para combinar o pagamento ou tirar dúvidas.'
                : 'Inicie a conversa com o cliente.'
            }
          />
        ) : (
          mensagens.map((m, i) => {
            const dia = formatarData(m.created_at);
            const mostrarData = i === 0 || dia !== formatarData(mensagens[i - 1].created_at);
            return (
              <Fragment key={m.id}>
                {mostrarData && <div className="chat__data">{dia}</div>}
                <MessageBubble
                  mensagem={m}
                  minha={ehMinha(m)}
                  nomeRemetente={nomeDe(m)}
                  aoCarregarImagem={() => rolarParaFim(false)}
                />
              </Fragment>
            );
          })
        )}
      </div>

      {finalizada && (
        <div className="chat__aviso-finalizado" role="status">
          <CheckCircle2 size={16} aria-hidden="true" />
          {perspectiva === 'cliente'
            ? 'Este atendimento foi finalizado. Precisa de algo mais? É só enviar uma nova mensagem.'
            : 'Atendimento finalizado. Enviar uma mensagem reabre a conversa.'}
        </div>
      )}

      {podeEnviar ? (
        <form className="chat__composer" onSubmit={submeter}>
          {mostrarRapidas && (
            <div className="rapidas" role="listbox" aria-label="Respostas rápidas">
              <div className="rapidas__topo">
                <span>
                  <Zap size={14} aria-hidden="true" /> Respostas rápidas
                </span>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => {
                    setRapidasAbertas(false);
                    if (texto.startsWith('/')) setTexto('');
                  }}
                  aria-label="Fechar respostas rápidas"
                >
                  <X size={14} />
                </button>
              </div>
              {rapidasFiltradas.length === 0 ? (
                <p className="rapidas__vazio">Nenhuma resposta encontrada.</p>
              ) : (
                <ul>
                  {rapidasFiltradas.map((r) => (
                    <li key={r.id}>
                      <button type="button" className="rapidas__item" onClick={() => usarRapida(r)} role="option" aria-selected="false">
                        <strong>{r.titulo}</strong>
                        <span>{aplicarVariaveis(r.texto, { nome: nomeCliente })}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {preview && (
            <div className="chat__preview">
              <img src={preview} alt="Pré-visualização da imagem selecionada" />
              <button type="button" className="icon-btn" onClick={removerArquivo} aria-label="Remover imagem">
                <X size={16} />
              </button>
            </div>
          )}
          <div className="chat__linha">
            <input
              ref={inputArquivoRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={escolherArquivo}
              hidden
            />
            <button
              type="button"
              className="icon-btn"
              onClick={() => inputArquivoRef.current?.click()}
              aria-label="Anexar imagem (ex.: comprovante Pix)"
              title="Anexar imagem"
              disabled={enviando}
            >
              <ImagePlus size={22} />
            </button>
            {respostasRapidas.length > 0 && (
              <button
                type="button"
                className={`icon-btn ${mostrarRapidas ? 'is-ativo' : ''}`}
                onClick={() => setRapidasAbertas((v) => !v)}
                aria-label="Respostas rápidas"
                aria-expanded={mostrarRapidas}
                title="Respostas rápidas (ou digite /)"
                disabled={enviando}
              >
                <Zap size={20} />
              </button>
            )}
            <label htmlFor={`chat-texto-${clienteId}-${pedidoId || 'geral'}`} className="sr-only">
              Mensagem
            </label>
            <textarea
              ref={textoRef}
              id={`chat-texto-${clienteId}-${pedidoId || 'geral'}`}
              className="input chat__input"
              rows={1}
              placeholder={respostasRapidas.length ? 'Digite sua mensagem ou / para respostas rápidas' : 'Digite sua mensagem...'}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={aoTeclar}
              maxLength={4000}
              disabled={enviando}
            />
            <button
              type="submit"
              className="btn btn--primary chat__enviar"
              disabled={enviando || (!texto.trim() && !arquivo)}
              aria-label="Enviar mensagem"
            >
              {enviando ? <Spinner tamanho="sm" /> : <Send size={18} />}
            </button>
          </div>
        </form>
      ) : (
        <p className="chat__somente-leitura">Você não tem permissão para responder nesta conversa.</p>
      )}
    </section>
  );
}
