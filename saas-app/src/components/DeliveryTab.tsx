import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Bike, CheckCircle2, MapPin, Minus, Phone, Plus, Printer, Trash2, UserPlus, X, XCircle } from 'lucide-react';
import type {
  Cliente,
  DeliveryPedido,
  FormaPagamento,
  ItemCarrinho,
  Produto,
  SessaoAtiva,
  StatusDelivery
} from '../types/domain';
import { atualizarStatusDelivery, criarPedidoDelivery } from '../services/dataRepository';
import { formatarDataHoraBr, formatarMoeda, formatarTelefoneBr, formatarTextoInicialMaiuscula } from '../utils/formatters';
import { beep, beepErro } from '../utils/soundFeedback';
import { ClienteQuickModal } from './ClienteQuickModal';
import {
  getAutoPrintDeliveryEmpresa,
  imprimirCupomTermicoDelivery,
  setAutoPrintDeliveryEmpresa
} from '../services/thermalPrintService';

interface DeliveryTabProps {
  sessao: SessaoAtiva;
  pedidos: DeliveryPedido[];
  produtos: Produto[];
  clientes: Cliente[];
  permitirEstoqueNegativo: boolean;
  onNotify: (texto: string, tipo?: 'success' | 'error' | 'warning' | 'info') => void;
  onAtualizar: () => Promise<void>;
}

const PROXIMO_STATUS: Record<StatusDelivery, StatusDelivery | null> = {
  PENDENTE: 'PREPARANDO',
  PREPARANDO: 'EM_ROTA',
  EM_ROTA: 'ENTREGUE',
  ENTREGUE: null,
  CANCELADO: null
};

const LABEL_BOTAO: Record<string, string> = {
  PREPARANDO: 'Iniciar Preparo',
  EM_ROTA: '▶️ Despachar p/ Rota',
  ENTREGUE: '✅ Confirmar Entrega'
};

export function DeliveryTab({
  sessao,
  pedidos,
  produtos,
  clientes,
  permitirEstoqueNegativo,
  onNotify,
  onAtualizar
}: DeliveryTabProps) {
  const [autoPrint, setAutoPrint] = useState<boolean>(() => getAutoPrintDeliveryEmpresa(sessao.unidadeAtivaId));
  const seenPedidosRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    const idsAtuais = new Set(pedidos.map((p) => p.id));
    if (seenPedidosRef.current === null) {
      seenPedidosRef.current = idsAtuais;
      return;
    }
    if (autoPrint) {
      const novos = pedidos.filter((p) => !seenPedidosRef.current!.has(p.id) && p.status === 'PENDENTE');
      for (const novo of novos) {
        beep();
        imprimirCupomTermicoDelivery(novo, sessao.empresa);
      }
    }
    seenPedidosRef.current = idsAtuais;
  }, [pedidos, autoPrint, sessao.empresa]);
  const [cliente, setCliente] = useState('');
  const [telefone, setTelefone] = useState('');
  const [endereco, setEndereco] = useState('');
  const [referencia, setReferencia] = useState('');
  const [taxaEntrega, setTaxaEntrega] = useState('0.00');
  const [formaPgto, setFormaPgto] = useState<FormaPagamento>('Dinheiro');
  const [entregador, setEntregador] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [itens, setItens] = useState<ItemCarrinho[]>([]);
  const [produtoSelId, setProdutoSelId] = useState('');
  const [qtdSel, setQtdSel] = useState('1');
  const [unitSel, setUnitSel] = useState('');
  const [filtroFila, setFiltroFila] = useState<'PENDENTES' | 'TODOS'>('PENDENTES');
  const [modalClienteAberto, setModalClienteAberto] = useState(false);

  const perfil = String(sessao.usuario.perfil || '').toUpperCase();
  const isDonoOuAdmin = perfil === 'DONO' || perfil === 'ADMIN';

  // Mini-modal despachar entregador
  const [pedidoDespachar, setPedidoDespachar] = useState<DeliveryPedido | null>(null);
  const [entregadorDespacho, setEntregadorDespacho] = useState('');

  const [busy, setBusy] = useState(false);

  const produtosOrdenados = useMemo(() => {
    return [...produtos].sort((a, b) => {
      const hasA = (Number(a.estoque_atual) || 0) > 0 ? 1 : 0;
      const hasB = (Number(b.estoque_atual) || 0) > 0 ? 1 : 0;
      if (hasA !== hasB) return hasB - hasA;
      return a.nome.localeCompare(b.nome, 'pt-BR');
    });
  }, [produtos]);

  function handleSelecionarCliente(nomeDigitado: string) {
    setCliente(nomeDigitado);
    const encontrado = clientes.find((c) => c.nome.toLowerCase() === nomeDigitado.trim().toLowerCase());
    if (encontrado) {
      if (encontrado.telefone) setTelefone(encontrado.telefone);
      if (encontrado.endereco) setEndereco(encontrado.endereco);
      if (encontrado.observacao) setReferencia(encontrado.observacao);
    }
  }

  const totalItens = itens.reduce((acc, i) => acc + i.quantidade * i.produto.preco_venda, 0);
  const totalPedido = totalItens + (parseFloat(taxaEntrega) || 0);

  const pedidosPendentes = pedidos.filter((p) => !['ENTREGUE', 'CANCELADO'].includes(p.status));
  const pedidosExibidos = filtroFila === 'PENDENTES' ? pedidosPendentes : pedidos;

  function ajustarQtdInput(delta: number) {
    const atual = parseInt(qtdSel, 10) || 1;
    setQtdSel(String(Math.max(1, atual + delta)));
  }

  function handleSelectProdutoDelivery(id: string) {
    setProdutoSelId(id);
    const p = produtosOrdenados.find((x) => x.id === id);
    if (p) {
      setUnitSel(Number(p.preco_venda).toFixed(2));
    } else {
      setUnitSel('');
    }
  }

  function adicionarItemLista() {
    const prod = produtosOrdenados.find((p) => p.id === produtoSelId);
    if (!prod) {
      onNotify('Selecione um produto para adicionar.', 'warning');
      return;
    }
    const qtd = Math.max(1, parseInt(qtdSel, 10) || 1);
    const estDisp = Number(prod.estoque_atual) || 0;
    const jaNaLista = itens.find((x) => x.produto.id === prod.id)?.quantidade || 0;

    if (!permitirEstoqueNegativo && estDisp <= 0) {
      onNotify(`❌ O produto "${prod.nome}" está ESGOTADO no estoque!`, 'error');
      beepErro();
      return;
    }
    if (!permitirEstoqueNegativo && jaNaLista + qtd > estDisp) {
      onNotify(
        `⚠️ Estoque insuficiente para "${prod.nome}"! Disponível: ${estDisp} un.`,
        'warning'
      );
      beepErro();
      return;
    }

    const parsedUnit = parseFloat(unitSel);
    const precoLancado =
      isDonoOuAdmin && !isNaN(parsedUnit) && parsedUnit > 0
        ? Number(parsedUnit.toFixed(2))
        : Number(prod.preco_venda);
    const prodComPrecoFixado: Produto = { ...prod, preco_venda: precoLancado };

    beep();
    setItens((prev) => {
      const idx = prev.findIndex((x) => x.produto.id === prod.id);
      if (idx >= 0) {
        return prev.map((x, k) => (k === idx ? { ...x, quantidade: x.quantidade + qtd } : x));
      }
      return [...prev, { produto: prodComPrecoFixado, quantidade: qtd }];
    });
    setProdutoSelId('');
    setQtdSel('1');
    setUnitSel('');
  }

  function removerItemDelivery(prodId: string) {
    setItens((prev) => prev.filter((x) => x.produto.id !== prodId));
  }

  async function handleCriarPedido(e: FormEvent) {
    e.preventDefault();
    if (itens.length === 0) {
      onNotify('Adicione pelo menos 1 item ao pedido de delivery.', 'warning');
      return;
    }
    if (!permitirEstoqueNegativo) {
      for (const item of itens) {
        const prodAtual = produtos.find((p) => p.id === item.produto.id);
        const est = Number(prodAtual?.estoque_atual ?? item.produto.estoque_atual) || 0;
        if (item.quantidade > est) {
          onNotify(`❌ Estoque insuficiente para "${item.produto.nome}" (${est} un disponíveis).`, 'error');
          beepErro();
          return;
        }
      }
    }

    const obsFinal = [referencia.trim() ? `Ref: ${referencia.trim()}` : '', observacoes.trim()]
      .filter(Boolean)
      .join(' | ');

    setBusy(true);
    try {
      const res = await criarPedidoDelivery(
        sessao,
        {
          cliente,
          telefone,
          endereco,
          taxaEntrega: parseFloat(taxaEntrega) || 0,
          formaPagamento: formaPgto,
          entregador,
          observacoes: obsFinal,
          itens
        },
        permitirEstoqueNegativo
      );
      if (res.ok) {
        setCliente('');
        setTelefone('');
        setEndereco('');
        setReferencia('');
        setEntregador('');
        setTaxaEntrega('0.00');
        setObservacoes('');
        setItens([]);
        onNotify(res.msg, 'success');
        await onAtualizar();
      } else {
        onNotify(res.msg, 'error');
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleMudarStatus(ped: DeliveryPedido, novo: StatusDelivery, entregadorParam?: string) {
    if (novo === 'EM_ROTA' && entregadorParam === undefined) {
      setPedidoDespachar(ped);
      setEntregadorDespacho(ped.entregador || '');
      return;
    }
    setBusy(true);
    try {
      const res = await atualizarStatusDelivery(sessao, ped, novo, entregadorParam);
      onNotify(res.msg, res.ok ? 'success' : 'error');
      setPedidoDespachar(null);
      await onAtualizar();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid-2" style={{ gridTemplateColumns: '1.1fr 1.15fr', alignItems: 'start' }}>
      {/* NOVO PEDIDO DELIVERY */}
      <div className="panel-card">
        <h3 style={{ fontSize: 16, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Bike size={18} color="#c4b5fd" />
          <span>🛵 Novo Pedido Delivery</span>
        </h3>

        <form onSubmit={handleCriarPedido} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* 1. CLIENTE (LARGURA TOTAL COM BOTÃO DE CADASTRO RÁPIDO) */}
          <div>
            <label className="field-label">Cliente *</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                list="listaClientesDelivery"
                className="field-input"
                style={{ flex: 1 }}
                placeholder="Digite ou selecione o nome do cliente..."
                value={cliente}
                onChange={(e) => handleSelecionarCliente(e.target.value)}
                required
              />
              <datalist id="listaClientesDelivery">
                {clientes.map((c) => (
                  <option key={c.id} value={c.nome} />
                ))}
              </datalist>
              <button
                type="button"
                className="btn"
                style={{ whiteSpace: 'nowrap', padding: '0 12px' }}
                onClick={() => setModalClienteAberto(true)}
                title="Cadastrar Novo Cliente"
              >
                <UserPlus size={14} color="#38bdf8" />
                <span>Novo</span>
              </button>
            </div>
          </div>

          {/* 2. TELEFONE & PONTO DE REFERÊNCIA */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.15fr', gap: 10 }}>
            <div>
              <label className="field-label">Telefone / WhatsApp</label>
              <input
                className="field-input"
                placeholder="(00) 00000-0000"
                value={telefone}
                onChange={(e) => setTelefone(formatarTelefoneBr(e.target.value))}
              />
            </div>
            <div>
              <label className="field-label">Ponto de Referência</label>
              <input
                className="field-input"
                placeholder="Ex: Próximo à praça"
                value={referencia}
                onChange={(e) => setReferencia(formatarTextoInicialMaiuscula(e.target.value))}
              />
            </div>
          </div>

          {/* 3. ENDEREÇO DE ENTREGA (LARGURA TOTAL) */}
          <div>
            <label className="field-label">Endereço de Entrega *</label>
            <input
              className="field-input"
              placeholder="Rua, Número, Bairro, Complemento..."
              value={endereco}
              onChange={(e) => setEndereco(formatarTextoInicialMaiuscula(e.target.value))}
              required
            />
          </div>

          {/* 4. TAXA, PAGAMENTO E ENTREGADOR (PROPORÇÃO EQUILIBRADA) */}
          <div style={{ display: 'grid', gridTemplateColumns: '0.75fr 1.25fr 1fr', gap: 10 }}>
            <div>
              <label className="field-label">Taxa (R$)</label>
              <input
                type="number"
                step="0.50"
                min="0"
                className="field-input"
                value={taxaEntrega}
                onChange={(e) => setTaxaEntrega(e.target.value)}
              />
            </div>
            <div>
              <label className="field-label">Pagamento</label>
              <select
                className="field-select"
                value={formaPgto}
                onChange={(e) => setFormaPgto(e.target.value as FormaPagamento)}
              >
                <option value="Dinheiro">💵 Dinheiro</option>
                <option value="PIX">💠 PIX</option>
                <option value="Cartão Débito">💳 Cartão Débito</option>
                <option value="Cartão Crédito">💳 Cartão Crédito</option>
                <option value="Fiado">🧾 Fiado</option>
                <option value="Outro">🏷️ Outro</option>
              </select>
            </div>
            <div>
              <label className="field-label">Entregador</label>
              <input
                className="field-input"
                placeholder="Motoboy"
                value={entregador}
                onChange={(e) => setEntregador(e.target.value)}
              />
            </div>
          </div>

          {/* 5. ADICIONAR PRODUTO AO PEDIDO (2 LINHAS LIMPAS E ALINHADAS) */}
          <div
            style={{
              padding: 12,
              borderRadius: 10,
              background: 'rgba(15, 23, 42, 0.72)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
              <label className="field-label" style={{ marginBottom: 0 }}>
                🛒 Adicionar Produto ao Pedido
              </label>
              <span style={{ fontSize: 10.5, color: '#94a3b8' }}>
                {isDonoOuAdmin ? 'Valor editável antes de adicionar' : '🔒 Valor fixo p/ vendedor'}
              </span>
            </div>

            {/* Linha 1: Seletor de Produto em Largura Total */}
            <select
              className="field-select"
              style={{ width: '100%' }}
              value={produtoSelId}
              onChange={(e) => handleSelectProdutoDelivery(e.target.value)}
            >
              <option value="">Selecione um produto...</option>
              {produtosOrdenados.map((p) => {
                const est = Number(p.estoque_atual) || 0;
                return (
                  <option key={p.id} value={p.id}>
                    {p.nome} ({formatarMoeda(p.preco_venda)}) {est <= 0 ? '[🚫 ESGOTADO]' : `[${est} un]`}
                  </option>
                );
              })}
            </select>

            {/* Linha 2: Stepper Qtd + Valor Unitário + Botão Adicionar */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, alignItems: 'end' }}>
              <div>
                <span style={{ display: 'block', fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 4 }}>
                  Quantidade
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    type="button"
                    className="btn"
                    style={{ padding: '0 10px' }}
                    onClick={() => ajustarQtdInput(-1)}
                  >
                    <Minus size={12} />
                  </button>
                  <input
                    type="number"
                    min="1"
                    className="field-input"
                    style={{ textAlign: 'center', padding: '7px 4px' }}
                    value={qtdSel}
                    onChange={(e) => setQtdSel(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn"
                    style={{ padding: '0 10px' }}
                    onClick={() => ajustarQtdInput(1)}
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </div>

              <div>
                <span style={{ display: 'block', fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 4 }}>
                  Valor Unit. (R$)
                </span>
                <input
                  type="number"
                  step="0.50"
                  min="0"
                  className="field-input"
                  placeholder="0,00"
                  value={unitSel}
                  readOnly={!isDonoOuAdmin}
                  disabled={!isDonoOuAdmin || !produtoSelId}
                  title={
                    isDonoOuAdmin
                      ? 'Valor unitário editável somente no momento de adicionar'
                      : 'Apenas ADMIN e DONO podem alterar o valor unitário'
                  }
                  style={{
                    textAlign: 'right',
                    ...(isDonoOuAdmin
                      ? {}
                      : { opacity: 0.72, cursor: 'not-allowed', background: 'rgba(15, 23, 42, 0.85)' })
                  }}
                  onChange={(e) => {
                    if (!isDonoOuAdmin) return;
                    setUnitSel(e.target.value);
                  }}
                />
              </div>

              <button
                type="button"
                className="btn btn-primary"
                style={{ height: 38, padding: '0 16px', whiteSpace: 'nowrap' }}
                onClick={adicionarItemLista}
                disabled={!produtoSelId}
              >
                <Plus size={14} /> Adicionar
              </button>
            </div>

            {itens.length > 0 && (
              <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                {itens.map((it) => (
                  <div
                    key={it.produto.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '6px 10px',
                      borderRadius: 8,
                      background: 'rgba(30, 41, 59, 0.75)',
                      border: '1px solid rgba(148, 163, 184, 0.12)'
                    }}
                  >
                    <span>
                      <strong>{it.quantidade}x</strong> {it.produto.nome}{' '}
                      <span style={{ color: '#94a3b8', fontSize: 11 }}>
                        ({formatarMoeda(it.produto.preco_venda)} un)
                      </span>
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <strong style={{ color: '#34d399' }}>
                        {formatarMoeda(it.quantidade * it.produto.preco_venda)}
                      </strong>
                      <button
                        type="button"
                        className="btn btn-danger btn-xs"
                        onClick={() => removerItemDelivery(it.produto.id)}
                        title="Remover item"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 6. OBSERVAÇÕES */}
          <div>
            <label className="field-label">Observações</label>
            <input
              className="field-input"
              placeholder="Troco para R$..., portão, interfonar..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
            />
          </div>

          {/* 7. RESUMO E BOTÃO FINALIZAR */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(9, 13, 22, 0.75)',
              padding: '10px 14px',
              borderRadius: 10,
              border: '1px solid var(--border-subtle)'
            }}
          >
            <span style={{ color: 'var(--text-muted)', fontSize: 12.5, fontWeight: 700 }}>
              TOTAL DO PEDIDO:
            </span>
            <strong style={{ fontSize: 21, color: '#34d399' }}>{formatarMoeda(totalPedido)}</strong>
          </div>

          <button type="submit" className="btn btn-success" style={{ padding: '11px 16px', fontSize: 14 }} disabled={busy}>
            🛵 CRIAR PEDIDO DELIVERY
          </button>
        </form>
      </div>

      {/* PIPELINE DE ENTREGA */}
      <div className="panel-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          <h3 style={{ fontSize: 16 }}>
            📋 Fila de Pedidos Delivery ({pedidosExibidos.length})
          </h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', color: '#cbd5e1' }}>
              <input
                type="checkbox"
                checked={autoPrint}
                onChange={(e) => {
                  const v = e.target.checked;
                  setAutoPrint(v);
                  setAutoPrintDeliveryEmpresa(sessao.unidadeAtivaId, v);
                }}
              />
              <span>Auto-imprimir novos</span>
            </label>
            <button
              type="button"
              className={`btn btn-xs ${filtroFila === 'PENDENTES' ? 'btn-primary' : ''}`}
              onClick={() => setFiltroFila('PENDENTES')}
            >
              Pendentes ({pedidosPendentes.length})
            </button>
            <button
              type="button"
              className={`btn btn-xs ${filtroFila === 'TODOS' ? 'btn-primary' : ''}`}
              onClick={() => setFiltroFila('TODOS')}
            >
              Todos ({pedidos.length})
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {pedidosExibidos.map((ped) => {
            const prox = PROXIMO_STATUS[ped.status];
            return (
              <div
                key={ped.id}
                style={{
                  padding: 14,
                  borderRadius: 12,
                  background: 'rgba(15, 23, 42, 0.72)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <strong>
                      {ped.pedido} — {ped.cliente}
                    </strong>
                    <span style={{ fontSize: 11.5, color: 'var(--text-muted)', marginLeft: 8 }}>
                      {formatarDataHoraBr(ped.data_hora)}
                    </span>
                  </div>
                  <span
                    className={`badge ${
                      ped.status === 'ENTREGUE'
                        ? 'badge-ok'
                        : ped.status === 'CANCELADO'
                        ? 'badge-danger'
                        : 'badge-warn'
                    }`}
                  >
                    {ped.status}
                  </span>
                </div>

                <div style={{ fontSize: 12, color: '#cbd5e1', display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <MapPin size={12} color="#38bdf8" /> {ped.endereco}
                  </span>
                  {ped.telefone && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Phone size={12} color="#34d399" /> {ped.telefone}
                    </span>
                  )}
                </div>

                {ped.observacoes && (
                  <div style={{ fontSize: 11.5, color: '#fde68a' }}>
                    Obs: {ped.observacoes}
                  </div>
                )}

                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {ped.itens.map((i) => `${i.quantidade}x ${i.produto_nome}`).join(' • ')}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <strong style={{ color: '#34d399', fontSize: 15 }}>{formatarMoeda(ped.total)}</strong>
                    <span style={{ fontSize: 11.5, color: 'var(--text-muted)', marginLeft: 8 }}>
                      ({ped.forma_pagamento}) {ped.entregador ? `• 🛵 ${ped.entregador}` : ''}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn"
                      style={{ padding: '6px 10px', fontSize: 12 }}
                      onClick={() => imprimirCupomTermicoDelivery(ped, sessao.empresa)}
                      title="Imprimir cupom em impressora térmica (58mm/80mm)"
                    >
                      <Printer size={13} /> Imprimir
                    </button>
                    {prox && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ padding: '6px 10px', fontSize: 12 }}
                        onClick={() => void handleMudarStatus(ped, prox)}
                        disabled={busy}
                      >
                        <CheckCircle2 size={13} /> {LABEL_BOTAO[prox]}
                      </button>
                    )}
                    {ped.status !== 'ENTREGUE' && ped.status !== 'CANCELADO' && (
                      <button
                        type="button"
                        className="btn btn-danger"
                        style={{ padding: '6px 10px', fontSize: 12 }}
                        onClick={() => void handleMudarStatus(ped, 'CANCELADO')}
                        disabled={busy}
                      >
                        <XCircle size={13} /> Cancelar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {pedidosExibidos.length === 0 && (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
              {filtroFila === 'PENDENTES'
                ? 'Nenhum pedido pendente no momento.'
                : 'Nenhum pedido de delivery registrado ainda.'}
            </div>
          )}
        </div>
      </div>

      {/* MINI-MODAL ENTREGADOR AO DESPACHAR */}
      {pedidoDespachar && (
        <div className="modal-overlay">
          <div className="panel-card" style={{ maxWidth: 420, width: '100%', borderColor: 'var(--border-accent)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h4 style={{ fontSize: 16 }}>🛵 Despachar Pedido #{pedidoDespachar.pedido}</h4>
              <button type="button" className="btn btn-xs" onClick={() => setPedidoDespachar(null)}>
                <X size={14} />
              </button>
            </div>
            <label className="field-label">Nome do Entregador / Motoboy</label>
            <input
              className="field-input"
              placeholder="Ex: Marcos"
              value={entregadorDespacho}
              onChange={(e) => setEntregadorDespacho(e.target.value)}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
              <button type="button" className="btn" onClick={() => setPedidoDespachar(null)} disabled={busy}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void handleMudarStatus(pedidoDespachar, 'EM_ROTA', entregadorDespacho)}
                disabled={busy}
              >
                {busy ? 'Despachando...' : 'Confirmar Saída para Entrega'}
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
          setCliente(cli.nome);
          if (cli.telefone) setTelefone(cli.telefone);
          if (cli.endereco) setEndereco(cli.endereco);
          if (cli.observacao) setReferencia(cli.observacao);
          await onAtualizar();
        }}
      />
    </div>
  );
}
