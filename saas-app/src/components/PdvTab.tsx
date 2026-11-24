import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  ClipboardList,
  Eraser,
  Minus,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  UserPlus
} from 'lucide-react';
import type {
  Cliente,
  Comanda,
  Empresa,
  FormaPagamento,
  ItemCarrinho,
  Produto,
  SessaoAtiva
} from '../types/domain';
import {
  abrirComandaComItens,
  registrarPagamentoParcialComanda,
  registrarVendaPdv
} from '../services/dataRepository';
import { formatarMoeda } from '../utils/formatters';
import { beep, beepErro } from '../utils/soundFeedback';
import { ClienteQuickModal } from './ClienteQuickModal';
import { PixPaymentBox } from './PixPaymentBox';

interface PdvTabProps {
  sessao: SessaoAtiva;
  empresa: Empresa;
  produtos: Produto[];
  comandas: Comanda[];
  clientes: Cliente[];
  permitirEstoqueNegativo: boolean;
  onIrAba: (aba: string) => void;
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

export function PdvTab({
  sessao,
  empresa,
  produtos,
  clientes,
  permitirEstoqueNegativo,
  onIrAba,
  onNotify,
  onAtualizar
}: PdvTabProps) {
  const [busca, setBusca] = useState('');
  const [categoriaAtiva, setCategoriaAtiva] = useState('');
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [formaPgto, setFormaPgto] = useState<FormaPagamento>('Dinheiro');
  const [valorRecebidoDinheiro, setValorRecebidoDinheiro] = useState('');
  const [clienteNome, setClienteNome] = useState('');
  const [modalClienteAberto, setModalClienteAberto] = useState(false);
  const [processando, setProcessando] = useState(false);

  // Lançamento rápido com valor customizado (apenas ADMIN e DONO, somente antes de entrar no carrinho)
  const [prodSelPdvId, setProdSelPdvId] = useState('');
  const [qtdSelPdv, setQtdSelPdv] = useState('1');
  const [unitSelPdv, setUnitSelPdv] = useState('');

  const perfil = String(sessao.usuario.perfil || '').toUpperCase();
  const isDonoOuAdmin = perfil === 'DONO' || perfil === 'ADMIN';

  const buscaInputRef = useRef<HTMLInputElement | null>(null);

  const mapaCategorias = useMemo(() => {
    const counts: Record<string, number> = {};
    produtos.forEach((p) => {
      const cat = p.categoria || 'Geral';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'));
  }, [produtos]);

  const produtosOrdenadosFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const filtrados = produtos.filter((p) => {
      const cat = p.categoria || 'Geral';
      if (categoriaAtiva && cat !== categoriaAtiva) return false;
      if (!q) return true;
      return (
        p.nome.toLowerCase().includes(q) ||
        cat.toLowerCase().includes(q) ||
        (p.marca || '').toLowerCase().includes(q) ||
        String(p.id).toLowerCase().includes(q)
      );
    });

    // Ordenação fiel ao legado: estoque (> 0) PRIMEIRO, esgotados DEPOIS; dentro do grupo, ordem alfabética pt-BR
    return filtrados.sort((a, b) => {
      const hasA = (Number(a.estoque_atual) || 0) > 0 ? 1 : 0;
      const hasB = (Number(b.estoque_atual) || 0) > 0 ? 1 : 0;
      if (hasA !== hasB) return hasB - hasA;
      return a.nome.localeCompare(b.nome, 'pt-BR');
    });
  }, [produtos, categoriaAtiva, busca]);

  const totalCarrinho = carrinho.reduce(
    (acc, item) => acc + item.quantidade * item.produto.preco_venda,
    0
  );

  const valorRecebidoNum = parseFloat(valorRecebidoDinheiro) || 0;
  const trocoDinheiro = Math.max(0, valorRecebidoNum - totalCarrinho);

  function obterEstoqueAtualProduto(prod: Produto): number {
    const encontrado = produtos.find((x) => x.id === prod.id);
    return Number(encontrado?.estoque_atual ?? prod.estoque_atual) || 0;
  }

  function adicionarAoCarrinho(prod: Produto) {
    const estoqueDisp = obterEstoqueAtualProduto(prod);

    if (!permitirEstoqueNegativo && estoqueDisp <= 0) {
      onNotify(`❌ O produto "${prod.nome}" está ESGOTADO no estoque!`, 'error');
      beepErro();
      return;
    }

    const existente = carrinho.find((i) => i.produto.id === prod.id);
    if (existente && !permitirEstoqueNegativo && existente.quantidade + 1 > estoqueDisp) {
      onNotify(
        `⚠️ Limite de estoque atingido! (${estoqueDisp} un disponíveis de "${prod.nome}")`,
        'warning'
      );
      beepErro();
      return;
    }

    beep();
    setCarrinho((prev) => {
      const idx = prev.findIndex((i) => i.produto.id === prod.id);
      if (idx >= 0) {
        // Mantém o preço que já foi fixado quando o item entrou no carrinho
        return prev.map((item, k) =>
          k === idx ? { ...item, quantidade: item.quantidade + 1 } : item
        );
      }
      return [...prev, { produto: { ...prod }, quantidade: 1 }];
    });
  }

  function handleSelectProdutoRapidoPdv(id: string) {
    setProdSelPdvId(id);
    const p = produtos.find((x) => x.id === id);
    if (p) {
      setUnitSelPdv(Number(p.preco_venda).toFixed(2));
    } else {
      setUnitSelPdv('');
    }
  }

  function handleLancarProdutoRapidoPdv() {
    const prod = produtos.find((p) => p.id === prodSelPdvId);
    if (!prod) {
      onNotify('Selecione um produto para adicionar ao carrinho.', 'warning');
      return;
    }
    const qtd = Math.max(1, parseInt(qtdSelPdv, 10) || 1);
    const estoqueDisp = obterEstoqueAtualProduto(prod);
    const existente = carrinho.find((i) => i.produto.id === prod.id);
    const qtdTotal = (existente?.quantidade || 0) + qtd;

    if (!permitirEstoqueNegativo && estoqueDisp <= 0) {
      onNotify(`❌ O produto "${prod.nome}" está ESGOTADO no estoque!`, 'error');
      beepErro();
      return;
    }
    if (!permitirEstoqueNegativo && qtdTotal > estoqueDisp) {
      onNotify(
        `⚠️ Limite de estoque atingido! (${estoqueDisp} un disponíveis de "${prod.nome}")`,
        'warning'
      );
      beepErro();
      return;
    }

    const parsedUnit = parseFloat(unitSelPdv);
    const precoLancado =
      isDonoOuAdmin && !isNaN(parsedUnit) && parsedUnit > 0
        ? Number(parsedUnit.toFixed(2))
        : Number(prod.preco_venda);

    beep();
    setCarrinho((prev) => {
      const idx = prev.findIndex((i) => i.produto.id === prod.id);
      if (idx >= 0) {
        // Já está no carrinho: não altera mais o preço unitário, apenas soma a quantidade
        return prev.map((item, k) =>
          k === idx ? { ...item, quantidade: item.quantidade + qtd } : item
        );
      }
      return [
        ...prev,
        {
          produto: { ...prod, preco_venda: precoLancado },
          quantidade: qtd
        }
      ];
    });
    setProdSelPdvId('');
    setQtdSelPdv('1');
    setUnitSelPdv('');
  }

  function alterarQtd(prodId: string, delta: number) {
    const item = carrinho.find((i) => i.produto.id === prodId);
    if (!item) return;

    const novaQtd = item.quantidade + delta;
    if (novaQtd <= 0) {
      setCarrinho((prev) => prev.filter((i) => i.produto.id !== prodId));
      return;
    }

    if (delta > 0 && !permitirEstoqueNegativo) {
      const estoqueDisp = obterEstoqueAtualProduto(item.produto);
      if (novaQtd > estoqueDisp) {
        onNotify(
          `⚠️ Limite de estoque atingido! Apenas ${estoqueDisp} un disponíveis de "${item.produto.nome}".`,
          'warning'
        );
        beepErro();
        return;
      }
    }

    setCarrinho((prev) =>
      prev.map((i) => (i.produto.id === prodId ? { ...i, quantidade: novaQtd } : i))
    );
  }

  function limparCarrinho() {
    setCarrinho([]);
    setValorRecebidoDinheiro('');
  }

  function validarPreEstoqueCarrinho(): boolean {
    if (permitirEstoqueNegativo) return true;
    for (const item of carrinho) {
      const disp = obterEstoqueAtualProduto(item.produto);
      if (item.quantidade > disp) {
        onNotify(
          `❌ Venda bloqueada: "${item.produto.nome}" possui apenas ${disp} un em estoque!`,
          'error'
        );
        beepErro();
        return false;
      }
    }
    return true;
  }

  const handleFinalizarVenda = useCallback(async () => {
    if (carrinho.length === 0) {
      onNotify('Adicione pelo menos 1 item ao carrinho!', 'error');
      return;
    }
    if (!validarPreEstoqueCarrinho()) return;

    if (formaPgto === 'Fiado' && (!clienteNome.trim() || clienteNome.trim() === 'Consumidor Final')) {
      onNotify('Informe o nome real do cliente para venda no Fiado.', 'warning');
      return;
    }

    setProcessando(true);
    try {
      const res = await registrarVendaPdv(
        sessao,
        carrinho,
        formaPgto,
        clienteNome.trim() || 'Consumidor Final (Balcão)',
        permitirEstoqueNegativo
      );
      if (res.ok) {
        limparCarrinho();
        setClienteNome('');
        onNotify(res.msg, 'success');
        await onAtualizar();
      } else {
        onNotify(res.msg, 'error');
      }
    } finally {
      setProcessando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carrinho, formaPgto, clienteNome, permitirEstoqueNegativo, sessao, onAtualizar, onNotify]);

  useEffect(() => {
    function onF8() {
      void handleFinalizarVenda();
    }
    function onEscape() {
      setBusca('');
      buscaInputRef.current?.focus();
    }
    window.addEventListener('gn360:finalizar-venda-pdv', onF8);
    window.addEventListener('gn360:escape', onEscape);
    return () => {
      window.removeEventListener('gn360:finalizar-venda-pdv', onF8);
      window.removeEventListener('gn360:escape', onEscape);
    };
  }, [handleFinalizarVenda]);

  async function handleAbrirCarrinhoComoComanda() {
    if (carrinho.length === 0) {
      onNotify('Adicione itens ao carrinho para abrir comanda!', 'error');
      return;
    }
    if (!validarPreEstoqueCarrinho()) return;

    setProcessando(true);
    try {
      const nomeAlvo =
        clienteNome.trim() && clienteNome.trim() !== 'Consumidor Final'
          ? clienteNome.trim()
          : 'Balcão';
      const res = await abrirComandaComItens(
        sessao,
        nomeAlvo,
        carrinho,
        permitirEstoqueNegativo
      );
      if (res.ok && res.comanda) {
        if (formaPgto === 'Dinheiro' && valorRecebidoNum > 0 && valorRecebidoNum < totalCarrinho - 0.009) {
          const cmdParaAbater: Comanda = {
            ...res.comanda,
            total: totalCarrinho,
            pago: 0,
            saldo: totalCarrinho
          };
          const resParc = await registrarPagamentoParcialComanda(
            sessao,
            cmdParaAbater,
            valorRecebidoNum,
            formaPgto
          );
          limparCarrinho();
          setClienteNome('');
          onNotify(resParc.ok ? resParc.msg : res.msg, 'success');
          await onAtualizar();
          onIrAba('comandas');
          return;
        }
        limparCarrinho();
        setClienteNome('');
        onNotify(res.msg, 'success');
        await onAtualizar();
        onIrAba('comandas');
      } else {
        onNotify(res.msg, 'error');
      }
    } finally {
      setProcessando(false);
    }
  }

  return (
    <div className="grid-2" style={{ gridTemplateColumns: '1.35fr 1fr' }}>
      {/* CATÁLOGO DE PRODUTOS */}
      <div className="panel-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 10, flexWrap: 'wrap' }}>
          <h3 style={{ fontSize: 16 }}>⚡ Catálogo &amp; PDV Balcão</h3>
          <div style={{ position: 'relative', flex: 1, minWidth: 220, maxWidth: 340 }}>
            <Search
              size={15}
              color="#94a3b8"
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}
            />
            <input
              ref={buscaInputRef}
              id="buscaProdutoPdv"
              className="field-input"
              placeholder="Digite o produto ou código... (F2)"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              style={{ paddingLeft: 32 }}
            />
          </div>
        </div>

        {/* CHIPS DE CATEGORIAS COM CONTADOR */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          <button
            type="button"
            className={`btn ${categoriaAtiva === '' ? 'btn-primary' : ''}`}
            style={{ padding: '5px 11px', fontSize: 12 }}
            onClick={() => setCategoriaAtiva('')}
          >
            Todos ({produtos.length})
          </button>
          {mapaCategorias.map(([cat, count]) => (
            <button
              key={cat}
              type="button"
              className={`btn ${categoriaAtiva === cat ? 'btn-primary' : ''}`}
              style={{ padding: '5px 11px', fontSize: 12 }}
              onClick={() => setCategoriaAtiva(cat)}
            >
              {cat} ({count})
            </button>
          ))}
        </div>

        {produtosOrdenadosFiltrados.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 12px' }}>
            Nenhum produto encontrado para o filtro atual.
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))',
              gap: 10
            }}
          >
            {produtosOrdenadosFiltrados.map((p) => {
              const estNum = Number(p.estoque_atual) || 0;
              const isEsgotado = estNum <= 0;
              const isCritico = !isEsgotado && estNum <= (Number(p.estoque_minimo) || 0);
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`prod-card ${isEsgotado && !permitirEstoqueNegativo ? 'esgotado' : ''}`}
                  onClick={() => adicionarAoCarrinho(p)}
                  title={
                    isEsgotado && !permitirEstoqueNegativo
                      ? `${p.nome} — Produto esgotado`
                      : `Adicionar ${p.nome} ao carrinho`
                  }
                >
                  <div>
                    <div style={{ fontSize: 11, color: '#c4b5fd', fontWeight: 700 }}>
                      {p.categoria || 'Geral'}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 13.5, marginTop: 2, color: '#ffffff' }}>
                      {p.nome}
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <strong style={{ color: '#34d399', fontSize: 15 }}>
                      {formatarMoeda(p.preco_venda)}
                    </strong>
                    <span className={`prod-stock ${isEsgotado ? 'esgotado' : isCritico ? 'critico' : ''}`}>
                      {isEsgotado ? '🚫 ESGOTADO' : `${estNum} un`}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* CARRINHO DE VENDA */}
      <div className="panel-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShoppingCart size={17} color="#c4b5fd" />
            <span>Carrinho de Venda</span>
          </h3>
          {carrinho.length > 0 && (
            <button
              type="button"
              className="btn btn-danger btn-xs"
              onClick={limparCarrinho}
            >
              <Eraser size={12} /> Limpar Carrinho
            </button>
          )}
        </div>

        {/* BARRA DE ADIÇÃO AO CARRINHO: VALOR EDITÁVEL APENAS POR ADMIN/DONO E SOMENTE ANTES DE ENTRAR NO CARRINHO */}
        <div
          style={{
            padding: 10,
            borderRadius: 10,
            background: 'rgba(15, 23, 42, 0.72)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
            <label className="field-label" style={{ marginBottom: 0 }}>
              ➕ Lançar Produto no Carrinho
            </label>
            <span style={{ fontSize: 10.5, color: '#94a3b8' }}>
              {isDonoOuAdmin
                ? 'Valor editável antes de adicionar'
                : '🔒 Valor fixo p/ vendedor'}
            </span>
          </div>

          <select
            className="field-select"
            style={{ width: '100%' }}
            value={prodSelPdvId}
            onChange={(e) => handleSelectProdutoRapidoPdv(e.target.value)}
          >
            <option value="">Selecione um produto...</option>
            {produtosOrdenadosFiltrados.map((p) => {
              const est = Number(p.estoque_atual) || 0;
              return (
                <option key={p.id} value={p.id}>
                  {p.nome} ({formatarMoeda(p.preco_venda)}) {est <= 0 ? '[🚫 ESGOTADO]' : `[${est} un]`}
                </option>
              );
            })}
          </select>

          <div style={{ display: 'grid', gridTemplateColumns: '0.85fr 1fr auto', gap: 8, alignItems: 'end' }}>
            <div>
              <span style={{ display: 'block', fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 3 }}>
                Quantidade
              </span>
              <input
                type="number"
                min="1"
                className="field-input"
                style={{ textAlign: 'center' }}
                title="Quantidade"
                value={qtdSelPdv}
                onChange={(e) => setQtdSelPdv(e.target.value)}
              />
            </div>
            <div>
              <span style={{ display: 'block', fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 3 }}>
                Valor Unit. (R$)
              </span>
              <input
                type="number"
                step="0.50"
                min="0"
                className="field-input"
                placeholder="0,00"
                value={unitSelPdv}
                readOnly={!isDonoOuAdmin}
                disabled={!isDonoOuAdmin || !prodSelPdvId}
                title={
                  isDonoOuAdmin
                    ? 'Valor unitário editável somente no momento de adicionar ao carrinho'
                    : 'Apenas ADMIN e DONO podem alterar o valor unitário do produto'
                }
                style={{
                  textAlign: 'right',
                  ...(isDonoOuAdmin
                    ? {}
                    : { opacity: 0.72, cursor: 'not-allowed', background: 'rgba(15, 23, 42, 0.85)' })
                }}
                onChange={(e) => {
                  if (!isDonoOuAdmin) return;
                  setUnitSelPdv(e.target.value);
                }}
              />
            </div>
            <button
              type="button"
              className="btn btn-primary"
              style={{ height: 38, padding: '0 14px', whiteSpace: 'nowrap' }}
              onClick={handleLancarProdutoRapidoPdv}
              disabled={!prodSelPdvId}
            >
              <Plus size={14} /> Adicionar
            </button>
          </div>
        </div>

        {carrinho.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '24px 8px', textAlign: 'center' }}>
            Carrinho vazio.
            <br />
            Clique nos produtos ao lado para lançar na venda.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {carrinho.map((item) => {
              const estDisp = obterEstoqueAtualProduto(item.produto);
              const semEstoque = !permitirEstoqueNegativo && item.quantidade > estDisp;
              return (
                <div
                  key={item.produto.id}
                  className={semEstoque ? 'cart-item sem-estoque' : ''}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 10px',
                    background: 'rgba(15, 23, 42, 0.7)',
                    borderRadius: 10
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>
                      {item.produto.nome}
                      {semEstoque && (
                        <div style={{ color: '#ef4444', fontSize: 11, fontWeight: 700 }}>
                          ⚠️ Estoque insuficiente ({estDisp} un)
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 11.5, color: '#94a3b8' }}>
                      {formatarMoeda(item.produto.preco_venda)} x {item.quantidade} ={' '}
                      <strong style={{ color: '#34d399' }}>
                        {formatarMoeda(item.produto.preco_venda * item.quantidade)}
                      </strong>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button
                      type="button"
                      className="btn btn-xs"
                      onClick={() => alterarQtd(item.produto.id, -1)}
                    >
                      <Minus size={12} />
                    </button>
                    <span style={{ minWidth: 22, textAlign: 'center', fontWeight: 700, fontSize: 13 }}>
                      {item.quantidade}
                    </span>
                    <button
                      type="button"
                      className="btn btn-xs"
                      onClick={() => alterarQtd(item.produto.id, 1)}
                    >
                      <Plus size={12} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-xs"
                      onClick={() => setCarrinho((prev) => prev.filter((x) => x.produto.id !== item.produto.id))}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
          <div>
            <label className="field-label" htmlFor="pdvClienteInput">
              👤 Cliente
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                id="pdvClienteInput"
                list="listaClientesPdv"
                className="field-input"
                placeholder="Consumidor Final (clique para digitar)"
                value={clienteNome}
                onChange={(e) => setClienteNome(e.target.value)}
              />
              <datalist id="listaClientesPdv">
                {clientes.map((c) => (
                  <option key={c.id} value={c.nome} />
                ))}
              </datalist>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setModalClienteAberto(true)}
                title="Cadastrar Novo Cliente"
                style={{ whiteSpace: 'nowrap' }}
              >
                <UserPlus size={14} /> Novo
              </button>
            </div>
          </div>

          <div>
            <label className="field-label">💳 Forma de Pagamento</label>
            <div className="payment-grid">
              {BOTOES_PGTO.map((b) => (
                <button
                  key={b.forma}
                  type="button"
                  className={`pay-btn ${formaPgto === b.forma ? 'active' : ''}`}
                  onClick={() => setFormaPgto(b.forma)}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          {formaPgto === 'Dinheiro' && (
            <div
              style={{
                padding: 10,
                borderRadius: 10,
                background: 'rgba(15, 23, 42, 0.72)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: 6
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>💵 Recebido:</span>
                <input
                  id="pdvValorRecebido"
                  type="number"
                  step="0.50"
                  min="0"
                  className="field-input"
                  style={{ flex: 1, padding: '7px 10px' }}
                  placeholder="R$ 0,00"
                  value={valorRecebidoDinheiro}
                  onChange={(e) => setValorRecebidoDinheiro(e.target.value)}
                />
                {valorRecebidoNum > 0 && valorRecebidoNum < totalCarrinho - 0.009 ? (
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#38bdf8', whiteSpace: 'nowrap' }}>
                    Resta: {formatarMoeda(totalCarrinho - valorRecebidoNum)}
                  </span>
                ) : (
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#34d399', whiteSpace: 'nowrap' }}>
                    Troco: {formatarMoeda(trocoDinheiro)}
                  </span>
                )}
              </div>
              {valorRecebidoNum > 0 && valorRecebidoNum < totalCarrinho - 0.009 && (
                <div style={{ fontSize: 11.5, color: '#38bdf8' }}>
                  💸 Ao clicar em <strong>ABRIR COMANDA</strong>, o valor recebido ({formatarMoeda(valorRecebidoNum)}) já será abatido como pagamento parcial e a comanda ficará aberta com saldo de <strong>{formatarMoeda(totalCarrinho - valorRecebidoNum)}</strong>.
                </div>
              )}
            </div>
          )}

          {formaPgto === 'PIX' && totalCarrinho > 0 && (
            <PixPaymentBox
              chavePix={empresa.chave_pix}
              donoNome={empresa.dono_nome}
              nomeRecebedor={empresa.nome}
              cidade={empresa.cidade}
              valor={totalCarrinho}
              txid="PDVBALCAO"
              mostrarQrPorPadrao
              onNotify={onNotify}
            />
          )}

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
            <span style={{ color: '#94a3b8', fontWeight: 700, fontSize: 12 }}>TOTAL A PAGAR:</span>
            <strong style={{ fontSize: 22, color: '#34d399' }}>
              {formatarMoeda(totalCarrinho)}
            </strong>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 8 }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={processando || carrinho.length === 0}
              onClick={handleAbrirCarrinhoComoComanda}
              title="Deixa a conta em aberto no balcão"
            >
              <ClipboardList size={15} />
              <span>ABRIR COMANDA</span>
            </button>

            <button
              type="button"
              className="btn btn-success"
              disabled={processando || carrinho.length === 0}
              onClick={() => void handleFinalizarVenda()}
            >
              <CheckCircle2 size={16} />
              <span>{processando ? 'Gravando...' : 'FECHAR VENDA (F8)'}</span>
            </button>
          </div>
        </div>
      </div>

      <ClienteQuickModal
        sessao={sessao}
        aberto={modalClienteAberto}
        onFechar={() => setModalClienteAberto(false)}
        onNotify={onNotify}
        onCriado={async (cli) => {
          setClienteNome(cli.nome);
          await onAtualizar();
        }}
      />
    </div>
  );
}
