// Formatação de valores para exibição

const moedaFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dataFmt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' });
const dataHoraFmt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const horaFmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

export function formatarMoeda(valor) {
  return moedaFmt.format(Number(valor) || 0);
}

export function formatarData(data) {
  if (!data) return '';
  return dataFmt.format(new Date(data));
}

export function formatarDataHora(data) {
  if (!data) return '';
  return dataHoraFmt.format(new Date(data));
}

export function formatarHora(data) {
  if (!data) return '';
  return horaFmt.format(new Date(data));
}

/** "há 5 min", "há 2 h", ou a data */
export function tempoRelativo(data) {
  if (!data) return '';
  const diff = (Date.now() - new Date(data).getTime()) / 1000;
  if (diff < 60) return 'agora';
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  if (diff < 604800) return `há ${Math.floor(diff / 86400)} d`;
  return formatarData(data);
}

export function formatarEndereco(e) {
  if (!e) return '';
  const linha1 = [e.rua, e.numero].filter(Boolean).join(', ');
  const comp = e.complemento ? ` - ${e.complemento}` : '';
  const linha2 = [e.bairro, [e.cidade, e.uf].filter(Boolean).join('/')].filter(Boolean).join(' - ');
  return `${linha1}${comp}${linha2 ? ` — ${linha2}` : ''}${e.cep ? ` — CEP ${formatarCepTexto(e.cep)}` : ''}`;
}

function formatarCepTexto(cep) {
  const d = String(cep).replace(/\D/g, '');
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : cep;
}

export function slugify(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function primeiroNome(nome) {
  return String(nome || '').trim().split(/\s+/)[0] || '';
}
