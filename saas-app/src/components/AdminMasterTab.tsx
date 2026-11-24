import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Building2,
  CheckCircle2,
  Clock,
  Crown,
  Eye,
  LogIn,
  Receipt,
  RefreshCw,
  Save,
  Search,
  Shield,
  ShieldAlert,
  UserPlus,
  Users,
  WifiOff,
  X,
  XCircle
} from 'lucide-react';
import {
  alternarStatusUsuario,
  analisarComprovanteSaasAdmin,
  atualizarLicencaEmpresaAdmin,
  criarEmpresaPeloAdmin,
  criarUsuarioEquipe,
  derrubarSessoesUsuarioAdmin,
  editarUsuarioEquipe,
  obterDadosMasterSaasAdmin,
  registrarFaturaSaasAdmin,
  salvarConfigMasterSaasAdmin,
  salvarMeuPerfilAdmin,
  solicitarCodigoSuporteAdmin
} from '../services/dataRepository';
import type {
  ComprovantePagamentoSaas,
  ConfigMasterSaas,
  Empresa,
  MasterSaasSnapshot,
  PerfilUsuario,
  PlanoSaas,
  SessaoAtiva,
  StatusAssinatura,
  Usuario
} from '../types/domain';
import { formatarDataBr, formatarMoeda } from '../utils/formatters';

interface AdminMasterTabProps {
  sessao: SessaoAtiva;
  onNotify: (msg: string, tipo?: 'success' | 'error' | 'info' | 'warning') => void;
  onSessaoAtualizada: (novaSessao: SessaoAtiva) => void;
  onAcessarUnidadeSuporte: (empresa: Empresa) => Promise<void>;
}

type SubAbaMaster = 'licencas' | 'usuarios' | 'pagamentos' | 'perfil';

function addDiasIso(baseYmd: string | undefined, dias: number): string {
  const hoje = new Date();
  const base = baseYmd ? new Date(baseYmd) : hoje;
  const ref = !Number.isNaN(base.getTime()) && base > hoje ? base : hoje;
  return new Date(ref.getTime() + dias * 86400000).toISOString().slice(0, 10);
}

export function AdminMasterTab({
  sessao,
  onNotify,
  onSessaoAtualizada,
  onAcessarUnidadeSuporte
}: AdminMasterTabProps) {
  const [subAba, setSubAba] = useState<SubAbaMaster>('licencas');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dados, setDados] = useState<MasterSaasSnapshot | null>(null);

  // Filtros Licenças
  const [buscaEmp, setBuscaEmp] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<string>('TODOS');

  // Modal Editar Licença
  const [empEditando, setEmpEditando] = useState<Empresa | null>(null);
  const [editPlano, setEditPlano] = useState<PlanoSaas>('PRO');
  const [editStatus, setEditStatus] = useState<StatusAssinatura>('ATIVO');
  const [editValidoAte, setEditValidoAte] = useState('');

  // Modal Nova Empresa
  const [modalNovaEmp, setModalNovaEmp] = useState(false);
  const [novaEmpNome, setNovaEmpNome] = useState('');
  const [novaEmpDono, setNovaEmpDono] = useState('');
  const [novaEmpCnpj, setNovaEmpCnpj] = useState('');
  const [novaEmpTel, setNovaEmpTel] = useState('');
  const [novaEmpCidade, setNovaEmpCidade] = useState('');
  const [novaEmpPlano, setNovaEmpPlano] = useState<PlanoSaas>('PRO');
  const [novaEmpStatus, setNovaEmpStatus] = useState<StatusAssinatura>('ATIVO');
  const [novaEmpValidoAte, setNovaEmpValidoAte] = useState('');
  const [novaEmpUser, setNovaEmpUser] = useState('');
  const [novaEmpEmail, setNovaEmpEmail] = useState('');
  const [novaEmpSenha, setNovaEmpSenha] = useState('');

  // Modal Confirmação de Suporte Técnico (Código enviado ao Dono)
  const [suporteAlvo, setSuporteAlvo] = useState<Empresa | null>(null);
  const [suporteCodigoEsperado, setSuporteCodigoEsperado] = useState('');
  const [suporteExpiraEm, setSuporteExpiraEm] = useState(0);
  const [suporteCodigoDigitado, setSuporteCodigoDigitado] = useState('');

  // Filtros Usuários Globais
  const [buscaUsr, setBuscaUsr] = useState('');
  const [filtroEmpUsr, setFiltroEmpUsr] = useState('');
  const [modalNovoUsr, setModalNovoUsr] = useState(false);
  const [novoUsrEmpId, setNovoUsrEmpId] = useState('');
  const [novoUsrUsername, setNovoUsrUsername] = useState('');
  const [novoUsrNome, setNovoUsrNome] = useState('');
  const [novoUsrEmail, setNovoUsrEmail] = useState('');
  const [novoUsrPerfil, setNovoUsrPerfil] = useState<PerfilUsuario>('DONO');
  const [novoUsrSenha, setNovoUsrSenha] = useState('');

  const [usrEditando, setUsrEditando] = useState<Usuario | null>(null);
  const [editUsrNome, setEditUsrNome] = useState('');
  const [editUsrUsername, setEditUsrUsername] = useState('');
  const [editUsrEmail, setEditUsrEmail] = useState('');
  const [editUsrPerfil, setEditUsrPerfil] = useState<PerfilUsuario>('DONO');
  const [editUsrSenha, setEditUsrSenha] = useState('');

  // Pagamentos & Comprovantes
  const [filtroComprovante, setFiltroComprovante] = useState<'TODOS' | 'PENDENTE' | 'APROVADO' | 'RECUSADO'>('TODOS');
  const [comprovanteAnexoModal, setComprovanteAnexoModal] = useState<ComprovantePagamentoSaas | null>(null);

  const [fatEmpId, setFatEmpId] = useState('');
  const [fatValor, setFatValor] = useState('169');
  const [fatForma, setFatForma] = useState('PIX');
  const [fatRef, setFatRef] = useState(new Date().toISOString().slice(0, 7));
  const [fatRenovar30, setFatRenovar30] = useState(true);

  // Meu Perfil Admin + Config SaaS
  const [admUsername, setAdmUsername] = useState(sessao.usuario.username || '');
  const [admNome, setAdmNome] = useState(sessao.usuario.nome || '');
  const [admEmail, setAdmEmail] = useState(sessao.usuario.email || '');
  const [admSenha, setAdmSenha] = useState('');
  const [cfgMaster, setCfgMaster] = useState<ConfigMasterSaas>({
    valor_start: 89,
    valor_pro: 169,
    valor_enterprise: 269,
    chave_pix_admin: '',
    whatsapp_suporte: '',
    telegram_bot_token_admin: '',
    telegram_chat_id_admin: '',
    versao_minima: '2.0.0',
    link_atualizacao: '',
    link_checkout_pix: '',
    formas_pagamento_ativas: ['PIX', 'Cartão', 'Boleto', 'Transferência'],
    instrucoes_pagamento: ''
  });

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await obterDadosMasterSaasAdmin(sessao);
      setDados(snap);
      setCfgMaster(snap.configMaster);
      if (!fatEmpId && snap.empresas.length > 0) setFatEmpId(snap.empresas[0].id);
      if (!novoUsrEmpId && snap.empresas.length > 0) setNovoUsrEmpId(snap.empresas[0].id);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Erro ao carregar Master SaaS.', 'error');
    } finally {
      setLoading(false);
    }
  }, [sessao, onNotify, fatEmpId, novoUsrEmpId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const kpis = useMemo(() => {
    const emps = dados?.empresas || [];
    const cfg = dados?.configMaster || cfgMaster;
    let ativas = 0;
    let trial = 0;
    let bloqueadas = 0;
    let vencendo7d = 0;
    let mrr = 0;
    const agora = Date.now();

    for (const e of emps) {
      const st = String(e.status_assinatura || 'TRIAL').toUpperCase();
      if (st === 'ATIVO') {
        ativas += 1;
        mrr += e.plano === 'ENTERPRISE' ? cfg.valor_enterprise : e.plano === 'PRO' ? cfg.valor_pro : cfg.valor_start;
      } else if (st === 'TRIAL') {
        trial += 1;
      } else if (st === 'BLOQUEADO' || st === 'INADIMPLENTE') {
        bloqueadas += 1;
      }
      if (e.valido_ate) {
        const diff = (new Date(e.valido_ate).getTime() - agora) / 86400000;
        if (diff >= -1 && diff <= 7) vencendo7d += 1;
      }
    }
    return {
      total: emps.length,
      ativas,
      trial,
      bloqueadas,
      vencendo7d,
      mrr,
      usuariosTotal: (dados?.usuarios || []).length
    };
  }, [dados, cfgMaster]);

  const empresasFiltradas = useMemo(() => {
    const q = buscaEmp.trim().toLowerCase();
    return (dados?.empresas || []).filter((e) => {
      if (filtroStatus !== 'TODOS' && String(e.status_assinatura || '').toUpperCase() !== filtroStatus) {
        return false;
      }
      if (!q) return true;
      return (
        String(e.nome || '').toLowerCase().includes(q) ||
        String(e.dono_nome || '').toLowerCase().includes(q) ||
        String(e.cnpj || '').toLowerCase().includes(q) ||
        String(e.id || '').toLowerCase().includes(q)
      );
    });
  }, [dados, buscaEmp, filtroStatus]);

  const usuariosFiltrados = useMemo(() => {
    if (!filtroEmpUsr) return [];
    const q = buscaUsr.trim().toLowerCase();
    return (dados?.usuarios || []).filter((u) => {
      if (filtroEmpUsr === '__ADMIN__') {
        if (u.perfil !== 'ADMIN') return false;
      } else if (u.empresa_id !== filtroEmpUsr || u.perfil === 'ADMIN') {
        return false;
      }
      if (!q) return true;
      return (
        String(u.nome || '').toLowerCase().includes(q) ||
        String(u.username || '').toLowerCase().includes(q) ||
        String(u.email || '').toLowerCase().includes(q)
      );
    });
  }, [dados, buscaUsr, filtroEmpUsr]);

  const mapaEmpresas = useMemo(() => {
    const m = new Map<string, Empresa>();
    for (const e of dados?.empresas || []) m.set(e.id, e);
    return m;
  }, [dados]);

  async function handleRenovarRapido(emp: Empresa, dias: number, novoStatus: StatusAssinatura = 'ATIVO') {
    setBusy(true);
    try {
      const novaData = addDiasIso(emp.valido_ate, dias);
      const res = await atualizarLicencaEmpresaAdmin(sessao, emp.id, {
        plano: emp.plano,
        status_assinatura: novoStatus,
        valido_ate: novaData
      });
      onNotify(res.msg, res.ok ? 'success' : 'error');
      if (res.ok) await carregar();
    } finally {
      setBusy(false);
    }
  }

  async function handleAlternarBloqueioEmp(emp: Empresa) {
    const atual = String(emp.status_assinatura || 'ATIVO').toUpperCase();
    const prox: StatusAssinatura = atual === 'BLOQUEADO' ? 'ATIVO' : 'BLOQUEADO';
    setBusy(true);
    try {
      const res = await atualizarLicencaEmpresaAdmin(sessao, emp.id, {
        plano: emp.plano,
        status_assinatura: prox,
        valido_ate: emp.valido_ate
      });
      onNotify(res.msg, res.ok ? 'success' : 'error');
      if (res.ok) await carregar();
    } finally {
      setBusy(false);
    }
  }

  async function handleIniciarSuporte(emp: Empresa) {
    setBusy(true);
    try {
      const res = await solicitarCodigoSuporteAdmin(sessao, emp);
      onNotify(res.msg, res.ok ? 'info' : 'error');
      if (res.ok && res.codigo) {
        setSuporteAlvo(emp);
        setSuporteCodigoEsperado(res.codigo);
        setSuporteExpiraEm(res.expiraEm || Date.now() + 5 * 60 * 1000);
        setSuporteCodigoDigitado('');
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmarCodigoSuporte(e: FormEvent) {
    e.preventDefault();
    if (!suporteAlvo) return;
    if (Date.now() > suporteExpiraEm) {
      onNotify('Código expirado. Solicite um reenvio ao Dono.', 'warning');
      return;
    }
    if (suporteCodigoDigitado.trim() !== suporteCodigoEsperado) {
      onNotify('Código de autorização inválido. Acesso não liberado.', 'error');
      return;
    }
    const alvo = suporteAlvo;
    setSuporteAlvo(null);
    setSuporteCodigoEsperado('');
    setSuporteCodigoDigitado('');
    await onAcessarUnidadeSuporte(alvo);
  }

  async function handleSalvarLicencaModal(e: FormEvent) {
    e.preventDefault();
    if (!empEditando) return;
    setBusy(true);
    try {
      const res = await atualizarLicencaEmpresaAdmin(sessao, empEditando.id, {
        plano: editPlano,
        status_assinatura: editStatus,
        valido_ate: editValidoAte || undefined
      });
      onNotify(res.msg, res.ok ? 'success' : 'error');
      if (res.ok) {
        setEmpEditando(null);
        await carregar();
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleCriarEmpresaMaster(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await criarEmpresaPeloAdmin(sessao, {
        nomeEmpresa: novaEmpNome,
        donoNome: novaEmpDono,
        cnpj: novaEmpCnpj,
        telefone: novaEmpTel,
        cidade: novaEmpCidade,
        plano: novaEmpPlano,
        statusAssinatura: novaEmpStatus,
        validoAte: novaEmpValidoAte || undefined,
        usernameDono: novaEmpUser,
        emailDono: novaEmpEmail,
        senhaDono: novaEmpSenha
      });
      onNotify(res.msg, res.ok ? 'success' : 'error');
      if (res.ok) {
        setModalNovaEmp(false);
        setNovaEmpNome('');
        setNovaEmpDono('');
        setNovaEmpCnpj('');
        setNovaEmpTel('');
        setNovaEmpCidade('');
        setNovaEmpValidoAte('');
        setNovaEmpUser('');
        setNovaEmpEmail('');
        setNovaEmpSenha('');
        await carregar();
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleCriarUsuarioGlobal(e: FormEvent) {
    e.preventDefault();
    if (!novoUsrEmpId || !novoUsrUsername.trim() || !novoUsrNome.trim() || novoUsrSenha.length < 4) {
      onNotify('Preencha empresa, login, nome e senha (mínimo 4 caracteres).', 'warning');
      return;
    }
    setBusy(true);
    try {
      const empAlvo = mapaEmpresas.get(novoUsrEmpId);
      const sessaoAlvo: SessaoAtiva = {
        ...sessao,
        unidadeAtivaId: novoUsrEmpId,
        empresa: empAlvo || sessao.empresa
      };
      const res = await criarUsuarioEquipe(sessaoAlvo, {
        username: novoUsrUsername,
        nome: novoUsrNome,
        email: novoUsrEmail,
        perfil: novoUsrPerfil,
        senha: novoUsrSenha
      });
      onNotify(res.msg, res.ok ? 'success' : 'error');
      if (res.ok) {
        setModalNovoUsr(false);
        setNovoUsrUsername('');
        setNovoUsrNome('');
        setNovoUsrEmail('');
        setNovoUsrSenha('');
        await carregar();
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleSalvarEdicaoUsuario(e: FormEvent) {
    e.preventDefault();
    if (!usrEditando) return;
    setBusy(true);
    try {
      const empAlvo = mapaEmpresas.get(usrEditando.empresa_id);
      const sessaoAlvo: SessaoAtiva = {
        ...sessao,
        unidadeAtivaId: usrEditando.empresa_id,
        empresa: empAlvo || sessao.empresa
      };
      const res = await editarUsuarioEquipe(sessaoAlvo, usrEditando, {
        username: editUsrUsername,
        nome: editUsrNome,
        email: editUsrEmail,
        perfil: editUsrPerfil,
        ativo: usrEditando.ativo,
        novaSenha: editUsrSenha.trim() || undefined
      });
      onNotify(res.msg, res.ok ? 'success' : 'error');
      if (res.ok) {
        setUsrEditando(null);
        setEditUsrSenha('');
        await carregar();
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleAnalisarComprovante(
    comp: ComprovantePagamentoSaas,
    aprovar: boolean,
    renovarDias = 30
  ) {
    let motivoRecusa: string | undefined;
    if (!aprovar) {
      const motivo = window.prompt(`Motivo da recusa do comprovante de ${comp.empresa_nome} (opcional):`) ?? '';
      motivoRecusa = motivo.trim() || undefined;
    }
    setBusy(true);
    try {
      const res = await analisarComprovanteSaasAdmin(sessao, comp.id, aprovar, {
        renovarDias,
        motivoRecusa
      });
      onNotify(res.msg, res.ok ? 'success' : 'error');
      if (res.ok) await carregar();
    } finally {
      setBusy(false);
    }
  }

  async function handleRegistrarFatura(e: FormEvent) {
    e.preventDefault();
    const empAlvo = mapaEmpresas.get(fatEmpId);
    if (!empAlvo) {
      onNotify('Selecione uma empresa.', 'warning');
      return;
    }
    setBusy(true);
    try {
      const res = await registrarFaturaSaasAdmin(
        sessao,
        {
          empresa_id: empAlvo.id,
          empresa_nome: empAlvo.nome,
          plano: empAlvo.plano,
          valor: Number(fatValor.replace(',', '.')) || 0,
          data_pagamento: new Date().toISOString().slice(0, 10),
          forma: fatForma,
          referencia: fatRef
        },
        fatRenovar30 ? 30 : 0
      );
      onNotify(res.msg, res.ok ? 'success' : 'error');
      if (res.ok) {
        const [anoStr, mesStr] = fatRef.split('-');
        const ano = Number(anoStr);
        const mes = Number(mesStr);
        if (ano > 0 && mes >= 1 && mes <= 12) {
          const proxAno = mes === 12 ? ano + 1 : ano;
          const proxMes = mes === 12 ? 1 : mes + 1;
          setFatRef(`${proxAno}-${String(proxMes).padStart(2, '0')}`);
        }
        await carregar();
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleSalvarPerfilAdmin(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await salvarMeuPerfilAdmin(sessao, {
        username: admUsername,
        nome: admNome,
        email: admEmail,
        novaSenha: admSenha.trim() || undefined
      });
      onNotify(res.msg, res.ok ? 'success' : 'error');
      if (res.ok && res.sessaoAtualizada) {
        setAdmSenha('');
        onSessaoAtualizada(res.sessaoAtualizada);
        await carregar();
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleSalvarConfigMaster(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await salvarConfigMasterSaasAdmin(sessao, cfgMaster);
      onNotify(res.msg, res.ok ? 'success' : 'error');
      if (res.ok) await carregar();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="panel-card" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 19, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Crown size={20} color="#fbbf24" />
            <span>Master SaaS — Licenças, Usuários &amp; Receita</span>
          </h2>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Painel exclusivo do Administrador da plataforma ({sessao.usuario.username})
          </div>
        </div>
        <button type="button" className="btn" onClick={() => void carregar()} disabled={loading || busy}>
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      {/* KPIs */}
      <div className="kpi-grid">
        <div className="kpi-card kpi-left-info">
          <div className="kpi-label">🏢 Empresas Totais</div>
          <div className="kpi-value">{kpis.total}</div>
        </div>
        <div className="kpi-card kpi-left-ok">
          <div className="kpi-label">✅ Licenças Ativas / Trial</div>
          <div className="kpi-value" style={{ color: '#34d399' }}>
            {kpis.ativas} <span style={{ fontSize: 12, color: '#fbbf24' }}>({kpis.trial} trial)</span>
          </div>
        </div>
        <div className="kpi-card kpi-left-warn">
          <div className="kpi-label">⏳ Vencendo (7d) / Bloq.</div>
          <div className="kpi-value" style={{ color: '#fbbf24' }}>
            {kpis.vencendo7d} <span style={{ fontSize: 12, color: '#f87171' }}>({kpis.bloqueadas} bloq.)</span>
          </div>
        </div>
        <div className="kpi-card kpi-left-ok">
          <div className="kpi-label">💰 MRR Estimado ({kpis.usuariosTotal} users)</div>
          <div className="kpi-value" style={{ color: '#38bdf8' }}>
            {formatarMoeda(kpis.mrr)}
          </div>
        </div>
      </div>

      {/* Sub-abas */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button type="button" className={`btn ${subAba === 'licencas' ? 'btn-primary' : ''}`} onClick={() => setSubAba('licencas')}>
          <Building2 size={15} /> Licenças &amp; Empresas ({kpis.total})
        </button>
        <button type="button" className={`btn ${subAba === 'usuarios' ? 'btn-primary' : ''}`} onClick={() => setSubAba('usuarios')}>
          <Users size={15} /> Usuários Globais ({kpis.usuariosTotal})
        </button>
        <button type="button" className={`btn ${subAba === 'pagamentos' ? 'btn-primary' : ''}`} onClick={() => setSubAba('pagamentos')}>
          <Receipt size={15} /> Pagamentos &amp; Comprovantes
          {(dados?.comprovantes || []).filter((c) => c.status === 'PENDENTE').length > 0 && (
            <span style={{ marginLeft: 4, padding: '1px 6px', borderRadius: 999, background: '#f59e0b', color: '#0f172a', fontSize: 11, fontWeight: 800 }}>
              {(dados?.comprovantes || []).filter((c) => c.status === 'PENDENTE').length}
            </span>
          )}
        </button>
        <button type="button" className={`btn ${subAba === 'perfil' ? 'btn-primary' : ''}`} onClick={() => setSubAba('perfil')}>
          <Shield size={15} /> Meu Perfil Admin &amp; Config SaaS
        </button>
      </div>

      {/* SUB-ABA 1: LICENÇAS & EMPRESAS */}
      {subAba === 'licencas' && (
        <div className="panel-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {['TODOS', 'ATIVO', 'TRIAL', 'INADIMPLENTE', 'BLOQUEADO'].map((st) => (
                <button
                  key={st}
                  type="button"
                  className={`btn btn-xs ${filtroStatus === st ? 'btn-primary' : ''}`}
                  onClick={() => setFiltroStatus(st)}
                >
                  {st}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', minWidth: 220 }}>
                <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  className="field-input"
                  style={{ paddingLeft: 32 }}
                  placeholder="Buscar empresa, dono, CNPJ..."
                  value={buscaEmp}
                  onChange={(e) => setBuscaEmp(e.target.value)}
                />
              </div>
              <button type="button" className="btn btn-primary" onClick={() => setModalNovaEmp(true)}>
                <Building2 size={14} /> + Nova Empresa
              </button>
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Empresa / Tipo</th>
                  <th>Dono / Contato</th>
                  <th>Plano</th>
                  <th>Status</th>
                  <th>Validade</th>
                  <th style={{ textAlign: 'right' }}>Ações Rápidas</th>
                </tr>
              </thead>
              <tbody>
                {empresasFiltradas.map((emp) => {
                  const st = String(emp.status_assinatura || 'TRIAL').toUpperCase();
                  const bloq = st === 'BLOQUEADO';
                  return (
                    <tr key={emp.id}>
                      <td>
                        <div style={{ fontWeight: 700 }}>{emp.nome}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {emp.tipo} • <code>{emp.id}</code>
                        </div>
                      </td>
                      <td style={{ fontSize: 12 }}>
                        <div>{emp.dono_nome || '-'}</div>
                        <div style={{ color: 'var(--text-muted)' }}>{emp.telefone || emp.cnpj || '-'}</div>
                      </td>
                      <td>
                        <span className="badge badge-purple">{emp.plano || 'PRO'}</span>
                      </td>
                      <td>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 700,
                            background:
                              st === 'ATIVO'
                                ? 'rgba(16,185,129,0.18)'
                                : st === 'TRIAL'
                                ? 'rgba(56,189,248,0.18)'
                                : 'rgba(239,68,68,0.18)',
                            color: st === 'ATIVO' ? '#34d399' : st === 'TRIAL' ? '#38bdf8' : '#f87171'
                          }}
                        >
                          {st}
                        </span>
                      </td>
                      <td style={{ fontSize: 12.5 }}>
                        {emp.valido_ate ? formatarDataBr(emp.valido_ate) : 'Sem limite'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          <button type="button" className="btn btn-xs" disabled={busy} onClick={() => void handleRenovarRapido(emp, 30)}>
                            +30d
                          </button>
                          <button type="button" className="btn btn-xs" disabled={busy} onClick={() => void handleRenovarRapido(emp, 365)}>
                            +1 Ano
                          </button>
                          <button
                            type="button"
                            className="btn btn-xs btn-primary"
                            onClick={() => {
                              setEmpEditando(emp);
                              setEditPlano(emp.plano || 'PRO');
                              setEditStatus((emp.status_assinatura as StatusAssinatura) || 'ATIVO');
                              setEditValidoAte((emp.valido_ate || '').slice(0, 10));
                            }}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className={`btn btn-xs ${bloq ? 'btn-success' : 'btn-danger'}`}
                            disabled={busy}
                            onClick={() => void handleAlternarBloqueioEmp(emp)}
                          >
                            {bloq ? 'Ativar' : 'Bloquear'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-xs"
                            disabled={busy}
                            title="Entrar na unidade como Suporte (exige confirmação do Dono)"
                            onClick={() => void handleIniciarSuporte(emp)}
                          >
                            <LogIn size={12} /> Suporte
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-ABA 2: USUÁRIOS GLOBAIS */}
      {subAba === 'usuarios' && (
        <div className="panel-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <select
                className="field-select"
                value={filtroEmpUsr}
                onChange={(e) => setFiltroEmpUsr(e.target.value)}
                style={{ minWidth: 250 }}
              >
                <option value="">-- Selecione uma empresa --</option>
                <option value="__ADMIN__">🛡️ Administrador Técnico (Sistema)</option>
                {(dados?.empresas || []).map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome}
                  </option>
                ))}
              </select>
              <div style={{ position: 'relative', minWidth: 220 }}>
                <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  className="field-input"
                  style={{ paddingLeft: 32 }}
                  placeholder="Buscar usuário, login..."
                  value={buscaUsr}
                  onChange={(e) => setBuscaUsr(e.target.value)}
                />
              </div>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => setModalNovoUsr(true)}>
              <UserPlus size={15} /> Novo Usuário Global
            </button>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Usuário / Login</th>
                  <th>Empresa</th>
                  <th>Perfil</th>
                  <th>Sessões</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {!filtroEmpUsr ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 28, color: 'var(--text-muted)' }}>
                      Selecione uma empresa acima para visualizar e gerenciar os usuários dela.
                    </td>
                  </tr>
                ) : usuariosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                      Nenhum usuário encontrado para esta seleção.
                    </td>
                  </tr>
                ) : (
                usuariosFiltrados.map((u) => {
                  const empU = mapaEmpresas.get(u.empresa_id);
                  const sessCount = dados?.sessoesPorUsuario[u.id] || 0;
                  return (
                    <tr key={u.id}>
                      <td>
                        <div style={{ fontWeight: 700 }}>{u.nome}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                          @{u.username} {u.email ? `• ${u.email}` : ''}
                        </div>
                      </td>
                      <td style={{ fontSize: 12 }}>{empU?.nome || u.empresa_id}</td>
                      <td>
                        <span className="badge badge-purple">{u.perfil}</span>
                      </td>
                      <td style={{ fontSize: 12 }}>{sessCount > 0 ? `🟢 ${sessCount} ativa(s)` : 'Offline'}</td>
                      <td>
                        <span style={{ fontSize: 12, fontWeight: 700, color: u.ativo ? '#34d399' : '#f87171' }}>
                          {u.ativo ? 'ATIVO' : 'INATIVO'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="btn btn-xs"
                            onClick={() => {
                              setUsrEditando(u);
                              setEditUsrNome(u.nome);
                              setEditUsrUsername(u.username);
                              setEditUsrEmail(u.email || '');
                              setEditUsrPerfil(u.perfil);
                              setEditUsrSenha('');
                            }}
                          >
                            Editar / Senha
                          </button>
                          {u.perfil !== 'ADMIN' && (
                            <button
                              type="button"
                              className={`btn btn-xs ${u.ativo ? 'btn-danger' : 'btn-success'}`}
                              disabled={busy}
                              onClick={async () => {
                                setBusy(true);
                                try {
                                  const res = await alternarStatusUsuario(sessao, u);
                                  onNotify(res.msg, res.ok ? 'success' : 'error');
                                  if (res.ok) await carregar();
                                } finally {
                                  setBusy(false);
                                }
                              }}
                            >
                              {u.ativo ? 'Bloquear' : 'Ativar'}
                            </button>
                          )}
                          {sessCount > 0 && (
                            <button
                              type="button"
                              className="btn btn-xs"
                              title="Derrubar sessões ativas"
                              disabled={busy}
                              onClick={async () => {
                                setBusy(true);
                                try {
                                  const res = await derrubarSessoesUsuarioAdmin(sessao, u.id);
                                  onNotify(res.msg, res.ok ? 'success' : 'error');
                                  if (res.ok) await carregar();
                                } finally {
                                  setBusy(false);
                                }
                              }}
                            >
                              <WifiOff size={12} /> Desconectar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-ABA 3: PAGAMENTOS & COMPROVANTES */}
      {subAba === 'pagamentos' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
          <div className="panel-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <h3 style={{ fontSize: 16, display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                <Receipt size={17} color="#38bdf8" /> Comprovantes Enviados pelas Empresas
              </h3>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {(['TODOS', 'PENDENTE', 'APROVADO', 'RECUSADO'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    className={`btn btn-xs ${filtroComprovante === st ? 'btn-primary' : ''}`}
                    onClick={() => setFiltroComprovante(st)}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            <div className="table-wrap" style={{ maxHeight: 420, overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Empresa / Pgto</th>
                    <th>Valor / Ref.</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {(dados?.comprovantes || [])
                    .filter((c) => filtroComprovante === 'TODOS' || c.status === filtroComprovante)
                    .map((comp) => (
                      <tr key={comp.id}>
                        <td style={{ fontSize: 12 }}>
                          <strong>{comp.empresa_nome}</strong>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {comp.forma} • {formatarDataBr(comp.criado_em)}
                          </div>
                          {comp.observacao && (
                            <div style={{ fontSize: 11, color: '#cbd5e1' }}>{comp.observacao}</div>
                          )}
                          {comp.motivo_recusa && (
                            <div style={{ fontSize: 11, color: '#f87171' }}>Recusa: {comp.motivo_recusa}</div>
                          )}
                        </td>
                        <td style={{ fontSize: 12 }}>
                          <strong style={{ color: '#34d399' }}>{formatarMoeda(comp.valor)}</strong>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{comp.referencia}</div>
                        </td>
                        <td>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '2px 8px',
                              borderRadius: 999,
                              fontSize: 11,
                              fontWeight: 700,
                              background:
                                comp.status === 'APROVADO'
                                  ? 'rgba(16,185,129,0.18)'
                                  : comp.status === 'RECUSADO'
                                  ? 'rgba(239,68,68,0.18)'
                                  : 'rgba(245,158,11,0.18)',
                              color:
                                comp.status === 'APROVADO'
                                  ? '#34d399'
                                  : comp.status === 'RECUSADO'
                                  ? '#f87171'
                                  : '#fbbf24'
                            }}
                          >
                            {comp.status === 'APROVADO' ? (
                              <CheckCircle2 size={11} />
                            ) : comp.status === 'RECUSADO' ? (
                              <XCircle size={11} />
                            ) : (
                              <Clock size={11} />
                            )}
                            {comp.status}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            {comp.anexo_data_url && (
                              <button
                                type="button"
                                className="btn btn-xs"
                                title="Visualizar comprovante anexado"
                                onClick={() => setComprovanteAnexoModal(comp)}
                              >
                                <Eye size={12} /> Ver
                              </button>
                            )}
                            {comp.status === 'PENDENTE' && (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-xs btn-success"
                                  disabled={busy}
                                  title="Aprovar pagamento e liberar empresa (+30 dias)"
                                  onClick={() => void handleAnalisarComprovante(comp, true, 30)}
                                >
                                  Aprovar (+30d)
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-xs btn-primary"
                                  disabled={busy}
                                  title="Aprovar pagamento e liberar sem vencimento"
                                  onClick={() => void handleAnalisarComprovante(comp, true, 0)}
                                >
                                  Liberar
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-xs btn-danger"
                                  disabled={busy}
                                  onClick={() => void handleAnalisarComprovante(comp, false)}
                                >
                                  Recusar
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  {(dados?.comprovantes || []).filter((c) => filtroComprovante === 'TODOS' || c.status === filtroComprovante).length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12.5 }}>
                        Nenhum comprovante encontrado nesta fila.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h3 style={{ fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Receipt size={17} color="#34d399" /> Registrar Mensalidade Recebida (SaaS)
            </h3>
            <form style={{ display: 'flex', flexDirection: 'column', gap: 10 }} onSubmit={handleRegistrarFatura}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px', gap: 8 }}>
                <div>
                  <label className="field-label">Empresa</label>
                  <select className="field-select" value={fatEmpId} onChange={(e) => setFatEmpId(e.target.value)}>
                    {(dados?.empresas || []).map((e) => (
                      <option key={e.id} value={e.id}>{e.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-label">Valor (R$)</label>
                  <input className="field-input" value={fatValor} onChange={(e) => setFatValor(e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label className="field-label">Forma</label>
                  <select className="field-select" value={fatForma} onChange={(e) => setFatForma(e.target.value)}>
                    <option value="PIX">PIX</option>
                    <option value="Cartão">Cartão</option>
                    <option value="Boleto">Boleto</option>
                  </select>
                </div>
                <div>
                  <label className="field-label">Competência</label>
                  <input type="month" className="field-input" value={fatRef} onChange={(e) => setFatRef(e.target.value)} />
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                <input type="checkbox" checked={fatRenovar30} onChange={(e) => setFatRenovar30(e.target.checked)} />
                <span>Renovar licença automaticamente (+30 dias e status ATIVO)</span>
              </label>
              <button type="submit" className="btn btn-success" disabled={busy}>
                <CheckCircle2 size={15} /> Registrar Pagamento SaaS
              </button>
            </form>

            <div className="table-wrap" style={{ maxHeight: 230, overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Empresa</th>
                    <th>Ref.</th>
                    <th style={{ textAlign: 'right' }}>Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {(dados?.faturas || []).map((f) => (
                    <tr key={f.id}>
                      <td style={{ fontSize: 12 }}>
                        <strong>{f.empresa_nome}</strong>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{f.forma} • {formatarDataBr(f.data_pagamento)}</div>
                      </td>
                      <td style={{ fontSize: 12 }}>{f.referencia}</td>
                      <td style={{ textAlign: 'right', color: '#34d399', fontWeight: 700 }}>{formatarMoeda(f.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-ABA 4: MEU PERFIL ADMIN & CONFIG SAAS */}
      {subAba === 'perfil' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
          <div className="panel-card">
            <h3 style={{ fontSize: 16, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Shield size={17} color="#c4b5fd" /> Alterar Meu Usuário &amp; Senha (ADMIN)
            </h3>
            <form style={{ display: 'flex', flexDirection: 'column', gap: 10 }} onSubmit={handleSalvarPerfilAdmin}>
              <div>
                <label className="field-label">Login / Usuário ADMIN *</label>
                <input className="field-input" required value={admUsername} onChange={(e) => setAdmUsername(e.target.value)} />
              </div>
              <div>
                <label className="field-label">Nome Completo *</label>
                <input className="field-input" required value={admNome} onChange={(e) => setAdmNome(e.target.value)} />
              </div>
              <div>
                <label className="field-label">E-mail</label>
                <input type="email" className="field-input" value={admEmail} onChange={(e) => setAdmEmail(e.target.value)} />
              </div>
              <div>
                <label className="field-label">Nova Senha (deixe em branco para manter)</label>
                <input type="password" className="field-input" placeholder="Mínimo 4 caracteres" value={admSenha} onChange={(e) => setAdmSenha(e.target.value)} />
              </div>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                <Save size={15} /> Salvar Dados do ADMIN
              </button>
            </form>
          </div>

          <div className="panel-card">
            <h3 style={{ fontSize: 16, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldAlert size={17} color="#fbbf24" /> Parâmetros Comerciais, Alertas &amp; Versão
            </h3>
            <form style={{ display: 'flex', flexDirection: 'column', gap: 10 }} onSubmit={handleSalvarConfigMaster}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <div>
                  <label className="field-label">Start (R$)</label>
                  <input type="number" className="field-input" value={cfgMaster.valor_start} onChange={(e) => setCfgMaster({ ...cfgMaster, valor_start: Number(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="field-label">Pro (R$)</label>
                  <input type="number" className="field-input" value={cfgMaster.valor_pro} onChange={(e) => setCfgMaster({ ...cfgMaster, valor_pro: Number(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="field-label">Enterprise (R$)</label>
                  <input type="number" className="field-input" value={cfgMaster.valor_enterprise} onChange={(e) => setCfgMaster({ ...cfgMaster, valor_enterprise: Number(e.target.value) || 0 })} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label className="field-label">Sua Chave PIX (Recebimento)</label>
                  <input className="field-input" value={cfgMaster.chave_pix_admin} onChange={(e) => setCfgMaster({ ...cfgMaster, chave_pix_admin: e.target.value })} />
                </div>
                <div>
                  <label className="field-label">WhatsApp Suporte (55...)</label>
                  <input className="field-input" value={cfgMaster.whatsapp_suporte} onChange={(e) => setCfgMaster({ ...cfgMaster, whatsapp_suporte: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="field-label">Link Checkout Online (PIX / Cartão / Boleto — Opcional)</label>
                <input className="field-input" placeholder="https://..." value={cfgMaster.link_checkout_pix} onChange={(e) => setCfgMaster({ ...cfgMaster, link_checkout_pix: e.target.value })} />
              </div>
              <div>
                <label className="field-label">Formas de Pagamento Aceitas para Comprovação</label>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', paddingTop: 4 }}>
                  {['PIX', 'Cartão', 'Boleto', 'Transferência'].map((fp) => {
                    const ativas = cfgMaster.formas_pagamento_ativas || ['PIX', 'Cartão', 'Boleto', 'Transferência'];
                    const marcada = ativas.includes(fp);
                    return (
                      <label key={fp} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={marcada}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...ativas, fp]
                              : ativas.filter((x) => x !== fp);
                            setCfgMaster({ ...cfgMaster, formas_pagamento_ativas: next });
                          }}
                        />
                        {fp}
                      </label>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="field-label">Instruções / Dados Bancários para Pagamento (Opcional)</label>
                <textarea
                  className="field-input"
                  rows={2}
                  placeholder="Ex.: Banco Inter, Ag 0001, CC 12345-6 ou link do boleto..."
                  value={cfgMaster.instrucoes_pagamento || ''}
                  onChange={(e) => setCfgMaster({ ...cfgMaster, instrucoes_pagamento: e.target.value })}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label className="field-label">Bot Token Telegram (Admin)</label>
                  <input type="password" className="field-input" value={cfgMaster.telegram_bot_token_admin} onChange={(e) => setCfgMaster({ ...cfgMaster, telegram_bot_token_admin: e.target.value })} />
                </div>
                <div>
                  <label className="field-label">Chat ID Telegram (Admin)</label>
                  <input className="field-input" value={cfgMaster.telegram_chat_id_admin} onChange={(e) => setCfgMaster({ ...cfgMaster, telegram_chat_id_admin: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 8 }}>
                <div>
                  <label className="field-label">Versão Mínima</label>
                  <input className="field-input" value={cfgMaster.versao_minima} onChange={(e) => setCfgMaster({ ...cfgMaster, versao_minima: e.target.value })} />
                </div>
                <div>
                  <label className="field-label">Link Download Atualização</label>
                  <input className="field-input" placeholder="https://..." value={cfgMaster.link_atualizacao} onChange={(e) => setCfgMaster({ ...cfgMaster, link_atualizacao: e.target.value })} />
                </div>
              </div>
              <button type="submit" className="btn btn-success" disabled={busy}>
                <Save size={15} /> Salvar Parâmetros SaaS
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL VISUALIZAR ANEXO DO COMPROVANTE */}
      {comprovanteAnexoModal && (
        <div className="modal-overlay" onClick={() => setComprovanteAnexoModal(null)}>
          <div className="modal-card" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h3 style={{ fontSize: 16, margin: 0 }}>
                Comprovante — {comprovanteAnexoModal.empresa_nome} ({formatarMoeda(comprovanteAnexoModal.valor)})
              </h3>
              <button type="button" className="btn btn-xs" onClick={() => setComprovanteAnexoModal(null)}>
                <X size={14} />
              </button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
              {comprovanteAnexoModal.forma} • Ref. {comprovanteAnexoModal.referencia} • {comprovanteAnexoModal.anexo_nome || 'Anexo'}
            </div>
            {comprovanteAnexoModal.anexo_data_url?.startsWith('data:image/') ? (
              <img
                src={comprovanteAnexoModal.anexo_data_url}
                alt="Comprovante"
                style={{ width: '100%', maxHeight: '65vh', objectFit: 'contain', borderRadius: 8, background: '#0f172a' }}
              />
            ) : comprovanteAnexoModal.anexo_data_url ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <iframe
                  title="Comprovante PDF"
                  src={comprovanteAnexoModal.anexo_data_url}
                  style={{ width: '100%', height: '60vh', border: 'none', borderRadius: 8, background: '#fff' }}
                />
                <a
                  href={comprovanteAnexoModal.anexo_data_url}
                  download={comprovanteAnexoModal.anexo_nome || 'comprovante.pdf'}
                  className="btn btn-primary"
                  style={{ textDecoration: 'none', alignSelf: 'flex-start' }}
                >
                  Baixar Comprovante
                </a>
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)' }}>Nenhum arquivo anexado.</p>
            )}
          </div>
        </div>
      )}

      {/* MODAL NOVA EMPRESA */}
      {modalNovaEmp && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: 520 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: 16 }}>Cadastrar Nova Empresa + Dono</h3>
              <button type="button" className="btn btn-xs" onClick={() => setModalNovaEmp(false)}><X size={14} /></button>
            </div>
            <form style={{ display: 'flex', flexDirection: 'column', gap: 10 }} onSubmit={handleCriarEmpresaMaster}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label className="field-label">Nome da Empresa *</label>
                  <input className="field-input" required value={novaEmpNome} onChange={(e) => setNovaEmpNome(e.target.value)} />
                </div>
                <div>
                  <label className="field-label">Nome do Responsável / Dono</label>
                  <input className="field-input" value={novaEmpDono} onChange={(e) => setNovaEmpDono(e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <div>
                  <label className="field-label">CNPJ</label>
                  <input className="field-input" value={novaEmpCnpj} onChange={(e) => setNovaEmpCnpj(e.target.value)} />
                </div>
                <div>
                  <label className="field-label">Telefone / WhatsApp</label>
                  <input className="field-input" value={novaEmpTel} onChange={(e) => setNovaEmpTel(e.target.value)} />
                </div>
                <div>
                  <label className="field-label">Cidade / UF</label>
                  <input className="field-input" value={novaEmpCidade} onChange={(e) => setNovaEmpCidade(e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <div>
                  <label className="field-label">Plano</label>
                  <select className="field-select" value={novaEmpPlano} onChange={(e) => setNovaEmpPlano(e.target.value as PlanoSaas)}>
                    <option value="START">START</option>
                    <option value="PRO">PRO</option>
                    <option value="ENTERPRISE">ENTERPRISE</option>
                  </select>
                </div>
                <div>
                  <label className="field-label">Status Inicial</label>
                  <select className="field-select" value={novaEmpStatus} onChange={(e) => setNovaEmpStatus(e.target.value as StatusAssinatura)}>
                    <option value="ATIVO">ATIVO (Liberado)</option>
                    <option value="TRIAL">TRIAL</option>
                    <option value="BLOQUEADO">BLOQUEADO</option>
                  </select>
                </div>
                <div>
                  <label className="field-label">Válido Até (opcional)</label>
                  <input type="date" className="field-input" value={novaEmpValidoAte} onChange={(e) => setNovaEmpValidoAte(e.target.value)} />
                </div>
              </div>
              <div style={{ borderTop: '1px solid rgba(148,163,184,0.2)', paddingTop: 10, marginTop: 4 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: '#cbd5e1' }}>Acesso do Usuário Dono</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <div>
                    <label className="field-label">Login Dono *</label>
                    <input className="field-input" required value={novaEmpUser} onChange={(e) => setNovaEmpUser(e.target.value)} />
                  </div>
                  <div>
                    <label className="field-label">E-mail</label>
                    <input type="email" className="field-input" value={novaEmpEmail} onChange={(e) => setNovaEmpEmail(e.target.value)} />
                  </div>
                  <div>
                    <label className="field-label">Senha Inicial *</label>
                    <input type="password" className="field-input" required minLength={4} value={novaEmpSenha} onChange={(e) => setNovaEmpSenha(e.target.value)} />
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
                <button type="button" className="btn" onClick={() => setModalNovaEmp(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={busy}>Criar Empresa</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDITAR LICENÇA */}
      {empEditando && (
        <div className="modal-overlay">
          <div className="panel-card" style={{ maxWidth: 440, width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: 16 }}>Editar Licença — {empEditando.nome}</h3>
              <button type="button" className="btn btn-xs" onClick={() => setEmpEditando(null)}><X size={14} /></button>
            </div>
            <form style={{ display: 'flex', flexDirection: 'column', gap: 10 }} onSubmit={handleSalvarLicencaModal}>
              <div>
                <label className="field-label">Plano</label>
                <select className="field-select" value={editPlano} onChange={(e) => setEditPlano(e.target.value as PlanoSaas)}>
                  <option value="START">START</option>
                  <option value="PRO">PRO</option>
                  <option value="ENTERPRISE">ENTERPRISE</option>
                </select>
              </div>
              <div>
                <label className="field-label">Status</label>
                <select className="field-select" value={editStatus} onChange={(e) => setEditStatus(e.target.value as StatusAssinatura)}>
                  <option value="TRIAL">TRIAL</option>
                  <option value="ATIVO">ATIVO</option>
                  <option value="INADIMPLENTE">INADIMPLENTE</option>
                  <option value="BLOQUEADO">BLOQUEADO</option>
                </select>
              </div>
              <div>
                <label className="field-label">Válido Até</label>
                <input type="date" className="field-input" value={editValidoAte} onChange={(e) => setEditValidoAte(e.target.value)} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="btn" onClick={() => setEmpEditando(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={busy}>Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL NOVO USUÁRIO GLOBAL */}
      {modalNovoUsr && (
        <div className="modal-overlay">
          <div className="panel-card" style={{ maxWidth: 460, width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: 16 }}>Novo Usuário Global</h3>
              <button type="button" className="btn btn-xs" onClick={() => setModalNovoUsr(false)}><X size={14} /></button>
            </div>
            <form style={{ display: 'flex', flexDirection: 'column', gap: 10 }} onSubmit={handleCriarUsuarioGlobal}>
              <div>
                <label className="field-label">Empresa *</label>
                <select className="field-select" value={novoUsrEmpId} onChange={(e) => setNovoUsrEmpId(e.target.value)}>
                  {(dados?.empresas || []).map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label className="field-label">Login *</label>
                  <input className="field-input" required value={novoUsrUsername} onChange={(e) => setNovoUsrUsername(e.target.value)} />
                </div>
                <div>
                  <label className="field-label">Perfil *</label>
                  <select className="field-select" value={novoUsrPerfil} onChange={(e) => setNovoUsrPerfil(e.target.value as PerfilUsuario)}>
                    <option value="DONO">DONO</option>
                    <option value="GERENTE">GERENTE</option>
                    <option value="VENDEDOR">VENDEDOR</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="field-label">Nome *</label>
                <input className="field-input" required value={novoUsrNome} onChange={(e) => setNovoUsrNome(e.target.value)} />
              </div>
              <div>
                <label className="field-label">E-mail</label>
                <input type="email" className="field-input" value={novoUsrEmail} onChange={(e) => setNovoUsrEmail(e.target.value)} />
              </div>
              <div>
                <label className="field-label">Senha *</label>
                <input type="password" className="field-input" required value={novoUsrSenha} onChange={(e) => setNovoUsrSenha(e.target.value)} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="btn" onClick={() => setModalNovoUsr(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={busy}>Criar Usuário</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDITAR USUÁRIO GLOBAL */}
      {usrEditando && (
        <div className="modal-overlay">
          <div className="panel-card" style={{ maxWidth: 460, width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: 16 }}>Editar Usuário — @{usrEditando.username}</h3>
              <button type="button" className="btn btn-xs" onClick={() => setUsrEditando(null)}><X size={14} /></button>
            </div>
            <form style={{ display: 'flex', flexDirection: 'column', gap: 10 }} onSubmit={handleSalvarEdicaoUsuario}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <label className="field-label">Login</label>
                  <input className="field-input" required value={editUsrUsername} onChange={(e) => setEditUsrUsername(e.target.value)} />
                </div>
                <div>
                  <label className="field-label">Perfil</label>
                  <select className="field-select" value={editUsrPerfil} onChange={(e) => setEditUsrPerfil(e.target.value as PerfilUsuario)}>
                    <option value="DONO">DONO</option>
                    <option value="GERENTE">GERENTE</option>
                    <option value="VENDEDOR">VENDEDOR</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="field-label">Nome</label>
                <input className="field-input" required value={editUsrNome} onChange={(e) => setEditUsrNome(e.target.value)} />
              </div>
              <div>
                <label className="field-label">E-mail</label>
                <input type="email" className="field-input" value={editUsrEmail} onChange={(e) => setEditUsrEmail(e.target.value)} />
              </div>
              <div>
                <label className="field-label">Redefinir Senha (opcional)</label>
                <input type="password" className="field-input" placeholder="Deixe vazio para manter" value={editUsrSenha} onChange={(e) => setEditUsrSenha(e.target.value)} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" className="btn" onClick={() => setUsrEditando(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={busy}>Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL AUTORIZAÇÃO DE SUPORTE TÉCNICO */}
      {suporteAlvo && (
        <div className="modal-overlay">
          <div className="panel-card" style={{ maxWidth: 440, width: '100%', borderColor: 'rgba(139,92,246,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Shield size={18} color="#c4b5fd" />
                <span>Autorização de Suporte Técnico</span>
              </h3>
              <button
                type="button"
                className="btn btn-xs"
                onClick={() => {
                  setSuporteAlvo(null);
                  setSuporteCodigoEsperado('');
                  setSuporteCodigoDigitado('');
                }}
              >
                <X size={14} />
              </button>
            </div>

            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.45 }}>
              Um código de confirmação foi enviado para o <strong>Telegram do Dono</strong> da empresa{' '}
              <strong>{suporteAlvo.nome}</strong>. Solicite o código ao cliente e digite abaixo para liberar o acesso:
            </p>

            <form style={{ display: 'flex', flexDirection: 'column', gap: 12 }} onSubmit={handleConfirmarCodigoSuporte}>
              <div>
                <label className="field-label">Código de Autorização *</label>
                <input
                  className="field-input"
                  inputMode="numeric"
                  autoFocus
                  required
                  maxLength={6}
                  placeholder="Digite o código informado pelo Dono"
                  value={suporteCodigoDigitado}
                  onChange={(e) => setSuporteCodigoDigitado(e.target.value)}
                  style={{ fontSize: 18, letterSpacing: '0.2em', textAlign: 'center', fontWeight: 700 }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={() => void handleIniciarSuporte(suporteAlvo)}
                >
                  Reenviar Código
                </button>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      setSuporteAlvo(null);
                      setSuporteCodigoEsperado('');
                      setSuporteCodigoDigitado('');
                    }}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={busy || !suporteCodigoDigitado.trim()}>
                    Confirmar Acesso
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
