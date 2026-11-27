import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Bike,
  Calculator,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Cloud,
  CloudUpload,
  ExternalLink,
  FileCheck2,
  FileDown,
  FileSpreadsheet,
  FolderDown,
  HardDriveDownload,
  History,
  Layers,
  Minus,
  Package,
  PackagePlus,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Settings,
  Share2,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  UserPlus,
  Wallet,
  X
} from 'lucide-react';
import type {
  CategoriaRelatorio,
  FiltroRelatorio,
  PainelSnapshot,
  SessaoAtiva,
  StatusSync
} from '../types/domain';
import {
  calcularPreviaConferenciaCaixa,
  calcularPreviaFechamentoFiscal,
  gerarRelatorioFiltrado,
  contaPagarEhComissao,
  contaPagarEstaCancelada,
  registrarConferenciaCaixa,
  registrarFechamentoFiscal
} from '../services/dataRepository';
import {
  baixarPdfRelatorio,
  compartilharRelatorioMultiDispositivo,
  gerarPdfBlobRelatorio,
  imprimirPdfRelatorioA4
} from '../services/pdfReportService';
import { salvarArquivoNaPastaLocal } from '../services/localFolderService';
import { enviarPdfParaGoogleDrive } from '../services/googleDriveMirrorService';
import { formatarDataHoraBr, formatarMoeda } from '../utils/formatters';
import { ClienteQuickModal } from './ClienteQuickModal';

interface CentralOperacionalTabProps {
  sessao: SessaoAtiva;
  snapshot: PainelSnapshot;
  podeVerGestao: boolean;
  statusSync: StatusSync;
  abrirFiscalAoEntrar: boolean;
  onLimparAbrirFiscal: () => void;
  onIrAba: (aba: string) => void;
  onAbrirCompra?: () => void;
  onRecalcularEstoque: () => Promise<void>;
  onGerarPacoteRelatorios: () => void;
  onFazerBackupLocal: () => Promise<void>;
  onSincronizarDrive: () => Promise<void>;
  onNotify: (texto: string, tipo?: 'success' | 'error' | 'warning' | 'info') => void;
  onAtualizar: () => Promise<void>;
}

type PresetRelatorio =
  | 'ESTE_MES'
  | 'MES_ANTERIOR'
  | 'HOJE'
  | '7_DIAS'
  | 'PERSONALIZADO'
  | 'TUDO';

interface CardPainel {
  id: string;
  titulo: string;
  subtitulo: string;
  keywords: string;
  danger?: boolean;
  icone: ReactNode;
  onClick: () => void;
}

function obterMesAtualYm(): string {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
}

function obterMesAnteriorYm(): string {
  const agora = new Date();
  const dt = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
}

function obterHojeYmd(): string {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(
    agora.getDate()
  ).padStart(2, '0')}`;
}

export function CentralOperacionalTab({
  sessao,
  snapshot,
  podeVerGestao,
  statusSync,
  abrirFiscalAoEntrar,
  onLimparAbrirFiscal,
  onIrAba,
  onAbrirCompra,
  onRecalcularEstoque,
  onGerarPacoteRelatorios,
  onFazerBackupLocal,
  onSincronizarDrive,
  onNotify,
  onAtualizar
}: CentralOperacionalTabProps) {
  const previaConf = useMemo(() => calcularPreviaConferenciaCaixa(snapshot), [snapshot]);
  const previaFiscal = useMemo(
    () => calcularPreviaFechamentoFiscal(snapshot, sessao.usuario.nome),
    [snapshot, sessao.usuario.nome]
  );

  const isGestor =
    sessao.usuario.perfil === 'DONO' ||
    sessao.usuario.perfil === 'GERENTE' ||
    sessao.usuario.perfil === 'ADMIN';
  const isVendedor = String(sessao.usuario.perfil || '').toUpperCase() === 'VENDEDOR';
  const [modalComissoesVendedor, setModalComissoesVendedor] = useState(false);

  const minhasComissoes = useMemo(() => {
    if (!isVendedor) return { pendentes: [], pagas: [], totalPendente: 0 };
    const nomeNorm = String(sessao.usuario.nome || '').trim().toLowerCase();
    const userNorm = String(sessao.usuario.username || '').trim().toLowerCase();
    const doVendedor = (snapshot.contasPagar || []).filter((c) => {
      if (!contaPagarEhComissao(c) || contaPagarEstaCancelada(c)) return false;
      const fornLimpo = String(c.fornecedor || '')
        .replace(/^Vend\.\s*/i, '')
        .trim()
        .toLowerCase();
      return (nomeNorm && fornLimpo === nomeNorm) || (userNorm && fornLimpo === userNorm);
    });
    const pendentes = doVendedor.filter((c) => c.status !== 'PAGO');
    const pagas = doVendedor.filter((c) => c.status === 'PAGO');
    const totalPendente = pendentes.reduce((acc, c) => acc + (Number(c.valor) || 0), 0);
    return { pendentes, pagas, totalPendente };
  }, [isVendedor, sessao.usuario.nome, sessao.usuario.username, snapshot.contasPagar]);

  const gestoresDisponiveis = useMemo(
    () =>
      (snapshot.usuarios || []).filter(
        (u) =>
          u.ativo !== false &&
          (u.perfil === 'DONO' || u.perfil === 'GERENTE' || u.perfil === 'ADMIN')
      ),
    [snapshot.usuarios]
  );

  // Busca no Painel Inteligente
  const [buscaPi, setBuscaPi] = useState('');
  const [busy, setBusy] = useState(false);

  // Modais
  const [modalClienteAberto, setModalClienteAberto] = useState(false);
  const [modalConfAberto, setModalConfAberto] = useState(false);
  const [modalFiscalAberto, setModalFiscalAberto] = useState(false);
  const [modalRelatoriosAberto, setModalRelatoriosAberto] = useState(false);

  // States Conferência de Caixa
  const [modoBaseConf, setModoBaseConf] = useState<'DINHEIRO_GAVETA' | 'GERAL'>('DINHEIRO_GAVETA');
  const [saldoContado, setSaldoContado] = useState(previaConf.saldoDinheiroGaveta.toFixed(2));
  const [gestorDestinatario, setGestorDestinatario] = useState('');
  const [autoAprovarConf, setAutoAprovarConf] = useState(isGestor);
  const [obsConf, setObsConf] = useState('');

  // States Modal Central de Relatórios
  const hojeYmd = useMemo(obterHojeYmd, []);
  const mesAtualYm = useMemo(obterMesAtualYm, []);
  const mesAnteriorYm = useMemo(obterMesAnteriorYm, []);
  const [catRelatorio, setCatRelatorio] = useState<CategoriaRelatorio>('Financeiro');
  const [presetRel, setPresetRel] = useState<PresetRelatorio>('ESTE_MES');
  const [dataIniRel, setDataIniRel] = useState(`${mesAtualYm}-01`);
  const [dataFimRel, setDataFimRel] = useState(hojeYmd);

  // Auto-abrir Modal Fiscal quando clicado pelo Banner da Visão Geral
  useEffect(() => {
    if (abrirFiscalAoEntrar && podeVerGestao) {
      setModalFiscalAberto(true);
      onLimparAbrirFiscal();
    }
  }, [abrirFiscalAoEntrar, podeVerGestao, onLimparAbrirFiscal]);

  // Definir gestor destinatário padrão
  useEffect(() => {
    if (!gestorDestinatario && gestoresDisponiveis.length > 0) {
      const proprio = gestoresDisponiveis.find((g) => g.id === sessao.usuario.id);
      setGestorDestinatario((proprio || gestoresDisponiveis[0]).nome);
    }
  }, [gestoresDisponiveis, gestorDestinatario, sessao.usuario.id]);

  const driveUrlEfetiva = snapshot.configsExtras.driveUrl || statusSync.drivePastaUrl || '';

  const filtroRelatorio = useMemo<FiltroRelatorio>(() => {
    if (presetRel === 'ESTE_MES') {
      return {
        categoria: catRelatorio,
        modo: 'MES',
        mesReferencia: mesAtualYm,
        dataInicio: `${mesAtualYm}-01`,
        dataFim: hojeYmd,
        periodoRapido: 'MES_ATUAL'
      };
    }
    if (presetRel === 'MES_ANTERIOR') {
      return {
        categoria: catRelatorio,
        modo: 'MES',
        mesReferencia: mesAnteriorYm,
        dataInicio: `${mesAnteriorYm}-01`,
        dataFim: hojeYmd,
        periodoRapido: '30_DIAS'
      };
    }
    if (presetRel === 'HOJE') {
      return {
        categoria: catRelatorio,
        modo: 'PERIODO',
        mesReferencia: mesAtualYm,
        dataInicio: hojeYmd,
        dataFim: hojeYmd,
        periodoRapido: 'HOJE'
      };
    }
    if (presetRel === '7_DIAS') {
      return {
        categoria: catRelatorio,
        modo: 'PERIODO',
        mesReferencia: mesAtualYm,
        dataInicio: `${mesAtualYm}-01`,
        dataFim: hojeYmd,
        periodoRapido: '7_DIAS'
      };
    }
    if (presetRel === 'TUDO') {
      return {
        categoria: catRelatorio,
        modo: 'DATA_A_DATA',
        mesReferencia: mesAtualYm,
        dataInicio: '2000-01-01',
        dataFim: '2099-12-31',
        periodoRapido: '30_DIAS'
      };
    }
    return {
      categoria: catRelatorio,
      modo: 'DATA_A_DATA',
      mesReferencia: mesAtualYm,
      dataInicio: dataIniRel || `${mesAtualYm}-01`,
      dataFim: dataFimRel || hojeYmd,
      periodoRapido: '30_DIAS'
    };
  }, [catRelatorio, presetRel, mesAtualYm, mesAnteriorYm, hojeYmd, dataIniRel, dataFimRel]);

  const relatorioGerado = useMemo(
    () => gerarRelatorioFiltrado(snapshot, filtroRelatorio),
    [snapshot, filtroRelatorio]
  );

  function abrirModalConferencia() {
    setModoBaseConf('DINHEIRO_GAVETA');
    setSaldoContado(previaConf.saldoDinheiroGaveta.toFixed(2));
    setAutoAprovarConf(isGestor);
    setModalConfAberto(true);
  }

  function alternarModoBaseConf(novoModo: 'DINHEIRO_GAVETA' | 'GERAL') {
    setModoBaseConf(novoModo);
    setSaldoContado(
      (novoModo === 'DINHEIRO_GAVETA' ? previaConf.saldoDinheiroGaveta : previaConf.saldoSistema).toFixed(2)
    );
  }

  function ajustarValorContado(delta: number) {
    const atual = parseFloat(saldoContado) || 0;
    setSaldoContado(Math.max(0, atual + delta).toFixed(2));
  }

  async function handleConfirmarConferencia() {
    const valorNum = parseFloat(saldoContado);
    if (!Number.isFinite(valorNum) || valorNum < 0) {
      onNotify('Informe um valor contado válido.', 'warning');
      return;
    }

    const tags: string[] = [];
    if (gestorDestinatario) tags.push(`Gestor: ${gestorDestinatario}`);
    if (isGestor) tags.push(`Auto-Aprovado: ${autoAprovarConf ? 'SIM' : 'NÃO'}`);
    const obsComMetadados = [tags.join(' | '), obsConf.trim()].filter(Boolean).join(' — ');

    setBusy(true);
    try {
      const res = await registrarConferenciaCaixa(
        sessao,
        valorNum,
        previaConf,
        obsComMetadados,
        snapshot.empresa,
        modoBaseConf
      );
      if (res.ok) {
        setObsConf('');
        setModalConfAberto(false);
        onNotify(res.msg, 'success');
        await onAtualizar();
      } else {
        onNotify(res.msg, 'error');
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmarFiscal() {
    setBusy(true);
    try {
      const res = await registrarFechamentoFiscal(sessao, previaFiscal, snapshot.empresa);
      if (res.ok) {
        setModalFiscalAberto(false);
        onNotify(res.msg, 'success');
        await onAtualizar();
      } else {
        onNotify(res.msg, 'error');
      }
    } finally {
      setBusy(false);
    }
  }

  function abrirModalRelatorio(cat: CategoriaRelatorio) {
    setCatRelatorio(cat);
    setModalRelatoriosAberto(true);
  }

  async function executarAcaoComBusy(fn: () => Promise<void> | void) {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }

  function handleAbrirDrive() {
    if (driveUrlEfetiva) {
      window.open(driveUrlEfetiva, '_blank', 'noopener,noreferrer');
    } else {
      onNotify(
        'URL do Google Drive ainda não configurada. Acesse Configurações para informar a DRIVE_URL.',
        'warning'
      );
    }
  }

  // ==================== SEÇÕES DO PAINEL INTELIGENTE ====================
  const secoes = useMemo(() => {
    const lista: Array<{ id: string; titulo: string; cards: CardPainel[] }> = [
      {
        id: 'acoes',
        titulo: '⚡ Ações Rápidas',
        cards: [
          {
            id: 'novo-cliente',
            titulo: '+ Novo Cliente',
            subtitulo: 'Cadastro rápido para vendas e fiado',
            keywords: 'cliente cadastro fiado consumidor',
            icone: <UserPlus size={20} color="#c4b5fd" />,
            onClick: () => setModalClienteAberto(true)
          },
          ...(isVendedor
            ? []
            : [
                {
                  id: 'novo-produto',
                  titulo: '+ Novo Produto',
                  subtitulo: 'Acessar catálogo, preços e estoque',
                  keywords: 'produto cadastrar item estoque catalogo',
                  icone: <PackagePlus size={20} color="#34d399" />,
                  onClick: () => onIrAba('estoque')
                },
                {
                  id: 'registrar-compra',
                  titulo: 'Compras',
                  subtitulo: 'Registrar entrada de mercadoria e NF',
                  keywords: 'compras entrada mercadoria fornecedor nota fiscal',
                  icone: <ShoppingBag size={20} color="#38bdf8" />,
                  onClick: () => (onAbrirCompra ? onAbrirCompra() : onIrAba('estoque'))
                }
              ]),
          {
            id: 'ir-pdv',
            titulo: 'PDV / Nova Venda',
            subtitulo: 'Abrir frente de caixa rápido (F2)',
            keywords: 'pdv venda caixa balcao',
            icone: <ShoppingCart size={20} color="#38bdf8" />,
            onClick: () => onIrAba('pdv')
          },
          {
            id: 'ir-comandas',
            titulo: 'Comandas Balcão',
            subtitulo: 'Gerenciar mesas e contas abertas',
            keywords: 'comanda mesa balcao conta',
            icone: <ClipboardList size={20} color="#fbbf24" />,
            onClick: () => onIrAba('comandas')
          },
          {
            id: 'ir-delivery',
            titulo: 'Delivery',
            subtitulo: 'Pedidos em rota e entregas',
            keywords: 'delivery entrega moto rota pedido',
            icone: <Bike size={20} color="#f472b6" />,
            onClick: () => onIrAba('delivery')
          }
        ]
      },
      {
        id: 'controle',
        titulo: '🛅 Controle & Auditoria',
        cards: [
          ...(isVendedor
            ? [
                {
                  id: 'minhas-comissoes',
                  titulo: 'Minhas Comissões a Receber',
                  subtitulo: `${minhasComissoes.pendentes.length} pendente(s) • ${formatarMoeda(
                    minhasComissoes.totalPendente
                  )}`,
                  keywords: 'comissao comissoes vendedor receber 10%',
                  icone: <Wallet size={20} color="#34d399" />,
                  onClick: () => setModalComissoesVendedor(true)
                }
              ]
            : []),
          {
            id: 'conferencia-caixa',
            titulo: 'Conferência de Caixa',
            subtitulo: `Saldo sistema hoje: ${formatarMoeda(previaConf.saldoSistema)}`,
            keywords: 'conferencia caixa gaveta turno operador fechar',
            icone: <Calculator size={20} color="#38bdf8" />,
            onClick: abrirModalConferencia
          },
          ...(podeVerGestao
            ? [
                {
                  id: 'fechamento-fiscal',
                  titulo: 'Fechamento Fiscal do Mês',
                  subtitulo: `Competência ${previaFiscal.periodoReferencia} • Saldo ${formatarMoeda(
                    previaFiscal.saldo
                  )}`,
                  keywords: 'fechamento fiscal mes competencia consolidar',
                  danger: true,
                  icone: <FileCheck2 size={20} color="#f87171" />,
                  onClick: () => setModalFiscalAberto(true)
                },
                {
                  id: 'auditoria-logs',
                  titulo: 'Auditoria & Logs',
                  subtitulo: `${snapshot.logs.length} registros recentes de atividade`,
                  keywords: 'auditoria logs historico acoes sistema',
                  icone: <History size={20} color="#c4b5fd" />,
                  onClick: () => {
                    document
                      .getElementById('secaoLogsAuditoria')
                      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }
              ]
            : [])
        ]
      }
    ];

    if (podeVerGestao) {
      lista.push(
        {
          id: 'estoque-fin',
          titulo: '📦 Estoque Financeiro & Produtos',
          cards: [
            {
              id: 'recalcular-estoque',
              titulo: 'Recalcular Valores Estoque',
              subtitulo: 'Atualizar totais, margens e capital investido',
              keywords: 'recalcular estoque valores custo venda',
              icone: <RefreshCw size={20} color="#34d399" />,
              onClick: () => void executarAcaoComBusy(onRecalcularEstoque)
            },
            {
              id: 'gestao-estoque',
              titulo: 'Gestão de Estoque & Margens',
              subtitulo: `${snapshot.produtos.length} itens • ${snapshot.kpis.produtosBaixoEstoque} críticos`,
              keywords: 'estoque produtos margem lucro preco',
              icone: <Package size={20} color="#fbbf24" />,
              onClick: () => onIrAba('estoque')
            }
          ]
        },
        {
          id: 'relatorios',
          titulo: '📚 Relatórios Gerenciais',
          cards: [
            {
              id: 'rel-financeiro',
              titulo: 'Relatório Financeiro',
              subtitulo: 'Entradas, saídas e apuração por período',
              keywords: 'relatorio financeiro caixa faturamento pdf',
              icone: <FileSpreadsheet size={20} color="#34d399" />,
              onClick: () => abrirModalRelatorio('Financeiro')
            },
            {
              id: 'rel-estoque',
              titulo: 'Relatório de Estoque',
              subtitulo: 'Inventário, custo médio e preços',
              keywords: 'relatorio estoque inventario produtos pdf',
              icone: <Package size={20} color="#38bdf8" />,
              onClick: () => abrirModalRelatorio('Estoque')
            },
            {
              id: 'rel-compras',
              titulo: 'Relatório de Compras',
              subtitulo: 'Contas a pagar e compras de fornecedores',
              keywords: 'relatorio compras pagar fornecedores pdf',
              icone: <ShoppingCart size={20} color="#fbbf24" />,
              onClick: () => abrirModalRelatorio('Compras')
            },
            {
              id: 'rel-auditoria',
              titulo: 'Relatório Auditoria & Logs',
              subtitulo: 'Trilha completa de conferências e eventos',
              keywords: 'relatorio auditoria logs seguranca pdf',
              icone: <ShieldCheck size={20} color="#c4b5fd" />,
              onClick: () => abrirModalRelatorio('Auditoria_Logs')
            },
            {
              id: 'rel-pacote',
              titulo: 'Pacote Completo (4 PDFs)',
              subtitulo: 'Baixar todos os 4 relatórios gerenciais',
              keywords: 'pacote completo 4 pdfs baixar tudo',
              icone: <Layers size={20} color="#f472b6" />,
              onClick: () => void executarAcaoComBusy(onGerarPacoteRelatorios)
            }
          ]
        },
        {
          id: 'sistema',
          titulo: '🖥️ Sistema',
          cards: [
            {
              id: 'backup-local',
              titulo: 'Backup JSON no PC',
              subtitulo: statusSync.pastaLocalConectada
                ? `Pasta conectada: ${statusSync.pastaLocalNome}`
                : 'Conecte uma pasta local em Configurações',
              keywords: 'backup json pc local exportar',
              icone: <HardDriveDownload size={20} color="#38bdf8" />,
              onClick: () => void executarAcaoComBusy(onFazerBackupLocal)
            },
            {
              id: 'sync-drive',
              titulo: 'Atualizar Planilha Espelho',
              subtitulo: statusSync.driveConectado
                ? 'Sincronizar espelho no Google Drive'
                : 'Conecte o Google Drive em Configurações',
              keywords: 'planilha espelho drive sincronizar atualizar',
              icone: <Cloud size={20} color="#34d399" />,
              onClick: () => void executarAcaoComBusy(onSincronizarDrive)
            },
            {
              id: 'abrir-drive',
              titulo: 'Abrir Pasta no Google Drive',
              subtitulo: driveUrlEfetiva
                ? 'Abrir diretório oficial na nuvem'
                : 'Configure a DRIVE_URL em Configurações',
              keywords: 'google drive pasta link abrir nuvem',
              icone: <ExternalLink size={20} color="#fbbf24" />,
              onClick: handleAbrirDrive
            },
            {
              id: 'ir-config',
              titulo: 'Configurações do Sistema',
              subtitulo: 'Empresa, PIX BCB, Telegram, Refresh e Rede',
              keywords: 'configuracoes pix bcb telegram drive refresh empresa',
              icone: <Settings size={20} color="#c4b5fd" />,
              onClick: () => onIrAba('config')
            }
          ]
        }
      );
    }

    return lista;
  }, [
    podeVerGestao,
    previaConf.saldoSistema,
    previaFiscal.periodoReferencia,
    previaFiscal.saldo,
    snapshot.logs.length,
    snapshot.produtos.length,
    snapshot.kpis.produtosBaixoEstoque,
    statusSync.pastaLocalConectada,
    statusSync.pastaLocalNome,
    statusSync.driveConectado,
    driveUrlEfetiva
  ]);

  const termoBusca = buscaPi.trim().toLowerCase();
  const secoesFiltradas = useMemo(() => {
    if (!termoBusca) return secoes;
    return secoes
      .map((s) => ({
        ...s,
        cards: s.cards.filter(
          (c) =>
            c.titulo.toLowerCase().includes(termoBusca) ||
            c.subtitulo.toLowerCase().includes(termoBusca) ||
            c.keywords.toLowerCase().includes(termoBusca) ||
            s.titulo.toLowerCase().includes(termoBusca)
        )
      }))
      .filter((s) => s.cards.length > 0);
  }, [secoes, termoBusca]);

  const baseEsperadaConf =
    modoBaseConf === 'DINHEIRO_GAVETA' ? previaConf.saldoDinheiroGaveta : previaConf.saldoSistema;
  const diferenca = (parseFloat(saldoContado) || 0) - baseEsperadaConf;
  const difSemDivergencia = Math.abs(diferenca) < 0.01;
  const difSobra = !difSemDivergencia && diferenca > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* BARRA DE BUSCA NO PAINEL INTELIGENTE */}
      <div
        className="panel-card"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12
        }}
      >
        <div>
          <h3 style={{ fontSize: 17, fontWeight: 800 }}>🧠 Painel Inteligente &amp; Central 360°</h3>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            Acesso rápido a operações, auditorias, fechamentos fiscais, relatórios e backup.
          </p>
        </div>

        <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: 420 }}>
          <Search
            size={15}
            color="#94a3b8"
            style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            id="buscaPainelInteligente"
            type="text"
            className="field-input"
            style={{ paddingLeft: 34 }}
            placeholder="🔍 Buscar ação, relatório, conferência, fiscal..."
            value={buscaPi}
            onChange={(e) => setBuscaPi(e.target.value)}
          />
        </div>
      </div>

      {/* 5 SEÇÕES DO PAINEL INTELIGENTE */}
      {secoesFiltradas.length === 0 ? (
        <div className="panel-card" style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
          Nenhuma ação encontrada para "{buscaPi}".
        </div>
      ) : (
        secoesFiltradas.map((secao) => (
          <section key={secao.id} className="pi-secao">
            <div className="pi-secao-titulo">{secao.titulo}</div>
            <div className="pi-grid">
              {secao.cards.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  disabled={busy}
                  className={`pi-card ${card.danger ? 'pi-card-danger' : ''}`}
                  onClick={card.onClick}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: card.danger
                        ? 'rgba(239, 68, 68, 0.16)'
                        : 'rgba(139, 92, 246, 0.14)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    {card.icone}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-main)' }}>
                      {card.titulo}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.35 }}>
                      {card.subtitulo}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ))
      )}

      {/* AUDITORIA & LOGS COMPACTOS (SOMENTE GESTÃO) */}
      {podeVerGestao && (
        <div id="secaoLogsAuditoria" className="panel-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <History size={17} color="#c4b5fd" />
              <span>Auditoria &amp; Logs do Sistema</span>
            </h3>
            <span className="badge badge-purple">Últimos 20 eventos</span>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Data/Hora</th>
                  <th>Usuário</th>
                  <th>Ação</th>
                  <th>Canal</th>
                  <th>Detalhes</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>
                      Nenhum log registrado até o momento.
                    </td>
                  </tr>
                ) : (
                  snapshot.logs.slice(0, 20).map((lg) => (
                    <tr key={lg.id}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>
                        {formatarDataHoraBr(lg.data_hora)}
                      </td>
                      <td style={{ fontWeight: 600 }}>{lg.usuario || '--'}</td>
                      <td>
                        <span className="badge badge-purple">{lg.acao}</span>
                      </td>
                      <td>{lg.canal}</td>
                      <td>{lg.detalhes}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= MODAL PRÉVIA CONFERÊNCIA DE CAIXA ================= */}
      {modalConfAberto && (
        <div className="modal-overlay" style={{ zIndex: 85 }}>
          <div className="panel-card" style={{ maxWidth: 640, width: '100%', maxHeight: '92vh', overflowY: 'auto', borderColor: 'var(--border-accent)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 17, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Calculator size={18} color="#38bdf8" />
                <span>Prévia &amp; Conferência de Caixa</span>
              </h3>
              <button
                type="button"
                className="btn"
                style={{ padding: 6 }}
                onClick={() => setModalConfAberto(false)}
              >
                <X size={15} />
              </button>
            </div>

            <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 12 }}>
              <div className="kpi-card kpi-left-ok" style={{ padding: 10 }}>
                <div className="kpi-label">Entradas Hoje</div>
                <strong style={{ color: '#34d399', fontSize: 15 }}>
                  {formatarMoeda(previaConf.entradasHoje)}
                </strong>
              </div>
              <div className="kpi-card kpi-left-danger" style={{ padding: 10 }}>
                <div className="kpi-label">Saídas Hoje</div>
                <strong style={{ color: '#f87171', fontSize: 15 }}>
                  {formatarMoeda(previaConf.saidasHoje)}
                </strong>
              </div>
              <div className="kpi-card kpi-left-info" style={{ padding: 10 }}>
                <div className="kpi-label">Saldo Geral</div>
                <strong style={{ color: '#38bdf8', fontSize: 15 }}>
                  {formatarMoeda(previaConf.saldoSistema)}
                </strong>
              </div>
              <div className="kpi-card kpi-left-warn" style={{ padding: 10 }}>
                <div className="kpi-label">💵 Gaveta (Dinheiro)</div>
                <strong style={{ color: '#fbbf24', fontSize: 15 }}>
                  {formatarMoeda(previaConf.saldoDinheiroGaveta)}
                </strong>
              </div>
            </div>

            {/* DISCRIMINAÇÃO POR FORMA DE PAGAMENTO */}
            <div
              style={{
                background: 'rgba(15, 23, 42, 0.72)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 10,
                padding: 10,
                marginBottom: 12
              }}
            >
              <div style={{ fontSize: 11.5, fontWeight: 700, color: '#cbd5e1', marginBottom: 8, textTransform: 'uppercase' }}>
                📊 Recebimentos Discriminados por Forma de Pagamento
              </div>
              {previaConf.porFormaPagamento.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Nenhum recebimento registrado hoje.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
                  {previaConf.porFormaPagamento.map((fp) => (
                    <div
                      key={fp.forma}
                      style={{
                        background: 'rgba(30, 41, 59, 0.75)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 8,
                        padding: '7px 10px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#f8fafc' }}>{fp.forma}</div>
                        <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                          {fp.qtd} {fp.qtd === 1 ? 'lançamento' : 'lançamentos'}
                        </div>
                      </div>
                      <strong style={{ color: '#34d399', fontSize: 13.5 }}>
                        {formatarMoeda(fp.valor)}
                      </strong>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* EXTRATO DESCRITO DE CADA RECEBIMENTO / SAÍDA DE HOJE */}
            <div
              style={{
                background: 'rgba(15, 23, 42, 0.72)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 10,
                padding: 10,
                marginBottom: 12
              }}
            >
              <div style={{ fontSize: 11.5, fontWeight: 700, color: '#cbd5e1', marginBottom: 8, textTransform: 'uppercase', display: 'flex', justifyContent: 'space-between' }}>
                <span>🧾 Detalhamento Individual dos Recebimentos de Hoje ({previaConf.movimentosHoje.length})</span>
                <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>Hora • Forma • Descrição • Valor</span>
              </div>
              {previaConf.movimentosHoje.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: 10 }}>
                  Nenhuma movimentação registrada hoje.
                </div>
              ) : (
                <div className="table-wrap" style={{ maxHeight: 165, overflowY: 'auto' }}>
                  <table className="data-table" style={{ fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th>Hora</th>
                        <th>Forma</th>
                        <th>Descrição / Origem</th>
                        <th style={{ textAlign: 'right' }}>Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previaConf.movimentosHoje.map((m) => (
                        <tr key={m.id}>
                          <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                            {formatarDataHoraBr(m.data_hora).split(' ')[1] || formatarDataHoraBr(m.data_hora)}
                          </td>
                          <td>
                            <span className="badge badge-purple">{m.forma_pagamento || 'Outros'}</span>
                          </td>
                          <td style={{ fontWeight: 600 }}>{m.descricao || m.origem}</td>
                          <td
                            style={{
                              textAlign: 'right',
                              fontWeight: 700,
                              color: m.tipo === 'ENTRADA' ? '#34d399' : '#f87171',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {m.tipo === 'ENTRADA' ? '+' : '-'} {formatarMoeda(m.valor)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                  <label className="field-label" style={{ marginBottom: 0 }}>
                    {modoBaseConf === 'DINHEIRO_GAVETA'
                      ? '💵 Dinheiro Físico Contado na Gaveta (R$)'
                      : '💰 Valor Total Contado (Todas as Formas) (R$)'}
                  </label>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      type="button"
                      className={`btn btn-xs ${modoBaseConf === 'DINHEIRO_GAVETA' ? 'btn-primary' : ''}`}
                      onClick={() => alternarModoBaseConf('DINHEIRO_GAVETA')}
                    >
                      💵 Conferir Só Gaveta ({formatarMoeda(previaConf.saldoDinheiroGaveta)})
                    </button>
                    <button
                      type="button"
                      className={`btn btn-xs ${modoBaseConf === 'GERAL' ? 'btn-primary' : ''}`}
                      onClick={() => alternarModoBaseConf('GERAL')}
                    >
                      📊 Conferir Total Geral ({formatarMoeda(previaConf.saldoSistema)})
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <button
                    type="button"
                    className="btn btn-xs"
                    onClick={() => ajustarValorContado(-10)}
                  >
                    <Minus size={12} /> 10
                  </button>
                  <input
                    type="number"
                    step="0.01"
                    className="field-input"
                    style={{ flex: 1, minWidth: 140, fontSize: 16, fontWeight: 700 }}
                    value={saldoContado}
                    onChange={(e) => setSaldoContado(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-xs"
                    onClick={() => ajustarValorContado(10)}
                  >
                    <Plus size={12} /> 10
                  </button>
                  <button
                    type="button"
                    className="btn btn-xs"
                    onClick={() => setSaldoContado(baseEsperadaConf.toFixed(2))}
                  >
                    Igualar ao Esperado ({formatarMoeda(baseEsperadaConf)})
                  </button>
                </div>
              </div>

              {/* CAIXA DINÂMICA DE DIVERGÊNCIA */}
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: `1px solid ${
                    difSemDivergencia
                      ? 'rgba(16,185,129,0.45)'
                      : difSobra
                        ? 'rgba(245,158,11,0.45)'
                        : 'rgba(239,68,68,0.5)'
                  }`,
                  background: difSemDivergencia
                    ? 'rgba(16,185,129,0.12)'
                    : difSobra
                      ? 'rgba(245,158,11,0.12)'
                      : 'rgba(239,68,68,0.12)',
                  color: difSemDivergencia ? '#34d399' : difSobra ? '#fbbf24' : '#f87171',
                  fontSize: 13,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {difSemDivergencia ? <CheckCircle2 size={16} /> : <ShieldAlert size={16} />}
                  {difSemDivergencia
                    ? 'Caixa batido! Sem divergência.'
                    : difSobra
                      ? 'Sobra de caixa detectada'
                      : 'Falta / quebra de caixa detectada'}
                </span>
                <span>{formatarMoeda(diferenca)}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
                <div>
                  <label className="field-label">Gestor Destinatário para Validação</label>
                  <select
                    className="field-select"
                    value={gestorDestinatario}
                    onChange={(e) => setGestorDestinatario(e.target.value)}
                  >
                    {gestoresDisponiveis.length === 0 ? (
                      <option value={sessao.usuario.nome}>{sessao.usuario.nome}</option>
                    ) : (
                      gestoresDisponiveis.map((g) => (
                        <option key={g.id} value={g.nome}>
                          {g.nome} ({g.perfil})
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {isGestor && (
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 13,
                      color: 'var(--text-main)',
                      cursor: 'pointer'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={autoAprovarConf}
                      onChange={(e) => setAutoAprovarConf(e.target.checked)}
                    />
                    <span>Auto-Aprovar Conferência imediatamente (perfil gestor)</span>
                  </label>
                )}

                <div>
                  <label className="field-label">Observação da Conferência</label>
                  <input
                    className="field-input"
                    placeholder="Ex: Caixa conferido no fechamento do turno"
                    value={obsConf}
                    onChange={(e) => setObsConf(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <button type="button" className="btn" onClick={() => setModalConfAberto(false)}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleConfirmarConferencia}
                  disabled={busy}
                >
                  <ShieldCheck size={15} /> {busy ? 'Gravando...' : 'Confirmar Conferência'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL PRÉVIA FECHAMENTO FISCAL ================= */}
      {modalFiscalAberto && (
        <div className="modal-overlay" style={{ zIndex: 85 }}>
          <div className="panel-card" style={{ maxWidth: 540, width: '100%', borderColor: 'rgba(244,63,94,0.45)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 17, display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileCheck2 size={18} color="#34d399" />
                <span>Prévia de Fechamento Fiscal ({previaFiscal.periodoReferencia})</span>
              </h3>
              <button
                type="button"
                className="btn"
                style={{ padding: 6 }}
                onClick={() => setModalFiscalAberto(false)}
              >
                <X size={15} />
              </button>
            </div>

            <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 14 }}>
              <div className="kpi-card kpi-left-ok" style={{ padding: 10 }}>
                <div className="kpi-label">Entradas Mês</div>
                <strong style={{ color: '#34d399', fontSize: 16 }}>
                  {formatarMoeda(previaFiscal.entradas)}
                </strong>
              </div>
              <div className="kpi-card kpi-left-danger" style={{ padding: 10 }}>
                <div className="kpi-label">Saídas Mês</div>
                <strong style={{ color: '#f87171', fontSize: 16 }}>
                  {formatarMoeda(previaFiscal.saidas)}
                </strong>
              </div>
              <div className="kpi-card kpi-left-purple" style={{ padding: 10 }}>
                <div className="kpi-label">Saldo Líquido</div>
                <strong style={{ color: '#c4b5fd', fontSize: 16 }}>
                  {formatarMoeda(previaFiscal.saldo)}
                </strong>
              </div>
            </div>

            <div
              style={{
                background: 'rgba(30, 41, 59, 0.65)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 12,
                padding: 12,
                fontSize: 13,
                color: 'var(--text-muted)',
                lineHeight: 1.6,
                marginBottom: 14
              }}
            >
              <div>
                Responsável: <strong style={{ color: 'var(--text-main)' }}>{previaFiscal.responsavel}</strong>
              </div>
              <div>
                Lançamentos no período:{' '}
                <strong style={{ color: 'var(--text-main)' }}>{previaFiscal.qtdMovimentos}</strong>
              </div>
              {snapshot.ultimoFechamentoFiscal && (
                <div>
                  Último fechamento registrado:{' '}
                  <strong style={{ color: '#fbbf24' }}>{snapshot.ultimoFechamentoFiscal}</strong>
                </div>
              )}
              <div style={{ marginTop: 6, fontSize: 12 }}>
                Ao confirmar, o marco fiscal será gravado na auditoria da unidade e notificado ao Telegram configurado.
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" className="btn" onClick={() => setModalFiscalAberto(false)}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-success"
                onClick={handleConfirmarFiscal}
                disabled={busy}
              >
                <FileCheck2 size={15} /> {busy ? 'Consolidando...' : 'Confirmar Fechamento Fiscal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL CENTRAL DE RELATÓRIOS ================= */}
      {modalRelatoriosAberto && (
        <div className="modal-overlay" style={{ zIndex: 85 }}>
          <div
            className="panel-card"
            style={{
              maxWidth: 940,
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              borderColor: 'var(--border-accent)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 17, display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileSpreadsheet size={18} color="#34d399" />
                <span>Central de Relatórios — {relatorioGerado.titulo}</span>
              </h3>
              <button
                type="button"
                className="btn"
                style={{ padding: 6 }}
                onClick={() => setModalRelatoriosAberto(false)}
              >
                <X size={15} />
              </button>
            </div>

            {/* SELETOR DE CATEGORIA + PERÍODOS RÁPIDOS */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {(
                  [
                    ['Financeiro', 'Financeiro'],
                    ['Estoque', 'Estoque'],
                    ['Compras', 'Compras'],
                    ['Auditoria_Logs', 'Auditoria & Logs']
                  ] as [CategoriaRelatorio, string][]
                ).map(([c, label]) => (
                  <button
                    key={c}
                    type="button"
                    className={`btn btn-xs ${catRelatorio === c ? 'btn-primary' : ''}`}
                    onClick={() => setCatRelatorio(c)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                <Calendar size={14} color="#94a3b8" />
                {(
                  [
                    ['ESTE_MES', 'Este Mês'],
                    ['MES_ANTERIOR', 'Mês Anterior'],
                    ['HOJE', 'Hoje'],
                    ['7_DIAS', 'Últimos 7 Dias'],
                    ['PERSONALIZADO', 'Personalizado Data a Data'],
                    ['TUDO', 'Histórico Completo (Tudo)']
                  ] as [PresetRelatorio, string][]
                ).map(([p, label]) => (
                  <button
                    key={p}
                    type="button"
                    className={`btn btn-xs ${presetRel === p ? 'btn-success' : ''}`}
                    onClick={() => setPresetRel(p)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {presetRel === 'PERSONALIZADO' && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
                  <div>
                    <label className="field-label">Data Inicial</label>
                    <input
                      type="date"
                      className="field-input"
                      value={dataIniRel}
                      onChange={(e) => setDataIniRel(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="field-label">Data Final</label>
                    <input
                      type="date"
                      className="field-input"
                      value={dataFimRel}
                      onChange={(e) => setDataFimRel(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 4 KPIS DO RELATÓRIO */}
            <div className="kpi-grid" style={{ marginBottom: 14 }}>
              {relatorioGerado.resumo.map((r) => (
                <div key={r.label} className="kpi-card" style={{ padding: 10 }}>
                  <div className="kpi-label">{r.label}</div>
                  <div className="kpi-value" style={{ fontSize: 18 }}>
                    {r.valor}
                  </div>
                </div>
              ))}
            </div>

            {/* AÇÕES DE EXPORTAÇÃO */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  baixarPdfRelatorio(relatorioGerado, snapshot.empresa.nome);
                  onNotify(`PDF "${relatorioGerado.nomeArquivoPdf}" baixado!`, 'success');
                }}
              >
                <FileDown size={14} /> Baixar PDF
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => imprimirPdfRelatorioA4(relatorioGerado, snapshot.empresa.nome)}
              >
                <Printer size={14} /> Imprimir A4
              </button>
              <button
                type="button"
                className="btn"
                onClick={async () => {
                  const res = await compartilharRelatorioMultiDispositivo(
                    relatorioGerado,
                    snapshot.empresa.nome
                  );
                  onNotify(res.msg, res.ok ? 'success' : 'info');
                }}
              >
                <Share2 size={14} /> Compartilhar
              </button>
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={() =>
                  void executarAcaoComBusy(async () => {
                    const blob = gerarPdfBlobRelatorio(relatorioGerado, snapshot.empresa.nome);
                    const res = await salvarArquivoNaPastaLocal(
                      snapshot.empresa.nome,
                      relatorioGerado.categoria,
                      relatorioGerado.subpastaMes,
                      relatorioGerado.nomeArquivoPdf,
                      blob
                    );
                    onNotify(res.msg, res.ok ? 'success' : 'warning');
                  })
                }
              >
                <FolderDown size={14} /> Pasta PC
              </button>
              <button
                type="button"
                className="btn btn-success"
                disabled={busy}
                onClick={() =>
                  void executarAcaoComBusy(async () => {
                    const blob = gerarPdfBlobRelatorio(relatorioGerado, snapshot.empresa.nome);
                    const res = await enviarPdfParaGoogleDrive(
                      snapshot.empresa.id,
                      snapshot.empresa.nome,
                      relatorioGerado.categoria,
                      relatorioGerado.subpastaMes,
                      relatorioGerado.nomeArquivoPdf,
                      blob
                    );
                    onNotify(res.msg, res.ok ? 'success' : 'warning');
                  })
                }
              >
                <CloudUpload size={14} /> Salvar Drive
              </button>
            </div>

            {/* PRÉVIA TABULAR (ATÉ 50 LINHAS) */}
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    {relatorioGerado.colunas.map((col) => (
                      <th key={col}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {relatorioGerado.linhas.length === 0 ? (
                    <tr>
                      <td
                        colSpan={relatorioGerado.colunas.length || 1}
                        style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}
                      >
                        Nenhum registro encontrado para o período selecionado.
                      </td>
                    </tr>
                  ) : (
                    relatorioGerado.linhas.slice(0, 50).map((linha, idx) => (
                      <tr key={idx}>
                        {linha.map((cel, cIdx) => (
                          <td key={cIdx}>{cel}</td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {relatorioGerado.linhas.length > 50 && (
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                Exibindo 50 de {relatorioGerado.linhas.length} linhas na prévia. O PDF exporta o relatório completo.
              </div>
            )}
          </div>
        </div>
      )}

      {modalComissoesVendedor && isVendedor && (
        <div
          className="modal-overlay"
          style={{ zIndex: 120 }}
          onClick={() => setModalComissoesVendedor(false)}
        >
          <div
            className="panel-card"
            style={{ maxWidth: 560, width: '100%', maxHeight: '88vh', overflowY: 'auto', borderColor: 'var(--border-accent)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 10 }}>
              <div>
                <h3 style={{ fontSize: 17 }}>💼 Minhas Comissões a Receber</h3>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Vendedor: <strong>{sessao.usuario.nome}</strong>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-danger btn-xs"
                onClick={() => setModalComissoesVendedor(false)}
              >
                <X size={15} /> Fechar
              </button>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'rgba(16, 185, 129, 0.12)',
                padding: '12px 14px',
                borderRadius: 10,
                border: '1px solid rgba(16, 185, 129, 0.35)',
                marginBottom: 12
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: '#a7f3d0' }}>
                Total Pendente ({minhasComissoes.pendentes.length}):
              </span>
              <strong style={{ fontSize: 22, color: '#34d399' }}>
                {formatarMoeda(minhasComissoes.totalPendente)}
              </strong>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Descrição</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {[...minhasComissoes.pendentes, ...minhasComissoes.pagas].map((c) => (
                    <tr key={c.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{c.id}</td>
                      <td>{c.descricao}</td>
                      <td>
                        <span className={`badge ${c.status === 'PAGO' ? 'badge-ok' : 'badge-warn'}`}>
                          {c.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#34d399' }}>
                        {formatarMoeda(c.valor)}
                      </td>
                    </tr>
                  ))}
                  {minhasComissoes.pendentes.length === 0 && minhasComissoes.pagas.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        Você ainda não possui comissões registradas.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <ClienteQuickModal
        sessao={sessao}
        aberto={modalClienteAberto}
        onFechar={() => setModalClienteAberto(false)}
        onNotify={onNotify}
        onCriado={async () => {
          await onAtualizar();
        }}
      />
    </div>
  );
}
