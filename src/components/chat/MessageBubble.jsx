import { Check, CheckCheck, CheckCircle2, RotateCcw, UserCheck } from 'lucide-react';
import PixCard from './PixCard';
import ChatImage from './ChatImage';
import { formatarHora } from '../../utils/format';

const ICONES_SISTEMA = { finalizada: CheckCircle2, reaberta: RotateCcw, atribuida: UserCheck };

export default function MessageBubble({ mensagem, minha, nomeRemetente, aoCarregarImagem }) {
  // Eventos do atendimento (finalizado, reaberto, transferido): linha centralizada
  if (mensagem.tipo === 'sistema') {
    const Icone = ICONES_SISTEMA[mensagem.evento] || CheckCircle2;
    return (
      <div className={`msg-sistema msg-sistema--${mensagem.evento || 'info'}`} role="status">
        <Icone size={14} aria-hidden="true" />
        <span>{mensagem.texto}</span>
        <time dateTime={mensagem.created_at}>{formatarHora(mensagem.created_at)}</time>
      </div>
    );
  }

  const ehPix = mensagem.tipo === 'pix';

  return (
    <div className={`msg ${minha ? 'msg--minha' : 'msg--outra'} ${ehPix ? 'msg--pix' : ''}`}>
      {!minha && <span className="msg__autor">{nomeRemetente}</span>}
      <div className="msg__balao">
        {ehPix ? (
          <PixCard codigo={mensagem.texto} />
        ) : (
          <>
            {mensagem.imagem_url && <ChatImage path={mensagem.imagem_url} aoCarregar={aoCarregarImagem} />}
            {mensagem.texto && <p className="msg__texto">{mensagem.texto}</p>}
          </>
        )}
        <span className="msg__meta">
          {formatarHora(mensagem.created_at)}
          {minha &&
            (mensagem.lida ? (
              <CheckCheck size={14} aria-label="Lida" className="msg__lida" />
            ) : (
              <Check size={14} aria-label="Enviada" />
            ))}
        </span>
      </div>
    </div>
  );
}
