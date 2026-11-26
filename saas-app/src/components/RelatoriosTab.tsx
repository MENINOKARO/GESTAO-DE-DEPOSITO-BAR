import { useMemo, useState } from 'react';
import { CloudUpload, FileDown, FolderDown, Layers, Printer, Share2 } from 'lucide-react';
import type {
  CategoriaRelatorio,
  FiltroRelatorio,
  ModoFiltroRelatorio,
  PainelSnapshot,
  StatusSync
} from '../types/domain';
import { gerarRelatorioFiltrado } from '../services/dataRepository';
import {
  baixarPacoteRelatoriosGerenciais,
  baixarPdfRelatorio,
  compartilharRelatorioMultiDispositivo,
  gerarPdfBlobRelatorio,
  imprimirPdfRelatorioA4
} from '../services/pdfReportService';
import { imprimirRelatorioTermico } from '../services/thermalPrintService';
import { salvarArquivoNaPastaLocal } from '../services/localFolderService';
import { enviarPdfParaGoogleDrive } from '../services/googleDriveMirrorService';

interface RelatoriosTabProps {
  snapshot: PainelSnapshot;
  statusSync: StatusSync;
  onNotify: (texto: string, tipo?: 'success' | 'error' | 'warning' | 'info') => void;
}

export function RelatoriosTab({ snapshot, statusSync, onNotify }: RelatoriosTabProps) {
  const hojeYmd = new Date().toISOString().slice(0, 10);
  const mesAtualYm = hojeYmd.slice(0, 7);

  const [categoria, setCategoria] = useState<CategoriaRelatorio>('Financeiro');
  const [modo, setModo] = useState<ModoFiltroRelatorio>('MES');
  const [mesReferencia, setMesReferencia] = useState(mesAtualYm);
  const [dataInicio, setDataInicio] = useState(`${mesAtualYm}-01`);
  const [dataFim, setDataFim] = useState(hojeYmd);
  const [periodoRapido, setPeriodoRapido] = useState<FiltroRelatorio['periodoRapido']>('30_DIAS');
  const [salvando, setSalvando] = useState(false);

  const relatorio = useMemo(() => {
    return gerarRelatorioFiltrado(snapshot, {
      categoria,
      modo,
      mesReferencia,
      dataInicio,
      dataFim,
      periodoRapido
    });
  }, [snapshot, categoria, modo, mesReferencia, dataInicio, dataFim, periodoRapido]);

  function handleBaixarPdf() {
    baixarPdfRelatorio(relatorio, snapshot.empresa.nome);
    onNotify(`PDF "${relatorio.nomeArquivoPdf}" gerado e baixado!`, 'success');
  }

  async function handleGerarPacoteCompleto() {
    setSalvando(true);
    try {
      const qtd = await baixarPacoteRelatoriosGerenciais(snapshot, {
        modo,
        mesReferencia,
        dataInicio,
        dataFim,
        periodoRapido
      });
      onNotify(`Pacote completo gerado: ${qtd} relatórios PDF baixados!`, 'success');
    } finally {
      setSalvando(false);
    }
  }

  function handleImprimirA4() {
    imprimirPdfRelatorioA4(relatorio, snapshot.empresa.nome);
  }

  async function handleCompartilhar() {
    const res = await compartilharRelatorioMultiDispositivo(relatorio, snapshot.empresa.nome);
    onNotify(res.msg, res.ok ? 'success' : 'info');
  }

  async function handleSalvarPastaLocal() {
    setSalvando(true);
    try {
      const blob = gerarPdfBlobRelatorio(relatorio, snapshot.empresa.nome);
      const res = await salvarArquivoNaPastaLocal(
        snapshot.empresa.nome,
        relatorio.categoria,
        relatorio.subpastaMes,
        relatorio.nomeArquivoPdf,
        blob
      );
      onNotify(res.msg, res.ok ? 'success' : 'warning');
    } finally {
      setSalvando(false);
    }
  }

  async function handleEnviarDrive() {
    setSalvando(true);
    try {
      const blob = gerarPdfBlobRelatorio(relatorio, snapshot.empresa.nome);
      const res = await enviarPdfParaGoogleDrive(
        snapshot.empresa.id,
        snapshot.empresa.nome,
        relatorio.categoria,
        relatorio.subpastaMes,
        relatorio.nomeArquivoPdf,
        blob
      );
      onNotify(res.msg, res.ok ? 'success' : 'warning');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* FILTROS PADRONIZADOS */}
      <div className="panel-card no-print">
        <h3 style={{ fontSize: 16, marginBottom: 12 }}>Central de Relatórios Executivos em PDF</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
          <div>
            <label className="field-label">Tipo de Relatório</label>
            <select
              className="field-select"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value as CategoriaRelatorio)}
            >
              <option value="Financeiro">Financeiro & Fluxo de Caixa</option>
              <option value="Estoque">Estoque & Valores</option>
              <option value="Compras">Compras & Fornecedores</option>
              <option value="Auditoria_Logs">Auditoria & Logs</option>
            </select>
          </div>

          <div>
            <label className="field-label">Modo de Filtro</label>
            <select
              className="field-select"
              value={modo}
              onChange={(e) => setModo(e.target.value as ModoFiltroRelatorio)}
            >
              <option value="MES">Por Mês</option>
              <option value="DATA_A_DATA">Data a Data</option>
              <option value="PERIODO">Período Rápido</option>
            </select>
          </div>

          {modo === 'MES' && (
            <div>
              <label className="field-label">Mês de Referência</label>
              <input
                type="month"
                className="field-input"
                value={mesReferencia}
                onChange={(e) => setMesReferencia(e.target.value)}
              />
            </div>
          )}

          {modo === 'DATA_A_DATA' && (
            <>
              <div>
                <label className="field-label">Data Inicial</label>
                <input
                  type="date"
                  className="field-input"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                />
              </div>
              <div>
                <label className="field-label">Data Final</label>
                <input
                  type="date"
                  className="field-input"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                />
              </div>
            </>
          )}

          {modo === 'PERIODO' && (
            <div>
              <label className="field-label">Período</label>
              <select
                className="field-select"
                value={periodoRapido}
                onChange={(e) => setPeriodoRapido(e.target.value as FiltroRelatorio['periodoRapido'])}
              >
                <option value="HOJE">Hoje</option>
                <option value="7_DIAS">Últimos 7 dias</option>
                <option value="30_DIAS">Últimos 30 dias</option>
                <option value="MES_ATUAL">Mês Atual</option>
              </select>
            </div>
          )}
        </div>

        {/* AÇÕES DE SAÍDA PADRONIZADAS */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 16 }}>
          <button type="button" className="btn btn-primary" onClick={handleBaixarPdf}>
            <FileDown size={15} />
            <span>Gerar PDF</span>
          </button>
          <button type="button" className="btn btn-primary" onClick={handleGerarPacoteCompleto} disabled={salvando}>
            <Layers size={15} />
            <span>Gerar Pacote Completo (4 PDFs)</span>
          </button>
          <button type="button" className="btn" onClick={handleImprimirA4}>
            <Printer size={15} />
            <span>Imprimir A4</span>
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => imprimirRelatorioTermico(relatorio, snapshot.empresa)}
            title="Imprimir resumo e itens na impressora térmica (58mm/80mm)"
          >
            <Printer size={15} />
            <span>Imprimir Térmica</span>
          </button>
          <button type="button" className="btn btn-success" onClick={handleCompartilhar}>
            <Share2 size={15} />
            <span>Compartilhar</span>
          </button>
          <button
            type="button"
            className="btn"
            onClick={handleSalvarPastaLocal}
            disabled={salvando || !statusSync.pastaLocalConectada}
            title={statusSync.pastaLocalConectada ? `Gravar em Relatorios/${relatorio.categoria}/${relatorio.subpastaMes}` : 'Conecte uma pasta do PC em Configurações'}
          >
            <FolderDown size={15} />
            <span>Gravar na Pasta PC</span>
          </button>
          <button
            type="button"
            className="btn"
            onClick={handleEnviarDrive}
            disabled={salvando || !statusSync.driveConectado}
            title={statusSync.driveConectado ? 'Salvar cópia PDF no seu Google Drive' : 'Conecte seu Google Drive em Configurações'}
          >
            <CloudUpload size={15} />
            <span>Salvar no Drive</span>
          </button>
        </div>
      </div>

      {/* PRÉVIA PADRONIZADA A4 */}
      <div className="panel-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          <div>
            <h3 style={{ fontSize: 17 }}>{relatorio.titulo}</h3>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {snapshot.empresa.nome} • {relatorio.periodoLabel} • Destino:{' '}
              <code>Relatorios/{relatorio.categoria}/{relatorio.subpastaMes}/{relatorio.nomeArquivoPdf}</code>
            </div>
          </div>
          <span className="badge badge-purple">{relatorio.linhas.length} registro(s)</span>
        </div>

        <div className="kpi-grid" style={{ marginBottom: 14 }}>
          {relatorio.resumo.map((item) => (
            <div key={item.label} className="kpi-card" style={{ padding: 12 }}>
              <div className="kpi-label">{item.label}</div>
              <div className="kpi-value" style={{ fontSize: 19 }}>
                {item.valor}
              </div>
            </div>
          ))}
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                {relatorio.colunas.map((col) => (
                  <th key={col}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {relatorio.linhas.map((linha, idx) => (
                <tr key={idx}>
                  {linha.map((cel, cIdx) => (
                    <td key={cIdx}>{cel}</td>
                  ))}
                </tr>
              ))}
              {relatorio.linhas.length === 0 && (
                <tr>
                  <td colSpan={relatorio.colunas.length} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    Nenhum registro encontrado para o período selecionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
