import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeftRight,
  CheckCircle2,
  ChevronLeft,
  ExternalLink,
  Info,
  MessageCircle,
  QrCode,
  RotateCcw,
  Search,
  Settings2,
  UserCheck,
  Zap,
} from 'lucide-react';
import toast from 'react-hot-toast';
import ChatWindow from '../../components/chat/ChatWindow';
import ClienteInfo from '../../components/admin/ClienteInfo';
import RespostasRapidasModal from '../../components/admin/RespostasRapidasModal';
import EnviarPixModal from '../../components/admin/EnviarPixModal';
import { buscarPedido } from '../../services/pedidos';
import Modal from '../../components/Modal';
import FormField from '../../components/FormField';
import EmptyState from '../../components/EmptyState';
import Spinner from '../../components/Spinner';
import { LinhasSkeleton } from '../../components/Skeleton';
import { useAuth } from '../../hooks/useAuth';
import { usePermission } from '../../hooks/usePermission';
import { useNotifications } from '../../hooks/useNotifications';
import { useDebounce } from '../../hooks/useDebounce';
import { supabase } from '../../services/supabase';
import {
  adminListarConversas,
  aplicarVariaveis,
  atribuirConversa,
  finalizarConversa,
  listarAtendentes,
  listarRespostasRapidas,
  reabrirConversa,
} from '../../services/mensagens';
import { primeiroNome, tempoRelativo } from '../../utils/format';
import { traduzirErro } from '../../utils/errors';

const chaveDe = (clienteId, pedidoId) => `${clienteId}:${pedidoId || 'geral'}`;

const ABAS = [
  { valor: 'aberta', rotulo: 'Abertas' },
  { valor: 'finalizada', rotulo: 'Finalizadas' },
  { valor: 'todas', rotulo: 'Todas' },
];

const FILTROS = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'nao_lidas', rotulo: 'Não lidas' },
  { valor: 'aguardando', rotulo: 'Aguardando' },
  { valor: 'minhas', rotulo: 'Meus' },
  { valor: 'pedidos', rotulo: 'Pedidos' },
  { valor: 'geral', rotulo: 'Geral' },
];

const MENSAGEM_ENCERRAMENTO = 'Obrigado pelo contato, {nome}! Se precisar de algo, é só chamar. 💚';

function iniciais(nome) {
  const partes = String(nome || '?').trim().split(/\s+/);
  return ((partes[0]?.[0] || '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
}

const aguardando = (c) => c.status === 'aberta' && c.ultima_mensagem && !c.ultima_da_equipe;

export default function Chat() {
  const { user } = useAuth();
  const { pode } = usePermission();
  const { marcarLidasPorLink } = useNotifications();
  const [params, setParams] = useSearchParams();

  const [conversas, setConversas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [aba, setAba] = useState('aberta');
  const [filtro, setFiltro] = useState('todos');
  const buscaDebounced = useDebounce(busca);

  const [respostas, setRespostas] = useState([]);
  const [modalRespostas, setModalRespostas] = useState(false);
  const [modalFinalizar, setModalFinalizar] = useState(false);
  const [mensagemFinal, setMensagemFinal] = useState('');
  const [modalTransferir, setModalTransferir] = useState(false);
  const [atendentes, setAtendentes] = useState([]);
  const [destino, setDestino] = useState('');
  const [modalInfo, setModalInfo] = useState(false);
  const [processando, setProcessando] = useState(null); // nome da ação em andamento
  const [pixPedido, setPixPedido] = useState(null); // pedido aberto no modal de Pix
  const enviarRef = useRef(null);
  const [finalizadaChat, setFinalizadaChat] = useState({ chave: null, valor: false });

  const clienteSel = params.get('cliente');
  const pedidoSel = params.get('pedido');
  const chaveSel = clienteSel ? chaveDe(clienteSel, pedidoSel) : null;
  const podeResponder = pode('chat', 'criar');

  // ------------------------------------------------------------ dados
  const carregar = useCallback(async () => {
    try {
      setConversas(await adminListarConversas(buscaDebounced));
    } catch (e) {
      toast.error(traduzirErro(e));
    } finally {
      setCarregando(false);
    }
  }, [buscaDebounced]);

  const carregarRespostas = useCallback(() => {
    listarRespostasRapidas()
      .then(setRespostas)
      .catch(() => {});
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    carregarRespostas();
  }, [carregarRespostas]);

  // Lista sempre atualizada: qualquer mensagem nova (ou evento) recarrega
  useEffect(() => {
    let timer;
    const canal = supabase
      .channel('admin-conversas')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mensagens' }, () => {
        clearTimeout(timer);
        timer = setTimeout(carregar, 400);
      })
      .subscribe();
    return () => {
      clearTimeout(timer);
      supabase.removeChannel(canal);
    };
  }, [carregar]);

  useEffect(() => {
    if (clienteSel) marcarLidasPorLink(`/admin/chat?cliente=${clienteSel}${pedidoSel ? `&pedido=${pedidoSel}` : ''}`);
  }, [clienteSel, pedidoSel, marcarLidasPorLink]);

  // ------------------------------------------------------------ derivados
  const contagem = useMemo(
    () => ({
      aberta: conversas.filter((c) => c.status === 'aberta').length,
      finalizada: conversas.filter((c) => c.status === 'finalizada').length,
      todas: conversas.length,
      naoLidas: conversas.reduce((s, c) => s + Number(c.nao_lidas || 0), 0),
      aguardando: conversas.filter(aguardando).length,
    }),
    [conversas],
  );

  // contador de não lidas no título da aba do navegador
  useEffect(() => {
    const original = document.title;
    document.title = contagem.naoLidas > 0 ? `(${contagem.naoLidas}) Atendimento — Nasci Imports` : 'Atendimento — Nasci Imports';
    return () => {
      document.title = original;
    };
  }, [contagem.naoLidas]);

  const filtradas = useMemo(
    () =>
      conversas.filter((c) => {
        if (aba !== 'todas' && c.status !== aba) return false;
        if (filtro === 'nao_lidas') return c.nao_lidas > 0;
        if (filtro === 'aguardando') return aguardando(c);
        if (filtro === 'minhas') return c.atendente_id === user.id;
        if (filtro === 'pedidos') return Boolean(c.pedido_id);
        if (filtro === 'geral') return !c.pedido_id;
        return true;
      }),
    [conversas, aba, filtro, user.id],
  );

  const selecionada = conversas.find((c) => chaveDe(c.cliente_id, c.pedido_id) === chaveSel);
  const nomeSelecionado = selecionada?.cliente_nome || 'Cliente';
  const finalizada =
    finalizadaChat.chave === chaveSel ? finalizadaChat.valor : selecionada?.status === 'finalizada';
  const souAtendente = selecionada?.atendente_id === user.id;

  const registrarEnvio = useCallback((fn) => {
    enviarRef.current = fn;
  }, []);

  // Pix: busca o total do pedido e abre o modal de envio automático
  const abrirPix = async () => {
    setProcessando('pix');
    try {
      const p = await buscarPedido(pedidoSel);
      if (!p) throw new Error('Pedido não encontrado.');
      setPixPedido(p);
    } catch (e) {
      toast.error(traduzirErro(e));
    } finally {
      setProcessando(null);
    }
  };

  const aoMudarFinalizada = useCallback(
    (valor) => setFinalizadaChat({ chave: chaveSel, valor }),
    [chaveSel],
  );

  // ------------------------------------------------------------ ações
  const abrir = (c) => {
    const p = new URLSearchParams({ cliente: c.cliente_id });
    if (c.pedido_id) p.set('pedido', c.pedido_id);
    setParams(p);
  };

  const executar = async (nome, fn, sucesso) => {
    setProcessando(nome);
    try {
      await fn();
      toast.success(sucesso);
      await carregar();
      return true;
    } catch (e) {
      toast.error(traduzirErro(e));
      return false;
    } finally {
      setProcessando(null);
    }
  };

  const abrirFinalizar = () => {
    setMensagemFinal(aplicarVariaveis(MENSAGEM_ENCERRAMENTO, { nome: nomeSelecionado }));
    setModalFinalizar(true);
  };

  const confirmarFinalizar = async (e) => {
    e.preventDefault();
    const ok = await executar(
      'finalizar',
      () => finalizarConversa(clienteSel, pedidoSel, mensagemFinal),
      'Atendimento finalizado.',
    );
    if (ok) setModalFinalizar(false);
  };

  const abrirTransferir = async () => {
    setDestino('');
    setModalTransferir(true);
    try {
      setAtendentes(await listarAtendentes());
    } catch (e) {
      toast.error(traduzirErro(e));
    }
  };

  const confirmarTransferir = async (e) => {
    e.preventDefault();
    if (!destino) {
      toast.error('Escolha para quem transferir.');
      return;
    }
    const nome = atendentes.find((a) => a.id === destino)?.nome_completo;
    const ok = await executar(
      'transferir',
      () => atribuirConversa(clienteSel, pedidoSel, destino),
      `Atendimento transferido para ${primeiroNome(nome)}.`,
    );
    if (ok) setModalTransferir(false);
  };

  // ------------------------------------------------------------ render
  const acoes = clienteSel && (
    <>
      {podeResponder && !souAtendente && !finalizada && (
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => executar('assumir', () => atribuirConversa(clienteSel, pedidoSel), 'Você assumiu o atendimento.')}
          disabled={Boolean(processando)}
          title="Assumir este atendimento"
        >
          {processando === 'assumir' ? <Spinner tamanho="sm" /> : <UserCheck size={16} aria-hidden="true" />}
          <span className="rotulo-acao">Assumir</span>
        </button>
      )}
      {podeResponder && !finalizada && (
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={abrirTransferir}
          disabled={Boolean(processando)}
          title="Transferir para outro atendente"
        >
          <ArrowLeftRight size={16} aria-hidden="true" />
          <span className="rotulo-acao">Transferir</span>
        </button>
      )}
      {pedidoSel && pode('pedidos', 'enviar_pix') && (
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={abrirPix}
          disabled={Boolean(processando)}
          title="Enviar Pix do pedido"
        >
          {processando === 'pix' ? <Spinner tamanho="sm" /> : <QrCode size={16} aria-hidden="true" />}
          <span className="rotulo-acao">Pix</span>
        </button>
      )}
      {pedidoSel && pode('pedidos', 'ver') && (
        <Link to={`/admin/pedidos/${pedidoSel}`} className="btn btn--ghost btn--sm" title="Abrir pedido">
          <ExternalLink size={16} aria-hidden="true" />
          <span className="rotulo-acao">Pedido</span>
        </Link>
      )}
      <button
        type="button"
        className="btn btn--ghost btn--sm atendimento__btn-info"
        onClick={() => setModalInfo(true)}
        title="Dados do cliente"
      >
        <Info size={16} aria-hidden="true" />
        <span className="rotulo-acao">Cliente</span>
      </button>
      {podeResponder &&
        (finalizada ? (
          <button
            type="button"
            className="btn btn--outline btn--sm"
            onClick={() => executar('reabrir', () => reabrirConversa(clienteSel, pedidoSel), 'Atendimento reaberto.')}
            disabled={Boolean(processando)}
          >
            {processando === 'reabrir' ? <Spinner tamanho="sm" /> : <RotateCcw size={16} aria-hidden="true" />}
            <span className="rotulo-acao">Reabrir</span>
          </button>
        ) : (
          <button type="button" className="btn btn--primary btn--sm" onClick={abrirFinalizar} disabled={Boolean(processando)}>
            <CheckCircle2 size={16} aria-hidden="true" />
            <span className="rotulo-acao">Finalizar</span>
          </button>
        ))}
    </>
  );

  const subtitulo = [
    selecionada?.pedido_numero ? `Pedido #${selecionada.pedido_numero}` : 'Atendimento geral',
    selecionada?.atendente_nome ? `Atendente: ${primeiroNome(selecionada.atendente_nome)}` : 'Sem atendente',
  ].join(' · ');

  return (
    <div className="stack">
      <div className="pagina-admin__topo">
        <div>
          <h1>Atendimento</h1>
          <p className="texto-suave texto-pequeno">
            {contagem.aberta} aberto(s) · {contagem.aguardando} aguardando resposta · {contagem.naoLidas} não lida(s)
          </p>
        </div>
        {podeResponder && (
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setModalRespostas(true)}>
            <Settings2 size={16} aria-hidden="true" /> Respostas rápidas
          </button>
        )}
      </div>

      <div className={`atendimento ${clienteSel ? 'tem-selecao' : ''}`}>
        {/* ---------------- Lista de conversas ---------------- */}
        <aside className="atendimento__lista card">
          <div className="abas" role="tablist" aria-label="Situação do atendimento">
            {ABAS.map((a) => (
              <button
                key={a.valor}
                type="button"
                role="tab"
                aria-selected={aba === a.valor}
                className={`abas__item ${aba === a.valor ? 'is-ativa' : ''}`}
                onClick={() => setAba(a.valor)}
              >
                {a.rotulo}
                <span className="abas__contador">{contagem[a.valor]}</span>
              </button>
            ))}
          </div>

          <div className="input-icone">
            <Search size={18} aria-hidden="true" />
            <label htmlFor="busca-conversa" className="sr-only">
              Buscar conversa
            </label>
            <input
              id="busca-conversa"
              className="input"
              type="search"
              placeholder="Cliente, e-mail ou nº do pedido"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>

          <div className="chips" role="group" aria-label="Filtrar conversas">
            {FILTROS.map((f) => (
              <button
                key={f.valor}
                type="button"
                className={`chip ${filtro === f.valor ? 'is-ativo' : ''}`}
                onClick={() => setFiltro(f.valor)}
                aria-pressed={filtro === f.valor}
              >
                {f.rotulo}
              </button>
            ))}
          </div>

          {carregando ? (
            <LinhasSkeleton linhas={6} />
          ) : filtradas.length === 0 ? (
            <div className="atendimento__vazio">
              <MessageCircle size={28} aria-hidden="true" />
              <p>{aba === 'aberta' ? 'Nenhum atendimento aberto. Tudo em dia! 🎉' : 'Nenhuma conversa encontrada.'}</p>
            </div>
          ) : (
            <ul className="conversas">
              {filtradas.map((c) => {
                const chave = chaveDe(c.cliente_id, c.pedido_id);
                const espera = aguardando(c);
                return (
                  <li key={chave}>
                    <button
                      type="button"
                      className={`conversa ${chave === chaveSel ? 'is-ativa' : ''} ${c.status === 'finalizada' ? 'is-finalizada' : ''}`}
                      onClick={() => abrir(c)}
                    >
                      <span className={`avatar ${espera ? 'avatar--alerta' : ''}`} aria-hidden="true">
                        {iniciais(c.cliente_nome)}
                      </span>
                      <span className="conversa__corpo">
                        <span className="conversa__topo">
                          <strong className="texto-truncado">{c.cliente_nome}</strong>
                          <small className="texto-suave">{tempoRelativo(c.ultima_data)}</small>
                        </span>
                        <span className="conversa__previa texto-truncado">
                          {c.ultima_da_equipe && <span className="conversa__autor">Equipe: </span>}
                          {c.ultima_mensagem || 'Sem mensagens'}
                        </span>
                        <span className="conversa__meta">
                          <span className="badge badge--muted">{c.pedido_numero ? `#${c.pedido_numero}` : 'Geral'}</span>
                          {c.status === 'finalizada' ? (
                            <span className="badge badge--muted">
                              <CheckCircle2 size={11} aria-hidden="true" /> Finalizada
                            </span>
                          ) : espera ? (
                            <span className="badge badge--warning">Aguardando</span>
                          ) : null}
                          {c.atendente_nome && (
                            <span className="conversa__atendente" title={`Atendente: ${c.atendente_nome}`}>
                              <UserCheck size={11} aria-hidden="true" />
                              {c.atendente_id === user.id ? 'Você' : primeiroNome(c.atendente_nome)}
                            </span>
                          )}
                          {c.nao_lidas > 0 && <span className="contador contador--inline">{c.nao_lidas}</span>}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        {/* ---------------- Chat ---------------- */}
        <div className="atendimento__chat">
          {clienteSel ? (
            <>
              <button
                type="button"
                className="btn btn--ghost btn--sm atendimento__voltar"
                onClick={() => setParams({})}
              >
                <ChevronLeft size={16} aria-hidden="true" /> Conversas
              </button>
              <ChatWindow
                key={chaveSel}
                clienteId={clienteSel}
                pedidoId={pedidoSel || null}
                perspectiva="equipe"
                titulo={nomeSelecionado}
                subtitulo={subtitulo}
                nomeCliente={nomeSelecionado}
                podeEnviar={podeResponder}
                acoesExtras={acoes}
                respostasRapidas={podeResponder ? respostas : []}
                aoMudarFinalizada={aoMudarFinalizada}
                registrarEnvio={registrarEnvio}
              />
            </>
          ) : (
            <div className="card atendimento__placeholder">
              <EmptyState
                icone={MessageCircle}
                titulo="Selecione uma conversa"
                descricao="As mensagens dos clientes aparecem aqui em tempo real."
              />
              {podeResponder && (
                <p className="texto-suave texto-pequeno centralizado">
                  <Zap size={14} aria-hidden="true" /> Dica: no chat, digite <code>/</code> para usar respostas rápidas.
                </p>
              )}
            </div>
          )}
        </div>

        {/* ---------------- Dados do cliente (telas largas) ---------------- */}
        {clienteSel && (
          <aside className="atendimento__info card" aria-label="Dados do cliente">
            <h2 className="card__titulo">Cliente</h2>
            <ClienteInfo clienteId={clienteSel} pedidoAtualId={pedidoSel} />
          </aside>
        )}
      </div>

      {/* ---------------- Modais ---------------- */}
      <Modal aberto={modalInfo} aoFechar={() => setModalInfo(false)} titulo="Dados do cliente" tamanho="sm">
        {clienteSel && <ClienteInfo clienteId={clienteSel} pedidoAtualId={pedidoSel} />}
      </Modal>

      <Modal
        aberto={modalFinalizar}
        aoFechar={() => processando !== 'finalizar' && setModalFinalizar(false)}
        titulo="Finalizar atendimento"
        tamanho="sm"
      >
        <form onSubmit={confirmarFinalizar} className="stack">
          <p className="texto-suave texto-pequeno">
            A conversa vai para “Finalizadas”. Se o cliente escrever de novo, ela reabre automaticamente.
          </p>
          <FormField
            as="textarea"
            label="Mensagem de encerramento (opcional)"
            rows={3}
            maxLength={2000}
            value={mensagemFinal}
            onChange={(e) => setMensagemFinal(e.target.value)}
            ajuda="Deixe em branco para finalizar sem enviar mensagem."
          />
          <div className="modal__acoes">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setModalFinalizar(false)}
              disabled={processando === 'finalizar'}
            >
              Cancelar
            </button>
            <button type="submit" className="btn btn--primary" disabled={processando === 'finalizar'}>
              {processando === 'finalizar' ? <Spinner tamanho="sm" /> : <CheckCircle2 size={16} aria-hidden="true" />}
              Finalizar
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        aberto={modalTransferir}
        aoFechar={() => processando !== 'transferir' && setModalTransferir(false)}
        titulo="Transferir atendimento"
        tamanho="sm"
      >
        <form onSubmit={confirmarTransferir} className="stack">
          <FormField as="select" label="Transferir para" value={destino} onChange={(e) => setDestino(e.target.value)}>
            <option value="">Selecione...</option>
            {atendentes
              .filter((a) => a.id !== selecionada?.atendente_id)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome_completo}
                  {a.id === user.id ? ' (você)' : ''}
                </option>
              ))}
          </FormField>
          <div className="modal__acoes">
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setModalTransferir(false)}
              disabled={processando === 'transferir'}
            >
              Cancelar
            </button>
            <button type="submit" className="btn btn--primary" disabled={processando === 'transferir'}>
              {processando === 'transferir' && <Spinner tamanho="sm" />}
              Transferir
            </button>
          </div>
        </form>
      </Modal>

      <EnviarPixModal
        aberto={Boolean(pixPedido)}
        aoFechar={() => setPixPedido(null)}
        pedido={pixPedido}
        enviarManual={async (codigo) => Boolean(await enviarRef.current?.({ texto: codigo, tipo: 'pix' }))}
      />

      <RespostasRapidasModal
        aberto={modalRespostas}
        aoFechar={() => setModalRespostas(false)}
        respostas={respostas}
        aoAlterar={carregarRespostas}
      />
    </div>
  );
}
