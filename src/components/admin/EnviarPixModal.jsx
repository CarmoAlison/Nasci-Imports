import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, QrCode, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../Modal';
import FormField from '../FormField';
import Spinner from '../Spinner';
import { useAuth } from '../../hooks/useAuth';
import { enviarPixPedido, obterConfigPix, TIPOS_CHAVE_PIX } from '../../services/pix';
import { formatarMoeda } from '../../utils/format';
import { traduzirErro } from '../../utils/errors';

const paraNumero = (v) => Number(String(v).replace(/\./g, '').replace(',', '.'));

/**
 * Envia o Pix do pedido com um clique: o código "copia e cola" é gerado no banco
 * com a chave cadastrada em Configurações e o valor do pedido (ou outro valor).
 * Mantém a opção de colar um código manualmente.
 *
 *  pedido: { id, numero, total }
 *  enviarManual: (codigo) => Promise<boolean>  — envio de código colado (fallback)
 */
export default function EnviarPixModal({ aberto, aoFechar, pedido, enviarManual }) {
  const { isAdmin } = useAuth();
  const [config, setConfig] = useState(undefined); // undefined = carregando
  const [outroValor, setOutroValor] = useState(false);
  const [valor, setValor] = useState('');
  const [manual, setManual] = useState(false);
  const [codigoManual, setCodigoManual] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!aberto) return undefined;
    let ativo = true;
    setConfig(undefined);
    setOutroValor(false);
    setManual(false);
    setCodigoManual('');
    setValor(String(Number(pedido?.total || 0).toFixed(2)).replace('.', ','));
    obterConfigPix()
      .then((c) => ativo && setConfig(c))
      .catch(() => ativo && setConfig(null));
    return () => {
      ativo = false;
    };
  }, [aberto, pedido?.total]);

  const fechar = () => !enviando && aoFechar();

  const enviarAutomatico = async () => {
    const v = outroValor ? paraNumero(valor) : null;
    if (outroValor && (!v || v <= 0)) {
      toast.error('Informe um valor maior que zero.');
      return;
    }
    setEnviando(true);
    try {
      await enviarPixPedido(pedido.id, v);
      toast.success(`Pix de ${formatarMoeda(v ?? pedido.total)} enviado ao cliente!`);
      aoFechar();
    } catch (e) {
      toast.error(traduzirErro(e));
    } finally {
      setEnviando(false);
    }
  };

  const enviarColado = async (e) => {
    e.preventDefault();
    if (codigoManual.trim().length < 20) {
      toast.error('Cole o código Pix copia-e-cola completo.');
      return;
    }
    setEnviando(true);
    const ok = await enviarManual(codigoManual.trim());
    setEnviando(false);
    if (ok) {
      toast.success('Código Pix enviado ao cliente!');
      aoFechar();
    }
  };

  const tipo = TIPOS_CHAVE_PIX.find((t) => t.valor === config?.tipo_chave)?.rotulo;

  return (
    <Modal aberto={aberto} aoFechar={fechar} titulo={`Enviar Pix — pedido #${pedido?.numero ?? ''}`} tamanho="sm">
      {config === undefined ? (
        <div className="centralizado">
          <Spinner />
        </div>
      ) : manual ? (
        <form onSubmit={enviarColado} className="stack">
          <FormField
            as="textarea"
            label="Código Pix copia-e-cola"
            rows={5}
            obrigatorio
            placeholder="00020126580014BR.GOV.BCB.PIX..."
            value={codigoManual}
            onChange={(e) => setCodigoManual(e.target.value)}
          />
          <div className="modal__acoes">
            <button type="button" className="btn btn--ghost" onClick={() => setManual(false)} disabled={enviando}>
              Voltar
            </button>
            <button type="submit" className="btn btn--primary" disabled={enviando}>
              {enviando && <Spinner tamanho="sm" />}
              Enviar código colado
            </button>
          </div>
        </form>
      ) : !config ? (
        <div className="stack">
          <div className="alerta alerta--aviso">
            <AlertTriangle size={18} aria-hidden="true" />
            <span>A chave Pix da loja ainda não foi cadastrada.</span>
          </div>
          {isAdmin ? (
            <Link to="/admin/configuracoes" className="btn btn--primary btn--block" onClick={aoFechar}>
              Cadastrar chave Pix
            </Link>
          ) : (
            <p className="texto-suave texto-pequeno">Peça ao administrador para cadastrar em Configurações.</p>
          )}
          <button type="button" className="link-btn centralizado" onClick={() => setManual(true)}>
            Colar um código manualmente
          </button>
        </div>
      ) : (
        <div className="stack">
          <div className="pix-resumo">
            <div className="pix-resumo__valor">
              <small>Valor do Pix</small>
              <strong>{formatarMoeda(outroValor ? paraNumero(valor) || 0 : pedido.total)}</strong>
            </div>
            <dl className="pix-resumo__dados">
              <div>
                <dt>Recebedor</dt>
                <dd>{config.nome_recebedor}</dd>
              </div>
              <div>
                <dt>Chave ({tipo})</dt>
                <dd>{config.chave}</dd>
              </div>
            </dl>
          </div>

          <label className="checkbox">
            <input type="checkbox" checked={outroValor} onChange={(e) => setOutroValor(e.target.checked)} />
            Cobrar outro valor (ex.: sinal ou parte do pedido)
          </label>
          {outroValor && (
            <FormField
              label="Valor (R$)"
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(e.target.value.replace(/[^\d,.]/g, ''))}
              ajuda={`Total do pedido: ${formatarMoeda(pedido.total)}`}
            />
          )}

          <p className="texto-suave texto-pequeno">
            O cliente recebe {config.mensagem ? 'a mensagem configurada e ' : ''}um card com o botão “Copiar código Pix”.
          </p>

          <button type="button" className="btn btn--primary btn--lg btn--block" onClick={enviarAutomatico} disabled={enviando}>
            {enviando ? <Spinner tamanho="sm" /> : <Send size={18} aria-hidden="true" />}
            Enviar Pix ao cliente
          </button>
          <button type="button" className="link-btn centralizado" onClick={() => setManual(true)} disabled={enviando}>
            <QrCode size={14} aria-hidden="true" /> Colar um código manualmente
          </button>
        </div>
      )}
    </Modal>
  );
}
