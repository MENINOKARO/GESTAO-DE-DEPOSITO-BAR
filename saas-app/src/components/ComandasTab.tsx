import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ClipboardList,
  DollarSign,
  Eraser,
  Minus,
  Plus,
  RefreshCw,
  Trash2,
  UserPlus,
  X
} from 'lucide-react';
import type {
  Cliente,
  Comanda,
  ComandaItem,
  Empresa,
  FormaPagamento,
  MovimentoCaixa,
  Produto,
  SessaoAtiva
} from '../types/domain';
import {
  abrirComanda,
  adicionarItemComanda,
  arquivarComandasQuitadasOuVazias,
  receberEFecharComanda,
  registrarPagamentoParcialComanda,
  removerItemComanda
} from '../services/dataRepository';
import { formatarDataHoraBr, formatarMoeda } from '../utils/formatters';
import { beep, beepErro } from '../utils/soundFeedback';
import { ClienteQuickModal } from './ClienteQuickModal';
import { PixPaymentBox } from './PixPaymentBox';

interface ComandasTabProps {
  sessao: SessaoAtiva;
  empresa: Empresa;
  comandas: Comanda[];
  produtos: Produto[];
  clientes: Cliente[];
  caixa?: MovimentoCaixa[];
  permitirEstoqueNegativo: boolean;
  onNotify: (texto: string, tipo?: 'success' | 'error' | 'warning' | 'info') => void;
  onAtualizar: () => Promise<void>;
}

const BOTOES_PGTO: Array<{ forma: FormaPagamento; label: string }> = [
  { forma: 'Dinheiro', label: '💵 Dinheiro' },
  { forma: 'PIX', label: '💠 PIX' },
  { forma: 'Cartão Débito', label: '💳 Débito' },
  { forma: 'Cartão Crédito', label: '💳 Crédito' },
  { forma: 'Fiado', label: '🧾 Fiado' },
  { forma: 'Outro', label: '🏷️ Outro' }
];

export function ComandasTab({
  sessao,
  empresa,
  comandas,
  produtos,
  clientes,
  caixa = [],
  permitirEstoqueNegativo,
  onNotify,
  onAtualizar
}: ComandasTabProps) {
  const [clienteNovo, setClienteNovo] = useState('');
  const [modalClienteAberto, setModalClienteAberto] = useState(false);
  const [busy, setBusy] = useState(false);

  // Modal Detalhes da Comanda
  const [comandaDetalhesId, setComandaDetalhesId] = useState<string | null>(null);
  const [secaoAddAberta, setSecaoAddAberta] = useState(false);
  const [prodAddId, setProdAddId] = useState('');
  const [qtdAdd, setQtdAdd] = useState(1);
  const [unitAdd, setUnitAdd] = useState('');
  const [itemEstornar, setItemEstornar] = useState<{ comanda: Comanda; item: ComandaItem } | null>(null);

  // Modal Fechamento / Pagamento da Comanda
  const [comandaFecharId, setComandaFecharId] = useState<string | null>(null);
  const [comandaEncerrarZerada, setComandaEncerrarZerada] = useState<Comanda | null>(null);
  const [valorPagar, setValorPagar] = useState('');
  const [formaFechar, setFormaFechar] = useState<FormaPagamento>('Dinheiro');
  const [valorRecebidoDinheiro, setValorRecebidoDinheiro] = useState('');
  const [obsOutroFechar, setObsOutroFechar] = useState('');

  const perfil = String(sessao.usuario.perfil || '').toUpperCase();
  const isDonoOuAdmin = perfil === 'DONO' || perfil === 'ADMIN';

  const abertas = useMemo(() => comandas.filter((c) => c.status === 'ABERTA'), [comandas]);
  const encerradas = useMemo(() => comandas.filter((c) => c.status !== 'ABERTA'), [comandas]);

  const qtdQuitadasOuVazias = abertas.filter((c) => c.saldo <= 0.009 || c.total <= 0).length;

  const produtosOrdenados = useMemo(() => {
    return [...produtos].sort((a, b) => {
      const hasA = (Number(a.estoque_atual) || 0) > 0 ? 1 : 0;
      const hasB = (Number(b.estoque_atual) || 0) > 0 ? 1 : 0;
      if (hasA !== hasB) return hasB - hasA;
      return a.nome.localeCompare(b.nome, 'pt-BR');
    });
  }, [produtos]);

  const comandaDetalhes = comandaDetalhesId
    ? abertas.find((c) => c.id === comandaDetalhesId) || null
    : null;

  const comandaFechar = comandaFecharId
    ? abertas.find((c) => c.id === comandaFecharId) || null
    : null;

  function obterSaldoComanda(c: Comanda): number {
    if (c.saldo !== undefined && c.saldo !== null) {
      return Math.max(0, Number(c.saldo));
    }
    return Math.max(0, Number(c.total || 0) - Number(c.pago || 0));
  }

  function obterPagamentosComanda(c: Comanda): MovimentoCaixa[] {
    const ped = String(c.pedido || '').trim();
    if (!ped || !Array.isArray(caixa)) return [];
    const regexPed = new RegExp(`COMANDA\\s*#?0*${ped}(?!\\d)`, 'i');
    return caixa.filter((m) => {
      if (m.tipo !== 'ENTRADA') return false;
      const txt = `${m.origem || ''} ${m.descricao || ''}`;
      return regexPed.test(txt);
    });
  }

  async function handleAbrir(nomeForcado?: string) {
    const nomeFinal = (nomeForcado ?? clienteNovo).trim();
    if (!nomeFinal) {
      onNotify('Informe ou cadastre o cliente para abrir a comanda.', 'warning');
      return;
    }
    setBusy(true);
    try {
      const res = await abrirComanda(sessao, nomeFinal);
      if (res.ok && res.comanda) {
        setClienteNovo('');
        onNotify(res.msg, 'success');
        await onAtualizar();
      } else {
        onNotify(res.msg, 'error');
      }
    } finally {
      setBusy(false);
    }
  }

  function abrirDetalhes(cmd: Comanda) {
    setComandaDetalhesId(cmd.id);
    setSecaoAddAberta(false);
    setProdAddId('');
    setQtdAdd(1);
    setUnitAdd('');
  }

  function handleSelectProdutoAdd(id: string) {
    setProdAddId(id);
    const p = produtos.find((x) => x.id === id);
    if (p) {
      setUnitAdd(Number(p.preco_venda).toFixed(2));
    } else {
      setUnitAdd('');
    }
  }

  async function handleConfirmarAddItem() {
    if (!comandaDetalhes) return;
    const prod = produtos.find((p) => p.id === prodAddId);
    if (!prod) {
      onNotify('Selecione um produto para adicionar!', 'warning');
      return;
    }
    const qtd = Math.max(1, Number(qtdAdd) || 1);
    const estDisp = Number(prod.estoque_atual) || 0;
    if (!permitirEstoqueNegativo && qtd > estDisp) {
      onNotify(
        estDisp <= 0
          ? `❌ O produto "${prod.nome}" está ESGOTADO no estoque!`
          : `⚠️ Estoque insuficiente para "${prod.nome}" (${estDisp} un disponíveis).`,
        'error'
      );
      beepErro();
      return;
    }

    const unit = parseFloat(unitAdd);
    const unitPermitido = isDonoOuAdmin && unit > 0 ? unit : prod.preco_venda;
    setBusy(true);
    try {
      const res = await adicionarItemComanda(
        sessao,
        comandaDetalhes.id,
        prod,
        qtd,
        unitPermitido,
        permitirEstoqueNegativo
      );
      if (res.ok) {
        beep();
        setProdAddId('');
        setQtdAdd(1);
        setUnitAdd('');
        onNotify(res.msg, 'success');
        await onAtualizar();
      } else {
        beepErro();
        onNotify(res.msg, 'error');
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmarEstornoItem() {
    if (!itemEstornar) return;
    setBusy(true);
    try {
      const res = await removerItemComanda(sessao, itemEstornar.comanda, itemEstornar.item);
      if (res.ok) {
        setItemEstornar(null);
        onNotify(res.msg, 'success');
        await onAtualizar();
      } else {
        onNotify(res.msg, 'error');
      }
    } finally {
      setBusy(false);
    }
  }

  function acionarEncerramentoCard(cmd: Comanda) {
    const saldo = obterSaldoComanda(cmd);
    const isZerada = saldo <= 0.009 || Number(cmd.total) <= 0;
    if (isZerada) {
      setComandaEncerrarZerada(cmd);
    } else {
      abrirModalFecharComanda(cmd);
    }
  }

  function abrirModalFecharComanda(cmd: Comanda) {
    const saldo = obterSaldoComanda(cmd);
    setComandaDetalhesId(null);
    setComandaFecharId(cmd.id);
    setValorPagar(saldo > 0 ? saldo.toFixed(2) : '0.00');
    setFormaFechar('Dinheiro');
    setValorRecebidoDinheiro('');
    setObsOutroFechar('');
  }

  async function handleConfirmarEncerrarZerada() {
    if (!comandaEncerrarZerada) return;
    setBusy(true);
    try {
      const res = await receberEFecharComanda(sessao, comandaEncerrarZerada, 'Dinheiro');
      if (res.ok) {
        setComandaEncerrarZerada(null);
        onNotify(res.msg, 'success');
        await onAtualizar();
      } else {
        onNotify(res.msg, 'error');
      }
    } finally {
      setBusy(false);
    }
  }

  function obterValorParcialEfetivo(): number {
    const valInput = parseFloat(valorPagar) || 0;
    const valEntregue = parseFloat(valorRecebidoDinheiro) || 0;
    if (!comandaFechar) return valInput;
    const saldo = obterSaldoComanda(comandaFechar);
    // Se Valor a Pagar Agora ainda está igual ao saldo total, mas o operador digitou um Valor Entregue menor que o saldo
    if (formaFechar === 'Dinheiro' && Math.abs(valInput - saldo) < 0.009 && valEntregue > 0 && valEntregue < saldo - 0.009) {
      return valEntregue;
    }
    return valInput;
  }

  async function handleExecutarPagamentoComanda(isQuitacaoTotal: boolean) {
    if (!comandaFechar) return;
    const saldo = obterSaldoComanda(comandaFechar);
    const val = isQuitacaoTotal ? (parseFloat(valorPagar) || 0) : obterValorParcialEfetivo();

    if (formaFechar === 'Outro' && !obsOutroFechar.trim()) {
      onNotify('⚠️ Atenção: Informe a observação explicando o uso da forma "Outro" antes de continuar.', 'warning');
      return;
    }

    if (!isQuitacaoTotal) {
      if (!(val > 0)) {
        onNotify('Informe o valor a abater na comanda.', 'warning');
        return;
      }
      if (val >= saldo - 0.009) {
        onNotify('Para abater parcialmente, informe um valor menor que o saldo devedor no campo "Valor a Pagar Agora (R$)".', 'warning');
        return;
      }
      setBusy(true);
      try {
        const res = await registrarPagamentoParcialComanda(sessao, comandaFechar, val, formaFechar, obsOutroFechar);
        if (res.ok) {
          onNotify(res.msg, 'success');
          if (formaFechar === 'Outro') {
            onNotify('🏷️ Pagamento em "Outro" registrado! O Dono foi notificado no Telegram para conferência/conversão.', 'warning');
          }
          await onAtualizar();
          const novoSaldoRestante = Math.max(0, Number((saldo - val).toFixed(2)));
          if (novoSaldoRestante <= 0.009) {
            setComandaFecharId(null);
          } else {
            setValorPagar(novoSaldoRestante.toFixed(2));
            setValorRecebidoDinheiro('');
            setObsOutroFechar('');
          }
        } else {
          onNotify(res.msg, 'error');
        }
      } finally {
        setBusy(false);
      }
      return;
    }

    setBusy(true);
    try {
      const res = await receberEFecharComanda(sessao, comandaFechar, formaFechar, obsOutroFechar);
      if (res.ok) {
        setComandaFecharId(null);
        onNotify(res.msg, 'success');
        if (formaFechar === 'Outro') {
          onNotify('🏷️ Pagamento em "Outro" registrado! O Dono foi notificado no Telegram para conferência/conversão.', 'warning');
        }
        await onAtualizar();
      } else {
        onNotify(res.msg, 'error');
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleArquivarLote() {
    setBusy(true);
    try {
      const res = await arquivarComandasQuitadasOuVazias(sessao);
      onNotify(res.msg, res.ok ? 'success' : 'error');
      await onAtualizar();
    } finally {
      setBusy(false);
    }
  }

  const saldoModalFechar = comandaFechar ? obterSaldoComanda(comandaFechar) : 0;
  const valModalFecharNum = parseFloat(valorPagar) || 0;
  const recebidoDinNum = parseFloat(valorRecebidoDinheiro) || 0;
  const valParcialEfetivo = obterValorParcialEfetivo();
  const isParcialValido = valParcialEfetivo > 0 && valParcialEfetivo < saldoModalFechar - 0.009;
  const restanteAposModal = Math.max(0, saldoModalFechar - valParcialEfetivo);
  const trocoModal = Math.max(0, recebidoDinNum - valModalFecharNum);

  const unitAddNum = parseFloat(unitAdd) || 0;
  const subtotalAddPreview = qtdAdd * unitAddNum;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* BARRA SUPERIOR DAS COMANDAS */}
      <div className="panel-card">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: 17, display: 'flex', alignItems: 'center', gap: 8 }}>
              <ClipboardList size={18} color="#38bdf8" />
              <span>Comandas Balcão em Aberto ({abertas.length})</span>
            </h3>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Toque em qualquer card para ver os produtos consumidos, lançar novos itens, estornar ou receber.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              list="listaClientesComanda"
              className="field-input"
              style={{ width: 210 }}
              placeholder="Cliente / Mesa..."
              value={clienteNovo}
              onChange={(e) => setClienteNovo(e.target.value)}
            />
            <datalist id="listaClientesComanda">
              {clientes.map((c) => (
                <option key={c.id} value={c.nome} />
              ))}
            </datalist>

            <button
              type="button"
              className="btn"
              onClick={() => setModalClienteAberto(true)}
            >
              <UserPlus size={15} color="#38bdf8" /> Cadastrar Cliente
            </button>

            <button type="button" className="btn btn-primary" onClick={() => void handleAbrir()} disabled={busy}>
              <Plus size={15} /> Nova Comanda
            </button>

            {qtdQuitadasOuVazias > 0 && (
              <button
                type="button"
                className="btn"
                style={{ borderColor: '#f59e0b', color: '#fbbf24', background: 'rgba(245, 158, 11, 0.14)' }}
                onClick={handleArquivarLote}
                disabled={busy}
              >
                <Eraser size={14} /> Arquivar Quitadas / Vazias ({qtdQuitadasOuVazias})
              </button>
            )}

            <button type="button" className="btn" onClick={() => void onAtualizar()} disabled={busy}>
              <RefreshCw size={14} /> Atualizar Comandas
            </button>
          </div>
        </div>
      </div>

      {/* GRID DE CARDS DE COMANDAS ABERTAS (FIEL AO LEGADO) */}
      {abertas.length === 0 ? (
        <div className="panel-card" style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
          <h4 style={{ fontSize: 16, marginBottom: 6, color: '#f8fafc' }}>
            Nenhuma comanda aberta no balcão no momento!
          </h4>
          <p style={{ fontSize: 13 }}>
            Abra uma comanda acima ou envie um carrinho pelo botão "ABRIR COMANDA" no PDV Balcão.
          </p>
        </div>
      ) : (
        <div className="comandas-grid">
          {abertas.map((c) => {
            const totalConsumido = Number(c.total) || 0;
            const totalPago = Number(c.pago) || 0;
            const saldoDevedor = obterSaldoComanda(c);
            const temItens = c.itens.length > 0;
            const isQuitada = totalConsumido > 0 && saldoDevedor <= 0.009;
            const isZerada = saldoDevedor <= 0.009 || totalConsumido <= 0;

            return (
              <div
                key={c.id}
                className="comanda-card"
                onClick={() => abrirDetalhes(c)}
                title={`Clique para gerenciar Comanda #${c.pedido}`}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <strong style={{ color: '#fbbf24', fontSize: 14 }}>🧾 Comanda #{c.pedido}</strong>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {isZerada && (
                        <span className={isQuitada ? 'badge badge-ok' : 'badge'}>
                          {isQuitada ? '✅ QUITADA' : 'SEM DÉBITOS'}
                        </span>
                      )}
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {formatarDataHoraBr(c.data_abertura)}
                      </span>
                    </div>
                  </div>

                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                    📋 Toque no card para ver itens &amp; gerenciar
                  </div>

                  <div style={{ fontWeight: 700, fontSize: 14.5, marginTop: 8 }}>
                    👤 {c.cliente}
                  </div>

                  <div
                    style={{
                      marginTop: 8,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      maxHeight: 130,
                      overflowY: 'auto'
                    }}
                  >
                    {temItens ? (
                      c.itens.map((it) => (
                        <div
                          key={it.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: 12,
                            color: '#cbd5e1',
                            paddingBottom: 3,
                            borderBottom: '1px solid rgba(148, 163, 184, 0.08)'
                          }}
                        >
                          <span>
                            • <strong>{it.quantidade}x</strong> {it.produto_nome}
                          </span>
                          <span style={{ color: '#34d399', fontWeight: 700 }}>
                            {formatarMoeda(it.subtotal)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                        Nenhum item discriminado
                      </div>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop: 10,
                    borderTop: '1px solid var(--border-subtle)'
                  }}
                >
                  <div>
                    {(totalPago > 0 || isZerada) && totalConsumido > 0 && (
                      <div style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                        Consumido: {formatarMoeda(totalConsumido)} | Pago: {formatarMoeda(totalPago)}
                        {obterPagamentosComanda(c).length > 0 && (
                          <div style={{ color: '#38bdf8', marginTop: 2 }}>
                            {obterPagamentosComanda(c)
                              .map((pg) => `${pg.forma_pagamento}: ${formatarMoeda(pg.valor)}`)
                              .join(' • ')}
                          </div>
                        )}
                      </div>
                    )}
                    <strong style={{ fontSize: 16, color: isZerada ? '#34d399' : totalPago > 0 ? '#fbbf24' : '#34d399' }}>
                      {isZerada
                        ? 'Saldo: R$ 0,00'
                        : totalPago > 0
                        ? `Restante: ${formatarMoeda(saldoDevedor)}`
                        : formatarMoeda(saldoDevedor)}
                    </strong>
                  </div>

                  <button
                    type="button"
                    className={`btn ${isZerada ? 'btn-success' : 'btn-primary'}`}
                    style={{ padding: '7px 12px', fontSize: 12 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      acionarEncerramentoCard(c);
                    }}
                  >
                    {isZerada ? '✅ Encerrar' : '💳 Fechar'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {encerradas.length > 0 && (
        <div className="panel-card">
          <h4 style={{ marginBottom: 10, fontSize: 13.5, color: 'var(--text-muted)' }}>
            Últimas Comandas Encerradas ({encerradas.length})
          </h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {encerradas.slice(0, 8).map((cmd) => (
              <div
                key={cmd.id}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12,
                  padding: '6px 12px',
                  borderRadius: 10,
                  background: 'rgba(15, 23, 42, 0.55)',
                  border: '1px solid var(--border-subtle)'
                }}
              >
                <span>
                  {cmd.pedido} — {cmd.cliente}
                </span>
                <span className="badge badge-ok">{formatarMoeda(cmd.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL DETALHES DA COMANDA */}
      {comandaDetalhes && (
        <div className="modal-overlay">
          <div className="panel-card" style={{ maxWidth: 640, width: '100%', maxHeight: '92vh', overflowY: 'auto', borderColor: 'var(--border-accent)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 10 }}>
              <h3 style={{ fontSize: 17, color: '#fbbf24' }}>
                🧾 Comanda #{comandaDetalhes.pedido}
              </h3>
              <button type="button" className="btn btn-xs" onClick={() => setComandaDetalhesId(null)}>
                <X size={15} />
              </button>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'rgba(15, 23, 42, 0.65)',
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid var(--border-subtle)',
                marginTop: 12,
                fontSize: 13
              }}
            >
              <div>
                👤 Cliente: <strong style={{ color: '#f8fafc' }}>{comandaDetalhes.cliente}</strong>
              </div>
              <div style={{ color: 'var(--text-muted)' }}>
                🕒 {formatarDataHoraBr(comandaDetalhes.data_abertura)}
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  🛒 Itens Consumidos ({comandaDetalhes.itens.length})
                </span>
                {isDonoOuAdmin && (
                  <span className="badge badge-warn">👑 Modo Dono: Exclusão &amp; Estorno Ativos</span>
                )}
              </div>

              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Produto</th>
                      <th>Qtd</th>
                      <th>Unitário</th>
                      <th>Total</th>
                      {isDonoOuAdmin && <th>Estorno</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {comandaDetalhes.itens.map((it) => (
                      <tr key={it.id}>
                        <td style={{ fontWeight: 600 }}>{it.produto_nome}</td>
                        <td style={{ color: '#38bdf8', fontWeight: 700 }}>{it.quantidade}x</td>
                        <td>{formatarMoeda(it.preco_unitario)}</td>
                        <td style={{ color: '#34d399', fontWeight: 700 }}>{formatarMoeda(it.subtotal)}</td>
                        {isDonoOuAdmin && (
                          <td>
                            <button
                              type="button"
                              className="btn btn-danger btn-xs"
                              onClick={() => setItemEstornar({ comanda: comandaDetalhes, item: it })}
                              disabled={busy}
                              title={`Estornar ${it.quantidade}x ${it.produto_nome} ao estoque`}
                            >
                              <Trash2 size={12} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                    {comandaDetalhes.itens.length === 0 && (
                      <tr>
                        <td colSpan={isDonoOuAdmin ? 5 : 4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                          Nenhum item discriminado nesta comanda.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'rgba(16, 185, 129, 0.1)',
                padding: '12px 16px',
                borderRadius: 10,
                border: '1px solid rgba(16, 185, 129, 0.35)',
                marginTop: 12
              }}
            >
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Total Consumido: {formatarMoeda(comandaDetalhes.total)} • Pago:{' '}
                  {formatarMoeda(comandaDetalhes.pago)}
                </div>
                <strong style={{ fontSize: 13 }}>SALDO DA COMANDA:</strong>
              </div>
              <strong style={{ fontSize: 21, color: '#34d399' }}>
                {formatarMoeda(obterSaldoComanda(comandaDetalhes))}
              </strong>
            </div>

            {obterPagamentosComanda(comandaDetalhes).length > 0 && (
              <div
                style={{
                  marginTop: 10,
                  background: 'rgba(15, 23, 42, 0.72)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 10,
                  padding: '10px 12px'
                }}
              >
                <div style={{ fontSize: 11.5, fontWeight: 700, color: '#38bdf8', marginBottom: 6, textTransform: 'uppercase' }}>
                  💵 Pagamentos &amp; Abatimentos Já Registrados ({obterPagamentosComanda(comandaDetalhes).length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {obterPagamentosComanda(comandaDetalhes).map((pg) => (
                    <div
                      key={pg.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: 12,
                        paddingBottom: 4,
                        borderBottom: '1px solid rgba(148,163,184,0.08)'
                      }}
                    >
                      <span style={{ color: '#cbd5e1' }}>
                        <span className="badge badge-purple" style={{ marginRight: 6 }}>
                          {pg.forma_pagamento || 'Dinheiro'}
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                          {formatarDataHoraBr(pg.data_hora)}
                        </span>
                      </span>
                      <strong style={{ color: '#34d399' }}>{formatarMoeda(pg.valor)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SEÇÃO EXPANSÍVEL: LANÇAR MAIS PRODUTOS */}
            <div
              style={{
                marginTop: 12,
                border: '1px solid var(--border-subtle)',
                borderRadius: 10,
                padding: '10px 14px',
                background: 'rgba(30, 41, 59, 0.45)'
              }}
            >
              <button
                type="button"
                onClick={() => setSecaoAddAberta((prev) => !prev)}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  color: '#fbbf24',
                  fontWeight: 700,
                  fontSize: 13
                }}
              >
                <span>➕ Lançar Mais Produtos nesta Comanda</span>
                <span>{secaoAddAberta ? '▲' : '▼'}</span>
              </button>

              {secaoAddAberta && (
                <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <label className="field-label">Selecione o Produto</label>
                    <select
                      className="field-select"
                      value={prodAddId}
                      onChange={(e) => handleSelectProdutoAdd(e.target.value)}
                    >
                      <option value="">Selecione um produto...</option>
                      {produtosOrdenados.map((p) => {
                        const est = Number(p.estoque_atual) || 0;
                        return (
                          <option key={p.id} value={p.id}>
                            {p.nome} — {formatarMoeda(p.preco_venda)}{' '}
                            {est <= 0 ? '[🚫 ESGOTADO]' : `(${est} un)`}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label className="field-label">Quantidade</label>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          type="button"
                          className="btn btn-xs"
                          onClick={() => setQtdAdd((q) => Math.max(1, q - 1))}
                        >
                          <Minus size={12} />
                        </button>
                        <input
                          type="number"
                          min="1"
                          className="field-input"
                          style={{ textAlign: 'center' }}
                          value={qtdAdd}
                          onChange={(e) => setQtdAdd(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        />
                        <button
                          type="button"
                          className="btn btn-xs"
                          onClick={() => setQtdAdd((q) => q + 1)}
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="field-label">
                        Valor Unitário (R$){' '}
                        {!isDonoOuAdmin && (
                          <span style={{ fontSize: 10.5, color: '#94a3b8', fontWeight: 400 }}>
                            (🔒 fixo p/ vendedor)
                          </span>
                        )}
                      </label>
                      <input
                        type="number"
                        step="0.50"
                        min="0"
                        className="field-input"
                        value={unitAdd}
                        readOnly={!isDonoOuAdmin}
                        disabled={!isDonoOuAdmin}
                        title={
                          isDonoOuAdmin
                            ? 'Permitido alterar o valor no momento de adicionar'
                            : 'Apenas ADMIN e DONO podem alterar o valor unitário do produto'
                        }
                        style={
                          !isDonoOuAdmin
                            ? { opacity: 0.72, cursor: 'not-allowed', background: 'rgba(15, 23, 42, 0.85)' }
                            : undefined
                        }
                        onChange={(e) => {
                          if (!isDonoOuAdmin) return;
                          setUnitAdd(e.target.value);
                        }}
                      />
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: 'rgba(15, 23, 42, 0.7)',
                      padding: '8px 12px',
                      borderRadius: 8
                    }}
                  >
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Subtotal do Lançamento:</span>
                    <strong style={{ color: '#34d399', fontSize: 16 }}>
                      {formatarMoeda(subtotalAddPreview)}
                    </strong>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleConfirmarAddItem}
                      disabled={busy || !prodAddId}
                    >
                      <Plus size={14} /> Confirmar Lançamento
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
              <button type="button" className="btn" onClick={() => setComandaDetalhesId(null)}>
                ✕ Fechar Janela
              </button>
              <button
                type="button"
                className="btn btn-success"
                onClick={() => acionarEncerramentoCard(comandaDetalhes)}
              >
                <CheckCircle2 size={15} />
                <span>
                  {obterSaldoComanda(comandaDetalhes) <= 0.009
                    ? 'Encerrar & Arquivar Comanda'
                    : 'Fechar & Receber Comanda'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PAGAMENTO & FECHAMENTO DA COMANDA */}
      {comandaFechar && (
        <div className="modal-overlay">
          <div className="panel-card" style={{ maxWidth: 520, width: '100%', maxHeight: '92vh', overflowY: 'auto', borderColor: 'var(--border-accent)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 10, marginBottom: 12 }}>
              <h3 style={{ fontSize: 17 }}>
                💳 Pagamento da Comanda #{comandaFechar.pedido}
              </h3>
              <button type="button" className="btn btn-xs" onClick={() => setComandaFecharId(null)}>
                <X size={15} />
              </button>
            </div>

            <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 12 }}>
              <div className="kpi-card" style={{ padding: 10, textAlign: 'center' }}>
                <div className="kpi-label">Total Comanda</div>
                <strong>{formatarMoeda(comandaFechar.total)}</strong>
              </div>
              <div className="kpi-card" style={{ padding: 10, textAlign: 'center' }}>
                <div className="kpi-label">Já Pago</div>
                <strong style={{ color: '#38bdf8' }}>{formatarMoeda(comandaFechar.pago)}</strong>
              </div>
              <div className="kpi-card" style={{ padding: 10, textAlign: 'center', borderColor: '#10b981' }}>
                <div className="kpi-label">Saldo Devedor</div>
                <strong style={{ color: '#34d399' }}>{formatarMoeda(saldoModalFechar)}</strong>
              </div>
            </div>

            <div style={{ fontSize: 12.5, marginBottom: 12, color: 'var(--text-muted)' }}>
              Cliente: <strong style={{ color: '#f8fafc' }}>{comandaFechar.cliente}</strong>
            </div>

            {obterPagamentosComanda(comandaFechar).length > 0 && (
              <div
                style={{
                  marginBottom: 12,
                  background: 'rgba(15, 23, 42, 0.72)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 10,
                  padding: '8px 12px'
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: '#38bdf8', marginBottom: 6, textTransform: 'uppercase' }}>
                  💵 Histórico de Pagamentos Desta Comanda ({obterPagamentosComanda(comandaFechar).length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {obterPagamentosComanda(comandaFechar).map((pg) => (
                    <div
                      key={pg.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: 11.5
                      }}
                    >
                      <span>
                        <span className="badge badge-purple" style={{ marginRight: 6 }}>
                          {pg.forma_pagamento || 'Dinheiro'}
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                          {formatarDataHoraBr(pg.data_hora)}
                        </span>
                      </span>
                      <strong style={{ color: '#34d399' }}>{formatarMoeda(pg.valor)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ background: 'rgba(15, 23, 42, 0.8)', padding: 12, borderRadius: 10, border: '1px solid var(--border-subtle)', marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label className="field-label" style={{ marginBottom: 0 }}>
                  Valor a Pagar Agora (R$)
                </label>
                <button
                  type="button"
                  className="btn btn-xs"
                  onClick={() => setValorPagar(saldoModalFechar.toFixed(2))}
                >
                  Quitar Saldo Todo
                </button>
              </div>
              <input
                type="number"
                step="0.50"
                min="0.01"
                className="field-input"
                style={{ fontSize: 20, fontWeight: 800, textAlign: 'center', color: '#34d399' }}
                value={valorPagar}
                onChange={(e) => setValorPagar(e.target.value)}
              />
              <div style={{ fontSize: 11.5, marginTop: 6, textAlign: 'center' }}>
                {valModalFecharNum <= 0 ? (
                  <span style={{ color: '#f87171' }}>Digite um valor válido maior que zero.</span>
                ) : isParcialValido ? (
                  <span style={{ color: '#38bdf8' }}>
                    💸 Pagamento parcial de <strong>{formatarMoeda(valParcialEfetivo)}</strong>: restará um saldo de{' '}
                    <strong>{formatarMoeda(restanteAposModal)}</strong>
                  </span>
                ) : (
                  <span style={{ color: '#34d399' }}>
                    ✅ Este valor quita integralmente a comanda! (Altere o valor acima ou o valor entregue para pagamento parcial)
                  </span>
                )}
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label className="field-label">Forma de Pagamento</label>
              <div className="payment-grid">
                {BOTOES_PGTO.map((b) => (
                  <button
                    key={b.forma}
                    type="button"
                    className={`pay-btn ${formaFechar === b.forma ? 'active' : ''}`}
                    onClick={() => setFormaFechar(b.forma)}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            {formaFechar === 'PIX' && valModalFecharNum > 0 && (
              <div style={{ marginBottom: 12 }}>
                <PixPaymentBox
                  chavePix={empresa.chave_pix}
                  donoNome={empresa.dono_nome}
                  nomeRecebedor={empresa.nome}
                  cidade={empresa.cidade}
                  valor={valModalFecharNum}
                  txid={`COM${comandaFechar.pedido.replace(/[^a-zA-Z0-9]/g, '')}`}
                  mostrarQrPorPadrao
                  onNotify={onNotify}
                />
              </div>
            )}

            {formaFechar === 'Outro' && (
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: 'rgba(245, 158, 11, 0.14)',
                  border: '1px solid #f59e0b',
                  marginBottom: 12,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 700, color: '#fbbf24' }}>
                  ⚠️ Atenção: Uso da opção &quot;Outro&quot; exige justificativa
                </div>
                <div style={{ fontSize: 11.5, color: '#fde68a' }}>
                  O Dono será notificado no Telegram e apenas ele poderá converter este pagamento para outra forma depois.
                </div>
                <input
                  type="text"
                  className="field-input"
                  placeholder="Informe o motivo / meio utilizado (Ex: Vale, TED, Permuta...) *"
                  value={obsOutroFechar}
                  onChange={(e) => setObsOutroFechar(e.target.value)}
                />
              </div>
            )}

            {formaFechar === 'Dinheiro' && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  borderRadius: 10,
                  background: 'rgba(15, 23, 42, 0.72)',
                  border: '1px solid var(--border-subtle)',
                  marginBottom: 12
                }}
              >
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>💵 Valor Entregue:</span>
                <input
                  type="number"
                  step="0.50"
                  min="0"
                  className="field-input"
                  style={{ width: 110, padding: '6px 8px' }}
                  placeholder="R$ 0,00"
                  value={valorRecebidoDinheiro}
                  onChange={(e) => setValorRecebidoDinheiro(e.target.value)}
                />
                {recebidoDinNum > 0 && recebidoDinNum < valModalFecharNum - 0.009 ? (
                  <span style={{ marginLeft: 'auto', fontWeight: 700, color: '#38bdf8', fontSize: 12.5 }}>
                    💸 Abater {formatarMoeda(recebidoDinNum)} (Resta: {formatarMoeda(saldoModalFechar - recebidoDinNum)})
                  </span>
                ) : (
                  <span style={{ marginLeft: 'auto', fontWeight: 700, color: '#34d399', fontSize: 13 }}>
                    Troco: {formatarMoeda(trocoModal)}
                  </span>
                )}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap', paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
              <button type="button" className="btn" onClick={() => setComandaFecharId(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || !isParcialValido}
                onClick={() => void handleExecutarPagamentoComanda(false)}
              >
                <DollarSign size={14} /> Registrar Pagamento Parcial
                {isParcialValido ? ` (${formatarMoeda(valParcialEfetivo)})` : ''}
              </button>
              <button
                type="button"
                className="btn btn-success"
                disabled={busy || valModalFecharNum <= 0}
                onClick={() => void handleExecutarPagamentoComanda(true)}
              >
                <CheckCircle2 size={14} /> Quitar Comanda Integral
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMAR ESTORNO DE ITEM (DONO/ADMIN) */}
      {itemEstornar && (
        <div className="modal-overlay" style={{ zIndex: 110 }}>
          <div className="panel-card" style={{ maxWidth: 420, width: '100%', borderColor: 'var(--border-accent)' }}>
            <h4 style={{ fontSize: 16, marginBottom: 10 }}>
              🗑️ Estornar Item da Comanda #{itemEstornar.comanda.pedido}
            </h4>
            <p style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.5, marginBottom: 16 }}>
              Deseja remover <strong>{itemEstornar.item.quantidade}x {itemEstornar.item.produto_nome}</strong> (
              {formatarMoeda(itemEstornar.item.subtotal)}) e devolver{' '}
              <strong style={{ color: '#34d399' }}>{itemEstornar.item.quantidade} un</strong> ao estoque?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" className="btn" onClick={() => setItemEstornar(null)} disabled={busy}>
                Cancelar
              </button>
              <button type="button" className="btn btn-danger" onClick={handleConfirmarEstornoItem} disabled={busy}>
                {busy ? 'Estornando...' : 'Sim, Estornar & Devolver'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMAR ENCERRAMENTO DE COMANDA ZERADA / QUITADA */}
      {comandaEncerrarZerada && (
        <div className="modal-overlay" style={{ zIndex: 110 }}>
          <div className="panel-card" style={{ maxWidth: 420, width: '100%', borderColor: 'var(--border-accent)' }}>
            <h4 style={{ fontSize: 16, marginBottom: 10 }}>
              ✅ Encerrar Comanda #{comandaEncerrarZerada.pedido}
            </h4>
            <p style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.5, marginBottom: 16 }}>
              Esta comanda está com saldo <strong>R$ 0,00</strong> (quitada/sem débitos). Deseja encerrar e arquivar agora?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" className="btn" onClick={() => setComandaEncerrarZerada(null)} disabled={busy}>
                Cancelar
              </button>
              <button type="button" className="btn btn-success" onClick={handleConfirmarEncerrarZerada} disabled={busy}>
                {busy ? 'Encerrando...' : 'Sim, Encerrar Comanda'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ClienteQuickModal
        sessao={sessao}
        aberto={modalClienteAberto}
        onFechar={() => setModalClienteAberto(false)}
        onNotify={onNotify}
        onCriado={async (cli) => {
          setClienteNovo(cli.nome);
          await onAtualizar();
        }}
      />
    </div>
  );
}
