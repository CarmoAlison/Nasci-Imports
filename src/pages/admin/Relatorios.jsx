import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowLeftRight,
  Boxes,
  FileBarChart,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  ShoppingBag,
  Trophy,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import EmptyState from '../../components/EmptyState';
import FormField from '../../components/FormField';
import Spinner from '../../components/Spinner';
import { LinhasSkeleton } from '../../components/Skeleton';
import { useAuth } from '../../hooks/useAuth';
import {
  PERIODOS,
  RELATORIOS,
  datasDoPeriodo,
  descreverPeriodo,
  formatarCelula,
  linhaTotais,
  tomCelula,
} from '../../services/relatorios';
import { traduzirErro } from '../../utils/errors';

const ICONES = {
  vendas: ShoppingBag,
  produtos: Trophy,
  estoque: Boxes,
  movimentacoes: ArrowLeftRight,
  clientes: Users,
};

const CLASSE_TOM = { sucesso: 'badge--success', aviso: 'badge--warning', info: 'badge--info', perigo: 'badge--danger' };
const LIMITE_TELA = 300; // a tela mostra até 300 linhas; a exportação leva todas

const hojeIso = () => new Date().toISOString().slice(0, 10);

export default function Relatorios() {
  const { profile } = useAuth();
  const [params, setParams] = useSearchParams();
  const relatorio = RELATORIOS.find((r) => r.id === params.get('tipo')) || RELATORIOS[0];

  const [periodo, setPeriodo] = useState('mes');
  const [datas, setDatas] = useState(() => datasDoPeriodo('mes'));
  const [filtros, setFiltros] = useState({}); // filtro escolhido por relatório
  const [linhas, setLinhas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [exportando, setExportando] = useState(null); // 'pdf' | 'excel' | null
  const [tentativa, setTentativa] = useState(0);

  const filtro = filtros[relatorio.id] ?? '';
  const datasValidas = Boolean(datas.inicio && datas.fim && datas.inicio <= datas.fim);

  useEffect(() => {
    if (relatorio.usaPeriodo && !datasValidas) return undefined;
    let ativo = true;
    setCarregando(true);
    setErro('');
    relatorio
      .carregar({ periodo: datas, filtro })
      .then((dados) => ativo && setLinhas(dados || []))
      .catch((e) => {
        if (!ativo) return;
        setErro(traduzirErro(e));
        setLinhas([]);
      })
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, [relatorio, datas, filtro, datasValidas, tentativa]);

  const resumo = useMemo(() => relatorio.resumo(linhas), [relatorio, linhas]);
  const totais = useMemo(() => linhaTotais(relatorio, linhas), [relatorio, linhas]);
  const colunas = relatorio.colunas;

  const escolherRelatorio = (id) => setParams({ tipo: id }, { replace: true });

  const mudarPeriodo = (valor) => {
    setPeriodo(valor);
    if (valor !== 'personalizado') setDatas(datasDoPeriodo(valor));
  };

  const infoExportacao = () => {
    const opcao = relatorio.filtro?.opcoes.find((o) => o.valor === filtro);
    return {
      periodo: relatorio.usaPeriodo ? descreverPeriodo(datas) : `Posição em ${descreverPeriodo({ inicio: hojeIso(), fim: hojeIso() })}`,
      filtro: filtro && opcao ? opcao.rotulo : null,
      geradoPor: profile?.nome_completo,
      periodoArquivo: relatorio.usaPeriodo ? `${datas.inicio}_a_${datas.fim}` : hojeIso(),
    };
  };

  const exportar = async (formato) => {
    setExportando(formato);
    try {
      const { exportarExcel, exportarPDF } = await import('../../utils/exportarRelatorio');
      if (formato === 'pdf') await exportarPDF(relatorio, linhas, infoExportacao());
      else await exportarExcel(relatorio, linhas, infoExportacao());
      toast.success(formato === 'pdf' ? 'PDF gerado!' : 'Planilha Excel gerada!');
    } catch (e) {
      console.error(e);
      toast.error(`Não foi possível exportar: ${traduzirErro(e)}`);
    } finally {
      setExportando(null);
    }
  };

  const celula = (linha, coluna) => {
    const valor = linha[coluna.chave];
    const tom = tomCelula(valor, coluna.tipo);
    const texto = formatarCelula(valor, coluna.tipo);
    return tom ? <span className={`badge ${CLASSE_TOM[tom]}`}>{texto}</span> : texto;
  };

  const numerica = (tipo) => ['moeda', 'inteiro', 'pedido'].includes(tipo);
  const visiveis = linhas.slice(0, LIMITE_TELA);

  return (
    <div className="stack">
      <div className="pagina-admin__topo">
        <div>
          <h1 className="titulo-icone">
            <FileBarChart size={28} aria-hidden="true" className="texto-sucesso" /> Relatórios
          </h1>
          <p className="texto-suave texto-pequeno">Escolha o relatório, ajuste os filtros e exporte em PDF ou Excel.</p>
        </div>
      </div>

      {/* Tipos de relatório */}
      <div className="relatorios-tipos" role="tablist" aria-label="Tipo de relatório">
        {RELATORIOS.map((r) => {
          const Icone = ICONES[r.id] || FileBarChart;
          const ativo = r.id === relatorio.id;
          return (
            <button
              key={r.id}
              type="button"
              role="tab"
              aria-selected={ativo}
              className={`relatorio-tipo ${ativo ? 'is-ativo' : ''}`}
              onClick={() => escolherRelatorio(r.id)}
            >
              <Icone size={22} aria-hidden="true" />
              <span>
                <strong>{r.titulo}</strong>
                <small>{r.descricao}</small>
              </span>
            </button>
          );
        })}
      </div>

      {/* Filtros e exportação */}
      <section className="card relatorio-filtros">
        <div className="relatorio-filtros__campos">
          {relatorio.usaPeriodo ? (
            <>
              <FormField as="select" label="Período" value={periodo} onChange={(e) => mudarPeriodo(e.target.value)}>
                {PERIODOS.map((p) => (
                  <option key={p.valor} value={p.valor}>
                    {p.rotulo}
                  </option>
                ))}
              </FormField>
              <FormField
                label="De"
                type="date"
                value={datas.inicio}
                max={datas.fim || undefined}
                onChange={(e) => {
                  setPeriodo('personalizado');
                  setDatas((d) => ({ ...d, inicio: e.target.value }));
                }}
              />
              <FormField
                label="Até"
                type="date"
                value={datas.fim}
                min={datas.inicio || undefined}
                onChange={(e) => {
                  setPeriodo('personalizado');
                  setDatas((d) => ({ ...d, fim: e.target.value }));
                }}
                erro={!datasValidas ? 'Data final antes da inicial.' : undefined}
              />
            </>
          ) : (
            <p className="texto-suave texto-pequeno relatorio-filtros__aviso">
              Mostra a posição atual do estoque (não depende de período).
            </p>
          )}
          {relatorio.filtro && (
            <FormField
              as="select"
              label={relatorio.filtro.rotulo}
              value={filtro}
              onChange={(e) => setFiltros((f) => ({ ...f, [relatorio.id]: e.target.value }))}
            >
              {relatorio.filtro.opcoes.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.rotulo}
                </option>
              ))}
            </FormField>
          )}
        </div>

        <div className="relatorio-filtros__acoes">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => setTentativa((t) => t + 1)}
            disabled={carregando}
            title="Atualizar dados"
          >
            <RefreshCw size={16} aria-hidden="true" className={carregando ? 'girando' : ''} />
            <span className="rotulo-acao-sm">Atualizar</span>
          </button>
          <button
            type="button"
            className="btn btn--pdf"
            onClick={() => exportar('pdf')}
            disabled={carregando || Boolean(exportando) || Boolean(erro)}
          >
            {exportando === 'pdf' ? <Spinner tamanho="sm" /> : <FileText size={18} aria-hidden="true" />}
            Exportar PDF
          </button>
          <button
            type="button"
            className="btn btn--excel"
            onClick={() => exportar('excel')}
            disabled={carregando || Boolean(exportando) || Boolean(erro)}
          >
            {exportando === 'excel' ? <Spinner tamanho="sm" /> : <FileSpreadsheet size={18} aria-hidden="true" />}
            Exportar Excel
          </button>
        </div>
      </section>

      {erro && (
        <div className="alerta alerta--erro" role="alert">
          {erro}
        </div>
      )}

      {/* Resumo */}
      <div className="stats relatorio-resumo">
        {resumo.map((r) => (
          <div key={r.rotulo} className={`stat ${r.destaque ? 'stat--destaque' : ''}`}>
            <div>
              <span className="stat__titulo">{r.rotulo}</span>
              <strong className={`stat__valor ${r.tipo === 'texto' ? 'stat__valor--texto' : ''}`}>
                {carregando ? '—' : formatarCelula(r.valor, r.tipo)}
              </strong>
            </div>
          </div>
        ))}
      </div>

      {/* Prévia da tabela */}
      <section className="card relatorio-tabela">
        <div className="linha-entre relatorio-tabela__topo">
          <h2 className="card__titulo">{relatorio.titulo}</h2>
          {!carregando && (
            <span className="texto-suave texto-pequeno">
              {linhas.length} registro(s)
              {relatorio.usaPeriodo && datasValidas && ` · ${descreverPeriodo(datas)}`}
            </span>
          )}
        </div>

        {carregando ? (
          <LinhasSkeleton linhas={6} />
        ) : linhas.length === 0 ? (
          <EmptyState icone={FileBarChart} titulo="Nada encontrado" descricao="Não há registros para os filtros escolhidos." />
        ) : (
          <>
            <div className="tabela-wrapper">
              <table className="tabela tabela--relatorio">
                <thead>
                  <tr>
                    {relatorio.ranking && <th className="col-num">Pos.</th>}
                    {colunas.map((c) => (
                      <th key={c.chave} className={numerica(c.tipo) ? 'col-num' : ''}>
                        {c.titulo}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map((l, i) => (
                    <tr key={l.id || `${i}-${l[colunas[0].chave]}`}>
                      {relatorio.ranking && (
                        <td data-label="Pos." className={`col-num ${i < 3 ? 'pos-destaque' : ''}`}>
                          {i + 1}º
                        </td>
                      )}
                      {colunas.map((c) => (
                        <td key={c.chave} data-label={c.titulo} className={numerica(c.tipo) ? 'col-num' : ''}>
                          {celula(l, c)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                {Object.keys(totais).length > 0 && (
                  <tfoot>
                    <tr>
                      {relatorio.ranking && <td />}
                      {colunas.map((c, i) => (
                        <td key={c.chave} data-label={c.titulo} className={numerica(c.tipo) ? 'col-num' : ''}>
                          {c.chave in totais
                            ? formatarCelula(totais[c.chave], c.tipo)
                            : i === 0 && !relatorio.ranking
                              ? 'TOTAL'
                              : ''}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            {linhas.length > LIMITE_TELA && (
              <p className="texto-suave texto-pequeno centralizado">
                Mostrando {LIMITE_TELA} de {linhas.length} registros. A exportação em PDF e Excel inclui todos.
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}
