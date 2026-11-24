import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { CategoriaRelatorio, FiltroRelatorio, PainelSnapshot, RelatorioGerado } from '../types/domain';
import { gerarRelatorioFiltrado } from './dataRepository';

export function gerarPdfBlobRelatorio(relatorio: RelatorioGerado, nomeEmpresa: string): Blob {
  const doc = new jsPDF({
    orientation: relatorio.colunas.length > 6 ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Cabeçalho executivo padronizado
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setTextColor(248, 250, 252);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(`${nomeEmpresa} — Gestão de Negócios 360°`, 14, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(196, 181, 253);
  doc.text(`${relatorio.titulo} | ${relatorio.periodoLabel}`, 14, 19);

  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Emitido em ${new Date().toLocaleString('pt-BR')} • Categoria: ${relatorio.categoria}`,
    14,
    24
  );

  // Cards de resumo executivo
  let startY = 34;
  if (relatorio.resumo.length > 0) {
    const colsCount = Math.min(relatorio.resumo.length, 4);
    const gap = 4;
    const usableW = pageWidth - 28;
    const cardW = (usableW - gap * (colsCount - 1)) / colsCount;

    relatorio.resumo.slice(0, 4).forEach((item, idx) => {
      const x = 14 + idx * (cardW + gap);
      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(x, startY, cardW, 16, 2, 2, 'FD');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(item.label.toUpperCase(), x + 3, startY + 5.5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(15, 23, 42);
      doc.text(item.valor, x + 3, startY + 12.5);
    });

    startY += 22;
  }

  // Tabela principal A4 padronizada
  const bodyRows =
    relatorio.linhas.length > 0
      ? relatorio.linhas
      : [['Nenhum registro encontrado para o filtro selecionado.', ...Array(Math.max(0, relatorio.colunas.length - 1)).fill('--')]];

  autoTable(doc, {
    startY,
    head: [relatorio.colunas],
    body: bodyRows,
    theme: 'striped',
    styles: {
      fontSize: 8.5,
      cellPadding: 2.8,
      textColor: [15, 23, 42]
    },
    headStyles: {
      fillColor: [124, 58, 237],
      textColor: [255, 255, 255],
      fontStyle: 'bold'
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    margin: { left: 14, right: 14, bottom: 16 },
    didDrawPage: (data) => {
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `Gestão de Negócios 360° • Documento gerado eletronicamente • Página ${data.pageNumber}`,
        14,
        pageHeight - 8
      );
    }
  });

  return doc.output('blob');
}

export function baixarPdfRelatorio(relatorio: RelatorioGerado, nomeEmpresa: string): Blob {
  const blob = gerarPdfBlobRelatorio(relatorio, nomeEmpresa);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = relatorio.nomeArquivoPdf;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return blob;
}

export function imprimirPdfRelatorioA4(relatorio: RelatorioGerado, nomeEmpresa: string): void {
  const blob = gerarPdfBlobRelatorio(relatorio, nomeEmpresa);
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (win) {
    setTimeout(() => {
      try {
        win.focus();
        win.print();
      } catch {
        // user can print directly from PDF viewer tab
      }
    }, 650);
  } else {
    window.print();
  }
}

export async function compartilharRelatorioMultiDispositivo(
  relatorio: RelatorioGerado,
  nomeEmpresa: string
): Promise<{ ok: boolean; canal: string; msg: string }> {
  const blob = gerarPdfBlobRelatorio(relatorio, nomeEmpresa);
  const file = new File([blob], relatorio.nomeArquivoPdf, { type: 'application/pdf' });

  const resumoTexto = [
    `*${nomeEmpresa} — ${relatorio.titulo}*`,
    `Período: ${relatorio.periodoLabel}`,
    ...relatorio.resumo.map((r) => `• ${r.label}: ${r.valor}`)
  ].join('\n');

  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
  };

  if (typeof nav.share === 'function' && (!nav.canShare || nav.canShare({ files: [file] }))) {
    try {
      await nav.share({
        title: `${relatorio.titulo} - ${nomeEmpresa}`,
        text: resumoTexto,
        files: [file]
      });
      return { ok: true, canal: 'WEB_SHARE', msg: 'PDF compartilhado com sucesso!' };
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return { ok: false, canal: 'CANCELADO', msg: 'Compartilhamento cancelado.' };
      }
    }
  }

  // Fallback multi-dispositivo (WhatsApp Web / Desktop / Mobile)
  const urlZap = 'https://api.whatsapp.com/send?text=' + encodeURIComponent(resumoTexto);
  window.open(urlZap, '_blank', 'noopener,noreferrer');
  return {
    ok: true,
    canal: 'WHATSAPP',
    msg: 'Resumo aberto no WhatsApp. Para enviar o anexo PDF, baixe o PDF ao lado.'
  };
}

export async function baixarPacoteRelatoriosGerenciais(
  snapshot: PainelSnapshot,
  filtroBase?: Omit<FiltroRelatorio, 'categoria'>
): Promise<number> {
  const hojeYmd = new Date().toISOString().slice(0, 10);
  const mesAtualYm = hojeYmd.slice(0, 7);
  const base: Omit<FiltroRelatorio, 'categoria'> = filtroBase || {
    modo: 'MES',
    mesReferencia: mesAtualYm,
    dataInicio: `${mesAtualYm}-01`,
    dataFim: hojeYmd,
    periodoRapido: 'MES_ATUAL'
  };

  const categorias: CategoriaRelatorio[] = ['Financeiro', 'Estoque', 'Compras', 'Auditoria_Logs'];
  for (let i = 0; i < categorias.length; i += 1) {
    const rel = gerarRelatorioFiltrado(snapshot, { ...base, categoria: categorias[i] });
    baixarPdfRelatorio(rel, snapshot.empresa.nome);
    if (i < categorias.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 260));
    }
  }
  return categorias.length;
}
