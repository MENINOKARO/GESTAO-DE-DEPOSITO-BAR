import { Fragment, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  AlertTriangle,
  Camera,
  FileText,
  FolderOpen,
  Minus,
  PackagePlus,
  Paperclip,
  Pencil,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  ShoppingBag,
  Trash2,
  X
} from 'lucide-react';
import type { Compra, Produto, SessaoAtiva } from '../types/domain';
import {
  ajustarQuantidadeEstoque,
  analisarNotaFiscalViaAppsScript,
  extrairResumoCompra,
  listarComprasSemNf,
  recalcularValoresEstoque,
  registrarCompraEstoque,
  salvarProduto,
  uploadNotaFiscalCompra
} from '../services/dataRepository';
import { formatarDataHoraBr, formatarMoeda } from '../utils/formatters';

interface EstoqueTabProps {
  sessao: SessaoAtiva;
  produtos: Produto[];
  compras?: Compra[];
  podeEditar: boolean;
  abrirCompraAoEntrar?: boolean;
  onConsumirAbrirCompra?: () => void;
  onNotify: (texto: string, tipo?: 'success' | 'error' | 'warning' | 'info') => void;
  onAtualizar: () => Promise<void>;
}

const MARGENS_RAPIDAS = [30, 40, 50, 60, 80, 100];

export function EstoqueTab({
  sessao,
  produtos,
  compras = [],
  podeEditar,
  abrirCompraAoEntrar,
  onConsumirAbrirCompra,
  onNotify,
  onAtualizar
}: EstoqueTabProps) {
  const [busca, setBusca] = useState('');
  const [modalAberto, setModalAberto] = useState(false);
  const [modoNovo, setModoNovo] = useState(false);
  const [editId, setEditId] = useState<string>('');
  const [nome, setNome] = useState('');
  const [categoria, setCategoria] = useState('Geral');
  const [marca, setMarca] = useState('');
  const [volume, setVolume] = useState('');
  const [precoVenda, setPrecoVenda] = useState('');
  const [custoMedio, setCustoMedio] = useState('');
  const [margemPct, setMargemPct] = useState('');
  const [estoqueAtual, setEstoqueAtual] = useState('0');
  const [estoqueMinimo, setEstoqueMinimo] = useState('5');
  const [deltaAjusteModal, setDeltaAjusteModal] = useState('0');

  const [salvando, setSalvando] = useState(false);
  const [recalculando, setRecalculando] = useState(false);
  const isVendedor = sessao.usuario.perfil === 'VENDEDOR';

  // Modal de Compras (Entrada de Mercadoria)
  const [modalCompraAberto, setModalCompraAberto] = useState(false);
  const [compraFornecedor, setCompraFornecedor] = useState('');
  const [compraFormaPgto, setCompraFormaPgto] = useState('Dinheiro');
  const [compraVencimento, setCompraVencimento] = useState(() => new Date().toISOString().slice(0, 10));
  const [compraObs, setCompraObs] = useState('');
  const [compraProdId, setCompraProdId] = useState('');
  const [compraQtd, setCompraQtd] = useState('1');
  const [compraCustoUnit, setCompraCustoUnit] = useState('');
  const [compraItens, setCompraItens] = useState<Array<{ produto: Produto; quantidade: number; custoUnitario: number }>>([]);
  const [salvandoCompra, setSalvandoCompra] = useState(false);

  // Anexo NF + OCR + Scanner QR/Código de Barras + Histórico
  const [nfArquivo, setNfArquivo] = useState<{ base64: string; mimeType: string; fileName: string; previewUrl?: string } | null>(null);
  const [analisandoNf, setAnalisandoNf] = useState(false);
  const [confirmarSemNf, setConfirmarSemNf] = useState(false);
  const [scannerAberto, setScannerAberto] = useState(false);
  const [cameraModo, setCameraModo] = useState<'FOTO' | 'SCANNER'>('SCANNER');
  const [scannerMsg, setScannerMsg] = useState('Aponte a câmera para o QR Code da NFC-e ou Código de Barras...');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fallbackFotoRef = useRef<HTMLInputElement | null>(null);

  const [modalHistoricoCompras, setModalHistoricoCompras] = useState(false);
  const [filtroHistNf, setFiltroHistNf] = useState<'SEM_NF' | 'TODAS'>('SEM_NF');
  const [compraExpandidaId, setCompraExpandidaId] = useState<string>('');
  const [anexandoParaId, setAnexandoParaId] = useState<string>('');
  const [enviandoNfTardia, setEnviandoNfTardia] = useState(false);
  const inputNfTardiaRef = useRef<HTMLInputElement | null>(null);

  const comprasSemNf = useMemo(() => listarComprasSemNf(compras), [compras]);
  const historicoComprasAgrupado = useMemo(() => {
    const mapa = new Map<
      string,
      {
        idCompra: string;
        data_hora: string;
        fornecedor: string;
        forma: string;
        nfUrl: string;
        temNf: boolean;
        operador: string;
        total: number;
        itensCount: number;
        itens: Compra[];
      }
    >();
    for (const c of compras) {
      const { idCompra, forma, nfUrl, temNf } = extrairResumoCompra(c);
      const grupoKey = `${idCompra}|${String(c.data_hora || '').slice(0, 10)}|${String(c.fornecedor || '').trim().toLowerCase()}`;
      const ex = mapa.get(grupoKey);
      if (!ex) {
        mapa.set(grupoKey, {
          idCompra,
          data_hora: c.data_hora,
          fornecedor: c.fornecedor || 'Fornecedor',
          forma,
          nfUrl,
          temNf,
          operador: c.operador || '-',
          total: Number(c.valor_total) || 0,
          itensCount: 1,
          itens: [c]
        });
      } else {
        ex.total = Number((ex.total + (Number(c.valor_total) || 0)).toFixed(2));
        ex.itensCount += 1;
        ex.itens.push(c);
        if (temNf) {
          ex.temNf = true;
          ex.nfUrl = nfUrl;
        }
      }
    }
    return Array.from(mapa.values());
  }, [compras]);

  const listaHistoricoExibida = useMemo(
    () =>
      filtroHistNf === 'SEM_NF'
        ? historicoComprasAgrupado.filter((c) => !c.temNf)
        : historicoComprasAgrupado,
    [historicoComprasAgrupado, filtroHistNf]
  );

  useEffect(() => {
    if (abrirCompraAoEntrar && podeEditar) {
      abrirModalCompra();
      onConsumirAbrirCompra?.();
    }
  }, [abrirCompraAoEntrar, podeEditar]);

  const categoriasExistentes = useMemo(() => {
    const set = new Set<string>();
    produtos.forEach((p) => {
      if (p.categoria) set.add(p.categoria);
    });
    return Array.from(set).sort();
  }, [produtos]);

  const resumoEstoque = useMemo(() => {
    let custoTotal = 0;
    let vendaTotal = 0;
    for (const p of produtos) {
      const q = Number(p.estoque_atual) || 0;
      custoTotal += q * (Number(p.custo_medio) || 0);
      vendaTotal += q * (Number(p.preco_venda) || 0);
    }
    return {
      totalProdutos: produtos.length,
      custoTotal,
      vendaTotal,
      lucroPotencial: vendaTotal - custoTotal
    };
  }, [produtos]);

  const filtradosOrdenados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const filtrados = produtos.filter((p) => {
      if (!q) return true;
      return (
        p.nome.toLowerCase().includes(q) ||
        p.categoria.toLowerCase().includes(q) ||
        String(p.id).toLowerCase().includes(q)
      );
    });

    // Estoque > 0 primeiro, depois esgotados; ordem alfabética
    return filtrados.sort((a, b) => {
      const hasA = (Number(a.estoque_atual) || 0) > 0 ? 1 : 0;
      const hasB = (Number(b.estoque_atual) || 0) > 0 ? 1 : 0;
      if (hasA !== hasB) return hasB - hasA;
      return a.nome.localeCompare(b.nome, 'pt-BR');
    });
  }, [produtos, busca]);

  const custoNum = parseFloat(custoMedio) || 0;
  const vendaNum = parseFloat(precoVenda) || 0;
  const lucroUnitPreview = vendaNum - custoNum;
  const margemPreviewNum = custoNum > 0 ? ((vendaNum - custoNum) / custoNum) * 100 : parseFloat(margemPct) || 0;

  function calcularMargemDeValores(custo: number, venda: number): string {
    if (!(custo > 0)) return '0.0';
    return (((venda - custo) / custo) * 100).toFixed(1);
  }

  function handleCustoChange(val: string) {
    setCustoMedio(val);
    const c = parseFloat(val) || 0;
    const m = parseFloat(margemPct);
    const v = parseFloat(precoVenda) || 0;
    if (c > 0 && !Number.isNaN(m) && m > 0) {
      setPrecoVenda((c * (1 + m / 100)).toFixed(2));
    } else if (c > 0 && v > 0) {
      setMargemPct(calcularMargemDeValores(c, v));
    }
  }

  function handleVendaChange(val: string) {
    setPrecoVenda(val);
    const c = parseFloat(custoMedio) || 0;
    const v = parseFloat(val) || 0;
    if (c > 0) {
      setMargemPct(calcularMargemDeValores(c, v));
    }
  }

  function handleMargemChange(val: string) {
    setMargemPct(val);
    const c = parseFloat(custoMedio) || 0;
    const m = parseFloat(val);
    if (c > 0 && !Number.isNaN(m)) {
      setPrecoVenda((c * (1 + m / 100)).toFixed(2));
    }
  }

  function aplicarMargemRapida(pct: number) {
    if (!(custoNum > 0)) {
      onNotify('Informe o Custo Médio antes de aplicar uma margem rápida.', 'warning');
      return;
    }
    setMargemPct(String(pct));
    setPrecoVenda((custoNum * (1 + pct / 100)).toFixed(2));
  }

  function carregarProdutoNoModal(p: Produto) {
    setEditId(p.id);
    setNome(p.nome);
    setCategoria(p.categoria || 'Geral');
    setMarca(p.marca || '');
    setVolume(p.volume || '');
    setPrecoVenda(Number(p.preco_venda).toFixed(2));
    setCustoMedio(Number(p.custo_medio).toFixed(2));
    setMargemPct(calcularMargemDeValores(p.custo_medio, p.preco_venda));
    setEstoqueAtual(String(p.estoque_atual));
    setEstoqueMinimo(String(p.estoque_minimo));
    setDeltaAjusteModal('0');
  }

  function abrirModalNovoProduto() {
    if (!podeEditar) {
      onNotify('Apenas Gerentes, Donos e Administradores podem cadastrar novos produtos.', 'error');
      return;
    }
    setModoNovo(true);
    setEditId('');
    setNome('');
    setCategoria('Geral');
    setMarca('');
    setVolume('');
    setPrecoVenda('');
    setCustoMedio('');
    setMargemPct('');
    setEstoqueAtual('0');
    setEstoqueMinimo('5');
    setDeltaAjusteModal('0');
    setModalAberto(true);
  }

  function abrirModalGestaoProduto(p: Produto) {
    setModoNovo(false);
    carregarProdutoNoModal(p);
    setModalAberto(true);
  }

  async function handleSalvar(e: FormEvent) {
    e.preventDefault();
    if (!podeEditar || !nome.trim()) return;
    setSalvando(true);
    try {
      const res = await salvarProduto(sessao, {
        id: modoNovo ? undefined : editId,
        nome,
        categoria,
        marca,
        volume,
        preco_venda: parseFloat(precoVenda) || 0,
        custo_medio: parseFloat(custoMedio) || 0,
        estoque_atual: parseFloat(estoqueAtual) || 0,
        estoque_minimo: parseFloat(estoqueMinimo) || 0
      });
      if (res.ok) {
        setModalAberto(false);
        onNotify(res.msg, 'success');
        await onAtualizar();
      } else {
        onNotify(res.msg, 'error');
      }
    } finally {
      setSalvando(false);
    }
  }

  async function handleAplicarAjusteSaldoModal() {
    if (!podeEditar || modoNovo || !editId) return;
    const delta = parseFloat(deltaAjusteModal) || 0;
    if (delta === 0) {
      onNotify('Informe uma quantidade diferente de zero para ajustar o saldo.', 'warning');
      return;
    }
    const atualNum = parseFloat(estoqueAtual) || 0;
    const novaQtd = Math.max(0, atualNum + delta);
    setSalvando(true);
    try {
      const res = await ajustarQuantidadeEstoque(sessao, editId, novaQtd);
      if (res.ok) {
        setEstoqueAtual(String(novaQtd));
        setDeltaAjusteModal('0');
        onNotify(`Saldo ajustado: ${atualNum} → ${novaQtd} un`, 'success');
        await onAtualizar();
      } else {
        onNotify(res.msg, 'error');
      }
    } finally {
      setSalvando(false);
    }
  }

  async function handleRecalcularValores() {
    setRecalculando(true);
    try {
      const res = await recalcularValoresEstoque(sessao, produtos);
      onNotify(res.msg, res.ok ? 'success' : 'error');
      if (res.ok) await onAtualizar();
    } finally {
      setRecalculando(false);
    }
  }

  function fecharScannerCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setScannerAberto(false);
  }

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  function lerArquivoComoBase64(file: File): Promise<{ base64: string; mimeType: string; fileName: string; previewUrl?: string }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        const commaIdx = result.indexOf(',');
        const base64 = commaIdx >= 0 ? result.slice(commaIdx + 1) : result;
        resolve({
          base64,
          mimeType: file.type || 'image/jpeg',
          fileName: file.name || 'nota_fiscal.jpg',
          previewUrl: file.type.startsWith('image/') ? result : undefined
        });
      };
      reader.onerror = () => reject(new Error('Falha ao ler o arquivo selecionado.'));
      reader.readAsDataURL(file);
    });
  }

  function mapearFormaPgtoLida(formaRaw?: string): string {
    const f = String(formaRaw || '').toUpperCase();
    if (f.includes('PIX')) return 'PIX';
    if (f.includes('DEBITO') || f.includes('DÉBITO')) return 'Cartão Débito';
    if (f.includes('CREDITO') || f.includes('CRÉDITO') || f.includes('CARTAO') || f.includes('CARTÃO')) return 'Cartão Crédito';
    if (f.includes('BOLETO')) return 'Boleto';
    if (f.includes('CONSIGNADO')) return 'Consignado';
    if (f.includes('PRAZO')) return 'A Prazo';
    return 'Dinheiro';
  }

  function encontrarProdutoCatalogo(nomeSugerido: string, nomeLido: string): Produto | undefined {
    const norm = (s: string) =>
      String(s || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .trim();
    const alvo1 = norm(nomeSugerido);
    const alvo2 = norm(nomeLido);
    return (
      produtos.find((p) => norm(p.nome) === alvo1) ||
      produtos.find((p) => norm(p.nome) === alvo2) ||
      produtos.find((p) => alvo1 && norm(p.nome).includes(alvo1)) ||
      produtos.find((p) => alvo2 && norm(p.nome).includes(alvo2))
    );
  }

  async function processarDadosArquivoNf(dadosArq: { base64: string; mimeType: string; fileName: string; previewUrl?: string }) {
    setNfArquivo(dadosArq);
    setConfirmarSemNf(false);
    setAnalisandoNf(true);
    onNotify('🤖 Lendo Nota Fiscal (OCR + QR Code)... aguarde alguns segundos.', 'info');
    try {
      const res = await analisarNotaFiscalViaAppsScript(sessao, dadosArq.base64, dadosArq.mimeType, dadosArq.fileName);
      if (res.ok) {
        if (res.fornecedor) {
          setCompraFornecedor(res.fornecedor);
        }
        if (res.forma_pagamento) {
          setCompraFormaPgto(mapearFormaPgtoLida(res.forma_pagamento));
        }
        const obsParts = [
          res.numero_nf ? `NF ${res.numero_nf}` : '',
          res.chave_acesso ? `Chave: ${res.chave_acesso}` : '',
          res.observacao || ''
        ].filter(Boolean);
        if (obsParts.length > 0) setCompraObs(obsParts.join(' | '));

        if (Array.isArray(res.itens) && res.itens.length > 0) {
          const novosItens: Array<{ produto: Produto; quantidade: number; custoUnitario: number }> = [];
          let naoPareados = 0;
          for (const it of res.itens) {
            const match = encontrarProdutoCatalogo(it.produto_sugerido, it.produto_lido);
            if (match) {
              const ex = novosItens.find((x) => x.produto.id === match.id);
              if (ex) {
                ex.quantidade = Number((ex.quantidade + (Number(it.qtd) || 1)).toFixed(2));
              } else {
                novosItens.push({
                  produto: match,
                  quantidade: Number(it.qtd) || 1,
                  custoUnitario: Number(it.unit) || 0
                });
              }
            } else {
              naoPareados++;
            }
          }
          if (novosItens.length > 0) {
            setCompraItens(novosItens);
          }
          onNotify(
            `✅ Nota Fiscal lida! ${novosItens.length} item(ns) preenchido(s) automaticamente.` +
              (naoPareados > 0 ? ` (${naoPareados} item(ns) não localizado(s) no catálogo — confira abaixo.)` : ''),
            naoPareados > 0 ? 'warning' : 'success'
          );
        } else {
          onNotify('✅ Nota Fiscal anexada e cabeçalho preenchido! Adicione os itens abaixo.', 'success');
        }
      } else {
        onNotify(`📎 Nota anexada, mas leitura automática indisponível: ${res.msg || 'preencha os itens manualmente.'}`, 'warning');
      }
    } finally {
      setAnalisandoNf(false);
    }
  }

  async function handleSelecionarArquivoNf(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const dadosArq = await lerArquivoComoBase64(file);
      await processarDadosArquivoNf(dadosArq);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Erro ao ler arquivo da NF.', 'error');
    }
  }

  async function abrirCameraParaFoto() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      fallbackFotoRef.current?.click();
      return;
    }
    fecharScannerCamera();
    setCameraModo('FOTO');
    setScannerAberto(true);
    setScannerMsg('Iniciando câmera para foto...');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } }
      });
      streamRef.current = stream;
      window.setTimeout(() => {
        if (videoRef.current && streamRef.current) {
          videoRef.current.srcObject = streamRef.current;
          void videoRef.current.play();
        }
      }, 60);
      setScannerMsg('Enquadre a Nota Fiscal e clique em "📸 Capturar Foto"');
    } catch {
      fecharScannerCamera();
      fallbackFotoRef.current?.click();
    }
  }

  async function capturarFotoDaCamera() {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      onNotify('Aguarde a imagem da câmera carregar.', 'warning');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    const base64 = dataUrl.split(',')[1] || '';
    fecharScannerCamera();
    await processarDadosArquivoNf({
      base64,
      mimeType: 'image/jpeg',
      fileName: `NF_FOTO_${Date.now()}.jpg`,
      previewUrl: dataUrl
    });
  }

  async function abrirScannerQrOuBarras() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      onNotify('Câmera não disponível neste navegador. Use "📁 Buscar Arquivo".', 'warning');
      return;
    }
    fecharScannerCamera();
    setCameraModo('SCANNER');
    setScannerAberto(true);
    setScannerMsg('Iniciando câmera...');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const DetectorCtor = (window as unknown as {
        BarcodeDetector?: new (opts?: { formats?: string[] }) => {
          detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>>;
        };
      }).BarcodeDetector;
      if (!DetectorCtor) {
        setScannerMsg('Leitor ao vivo indisponível neste navegador — use "📷 Tirar Foto" para leitura por IA.');
        return;
      }
      setScannerMsg('Aponte para o QR Code da NFC-e ou Código de Barras...');
      const detector = new DetectorCtor({
        formats: ['qr_code', 'ean_13', 'ean_8', 'code_128', 'itf']
      });
      const loop = async () => {
        if (!streamRef.current || !videoRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes.length > 0 && codes[0].rawValue) {
            const raw = String(codes[0].rawValue).trim();
            fecharScannerCamera();
            const chaveMatch = raw.match(/\b(\d{44})\b/);
            if (chaveMatch) {
              setCompraObs((prev) => (prev ? `${prev} | Chave: ${chaveMatch[1]}` : `Chave NF-e: ${chaveMatch[1]}`));
              onNotify(`✅ Chave de Acesso (44 dígitos) lida: ${chaveMatch[1]}`, 'success');
            } else {
              const prodMatch = produtos.find(
                (p) => String(p.id).toUpperCase() === raw.toUpperCase() || p.nome.toUpperCase().includes(raw.toUpperCase())
              );
              if (prodMatch) {
                handleSelecionarProdCompra(prodMatch.id);
                onNotify(`✅ Produto localizado pelo código: ${prodMatch.nome}`, 'success');
              } else {
                setCompraObs((prev) => (prev ? `${prev} | Cód: ${raw}` : `Cód/QR: ${raw}`));
                onNotify(`📲 Código lido e preenchido nas observações: ${raw.slice(0, 60)}`, 'info');
              }
            }
            return;
          }
        } catch {
          // ignore frame decode error
        }
        if (streamRef.current) {
          window.setTimeout(() => void loop(), 300);
        }
      };
      void loop();
    } catch {
      setScannerMsg('Não foi possível acessar a câmera. Use "📷 Tirar Foto" ou "📁 Buscar Arquivo".');
    }
  }

  async function handleAnexarNfTardiaChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !anexandoParaId) return;
    setEnviandoNfTardia(true);
    try {
      const dadosArq = await lerArquivoComoBase64(file);
      const res = await uploadNotaFiscalCompra(
        sessao,
        anexandoParaId,
        dadosArq.base64,
        dadosArq.mimeType,
        dadosArq.fileName
      );
      if (res.ok) {
        onNotify(res.msg, 'success');
        await onAtualizar();
      } else {
        onNotify(res.msg, 'error');
      }
    } finally {
      setEnviandoNfTardia(false);
      setAnexandoParaId('');
    }
  }

  function abrirModalCompra() {
    if (!podeEditar) {
      onNotify('Apenas Gerentes, Donos e Administradores podem registrar compras.', 'error');
      return;
    }
    const primeiroProd = produtos[0];
    setCompraFornecedor('');
    setCompraFormaPgto('Dinheiro');
    setCompraVencimento(new Date().toISOString().slice(0, 10));
    setCompraObs('');
    setCompraProdId(primeiroProd ? primeiroProd.id : '');
    setCompraQtd('');
    setCompraCustoUnit('');
    setCompraItens([]);
    setNfArquivo(null);
    setConfirmarSemNf(false);
    fecharScannerCamera();
    setModalCompraAberto(true);
  }

  function handleSelecionarProdCompra(prodId: string) {
    setCompraProdId(prodId);
  }

  function handleAdicionarItemCompra() {
    const prod = produtos.find((p) => p.id === compraProdId);
    if (!prod) {
      onNotify('Selecione um produto válido.', 'warning');
      return;
    }
    const qtd = parseFloat(compraQtd.replace(',', '.')) || 0;
    const custo = parseFloat(compraCustoUnit.replace(',', '.'));
    if (qtd <= 0 || Number.isNaN(custo) || custo < 0) {
      onNotify('Informe uma quantidade maior que zero e um custo unitário válido.', 'warning');
      return;
    }
    setCompraItens((prev) => {
      const idx = prev.findIndex((x) => x.produto.id === prod.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantidade: Number((next[idx].quantidade + qtd).toFixed(2)), custoUnitario: custo };
        return next;
      }
      return [...prev, { produto: prod, quantidade: qtd, custoUnitario: custo }];
    });
    setCompraQtd('');
    setCompraCustoUnit('');
  }

  async function executarEnvioCompra() {
    setSalvandoCompra(true);
    try {
      const res = await registrarCompraEstoque(sessao, {
        fornecedor: compraFornecedor,
        formaPagamento: compraFormaPgto,
        vencimento: compraVencimento,
        observacao: compraObs,
        itens: compraItens,
        nfArquivo,
        comprasSemNfAtuais: comprasSemNf.length
      });
      if (res.ok) {
        fecharScannerCamera();
        setModalCompraAberto(false);
        setConfirmarSemNf(false);
        onNotify(res.msg, 'success');
        if (res.semNf) {
          const perfilUpper = String(sessao.usuario.perfil || '').toUpperCase();
          onNotify(
            perfilUpper === 'GERENTE'
              ? `⚠️ Compra ${res.idCompra} salva SEM Nota Fiscal! O Dono foi notificado no Telegram. Anexe a nota assim que possível.`
              : `⚠️ Alerta: Compra ${res.idCompra} salva SEM Nota Fiscal anexada! Lembre-se de anexar em "Notas / Compras".`,
            'warning'
          );
        }
        await onAtualizar();
      } else {
        onNotify(res.msg, 'error');
      }
    } finally {
      setSalvandoCompra(false);
    }
  }

  async function handleConfirmarCompra(e: FormEvent) {
    e.preventDefault();
    if (!podeEditar) return;
    if (!compraFornecedor.trim()) {
      onNotify('Informe o nome do fornecedor.', 'warning');
      return;
    }
    if (compraItens.length === 0) {
      onNotify('Adicione pelo menos 1 produto na lista da compra.', 'warning');
      return;
    }
    if (!nfArquivo && !confirmarSemNf) {
      setConfirmarSemNf(true);
      return;
    }
    await executarEnvioCompra();
  }

  const totalCompraModal = compraItens.reduce(
    (s, it) => s + Number((it.quantidade * it.custoUnitario).toFixed(2)),
    0
  );
  const compraIsPrazo = /BOLETO|CONSIGNADO|PRAZO/i.test(compraFormaPgto);

  const novoSaldoPreview = Math.max(0, (parseFloat(estoqueAtual) || 0) + (parseFloat(deltaAjusteModal) || 0));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* KPIs DE RESUMO DO ESTOQUE (OCULTO PARA VENDEDOR) */}
      {!isVendedor && (
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-label">Total de Produtos</div>
            <div className="kpi-value">{resumoEstoque.totalProdutos}</div>
            <div className="kpi-sub">Itens cadastrados</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Valor a Custo</div>
            <div className="kpi-value" style={{ color: '#38bdf8' }}>
              {formatarMoeda(resumoEstoque.custoTotal)}
            </div>
            <div className="kpi-sub">Capital investido</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Valor de Venda</div>
            <div className="kpi-value" style={{ color: '#34d399' }}>
              {formatarMoeda(resumoEstoque.vendaTotal)}
            </div>
            <div className="kpi-sub">Potencial bruto</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Lucro Potencial</div>
            <div className="kpi-value" style={{ color: '#c4b5fd' }}>
              {formatarMoeda(resumoEstoque.lucroPotencial)}
            </div>
            <div className="kpi-sub">Venda menos custo</div>
          </div>
        </div>
      )}

      <div className="panel-card">
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 240 }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
              <Search
                size={15}
                color="#94a3b8"
                style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                className="field-input"
                placeholder="🔍 Filtrar por nome, categoria ou Código/ID..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                style={{ paddingLeft: 32 }}
              />
            </div>
            <span className="badge badge-purple">
              {filtradosOrdenados.length} de {produtos.length} produtos cadastrados
            </span>
          </div>
          {podeEditar && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn"
                onClick={handleRecalcularValores}
                disabled={recalculando}
              >
                <RefreshCw size={14} className={recalculando ? 'spin-icon' : ''} />
                <span>{recalculando ? 'Recalculando...' : 'Recalcular Valores'}</span>
              </button>
              <button type="button" className="btn btn-primary" onClick={abrirModalCompra}>
                <ShoppingBag size={15} />
                <span>🛒 Compras</span>
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setFiltroHistNf('SEM_NF');
                  setModalHistoricoCompras(true);
                }}
                style={comprasSemNf.length > 0 ? { borderColor: '#f59e0b', color: '#fbbf24' } : undefined}
              >
                <FileText size={15} />
                <span>Notas / Compras</span>
                {comprasSemNf.length > 0 && (
                  <span className="nav-badge warn" style={{ marginLeft: 4 }}>
                    {comprasSemNf.length}
                  </span>
                )}
              </button>
              <button type="button" className="btn btn-success" onClick={abrirModalNovoProduto}>
                <PackagePlus size={15} />
                <span>➕ Novo Produto</span>
              </button>
            </div>
          )}
        </div>

        <div className="table-wrap" style={{ marginTop: 16 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Código/ID</th>
                <th>Produto</th>
                <th>Categoria</th>
                <th>Preço Venda</th>
                {!isVendedor && <th>Custo Médio</th>}
                <th>{isVendedor ? 'Estoque' : 'Estoque Atual'}</th>
                {!isVendedor && <th>Mínimo</th>}
                {!isVendedor && <th>Status</th>}
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtradosOrdenados.map((p) => {
                const statusBadge =
                  p.estoque_atual <= 0 ? (
                    <span className="badge badge-danger">CRÍTICO</span>
                  ) : p.estoque_atual <= p.estoque_minimo ? (
                    <span className="badge badge-warn">BAIXO</span>
                  ) : (
                    <span className="badge badge-ok">OK</span>
                  );
                return (
                  <tr
                    key={p.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => abrirModalGestaoProduto(p)}
                    title={isVendedor ? 'Clique para consultar detalhes do produto' : 'Clique para gerenciar produto, margem e saldo'}
                  >
                    <td>
                      <code style={{ color: '#38bdf8', fontSize: 12 }}>{p.id}</code>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700 }}>{p.nome}</div>
                      {(p.marca || p.volume) && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {[p.marca, p.volume].filter(Boolean).join(' • ')}
                        </div>
                      )}
                    </td>
                    <td>{p.categoria}</td>
                    <td style={{ color: '#34d399', fontWeight: 700 }}>{formatarMoeda(p.preco_venda)}</td>
                    {!isVendedor && <td>{formatarMoeda(p.custo_medio)}</td>}
                    <td style={{ fontWeight: 700 }}>{p.estoque_atual} un</td>
                    {!isVendedor && <td>{p.estoque_minimo} un</td>}
                    {!isVendedor && <td>{statusBadge}</td>}
                    <td>
                      <button
                        type="button"
                        className="btn btn-primary btn-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          abrirModalGestaoProduto(p);
                        }}
                      >
                        <Pencil size={12} /> {podeEditar ? 'Ajustar' : 'Ver'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL GESTÃO DE PRODUTO & LUCRATIVIDADE (FIEL AO LEGADO) */}
      {modalAberto && (
        <div className="modal-overlay">
          <div className="panel-card" style={{ maxWidth: 600, width: '100%', maxHeight: '92vh', overflowY: 'auto', borderColor: 'var(--border-accent)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 10, marginBottom: 12 }}>
              <div>
                <h3 style={{ fontSize: 17 }}>
                  {modoNovo ? '✨ Cadastrar Novo Produto' : '🏷️ Gestão de Produto & Lucratividade'}
                </h3>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                  {modoNovo
                    ? 'Preencha os dados cadastrais, custos e preço de venda'
                    : 'Edição cadastral, precificação inteligente e saldo'}
                </div>
              </div>
              <button type="button" className="btn btn-xs" onClick={() => setModalAberto(false)}>
                <X size={15} />
              </button>
            </div>

            {!modoNovo && (
              <div style={{ background: 'rgba(15, 23, 42, 0.72)', padding: 10, borderRadius: 10, border: '1px solid var(--border-subtle)', marginBottom: 12 }}>
                <label className="field-label">Selecione ou Troque o Produto</label>
                <select
                  className="field-select"
                  value={editId}
                  onChange={(e) => {
                    const found = produtos.find((x) => x.id === e.target.value);
                    if (found) carregarProdutoNoModal(found);
                  }}
                >
                  {produtos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} — {formatarMoeda(p.preco_venda)} ({p.estoque_atual} un)
                    </option>
                  ))}
                </select>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap', fontSize: 11.5 }}>
                  <span style={{ color: 'var(--text-muted)' }}>
                    Código: <strong style={{ color: '#38bdf8' }}>{editId}</strong>
                  </span>
                  <span style={{ color: 'var(--text-muted)', marginLeft: 'auto' }}>
                    Estoque Atual: <strong style={{ color: '#ffffff' }}>{estoqueAtual} un</strong>
                  </span>
                  {!isVendedor && (
                    <span
                      className={`badge ${
                        lucroUnitPreview < 0 || (custoNum > 0 && margemPreviewNum < 15)
                          ? 'badge-danger'
                          : 'badge-ok'
                      }`}
                    >
                      {lucroUnitPreview < 0
                        ? 'PREJUÍZO'
                        : custoNum > 0 && margemPreviewNum < 15
                        ? 'MARGEM BAIXA'
                        : 'MARGEM OK'}
                    </span>
                  )}
                </div>
              </div>
            )}

            {!podeEditar && (
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: 'rgba(245, 158, 11, 0.14)',
                  border: '1px solid #f59e0b',
                  color: '#fbbf24',
                  fontSize: 12,
                  fontWeight: 600,
                  marginBottom: 12
                }}
              >
                🔒 Modo Consulta: Alteração de preços, margens e cadastro é restrita a Gerentes e Donos.
              </div>
            )}

            <form onSubmit={handleSalvar} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
                <div>
                  <label className="field-label">Nome do Produto *</label>
                  <input className="field-input" value={nome} onChange={(e) => setNome(e.target.value)} disabled={!podeEditar} required />
                </div>
                <div>
                  <label className="field-label">Categoria</label>
                  <input
                    list="datalistCategoriasProd"
                    className="field-input"
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    disabled={!podeEditar}
                  />
                  <datalist id="datalistCategoriasProd">
                    {categoriasExistentes.map((cat) => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="field-label">Marca</label>
                  <input className="field-input" value={marca} onChange={(e) => setMarca(e.target.value)} disabled={!podeEditar} />
                </div>
                <div>
                  <label className="field-label">Volume / Medida</label>
                  <input className="field-input" value={volume} onChange={(e) => setVolume(e.target.value)} disabled={!podeEditar} />
                </div>
              </div>

              <div style={{ background: 'rgba(139, 92, 246, 0.08)', border: '1px solid rgba(139, 92, 246, 0.25)', borderRadius: 12, padding: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#c084fc', marginBottom: 8 }}>
                  {isVendedor ? '💰 Preço de Venda' : '💰 Precificação & Lucratividade Inteligente'}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: isVendedor ? '1fr' : '1fr 1fr 1fr', gap: 10 }}>
                  {!isVendedor && (
                    <>
                      <div>
                        <label className="field-label">Custo Médio (R$)</label>
                        <input
                          type="number"
                          step="0.01"
                          className="field-input"
                          value={custoMedio}
                          onChange={(e) => handleCustoChange(e.target.value)}
                          disabled={!podeEditar}
                        />
                      </div>
                      <div>
                        <label className="field-label" style={{ color: '#38bdf8' }}>Margem (%)</label>
                        <input
                          type="number"
                          step="0.1"
                          className="field-input"
                          style={{ color: '#38bdf8', fontWeight: 700 }}
                          value={margemPct}
                          onChange={(e) => handleMargemChange(e.target.value)}
                          disabled={!podeEditar}
                        />
                      </div>
                    </>
                  )}
                  <div>
                    <label className="field-label" style={{ color: '#34d399' }}>Preço Venda (R$) *</label>
                    <input
                      type="number"
                      step="0.01"
                      className="field-input"
                      style={{ color: '#34d399', fontWeight: 700 }}
                      value={precoVenda}
                      onChange={(e) => handleVendaChange(e.target.value)}
                      disabled={!podeEditar}
                      required
                    />
                  </div>
                </div>

                {podeEditar && (
                  <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Atalhos de Margem:</span>
                    {MARGENS_RAPIDAS.map((m) => (
                      <button
                        key={m}
                        type="button"
                        className="btn btn-xs"
                        style={{ borderColor: '#38bdf8', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.14)' }}
                        onClick={() => aplicarMargemRapida(m)}
                      >
                        +{m}%
                      </button>
                    ))}
                  </div>
                )}

                {!isVendedor && (
                  <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Lucro Bruto Unitário:</span>
                    <strong style={{ color: lucroUnitPreview >= 0 ? '#34d399' : '#f87171' }}>
                      {formatarMoeda(lucroUnitPreview)}
                    </strong>
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: modoNovo ? '1fr 1fr' : '1fr 1.6fr', gap: 10 }}>
                <div>
                  <label className="field-label">Estoque Mínimo</label>
                  <input
                    type="number"
                    min="0"
                    className="field-input"
                    value={estoqueMinimo}
                    onChange={(e) => setEstoqueMinimo(e.target.value)}
                    disabled={!podeEditar}
                  />
                </div>

                {modoNovo ? (
                  <div>
                    <label className="field-label">Estoque Inicial</label>
                    <input
                      type="number"
                      min="0"
                      className="field-input"
                      value={estoqueAtual}
                      onChange={(e) => setEstoqueAtual(e.target.value)}
                    />
                  </div>
                ) : (
                  podeEditar && (
                    <div>
                      <label className="field-label">Ajuste Rápido (+ ou -) → Novo: {novoSaldoPreview} un</label>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <button
                          type="button"
                          className="btn btn-xs"
                          onClick={() => setDeltaAjusteModal(String((parseFloat(deltaAjusteModal) || 0) - 1))}
                        >
                          <Minus size={12} />
                        </button>
                        <input
                          type="number"
                          step="1"
                          className="field-input"
                          style={{ textAlign: 'center' }}
                          value={deltaAjusteModal}
                          onChange={(e) => setDeltaAjusteModal(e.target.value)}
                        />
                        <button
                          type="button"
                          className="btn btn-xs"
                          onClick={() => setDeltaAjusteModal(String((parseFloat(deltaAjusteModal) || 0) + 1))}
                        >
                          <Plus size={12} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary btn-xs"
                          style={{ whiteSpace: 'nowrap', padding: '8px 10px' }}
                          onClick={handleAplicarAjusteSaldoModal}
                          disabled={salvando}
                        >
                          📦 Ajustar Saldo
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
                <button type="button" className="btn" onClick={() => setModalAberto(false)}>
                  {podeEditar ? 'Cancelar' : 'Fechar'}
                </button>
                {podeEditar && (
                  <button type="submit" className="btn btn-success" disabled={salvando}>
                    {salvando ? 'Salvando...' : modoNovo ? '✨ Cadastrar Produto' : '💾 Salvar Alterações'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL DE COMPRAS / ENTRADA DE MERCADORIA */}
      {modalCompraAberto && (
        <div className="modal-overlay">
          <div className="panel-card" style={{ maxWidth: 660, width: '100%', maxHeight: '92vh', overflowY: 'auto', borderColor: 'var(--border-accent)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 10, marginBottom: 12 }}>
              <div>
                <h3 style={{ fontSize: 17 }}>🛒 Registrar Compra / Entrada de Estoque</h3>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                  Atualiza Estoque, Custo Médio, Margem, Caixa / Contas a Pagar e Planilha automaticamente
                </div>
              </div>
              <button type="button" className="btn btn-xs" onClick={() => setModalCompraAberto(false)}>
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleConfirmarCompra} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* BLOCO DE ANEXO DA NOTA FISCAL & LEITURA AUTOMÁTICA */}
              <div style={{ background: 'rgba(139, 92, 246, 0.08)', border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: 12, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                  <div>
                    <strong style={{ fontSize: 12.5, color: '#c084fc' }}>
                      📄 Nota Fiscal &amp; Leitura Automática (Foto, Arquivo, QR Code / Código de Barras)
                    </strong>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Lê automaticamente fornecedor, pagamento, chave 44 dígitos e itens da nota
                    </div>
                  </div>
                  {nfArquivo && (
                    <span className="badge badge-ok">
                      📎 {nfArquivo.fileName}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <input
                    ref={fallbackFotoRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleSelecionarArquivoNf}
                    disabled={analisandoNf}
                    style={{ display: 'none' }}
                  />
                  <button
                    type="button"
                    className="btn btn-primary btn-xs"
                    style={{ cursor: analisandoNf ? 'wait' : 'pointer', padding: '7px 11px' }}
                    disabled={analisandoNf}
                    onClick={scannerAberto && cameraModo === 'FOTO' ? fecharScannerCamera : () => void abrirCameraParaFoto()}
                  >
                    <Camera size={14} />
                    <span>{analisandoNf ? 'Lendo...' : scannerAberto && cameraModo === 'FOTO' ? 'Fechar Câmera' : '📷 Tirar Foto'}</span>
                  </button>

                  <label className="btn btn-xs" style={{ cursor: analisandoNf ? 'wait' : 'pointer', padding: '7px 11px' }}>
                    <FolderOpen size={14} />
                    <span>📁 Buscar Arquivo (Foto/PDF)</span>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={handleSelecionarArquivoNf}
                      disabled={analisandoNf}
                      style={{ display: 'none' }}
                    />
                  </label>

                  <button
                    type="button"
                    className="btn btn-xs"
                    style={{ padding: '7px 11px', borderColor: '#38bdf8', color: '#38bdf8' }}
                    onClick={scannerAberto && cameraModo === 'SCANNER' ? fecharScannerCamera : () => void abrirScannerQrOuBarras()}
                  >
                    <QrCode size={14} />
                    <span>{scannerAberto && cameraModo === 'SCANNER' ? 'Fechar Câmera' : '📲 Ler QR / Código de Barras'}</span>
                  </button>

                  {nfArquivo && (
                    <button
                      type="button"
                      className="btn btn-danger btn-xs"
                      style={{ padding: '7px 10px' }}
                      onClick={() => setNfArquivo(null)}
                    >
                      <X size={13} /> Remover Anexo
                    </button>
                  )}
                </div>

                {scannerAberto && (
                  <div style={{ marginTop: 10, background: '#020617', borderRadius: 10, padding: 8, textAlign: 'center' }}>
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      style={{ width: '100%', maxHeight: 220, borderRadius: 8, objectFit: 'cover' }}
                    />
                    <div style={{ fontSize: 11.5, color: '#38bdf8', marginTop: 6 }}>{scannerMsg}</div>
                    {cameraModo === 'FOTO' && (
                      <div style={{ marginTop: 8, display: 'flex', gap: 8, justifyContent: 'center' }}>
                        <button
                          type="button"
                          className="btn btn-success btn-xs"
                          style={{ padding: '7px 14px' }}
                          onClick={() => void capturarFotoDaCamera()}
                        >
                          📸 Capturar Foto
                        </button>
                        <button
                          type="button"
                          className="btn btn-xs"
                          onClick={() => fallbackFotoRef.current?.click()}
                        >
                          📁 Escolher Imagem
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {nfArquivo?.previewUrl && (
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <img
                      src={nfArquivo.previewUrl}
                      alt="Prévia NF"
                      style={{ width: 54, height: 54, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border-subtle)' }}
                    />
                    <div style={{ fontSize: 11.5, color: '#34d399' }}>
                      {analisandoNf ? '🤖 Extraindo itens e valores da nota...' : '✅ Nota pronta para envio automático ao Drive'}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: compraIsPrazo ? '1.5fr 1fr 0.9fr' : '1.5fr 1fr', gap: 10 }}>
                <div>
                  <label className="field-label">Fornecedor *</label>
                  <input
                    className="field-input"
                    placeholder="Ex: Ambev, Distribuidora..."
                    value={compraFornecedor}
                    onChange={(e) => setCompraFornecedor(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="field-label">Forma de Pagamento *</label>
                  <select
                    className="field-select"
                    value={compraFormaPgto}
                    onChange={(e) => setCompraFormaPgto(e.target.value)}
                  >
                    <option value="Dinheiro">💵 Dinheiro (Sai do Caixa)</option>
                    <option value="PIX">⚡ PIX (Sai do Caixa)</option>
                    <option value="Cartão Débito">💳 Cartão Débito</option>
                    <option value="Cartão Crédito">💳 Cartão Crédito</option>
                    <option value="Boleto">🧾 Boleto (Gera Conta a Pagar)</option>
                    <option value="Consignado">🤝 Consignado (Gera Conta a Pagar)</option>
                    <option value="A Prazo">📅 A Prazo (Gera Conta a Pagar)</option>
                  </select>
                </div>
                {compraIsPrazo && (
                  <div>
                    <label className="field-label">Vencimento *</label>
                    <input
                      type="date"
                      className="field-input"
                      value={compraVencimento}
                      onChange={(e) => setCompraVencimento(e.target.value)}
                      required
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="field-label">Observação / Nota Fiscal (opcional)</label>
                <input
                  className="field-input"
                  placeholder="Ex: NF 12345, entrega manhã..."
                  value={compraObs}
                  onChange={(e) => setCompraObs(e.target.value)}
                />
              </div>

              <div style={{ background: 'rgba(15, 23, 42, 0.72)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#c084fc', marginBottom: 8 }}>
                  📦 Adicionar Produtos à Compra
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 0.8fr 1fr auto', gap: 8, alignItems: 'end' }}>
                  <div>
                    <label className="field-label">Produto</label>
                    <select
                      className="field-select"
                      value={compraProdId}
                      onChange={(e) => handleSelecionarProdCompra(e.target.value)}
                    >
                      {produtos.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nome} ({p.estoque_atual} un)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="field-label">Qtd</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="field-input"
                      placeholder="0"
                      value={compraQtd}
                      onChange={(e) => setCompraQtd(e.target.value.replace(/[^0-9.,]/g, ''))}
                    />
                  </div>
                  <div>
                    <label className="field-label">Custo Unit. (R$)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      className="field-input"
                      placeholder="0,00"
                      value={compraCustoUnit}
                      onChange={(e) => setCompraCustoUnit(e.target.value.replace(/[^0-9.,]/g, ''))}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ height: 38 }}
                    onClick={handleAdicionarItemCompra}
                  >
                    <Plus size={14} /> Add
                  </button>
                </div>

                {compraItens.length > 0 && (
                  <div className="table-wrap" style={{ marginTop: 12 }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Produto</th>
                          <th>Qtd</th>
                          <th>Custo Unit.</th>
                          <th>Subtotal</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {compraItens.map((it) => (
                          <tr key={it.produto.id}>
                            <td><strong>{it.produto.nome}</strong></td>
                            <td>{it.quantidade} un</td>
                            <td>{formatarMoeda(it.custoUnitario)}</td>
                            <td style={{ color: '#34d399', fontWeight: 700 }}>
                              {formatarMoeda(it.quantidade * it.custoUnitario)}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                type="button"
                                className="btn btn-danger btn-xs"
                                onClick={() =>
                                  setCompraItens((prev) => prev.filter((x) => x.produto.id !== it.produto.id))
                                }
                              >
                                <Trash2 size={12} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 14px',
                  borderRadius: 10,
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.3)'
                }}
              >
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {compraIsPrazo
                    ? '💳 Gerará Conta a Pagar (sem saída imediata do Caixa)'
                    : '💵 Lançará saída imediata no Caixa'}
                </span>
                <strong style={{ fontSize: 18, color: '#34d399' }}>
                  Total: {formatarMoeda(totalCompraModal)}
                </strong>
              </div>

              {confirmarSemNf && !nfArquivo && (
                <div
                  style={{
                    padding: '12px 14px',
                    borderRadius: 10,
                    background: 'rgba(245, 158, 11, 0.16)',
                    border: '1px solid #f59e0b',
                    color: '#fde68a',
                    fontSize: 12.5,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: '#fbbf24' }}>
                    <AlertTriangle size={16} />
                    <span>Atenção: Nenhuma Nota Fiscal foi anexada a esta compra!</span>
                  </div>
                  <span>
                    É necessário anexar a Nota Fiscal. Caso continue sem anexo agora você poderá anexar a nota depois em &quot;Notas / Compras&quot;.
                    {sessao.usuario.perfil === 'GERENTE' && ' (O Dono também será notificado no Telegram.)'}
                  </span>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <button type="button" className="btn btn-xs" onClick={() => setConfirmarSemNf(false)}>
                      Voltar e Anexar NF
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-xs"
                      style={{ background: '#d97706', borderColor: '#b45309', color: '#ffffff' }}
                      disabled={salvandoCompra}
                      onClick={() => void executarEnvioCompra()}
                    >
                      {salvandoCompra ? 'Salvando...' : 'Continuar sem NF (Anexar Depois)'}
                    </button>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    fecharScannerCamera();
                    setModalCompraAberto(false);
                  }}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-success" disabled={salvandoCompra || analisandoNf || compraItens.length === 0}>
                  {salvandoCompra ? 'Registrando...' : '✅ Confirmar & Lançar Compra'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL HISTÓRICO DE COMPRAS & PENDÊNCIAS DE NOTA FISCAL */}
      {modalHistoricoCompras && (
        <div className="modal-overlay">
          <div className="panel-card" style={{ maxWidth: 820, width: '100%', maxHeight: '90vh', overflowY: 'auto', borderColor: 'var(--border-accent)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 10, marginBottom: 12 }}>
              <div>
                <h3 style={{ fontSize: 17 }}>📋 Histórico de Compras &amp; Notas Fiscais</h3>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                  {comprasSemNf.length > 0
                    ? `⚠️ ${comprasSemNf.length} compra(s) aguardando anexo de Nota Fiscal`
                    : '✅ Todas as compras registradas possuem Nota Fiscal anexada'}
                </div>
              </div>
              <button type="button" className="btn btn-xs" onClick={() => setModalHistoricoCompras(false)}>
                <X size={15} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                className={`btn btn-xs ${filtroHistNf === 'SEM_NF' ? 'btn-primary' : ''}`}
                onClick={() => setFiltroHistNf('SEM_NF')}
              >
                ⚠️ Sem Nota Fiscal ({comprasSemNf.length})
              </button>
              <button
                type="button"
                className={`btn btn-xs ${filtroHistNf === 'TODAS' ? 'btn-primary' : ''}`}
                onClick={() => setFiltroHistNf('TODAS')}
              >
                📋 Todas as Compras ({historicoComprasAgrupado.length})
              </button>
            </div>

            <input
              ref={inputNfTardiaRef}
              type="file"
              accept="image/*,application/pdf"
              onChange={handleAnexarNfTardiaChange}
              style={{ display: 'none' }}
            />

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Data</th>
                    <th>Fornecedor</th>
                    <th>Pgto</th>
                    <th>Total</th>
                    <th>Nota Fiscal</th>
                  </tr>
                </thead>
                <tbody>
                  {listaHistoricoExibida.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 20 }}>
                        {filtroHistNf === 'SEM_NF'
                          ? '✅ Nenhuma compra aguardando Nota Fiscal!'
                          : 'Nenhuma compra registrada ainda.'}
                      </td>
                    </tr>
                  ) : (
                    listaHistoricoExibida.map((c) => {
                      const expandida = compraExpandidaId === c.idCompra;
                      return (
                        <Fragment key={c.idCompra}>
                          <tr
                            onClick={() => setCompraExpandidaId(expandida ? '' : c.idCompra)}
                            style={{ cursor: 'pointer', background: expandida ? 'rgba(56,189,248,0.08)' : undefined }}
                            title="Clique para ver os itens desta compra"
                          >
                            <td>
                              <code style={{ color: '#38bdf8' }}>{c.idCompra}</code>
                              <span style={{ marginLeft: 6, fontSize: 10.5, color: 'var(--text-muted)' }}>
                                {expandida ? '▲' : '▼'}
                              </span>
                            </td>
                            <td>{formatarDataHoraBr(c.data_hora)}</td>
                            <td>
                              <strong>{c.fornecedor}</strong>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                {c.itensCount} item(ns) • {c.operador}
                              </div>
                            </td>
                            <td>{c.forma}</td>
                            <td style={{ color: '#34d399', fontWeight: 700 }}>{formatarMoeda(c.total)}</td>
                            <td onClick={(e) => e.stopPropagation()}>
                              {c.temNf ? (
                                <a
                                  href={c.nfUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="btn btn-xs"
                                  style={{ borderColor: '#10b981', color: '#34d399', textDecoration: 'none' }}
                                >
                                  📎 Ver NF
                                </a>
                              ) : (
                                <button
                                  type="button"
                                  className="btn btn-xs"
                                  style={{ borderColor: '#f59e0b', color: '#fbbf24' }}
                                  disabled={enviandoNfTardia}
                                  onClick={() => {
                                    setAnexandoParaId(c.idCompra);
                                    inputNfTardiaRef.current?.click();
                                  }}
                                >
                                  <Paperclip size={12} />{' '}
                                  {enviandoNfTardia && anexandoParaId === c.idCompra ? 'Enviando...' : 'Anexar NF'}
                                </button>
                              )}
                            </td>
                          </tr>
                          {expandida && (
                            <tr>
                              <td colSpan={6} style={{ background: 'rgba(15, 23, 42, 0.55)', padding: '10px 14px' }}>
                                <div style={{ fontSize: 11.5, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}>
                                  Itens da compra {c.idCompra} ({c.itens.length}):
                                </div>
                                <table className="data-table" style={{ fontSize: 12 }}>
                                  <thead>
                                    <tr>
                                      <th>Produto</th>
                                      <th style={{ textAlign: 'right' }}>Qtd</th>
                                      <th style={{ textAlign: 'right' }}>Custo Unit.</th>
                                      <th style={{ textAlign: 'right' }}>Subtotal</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {c.itens.map((it) => (
                                      <tr key={it.id}>
                                        <td>{it.produto_nome}</td>
                                        <td style={{ textAlign: 'right' }}>{it.quantidade}</td>
                                        <td style={{ textAlign: 'right' }}>{formatarMoeda(it.custo_unitario)}</td>
                                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#34d399' }}>
                                          {formatarMoeda(it.valor_total)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
