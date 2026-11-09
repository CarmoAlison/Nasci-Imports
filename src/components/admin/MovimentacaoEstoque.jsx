import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowDownCircle, ArrowRight, ArrowUpCircle, Boxes, History } from 'lucide-react';
import toast from 'react-hot-toast';
import FormField from '../FormField';
import Spinner from '../Spinner';
import { LinhasSkeleton } from '../Skeleton';
import ProdutoSelect from './ProdutoSelect';
import TabelaMovimentacoes from './TabelaMovimentacoes';
import { listarEstoque, listarMovimentacoes, movimentarEstoque } from '../../services/admin';
import { traduzirErro } from '../../utils/errors';

const CONFIG = {
  entrada: {
    titulo: 'Entrada de estoque',
    descricao: 'Registre produtos que chegaram (compra, devolução, ajuste).',
    icone: ArrowUpCircle,
    botao: 'Registrar entrada',
    motivos: ['Compra de fornecedor', 'Devolução de cliente', 'Troca', 'Ajuste de inventário'],
    sucesso: 'Entrada registrada',
  },
  saida: {
    titulo: 'Saída de estoque',
    descricao: 'Registre produtos que saíram (venda, avaria, troca, ajuste).',
    icone: ArrowDownCircle,
    botao: 'Registrar saída',
    motivos: ['Venda — pedido #', 'Venda no balcão', 'Avaria / defeito', 'Troca', 'Ajuste de inventário'],
    sucesso: 'Saída registrada',
  },
};

/** Formulário de entrada ou saída de estoque + últimas movimentações do mesmo tipo */
export default function MovimentacaoEstoque({ tipo }) {
  const cfg = CONFIG[tipo];
  const Icone = cfg.icone;
  const [params, setParams] = useSearchParams();

  const [produtos, setProdutos] = useState([]);
  const [historico, setHistorico] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [produtoId, setProdutoId] = useState(params.get('produto') || '');
  const [quantidade, setQuantidade] = useState('');
  const [motivo, setMotivo] = useState('');
  const [erros, setErros] = useState({});
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const [lista, ultimas] = await Promise.all([
        listarEstoque({ busca: '' }),
        listarMovimentacoes({ tipo, limite: 15 }),
      ]);
      setProdutos(lista);
      setHistorico(ultimas);
    } catch (e) {
      toast.error(traduzirErro(e));
    } finally {
      setCarregando(false);
    }
  }, [tipo]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const produto = produtos.find((p) => p.id === produtoId) || null;
  const qtd = parseInt(quantidade, 10) || 0;
  const novoSaldo = produto ? (tipo === 'entrada' ? produto.estoque + qtd : produto.estoque - qtd) : null;

  const escolherProduto = (id) => {
    setProdutoId(id);
    setErros((e) => ({ ...e, produto: '' }));
    // mantém o produto na URL (permite voltar/compartilhar)
    const p = new URLSearchParams(params);
    p.set('produto', id);
    setParams(p, { replace: true });
  };

  const enviar = async (e) => {
    e.preventDefault();
    const novos = {};
    if (!produto) novos.produto = 'Selecione o produto.';
    if (!qtd || qtd <= 0) novos.quantidade = 'Informe uma quantidade maior que zero.';
    else if (tipo === 'saida' && produto && qtd > produto.estoque)
      novos.quantidade = `Só há ${produto.estoque} unidade(s) em estoque.`;
    if (!motivo.trim()) novos.motivo = 'Informe o motivo.';
    setErros(novos);
    if (Object.keys(novos).length) return;

    setSalvando(true);
    try {
      const saldo = await movimentarEstoque({ produtoId: produto.id, tipo, quantidade: qtd, motivo });
      toast.success(`${cfg.sucesso}: ${produto.nome} agora tem ${saldo} unidade(s).`);
      // pronto para o próximo lançamento (mantém o motivo, útil para lançar vários itens de uma compra)
      setQuantidade('');
      setProdutoId('');
      const p = new URLSearchParams(params);
      p.delete('produto');
      setParams(p, { replace: true });
      await carregar();
    } catch (err) {
      toast.error(traduzirErro(err));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="stack">
      <div className="pagina-admin__topo">
        <div>
          <h1 className="titulo-icone">
            <Icone size={28} aria-hidden="true" className={tipo === 'entrada' ? 'texto-sucesso' : 'texto-aviso'} />
            {cfg.titulo}
          </h1>
          <p className="texto-suave texto-pequeno">{cfg.descricao}</p>
        </div>
        <Link to="/admin/estoque" className="btn btn--ghost btn--sm">
          <Boxes size={16} aria-hidden="true" /> Ver estoque
        </Link>
      </div>

      <div className="movimentacao__grid">
        <form className="card stack" onSubmit={enviar} noValidate>
          <ProdutoSelect
            produtos={produtos}
            valor={produtoId}
            aoMudar={escolherProduto}
            erro={erros.produto}
            desabilitarSemEstoque={tipo === 'saida'}
            carregando={carregando}
          />

          <FormField
            label="Quantidade"
            type="number"
            min="1"
            max={tipo === 'saida' && produto ? produto.estoque : undefined}
            inputMode="numeric"
            obrigatorio
            placeholder="0"
            value={quantidade}
            onChange={(e) => {
              setQuantidade(e.target.value);
              setErros((x) => ({ ...x, quantidade: '' }));
            }}
            erro={erros.quantidade}
            ajuda={tipo === 'saida' && produto ? `Disponível: ${produto.estoque}` : undefined}
          />

          <div className="stack movimentacao__motivo">
            <FormField
              label="Motivo"
              obrigatorio
              placeholder="Descreva o motivo"
              value={motivo}
              onChange={(e) => {
                setMotivo(e.target.value);
                setErros((x) => ({ ...x, motivo: '' }));
              }}
              erro={erros.motivo}
            />
            <div className="chips" role="group" aria-label="Motivos comuns">
              {cfg.motivos.map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`chip ${motivo === m ? 'is-ativo' : ''}`}
                  onClick={() => {
                    setMotivo(m);
                    setErros((x) => ({ ...x, motivo: '' }));
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {produto && (
            <div className={`saldo-previa ${novoSaldo < 0 ? 'saldo-previa--erro' : ''}`} aria-live="polite">
              <div>
                <small>Atual</small>
                <strong>{produto.estoque}</strong>
              </div>
              <ArrowRight size={20} aria-hidden="true" />
              <div>
                <small>Depois</small>
                <strong>{qtd ? novoSaldo : '—'}</strong>
              </div>
              {qtd > 0 && novoSaldo >= 0 && novoSaldo <= produto.estoque_minimo && (
                <span className="badge badge--warning">Fica abaixo do mínimo ({produto.estoque_minimo})</span>
              )}
            </div>
          )}

          <button
            type="submit"
            className={`btn btn--lg btn--block ${tipo === 'entrada' ? 'btn--primary' : 'btn--saida'}`}
            disabled={salvando || carregando}
          >
            {salvando ? <Spinner tamanho="sm" /> : <Icone size={18} aria-hidden="true" />}
            {cfg.botao}
          </button>
        </form>

        <section className="card">
          <h2 className="card__titulo">
            <History size={18} aria-hidden="true" /> Últimas {tipo === 'entrada' ? 'entradas' : 'saídas'}
          </h2>
          {carregando ? (
            <LinhasSkeleton linhas={4} />
          ) : (
            <TabelaMovimentacoes
              itens={historico}
              mostrarProduto
              vazio={`Nenhuma ${tipo === 'entrada' ? 'entrada' : 'saída'} registrada ainda.`}
            />
          )}
        </section>
      </div>
    </div>
  );
}
