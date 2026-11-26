import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BarChart3,
  Bike,
  BrainCircuit,
  ClipboardList,
  Crown,
  DollarSign,
  FileText,
  Lock,
  LogOut,
  Package,
  Settings,
  ShoppingCart,
  UserCheck,
  Users
} from 'lucide-react';
import type {
  ConfigMasterSaas,
  PainelSnapshot,
  SessaoAtiva,
  StatusSync,
  ToastMensagem
} from './types/domain';
import {
  APP_VERSION_SAAS,
  limparSessaoLocal,
  obterConfigMasterSaasPublica,
  obterSnapshotUnidade,
  recalcularValoresEstoque,
  recuperarSessaoLocal,
  registrarAcessoSuporteAdmin,
  registrarLogoutOperadorSemConferencia,
  salvarSessaoLocal,
  verificarSetupInicial
} from './services/dataRepository';
import { getSupabaseClient, isSupabaseConfigured, setSupabaseTenantHeaders } from './services/supabaseClient';
import { dispararSyncPlanilhaImediata } from './services/sheetBridgeService';
import { localFolderService, salvarArquivoNaPastaLocal } from './services/localFolderService';
import {
  getDriveMetaEmpresa,
  isGoogleDriveConectado,
  sincronizarPlanilhaEspelhoLimpa
} from './services/googleDriveMirrorService';
import { baixarPacoteRelatoriosGerenciais } from './services/pdfReportService';
import { formatarMoeda, obterSubpastaMesAtual } from './utils/formatters';
import { LoginScreen } from './components/LoginScreen';
import { Header } from './components/Header';
import { DashboardTab } from './components/DashboardTab';
import { PdvTab } from './components/PdvTab';
import { ComandasTab } from './components/ComandasTab';
import { DeliveryTab } from './components/DeliveryTab';
import { EstoqueTab } from './components/EstoqueTab';
import { FinanceiroTab } from './components/FinanceiroTab';
import { CentralOperacionalTab } from './components/CentralOperacionalTab';
import { RelatoriosTab } from './components/RelatoriosTab';
import { EquipeTab } from './components/EquipeTab';
import { ClientesTab } from './components/ClientesTab';
import { ConfigTab } from './components/ConfigTab';
import { AdminMasterTab } from './components/AdminMasterTab';
import { PagamentoAssinaturaCard } from './components/PagamentoAssinaturaCard';
import { BoasVindasOnboarding } from './components/BoasVindasOnboarding';

type AbaAtiva =
  | 'pdv'
  | 'comandas'
  | 'delivery'
  | 'dashboard'
  | 'estoque'
  | 'financeiro'
  | 'clientes'
  | 'equipe'
  | 'central'
  | 'relatorios'
  | 'config'
  | 'master';

export function App() {
  const [sessao, setSessao] = useState<SessaoAtiva | null>(() => recuperarSessaoLocal());
  const [boasVindasTick, setBoasVindasTick] = useState(0);
  const [setupInfo, setSetupInfo] = useState<{
    precisaSetupDono: boolean;
    empresaId: string;
    nomeEmpresa: string;
  }>({ precisaSetupDono: false, empresaId: '', nomeEmpresa: '' });
  const [snapshot, setSnapshot] = useState<PainelSnapshot | null>(null);
  const [abaAtiva, setAbaAtiva] = useState<AbaAtiva>('pdv');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [financeiroSubAba, setFinanceiroSubAba] = useState<'caixa' | 'pagar' | 'receber'>('caixa');
  const [financeiroNavTick, setFinanceiroNavTick] = useState(0);
  const [abrirFiscalAoEntrar, setAbrirFiscalAoEntrar] = useState(false);
  const [abrirCompraAoEntrar, setAbrirCompraAoEntrar] = useState(false);
  const [configMasterPublica, setConfigMasterPublica] = useState<ConfigMasterSaas | null>(null);
  const [modoSuporteAdmin, setModoSuporteAdmin] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [modalSairAberto, setModalSairAberto] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const [toasts, setToasts] = useState<ToastMensagem[]>([]);
  const [statusSync, setStatusSync] = useState<StatusSync>({
    bancoConectado: isSupabaseConfigured(),
    modoBanco: isSupabaseConfigured() ? 'SUPABASE' : 'LOCAL',
    pastaLocalConectada: false,
    pastaLocalNome: '',
    driveConectado: isGoogleDriveConectado(),
    drivePastaUrl: '',
    planilhaEspelhoUrl: ''
  });

  const notify = useCallback(
    (texto: string, tipo: ToastMensagem['tipo'] = 'info') => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev, { id, texto, tipo }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4500);
    },
    []
  );

  const atualizarStatusSync = useCallback(async (sessaoAlvo?: SessaoAtiva | null) => {
    const pastaSt = await localFolderService.obterStatus();
    const empId = sessaoAlvo?.unidadeAtivaId || '';
    const metaDrive = empId ? getDriveMetaEmpresa(empId) : { rootFolderUrl: '', planilhaUrl: '' };
    const supaOn = isSupabaseConfigured();

    setStatusSync({
      bancoConectado: supaOn,
      modoBanco: sessaoAlvo ? sessaoAlvo.modoBanco : supaOn ? 'SUPABASE' : 'LOCAL',
      pastaLocalConectada: pastaSt.conectado,
      pastaLocalNome: pastaSt.nomePasta,
      driveConectado: isGoogleDriveConectado(),
      drivePastaUrl: metaDrive.rootFolderUrl,
      planilhaEspelhoUrl: metaDrive.planilhaUrl,
      ultimaSincronizacao: new Date().toLocaleTimeString('pt-BR')
    });
  }, []);

  const carregandoRef = useRef(false);

  const carregarDados = useCallback(
    async (sessaoAlvo: SessaoAtiva, silencioso = false) => {
      if (carregandoRef.current && silencioso) return;
      carregandoRef.current = true;
      if (!silencioso) setSincronizando(true);
      try {
        const snap = await obterSnapshotUnidade(sessaoAlvo);
        setSnapshot(snap);
        void obterConfigMasterSaasPublica(sessaoAlvo).then(setConfigMasterPublica).catch(() => {});
        await atualizarStatusSync(sessaoAlvo);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro ao carregar dados da unidade.';
        if (msg === 'SESSAO_EXPIRADA') {
          limparSessaoLocal();
          setSessao(null);
          setSnapshot(null);
          notify('Sessão expirada. Faça login novamente para carregar os dados do Supabase.', 'warning');
          return;
        }
        if (!silencioso) notify(msg, 'error');
      } finally {
        carregandoRef.current = false;
        if (!silencioso) setSincronizando(false);
      }
    },
    [atualizarStatusSync, notify]
  );

  useEffect(() => {
    if (!sessao) {
      const params = new URLSearchParams(window.location.search);
      const empParam = params.get('empresa_id') || undefined;
      void verificarSetupInicial(empParam).then(setSetupInfo);
    } else {
      void carregarDados(sessao);
    }
  }, [sessao, carregarDados]);

  // Sincronização em tempo real entre painéis abertos (Supabase Realtime + Foco + Fallback rápido 10s)
  useEffect(() => {
    if (!sessao) return;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const agendarRefreshSilencioso = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        void carregarDados(sessao, true);
      }, 300);
    };

    const client = sessao.modoBanco === 'SUPABASE' ? getSupabaseClient() : null;
    const channel = client
      ? client
          .channel(`gn360-live-${sessao.unidadeAtivaId}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', filter: `empresa_id=eq.${sessao.unidadeAtivaId}` },
            agendarRefreshSilencioso
          )
          .subscribe()
      : null;

    const onFocusOrVisible = () => {
      if (document.visibilityState === 'visible') {
        agendarRefreshSilencioso();
      }
    };
    window.addEventListener('focus', onFocusOrVisible);
    document.addEventListener('visibilitychange', onFocusOrVisible);

    // Fallback leve a cada 10s caso alguma tabela não tenha Realtime habilitado no Supabase
    const fastInterval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void carregarDados(sessao, true);
      }
    }, 10000);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      window.removeEventListener('focus', onFocusOrVisible);
      document.removeEventListener('visibilitychange', onFocusOrVisible);
      window.clearInterval(fastInterval);
      if (client && channel) {
        void client.removeChannel(channel);
      }
    };
  }, [sessao, carregarDados]);

  // Auto-Refresh completo conforme configurado na aba CONFIG
  useEffect(() => {
    if (!sessao || !snapshot?.configsExtras.autoRefresh) return;
    const min = Math.max(1, Number(snapshot.configsExtras.intervaloRefreshMin) || 5);
    const id = window.setInterval(() => {
      void carregarDados(sessao, true);
    }, min * 60000);
    return () => window.clearInterval(id);
  }, [sessao, snapshot?.configsExtras.autoRefresh, snapshot?.configsExtras.intervaloRefreshMin, carregarDados]);

  // Atalhos globais de teclado fieis ao PainelDeposito360 (F2, F8, Escape)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!sessao) return;
      if (e.key === 'F2') {
        e.preventDefault();
        setAbaAtiva('pdv');
        setTimeout(() => {
          const el = document.getElementById('buscaProdutoPdv') as HTMLInputElement | null;
          el?.focus();
        }, 50);
      } else if (e.key === 'F8' && abaAtiva === 'pdv') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('gn360:finalizar-venda-pdv'));
      } else if (e.key === 'Escape') {
        window.dispatchEvent(new CustomEvent('gn360:escape'));
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [sessao, abaAtiva]);

  function handleLoginSucesso(novaSessao: SessaoAtiva) {
    const ehAdminLogado = String(novaSessao.usuario.perfil || '').trim().toUpperCase() === 'ADMIN';
    setSessao(novaSessao);
    setModoSuporteAdmin(false);
    setAbaAtiva(ehAdminLogado ? 'master' : 'pdv');
    notify(`Bem-vindo, ${novaSessao.usuario.nome}!`, 'success');
  }

  useEffect(() => {
    const ehAdminAtivo = String(sessao?.usuario?.perfil || '').trim().toUpperCase() === 'ADMIN';
    if (ehAdminAtivo && !modoSuporteAdmin) {
      setAbaAtiva('master');
    }
  }, [sessao?.usuario?.perfil, modoSuporteAdmin]);

  function handleSolicitarSaida() {
    setModalSairAberto(true);
  }

  async function handleConfirmarSaida() {
    if (!sessao) return;
    setSaindo(true);
    try {
      if (sessao.usuario.perfil === 'VENDEDOR') {
        await registrarLogoutOperadorSemConferencia(sessao, snapshot);
      }
    } finally {
      limparSessaoLocal();
      setSessao(null);
      setSnapshot(null);
      setModalSairAberto(false);
      setSaindo(false);
    }
  }

  async function handleSincronizarManual() {
    if (!sessao) return;
    const urlBridge = snapshot?.configsExtras.webappUrl;
    if (urlBridge) {
      await dispararSyncPlanilhaImediata(urlBridge, sessao.unidadeAtivaId, 'SYNC_BIDIRECTIONAL');
      await new Promise((r) => setTimeout(r, 1500));
    }
    await carregarDados(sessao);
    notify(
      urlBridge
        ? 'Planilha Google, Supabase e Painel 360° sincronizados!'
        : 'Dados do painel sincronizados!',
      'success'
    );
  }

  async function handleRecalcularEstoqueCentral() {
    if (!sessao || !snapshot) return;
    const res = await recalcularValoresEstoque(sessao, snapshot.produtos);
    notify(res.msg, res.ok ? 'success' : 'error');
    if (res.ok) await carregarDados(sessao);
  }

  async function handleGerarPacoteCentral() {
    if (!snapshot) return;
    const qtd = await baixarPacoteRelatoriosGerenciais(snapshot);
    notify(`Pacote completo gerado: ${qtd} relatórios PDF baixados!`, 'success');
  }

  async function handleBackupLocalCentral() {
    if (!snapshot) return;
    const json = JSON.stringify(snapshot, null, 2);
    const nomeArq = `Backup_${snapshot.empresa.nome.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.json`;
    const res = await salvarArquivoNaPastaLocal(
      snapshot.empresa.nome,
      'Backup',
      obterSubpastaMesAtual(),
      nomeArq,
      json
    );
    notify(res.msg, res.ok ? 'success' : 'warning');
  }

  async function handleSincronizarDriveCentral() {
    if (!sessao || !snapshot) return;
    const res = await sincronizarPlanilhaEspelhoLimpa(snapshot.empresa.id, snapshot);
    notify(res.msg, res.ok ? 'success' : 'warning');
    await atualizarStatusSync(sessao);
  }

  function handleTrocarUnidade(novaUnidadeId: string) {
    if (!sessao) return;
    const unidadeObj = sessao.unidades.find((u) => u.id === novaUnidadeId);
    const atualizada: SessaoAtiva = {
      ...sessao,
      unidadeAtivaId: novaUnidadeId
    };
    if (atualizada.modoBanco === 'SUPABASE') {
      setSupabaseTenantHeaders(atualizada.token, novaUnidadeId);
    }
    salvarSessaoLocal(atualizada, true);
    setSessao(atualizada);
    notify(`Painel alternado para: ${unidadeObj ? unidadeObj.nome : novaUnidadeId}`, 'info');
  }

  function handleUnidadesAtualizadas(novas: SessaoAtiva['unidades']) {
    if (!sessao) return;
    const atualizada: SessaoAtiva = { ...sessao, unidades: novas };
    salvarSessaoLocal(atualizada, true);
    setSessao(atualizada);
  }

  if (!sessao) {
    return (
      <>
        <LoginScreen
          precisaSetupDono={setupInfo.precisaSetupDono}
          setupEmpresaId={setupInfo.empresaId}
          setupNomeEmpresa={setupInfo.nomeEmpresa}
          onLoginSucesso={handleLoginSucesso}
        />
        <div className="toast-stack">
          {toasts.map((t) => (
            <div key={t.id} className={`toast-item ${t.tipo}`}>
              {t.texto}
            </div>
          ))}
        </div>
      </>
    );
  }

  const perfil = String(sessao.usuario.perfil || '').trim().toUpperCase();
  const isOperador = perfil === 'VENDEDOR';
  const isDonoOuAdmin = perfil === 'DONO' || perfil === 'ADMIN';
  const isAdmin = perfil === 'ADMIN';
  const unidadeAtivaResumo = sessao.unidades.find((u) => u.id === sessao.unidadeAtivaId);
  const nomeUnidadeAtiva = snapshot?.empresa.nome || unidadeAtivaResumo?.nome || sessao.empresa.nome;

  const empresaAtiva = snapshot?.empresa || sessao.empresa;
  const statusAssinaturaAtivo = String(empresaAtiva.status_assinatura || 'ATIVO').toUpperCase();
  const diasRestantesLicenca = empresaAtiva.valido_ate
    ? Math.ceil((new Date(empresaAtiva.valido_ate).getTime() - Date.now()) / 86400000)
    : null;
  const licencaBloqueada =
    !isAdmin &&
    (statusAssinaturaAtivo === 'BLOQUEADO' ||
      (diasRestantesLicenca !== null && diasRestantesLicenca < -3));
  const avisoLicenca =
    !isAdmin &&
    !licencaBloqueada &&
    (statusAssinaturaAtivo === 'INADIMPLENTE' ||
      (diasRestantesLicenca !== null && diasRestantesLicenca <= 5));
  const versaoDesatualizada =
    Boolean(configMasterPublica?.versao_minima) &&
    String(configMasterPublica?.versao_minima || '').localeCompare(APP_VERSION_SAAS, undefined, { numeric: true }) > 0;

  if (licencaBloqueada) {
    return (
      <div className="app-shell" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div className="panel-card" style={{ maxWidth: 620, width: '100%', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 14, borderColor: 'rgba(239,68,68,0.5)' }}>
          <Lock size={40} color="#f87171" style={{ margin: '0 auto' }} />
          <h2 style={{ fontSize: 20 }}>Acesso Aguardando Liberação do Master</h2>
          <p style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>
            A unidade <strong>{nomeUnidadeAtiva}</strong> está bloqueada ou aguardando validação. Realize o pagamento por uma das formas abaixo e envie o comprovante para liberação pelo Painel Master.
          </p>

          <PagamentoAssinaturaCard
            sessao={sessao}
            planoAtual={empresaAtiva.plano || 'PRO'}
            configMaster={configMasterPublica}
            onNotify={notify}
            onAtualizado={() => carregarDados(sessao)}
          />

          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
            {configMasterPublica?.whatsapp_suporte && (
              <a
                href={`https://wa.me/${configMasterPublica.whatsapp_suporte.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="btn"
                style={{ textDecoration: 'none' }}
              >
                Falar com Suporte
              </a>
            )}
            <button type="button" className="btn btn-danger" onClick={handleSolicitarSaida}>
              <LogOut size={14} /> Sair
            </button>
          </div>
        </div>
      </div>
    );
  }

  const boasVindasPendente = (() => {
    if (isAdmin) return false;
    void boasVindasTick;
    try {
      return localStorage.getItem(`gn360_boas_vindas_${sessao.unidadeAtivaId}`) === '1';
    } catch {
      return false;
    }
  })();

  if (boasVindasPendente) {
    return (
      <BoasVindasOnboarding
        sessao={sessao}
        empresa={empresaAtiva}
        onNotify={notify}
        onConcluido={async () => {
          setBoasVindasTick((n) => n + 1);
          await carregarDados(sessao);
        }}
      />
    );
  }

  const hojeYmd = new Date().toISOString().slice(0, 10);
  const comandasAbertasCount = snapshot
    ? snapshot.comandas.filter((c) => c.status === 'ABERTA').length
    : 0;
  const deliverysPendentesCount = snapshot
    ? snapshot.delivery.filter((d) => !['ENTREGUE', 'CANCELADO'].includes(d.status)).length
    : 0;
  const contasVencidasOuHojeCount = snapshot
    ? snapshot.contasPagar.filter(
        (c) => c.status !== 'PAGO' && String(c.vencimento || '').slice(0, 10) <= hojeYmd
      ).length
    : 0;
  const obrigacoesUrgentesCount = contasVencidasOuHojeCount || (snapshot?.kpis.obrigacoesPendentesCount || 0);
  const permitirEstoqueNegativo = snapshot?.configsExtras.permitirEstoqueNegativo ?? false;
  const linkExterno =
    snapshot?.configsExtras.spreadsheetUrl ||
    snapshot?.configsExtras.driveUrl ||
    statusSync.planilhaEspelhoUrl ||
    statusSync.drivePastaUrl;

  return (
    <div className="app-shell">
      <Header
        sessao={sessao}
        nomeUnidadeAtiva={isAdmin && !modoSuporteAdmin ? 'Painel Master SaaS — Sistema' : nomeUnidadeAtiva}
        statusSync={statusSync}
        sincronizando={sincronizando}
        obrigacoesPendentesCount={obrigacoesUrgentesCount}
        podeVerFinanceiro={!isOperador && (!isAdmin || modoSuporteAdmin)}
        isMasterAdminMode={isAdmin && !modoSuporteAdmin}
        linkExternoPlanilhaOuDrive={isAdmin && !modoSuporteAdmin ? '' : linkExterno}
        mobileMenuOpen={mobileMenuOpen}
        onToggleMobileMenu={() => setMobileMenuOpen((v) => !v)}
        onTrocarUnidade={handleTrocarUnidade}
        onSincronizar={() => void handleSincronizarManual()}
        onIrParaFinanceiro={() => {
          if (!isOperador) {
            setFinanceiroSubAba('pagar');
            setFinanceiroNavTick((n) => n + 1);
            setAbaAtiva('financeiro');
          }
        }}
        onIrParaConfig={() => {
          if (isDonoOuAdmin) setAbaAtiva(isAdmin && !modoSuporteAdmin ? 'master' : 'config');
        }}
        onSair={handleSolicitarSaida}
      />

      {isAdmin && modoSuporteAdmin && (
        <div className="no-print" style={{ background: 'rgba(139,92,246,0.22)', borderBottom: '1px solid rgba(167,139,250,0.5)', padding: '9px 18px', fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span>
            🛡️ <strong>MODO SUPORTE ATIVO</strong> em <strong>{nomeUnidadeAtiva}</strong> (autorizado pelo Dono)
          </span>
          <button
            type="button"
            className="btn btn-xs btn-primary"
            onClick={() => {
              setModoSuporteAdmin(false);
              setAbaAtiva('master');
            }}
          >
            🔙 Voltar ao Painel Master
          </button>
        </div>
      )}

      {versaoDesatualizada && (
        <div className="no-print" style={{ background: 'rgba(56,189,248,0.16)', borderBottom: '1px solid rgba(56,189,248,0.4)', padding: '8px 18px', fontSize: 12.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span>🚀 Nova versão disponível ({configMasterPublica?.versao_minima}). Versão atual: {APP_VERSION_SAAS}.</span>
          {configMasterPublica?.link_atualizacao ? (
            <a href={configMasterPublica.link_atualizacao} target="_blank" rel="noreferrer" className="btn btn-xs btn-primary" style={{ textDecoration: 'none' }}>
              Baixar Atualização
            </a>
          ) : (
            <button type="button" className="btn btn-xs btn-primary" onClick={() => window.location.reload()}>
              Atualizar Agora
            </button>
          )}
        </div>
      )}

      {avisoLicenca && (
        <div className="no-print" style={{ background: 'rgba(245,158,11,0.16)', borderBottom: '1px solid rgba(245,158,11,0.45)', padding: '8px 18px', fontSize: 12.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span>
            ⚠️ <strong>Aviso de Assinatura ({empresaAtiva.plano}):</strong>{' '}
            {diasRestantesLicenca !== null && diasRestantesLicenca <= 0
              ? 'Licença vencida! Regularize para evitar bloqueio.'
              : `Vence em ${diasRestantesLicenca} dia(s).`}
            {configMasterPublica?.chave_pix_admin ? ` PIX: ${configMasterPublica.chave_pix_admin}` : ''}
          </span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button type="button" className="btn btn-xs btn-primary" onClick={() => setAbaAtiva('config')}>
              Enviar Comprovante
            </button>
          </div>
        </div>
      )}

      {/* FAIXA SUPERIOR FIXA DE 6 KPIS CLICÁVEIS (OCULTA NO MASTER ADMIN PURO) */}
      {snapshot && (!isAdmin || modoSuporteAdmin) && (
        <section className="kpi-ribbon-6 no-print">
          <button
            type="button"
            className="kpi-ribbon-card"
            onClick={() => {
              if (!isOperador) setAbaAtiva('dashboard');
            }}
            style={isOperador ? { cursor: 'default' } : undefined}
            title={isOperador ? 'Faturamento acumulado do dia' : 'Clique para ver o Panorama Financeiro 360°'}
          >
            <div className="kpi-ribbon-lbl">
              <span>Faturamento Hoje</span>
              <span>💰</span>
            </div>
            <div className="kpi-ribbon-val green">{formatarMoeda(snapshot.kpis.faturamentoDia)}</div>
          </button>

          {!isOperador && (
            <>
              <button
                type="button"
                className="kpi-ribbon-card"
                onClick={() => setAbaAtiva('dashboard')}
                title="Clique para ver o Panorama Financeiro 360°"
              >
                <div className="kpi-ribbon-lbl">
                  <span>Faturamento Mês</span>
                  <span>📅</span>
                </div>
                <div className="kpi-ribbon-val purple">{formatarMoeda(snapshot.kpis.faturamentoMes)}</div>
              </button>

              <button
                type="button"
                className="kpi-ribbon-card"
                onClick={() => setAbaAtiva('dashboard')}
                title="Clique para ver Saldo e Fluxo de Caixa"
              >
                <div className="kpi-ribbon-lbl">
                  <span>Saldo Caixa</span>
                  <span>💵</span>
                </div>
                <div className={`kpi-ribbon-val ${snapshot.kpis.saldoCaixa < 0 ? 'red' : 'blue'}`}>
                  {formatarMoeda(snapshot.kpis.saldoCaixa)}
                </div>
              </button>

              <button
                type="button"
                className="kpi-ribbon-card"
                onClick={() => setAbaAtiva('estoque')}
                title="Clique para ver Estoque & Preços"
              >
                <div className="kpi-ribbon-lbl">
                  <span>Valor Estoque</span>
                  <span>📦</span>
                </div>
                <div className="kpi-ribbon-val">{formatarMoeda(snapshot.kpis.valorEstoqueVenda)}</div>
              </button>
            </>
          )}

          <button
            type="button"
            className="kpi-ribbon-card"
            onClick={() => setAbaAtiva('comandas')}
            title="Clique para ver Comandas Balcão"
          >
            <div className="kpi-ribbon-lbl">
              <span>Comandas Abertas</span>
              <span>🧾</span>
            </div>
            <div className="kpi-ribbon-val yellow">{comandasAbertasCount}</div>
          </button>

          <button
            type="button"
            className="kpi-ribbon-card"
            onClick={() => setAbaAtiva('delivery')}
            title="Clique para ver Módulo Delivery"
          >
            <div className="kpi-ribbon-lbl">
              <span>Deliverys Pendentes</span>
              <span>🛵</span>
            </div>
            <div className="kpi-ribbon-val red">{deliverysPendentesCount}</div>
          </button>
        </section>
      )}

      <div className="saas-workspace">
        {mobileMenuOpen && (
          <div
            className="mobile-sidebar-backdrop no-print"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
        )}
        <nav
          className={`nav-tabs no-print ${mobileMenuOpen ? 'mobile-open' : ''}`}
          onClick={(e) => {
            if ((e.target as HTMLElement).closest('button.nav-tab-btn')) {
              setMobileMenuOpen(false);
            }
          }}
        >
          <div className="mobile-sidebar-header">
            <strong style={{ fontSize: 14, color: 'var(--text-main)' }}>Menu do Sistema</strong>
            <button
              type="button"
              className="mobile-sidebar-close"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Fechar menu"
            >
              ✕
            </button>
          </div>
          {(!isAdmin || modoSuporteAdmin) && (
            <>
              <div className="nav-section-label">Vendas &amp; Atendimento</div>

          <button
            type="button"
            className={`nav-tab-btn ${abaAtiva === 'pdv' ? 'active' : ''}`}
            onClick={() => setAbaAtiva('pdv')}
          >
            <ShoppingCart size={16} /> <span>PDV Balcão</span>
          </button>

          <button
            type="button"
            className={`nav-tab-btn ${abaAtiva === 'comandas' ? 'active' : ''}`}
            onClick={() => setAbaAtiva('comandas')}
          >
            <ClipboardList size={16} /> <span>Comandas Balcão</span>
            {comandasAbertasCount > 0 && (
              <span className="nav-badge yellow">{comandasAbertasCount}</span>
            )}
          </button>

          <button
            type="button"
            className={`nav-tab-btn ${abaAtiva === 'delivery' ? 'active' : ''}`}
            onClick={() => setAbaAtiva('delivery')}
          >
            <Bike size={16} /> <span>Módulo Delivery</span>
            {deliverysPendentesCount > 0 && (
              <span className="nav-badge warn">{deliverysPendentesCount}</span>
            )}
          </button>

          <div className="nav-section-label">Gestão &amp; Financeiro</div>

          {!isOperador && (
            <button
              type="button"
              className={`nav-tab-btn ${abaAtiva === 'dashboard' ? 'active' : ''}`}
              onClick={() => setAbaAtiva('dashboard')}
            >
              <BarChart3 size={16} /> <span>Panorama 360°</span>
            </button>
          )}

          <button
            type="button"
            className={`nav-tab-btn ${abaAtiva === 'estoque' ? 'active' : ''}`}
            onClick={() => setAbaAtiva('estoque')}
          >
            <Package size={16} /> <span>Estoque &amp; Preços</span>
          </button>

          {!isOperador && (
            <button
              type="button"
              className={`nav-tab-btn ${abaAtiva === 'financeiro' ? 'active' : ''}`}
              onClick={() => {
                setFinanceiroSubAba('caixa');
                setFinanceiroNavTick((n) => n + 1);
                setAbaAtiva('financeiro');
              }}
            >
              <DollarSign size={16} /> <span>Financeiro &amp; Obrigações</span>
              {contasVencidasOuHojeCount > 0 && (
                <span className="nav-badge danger">{contasVencidasOuHojeCount}</span>
              )}
            </button>
          )}

          <div className="nav-section-label">Controle &amp; Fechamento</div>

          <button
            type="button"
            className={`nav-tab-btn ${abaAtiva === 'central' ? 'active' : ''}`}
            onClick={() => setAbaAtiva('central')}
          >
            <BrainCircuit size={16} />{' '}
            <span>{isOperador ? 'Conferência de Caixa' : 'Painel Inteligente'}</span>
          </button>

          {!isOperador && (
            <button
              type="button"
              className={`nav-tab-btn ${abaAtiva === 'relatorios' ? 'active' : ''}`}
              onClick={() => setAbaAtiva('relatorios')}
            >
              <FileText size={16} /> <span>Relatórios PDF</span>
            </button>
          )}

          {!isOperador && (
            <>
              <div className="nav-section-label">Administração</div>

              <button
                type="button"
                className={`nav-tab-btn ${abaAtiva === 'clientes' ? 'active' : ''}`}
                onClick={() => setAbaAtiva('clientes')}
              >
                <UserCheck size={16} /> <span>Clientes</span>
              </button>

              <button
                type="button"
                className={`nav-tab-btn ${abaAtiva === 'equipe' ? 'active' : ''}`}
                onClick={() => setAbaAtiva('equipe')}
              >
                <Users size={16} /> <span>Equipe</span>
              </button>

              {isDonoOuAdmin && (!isAdmin || modoSuporteAdmin) && (
                <button
                  type="button"
                  className={`nav-tab-btn ${abaAtiva === 'config' ? 'active' : ''}`}
                  onClick={() => setAbaAtiva('config')}
                >
                  <Settings size={16} /> <span>Configuração</span>
                </button>
              )}

              {isAdmin && (
                <button
                  type="button"
                  className={`nav-tab-btn ${abaAtiva === 'master' ? 'active' : ''}`}
                  onClick={() => {
                    setModoSuporteAdmin(false);
                    setAbaAtiva('master');
                  }}
                >
                  <Crown size={16} color="#fbbf24" /> <span>Master SaaS</span>
                </button>
              )}
            </>
          )}
            </>
          )}
          {isAdmin && !modoSuporteAdmin && (
            <>
              <div className="nav-section-label">Administração do Sistema</div>
              <button
                type="button"
                className={`nav-tab-btn ${abaAtiva === 'master' ? 'active' : ''}`}
                onClick={() => setAbaAtiva('master')}
              >
                <Crown size={16} color="#fbbf24" /> <span>Master SaaS</span>
              </button>
            </>
          )}
        </nav>

        <main className="saas-main">
          {abaAtiva === 'master' && isAdmin ? (
            <AdminMasterTab
              sessao={sessao}
              onNotify={notify}
              onSessaoAtualizada={(nova) => setSessao(nova)}
              onAcessarUnidadeSuporte={async (emp) => {
                const jaTem = sessao.unidades.some((u) => u.id === emp.id);
                const novasUnidades = jaTem
                  ? sessao.unidades
                  : [
                      ...sessao.unidades,
                      {
                        id: emp.id,
                        nome: emp.nome,
                        tipo: emp.tipo,
                        grupo_id: emp.grupo_id,
                        ehMatriz: emp.tipo === 'MATRIZ'
                      }
                    ];
                const novaSessao: SessaoAtiva = {
                  ...sessao,
                  unidades: novasUnidades,
                  unidadeAtivaId: emp.id,
                  empresa: emp
                };
                await registrarAcessoSuporteAdmin(novaSessao, emp);
                setModoSuporteAdmin(true);
                setSessao(novaSessao);
                salvarSessaoLocal(novaSessao, true);
                setAbaAtiva('dashboard');
                await carregarDados(novaSessao);
                notify(`Acesso de suporte autorizado na empresa "${emp.nome}".`, 'success');
              }}
            />
          ) : !snapshot ? (
            <div className="panel-card" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
              Carregando dados em tempo real...
            </div>
          ) : (
            <>
              {abaAtiva === 'pdv' && (
                <PdvTab
                  sessao={sessao}
                  empresa={snapshot.empresa}
                  produtos={snapshot.produtos}
                  comandas={snapshot.comandas}
                  clientes={snapshot.clientes}
                  permitirEstoqueNegativo={permitirEstoqueNegativo}
                  onIrAba={(aba) => setAbaAtiva(aba as AbaAtiva)}
                  onNotify={notify}
                  onAtualizar={() => carregarDados(sessao)}
                />
              )}

              {abaAtiva === 'comandas' && (
                <ComandasTab
                  sessao={sessao}
                  empresa={snapshot.empresa}
                  comandas={snapshot.comandas}
                  produtos={snapshot.produtos}
                  clientes={snapshot.clientes}
                  caixa={snapshot.caixa}
                  permitirEstoqueNegativo={permitirEstoqueNegativo}
                  onNotify={notify}
                  onAtualizar={() => carregarDados(sessao)}
                />
              )}

              {abaAtiva === 'delivery' && (
                <DeliveryTab
                  sessao={sessao}
                  pedidos={snapshot.delivery}
                  produtos={snapshot.produtos}
                  clientes={snapshot.clientes}
                  permitirEstoqueNegativo={permitirEstoqueNegativo}
                  onNotify={notify}
                  onAtualizar={() => carregarDados(sessao)}
                />
              )}

              {abaAtiva === 'dashboard' && !isOperador && (
                <DashboardTab
                  snapshot={snapshot}
                  podeVerFinanceiro={!isOperador}
                  onIrAba={(aba) => setAbaAtiva(aba as AbaAtiva)}
                  onIrParaObrigacoes={() => {
                    setFinanceiroSubAba('pagar');
                    setFinanceiroNavTick((n) => n + 1);
                    setAbaAtiva('financeiro');
                  }}
                  onAbrirModalFiscal={() => {
                    setAbrirFiscalAoEntrar(true);
                    setAbaAtiva('central');
                  }}
                />
              )}

              {abaAtiva === 'estoque' && (
                <EstoqueTab
                  sessao={sessao}
                  produtos={snapshot.produtos}
                  compras={snapshot.compras || []}
                  podeEditar={!isOperador}
                  abrirCompraAoEntrar={abrirCompraAoEntrar}
                  onConsumirAbrirCompra={() => setAbrirCompraAoEntrar(false)}
                  onNotify={notify}
                  onAtualizar={() => carregarDados(sessao)}
                />
              )}

              {abaAtiva === 'financeiro' && !isOperador && (
                <FinanceiroTab
                  sessao={sessao}
                  snapshot={snapshot}
                  subAbaInicial={financeiroSubAba}
                  subAbaNavTick={financeiroNavTick}
                  onNotify={notify}
                  onAtualizar={() => carregarDados(sessao)}
                />
              )}

              {abaAtiva === 'clientes' && !isOperador && (
                <ClientesTab
                  sessao={sessao}
                  snapshot={snapshot}
                  onNotify={notify}
                  onAtualizar={() => carregarDados(sessao)}
                  onIrParaFiados={() => {
                    setFinanceiroSubAba('receber');
                    setFinanceiroNavTick((n) => n + 1);
                    setAbaAtiva('financeiro');
                  }}
                />
              )}

              {abaAtiva === 'equipe' && !isOperador && (
                <EquipeTab
                  sessao={sessao}
                  usuarios={snapshot.usuarios}
                  onNotify={notify}
                  onAtualizar={() => carregarDados(sessao)}
                />
              )}

              {abaAtiva === 'central' && (
                <CentralOperacionalTab
                  sessao={sessao}
                  snapshot={snapshot}
                  podeVerGestao={!isOperador}
                  statusSync={statusSync}
                  abrirFiscalAoEntrar={abrirFiscalAoEntrar}
                  onLimparAbrirFiscal={() => setAbrirFiscalAoEntrar(false)}
                  onIrAba={(aba) => setAbaAtiva(aba as AbaAtiva)}
                  onAbrirCompra={() => {
                    setAbrirCompraAoEntrar(true);
                    setAbaAtiva('estoque');
                  }}
                  onRecalcularEstoque={handleRecalcularEstoqueCentral}
                  onGerarPacoteRelatorios={() => void handleGerarPacoteCentral()}
                  onFazerBackupLocal={handleBackupLocalCentral}
                  onSincronizarDrive={handleSincronizarDriveCentral}
                  onNotify={notify}
                  onAtualizar={() => carregarDados(sessao)}
                />
              )}

              {abaAtiva === 'relatorios' && !isOperador && (
                <RelatoriosTab snapshot={snapshot} statusSync={statusSync} onNotify={notify} />
              )}

              {abaAtiva === 'config' && isDonoOuAdmin && (
                <ConfigTab
                  sessao={sessao}
                  snapshot={snapshot}
                  statusSync={statusSync}
                  onNotify={notify}
                  onRefreshSyncStatus={() => atualizarStatusSync(sessao)}
                  onUnidadesAtualizadas={handleUnidadesAtualizadas}
                  onAtualizarDados={() => carregarDados(sessao)}
                />
              )}
            </>
          )}
        </main>
      </div>

      {modalSairAberto && (
        <div className="modal-overlay no-print">
          <div className="panel-card" style={{ maxWidth: 440, width: '100%', borderColor: 'var(--border-accent)' }}>
            <h3 style={{ fontSize: 17, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
              {isOperador ? <Lock size={18} color="#fbbf24" /> : <LogOut size={18} color="#f87171" />}
              <span>{isOperador ? 'Conferência de Caixa Pendente?' : 'Encerrar Sessão'}</span>
            </h3>
            <p style={{ fontSize: 13.5, color: '#cbd5e1', lineHeight: 1.5, marginBottom: 18 }}>
              {isOperador ? (
                <>
                  Atenção Operador: você já realizou a <strong>Conferência do seu Caixa / Turno</strong> antes de deslogar?
                  <br />
                  <br />
                  Caso saia sem conferência registrada hoje, a gerência será notificada automaticamente.
                </>
              ) : (
                <>
                  Deseja realmente encerrar sua sessão na unidade <strong>{nomeUnidadeAtiva}</strong>?
                </>
              )}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
              {isOperador ? (
                <>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      setModalSairAberto(false);
                      setAbaAtiva('central');
                    }}
                    disabled={saindo}
                  >
                    Voltar à Conferência
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => void handleConfirmarSaida()}
                    disabled={saindo}
                  >
                    {saindo ? 'Saindo...' : 'Sim, já conferi e quero Sair'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setModalSairAberto(false)}
                    disabled={saindo}
                  >
                    Permanecer Conectado
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => void handleConfirmarSaida()}
                    disabled={saindo}
                  >
                    {saindo ? 'Saindo...' : 'Sair Agora'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="toast-stack no-print">
        {toasts.map((t) => (
          <div key={t.id} className={`toast-item ${t.tipo}`}>
            {t.texto}
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
