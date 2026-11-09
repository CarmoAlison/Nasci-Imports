import { useEffect, useState } from 'react';
import { CheckCircle2, Copy, QrCode, Save, Settings } from 'lucide-react';
import toast from 'react-hot-toast';
import FormField from '../../components/FormField';
import Spinner from '../../components/Spinner';
import { LinhasSkeleton } from '../../components/Skeleton';
import { MENSAGEM_PIX_PADRAO, TIPOS_CHAVE_PIX, gerarPixTeste, obterConfigPix, salvarConfigPix } from '../../services/pix';
import { lerCodigoPix } from '../../utils/pix';
import { mascaraCPF, mascaraTelefone, apenasDigitos } from '../../utils/masks';
import { formatarDataHora, formatarMoeda } from '../../utils/format';
import { traduzirErro } from '../../utils/errors';

const mascaraCNPJ = (v) =>
  apenasDigitos(v)
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');

const PLACEHOLDER = {
  cpf: '000.000.000-00',
  cnpj: '00.000.000/0000-00',
  email: 'pix@sualoja.com.br',
  telefone: '(00) 00000-0000',
  aleatoria: '00000000-0000-0000-0000-000000000000',
};

function mascararChave(tipo, valor) {
  if (tipo === 'cpf') return mascaraCPF(valor);
  if (tipo === 'cnpj') return mascaraCNPJ(valor);
  if (tipo === 'telefone') return mascaraTelefone(String(valor).replace(/^\+55/, ''));
  return valor;
}

async function copiar(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    toast.success('Código copiado!');
  } catch {
    toast.error('Não foi possível copiar.');
  }
}

/** Configurações da loja (somente administrador). Por enquanto: Pix automático. */
export default function Configuracoes() {
  const [form, setForm] = useState({ tipoChave: 'cnpj', chave: '', nomeRecebedor: '', cidade: '', mensagem: MENSAGEM_PIX_PADRAO });
  const [salvo, setSalvo] = useState(null);
  const [erros, setErros] = useState({});
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [teste, setTeste] = useState({ valor: '1,00', codigo: '', gerando: false });

  useEffect(() => {
    obterConfigPix()
      .then((c) => {
        if (!c) return;
        setSalvo(c);
        setForm({
          tipoChave: c.tipo_chave,
          chave: mascararChave(c.tipo_chave, c.chave),
          nomeRecebedor: c.nome_recebedor,
          cidade: c.cidade,
          mensagem: c.mensagem || '',
        });
      })
      .catch((e) => toast.error(traduzirErro(e)))
      .finally(() => setCarregando(false));
  }, []);

  const mudar = (campo, valor) => {
    setForm((f) => ({ ...f, [campo]: valor }));
    setErros((e) => ({ ...e, [campo]: '' }));
  };

  const salvar = async (e) => {
    e.preventDefault();
    const novos = {};
    if (!form.chave.trim()) novos.chave = 'Informe a chave Pix.';
    if (!form.nomeRecebedor.trim()) novos.nomeRecebedor = 'Informe o nome do recebedor.';
    if (!form.cidade.trim()) novos.cidade = 'Informe a cidade.';
    setErros(novos);
    if (Object.keys(novos).length) return;

    setSalvando(true);
    try {
      const c = await salvarConfigPix(form);
      setSalvo(c);
      setForm((f) => ({ ...f, chave: mascararChave(c.tipo_chave, c.chave) }));
      setTeste((t) => ({ ...t, codigo: '' }));
      toast.success('Chave Pix salva! O botão “Enviar Pix” já gera o código automaticamente.');
    } catch (err) {
      toast.error(traduzirErro(err));
    } finally {
      setSalvando(false);
    }
  };

  const gerarTeste = async () => {
    const valor = Number(String(teste.valor).replace(/\./g, '').replace(',', '.'));
    if (!valor || valor <= 0) {
      toast.error('Informe um valor de teste maior que zero.');
      return;
    }
    setTeste((t) => ({ ...t, gerando: true }));
    try {
      const codigo = await gerarPixTeste(valor);
      setTeste((t) => ({ ...t, codigo }));
    } catch (err) {
      toast.error(traduzirErro(err));
    } finally {
      setTeste((t) => ({ ...t, gerando: false }));
    }
  };

  const lido = teste.codigo ? lerCodigoPix(teste.codigo) : null;

  return (
    <div className="stack">
      <div className="pagina-admin__topo">
        <div>
          <h1 className="titulo-icone">
            <Settings size={28} aria-hidden="true" className="texto-sucesso" /> Configurações
          </h1>
          <p className="texto-suave texto-pequeno">Somente o administrador vê esta página.</p>
        </div>
      </div>

      <div className="config__grid">
        <section className="card">
          <h2 className="card__titulo">
            <QrCode size={20} aria-hidden="true" /> Pix da loja
          </h2>
          <p className="texto-suave texto-pequeno config__intro">
            Com a chave cadastrada, o botão <strong>Enviar Pix</strong> do pedido gera o código “copia e cola” com o valor
            do pedido e envia no chat automaticamente.
          </p>

          {carregando ? (
            <LinhasSkeleton linhas={4} />
          ) : (
            <form onSubmit={salvar} noValidate className="stack">
              <div className="form-grid">
                <FormField
                  as="select"
                  label="Tipo de chave"
                  value={form.tipoChave}
                  onChange={(e) => {
                    mudar('tipoChave', e.target.value);
                    mudar('chave', '');
                  }}
                  className="col-4"
                >
                  {TIPOS_CHAVE_PIX.map((t) => (
                    <option key={t.valor} value={t.valor}>
                      {t.rotulo}
                    </option>
                  ))}
                </FormField>
                <FormField
                  label="Chave Pix"
                  obrigatorio
                  value={form.chave}
                  placeholder={PLACEHOLDER[form.tipoChave]}
                  inputMode={['cpf', 'cnpj', 'telefone'].includes(form.tipoChave) ? 'numeric' : undefined}
                  onChange={(e) => mudar('chave', mascararChave(form.tipoChave, e.target.value))}
                  erro={erros.chave}
                  className="col-8"
                />
                <FormField
                  label="Nome do recebedor"
                  obrigatorio
                  maxLength={60}
                  value={form.nomeRecebedor}
                  onChange={(e) => mudar('nomeRecebedor', e.target.value)}
                  erro={erros.nomeRecebedor}
                  ajuda="Como aparece no app do banco do cliente (até 25 letras, sem acento)."
                  className="col-8"
                />
                <FormField
                  label="Cidade"
                  obrigatorio
                  maxLength={40}
                  value={form.cidade}
                  onChange={(e) => mudar('cidade', e.target.value)}
                  erro={erros.cidade}
                  ajuda="Até 15 letras."
                  className="col-4"
                />
                <FormField
                  as="textarea"
                  label="Mensagem enviada junto com o Pix (opcional)"
                  rows={3}
                  maxLength={600}
                  value={form.mensagem}
                  onChange={(e) => mudar('mensagem', e.target.value)}
                  ajuda="Variáveis: {nome} = primeiro nome do cliente, {pedido} = número do pedido, {valor} = valor do Pix. Deixe em branco para enviar só o código."
                  className="col-12"
                />
              </div>

              <div className="linha-entre">
                {salvo ? (
                  <span className="texto-sucesso texto-pequeno linha-icone config__status">
                    <CheckCircle2 size={16} aria-hidden="true" /> Chave cadastrada · atualizada em {formatarDataHora(salvo.updated_at)}
                  </span>
                ) : (
                  <span className="texto-aviso texto-pequeno">Nenhuma chave cadastrada ainda.</span>
                )}
                <button type="submit" className="btn btn--primary" disabled={salvando}>
                  {salvando ? <Spinner tamanho="sm" /> : <Save size={18} aria-hidden="true" />}
                  Salvar chave Pix
                </button>
              </div>
            </form>
          )}
        </section>

        <section className="card">
          <h2 className="card__titulo">Testar código</h2>
          <p className="texto-suave texto-pequeno">
            Gere um código de teste e cole no app do seu banco (Pix → Copia e Cola) para conferir o nome e a chave antes de
            enviar aos clientes. Não precisa concluir o pagamento.
          </p>
          <div className="config__teste">
            <FormField
              label="Valor do teste (R$)"
              inputMode="decimal"
              value={teste.valor}
              onChange={(e) => setTeste((t) => ({ ...t, valor: e.target.value.replace(/[^\d,.]/g, '') }))}
              disabled={!salvo}
            />
            <button type="button" className="btn btn--outline" onClick={gerarTeste} disabled={!salvo || teste.gerando}>
              {teste.gerando ? <Spinner tamanho="sm" /> : <QrCode size={18} aria-hidden="true" />}
              Gerar código
            </button>
          </div>
          {!salvo && <p className="texto-aviso texto-pequeno">Salve a chave Pix primeiro.</p>}
          {teste.codigo && (
            <div className="stack config__resultado">
              {lido && (
                <dl className="specs">
                  <div className="specs__linha">
                    <dt>Recebedor</dt>
                    <dd>{lido.recebedor}</dd>
                  </div>
                  <div className="specs__linha">
                    <dt>Cidade</dt>
                    <dd>{lido.cidade}</dd>
                  </div>
                  <div className="specs__linha">
                    <dt>Chave</dt>
                    <dd>{lido.chave}</dd>
                  </div>
                  <div className="specs__linha">
                    <dt>Valor</dt>
                    <dd>{formatarMoeda(lido.valor)}</dd>
                  </div>
                </dl>
              )}
              <code className="pix-card__codigo">{teste.codigo}</code>
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => copiar(teste.codigo)}>
                <Copy size={16} aria-hidden="true" /> Copiar código de teste
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
