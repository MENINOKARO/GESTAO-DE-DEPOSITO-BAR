import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  DollarSign,
  Filter,
  MessageCircle,
  Plus,
  RefreshCw,
  Search,
  Send,
  TrendingDown,
  TrendingUp,
  Wallet,
  X
} from 'lucide-react';
import {
  cadastrarContaPagar,
  cancelarContaPagar,
  contaPagarEhComissao,
  contaPagarEhTaxaEntrega,
  contaPagarEstaCancelada,
  converterFormaPagamentoCaixa,
  movimentoCaixaEstaCancelado,
  pagarContaPagar,
  receberFiado
} from '../services/dataRepository';
import {
  ContaPagar,
  ContaReceber,
  FormaPagamento,
  MovimentoCaixa,
  PainelSnapshot,
  SessaoAtiva
} from '../types/domain';
import { formatarDataBr, formatarDataHoraBr, formatarMoeda } from '../utils/formatters';
import { normalizarChavePixBCB } from '../utils/pixPayload';

interface FinanceiroTabProps {
  sessao: SessaoAtiva;
  snapshot: PainelSnapshot;
  subAbaInicial?: SubAbaFinanceiro;
  subAbaNavTick?: number;
  onNotify: (msg: string, tipo?: 'success' | 'error' | 'info' | 'warning') => void;
  onAtualizar: () => Promise<void>;
}

type SubAbaFinanceiro = 'pagar' | 'receber' | 'caixa';
type FiltroPagar = 'TODAS_PENDENTES' | 'VENCIDAS' | 'VENCE_HOJE' | 'NO_PRAZO' | 'PAGO' | 'CANCELADO' | 'TODAS';
type FiltroReceber = 'TODOS_PENDENTES' | 'PARCIAL' | 'QUITADO' | 'TODOS';
type FiltroCaixa = 'TODOS' | 'ENTRADA' | 'SAIDA';

const FORMAS_PAGAMENTO_SAIDA: string[] = ['Dinheiro', 'PIX', 'Transferência', 'Boleto'];
const FORMAS_RECEBIMENTO: FormaPagamento[] = [
  'Dinheiro',
  'PIX',
  'Cartão Débito',
  'Cartão Crédito',
  'Outro'
];

function obterHojeYmdLocal(): string {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function parseDataLocalMeiaNoite(valor?: string | null): Date | null {
  if (!valor) return null;
  const txt = String(valor).trim();
  const matchYmd = txt.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (matchYmd) {
    return new Date(Number(matchYmd[1]), Number(matchYmd[2]) - 1, Number(matchYmd[3]));
  }
  const matchBr = txt.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (matchBr) {
    return new Date(Number(matchBr[3]), Number(matchBr[2]) - 1, Number(matchBr[1]));
  }
  const dt = new Date(txt);
  if (Number.isNaN(dt.getTime())) return null;
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
}

function calcularDiasDiffVencimento(vencimento?: string | null): number {
  const dtVenc = parseDataLocalMeiaNoite(vencimento);
  if (!dtVenc) return 0;
  const hoje = parseDataLocalMeiaNoite(obterHojeYmdLocal())!;
  return Math.round((dtVenc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
}

function contaPagarEstaPaga(conta: ContaPagar): boolean {
  if (contaPagarEstaCancelada(conta)) return false;
  const st = String(conta.status || '').toUpperCase();
  return st === 'PAGO' || st === 'PAGA' || st === 'QUITADO';
}

function resumoValoresFiado(conta: ContaReceber) {
  const st = String(conta.status || '').toUpperCase();
  const totalOriginal = Number(conta.valor_original ?? conta.valor ?? 0);
  const quitadoStatus = st === 'QUITADO' || st === 'PAGO' || st === 'PAGA';
  const jaPagoBruto =
    conta.valor_recebido !== undefined && conta.valor_recebido !== null
      ? Number(conta.valor_recebido)
      : quitadoStatus
        ? totalOriginal
        : 0;
  const jaPago = Math.max(0, Math.min(totalOriginal, jaPagoBruto));
  const saldoDevedor = quitadoStatus
    ? 0
    : Math.max(0, Number(conta.valor ?? totalOriginal - jaPago));
  const estaQuitado = quitadoStatus || saldoDevedor <= 0.009;
  const estaParcial = !estaQuitado && (st === 'PARCIAL' || jaPago > 0.009);
  return {
    totalOriginal,
    jaPago,
    saldoDevedor,
    estaQuitado,
    estaParcial
  };
}

const modalOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(5, 8, 18, 0.78)',
  backdropFilter: 'blur(8px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
  zIndex: 85
};

const pillBadgeStyle = (bg: string, color: string, border: string): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  padding: '3px 9px',
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 700,
  background: bg,
  color,
  border: `1px solid ${border}`
});

export function FinanceiroTab({
  sessao,
  snapshot,
  subAbaInicial = 'caixa',
  subAbaNavTick = 0,
  onNotify,
  onAtualizar
}: FinanceiroTabProps) {
  const [subAba, setSubAba] = useState<SubAbaFinanceiro>(subAbaInicial);

  useEffect(() => {
    setSubAba(subAbaInicial);
  }, [subAbaInicial, subAbaNavTick]);
  const [busy, setBusy] = useState(false);
  const isDono = String(sessao.usuario.perfil || '').toUpperCase() === 'DONO';
  const podeCancelarPagar = ['DONO', 'ADMIN'].includes(String(sessao.usuario.perfil || '').toUpperCase());
  const [movConverter, setMovConverter] = useState<MovimentoCaixa | null>(null);
  const [novaFormaConverter, setNovaFormaConverter] = useState<Exclude<FormaPagamento, 'Outro'>>('PIX');
  const [contaCancelarModal, setContaCancelarModal] = useState<ContaPagar | null>(null);
  const [motivoCancelamento, setMotivoCancelamento] = useState('');

  // Sub-aba Contas a Pagar
  const [filtroPagar, setFiltroPagar] = useState<FiltroPagar>('TODAS_PENDENTES');
  const [buscaPagar, setBuscaPagar] = useState('');
  const [modalNovaContaOpen, setModalNovaContaOpen] = useState(false);
  const [novaDescricao, setNovaDescricao] = useState('');
  const [novoFornecedor, setNovoFornecedor] = useState('');
  const [novaCategoria, setNovaCategoria] = useState('Fornecedores');
  const [novoValorPagar, setNovoValorPagar] = useState('');
  const [novoVencimento, setNovoVencimento] = useState(obterHojeYmdLocal);
  const [novaFormaPagar, setNovaFormaPagar] = useState('Boleto');
  const [novoTipoDespesa, setNovoTipoDespesa] = useState<'AVULSA' | 'FIXA'>('AVULSA');

  const [contaPagarModal, setContaPagarModal] = useState<ContaPagar | null>(null);
  const [comissoesLoteModal, setComissoesLoteModal] = useState<{
    vendedor: string;
    total: number;
    contas: ContaPagar[];
  } | null>(null);
  const [comprovanteDespesa, setComprovanteDespesa] = useState<{
    base64: string;
    mimeType: string;
    fileName: string;
  } | null>(null);
  const [formaSaidaPagamento, setFormaSaidaPagamento] = useState('PIX');

  // Sub-aba Contas a Receber
  const [filtroReceber, setFiltroReceber] = useState<FiltroReceber>('TODOS_PENDENTES');
  const [buscaReceber, setBuscaReceber] = useState('');
  const [contaReceberModal, setContaReceberModal] = useState<ContaReceber | null>(null);
  const [valorRecebimentoInput, setValorRecebimentoInput] = useState('');
  const [formaRecebimento, setFormaRecebimento] = useState<FormaPagamento>('PIX');

  // Sub-aba Caixa
  const [filtroCaixa, setFiltroCaixa] = useState<FiltroCaixa>('TODOS');
  const [buscaCaixa, setBuscaCaixa] = useState('');

  // ======================== KPIs & FILTROS CONTAS A PAGAR ========================
  const contasPagarEnriquecidas = useMemo(() => {
    return (snapshot.contasPagar || []).map((c) => {
      const paga = contaPagarEstaPaga(c);
      const cancelada = contaPagarEstaCancelada(c);
      const diasDiff = calcularDiasDiffVencimento(c.vencimento);
      return { conta: c, paga, cancelada, diasDiff };
    });
  }, [snapshot.contasPagar]);

  const kpisPagar = useMemo(() => {
    let vencidasQtd = 0;
    let vencidasVal = 0;
    let venceHojeQtd = 0;
    let venceHojeVal = 0;
    let noPrazoQtd = 0;
    let noPrazoVal = 0;
    let pagasQtd = 0;
    let pagasVal = 0;

    for (const item of contasPagarEnriquecidas) {
      if (item.cancelada) continue;
      const val = Number(item.conta.valor || 0);
      if (item.paga) {
        pagasQtd += 1;
        pagasVal += val;
      } else if (item.diasDiff < 0) {
        vencidasQtd += 1;
        vencidasVal += val;
      } else if (item.diasDiff === 0) {
        venceHojeQtd += 1;
        venceHojeVal += val;
      } else {
        noPrazoQtd += 1;
        noPrazoVal += val;
      }
    }

    return {
      vencidasQtd,
      vencidasVal,
      venceHojeQtd,
      venceHojeVal,
      noPrazoQtd,
      noPrazoVal,
      pagasQtd,
      pagasVal,
      totalPendente: vencidasVal + venceHojeVal + noPrazoVal,
      qtdPendente: vencidasQtd + venceHojeQtd + noPrazoQtd
    };
  }, [contasPagarEnriquecidas]);

  const comissoesAcumuladasPorVendedor = useMemo(() => {
    const mapa = new Map<string, { vendedor: string; total: number; contas: ContaPagar[] }>();
    for (const item of contasPagarEnriquecidas) {
      if (item.paga || item.cancelada) continue;
      if (!contaPagarEhComissao(item.conta)) continue;
      const vendRaw = String(item.conta.fornecedor || 'Vendedor').trim();
      const vendLabel = vendRaw.replace(/^Vend\.\s*/i, '') || 'Vendedor';
      const chave = vendLabel.toLowerCase();
      const atual = mapa.get(chave) || { vendedor: `Vend. ${vendLabel}`, total: 0, contas: [] };
      atual.total = Number((atual.total + (Number(item.conta.valor) || 0)).toFixed(2));
      atual.contas.push(item.conta);
      mapa.set(chave, atual);
    }
    return Array.from(mapa.values()).sort((a, b) => b.total - a.total);
  }, [contasPagarEnriquecidas]);

  const contasPagarFiltradas = useMemo(() => {
    const q = buscaPagar.trim().toLowerCase();
    return contasPagarEnriquecidas
      .filter(({ conta, paga, cancelada, diasDiff }) => {
        if (filtroPagar === 'TODAS_PENDENTES' && (paga || cancelada)) return false;
        if (filtroPagar === 'VENCIDAS' && (paga || cancelada || diasDiff >= 0)) return false;
        if (filtroPagar === 'VENCE_HOJE' && (paga || cancelada || diasDiff !== 0)) return false;
        if (filtroPagar === 'NO_PRAZO' && (paga || cancelada || diasDiff <= 0)) return false;
        if (filtroPagar === 'PAGO' && !paga) return false;
        if (filtroPagar === 'CANCELADO' && !cancelada) return false;
        if (!q) return true;
        return (
          String(conta.id || '').toLowerCase().includes(q) ||
          String(conta.descricao || '').toLowerCase().includes(q) ||
          String(conta.fornecedor || '').toLowerCase().includes(q) ||
          String(conta.categoria || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const aFin = a.paga || a.cancelada;
        const bFin = b.paga || b.cancelada;
        if (aFin !== bFin) return aFin ? 1 : -1;
        return a.diasDiff - b.diasDiff;
      });
  }, [contasPagarEnriquecidas, filtroPagar, buscaPagar]);

  // ======================== KPIs & FILTROS CONTAS A RECEBER ========================
  const contasReceberEnriquecidas = useMemo(() => {
    const normChave = (s?: string) =>
      String(s || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();

    const clientesMap = new Map<string, string>();
    for (const cli of snapshot.clientes || []) {
      const k = normChave(cli.nome);
      if (k && cli.telefone) clientesMap.set(k, cli.telefone);
    }
    for (const del of snapshot.delivery || []) {
      const k = normChave(del.cliente);
      if (k && del.telefone && !clientesMap.has(k)) {
        clientesMap.set(k, del.telefone);
      }
    }

    return (snapshot.contasReceber || []).map((c) => {
      const resumo = resumoValoresFiado(c);
      const nomeKey = normChave(c.cliente);
      const telefone = (nomeKey ? clientesMap.get(nomeKey) : '') || '';
      return { conta: c, telefone, ...resumo };
    });
  }, [snapshot.contasReceber, snapshot.clientes, snapshot.delivery]);

  const kpisReceber = useMemo(() => {
    let saldoAReceber = 0;
    let fiadosEmAberto = 0;
    let totalJaRecebido = 0;
    const clientesDevedores = new Set<string>();

    for (const item of contasReceberEnriquecidas) {
      totalJaRecebido += item.jaPago;
      if (!item.estaQuitado && item.saldoDevedor > 0.009) {
        saldoAReceber += item.saldoDevedor;
        fiadosEmAberto += 1;
        const chaveCli = (item.conta.cliente || item.conta.id).trim().toLowerCase();
        if (chaveCli) clientesDevedores.add(chaveCli);
      }
    }

    return {
      saldoAReceber,
      clientesComDebito: clientesDevedores.size,
      fiadosEmAberto,
      totalJaRecebido
    };
  }, [contasReceberEnriquecidas]);

  const contasReceberFiltradas = useMemo(() => {
    const q = buscaReceber.trim().toLowerCase();
    return contasReceberEnriquecidas.filter((item) => {
      if (filtroReceber === 'TODOS_PENDENTES' && item.estaQuitado) return false;
      if (filtroReceber === 'PARCIAL' && !item.estaParcial) return false;
      if (filtroReceber === 'QUITADO' && !item.estaQuitado) return false;
      if (!q) return true;
      const c = item.conta;
      return (
        String(c.id || '').toLowerCase().includes(q) ||
        String(c.cliente || '').toLowerCase().includes(q) ||
        String(item.telefone || '').toLowerCase().includes(q) ||
        String(c.comanda_origem || c.descricao || '').toLowerCase().includes(q)
      );
    });
  }, [contasReceberEnriquecidas, filtroReceber, buscaReceber]);

  // ======================== KPIs & FILTROS CAIXA ========================
  const resumoCaixa = useMemo(() => {
    let entradas = 0;
    let saidas = 0;
    for (const m of snapshot.caixa || []) {
      if (movimentoCaixaEstaCancelado(m)) continue;
      const val = Number(m.valor || 0);
      if (m.tipo === 'ENTRADA') entradas += val;
      else if (m.tipo === 'SAIDA') saidas += val;
    }
    return {
      entradas,
      saidas,
      saldoLiquido: entradas - saidas
    };
  }, [snapshot.caixa]);

  const movimentacoesFiltradas = useMemo(() => {
    const q = buscaCaixa.trim().toLowerCase();
    return (snapshot.caixa || []).filter((m: MovimentoCaixa) => {
      if (filtroCaixa !== 'TODOS' && m.tipo !== filtroCaixa) return false;
      if (!q) return true;
      return (
        String(m.descricao || '').toLowerCase().includes(q) ||
        String(m.forma_pagamento || '').toLowerCase().includes(q) ||
        String(m.origem || '').toLowerCase().includes(q) ||
        String(m.operador || '').toLowerCase().includes(q) ||
        String(m.id || '').toLowerCase().includes(q)
      );
    });
  }, [snapshot.caixa, filtroCaixa, buscaCaixa]);

  // ======================== HANDLERS ========================
  async function handleCadastrarContaPagar(e: FormEvent) {
    e.preventDefault();
    const valorNum = Number(novoValorPagar.replace(',', '.'));
    if (!novaDescricao.trim() && !novoFornecedor.trim()) {
      onNotify('Informe a descrição ou o fornecedor da conta.', 'error');
      return;
    }
    if (!Number.isFinite(valorNum) || valorNum <= 0) {
      onNotify('Informe um valor válido maior que zero.', 'error');
      return;
    }
    if (!novoVencimento) {
      onNotify('Informe a data de vencimento.', 'error');
      return;
    }

    setBusy(true);
    try {
      const res = await cadastrarContaPagar(sessao, {
        descricao: novaDescricao.trim() || novoFornecedor.trim(),
        fornecedor: novoFornecedor.trim() || novaDescricao.trim(),
        categoria: novaCategoria.trim() || 'Fornecedores',
        valor: valorNum,
        vencimento: novoVencimento,
        forma_pagamento: novaFormaPagar,
        tipo_despesa: novoTipoDespesa
      });
      onNotify(res.msg, res.ok ? 'success' : 'error');
      if (res.ok) {
        setModalNovaContaOpen(false);
        setNovaDescricao('');
        setNovoFornecedor('');
        setNovoValorPagar('');
        setNovoVencimento(obterHojeYmdLocal());
        setNovaFormaPagar('Boleto');
        setNovoTipoDespesa('AVULSA');
        await onAtualizar();
      }
    } finally {
      setBusy(false);
    }
  }

  function abrirModalConfirmarPagamento(conta: ContaPagar) {
    setComissoesLoteModal(null);
    setContaPagarModal(conta);
    setComprovanteDespesa(null);
    const formaBruta = String(conta.forma_pagamento || '').trim();
    const padrao =
      formaBruta && FORMAS_PAGAMENTO_SAIDA.some((f) => f.toLowerCase() === formaBruta.toLowerCase())
        ? FORMAS_PAGAMENTO_SAIDA.find((f) => f.toLowerCase() === formaBruta.toLowerCase()) || 'PIX'
        : 'PIX';
    setFormaSaidaPagamento(padrao);
  }

  function abrirModalPagarComissoesAcumuladas(vendedor: string, total: number, contas: ContaPagar[]) {
    setContaPagarModal(null);
    setComissoesLoteModal({ vendedor, total, contas });
    setComprovanteDespesa(null);
    setFormaSaidaPagamento('PIX');
  }

  function handleSelecionarComprovanteDespesa(file: File | null | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
      setComprovanteDespesa({
        base64,
        mimeType: file.type || 'application/octet-stream',
        fileName: file.name || `comprovante_${Date.now()}.jpg`
      });
    };
    reader.readAsDataURL(file);
  }

  async function handleConfirmarPagamentoConta(e: FormEvent) {
    e.preventDefault();
    if (!contaPagarModal && !comissoesLoteModal) return;
    setBusy(true);
    try {
      if (comissoesLoteModal) {
        let okCount = 0;
        let lastErr = '';
        for (let i = 0; i < comissoesLoteModal.contas.length; i++) {
          const c = comissoesLoteModal.contas[i];
          const res = await pagarContaPagar(
            sessao,
            c,
            formaSaidaPagamento,
            i === 0 ? comprovanteDespesa : null
          );
          if (res.ok) okCount++;
          else lastErr = res.msg;
        }
        onNotify(
          okCount === comissoesLoteModal.contas.length
            ? `✅ ${okCount} comissão(ões) de ${comissoesLoteModal.vendedor} (${formatarMoeda(comissoesLoteModal.total)}) pagas!`
            : `Pagas ${okCount}/${comissoesLoteModal.contas.length}. ${lastErr}`,
          okCount > 0 ? 'success' : 'error'
        );
        setComissoesLoteModal(null);
        setComprovanteDespesa(null);
        await onAtualizar();
        return;
      }

      if (!contaPagarModal) return;
      const res = await pagarContaPagar(sessao, contaPagarModal, formaSaidaPagamento, comprovanteDespesa);
      onNotify(res.msg, res.ok ? 'success' : 'error');
      if (res.ok) {
        setContaPagarModal(null);
        setComprovanteDespesa(null);
        await onAtualizar();
      }
    } finally {
      setBusy(false);
    }
  }

  function abrirModalReceberFiado(conta: ContaReceber) {
    const resumo = resumoValoresFiado(conta);
    setContaReceberModal(conta);
    setValorRecebimentoInput(resumo.saldoDevedor.toFixed(2));
    setFormaRecebimento('PIX');
  }

  async function handleConfirmarReceberFiado(e: FormEvent) {
    e.preventDefault();
    if (!contaReceberModal) return;
    const resumo = resumoValoresFiado(contaReceberModal);
    const valorNum = Number(valorRecebimentoInput.replace(',', '.'));
    if (!Number.isFinite(valorNum) || valorNum <= 0) {
      onNotify('Informe um valor válido para recebimento.', 'error');
      return;
    }
    if (valorNum > resumo.saldoDevedor + 0.01) {
      onNotify(
        `O valor informado (${formatarMoeda(valorNum)}) supera o saldo devedor (${formatarMoeda(resumo.saldoDevedor)}).`,
        'warning'
      );
      return;
    }

    setBusy(true);
    try {
      const res = await receberFiado(sessao, contaReceberModal, formaRecebimento, valorNum);
      onNotify(res.msg, res.ok ? 'success' : 'error');
      if (res.ok) {
        setContaReceberModal(null);
        await onAtualizar();
      }
    } finally {
      setBusy(false);
    }
  }

  function handleCobrarMensageiro(
    conta: ContaReceber,
    telefone: string,
    saldoDevedor: number,
    canal: 'WHATSAPP' | 'TELEGRAM'
  ) {
    const cliente = conta.cliente || 'Cliente';
    const pixNormalizada = normalizarChavePixBCB(snapshot.empresa.chave_pix || '');
    const nomeEmpresa = snapshot.empresa.nome || 'Depósito';
    const nomeRecebedor = snapshot.empresa.dono_nome || nomeEmpresa;

    const linhas = [
      `Olá *${cliente}*! Aqui é do *${nomeEmpresa}*.`,
      `Passando para lembrar do seu saldo em aberto no valor de *${formatarMoeda(saldoDevedor)}* (Ref: ${conta.id}).`
    ];
    if (pixNormalizada) {
      linhas.push('', `Chave PIX: *${pixNormalizada}* (${nomeRecebedor})`);
    }
    const texto = encodeURIComponent(linhas.join('\n'));
    const foneDigits = String(telefone || '').replace(/\D/g, '').replace(/^0+/, '');
    if (!foneDigits) {
      onNotify(
        `Cliente "${cliente}" sem telefone cadastrado. Cadastre o telefone em Administração → Clientes para abrir direto na conversa.`,
        'warning'
      );
    }
    const foneIntl = foneDigits.startsWith('55') && foneDigits.length >= 12 ? foneDigits : `55${foneDigits}`;
    const destino =
      canal === 'TELEGRAM'
        ? foneDigits
          ? `https://t.me/+${foneIntl}?text=${texto}`
          : `https://t.me/share/url?url=${encodeURIComponent(nomeEmpresa)}&text=${texto}`
        : foneDigits
        ? `https://wa.me/${foneIntl}?text=${texto}`
        : `https://wa.me/?text=${texto}`;
    window.open(destino, '_blank', 'noopener,noreferrer');
  }

  const resumoModalFiado = contaReceberModal ? resumoValoresFiado(contaReceberModal) : null;
  const valorDigitadoFiado = Number((valorRecebimentoInput || '0').replace(',', '.')) || 0;
  const restanteAposReceber = resumoModalFiado
    ? Math.max(0, resumoModalFiado.saldoDevedor - valorDigitadoFiado)
    : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* BARRA DE SUB-ABAS FINANCEIRAS */}
      <div
        className="panel-card"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button
            type="button"
            className={`btn ${subAba === 'caixa' ? 'btn-primary' : ''}`}
            onClick={() => setSubAba('caixa')}
          >
            📒 Extrato do Caixa ({snapshot.caixa.length})
          </button>
          <button
            type="button"
            className={`btn ${subAba === 'pagar' ? 'btn-danger' : ''}`}
            onClick={() => setSubAba('pagar')}
          >
            💸 Contas a Pagar ({kpisPagar.qtdPendente})
          </button>
          <button
            type="button"
            className={`btn ${subAba === 'receber' ? 'btn-success' : ''}`}
            onClick={() => setSubAba('receber')}
          >
            💰 Contas a Receber / Fiados ({kpisReceber.fiadosEmAberto})
          </button>
        </div>

        {subAba === 'pagar' && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setModalNovaContaOpen(true)}
          >
            <Plus size={15} />
            <span>Nova Conta a Pagar</span>
          </button>
        )}
      </div>

      {/* ================= SUB-ABA CONTAS A PAGAR ================= */}
      {subAba === 'pagar' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {comissoesAcumuladasPorVendedor.length > 0 && (
            <div
              className="panel-card"
              style={{
                background: 'rgba(16, 185, 129, 0.08)',
                borderColor: 'rgba(16, 185, 129, 0.35)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 800, color: '#a7f3d0' }}>
                💼 Comissões Acumuladas a Pagar (por Vendedor)
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {comissoesAcumuladasPorVendedor.map((grp) => (
                  <div
                    key={grp.vendedor}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      padding: '8px 12px',
                      borderRadius: 10,
                      background: 'rgba(15, 23, 42, 0.75)',
                      border: '1px solid var(--border-subtle)',
                      flex: '1 1 260px'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#f8fafc' }}>{grp.vendedor}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                        {grp.contas.length} comissão(ões) pendente(s)
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <strong style={{ color: '#34d399', fontSize: 15 }}>
                        {formatarMoeda(grp.total)}
                      </strong>
                      <button
                        type="button"
                        className="btn btn-success btn-xs"
                        disabled={busy}
                        onClick={() =>
                          abrirModalPagarComissoesAcumuladas(grp.vendedor, grp.total, grp.contas)
                        }
                      >
                        💸 Pagar Comissão
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="kpi-grid">
            <div className="kpi-card kpi-left-danger">
              <div className="kpi-label">🔴 Vencidas ({kpisPagar.vencidasQtd})</div>
              <div className="kpi-value" style={{ color: '#f87171' }}>
                {formatarMoeda(kpisPagar.vencidasVal)}
              </div>
              <div className="kpi-sub">Contas atrasadas em aberto</div>
            </div>

            <div className="kpi-card kpi-left-warn">
              <div className="kpi-label">🟡 Vence Hoje ({kpisPagar.venceHojeQtd})</div>
              <div className="kpi-value" style={{ color: '#fbbf24' }}>
                {formatarMoeda(kpisPagar.venceHojeVal)}
              </div>
              <div className="kpi-sub">Compromissos com vencimento hoje</div>
            </div>

            <div className="kpi-card kpi-left-ok">
              <div className="kpi-label">🟢 No Prazo ({kpisPagar.noPrazoQtd})</div>
              <div className="kpi-value" style={{ color: '#34d399' }}>
                {formatarMoeda(kpisPagar.noPrazoVal)}
              </div>
              <div className="kpi-sub">Contas futuras programadas</div>
            </div>

            <div className="kpi-card kpi-left-info">
              <div className="kpi-label">📊 Total Pendente ({kpisPagar.qtdPendente})</div>
              <div className="kpi-value" style={{ color: '#38bdf8' }}>
                {formatarMoeda(kpisPagar.totalPendente)}
              </div>
              <div className="kpi-sub">
                Já pagas: {kpisPagar.pagasQtd} ({formatarMoeda(kpisPagar.pagasVal)})
              </div>
            </div>
          </div>

          <div className="panel-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10
              }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                <Filter size={14} color="#94a3b8" />
                {(
                  [
                    ['TODAS_PENDENTES', 'Pendentes'],
                    ['VENCIDAS', '🔴 Vencidas'],
                    ['VENCE_HOJE', '🟡 Vence Hoje'],
                    ['NO_PRAZO', '🟢 No Prazo'],
                    ['PAGO', '✅ Pagas'],
                    ['CANCELADO', '🚫 Canceladas'],
                    ['TODAS', 'Todas']
                  ] as [FiltroPagar, string][]
                ).map(([chave, rotulo]) => (
                  <button
                    key={chave}
                    type="button"
                    className={`btn ${filtroPagar === chave ? 'btn-primary' : ''}`}
                    style={{ padding: '6px 12px', fontSize: 12 }}
                    onClick={() => setFiltroPagar(chave)}
                  >
                    {rotulo}
                  </button>
                ))}
              </div>

              <div style={{ position: 'relative', minWidth: 240, flex: '1 1 260px', maxWidth: 340 }}>
                <Search
                  size={14}
                  color="#94a3b8"
                  style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}
                />
                <input
                  type="text"
                  className="field-input"
                  style={{ paddingLeft: 32 }}
                  placeholder="Buscar fornecedor, descrição, ID..."
                  value={buscaPagar}
                  onChange={(e) => setBuscaPagar(e.target.value)}
                />
              </div>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Descrição / Fornecedor</th>
                    <th>Forma / Tipo</th>
                    <th>Vencimento</th>
                    <th>Prazo / Status</th>
                    <th style={{ textAlign: 'right' }}>Valor</th>
                    <th style={{ textAlign: 'right' }}>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {contasPagarFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: 28, color: 'var(--text-muted)' }}>
                        Nenhuma conta encontrada para este filtro.
                      </td>
                    </tr>
                  ) : (
                    contasPagarFiltradas.map(({ conta, paga, cancelada, diasDiff }) => (
                      <tr key={conta.id} style={cancelada ? { opacity: 0.72 } : undefined}>
                        <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)' }}>
                          {conta.id}
                        </td>
                        <td>
                          <div
                            style={{
                              fontWeight: 700,
                              color: cancelada ? 'var(--text-muted)' : 'var(--text-main)',
                              textDecoration: cancelada ? 'line-through' : 'none'
                            }}
                          >
                            {conta.descricao}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span>{conta.fornecedor || '-'} • {conta.categoria || 'Geral'}</span>
                            {contaPagarEhComissao(conta) ? (
                              <span
                                style={pillBadgeStyle(
                                  'rgba(16,185,129,0.18)',
                                  '#34d399',
                                  'rgba(16,185,129,0.4)'
                                )}
                              >
                                💼 Comissão
                              </span>
                            ) : contaPagarEhTaxaEntrega(conta) ? (
                              <span
                                style={pillBadgeStyle(
                                  'rgba(245,158,11,0.18)',
                                  '#fbbf24',
                                  'rgba(245,158,11,0.4)'
                                )}
                              >
                                🏍️ Taxa Entrega (TXE)
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td style={{ fontSize: 12 }}>
                          <div>{conta.forma_pagamento || 'Boleto'}</div>
                          <span
                            style={
                              conta.tipo_despesa === 'FIXA'
                                ? pillBadgeStyle('rgba(139,92,246,0.2)', '#c4b5fd', 'rgba(139,92,246,0.4)')
                                : pillBadgeStyle('rgba(148,163,184,0.14)', '#cbd5e1', 'rgba(148,163,184,0.25)')
                            }
                          >
                            {conta.tipo_despesa || 'AVULSA'}
                          </span>
                        </td>
                        <td style={{ fontSize: 13 }}>{formatarDataBr(conta.vencimento)}</td>
                        <td>
                          {cancelada ? (
                            <span
                              style={pillBadgeStyle(
                                'rgba(148,163,184,0.18)',
                                '#cbd5e1',
                                'rgba(148,163,184,0.4)'
                              )}
                            >
                              🚫 CANCELADA
                            </span>
                          ) : paga ? (
                            <span
                              style={pillBadgeStyle(
                                'rgba(16,185,129,0.18)',
                                '#34d399',
                                'rgba(16,185,129,0.4)'
                              )}
                            >
                              <CheckCircle2 size={12} />
                              PAGA {conta.data_pagamento ? `(${formatarDataBr(conta.data_pagamento)})` : ''}
                            </span>
                          ) : diasDiff < 0 ? (
                            <span
                              style={pillBadgeStyle(
                                'rgba(239,68,68,0.18)',
                                '#f87171',
                                'rgba(239,68,68,0.45)'
                              )}
                            >
                              🔴 VENCIDA ({Math.abs(diasDiff)}d)
                            </span>
                          ) : diasDiff === 0 ? (
                            <span
                              style={pillBadgeStyle(
                                'rgba(245,158,11,0.18)',
                                '#fbbf24',
                                'rgba(245,158,11,0.45)'
                              )}
                            >
                              🟡 VENCE HOJE
                            </span>
                          ) : (
                            <span
                              style={pillBadgeStyle(
                                'rgba(16,185,129,0.16)',
                                '#34d399',
                                'rgba(16,185,129,0.35)'
                              )}
                            >
                              🟢 NO PRAZO ({diasDiff}d)
                            </span>
                          )}
                        </td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontWeight: 800,
                            color: cancelada ? 'var(--text-muted)' : '#f8fafc',
                            textDecoration: cancelada ? 'line-through' : 'none'
                          }}
                        >
                          {formatarMoeda(conta.valor)}
                          {cancelada && (
                            <div style={{ fontSize: 10.5, fontWeight: 500, textDecoration: 'none' }}>
                              não contabilizado
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {cancelada ? (
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8' }}>
                              Cancelada
                            </span>
                          ) : paga ? (
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#34d399' }}>
                              Quitada
                            </span>
                          ) : (
                            <div style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                              <button
                                type="button"
                                disabled={busy}
                                className="btn btn-success"
                                style={{ padding: '6px 12px', fontSize: 12 }}
                                onClick={() => abrirModalConfirmarPagamento(conta)}
                              >
                                {contaPagarEhComissao(conta)
                                  ? '💸 Pagar Comissão'
                                  : contaPagarEhTaxaEntrega(conta)
                                  ? '💸 Pagar Motoboy'
                                  : '💸 Pagar'}
                              </button>
                              {podeCancelarPagar && (
                                <button
                                  type="button"
                                  disabled={busy}
                                  className="btn btn-danger"
                                  style={{ padding: '6px 10px', fontSize: 12 }}
                                  onClick={() => {
                                    setContaCancelarModal(conta);
                                    setMotivoCancelamento('');
                                  }}
                                  title="Cancelar conta a pagar (exclusivo Dono/Admin)"
                                >
                                  🚫 Cancelar
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= SUB-ABA CONTAS A RECEBER (FIADOS) ================= */}
      {subAba === 'receber' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="kpi-grid">
            <div className="kpi-card kpi-left-danger">
              <div className="kpi-label">💰 Saldo a Receber</div>
              <div className="kpi-value" style={{ color: '#f87171' }}>
                {formatarMoeda(kpisReceber.saldoAReceber)}
              </div>
              <div className="kpi-sub">Total em aberto na praça</div>
            </div>

            <div className="kpi-card kpi-left-warn">
              <div className="kpi-label">👥 Clientes com Débito</div>
              <div className="kpi-value" style={{ color: '#fbbf24' }}>
                {kpisReceber.clientesComDebito}
              </div>
              <div className="kpi-sub">Clientes distintos pendentes</div>
            </div>

            <div className="kpi-card kpi-left-info">
              <div className="kpi-label">📄 Fiados em Aberto</div>
              <div className="kpi-value" style={{ color: '#38bdf8' }}>
                {kpisReceber.fiadosEmAberto}
              </div>
              <div className="kpi-sub">Títulos aguardando quitação</div>
            </div>

            <div className="kpi-card kpi-left-ok">
              <div className="kpi-label">✅ Total Já Recebido</div>
              <div className="kpi-value" style={{ color: '#34d399' }}>
                {formatarMoeda(kpisReceber.totalJaRecebido)}
              </div>
              <div className="kpi-sub">Amortizações e quitações registradas</div>
            </div>
          </div>

          <div className="panel-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10
              }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                <Filter size={14} color="#94a3b8" />
                {(
                  [
                    ['TODOS_PENDENTES', 'Pendentes'],
                    ['PARCIAL', '🟡 Parciais'],
                    ['QUITADO', '✅ Quitados'],
                    ['TODOS', 'Todos']
                  ] as [FiltroReceber, string][]
                ).map(([chave, rotulo]) => (
                  <button
                    key={chave}
                    type="button"
                    className={`btn ${filtroReceber === chave ? 'btn-primary' : ''}`}
                    style={{ padding: '6px 12px', fontSize: 12 }}
                    onClick={() => setFiltroReceber(chave)}
                  >
                    {rotulo}
                  </button>
                ))}
              </div>

              <div style={{ position: 'relative', minWidth: 240, flex: '1 1 260px', maxWidth: 340 }}>
                <Search
                  size={14}
                  color="#94a3b8"
                  style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}
                />
                <input
                  type="text"
                  className="field-input"
                  style={{ paddingLeft: 32 }}
                  placeholder="Buscar cliente, telefone, origem..."
                  value={buscaReceber}
                  onChange={(e) => setBuscaReceber(e.target.value)}
                />
              </div>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Cliente</th>
                    <th>Origem</th>
                    <th style={{ textAlign: 'right' }}>Total Original</th>
                    <th style={{ textAlign: 'right' }}>Já Pago</th>
                    <th style={{ textAlign: 'right' }}>Saldo Devedor</th>
                    <th>Status</th>
                    <th>Data</th>
                    <th style={{ textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {contasReceberFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: 28, color: 'var(--text-muted)' }}>
                        Nenhum título encontrado para este filtro.
                      </td>
                    </tr>
                  ) : (
                    contasReceberFiltradas.map(
                      ({
                        conta,
                        telefone,
                        totalOriginal,
                        jaPago,
                        saldoDevedor,
                        estaQuitado,
                        estaParcial
                      }) => (
                        <tr key={conta.id}>
                          <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)' }}>
                            {conta.id}
                          </td>
                          <td>
                            <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                              {conta.cliente}
                            </div>
                            {telefone && (
                              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                📞 {telefone}
                              </div>
                            )}
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            {conta.comanda_origem || conta.descricao || 'PDV / Venda'}
                          </td>
                          <td style={{ textAlign: 'right', fontSize: 13, color: 'var(--text-muted)' }}>
                            {formatarMoeda(totalOriginal)}
                          </td>
                          <td style={{ textAlign: 'right', fontSize: 13, fontWeight: 600, color: '#34d399' }}>
                            {formatarMoeda(jaPago)}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 800, color: '#f8fafc' }}>
                            {formatarMoeda(saldoDevedor)}
                          </td>
                          <td>
                            {estaQuitado ? (
                              <span
                                style={pillBadgeStyle(
                                  'rgba(16,185,129,0.18)',
                                  '#34d399',
                                  'rgba(16,185,129,0.4)'
                                )}
                              >
                                ✅ QUITADO
                              </span>
                            ) : estaParcial ? (
                              <span
                                style={pillBadgeStyle(
                                  'rgba(245,158,11,0.18)',
                                  '#fbbf24',
                                  'rgba(245,158,11,0.45)'
                                )}
                              >
                                🟡 PARCIAL
                              </span>
                            ) : (
                              <span
                                style={pillBadgeStyle(
                                  'rgba(239,68,68,0.18)',
                                  '#f87171',
                                  'rgba(239,68,68,0.45)'
                                )}
                              >
                                🔴 EM ABERTO
                              </span>
                            )}
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            {formatarDataBr(conta.data)}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {estaQuitado ? (
                              <span style={{ fontSize: 12, fontWeight: 700, color: '#34d399' }}>
                                Recebido
                              </span>
                            ) : (
                              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                                <button
                                  type="button"
                                  disabled={busy}
                                  className="btn btn-success"
                                  style={{ padding: '6px 10px', fontSize: 12 }}
                                  onClick={() => abrirModalReceberFiado(conta)}
                                >
                                  💵 Receber
                                </button>
                                <button
                                  type="button"
                                  className="btn"
                                  style={{
                                    padding: '6px 10px',
                                    fontSize: 12,
                                    background: 'rgba(22, 163, 74, 0.22)',
                                    borderColor: 'rgba(34, 197, 94, 0.45)',
                                    color: '#4ade80'
                                  }}
                                  title="Enviar lembrete via WhatsApp com Chave PIX"
                                  onClick={() => handleCobrarMensageiro(conta, telefone, saldoDevedor, 'WHATSAPP')}
                                >
                                  <MessageCircle size={13} />
                                  <span>WhatsApp</span>
                                </button>
                                <button
                                  type="button"
                                  className="btn"
                                  style={{
                                    padding: '6px 10px',
                                    fontSize: 12,
                                    background: 'rgba(14, 165, 233, 0.2)',
                                    borderColor: 'rgba(56, 189, 248, 0.45)',
                                    color: '#38bdf8'
                                  }}
                                  title="Enviar lembrete via Telegram com Chave PIX"
                                  onClick={() => handleCobrarMensageiro(conta, telefone, saldoDevedor, 'TELEGRAM')}
                                >
                                  <Send size={13} />
                                  <span>Telegram</span>
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= SUB-ABA EXTRATO DO CAIXA ================= */}
      {subAba === 'caixa' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="kpi-grid">
            <div className="kpi-card kpi-left-ok">
              <div className="kpi-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <TrendingUp size={13} /> Entradas do Período
              </div>
              <div className="kpi-value" style={{ color: '#34d399' }}>
                {formatarMoeda(resumoCaixa.entradas)}
              </div>
            </div>

            <div className="kpi-card kpi-left-danger">
              <div className="kpi-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <TrendingDown size={13} /> Saídas do Período
              </div>
              <div className="kpi-value" style={{ color: '#f87171' }}>
                {formatarMoeda(resumoCaixa.saidas)}
              </div>
            </div>

            <div className="kpi-card kpi-left-info">
              <div className="kpi-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Wallet size={13} /> Saldo Líquido
              </div>
              <div
                className="kpi-value"
                style={{ color: resumoCaixa.saldoLiquido >= 0 ? '#38bdf8' : '#f87171' }}
              >
                {formatarMoeda(resumoCaixa.saldoLiquido)}
              </div>
            </div>
          </div>

          <div className="panel-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10
              }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {(['TODOS', 'ENTRADA', 'SAIDA'] as FiltroCaixa[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={`btn ${filtroCaixa === f ? 'btn-primary' : ''}`}
                    style={{ padding: '6px 12px', fontSize: 12 }}
                    onClick={() => setFiltroCaixa(f)}
                  >
                    {f === 'TODOS' ? 'Todos' : f === 'ENTRADA' ? '🟢 Entradas' : '🔴 Saídas'}
                  </button>
                ))}
              </div>

              <div style={{ position: 'relative', minWidth: 240, flex: '1 1 260px', maxWidth: 340 }}>
                <Search
                  size={14}
                  color="#94a3b8"
                  style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}
                />
                <input
                  type="text"
                  className="field-input"
                  style={{ paddingLeft: 32 }}
                  placeholder="Buscar descrição, forma, operador..."
                  value={buscaCaixa}
                  onChange={(e) => setBuscaCaixa(e.target.value)}
                />
              </div>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Data/Hora</th>
                    <th>Tipo</th>
                    <th>Descrição</th>
                    <th>Forma</th>
                    <th>Origem</th>
                    <th>Operador</th>
                    <th style={{ textAlign: 'right' }}>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {movimentacoesFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: 28, color: 'var(--text-muted)' }}>
                        Nenhuma movimentação registrada no caixa.
                      </td>
                    </tr>
                  ) : (
                    movimentacoesFiltradas.map((m) => {
                      const ehCancelado = movimentoCaixaEstaCancelado(m);
                      return (
                      <tr key={m.id} style={ehCancelado ? { opacity: 0.7 } : undefined}>
                        <td style={{ whiteSpace: 'nowrap', fontSize: 12, color: 'var(--text-muted)' }}>
                          {formatarDataHoraBr(m.data_hora)}
                        </td>
                        <td>
                          {ehCancelado ? (
                            <span
                              style={pillBadgeStyle(
                                'rgba(148,163,184,0.18)',
                                '#cbd5e1',
                                'rgba(148,163,184,0.4)'
                              )}
                            >
                              CANCELADA
                            </span>
                          ) : m.tipo === 'ENTRADA' ? (
                            <span
                              style={pillBadgeStyle(
                                'rgba(16,185,129,0.18)',
                                '#34d399',
                                'rgba(16,185,129,0.4)'
                              )}
                            >
                              ENTRADA
                            </span>
                          ) : (
                            <span
                              style={pillBadgeStyle(
                                'rgba(239,68,68,0.18)',
                                '#f87171',
                                'rgba(239,68,68,0.4)'
                              )}
                            >
                              SAÍDA
                            </span>
                          )}
                        </td>
                        <td style={{ fontWeight: 600 }}>{m.descricao}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span>{m.forma_pagamento || '-'}</span>
                            {isDono &&
                              !ehCancelado &&
                              m.tipo === 'ENTRADA' &&
                              /^OUTROS?$/i.test(String(m.forma_pagamento || '').trim()) && (
                                <button
                                  type="button"
                                  className="btn btn-xs"
                                  style={{
                                    padding: '2px 7px',
                                    fontSize: 10.5,
                                    borderColor: '#f59e0b',
                                    color: '#fbbf24'
                                  }}
                                  onClick={() => {
                                    setMovConverter(m);
                                    setNovaFormaConverter('PIX');
                                  }}
                                  title="Converter forma de pagamento (exclusivo Dono)"
                                >
                                  <RefreshCw size={10} /> Converter
                                </button>
                              )}
                          </div>
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text-dim)' }}>{m.origem || '-'}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {m.operador || '-'}
                        </td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontWeight: 800,
                            color: ehCancelado
                              ? 'var(--text-muted)'
                              : m.tipo === 'ENTRADA'
                              ? '#34d399'
                              : '#f87171',
                            textDecoration: ehCancelado ? 'line-through' : 'none'
                          }}
                        >
                          {ehCancelado
                            ? formatarMoeda(m.valor)
                            : `${m.tipo === 'ENTRADA' ? '+' : '-'} ${formatarMoeda(m.valor)}`}
                          {ehCancelado && (
                            <div style={{ fontSize: 10.5, fontWeight: 500, textDecoration: 'none' }}>
                              não contabilizado
                            </div>
                          )}
                        </td>
                      </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL NOVA CONTA A PAGAR ================= */}
      {modalNovaContaOpen && (
        <div style={modalOverlayStyle}>
          <div className="panel-card" style={{ maxWidth: 520, width: '100%', borderColor: 'var(--border-accent)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 17, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Plus size={18} color="#f87171" />
                <span>Nova Conta a Pagar</span>
              </h3>
              <button
                type="button"
                className="btn"
                style={{ padding: 6 }}
                onClick={() => setModalNovaContaOpen(false)}
              >
                <X size={15} />
              </button>
            </div>

            <form style={{ display: 'flex', flexDirection: 'column', gap: 12 }} onSubmit={handleCadastrarContaPagar}>
              <div>
                <label className="field-label">Fornecedor / Credor *</label>
                <input
                  className="field-input"
                  required
                  placeholder="Ex.: Internet, Coelba, Aluguel Galpão"
                  value={novoFornecedor}
                  onChange={(e) => setNovoFornecedor(e.target.value)}
                />
              </div>

              <div>
                <label className="field-label">Descrição da Despesa *</label>
                <input
                  className="field-input"
                  required
                  placeholder="Ex.: Mensalidade internet, Energia elétrica"
                  value={novaDescricao}
                  onChange={(e) => setNovaDescricao(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="field-label">Valor (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    className="field-input"
                    placeholder="0,00"
                    value={novoValorPagar}
                    onChange={(e) => setNovoValorPagar(e.target.value)}
                  />
                </div>
                <div>
                  <label className="field-label">Vencimento *</label>
                  <input
                    type="date"
                    required
                    className="field-input"
                    value={novoVencimento}
                    onChange={(e) => setNovoVencimento(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div>
                  <label className="field-label">Categoria</label>
                  <select
                    className="field-select"
                    value={novaCategoria}
                    onChange={(e) => setNovaCategoria(e.target.value)}
                  >
                    <option value="Fornecedores">Fornecedores</option>
                    <option value="Energia / Água">Energia / Água</option>
                    <option value="Aluguel">Aluguel</option>
                    <option value="Internet / Telefone">Internet / Telefone</option>
                    <option value="Impostos">Impostos</option>
                    <option value="Frete">Frete</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>

                <div>
                  <label className="field-label">Forma Prevista</label>
                  <select
                    className="field-select"
                    value={novaFormaPagar}
                    onChange={(e) => setNovaFormaPagar(e.target.value)}
                  >
                    <option value="Boleto">Boleto</option>
                    <option value="PIX">PIX</option>
                    <option value="Transferência">Transferência</option>
                    <option value="Dinheiro">Dinheiro</option>
                  </select>
                </div>

                <div>
                  <label className="field-label">Tipo de Despesa</label>
                  <select
                    className="field-select"
                    value={novoTipoDespesa}
                    onChange={(e) => setNovoTipoDespesa(e.target.value as 'AVULSA' | 'FIXA')}
                  >
                    <option value="AVULSA">AVULSA</option>
                    <option value="FIXA">FIXA (Recorrente)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setModalNovaContaOpen(false)}
                >
                  Cancelar
                </button>
                <button type="submit" disabled={busy} className="btn btn-primary">
                  {busy ? 'Salvando...' : '💾 Lançar Conta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL CONFIRMAR PAGAMENTO DE CONTA ================= */}
      {(contaPagarModal || comissoesLoteModal) && (
        <div style={modalOverlayStyle}>
          <div className="panel-card" style={{ maxWidth: 440, width: '100%', borderColor: 'var(--border-accent)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 17, display: 'flex', alignItems: 'center', gap: 8 }}>
                <DollarSign size={18} color="#34d399" />
                <span>{comissoesLoteModal ? 'Pagar Comissões Acumuladas' : 'Confirmar Pagamento'}</span>
              </h3>
              <button
                type="button"
                className="btn"
                style={{ padding: 6 }}
                onClick={() => {
                  setContaPagarModal(null);
                  setComissoesLoteModal(null);
                }}
              >
                <X size={15} />
              </button>
            </div>

            <form style={{ display: 'flex', flexDirection: 'column', gap: 14 }} onSubmit={handleConfirmarPagamentoConta}>
              <div
                style={{
                  background: 'rgba(30, 41, 59, 0.72)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 12,
                  padding: 12
                }}
              >
                {comissoesLoteModal ? (
                  <>
                    <div style={{ fontWeight: 700, color: '#f8fafc' }}>{comissoesLoteModal.vendedor}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                      {comissoesLoteModal.contas.length} comissão(ões):{' '}
                      {comissoesLoteModal.contas.map((c) => c.id).join(', ')}
                    </div>
                    <div style={{ marginTop: 8, fontSize: 22, fontWeight: 800, color: '#34d399' }}>
                      {formatarMoeda(comissoesLoteModal.total)}
                    </div>
                  </>
                ) : (
                  contaPagarModal && (
                    <>
                      <div style={{ fontWeight: 700, color: '#f8fafc' }}>{contaPagarModal.descricao}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                        Fornecedor: {contaPagarModal.fornecedor || '-'} • Vencimento:{' '}
                        {formatarDataBr(contaPagarModal.vencimento)}
                      </div>
                      <div style={{ marginTop: 8, fontSize: 22, fontWeight: 800, color: '#f87171' }}>
                        {formatarMoeda(contaPagarModal.valor)}
                      </div>
                    </>
                  )
                )}
              </div>

              <div>
                <label className="field-label">Forma de Saída no Caixa</label>
                <select
                  className="field-select"
                  value={formaSaidaPagamento}
                  onChange={(e) => setFormaSaidaPagamento(e.target.value)}
                >
                  {FORMAS_PAGAMENTO_SAIDA.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>

              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: 'rgba(15, 23, 42, 0.65)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8
                }}
              >
                <label className="field-label" style={{ marginBottom: 0 }}>
                  Comprovante de Pagamento (Pasta Despesas)
                </label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <label className="btn btn-xs btn-primary" style={{ cursor: 'pointer' }}>
                    📁 Buscar no Dispositivo
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      style={{ display: 'none' }}
                      onChange={(e) => handleSelecionarComprovanteDespesa(e.target.files?.[0])}
                    />
                  </label>
                  <label className="btn btn-xs btn-success" style={{ cursor: 'pointer' }}>
                    📷 Tirar Foto
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      style={{ display: 'none' }}
                      onChange={(e) => handleSelecionarComprovanteDespesa(e.target.files?.[0])}
                    />
                  </label>
                </div>
                {comprovanteDespesa && (
                  <div style={{ fontSize: 12, color: '#34d399', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <span>📎 {comprovanteDespesa.fileName}</span>
                    <button
                      type="button"
                      className="btn btn-xs btn-danger"
                      onClick={() => setComprovanteDespesa(null)}
                    >
                      Remover
                    </button>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setContaPagarModal(null);
                    setComissoesLoteModal(null);
                  }}
                >
                  Cancelar
                </button>
                <button type="submit" disabled={busy} className="btn btn-success">
                  {busy ? 'Processando...' : '✅ Confirmar Pagamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL RECEBER FIADO ================= */}
      {contaReceberModal && resumoModalFiado && (
        <div style={modalOverlayStyle}>
          <div className="panel-card" style={{ maxWidth: 460, width: '100%', borderColor: 'var(--border-accent)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 17, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={18} color="#34d399" />
                <span>Receber Fiado / Amortizar</span>
              </h3>
              <button
                type="button"
                className="btn"
                style={{ padding: 6 }}
                onClick={() => setContaReceberModal(null)}
              >
                <X size={15} />
              </button>
            </div>

            <form style={{ display: 'flex', flexDirection: 'column', gap: 14 }} onSubmit={handleConfirmarReceberFiado}>
              <div
                style={{
                  background: 'rgba(30, 41, 59, 0.72)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 12,
                  padding: 12
                }}
              >
                <div style={{ fontWeight: 700, color: '#f8fafc' }}>{contaReceberModal.cliente}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Ref: {contaReceberModal.id} •{' '}
                  {contaReceberModal.comanda_origem || contaReceberModal.descricao || 'Venda Fiado'}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
                  <div style={{ background: 'rgba(15,23,42,0.7)', borderRadius: 8, padding: 8 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Original</div>
                    <div style={{ fontWeight: 700, color: '#f8fafc' }}>
                      {formatarMoeda(resumoModalFiado.totalOriginal)}
                    </div>
                  </div>
                  <div style={{ background: 'rgba(15,23,42,0.7)', borderRadius: 8, padding: 8 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Saldo Devedor Atual</div>
                    <div style={{ fontWeight: 800, color: '#f87171' }}>
                      {formatarMoeda(resumoModalFiado.saldoDevedor)}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="field-label">Valor Recebido (R$)</label>
                  <button
                    type="button"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#34d399',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      textDecoration: 'underline'
                    }}
                    onClick={() =>
                      setValorRecebimentoInput(resumoModalFiado.saldoDevedor.toFixed(2))
                    }
                  >
                    Quitar Total ({formatarMoeda(resumoModalFiado.saldoDevedor)})
                  </button>
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={resumoModalFiado.saldoDevedor}
                  required
                  className="field-input"
                  style={{ fontSize: 18, fontWeight: 800 }}
                  value={valorRecebimentoInput}
                  onChange={(e) => setValorRecebimentoInput(e.target.value)}
                />
                <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                  Saldo restante após recebimento:{' '}
                  <strong style={{ color: restanteAposReceber <= 0.009 ? '#34d399' : '#fbbf24' }}>
                    {formatarMoeda(restanteAposReceber)}
                  </strong>
                  {restanteAposReceber <= 0.009 ? ' (Quitação Total)' : ' (Pagamento Parcial)'}
                </div>
              </div>

              <div>
                <label className="field-label">Forma de Recebimento</label>
                <select
                  className="field-select"
                  value={formaRecebimento}
                  onChange={(e) => setFormaRecebimento(e.target.value as FormaPagamento)}
                >
                  {FORMAS_RECEBIMENTO.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setContaReceberModal(null)}
                >
                  Cancelar
                </button>
                <button type="submit" disabled={busy} className="btn btn-success">
                  {busy ? 'Registrando...' : '💵 Confirmar Recebimento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ================= MODAL CONVERTER FORMA DE PAGAMENTO (EXCLUSIVO DONO) ================= */}
      {movConverter && isDono && (
        <div style={modalOverlayStyle}>
          <div className="panel-card" style={{ maxWidth: 460, width: '100%', borderColor: '#f59e0b' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: 16.5, display: 'flex', alignItems: 'center', gap: 8 }}>
                <RefreshCw size={17} color="#fbbf24" />
                <span>Converter Forma de Pagamento</span>
              </h3>
              <button type="button" className="btn btn-xs" onClick={() => setMovConverter(null)}>
                <X size={15} />
              </button>
            </div>

            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div><strong>Lançamento:</strong> {movConverter.descricao}</div>
              <div><strong>Valor:</strong> <span style={{ color: '#34d399', fontWeight: 700 }}>{formatarMoeda(movConverter.valor)}</span></div>
              <div><strong>Forma Atual:</strong> {movConverter.forma_pagamento}</div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label className="field-label">Nova Forma de Pagamento</label>
              <select
                className="field-select"
                value={novaFormaConverter}
                onChange={(e) => setNovaFormaConverter(e.target.value as Exclude<FormaPagamento, 'Outro'>)}
              >
                <option value="PIX">⚡ PIX</option>
                <option value="Dinheiro">💵 Dinheiro</option>
                <option value="Cartão Débito">💳 Cartão Débito</option>
                <option value="Cartão Crédito">💳 Cartão Crédito</option>
                <option value="Fiado">🧾 Fiado (Move para Contas a Receber)</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" className="btn" onClick={() => setMovConverter(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-success"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const res = await converterFormaPagamentoCaixa(sessao, movConverter, novaFormaConverter);
                    if (res.ok) {
                      setMovConverter(null);
                      onNotify(res.msg, 'success');
                      await onAtualizar();
                    } else {
                      onNotify(res.msg, 'error');
                    }
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? 'Convertendo...' : '✅ Confirmar Conversão'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ================= MODAL CANCELAR CONTA A PAGAR ================= */}
      {contaCancelarModal && (
        <div style={modalOverlayStyle}>
          <div className="panel-card" style={{ maxWidth: 480, width: '100%', borderColor: 'rgba(239,68,68,0.45)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>🚫 Cancelar Conta a Pagar</span>
              </h3>
              <button
                type="button"
                className="btn"
                style={{ padding: 6 }}
                onClick={() => setContaCancelarModal(null)}
              >
                <X size={15} />
              </button>
            </div>

            <div
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.28)',
                marginBottom: 12,
                fontSize: 12.5
              }}
            >
              <div><strong>Conta:</strong> {contaCancelarModal.id} — {contaCancelarModal.descricao}</div>
              <div><strong>Fornecedor:</strong> {contaCancelarModal.fornecedor || '-'}</div>
              <div><strong>Valor:</strong> {formatarMoeda(contaCancelarModal.valor)}</div>
              <div style={{ marginTop: 6, color: '#fca5a5', fontSize: 12 }}>
                A conta continuará visível no histórico e no Extrato do Caixa como <strong>CANCELADA</strong>, mas <strong>não será contabilizada</strong> nos saldos e relatórios.
              </div>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!motivoCancelamento.trim()) {
                  onNotify('Informe a explicação obrigatória do cancelamento.', 'warning');
                  return;
                }
                setBusy(true);
                try {
                  const res = await cancelarContaPagar(sessao, contaCancelarModal, motivoCancelamento);
                  onNotify(res.msg, res.ok ? 'success' : 'error');
                  if (res.ok) {
                    setContaCancelarModal(null);
                    setMotivoCancelamento('');
                    await onAtualizar();
                  }
                } finally {
                  setBusy(false);
                }
              }}
            >
              <div style={{ marginBottom: 14 }}>
                <label className="field-label">Explicação / Motivo do Cancelamento *</label>
                <textarea
                  className="field-input"
                  rows={3}
                  required
                  placeholder="Ex.: Compra não foi entregue pelo fornecedor / pedido cancelado"
                  value={motivoCancelamento}
                  onChange={(e) => setMotivoCancelamento(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="btn" onClick={() => setContaCancelarModal(null)}>
                  Voltar
                </button>
                <button
                  type="submit"
                  className="btn btn-danger"
                  disabled={busy || !motivoCancelamento.trim()}
                >
                  {busy ? 'Cancelando...' : '🚫 Confirmar Cancelamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
