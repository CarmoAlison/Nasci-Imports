// Exportação de relatórios em PDF (jsPDF + autoTable) e Excel (ExcelJS),
// com a identidade visual do sistema: faixa preta, destaque verde #1BFD00 e logo.
// As bibliotecas são carregadas sob demanda (só quando o usuário exporta).
import logoUrl from '../assets/Logo-nasci.jpg';
import { formatarCelula, linhaTotais, tomCelula } from '../services/relatorios';
import { formatarDataHora } from './format';

const VERDE = [27, 253, 0];
const PRETO = [0, 0, 0];
const GRAFITE = [13, 13, 13];
const CINZA_TEXTO = [160, 160, 160];

// Cores dos "tons" (status, situação) em fundo branco — versões legíveis do tema
const TONS_RGB = {
  sucesso: [8, 140, 0],
  aviso: [196, 120, 0],
  info: [20, 110, 200],
  perigo: [210, 40, 40],
};
const TONS_HEX = { sucesso: 'FF088C00', aviso: 'FFC47800', info: 'FF146EC8', perigo: 'FFD22828' };

// ----------------------------------------------------------------- comum

let logoCache = null;
async function carregarLogo() {
  if (logoCache) return logoCache;
  const resp = await fetch(logoUrl);
  const buffer = await resp.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  logoCache = { buffer, dataUrl: `data:image/jpeg;base64,${btoa(bin)}` };
  return logoCache;
}

/** Colunas de exportação (inclui a posição nos rankings) */
function colunasDe(relatorio) {
  return relatorio.ranking
    ? [{ chave: '__pos', titulo: 'Pos.', tipo: 'inteiro', largura: 7 }, ...relatorio.colunas]
    : relatorio.colunas;
}

const valorDe = (linha, coluna, indice) => (coluna.chave === '__pos' ? indice + 1 : linha[coluna.chave]);

const alinhaDireita = (tipo) => ['moeda', 'inteiro', 'pedido'].includes(tipo);

export function nomeArquivo(relatorio, info) {
  const base = `relatorio-${relatorio.id}`;
  const periodo = info.periodoArquivo ? `-${info.periodoArquivo}` : '';
  return `${base}${periodo}`;
}

function baixar(blob, nome) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** As fontes padrão do PDF só têm Latin-1: troca o que estiver fora disso */
const textoPdf = (s) =>
  String(s ?? '')
    .replace(/[–—]/g, '-')
    .replace(/[  ]/g, ' ')
    .replace(/[→]/g, '>')
    .replace(/[^\x20-\xFF]/g, '');

// ------------------------------------------------------------------- PDF

/**
 * info: { periodo: '01/11/2026 a 08/11/2026' | null, filtro: 'Pagos' | null,
 *         geradoPor: 'Nome', periodoArquivo: '2026-11-01_a_2026-11-08' }
 */
export async function exportarPDF(relatorio, linhas, info) {
  const [{ jsPDF }, autoTableMod, logo] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
    carregarLogo(),
  ]);
  const autoTable = autoTableMod.autoTable || autoTableMod.default;

  const doc = new jsPDF({ orientation: relatorio.orientacao || 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 10;
  const agora = formatarDataHora(new Date());

  // ---- cabeçalho da primeira página
  doc.setFillColor(...PRETO);
  doc.rect(0, 0, W, 28, 'F');
  doc.addImage(logo.dataUrl, 'JPEG', M, 4, 20, 20);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text(textoPdf(relatorio.titulo), M + 25, 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...CINZA_TEXTO);
  const sub = ['Nasci Imports', info.periodo && `Período: ${info.periodo}`, info.filtro && `Filtro: ${info.filtro}`]
    .filter(Boolean)
    .join('   |   ');
  doc.text(textoPdf(sub), M + 25, 20);
  doc.setFontSize(8);
  doc.text(textoPdf(`Gerado em ${agora}`), W - M, 13, { align: 'right' });
  if (info.geradoPor) doc.text(textoPdf(`por ${info.geradoPor}`), W - M, 18, { align: 'right' });
  doc.setFillColor(...VERDE);
  doc.rect(0, 28, W, 1.2, 'F');

  // ---- cartões de resumo
  const resumo = relatorio.resumo(linhas);
  const gap = 4;
  const cardW = (W - M * 2 - gap * (resumo.length - 1)) / resumo.length;
  const cardY = 35;
  const cardH = 17;
  resumo.forEach((r, i) => {
    const x = M + i * (cardW + gap);
    if (r.destaque) {
      doc.setFillColor(...PRETO);
      doc.roundedRect(x, cardY, cardW, cardH, 2, 2, 'F');
    } else {
      doc.setFillColor(245, 245, 245);
      doc.roundedRect(x, cardY, cardW, cardH, 2, 2, 'F');
    }
    doc.setFillColor(...VERDE);
    doc.rect(x, cardY + 2, 1.2, cardH - 4, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...(r.destaque ? CINZA_TEXTO : [110, 110, 110]));
    doc.text(textoPdf(r.rotulo.toUpperCase()), x + 4, cardY + 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(r.tipo === 'texto' ? 9.5 : 12.5);
    doc.setTextColor(...(r.destaque ? VERDE : [20, 20, 20]));
    const valor = textoPdf(formatarCelula(r.valor, r.tipo));
    const cabe = doc.splitTextToSize(valor, cardW - 6)[0];
    doc.text(cabe, x + 4, cardY + 13);
  });

  // ---- tabela
  const colunas = colunasDe(relatorio);
  const totais = linhaTotais(relatorio, linhas);
  const temTotais = Object.keys(totais).length > 0 && linhas.length > 0;

  const corpo = linhas.length
    ? linhas.map((l, i) => colunas.map((c) => textoPdf(formatarCelula(valorDe(l, c, i), c.tipo))))
    : [[{ content: 'Nenhum registro encontrado para os filtros escolhidos.', colSpan: colunas.length }]];

  const rodapeTabela = temTotais
    ? [
        colunas.map((c, i) => {
          if (i === 0) return 'TOTAL';
          return c.chave in totais ? textoPdf(formatarCelula(totais[c.chave], c.tipo)) : '';
        }),
      ]
    : undefined;

  autoTable(doc, {
    startY: cardY + cardH + 6,
    head: [colunas.map((c) => textoPdf(c.titulo))],
    body: corpo,
    foot: rodapeTabela,
    showFoot: 'lastPage',
    margin: { top: 20, right: M, bottom: 16, left: M },
    theme: 'plain',
    styles: { font: 'helvetica', fontSize: 8, cellPadding: { top: 2.2, bottom: 2.2, left: 2, right: 2 }, textColor: [30, 30, 30], overflow: 'linebreak' },
    headStyles: { fillColor: PRETO, textColor: [255, 255, 255], fontStyle: 'bold', lineColor: VERDE, lineWidth: { bottom: 0.8 } },
    footStyles: { fillColor: GRAFITE, textColor: VERDE, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [246, 246, 246] },
    bodyStyles: { lineColor: [232, 232, 232], lineWidth: { bottom: 0.1 } },
    columnStyles: Object.fromEntries(colunas.map((c, i) => [i, { halign: alinhaDireita(c.tipo) ? 'right' : 'left' }])),
    didParseCell(data) {
      const coluna = colunas[data.column.index];
      if (!coluna) return;
      if ((data.section === 'head' || data.section === 'foot') && alinhaDireita(coluna.tipo)) {
        data.cell.styles.halign = 'right';
      }
      if (data.section === 'body' && linhas.length) {
        const tom = tomCelula(valorDe(linhas[data.row.index], coluna, data.row.index), coluna.tipo);
        if (tom) {
          data.cell.styles.textColor = TONS_RGB[tom];
          data.cell.styles.fontStyle = 'bold';
        }
        if (coluna.chave === '__pos' && data.row.index < 3) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor = TONS_RGB.sucesso;
        }
      }
      if (data.section === 'body' && !linhas.length) {
        data.cell.styles.halign = 'center';
        data.cell.styles.textColor = [120, 120, 120];
      }
    },
    didDrawPage(data) {
      // páginas seguintes: faixa preta compacta com logo e título
      if (data.pageNumber > 1) {
        doc.setFillColor(...PRETO);
        doc.rect(0, 0, W, 13, 'F');
        doc.addImage(logo.dataUrl, 'JPEG', M, 1.5, 10, 10);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(255, 255, 255);
        doc.text(textoPdf(relatorio.titulo), M + 13, 8.3);
        doc.setFillColor(...VERDE);
        doc.rect(0, 13, W, 0.8, 'F');
      }
    },
  });

  // ---- rodapé em todas as páginas
  const paginas = doc.internal.getNumberOfPages();
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p);
    doc.setDrawColor(...VERDE);
    doc.setLineWidth(0.5);
    doc.line(M, H - 11, W - M, H - 11);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(120, 120, 120);
    doc.text(textoPdf(`Nasci Imports - ${relatorio.titulo} - gerado em ${agora}`), M, H - 6.5);
    doc.text(`Página ${p} de ${paginas}`, W - M, H - 6.5, { align: 'right' });
  }

  doc.save(`${nomeArquivo(relatorio, info)}.pdf`);
}

// ----------------------------------------------------------------- Excel

const FORMATOS_XLSX = {
  moeda: '"R$" #,##0.00',
  inteiro: '#,##0',
  data: 'dd/mm/yyyy',
  datahora: 'dd/mm/yyyy hh:mm',
  pedido: '"#"0',
};

/** O Excel não guarda fuso: ajusta para mostrar o horário local */
function dataLocal(valor) {
  const d = new Date(valor);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000);
}

function valorExcel(valor, tipo) {
  if (valor === null || valor === undefined || valor === '') return null;
  if (tipo === 'moeda' || tipo === 'inteiro' || tipo === 'pedido') return Number(valor);
  if (tipo === 'data' || tipo === 'datahora') return dataLocal(valor);
  if (['status', 'situacao', 'tipoMov', 'telefone', 'simnao'].includes(tipo)) return formatarCelula(valor, tipo);
  return String(valor);
}

const preenchimento = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });

export async function exportarExcel(relatorio, linhas, info) {
  const [mod, logo] = await Promise.all([import('exceljs'), carregarLogo()]);
  const ExcelJS = mod.default || mod;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Nasci Imports';
  wb.created = new Date();

  const nomeAba = relatorio.titulo.replace(/[\\/?*[\]:]/g, '').slice(0, 31);
  const colunas = colunasDe(relatorio);
  const ultima = colunas.length;
  const ws = wb.addWorksheet(nomeAba, {
    pageSetup: {
      orientation: relatorio.orientacao === 'landscape' ? 'landscape' : 'portrait',
      paperSize: 9, // A4
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    },
    headerFooter: { oddFooter: '&LNasci Imports&RPágina &P de &N' },
  });
  ws.columns = colunas.map((c) => ({ width: Math.max(c.largura || 14, 9) }));

  // Coluna onde começam os textos do cabeçalho (depois da logo, ~80px)
  let largura = 0;
  let colTexto = 1;
  for (let i = 0; i < colunas.length; i++) {
    largura += (ws.getColumn(i + 1).width || 10) * 7;
    if (largura >= 80) {
      colTexto = i + 2;
      break;
    }
  }
  colTexto = Math.min(colTexto, ultima);

  // ---- faixa preta com logo (linhas 1 a 4) + linha verde (5)
  for (let r = 1; r <= 4; r++) {
    const linha = ws.getRow(r);
    linha.height = r === 1 ? 26 : 17;
    for (let c = 1; c <= ultima; c++) linha.getCell(c).fill = preenchimento('FF000000');
  }
  const verde = ws.getRow(5);
  verde.height = 4;
  for (let c = 1; c <= ultima; c++) verde.getCell(c).fill = preenchimento('FF1BFD00');

  const idLogo = wb.addImage({ buffer: logo.buffer, extension: 'jpeg' });
  ws.addImage(idLogo, { tl: { col: 0.15, row: 0.25 }, ext: { width: 72, height: 72 } });

  const textos = [
    { linha: 1, valor: relatorio.titulo, fonte: { bold: true, size: 18, color: { argb: 'FFFFFFFF' } } },
    {
      linha: 2,
      valor: ['Nasci Imports', info.periodo && `Período: ${info.periodo}`, info.filtro && `Filtro: ${info.filtro}`]
        .filter(Boolean)
        .join('   |   '),
      fonte: { size: 10, color: { argb: 'FFA0A0A0' } },
    },
    {
      linha: 3,
      valor: `Gerado em ${formatarDataHora(new Date())}${info.geradoPor ? ` por ${info.geradoPor}` : ''}`,
      fonte: { size: 9, color: { argb: 'FFA0A0A0' } },
    },
  ];
  textos.forEach((t) => {
    if (colTexto < ultima) ws.mergeCells(t.linha, colTexto, t.linha, ultima);
    const cel = ws.getCell(t.linha, colTexto);
    cel.value = t.valor;
    cel.font = { name: 'Calibri', ...t.fonte };
    cel.alignment = { vertical: 'middle' };
  });

  // ---- resumo (rótulo | valor), a partir da linha 7
  let r = 7;
  const resumo = relatorio.resumo(linhas);
  const fimRotulo = Math.min(2, ultima);
  const iniValor = Math.min(fimRotulo + 1, ultima);
  const fimValor = Math.min(iniValor + 1, ultima);
  resumo.forEach((item) => {
    if (fimRotulo > 1) ws.mergeCells(r, 1, r, fimRotulo);
    if (fimValor > iniValor) ws.mergeCells(r, iniValor, r, fimValor);
    const rot = ws.getCell(r, 1);
    rot.value = item.rotulo;
    rot.font = { size: 10, color: { argb: 'FF606060' } };
    rot.fill = preenchimento('FFF3F3F3');
    rot.border = { left: { style: 'thick', color: { argb: 'FF1BFD00' } } };
    rot.alignment = { vertical: 'middle', indent: 1 };
    const val = ws.getCell(r, iniValor);
    val.value = item.tipo === 'texto' ? String(item.valor) : Number(item.valor);
    if (FORMATOS_XLSX[item.tipo]) val.numFmt = FORMATOS_XLSX[item.tipo];
    val.font = { bold: true, size: 12, color: { argb: item.destaque ? 'FF1BFD00' : 'FF141414' } };
    val.fill = preenchimento(item.destaque ? 'FF000000' : 'FFF3F3F3');
    val.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
    ws.getRow(r).height = 20;
    r++;
  });

  // ---- tabela
  r += 1;
  const linhaCab = r;
  const cab = ws.getRow(linhaCab);
  cab.height = 22;
  colunas.forEach((c, i) => {
    const cel = cab.getCell(i + 1);
    cel.value = c.titulo;
    cel.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cel.fill = preenchimento('FF000000');
    cel.border = { bottom: { style: 'medium', color: { argb: 'FF1BFD00' } } };
    cel.alignment = { vertical: 'middle', horizontal: alinhaDireita(c.tipo) ? 'right' : 'left', indent: 1 };
  });

  if (!linhas.length) {
    r++;
    ws.mergeCells(r, 1, r, ultima);
    const cel = ws.getCell(r, 1);
    cel.value = 'Nenhum registro encontrado para os filtros escolhidos.';
    cel.font = { italic: true, color: { argb: 'FF808080' } };
    cel.alignment = { horizontal: 'center' };
  }

  linhas.forEach((l, idx) => {
    r++;
    const row = ws.getRow(r);
    row.height = 18;
    colunas.forEach((c, i) => {
      const bruto = valorDe(l, c, idx);
      const cel = row.getCell(i + 1);
      cel.value = valorExcel(bruto, c.tipo);
      if (FORMATOS_XLSX[c.tipo]) cel.numFmt = FORMATOS_XLSX[c.tipo];
      cel.alignment = { vertical: 'middle', horizontal: alinhaDireita(c.tipo) ? 'right' : 'left', indent: 1 };
      cel.border = { bottom: { style: 'hair', color: { argb: 'FFE0E0E0' } } };
      if (idx % 2 === 1) cel.fill = preenchimento('FFF7F7F7');
      const tom = tomCelula(bruto, c.tipo);
      if (tom) cel.font = { bold: true, color: { argb: TONS_HEX[tom] } };
    });
  });

  // ---- totais
  const totais = linhaTotais(relatorio, linhas);
  if (Object.keys(totais).length && linhas.length) {
    r++;
    const row = ws.getRow(r);
    row.height = 22;
    colunas.forEach((c, i) => {
      const cel = row.getCell(i + 1);
      if (i === 0) cel.value = 'TOTAL';
      else if (c.chave in totais) {
        cel.value = Number(totais[c.chave]);
        if (FORMATOS_XLSX[c.tipo]) cel.numFmt = FORMATOS_XLSX[c.tipo];
      }
      cel.font = { bold: true, color: { argb: 'FF1BFD00' } };
      cel.fill = preenchimento('FF0D0D0D');
      cel.alignment = { vertical: 'middle', horizontal: alinhaDireita(c.tipo) ? 'right' : 'left', indent: 1 };
    });
  }

  // filtro nas colunas e cabeçalho congelado
  if (linhas.length) {
    ws.autoFilter = { from: { row: linhaCab, column: 1 }, to: { row: linhaCab + linhas.length, column: ultima } };
  }
  ws.views = [{ state: 'frozen', ySplit: linhaCab, showGridLines: false }];

  r += 2;
  const nota = ws.getCell(r, 1);
  nota.value = 'Nasci Imports — relatório gerado pelo sistema.';
  nota.font = { italic: true, size: 9, color: { argb: 'FF909090' } };

  const buffer = await wb.xlsx.writeBuffer();
  baixar(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `${nomeArquivo(relatorio, info)}.xlsx`,
  );
}
