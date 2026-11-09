import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CalendarDays, DollarSign, MessageCircle, RefreshCw, ShoppingBag } from 'lucide-react';
import { usePermission } from '../../hooks/usePermission';
import { useAuth } from '../../hooks/useAuth';
import { resumoDashboard } from '../../services/admin';
import { MENU_ADMIN } from '../../utils/adminMenu';
import Skeleton from '../../components/Skeleton';
import EmptyState from '../../components/EmptyState';
import StatusBadge from '../../components/StatusBadge';
import { ORDEM_STATUS } from '../../utils/constants';
import { formatarMoeda, primeiroNome, tempoRelativo } from '../../utils/format';
import { traduzirErro } from '../../utils/errors';

function Cartao({ icone: Icone, titulo, valor, detalhe, destaque }) {
  return (
    <div className={`stat ${destaque ? 'stat--destaque' : ''}`}>
      <div className="stat__icone" aria-hidden="true">
        <Icone size={20} />
      </div>
      <div>
        <span className="stat__titulo">{titulo}</span>
        <strong className="stat__valor">{valor}</strong>
        {detalhe && <small className="texto-suave">{detalhe}</small>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { pode } = usePermission();
  const { profile } = useAuth();
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const podeVer = pode('dashboard', 'ver');

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      setDados(await resumoDashboard());
    } catch (e) {
      setErro(traduzirErro(e));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (podeVer) carregar();
  }, [podeVer, carregar]);

  // Sem permissão de dashboard: mostra atalhos para os módulos liberados
  if (!podeVer) {
    const atalhos = MENU_ADMIN.filter((m) => !m.somenteAdmin && m.modulo !== 'dashboard' && pode(m.modulo, m.acao || 'ver'));
    return (
      <div className="stack">
        <h1>Olá, {primeiroNome(profile?.nome_completo)}!</h1>
        {atalhos.length === 0 ? (
          <EmptyState titulo="Nenhum módulo liberado" descricao="Peça ao administrador para ajustar seu perfil de acesso." />
        ) : (
          <div className="atalhos">
            {atalhos.map(({ to, label, icone: Icone }) => (
              <Link key={to} to={to} className="categoria-card">
                <Icone size={26} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="stack">
      <div className="pagina-admin__topo">
        <h1>Dashboard</h1>
        <button type="button" className="btn btn--ghost btn--sm" onClick={carregar} disabled={carregando}>
          <RefreshCw size={16} aria-hidden="true" className={carregando ? 'girando' : ''} /> Atualizar
        </button>
      </div>

      {erro && (
        <div className="alerta alerta--erro" role="alert">
          {erro}
        </div>
      )}

      {carregando && !dados ? (
        <div className="stats">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} altura="96px" raio="var(--radius-lg)" />
          ))}
        </div>
      ) : (
        dados && (
          <>
            <div className="stats">
              <Cartao icone={ShoppingBag} titulo="Pedidos hoje" valor={dados.pedidos_hoje} destaque />
              <Cartao icone={CalendarDays} titulo="Pedidos no mês" valor={dados.pedidos_mes} />
              {dados.pode_ver_faturamento && (
                <>
                  <Cartao
                    icone={DollarSign}
                    titulo="Faturamento hoje"
                    valor={formatarMoeda(dados.faturamento_dia)}
                    detalhe="Pedidos em entrega/enviados"
                  />
                  <Cartao
                    icone={DollarSign}
                    titulo="Faturamento no mês"
                    valor={formatarMoeda(dados.faturamento_mes)}
                    detalhe="Pedidos em entrega/enviados"
                  />
                </>
              )}
            </div>

            <div className="dashboard__grid">
              <section className="card">
                <h2 className="card__titulo">Pedidos por status</h2>
                <ul className="status-lista">
                  {ORDEM_STATUS.map((s) => (
                    <li key={s}>
                      <StatusBadge status={s} />
                      <strong>{dados.por_status?.[s] || 0}</strong>
                    </li>
                  ))}
                </ul>
                {pode('pedidos', 'ver') && (
                  <Link to="/admin/pedidos" className="link texto-pequeno">
                    Ver pedidos
                  </Link>
                )}
              </section>

              <section className="card">
                <h2 className="card__titulo">
                  <AlertTriangle size={18} aria-hidden="true" className="texto-aviso" /> Estoque baixo
                </h2>
                {dados.estoque_baixo.length === 0 ? (
                  <p className="texto-suave">Nenhum produto com estoque baixo. 👍</p>
                ) : (
                  <ul className="lista-simples">
                    {dados.estoque_baixo.map((p) => (
                      <li key={p.id}>
                        <span>{p.nome}</span>
                        <span className={`badge ${p.estoque === 0 ? 'badge--danger' : 'badge--warning'}`}>
                          {p.estoque} / mín. {p.estoque_minimo}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {pode('estoque', 'ver') && (
                  <Link to="/admin/estoque" className="link texto-pequeno">
                    Ir para o estoque
                  </Link>
                )}
              </section>

              {pode('chat', 'ver') && (
                <section className="card">
                  <h2 className="card__titulo">
                    <MessageCircle size={18} aria-hidden="true" /> Últimas mensagens
                  </h2>
                  {dados.ultimas_mensagens.length === 0 ? (
                    <p className="texto-suave">Nenhuma mensagem de clientes.</p>
                  ) : (
                    <ul className="lista-simples">
                      {dados.ultimas_mensagens.map((m) => (
                        <li key={m.id}>
                          <Link
                            to={`/admin/chat?cliente=${m.cliente_id}${m.pedido_id ? `&pedido=${m.pedido_id}` : ''}`}
                            className="mensagem-resumo"
                          >
                            <strong>
                              {m.cliente_nome}
                              {m.pedido_numero ? ` · #${m.pedido_numero}` : ''}
                              {!m.lida && <span className="ponto-novo" aria-label="não lida" />}
                            </strong>
                            <span className="texto-suave texto-truncado">{m.texto || (m.tem_imagem ? '📷 Imagem' : '')}</span>
                          </Link>
                          <small className="texto-suave">{tempoRelativo(m.created_at)}</small>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )}
            </div>
          </>
        )
      )}
    </div>
  );
}
