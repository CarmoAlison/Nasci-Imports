import { Inbox } from 'lucide-react';

export default function EmptyState({ icone: Icone = Inbox, titulo, descricao, children }) {
  return (
    <div className="empty-state">
      <div className="empty-state__icone" aria-hidden="true">
        <Icone size={36} />
      </div>
      <h3>{titulo}</h3>
      {descricao && <p>{descricao}</p>}
      {children && <div className="empty-state__acoes">{children}</div>}
    </div>
  );
}
