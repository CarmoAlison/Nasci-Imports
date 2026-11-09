import { useState } from 'react';
import { Check, Copy, QrCode } from 'lucide-react';
import toast from 'react-hot-toast';
import { lerCodigoPix } from '../../utils/pix';
import { formatarMoeda } from '../../utils/format';

async function copiarTexto(texto) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(texto);
    return;
  }
  // Alternativa para navegadores sem Clipboard API
  const area = document.createElement('textarea');
  area.value = texto;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(area);
  if (!ok) throw new Error('copy failed');
}

/** Card especial para mensagens do tipo "pix" com botão de copiar o código */
export default function PixCard({ codigo }) {
  const [copiado, setCopiado] = useState(false);
  const dados = lerCodigoPix(codigo);

  const copiar = async () => {
    try {
      await copiarTexto(codigo);
      setCopiado(true);
      toast.success('Código Pix copiado! Cole no app do seu banco.');
      setTimeout(() => setCopiado(false), 3000);
    } catch {
      toast.error('Não foi possível copiar. Selecione o código e copie manualmente.');
    }
  };

  return (
    <div className="pix-card">
      <div className="pix-card__topo">
        <QrCode size={20} aria-hidden="true" />
        <strong>Pagamento via Pix</strong>
      </div>
      {dados?.valor > 0 && (
        <div className="pix-card__valor">
          <strong>{formatarMoeda(dados.valor)}</strong>
          {dados.recebedor && <small>para {dados.recebedor}</small>}
        </div>
      )}
      <p className="pix-card__instrucao">Copie o código abaixo e pague no app do seu banco (Pix copia e cola).</p>
      <code className="pix-card__codigo">{codigo}</code>
      <button type="button" className="btn btn--primary btn--block" onClick={copiar}>
        {copiado ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
        {copiado ? 'Código copiado!' : 'Copiar código Pix'}
      </button>
      <p className="pix-card__dica">Depois de pagar, envie o comprovante aqui no chat.</p>
    </div>
  );
}
