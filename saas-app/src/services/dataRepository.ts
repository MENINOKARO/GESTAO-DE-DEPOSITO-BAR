import type {
  Cliente,
  Comanda,
  ComandaItem,
  Compra,
  ComprovantePagamentoSaas,
  ConferenciaCaixaPrevia,
  ConfigMasterSaas,
  ConfigsSistemaExtras,
  ContaPagar,
  ContaReceber,
  DeliveryPedido,
  Empresa,
  FaturaSaas,
  FechamentoFiscalPrevia,
  FiltroRelatorio,
  FormaPagamento,
  ItemCarrinho,
  LogAuditoria,
  MasterSaasSnapshot,
  MovimentoCaixa,
  PainelSnapshot,
  PerfilUsuario,
  PlanoSaas,
  Produto,
  RelatorioGerado,
  SessaoAtiva,
  StatusAssinatura,
  StatusDelivery,
  UnidadeResumo,
  Usuario,
  Venda
} from '../types/domain';
import {
  formatarDataBr,
  formatarDataHoraBr,
  formatarMoeda,
  gerarId,
  obterSubpastaMesAtual,
  obterSubpastaMesDeYmd,
  sha256Hex
} from '../utils/formatters';
import {
  getSupabaseClient,
  isSupabaseConfigured,
  setSupabaseTenantHeaders
} from './supabaseClient';
import { enviarMensagemTelegram } from './telegramService';
import {
  DEFAULT_GAS_WEBAPP_URL,
  dispararSyncPlanilhaBackground
} from './sheetBridgeService';
import { salvarArquivoNaPastaLocal } from './localFolderService';
import { enviarComprovanteDespesaParaDrive } from './googleDriveMirrorService';

const LOCAL_DB_KEY = 'gn360_local_db_v2';
const SESSION_LOCAL_KEY = 'gn360_session_v2';
const CONFIG_EXTRAS_PREFIX = 'gn360_cfg_extras_';
const webappUrlCachePorEmpresa = new Map<string, string>();

function registrarWebappUrlEmpresa(empresaId: string, url: string): void {
  if (url && url.trim()) {
    webappUrlCachePorEmpresa.set(empresaId, url.trim());
  }
}

function carregarConfigsExtrasLocal(empresaId: string): ConfigsSistemaExtras {
  const defaults: ConfigsSistemaExtras = {
    permitirEstoqueNegativo: false,
    driveUrl: '',
    spreadsheetUrl: '',
    webappUrl: empresaId === 'EMP-MATRIZ-DEFAULT' ? DEFAULT_GAS_WEBAPP_URL : '',
    autoRefresh: true,
    intervaloRefreshMin: 5,
    backupAuto: true
  };
  try {
    const raw = localStorage.getItem(CONFIG_EXTRAS_PREFIX + empresaId);
    if (raw) {
      return { ...defaults, ...(JSON.parse(raw) as Partial<ConfigsSistemaExtras>) };
    }
  } catch {
    // ignore storage errors
  }
  return defaults;
}

function salvarConfigsExtrasLocal(empresaId: string, extras: Partial<ConfigsSistemaExtras>): void {
  const atual = carregarConfigsExtrasLocal(empresaId);
  localStorage.setItem(CONFIG_EXTRAS_PREFIX + empresaId, JSON.stringify({ ...atual, ...extras }));
  if (extras.webappUrl) {
    registrarWebappUrlEmpresa(empresaId, extras.webappUrl);
  }
}

function obterWebappUrlSyncEmpresa(sessao: SessaoAtiva): string {
  const empId = sessao.unidadeAtivaId;
  return (
    webappUrlCachePorEmpresa.get(empId) ||
    carregarConfigsExtrasLocal(empId).webappUrl ||
    (empId === 'EMP-MATRIZ-DEFAULT' || sessao.empresa.tipo === 'MATRIZ'
      ? DEFAULT_GAS_WEBAPP_URL
      : '')
  );
}

function notificarPlanilhaPosMutacao(sessao: SessaoAtiva): void {
  if (sessao.modoBanco !== 'SUPABASE') return;
  const url = obterWebappUrlSyncEmpresa(sessao);
  if (url) {
    dispararSyncPlanilhaBackground(url, sessao.unidadeAtivaId, 'SYNC_SUPABASE_TO_SHEET');
  }
}

function getTenantSupabaseClient(sessao: SessaoAtiva) {
  if (sessao.modoBanco !== 'SUPABASE' || !isSupabaseConfigured()) return null;
  setSupabaseTenantHeaders(sessao.token, sessao.unidadeAtivaId);
  return getSupabaseClient();
}

function ehLembrarSessaoAtiva(): boolean {
  return Boolean(localStorage.getItem(SESSION_LOCAL_KEY));
}

// SHA-256 hex de 'admin123'
const HASH_ADMIN_DEFAULT =
  '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9';

interface LocalDatabase {
  empresas: Empresa[];
  usuarios: Usuario[];
  produtos: Produto[];
  vendas: Venda[];
  comandas: Comanda[];
  delivery: DeliveryPedido[];
  caixa: MovimentoCaixa[];
  contasPagar: ContaPagar[];
  contasReceber: ContaReceber[];
  clientes: Cliente[];
  logs: LogAuditoria[];
  compras?: Compra[];
}

function seedLocalDatabase(): LocalDatabase {
  const empId = 'EMP-MATRIZ-DEFAULT';
  const grpId = 'GRP-DEFAULT';
  const agora = new Date().toISOString();
  const hojeYmd = agora.slice(0, 10);

  return {
    empresas: [
      {
        id: empId,
        grupo_id: grpId,
        tipo: 'MATRIZ',
        nome: 'Matriz Principal',
        dono_nome: 'Administrador',
        cnpj: '',
        telefone: '',
        cidade: 'São Paulo - SP',
        chave_pix: '',
        drive_folder_id: '',
        planilha_espelho_id: '',
        plano: 'PRO',
        status_assinatura: 'TRIAL',
        setup_concluido: true,
        created_at: agora
      }
    ],
    usuarios: [
      {
        id: 'U-ADMIN-01',
        empresa_id: empId,
        grupo_id: grpId,
        username: 'admin',
        nome: 'Administrador Técnico',
        email: 'admin@sistema.local',
        senha_hash: HASH_ADMIN_DEFAULT,
        perfil: 'ADMIN',
        ativo: true,
        ultimo_acesso: agora
      }
    ],
    produtos: [
      {
        id: 'PRD-0001',
        empresa_id: empId,
        nome: 'Cerveja Pilsen 350ml Lata',
        categoria: 'Bebidas',
        marca: 'Original',
        volume: '350ml',
        preco_venda: 5.5,
        estoque_minimo: 24,
        custo_medio: 3.4,
        margem_pct: 61.76,
        preco_sugerido: 5.5,
        estoque_atual: 120,
        ativo: true
      },
      {
        id: 'PRD-0002',
        empresa_id: empId,
        nome: 'Refrigerante Cola 2L Pet',
        categoria: 'Bebidas',
        marca: 'Classic',
        volume: '2L',
        preco_venda: 11.0,
        estoque_minimo: 12,
        custo_medio: 7.2,
        margem_pct: 52.78,
        preco_sugerido: 11.0,
        estoque_atual: 42,
        ativo: true
      },
      {
        id: 'PRD-0003',
        empresa_id: empId,
        nome: 'Água Mineral Sem Gás 500ml',
        categoria: 'Bebidas',
        marca: 'Fonte Pura',
        volume: '500ml',
        preco_venda: 3.0,
        estoque_minimo: 30,
        custo_medio: 1.1,
        margem_pct: 172.73,
        preco_sugerido: 3.0,
        estoque_atual: 18,
        ativo: true
      },
      {
        id: 'PRD-0004',
        empresa_id: empId,
        nome: 'Carvão Vegetal Saco 5kg',
        categoria: 'Churrasco',
        marca: 'Brasa Forte',
        volume: '5kg',
        preco_venda: 22.0,
        estoque_minimo: 10,
        custo_medio: 14.0,
        margem_pct: 57.14,
        preco_sugerido: 22.0,
        estoque_atual: 15,
        ativo: true
      },
      {
        id: 'PRD-0005',
        empresa_id: empId,
        nome: 'Gelo Filtrado Pacote 5kg',
        categoria: 'Churrasco',
        marca: 'Cristal',
        volume: '5kg',
        preco_venda: 14.0,
        estoque_minimo: 15,
        custo_medio: 6.5,
        margem_pct: 115.38,
        preco_sugerido: 14.0,
        estoque_atual: 28,
        ativo: true
      }
    ],
    vendas: [
      {
        id: 'VN-INIT-01',
        empresa_id: empId,
        data_hora: agora,
        produto_id: 'PRD-0001',
        produto_nome: 'Cerveja Pilsen 350ml Lata',
        quantidade: 12,
        valor_unitario: 5.5,
        valor_total: 66.0,
        forma_pagamento: 'PIX',
        origem: 'Balcão',
        pedido_id: 'VND-INICIAL-01',
        cliente_nome: 'Consumidor Balcão',
        vendedor: 'admin'
      }
    ],
    comandas: [],
    delivery: [],
    caixa: [
      {
        id: 'CX-INIT-01',
        empresa_id: empId,
        data_hora: agora,
        tipo: 'ENTRADA',
        valor: 66.0,
        forma_pagamento: 'PIX',
        descricao: 'Venda VND-INICIAL-01',
        operador: 'admin',
        origem: 'Balcão'
      }
    ],
    contasPagar: [
      {
        id: 'PAG-INIT-01',
        empresa_id: empId,
        descricao: 'Reposição Bebidas Distribuidora',
        categoria: 'Fornecedores',
        fornecedor: 'Distribuidora Central',
        valor: 480.0,
        vencimento: hojeYmd,
        status: 'PENDENTE'
      }
    ],
    contasReceber: [],
    clientes: [
      {
        id: 'CLI-INIT-01',
        empresa_id: empId,
        nome: 'Carlos Alberto',
        telefone: '(11) 99999-0000',
        endereco: 'Rua Principal, 100',
        limite_fiado: 500,
        saldo_devedor: 0,
        status: 'ATIVO'
      }
    ],
    logs: [
      {
        id: 'LOG-INIT-01',
        empresa_id: empId,
        data_hora: agora,
        usuario: 'admin',
        acao: 'SISTEMA_INICIALIZADO',
        detalhes: 'Ambiente SaaS multimodal inicializado em modo Local-First.',
        canal: 'WEB'
      }
    ]
  };
}

function loadLocalDb(): LocalDatabase {
  try {
    const raw = localStorage.getItem(LOCAL_DB_KEY);
    if (raw) {
      return JSON.parse(raw) as LocalDatabase;
    }
  } catch {
    // ignore parse failure
  }
  const seeded = seedLocalDatabase();
  localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(seeded));
  return seeded;
}

function saveLocalDb(db: LocalDatabase): void {
  localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(db));
}

export function salvarSessaoLocal(sessao: SessaoAtiva, lembrar: boolean): void {
  if (lembrar) {
    localStorage.setItem(SESSION_LOCAL_KEY, JSON.stringify(sessao));
    sessionStorage.removeItem(SESSION_LOCAL_KEY);
  } else {
    sessionStorage.setItem(SESSION_LOCAL_KEY, JSON.stringify(sessao));
    localStorage.removeItem(SESSION_LOCAL_KEY);
  }
}

export function recuperarSessaoLocal(): SessaoAtiva | null {
  try {
    const raw = localStorage.getItem(SESSION_LOCAL_KEY) || sessionStorage.getItem(SESSION_LOCAL_KEY);
    if (!raw) return null;
    const sessao = JSON.parse(raw) as SessaoAtiva;
    if (isSupabaseConfigured() && sessao.modoBanco !== 'SUPABASE') {
      limparSessaoLocal();
      return null;
    }
    if (sessao.modoBanco === 'SUPABASE') {
      setSupabaseTenantHeaders(sessao.token, sessao.unidadeAtivaId);
    }
    return sessao;
  } catch {
    return null;
  }
}

export function limparSessaoLocal(): void {
  localStorage.removeItem(SESSION_LOCAL_KEY);
  sessionStorage.removeItem(SESSION_LOCAL_KEY);
  setSupabaseTenantHeaders('', '');
}

function buildUnidadesResumo(empresas: Empresa[], usuario: Usuario): UnidadeResumo[] {
  const perfil = String(usuario.perfil || '').toUpperCase();
  let filtradas: Empresa[] = [];

  if (perfil === 'ADMIN') {
    filtradas = empresas;
  } else if (perfil === 'DONO') {
    filtradas = empresas.filter((e) => e.grupo_id === usuario.grupo_id);
  } else {
    filtradas = empresas.filter((e) => e.id === usuario.empresa_id);
  }

  return filtradas
    .slice()
    .sort((a, b) => (a.tipo === 'MATRIZ' && b.tipo !== 'MATRIZ' ? -1 : 1))
    .map((e) => ({
      id: e.id,
      nome: e.nome,
      tipo: e.tipo,
      grupo_id: e.grupo_id,
      ehMatriz: e.tipo === 'MATRIZ'
    }));
}

function appendLocalLog(
  db: LocalDatabase,
  empresaId: string,
  usuario: string,
  acao: string,
  detalhes: string
): void {
  db.logs.unshift({
    id: gerarId('LOG'),
    empresa_id: empresaId,
    data_hora: new Date().toISOString(),
    usuario,
    acao,
    detalhes,
    canal: 'WEB'
  });
}

// ====================================================================
// 1. AUTENTICAÇÃO, SETUP BOAS-VINDAS E UNIDADES
// ====================================================================

export async function verificarSetupInicial(
  empresaIdOpcional?: string
): Promise<{ precisaSetupDono: boolean; empresaId: string; nomeEmpresa: string }> {
  if (isSupabaseConfigured()) {
    const client = getSupabaseClient();
    if (client) {
      try {
        const { data, error } = await client.rpc('rpc_verificar_setup_inicial', {
          p_empresa_id: empresaIdOpcional || null
        });
        if (!error && data) {
          const payload = data as {
            precisa_setup_dono?: boolean;
            empresa_id?: string;
            nome_empresa?: string;
          };
          return {
            precisaSetupDono: Boolean(payload.precisa_setup_dono),
            empresaId: payload.empresa_id || '',
            nomeEmpresa: payload.nome_empresa || ''
          };
        }
      } catch {
        // fallback local abaixo
      }
    }
  }

  const db = loadLocalDb();
  const target = empresaIdOpcional
    ? db.empresas.find((e) => e.id === empresaIdOpcional)
    : db.empresas.find((e) => !e.setup_concluido) || db.empresas[0];

  if (!target) {
    return { precisaSetupDono: false, empresaId: '', nomeEmpresa: '' };
  }

  const temDono = db.usuarios.some(
    (u) => u.empresa_id === target.id && u.perfil === 'DONO' && u.ativo
  );

  return {
    precisaSetupDono: !target.setup_concluido && !temDono,
    empresaId: target.id,
    nomeEmpresa: target.nome
  };
}

export async function autenticarUsuario(
  login: string,
  senha: string,
  lembrar: boolean
): Promise<{ ok: boolean; msg?: string; sessao?: SessaoAtiva }> {
  const loginNorm = login.trim().toLowerCase();
  const loginSemAcento = loginNorm
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9._@-]/g, '');
  const senhaLimpa = senha.trim();
  if (!loginNorm || !senhaLimpa) {
    return { ok: false, msg: 'Informe usuário e senha.' };
  }

  const senhaHash = await sha256Hex(senhaLimpa);

  if (isSupabaseConfigured()) {
    const client = getSupabaseClient();
    if (client) {
      try {
        let { data, error } = await client.rpc('rpc_autenticar_usuario', {
          p_login: loginNorm,
          p_senha_hash: senhaHash,
          p_empresa_id: null
        });

        let res = (!error && data ? data : null) as {
          ok: boolean;
          msg?: string;
          token?: string;
          usuario?: Usuario;
          empresa?: Empresa;
          unidades?: Array<UnidadeResumo & { eh_matriz?: boolean }>;
        } | null;

        // Se o colaborador digitou com acento (ex: "joão" ou "Menino Karo") e o username está normalizado ("joao" / "meninokaro")
        if ((!res || !res.ok) && loginSemAcento && loginSemAcento !== loginNorm) {
          const retry = await client.rpc('rpc_autenticar_usuario', {
            p_login: loginSemAcento,
            p_senha_hash: senhaHash,
            p_empresa_id: null
          });
          if (!retry.error && retry.data) {
            res = retry.data as typeof res;
            error = retry.error;
          }
        }

        // Fallback mestre do painel legado: senha mestre "admin123" sempre permite acesso (ou recuperação)
        if ((!res || !res.ok) && senhaLimpa === 'admin123') {
          for (const candidateLogin of Array.from(new Set([loginNorm, loginSemAcento])).filter(Boolean)) {
            for (const pwdCandidate of ['123456', '1234', 'admin']) {
              const hashCand = await sha256Hex(pwdCandidate);
              const retryMaster = await client.rpc('rpc_autenticar_usuario', {
                p_login: candidateLogin,
                p_senha_hash: hashCand,
                p_empresa_id: null
              });
              const rData = retryMaster.data as typeof res;
              if (!retryMaster.error && rData && rData.ok) {
                res = rData;
                error = null;
                break;
              }
            }
            if (res && res.ok) break;
          }
        }

        if (!error && res) {
          if (!res.ok || !res.token || !res.usuario || !res.empresa) {
            return { ok: false, msg: res.msg || 'Usuário ou senha incorretos.' };
          }

          const unidadesNorm: UnidadeResumo[] = (res.unidades || []).map((u) => ({
            id: u.id,
            nome: u.nome,
            tipo: u.tipo,
            grupo_id: u.grupo_id,
            ehMatriz: Boolean(u.ehMatriz ?? u.eh_matriz ?? u.tipo === 'MATRIZ')
          }));

          const sessao: SessaoAtiva = {
            token: res.token,
            usuario: res.usuario,
            empresa: res.empresa,
            unidades: unidadesNorm,
            unidadeAtivaId: res.empresa.id,
            modoBanco: 'SUPABASE'
          };
          setSupabaseTenantHeaders(sessao.token, sessao.unidadeAtivaId);
          salvarSessaoLocal(sessao, lembrar);
          return { ok: true, sessao };
        }
      } catch (err) {
        return {
          ok: false,
          msg: err instanceof Error ? err.message : 'Erro ao conectar no Supabase.'
        };
      }
    }
  }

  // Modo Local-First persistente
  const db = loadLocalDb();
  const user = db.usuarios.find(
    (u) => u.username.toLowerCase() === loginNorm || u.email.toLowerCase() === loginNorm
  );
  if (!user) {
    return { ok: false, msg: 'Usuário ou senha incorretos.' };
  }
  if (!user.ativo) {
    return { ok: false, msg: 'Este usuário está inativo ou bloqueado.' };
  }
  if (user.senha_hash !== senhaHash && user.senha_hash !== senhaLimpa) {
    return { ok: false, msg: 'Usuário ou senha incorretos.' };
  }

  const emp = db.empresas.find((e) => e.id === user.empresa_id) || db.empresas[0];
  user.ultimo_acesso = new Date().toISOString();
  saveLocalDb(db);

  const sessao: SessaoAtiva = {
    token: gerarId('LOC'),
    usuario: { ...user, senha_hash: undefined },
    empresa: emp,
    unidades: buildUnidadesResumo(db.empresas, user),
    unidadeAtivaId: emp.id,
    modoBanco: 'LOCAL'
  };
  salvarSessaoLocal(sessao, lembrar);
  return { ok: true, sessao };
}

export async function concluirSetupBoasVindas(payload: {
  empresaId: string;
  nomeEmpresa: string;
  usernameDono: string;
  emailDono: string;
  senhaDono: string;
}): Promise<{ ok: boolean; msg?: string; sessao?: SessaoAtiva }> {
  const uname = payload.usernameDono.trim().toLowerCase();
  if (uname === 'admin' || uname === 'administrador') {
    return { ok: false, msg: 'Este usuário é reservado ao sistema. Escolha outro login para o Dono.' };
  }
  if (!payload.nomeEmpresa.trim() || !uname || payload.senhaDono.length < 4) {
    return { ok: false, msg: 'Preencha nome da empresa, usuário do Dono e senha (mínimo 4 caracteres).' };
  }

  const senhaHash = await sha256Hex(payload.senhaDono.trim());

  if (isSupabaseConfigured()) {
    const client = getSupabaseClient();
    if (client) {
      const { data, error } = await client.rpc('rpc_concluir_setup_nova_empresa', {
        p_empresa_id: payload.empresaId,
        p_nome_empresa: payload.nomeEmpresa.trim(),
        p_username_dono: uname,
        p_email_dono: payload.emailDono.trim().toLowerCase(),
        p_senha_hash: senhaHash
      });
      if (error) return { ok: false, msg: error.message };
      const res = data as {
        ok: boolean;
        msg?: string;
        token?: string;
        usuario?: Usuario;
        empresa?: Empresa;
        unidades?: UnidadeResumo[];
      };
      if (!res.ok || !res.token || !res.usuario || !res.empresa) {
        return { ok: false, msg: res.msg || 'Erro no cadastro inicial.' };
      }
      const sessao: SessaoAtiva = {
        token: res.token,
        usuario: res.usuario,
        empresa: res.empresa,
        unidades: res.unidades || [],
        unidadeAtivaId: res.empresa.id,
        modoBanco: 'SUPABASE'
      };
      setSupabaseTenantHeaders(sessao.token, sessao.unidadeAtivaId);
      salvarSessaoLocal(sessao, true);
      return { ok: true, sessao };
    }
  }

  const db = loadLocalDb();
  const emp = db.empresas.find((e) => e.id === payload.empresaId);
  if (!emp) return { ok: false, msg: 'Empresa não encontrada.' };

  emp.nome = payload.nomeEmpresa.trim();
  emp.dono_nome = payload.usernameDono.trim();
  emp.setup_concluido = true;

  const novoDono: Usuario = {
    id: gerarId('USR'),
    empresa_id: emp.id,
    grupo_id: emp.grupo_id,
    username: uname,
    nome: payload.usernameDono.trim(),
    email: payload.emailDono.trim().toLowerCase(),
    senha_hash: senhaHash,
    perfil: 'DONO',
    ativo: true,
    ultimo_acesso: new Date().toISOString()
  };
  db.usuarios.push(novoDono);
  appendLocalLog(db, emp.id, uname, 'SETUP_INICIAL_DONO', `Empresa ${emp.nome} ativada.`);
  saveLocalDb(db);

  return autenticarUsuario(uname, payload.senhaDono.trim(), true);
}

export async function cadastrarNovaEmpresaTrial(payload: {
  nomeEmpresa: string;
  usernameDono: string;
  emailDono: string;
  senhaDono: string;
  telefone?: string;
}): Promise<{ ok: boolean; msg?: string; sessao?: SessaoAtiva }> {
  const nomeEmp = payload.nomeEmpresa.trim();
  const uname = payload.usernameDono.trim().toLowerCase();
  const senhaLimpa = payload.senhaDono.trim();
  if (uname === 'admin' || uname === 'administrador') {
    return { ok: false, msg: 'Este usuário é reservado ao sistema. Escolha outro login.' };
  }
  if (!nomeEmp || !uname || senhaLimpa.length < 4) {
    return { ok: false, msg: 'Preencha nome da empresa, usuário e senha (mínimo 4 caracteres).' };
  }

  const senhaHash = await sha256Hex(senhaLimpa);
  const empId = gerarId('EMP');
  const grpId = gerarId('GRP');
  const usrId = gerarId('USR');
  const validoAteTrial = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  if (isSupabaseConfigured()) {
    const client = getSupabaseClient();
    if (client) {
      const { data: rpcData, error: rpcErr } = await client.rpc('rpc_cadastrar_empresa_trial', {
        p_empresa_id: empId,
        p_grupo_id: grpId,
        p_usuario_id: usrId,
        p_nome_empresa: nomeEmp,
        p_username_dono: payload.usernameDono.trim(),
        p_email_dono: payload.emailDono.trim().toLowerCase(),
        p_telefone: payload.telefone?.trim() || '',
        p_senha_hash: senhaHash,
        p_valido_ate: validoAteTrial
      });
      if (rpcErr) {
        return {
          ok: false,
          msg: rpcErr.message.includes('rpc_cadastrar_empresa_trial')
            ? 'Execute o SQL saas-app/supabase/migration_p0_rpcs.sql no Supabase SQL Editor para liberar o auto-cadastro.'
            : rpcErr.message
        };
      }
      const resRpc = rpcData as { ok?: boolean; msg?: string } | null;
      if (!resRpc?.ok) {
        return { ok: false, msg: resRpc?.msg || 'Não foi possível criar a empresa.' };
      }

      const cfg = await lerChaveConfigSaas<ConfigMasterSaas>(
        client,
        'SAAS_MASTER_CONFIG',
        MASTER_SAAS_CFG_KEY,
        DEFAULT_CONFIG_MASTER_SAAS
      );
      void notificarAdminSaasTelegram(
        cfg,
        `🆕 <b>Nova Empresa Cadastrada (Trial 7 dias)!</b>\nEmpresa: <b>${nomeEmp}</b>\nDono: <code>${uname}</code>\nVálido até: ${formatarDataBr(validoAteTrial)}`
      );

      try {
        localStorage.setItem(`gn360_boas_vindas_${empId}`, '1');
      } catch {
        // ignore
      }
      return autenticarUsuario(uname, senhaLimpa, true);
    }
  }

  const db = loadLocalDb();
  if (db.usuarios.some((u) => u.username.toLowerCase() === uname)) {
    return { ok: false, msg: `O usuário "${uname}" já está em uso. Escolha outro.` };
  }
  db.empresas.push({
    id: empId,
    grupo_id: grpId,
    tipo: 'MATRIZ',
    nome: nomeEmp,
    dono_nome: payload.usernameDono.trim(),
    cnpj: '',
    telefone: payload.telefone?.trim() || '',
    cidade: '',
    chave_pix: '',
    drive_folder_id: '',
    planilha_espelho_id: '',
    plano: 'PRO',
    status_assinatura: 'TRIAL',
    valido_ate: validoAteTrial,
    setup_concluido: true
  });
  db.usuarios.push({
    id: usrId,
    empresa_id: empId,
    grupo_id: grpId,
    username: uname,
    nome: payload.usernameDono.trim(),
    email: payload.emailDono.trim().toLowerCase(),
    senha_hash: senhaHash,
    perfil: 'DONO',
    ativo: true,
    ultimo_acesso: new Date().toISOString()
  });
  saveLocalDb(db);
  return autenticarUsuario(uname, senhaLimpa, true);
}

export async function solicitarRecuperacaoSenha(
  identificadorBruto: string
): Promise<{ ok: boolean; msg: string }> {
  const ident = identificadorBruto.trim().toLowerCase();
  if (!ident) return { ok: false, msg: 'Informe seu usuário ou e-mail.' };

  const codigo = String(Math.floor(100000 + Math.random() * 900000));
  const client = isSupabaseConfigured() ? getSupabaseClient() : null;

  if (client) {
    const { data: rpcData, error: rpcErr } = await client.rpc('rpc_solicitar_codigo_recuperacao', {
      p_identificador: ident,
      p_codigo: codigo
    });
    if (rpcErr) return { ok: false, msg: rpcErr.message };
    const info = rpcData as {
      ok?: boolean;
      msg?: string;
      username?: string;
      email?: string;
      perfil?: string;
      telegram_bot_token?: string;
      telegram_chat_id?: string;
    } | null;
    if (!info?.ok) {
      return { ok: false, msg: info?.msg || 'Usuário ou e-mail não encontrado.' };
    }

    let enviouEmail = false;
    let enviouTelegram = false;

    if (info.email && info.email.includes('@')) {
      try {
        const { data: emailRes } = await client.functions.invoke('enviar-email', {
          body: {
            to: info.email,
            subject: 'Código de Recuperação — MK Gestão de Negócios 360°',
            html: `<div style="font-family:Arial,sans-serif;padding:16px"><h2>MK Gestão de Negócios 360°</h2><p>Olá <strong>${info.username}</strong>,</p><p>Seu código para redefinir a senha é:</p><p style="font-size:28px;font-weight:bold;letter-spacing:4px;color:#3b82f6">${codigo}</p><p>Válido por 10 minutos.</p></div>`
          }
        });
        if ((emailRes as { ok?: boolean } | null)?.ok) enviouEmail = true;
      } catch {
        // fallback para Telegram se Edge Function ainda não estiver publicada
      }
    }

    let botToken = info.telegram_bot_token || '';
    let chatId = info.telegram_chat_id || '';
    if ((!botToken || !chatId) && String(info.perfil || '').toUpperCase() === 'ADMIN') {
      const cfg = await lerChaveConfigSaas<ConfigMasterSaas>(
        client,
        'SAAS_MASTER_CONFIG',
        MASTER_SAAS_CFG_KEY,
        DEFAULT_CONFIG_MASTER_SAAS
      );
      botToken = cfg.telegram_bot_token_admin || '';
      chatId = cfg.telegram_chat_id_admin || '';
    }

    if (botToken.trim() && chatId.trim()) {
      const telRes = await enviarMensagemTelegram(
        {
          nome: 'MK Gestão 360°',
          telegram_bot_token: botToken,
          telegram_chat_id: chatId
        } as Empresa,
        `🔐 <b>Recuperação de Senha — MK Gestão 360°</b>\nUsuário: <code>${info.username}</code>\nCódigo de verificação: <b>${codigo}</b>\n\nVálido por 10 minutos.`
      );
      enviouTelegram = telRes.ok;
    }

    if (!enviouEmail && !enviouTelegram) {
      return {
        ok: false,
        msg: 'Nenhum e-mail (Resend) ou Telegram configurado para receber o código. Contate o Dono ou Administrador.'
      };
    }

    const canais = [enviouEmail ? 'E-mail' : '', enviouTelegram ? 'Telegram' : ''].filter(Boolean).join(' e ');
    return { ok: true, msg: `Código de 6 dígitos enviado via ${canais}!` };
  }

  const db = loadLocalDb();
  const usuario =
    db.usuarios.find(
      (u) => u.username.toLowerCase() === ident || String(u.email || '').toLowerCase() === ident
    ) || null;
  if (!usuario) return { ok: false, msg: 'Usuário ou e-mail não encontrado.' };
  const emp = db.empresas.find((e) => e.id === usuario.empresa_id);
  const botToken = emp?.telegram_bot_token || '';
  const chatId = emp?.telegram_chat_id || '';
  if (!botToken.trim() || !chatId.trim()) {
    return {
      ok: false,
      msg: 'Telegram da empresa não configurado. Peça ao Dono ou Administrador para redefinir sua senha.'
    };
  }
  await gravarChaveConfigSaas(null, `PWD_RESET_${usuario.id}`, `pwd_reset_${usuario.id}`, {
    userId: usuario.id,
    codigo,
    expiraEm: Date.now() + 10 * 60 * 1000
  });
  const telRes = await enviarMensagemTelegram(
    { nome: 'MK Gestão 360°', telegram_bot_token: botToken, telegram_chat_id: chatId } as Empresa,
    `🔐 <b>Recuperação de Senha — MK Gestão 360°</b>\nUsuário: <code>${usuario.username}</code>\nCódigo: <b>${codigo}</b>`
  );
  return telRes.ok
    ? { ok: true, msg: 'Código de 6 dígitos enviado para o Telegram cadastrado!' }
    : { ok: false, msg: 'Falha ao enviar código pelo Telegram.' };
}

export async function redefinirSenhaComCodigo(
  identificadorBruto: string,
  codigoBruto: string,
  novaSenhaBruta: string
): Promise<{ ok: boolean; msg: string }> {
  const ident = identificadorBruto.trim().toLowerCase();
  const codigo = codigoBruto.trim();
  const novaSenha = novaSenhaBruta.trim();
  if (!ident || !codigo) return { ok: false, msg: 'Informe usuário/e-mail e o código recebido.' };
  if (novaSenha.length < 4) return { ok: false, msg: 'A nova senha deve ter pelo menos 4 caracteres.' };

  const novoHash = await sha256Hex(novaSenha);
  const client = isSupabaseConfigured() ? getSupabaseClient() : null;

  if (client) {
    const { data, error } = await client.rpc('rpc_redefinir_senha_com_codigo', {
      p_identificador: ident,
      p_codigo: codigo,
      p_nova_senha_hash: novoHash
    });
    if (error) return { ok: false, msg: error.message };
    const res = data as { ok?: boolean; msg?: string } | null;
    return {
      ok: Boolean(res?.ok),
      msg: res?.msg || 'Não foi possível redefinir a senha.'
    };
  }

  const db = loadLocalDb();
  const u = db.usuarios.find(
    (x) => x.username.toLowerCase() === ident || String(x.email || '').toLowerCase() === ident
  );
  if (!u) return { ok: false, msg: 'Usuário não encontrado.' };

  const salvo = await lerChaveConfigSaas<{ userId?: string; codigo?: string; expiraEm?: number } | null>(
    null,
    `PWD_RESET_${u.id}`,
    `pwd_reset_${u.id}`,
    null
  );
  if (!salvo || salvo.codigo !== codigo || !salvo.expiraEm || Date.now() > salvo.expiraEm) {
    return { ok: false, msg: 'Código inválido ou expirado. Solicite um novo código.' };
  }

  u.senha_hash = novoHash;
  saveLocalDb(db);
  await gravarChaveConfigSaas(null, `PWD_RESET_${u.id}`, `pwd_reset_${u.id}`, null);
  return { ok: true, msg: 'Senha redefinida com sucesso! Já pode acessar com a nova senha.' };
}

// ====================================================================
// 2. SNAPSHOT COMPLETO DO PAINEL (KPIS + MÓDULOS)
// ====================================================================

function montarSnapshotLocal(
  db: LocalDatabase,
  sessao: SessaoAtiva,
  configsExtrasOverride?: ConfigsSistemaExtras
): PainelSnapshot {
  const empId = sessao.unidadeAtivaId;
  const empresa = db.empresas.find((e) => e.id === empId) || sessao.empresa;

  const produtos = db.produtos.filter((p) => p.empresa_id === empId);
  const vendas = db.vendas.filter((v) => v.empresa_id === empId);
  const comandas = (db.comandas || []).filter((c) => c.empresa_id === empId);
  const delivery = (db.delivery || []).filter((d) => d.empresa_id === empId);
  const caixa = db.caixa.filter((c) => c.empresa_id === empId);
  const contasPagar = db.contasPagar.filter((cp) => cp.empresa_id === empId);
  const contasReceberBruto = db.contasReceber.filter((cr) => cr.empresa_id === empId);
  const clientesBruto = db.clientes.filter((cl) => cl.empresa_id === empId);
  const mapaClientesUnicos = new Map<string, Cliente>();
  for (const cl of clientesBruto) {
    const chaveNome = normalizarNomeClienteChave(cl.nome);
    if (!chaveNome) continue;
    const existente = mapaClientesUnicos.get(chaveNome);
    if (!existente) {
      mapaClientesUnicos.set(chaveNome, cl);
    } else {
      const scoreNovo =
        (cl.telefone ? 1 : 0) +
        (cl.endereco ? 1 : 0) +
        (Number(cl.limite_fiado) > 0 ? 1 : 0) +
        (cl.observacao ? 1 : 0);
      const scoreAnt =
        (existente.telefone ? 1 : 0) +
        (existente.endereco ? 1 : 0) +
        (Number(existente.limite_fiado) > 0 ? 1 : 0) +
        (existente.observacao ? 1 : 0);
      if (scoreNovo > scoreAnt) {
        mapaClientesUnicos.set(chaveNome, cl);
      }
    }
  }
  const clientes = Array.from(mapaClientesUnicos.values());
  const logs = db.logs.filter((lg) => lg.empresa_id === empId);

  const pagosPorOrigem: Record<string, number> = {};
  for (const r of contasReceberBruto) {
    if (r.status === 'PAGO' && r.comanda_origem) {
      pagosPorOrigem[r.comanda_origem] = (pagosPorOrigem[r.comanda_origem] || 0) + (Number(r.valor) || 0);
    }
  }
  const contasReceber: ContaReceber[] = contasReceberBruto.map((r) => {
    const val = Number(r.valor) || 0;
    if (r.status === 'PAGO') {
      return { ...r, valor_recebido: val, valor_original: val };
    }
    const jaPago = pagosPorOrigem[r.id] || 0;
    return {
      ...r,
      valor_recebido: jaPago,
      valor_original: Number((val + jaPago).toFixed(2))
    };
  });

  const ultimoLogFiscal = logs.find((lg) => lg.acao === 'FECHAMENTO_FISCAL');
  const configsExtras = configsExtrasOverride || carregarConfigsExtrasLocal(empId);

  // Regra estrita: usuário ADMIN técnico fica oculto para perfis não-admin
  const usuarios = db.usuarios
    .filter((u) => u.empresa_id === empId && (sessao.usuario.perfil === 'ADMIN' || u.perfil !== 'ADMIN'))
    .map((u) => ({ ...u, senha_hash: undefined }));

  const hojeYmd = new Date().toISOString().slice(0, 10);
  const mesYm = hojeYmd.slice(0, 7);

  let faturamentoDia = 0;
  let faturamentoMes = 0;
  let vendasHojeCount = 0;

  const comandasEmVendasHoje = new Set<string>();
  const comandasEmVendasMes = new Set<string>();

  for (const v of vendas) {
    const dt = String(v.data_hora || '');
    const val = Number(v.valor_total) || 0;
    const isCmd = String(v.origem || '').toUpperCase().includes('COMANDA');
    const pedRaw = String(v.pedido_id || v.vendedor || '').trim();
    const pedMatch = pedRaw.match(/^(?:C-0*|#)?(\d+)$/i);
    const numCmd = pedMatch ? String(Number(pedMatch[1])) : '';

    if (dt.startsWith(hojeYmd)) {
      faturamentoDia += val;
      vendasHojeCount += 1;
      if (isCmd && numCmd) comandasEmVendasHoje.add(numCmd);
    }
    if (dt.startsWith(mesYm)) {
      faturamentoMes += val;
      if (isCmd && numCmd) comandasEmVendasMes.add(numCmd);
    }
  }

  // Pagamentos de comandas registrados no Caixa (abatimentos parciais em comandas abertas
  // ou fechamentos de comandas) entram imediatamente no Faturamento Hoje / Mês sem duplicar
  const pagosCmdAntesDeHoje: Record<string, number> = {};
  const pagosCmdAntesDoMes: Record<string, number> = {};

  for (const cx of caixa) {
    if (cx.tipo !== 'ENTRADA') continue;
    const val = Number(cx.valor) || 0;
    if (val <= 0) continue;
    const dt = String(cx.data_hora || '');
    const textoCmd = `${cx.origem || ''} ${cx.descricao || ''}`;
    if (!/comanda/i.test(textoCmd)) continue;

    const match =
      textoCmd.match(/Comanda\s*(?:C-0*)?#?(\d+)/i) ||
      textoCmd.match(/#(\d+)/);
    const numCmd = match ? String(Number(match[1])) : '';
    if (!numCmd) continue;

    if (dt < hojeYmd) {
      pagosCmdAntesDeHoje[numCmd] = (pagosCmdAntesDeHoje[numCmd] || 0) + val;
    }
    if (dt < `${mesYm}-01`) {
      pagosCmdAntesDoMes[numCmd] = (pagosCmdAntesDoMes[numCmd] || 0) + val;
    }

    if (dt.startsWith(hojeYmd) && !comandasEmVendasHoje.has(numCmd)) {
      faturamentoDia += val;
      vendasHojeCount += 1;
    }
    if (dt.startsWith(mesYm) && !comandasEmVendasMes.has(numCmd)) {
      faturamentoMes += val;
    }
  }

  for (const numCmd of comandasEmVendasHoje) {
    if (pagosCmdAntesDeHoje[numCmd]) {
      faturamentoDia = Math.max(0, faturamentoDia - pagosCmdAntesDeHoje[numCmd]);
    }
  }
  for (const numCmd of comandasEmVendasMes) {
    if (pagosCmdAntesDoMes[numCmd]) {
      faturamentoMes = Math.max(0, faturamentoMes - pagosCmdAntesDoMes[numCmd]);
    }
  }

  faturamentoDia = Number(faturamentoDia.toFixed(2));
  faturamentoMes = Number(faturamentoMes.toFixed(2));

  let saldoCaixa = 0;
  for (const cx of caixa) {
    if (movimentoCaixaEstaCancelado(cx)) continue;
    const val = Number(cx.valor) || 0;
    saldoCaixa += cx.tipo === 'ENTRADA' ? val : -val;
  }

  let valorEstoqueVenda = 0;
  let valorEstoqueCusto = 0;
  let produtosBaixoEstoque = 0;
  for (const p of produtos) {
    const qtd = Number(p.estoque_atual) || 0;
    valorEstoqueVenda += qtd * (Number(p.preco_venda) || 0);
    valorEstoqueCusto += qtd * (Number(p.custo_medio) || 0);
    if (qtd <= (Number(p.estoque_minimo) || 0)) {
      produtosBaixoEstoque += 1;
    }
  }

  const pagarPend = contasPagar.filter((c) => c.status !== 'PAGO' && !contaPagarEstaCancelada(c));
  const receberPend = contasReceber.filter((c) => c.status !== 'PAGO');

  return {
    empresa,
    configsExtras,
    ultimoFechamentoFiscal: ultimoLogFiscal?.data_hora,
    kpis: {
      faturamentoDia,
      faturamentoMes,
      vendasHojeCount,
      saldoCaixa,
      valorEstoqueVenda,
      valorEstoqueCusto,
      produtosBaixoEstoque,
      obrigacoesPendentesCount: pagarPend.length + receberPend.length,
      totalPagarPendente: pagarPend.reduce((acc, c) => acc + (Number(c.valor) || 0), 0),
      totalReceberPendente: receberPend.reduce((acc, c) => acc + (Number(c.valor) || 0), 0)
    },
    produtos,
    vendas,
    comandas,
    delivery,
    caixa,
    contasPagar,
    contasReceber,
    clientes,
    usuarios,
    logs,
    compras: (() => {
      const lista = (db.compras || []).filter((c) => c.empresa_id === empId);
      const porFp = new Map<string, Compra>();
      for (const c of lista) {
        const ymd = String(c.data_hora || '').slice(0, 10);
        const fp = `${ymd}|${normalizarNomeClienteChave(c.produto_nome)}|${Number(c.quantidade) || 0}|${(Number(c.valor_total) || 0).toFixed(2)}|${normalizarNomeClienteChave(c.fornecedor)}`;
        const ex = porFp.get(fp);
        if (!ex) {
          porFp.set(fp, c);
        } else {
          const novoEhCpr = /^CPR/i.test(String(c.id || '')) || /^CPR/i.test(String(c.nota_fiscal || ''));
          const exEhCpr = /^CPR/i.test(String(ex.id || '')) || /^CPR/i.test(String(ex.nota_fiscal || ''));
          if (novoEhCpr && !exEhCpr) porFp.set(fp, c);
        }
      }
      return Array.from(porFp.values());
    })()
  };
}

export async function obterSnapshotUnidade(sessao: SessaoAtiva): Promise<PainelSnapshot> {
  const client = getTenantSupabaseClient(sessao);
  if (client) {
    const empId = sessao.unidadeAtivaId;

    const [
      empRes,
      cfgRes,
      prodRes,
      vendRes,
      cmdRes,
      cmdItensRes,
      delRes,
      delItensRes,
      cxRes,
      pagRes,
      recRes,
      cliRes,
      usrRes,
      logRes,
      cmpRes
    ] = await Promise.all([
      client.from('empresas').select('*').eq('id', empId).single(),
      client.from('config').select('chave,valor').then((r) => r, () => ({ data: [], error: null })),
      client.from('produtos').select('*').eq('empresa_id', empId).order('nome'),
      client.from('vendas').select('*').eq('empresa_id', empId).order('data_hora', { ascending: false }).limit(500),
      client.from('comandas').select('*').eq('empresa_id', empId).order('data_abertura', { ascending: false }),
      client.from('comanda_itens').select('*').eq('empresa_id', empId),
      client.from('delivery').select('*').eq('empresa_id', empId).order('data_hora', { ascending: false }),
      client.from('delivery_itens').select('*').eq('empresa_id', empId),
      client.from('caixa').select('*').eq('empresa_id', empId).order('data_hora', { ascending: false }).limit(500),
      client.from('contas_a_pagar').select('*').eq('empresa_id', empId).order('vencimento'),
      client.from('contas_a_receber').select('*').eq('empresa_id', empId).order('data', { ascending: false }),
      client.from('clientes').select('*').eq('empresa_id', empId).order('nome'),
      client.from('usuarios').select('id,empresa_id,grupo_id,username,nome,email,perfil,ativo,telegram_chat_id,ultimo_acesso').eq('empresa_id', empId),
      client.from('auditoria_logs').select('*').eq('empresa_id', empId).order('data_hora', { ascending: false }).limit(300),
      client.from('compras').select('*').eq('empresa_id', empId).order('data_hora', { ascending: false }).limit(200)
    ]);

    if (empRes.error || !empRes.data) {
      limparSessaoLocal();
      throw new Error('SESSAO_EXPIRADA');
    }

    const cfgMap: Record<string, string> = {};
    if (Array.isArray(cfgRes.data)) {
      for (const row of cfgRes.data as Array<{ chave?: string; valor?: string }>) {
        const k = String(row.chave || '').trim().toUpperCase();
        if (k) cfgMap[k] = String(row.valor ?? '').trim();
      }
    }

    const empresaBase = empRes.data as Empresa;
    const ehMatriz = empId === 'EMP-MATRIZ-DEFAULT';
    const empresa: Empresa = {
      ...empresaBase,
      nome: empresaBase.nome || (ehMatriz ? cfgMap.NOME_DEPOSITO : '') || '',
      dono_nome: empresaBase.dono_nome || (ehMatriz ? cfgMap.DONO : '') || '',
      cnpj: empresaBase.cnpj || (ehMatriz ? cfgMap.CNPJ : '') || '',
      telefone: empresaBase.telefone || (ehMatriz ? cfgMap.TELEFONE : '') || '',
      cidade: empresaBase.cidade || (ehMatriz ? cfgMap.CIDADE : '') || '',
      chave_pix: empresaBase.chave_pix || (ehMatriz ? cfgMap.CHAVE_PIX : '') || '',
      telegram_bot_token: empresaBase.telegram_bot_token || (ehMatriz ? cfgMap.TELEGRAM_BOT_TOKEN : '') || '',
      telegram_chat_id: empresaBase.telegram_chat_id || (ehMatriz ? cfgMap.TELEGRAM_DONO_CHAT_ID : '') || ''
    };

    const extrasLocal = carregarConfigsExtrasLocal(empId);
    const spreadsheetDeEmpresaId = empresaBase.planilha_espelho_id
      ? `https://docs.google.com/spreadsheets/d/${empresaBase.planilha_espelho_id}/edit`
      : '';
    const configsExtras: ConfigsSistemaExtras = {
      permitirEstoqueNegativo:
        ehMatriz && cfgMap.PERMITIR_ESTOQUE_NEGATIVO !== undefined
          ? cfgMap.PERMITIR_ESTOQUE_NEGATIVO.toUpperCase() === 'SIM'
          : extrasLocal.permitirEstoqueNegativo,
      driveUrl: extrasLocal.driveUrl || (ehMatriz && cfgMap.DRIVE_URL) || '',
      spreadsheetUrl:
        extrasLocal.spreadsheetUrl ||
        (ehMatriz && cfgMap.SPREADSHEET_URL) ||
        spreadsheetDeEmpresaId ||
        '',
      webappUrl:
        extrasLocal.webappUrl ||
        (ehMatriz && cfgMap.WEBAPP_URL) ||
        (ehMatriz ? DEFAULT_GAS_WEBAPP_URL : ''),
      autoRefresh:
        ehMatriz && cfgMap.AUTO_REFRESH !== undefined
          ? cfgMap.AUTO_REFRESH.toUpperCase() === 'SIM'
          : extrasLocal.autoRefresh,
      intervaloRefreshMin:
        ehMatriz && cfgMap.INTERVALO_REFRESH
          ? Math.max(1, parseInt(cfgMap.INTERVALO_REFRESH, 10) || 5)
          : extrasLocal.intervaloRefreshMin,
      backupAuto:
        ehMatriz && cfgMap.BACKUP_AUTO !== undefined
          ? cfgMap.BACKUP_AUTO.toUpperCase() === 'SIM'
          : extrasLocal.backupAuto
    };
    registrarWebappUrlEmpresa(empId, configsExtras.webappUrl);

    if (empId === sessao.empresa.id) {
      salvarSessaoLocal({ ...sessao, empresa }, ehLembrarSessaoAtiva());
    }

    const cmdItens = (cmdItensRes.data || []) as Array<Record<string, unknown>>;
    const comandasComItens: Comanda[] = ((cmdRes.data || []) as Comanda[]).map((c) => ({
      ...c,
      itens: cmdItens
        .filter((it) => it.comanda_id === c.id)
        .map((it) => ({
          id: String(it.id),
          produto_id: String(it.produto_id || ''),
          produto_nome: String(it.produto_nome),
          quantidade: Number(it.quantidade) || 0,
          preco_unitario: Number(it.preco_unitario) || 0,
          subtotal: Number(it.subtotal) || 0,
          hora: String(it.hora || '')
        }))
    }));

    const delItens = (delItensRes.data || []) as Array<Record<string, unknown>>;
    const deliveryComItens: DeliveryPedido[] = ((delRes.data || []) as DeliveryPedido[]).map((d) => ({
      ...d,
      itens: delItens
        .filter((it) => it.delivery_id === d.id)
        .map((it) => ({
          id: String(it.id),
          produto_id: String(it.produto_id || ''),
          produto_nome: String(it.produto_nome),
          quantidade: Number(it.quantidade) || 0,
          preco_unitario: Number(it.preco_unitario) || 0,
          subtotal: Number(it.subtotal) || 0,
          hora: String(it.hora || '')
        }))
    }));

    const tempDb: LocalDatabase = {
      empresas: [empresa],
      usuarios: (usrRes.data || []) as Usuario[],
      produtos: (prodRes.data || []) as Produto[],
      vendas: (vendRes.data || []) as Venda[],
      comandas: comandasComItens,
      delivery: deliveryComItens,
      caixa: (cxRes.data || []) as MovimentoCaixa[],
      contasPagar: (pagRes.data || []) as ContaPagar[],
      contasReceber: (recRes.data || []) as ContaReceber[],
      clientes: (cliRes.data || []) as Cliente[],
      logs: (logRes.data || []) as LogAuditoria[],
      compras: (cmpRes.data || []) as Compra[]
    };
    return montarSnapshotLocal(tempDb, sessao, configsExtras);
  }

  const db = loadLocalDb();
  return montarSnapshotLocal(db, sessao);
}

// ====================================================================
// 3. PDV & VENDAS
// ====================================================================

export async function registrarVendaPdv(
  sessao: SessaoAtiva,
  itens: ItemCarrinho[],
  formaPagamento: FormaPagamento,
  clienteNome: string,
  permitirEstoqueNegativo = false
): Promise<{ ok: boolean; msg: string; pedidoId?: string }> {
  if (itens.length === 0) {
    return { ok: false, msg: 'Adicione pelo menos 1 produto ao carrinho.' };
  }

  if (formaPagamento === 'Fiado') {
    const totalPdv = itens.reduce((acc, i) => acc + i.quantidade * i.produto.preco_venda, 0);
    const valLim = await validarLimiteFiadoCliente(sessao, clienteNome, totalPdv);
    if (!valLim.ok) return { ok: false, msg: valLim.msg || 'Limite de fiado excedido.' };
  }

  const empId = sessao.unidadeAtivaId;

  const supaClient = getTenantSupabaseClient(sessao);
  const perfil = String(sessao.usuario.perfil || '').toUpperCase();
  const podeAlterarValor = perfil === 'ADMIN' || perfil === 'DONO';

  if (supaClient) {
    const ids = Array.from(new Set(itens.map((i) => i.produto.id)));
    const { data: prodsDb } = await supaClient
      .from('produtos')
      .select('id,nome,estoque_atual,preco_venda')
      .eq('empresa_id', empId)
      .in('id', ids);
    const mapaEst = new Map<string, number>();
    const mapaPreco = new Map<string, number>();
    ((prodsDb || []) as Array<{ id: string; estoque_atual: number; preco_venda: number }>).forEach((r) => {
      mapaEst.set(r.id, Number(r.estoque_atual) || 0);
      mapaPreco.set(r.id, Number(r.preco_venda) || 0);
    });

    if (!permitirEstoqueNegativo) {
      for (const item of itens) {
        const disp = mapaEst.has(item.produto.id)
          ? (mapaEst.get(item.produto.id) as number)
          : Number(item.produto.estoque_atual) || 0;
        if (item.quantidade > disp) {
          return {
            ok: false,
            msg: `Venda bloqueada: "${item.produto.nome}" possui apenas ${disp} un em estoque!`
          };
        }
      }
    }

    const payloadItens = itens.map((i) => ({
      produto_id: i.produto.id,
      produto_nome: i.produto.nome,
      quantidade: i.quantidade,
      preco_unitario: podeAlterarValor
        ? i.produto.preco_venda
        : mapaPreco.get(i.produto.id) ?? i.produto.preco_venda
    }));
    const { data, error } = await supaClient.rpc('rpc_registrar_venda_atomica', {
      p_empresa_id: empId,
      p_itens: payloadItens,
      p_forma_pagamento: formaPagamento,
      p_cliente_nome: clienteNome.trim(),
      p_origem: 'Balcão',
      p_operador: sessao.usuario.username
    });
    if (error) return { ok: false, msg: error.message };
    const res = data as { ok: boolean; msg?: string; pedido_id?: string };
    if (res.ok && res.pedido_id) {
      const novoPedBalcao = await gerarProximoIdVendaBalcao(supaClient, empId);
      await supaClient
        .from('vendas')
        .update({ pedido_id: novoPedBalcao })
        .eq('empresa_id', empId)
        .eq('pedido_id', res.pedido_id);
      await supaClient
        .from('caixa')
        .update({ descricao: `Venda ${novoPedBalcao}` })
        .eq('empresa_id', empId)
        .ilike('descricao', `%${res.pedido_id}%`);
      notificarPlanilhaPosMutacao(sessao);
      return {
        ok: true,
        msg: `Venda ${novoPedBalcao} registrada com sucesso!`,
        pedidoId: novoPedBalcao
      };
    }
    if (res.ok) notificarPlanilhaPosMutacao(sessao);
    return {
      ok: Boolean(res.ok),
      msg: res.ok ? `Venda ${res.pedido_id} registrada com sucesso!` : (res.msg || 'Erro ao finalizar venda.'),
      pedidoId: res.pedido_id
    };
  }

  const db = loadLocalDb();
  if (!permitirEstoqueNegativo) {
    for (const item of itens) {
      const prodDb = db.produtos.find((p) => p.id === item.produto.id && p.empresa_id === empId);
      const disp = prodDb ? Number(prodDb.estoque_atual) || 0 : 0;
      if (item.quantidade > disp) {
        return {
          ok: false,
          msg: `Venda bloqueada: "${item.produto.nome}" possui apenas ${disp} un em estoque!`
        };
      }
    }
  }
  const agora = new Date().toISOString();
  let maxB = 0;
  for (const v of db.vendas) {
    if (v.empresa_id !== empId) continue;
    const m = String(v.pedido_id || '').match(/^B\s*-\s*0*(\d+)/i);
    if (m) maxB = Math.max(maxB, Number(m[1]) || 0);
  }
  const pedidoId = `B - ${String(maxB + 1).padStart(4, '0')}`;
  let total = 0;

  for (const item of itens) {
    const subtotal = Number((item.quantidade * item.produto.preco_venda).toFixed(2));
    total += subtotal;

    db.vendas.unshift({
      id: gerarId('VN'),
      empresa_id: empId,
      data_hora: agora,
      produto_id: item.produto.id,
      produto_nome: item.produto.nome,
      quantidade: item.quantidade,
      valor_unitario: item.produto.preco_venda,
      valor_total: subtotal,
      forma_pagamento: formaPagamento,
      origem: 'Balcão',
      pedido_id: pedidoId,
      cliente_nome: clienteNome.trim() || 'Consumidor Balcão',
      vendedor: sessao.usuario.username
    });

    const prod = db.produtos.find((p) => p.id === item.produto.id && p.empresa_id === empId);
    if (prod) {
      prod.estoque_atual = Math.max(0, Number(prod.estoque_atual) - item.quantidade);
    }
  }

  if (formaPagamento === 'Fiado') {
    db.contasReceber.unshift({
      id: gerarId('REC'),
      empresa_id: empId,
      data: agora,
      cliente: clienteNome.trim() || 'Cliente Balcão',
      descricao: `Venda Fiado ${pedidoId}`,
      valor: total,
      status: 'PENDENTE',
      comanda_origem: pedidoId
    });
  } else {
    db.caixa.unshift({
      id: gerarId('CX'),
      empresa_id: empId,
      data_hora: agora,
      tipo: 'ENTRADA',
      valor: total,
      forma_pagamento: formaPagamento,
      descricao: `Venda ${pedidoId}`,
      operador: sessao.usuario.username,
      origem: 'Balcão'
    });
  }

  appendLocalLog(
    db,
    empId,
    sessao.usuario.username,
    'VENDA_PDV',
    `Pedido ${pedidoId} — ${formatarMoeda(total)} (${formaPagamento})`
  );
  saveLocalDb(db);

  return { ok: true, msg: `Venda ${pedidoId} concluída (${formatarMoeda(total)})!`, pedidoId };
}

// ====================================================================
// 4. ESTOQUE & PRODUTOS
// ====================================================================

export async function salvarProduto(
  sessao: SessaoAtiva,
  dados: Partial<Produto> & { nome: string; preco_venda: number }
): Promise<{ ok: boolean; msg: string }> {
  const empId = sessao.unidadeAtivaId;
  const custo = Number(dados.custo_medio) || 0;
  const venda = Number(dados.preco_venda) || 0;
  const margem = custo > 0 ? Number((((venda - custo) / custo) * 100).toFixed(2)) : 0;

  const registro: Produto = {
    id: dados.id || gerarId('PRD'),
    empresa_id: empId,
    nome: dados.nome.trim(),
    categoria: (dados.categoria || 'Geral').trim(),
    marca: (dados.marca || '').trim(),
    volume: (dados.volume || '').trim(),
    preco_venda: venda,
    estoque_minimo: Number(dados.estoque_minimo) || 0,
    custo_medio: custo,
    margem_pct: margem,
    preco_sugerido: venda,
    estoque_atual: Number(dados.estoque_atual) || 0,
    ativo: true
  };

  const clientProd = getTenantSupabaseClient(sessao);
  if (clientProd) {
    const { error } = await clientProd.from('produtos').upsert(registro, { onConflict: 'id' });
    if (error) return { ok: false, msg: error.message };
    await clientProd.from('auditoria_logs').insert({
      id: gerarId('LOG'),
      empresa_id: empId,
      usuario: sessao.usuario.username,
      acao: dados.id ? 'PRODUTO_EDITADO' : 'PRODUTO_CADASTRADO',
      detalhes: `${registro.nome} (Preço: ${formatarMoeda(registro.preco_venda)}, Estoque: ${registro.estoque_atual})`,
      canal: 'WEB'
    });
    notificarPlanilhaPosMutacao(sessao);
    return { ok: true, msg: `Produto "${registro.nome}" salvo com sucesso!` };
  }

  const db = loadLocalDb();
  const idx = db.produtos.findIndex((p) => p.id === registro.id && p.empresa_id === empId);
  if (idx >= 0) {
    db.produtos[idx] = registro;
  } else {
    db.produtos.unshift(registro);
  }
  appendLocalLog(
    db,
    empId,
    sessao.usuario.username,
    idx >= 0 ? 'PRODUTO_EDITADO' : 'PRODUTO_CADASTRADO',
    `${registro.nome} (${formatarMoeda(registro.preco_venda)})`
  );
  saveLocalDb(db);
  return { ok: true, msg: `Produto "${registro.nome}" salvo com sucesso!` };
}

export async function ajustarQuantidadeEstoque(
  sessao: SessaoAtiva,
  produtoId: string,
  novaQuantidade: number
): Promise<{ ok: boolean; msg: string }> {
  const empId = sessao.unidadeAtivaId;
  const qtd = Math.max(0, Number(novaQuantidade) || 0);

  const client = getTenantSupabaseClient(sessao);
  if (client) {
    const { error } = await client
      .from('produtos')
      .update({ estoque_atual: qtd, updated_at: new Date().toISOString() })
      .eq('id', produtoId)
      .eq('empresa_id', empId);
    if (error) return { ok: false, msg: error.message };
    notificarPlanilhaPosMutacao(sessao);
    return { ok: true, msg: 'Estoque atualizado!' };
  }

  const db = loadLocalDb();
  const prod = db.produtos.find((p) => p.id === produtoId && p.empresa_id === empId);
  if (!prod) return { ok: false, msg: 'Produto não encontrado.' };
  const anterior = prod.estoque_atual;
  prod.estoque_atual = qtd;
  appendLocalLog(
    db,
    empId,
    sessao.usuario.username,
    'AJUSTE_ESTOQUE',
    `${prod.nome}: ${anterior} -> ${qtd}`
  );
  saveLocalDb(db);
  return { ok: true, msg: `Estoque de "${prod.nome}" ajustado para ${qtd}.` };
}

// ====================================================================
// 5. FINANCEIRO (CONTAS A PAGAR & RECEBER / FIADOS)
// ====================================================================

async function gerarProximoIdContaPagar(
  client: ReturnType<typeof getTenantSupabaseClient>,
  empId: string,
  fornecedor: string,
  tipoDespesa?: 'AVULSA' | 'FIXA'
): Promise<string> {
  if (tipoDespesa === 'FIXA') {
    const slug = fornecedor
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return `FIXA_${slug || 'DESPESA'}`;
  }

  let maxAvulsa = 0;
  if (client) {
    const { data } = await client
      .from('contas_a_pagar')
      .select('id')
      .eq('empresa_id', empId);
    for (const row of (data || []) as Array<{ id: string }>) {
      const m = String(row.id || '').match(/^AVULSA_0*(\d+)$/i);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > maxAvulsa) maxAvulsa = n;
      }
    }
  } else {
    const db = loadLocalDb();
    for (const c of db.contasPagar.filter((x) => x.empresa_id === empId)) {
      const m = String(c.id || '').match(/^AVULSA_0*(\d+)$/i);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > maxAvulsa) maxAvulsa = n;
      }
    }
  }
  return `AVULSA_${String(maxAvulsa + 1).padStart(4, '0')}`;
}

async function gerarProximoIdCompra(
  client: ReturnType<typeof getTenantSupabaseClient>,
  empId: string
): Promise<string> {
  let maxCpr = 0;
  const extrairCpr = (txt: string) => {
    const m = String(txt || '').match(/CPR0*(\d+)/i);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > maxCpr) maxCpr = n;
    }
  };
  if (client) {
    const [rCp, rCmp] = await Promise.all([
      client.from('contas_a_pagar').select('id').eq('empresa_id', empId),
      client.from('compras').select('id,nota_fiscal').eq('empresa_id', empId)
    ]);
    ((rCp.data || []) as Array<{ id: string }>).forEach((r) => extrairCpr(r.id));
    ((rCmp.data || []) as Array<{ id: string; nota_fiscal?: string }>).forEach((r) => {
      extrairCpr(r.id);
      extrairCpr(r.nota_fiscal || '');
    });
  }
  return `CPR${String(maxCpr + 1).padStart(2, '0')}`;
}

export async function cadastrarContaPagar(
  sessao: SessaoAtiva,
  dados: {
    descricao: string;
    fornecedor: string;
    categoria: string;
    valor: number;
    vencimento: string;
    forma_pagamento?: string;
    tipo_despesa?: 'AVULSA' | 'FIXA';
  }
): Promise<{ ok: boolean; msg: string }> {
  const empId = sessao.unidadeAtivaId;
  const client = getTenantSupabaseClient(sessao);
  const idPadrao = await gerarProximoIdContaPagar(
    client,
    empId,
    dados.fornecedor.trim() || dados.descricao.trim(),
    dados.tipo_despesa
  );
  const conta: ContaPagar = {
    id: idPadrao,
    empresa_id: empId,
    descricao: dados.descricao.trim(),
    fornecedor: dados.fornecedor.trim(),
    categoria: dados.tipo_despesa || dados.categoria.trim() || 'Operacional',
    valor: Number(dados.valor) || 0,
    vencimento: dados.vencimento || new Date().toISOString().slice(0, 10),
    status: 'PENDENTE',
    forma_pagamento: dados.forma_pagamento || 'Boleto'
  };

  if (client) {
    const { error } = await client.from('contas_a_pagar').upsert(conta, { onConflict: 'id' });
    if (error) return { ok: false, msg: error.message };
    notificarPlanilhaPosMutacao(sessao);
    return { ok: true, msg: `Conta a pagar ${conta.id} cadastrada!` };
  }

  const db = loadLocalDb();
  db.contasPagar.unshift({ ...conta, tipo_despesa: dados.tipo_despesa });
  appendLocalLog(db, empId, sessao.usuario.username, 'CONTA_PAGAR_NOVA', `${conta.id} — ${conta.descricao} (${formatarMoeda(conta.valor)})`);
  saveLocalDb(db);
  return { ok: true, msg: `Conta a pagar ${conta.id} cadastrada!` };
}

export function extrairResumoCompra(c: Compra): {
  idCompra: string;
  forma: string;
  nfUrl: string;
  temNf: boolean;
} {
  const rawNf = String(c.nota_fiscal || '').trim();
  const parts = rawNf.split('|');
  const rawId = String(c.id || '').trim();
  let idCompra = rawId;
  if (parts[0] && /^(CPR|CMP)/i.test(parts[0].trim())) {
    idCompra = parts[0].trim();
  } else if (/^(CPR\d+)-\d+$/i.test(rawId)) {
    idCompra = rawId.replace(/-\d+$/, '');
  } else if (!/^CMP-(SH|SHEET)-/i.test(rawId) && /^CMP-[^-]+-\d{1,3}$/i.test(rawId)) {
    idCompra = rawId.replace(/-\d{1,3}$/, '');
  }

  let forma = (parts[1] || '').trim();
  if (!forma) {
    if (parts.length === 1 && rawNf && !/^(CPR|CMP)/i.test(rawNf) && !rawNf.startsWith('http')) {
      forma = rawNf;
    } else {
      forma = 'Dinheiro';
    }
  }
  const nfUrl =
    parts[2] && parts[2].startsWith('http')
      ? parts[2]
      : rawNf.startsWith('http')
      ? rawNf
      : '';
  return { idCompra, forma, nfUrl, temNf: Boolean(nfUrl) };
}

export function listarComprasSemNf(compras: Compra[] = []): Array<{
  idCompra: string;
  fornecedor: string;
  valorTotal: number;
  data_hora: string;
}> {
  const mapa = new Map<string, { idCompra: string; fornecedor: string; valorTotal: number; data_hora: string; temNf: boolean }>();
  for (const c of compras) {
    const { idCompra, temNf } = extrairResumoCompra(c);
    const grupoKey = `${idCompra}|${String(c.data_hora || '').slice(0, 10)}|${String(c.fornecedor || '').trim().toLowerCase()}`;
    const atual = mapa.get(grupoKey);
    if (!atual) {
      mapa.set(grupoKey, {
        idCompra,
        fornecedor: c.fornecedor || 'Fornecedor',
        valorTotal: Number(c.valor_total) || 0,
        data_hora: c.data_hora,
        temNf
      });
    } else {
      atual.valorTotal = Number((atual.valorTotal + (Number(c.valor_total) || 0)).toFixed(2));
      if (temNf) atual.temNf = true;
    }
  }
  return Array.from(mapa.values())
    .filter((x) => !x.temNf)
    .map(({ idCompra, fornecedor, valorTotal, data_hora }) => ({ idCompra, fornecedor, valorTotal, data_hora }));
}

export async function analisarNotaFiscalViaAppsScript(
  sessao: SessaoAtiva,
  base64: string,
  mimeType: string,
  fileName: string
): Promise<{
  ok: boolean;
  msg?: string;
  fornecedor?: string;
  numero_nf?: string;
  chave_acesso?: string;
  data_emissao?: string;
  forma_pagamento?: string;
  valor_total?: number;
  observacao?: string;
  itens?: Array<{ produto_lido: string; produto_sugerido: string; qtd: number; unit: number; total: number }>;
}> {
  const webAppUrl = obterWebappUrlSyncEmpresa(sessao);
  if (!webAppUrl) {
    return { ok: false, msg: 'URL do WebApp Apps Script não configurada em Config.' };
  }
  try {
    const res = await fetch(webAppUrl, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'ANALISAR_NF',
        empresa_id: sessao.unidadeAtivaId,
        base64,
        mimeType,
        fileName
      })
    });
    const json = (await res.json()) as Record<string, unknown>;
    return json as {
      ok: boolean;
      msg?: string;
      fornecedor?: string;
      numero_nf?: string;
      chave_acesso?: string;
      data_emissao?: string;
      forma_pagamento?: string;
      valor_total?: number;
      observacao?: string;
      itens?: Array<{ produto_lido: string; produto_sugerido: string; qtd: number; unit: number; total: number }>;
    };
  } catch (err) {
    return { ok: false, msg: `Falha ao ler nota fiscal: ${err instanceof Error ? err.message : String(err)}` };
  }
}

export async function uploadNotaFiscalCompra(
  sessao: SessaoAtiva,
  idCompra: string,
  base64: string,
  mimeType: string,
  fileName: string
): Promise<{ ok: boolean; msg: string; fileUrl?: string }> {
  const webAppUrl = obterWebappUrlSyncEmpresa(sessao);
  if (!webAppUrl) {
    return { ok: false, msg: 'URL do WebApp Apps Script não configurada.' };
  }
  try {
    const res = await fetch(webAppUrl, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'UPLOAD_NF_DRIVE',
        empresa_id: sessao.unidadeAtivaId,
        idCompra,
        base64,
        mimeType,
        fileName
      })
    });
    const json = (await res.json()) as { ok: boolean; msg?: string; fileUrl?: string };
    if (json.ok && json.fileUrl) {
      const client = getTenantSupabaseClient(sessao);
      if (client) {
        const { data: rows } = await client
          .from('compras')
          .select('id,nota_fiscal')
          .eq('empresa_id', sessao.unidadeAtivaId)
          .ilike('nota_fiscal', `${idCompra}%`);
        for (const r of (rows || []) as Array<{ id: string; nota_fiscal?: string }>) {
          const parts = String(r.nota_fiscal || idCompra).split('|');
          const forma = parts[1] || 'Dinheiro';
          await client
            .from('compras')
            .update({ nota_fiscal: `${idCompra}|${forma}|${json.fileUrl}` })
            .eq('id', r.id);
        }
      }
      notificarPlanilhaPosMutacao(sessao);
    }
    return { ok: Boolean(json.ok), msg: json.msg || 'Upload concluído!', fileUrl: json.fileUrl };
  } catch (err) {
    return { ok: false, msg: `Erro no upload da NF: ${err instanceof Error ? err.message : String(err)}` };
  }
}

export async function registrarCompraEstoque(
  sessao: SessaoAtiva,
  dados: {
    fornecedor: string;
    formaPagamento: string;
    vencimento?: string;
    observacao?: string;
    itens: Array<{ produto: Produto; quantidade: number; custoUnitario: number }>;
    nfArquivo?: { base64: string; mimeType: string; fileName: string } | null;
    comprasSemNfAtuais?: number;
  }
): Promise<{ ok: boolean; msg: string; idCompra?: string; semNf?: boolean; fileUrl?: string }> {
  const empId = sessao.unidadeAtivaId;
  const fornecedor = dados.fornecedor.trim() || 'Fornecedor';
  const forma = dados.formaPagamento.trim() || 'Dinheiro';
  if (!dados.itens || dados.itens.length === 0) {
    return { ok: false, msg: 'Adicione ao menos 1 produto ao carrinho de compras.' };
  }

  const agora = new Date().toISOString();
  const isPrazo = /BOLETO|CONSIGNADO|PRAZO/i.test(forma);
  let totalGeral = 0;
  for (const it of dados.itens) {
    if ((Number(it.quantidade) || 0) <= 0 || (Number(it.custoUnitario) || 0) < 0) {
      return { ok: false, msg: `Quantidade ou custo inválido para "${it.produto.nome}".` };
    }
    totalGeral += Number((Number(it.quantidade) * Number(it.custoUnitario)).toFixed(2));
  }
  totalGeral = Number(totalGeral.toFixed(2));

  const client = getTenantSupabaseClient(sessao);
  const idCompra = await gerarProximoIdCompra(client, empId);

  if (client) {
    const rowsCompras = dados.itens.map((it, idx) => {
      const qtd = Number(it.quantidade) || 0;
      const custoUnit = Number(it.custoUnitario) || 0;
      const valTot = Number((qtd * custoUnit).toFixed(2));
      return {
        id: `${idCompra}-${idx + 1}`,
        empresa_id: empId,
        data_hora: agora,
        fornecedor,
        produto_nome: it.produto.nome,
        quantidade: qtd,
        custo_unitario: custoUnit,
        valor_total: valTot,
        nota_fiscal: `${idCompra}|${forma}`,
        operador: sessao.usuario.username
      };
    });

    const { error: errCmp } = await client.from('compras').insert(rowsCompras);
    if (errCmp) return { ok: false, msg: errCmp.message };

    for (const it of dados.itens) {
      const qtd = Number(it.quantidade) || 0;
      const custoUnit = Number(it.custoUnitario) || 0;
      const { data: prodDb } = await client
        .from('produtos')
        .select('estoque_atual,custo_medio,preco_venda')
        .eq('id', it.produto.id)
        .eq('empresa_id', empId)
        .single();
      const estAnt = prodDb ? Number((prodDb as { estoque_atual: number }).estoque_atual) || 0 : Number(it.produto.estoque_atual) || 0;
      const custoAnt = prodDb ? Number((prodDb as { custo_medio: number }).custo_medio) || 0 : Number(it.produto.custo_medio) || 0;
      const vendaAtual = prodDb ? Number((prodDb as { preco_venda: number }).preco_venda) || 0 : Number(it.produto.preco_venda) || 0;

      const novoEst = Number((estAnt + qtd).toFixed(2));
      const novoCustoMedio =
        estAnt > 0 && custoAnt > 0
          ? Number((((estAnt * custoAnt) + (qtd * custoUnit)) / (estAnt + qtd)).toFixed(2))
          : Number(custoUnit.toFixed(2));
      const novaMargem =
        novoCustoMedio > 0
          ? Number((((vendaAtual - novoCustoMedio) / novoCustoMedio) * 100).toFixed(2))
          : 0;

      await client
        .from('produtos')
        .update({
          estoque_atual: novoEst,
          custo_medio: novoCustoMedio,
          margem_pct: novaMargem,
          updated_at: agora
        })
        .eq('id', it.produto.id)
        .eq('empresa_id', empId);
    }

    if (isPrazo) {
      await client.from('contas_a_pagar').upsert(
        {
          id: idCompra,
          empresa_id: empId,
          descricao: fornecedor,
          fornecedor,
          categoria: 'Fornecedores',
          valor: totalGeral,
          vencimento: dados.vencimento || agora.slice(0, 10),
          status: 'PENDENTE',
          forma_pagamento: forma
        },
        { onConflict: 'id' }
      );
    } else if (totalGeral > 0) {
      await client.from('caixa').insert({
        id: gerarId('CX'),
        empresa_id: empId,
        data_hora: agora,
        tipo: 'SAIDA',
        valor: totalGeral,
        forma_pagamento: forma,
        descricao: `COMPRA ${idCompra} (${fornecedor})${dados.observacao ? ' - ' + dados.observacao.trim() : ''}`,
        operador: sessao.usuario.username,
        origem: 'COMPRA'
      });
    }

    let fileUrl: string | undefined;
    let semNf = true;
    if (dados.nfArquivo && dados.nfArquivo.base64) {
      const up = await uploadNotaFiscalCompra(
        sessao,
        idCompra,
        dados.nfArquivo.base64,
        dados.nfArquivo.mimeType,
        dados.nfArquivo.fileName
      );
      if (up.ok && up.fileUrl) {
        fileUrl = up.fileUrl;
        semNf = false;
      }
    }

    await client.from('auditoria_logs').insert({
      id: gerarId('LOG'),
      empresa_id: empId,
      usuario: sessao.usuario.username,
      acao: 'COMPRA_REGISTRADA',
      detalhes: `${idCompra} | ${fornecedor} | ${dados.itens.length} item(ns) | ${formatarMoeda(totalGeral)} (${forma})${semNf ? ' | SEM ANEXO NF' : ' | NF ANEXADA'}`,
      canal: 'WEB'
    });

    const totalSemNfAgora = (dados.comprasSemNfAtuais || 0) + (semNf ? 1 : 0);
    if (semNf && String(sessao.usuario.perfil || '').toUpperCase() === 'GERENTE') {
      const empAlvo = sessao.empresa;
      if (empAlvo.telegram_bot_token && empAlvo.telegram_chat_id) {
        void enviarMensagemTelegram(
          empAlvo,
          `⚠️ <b>Alerta de Compra Sem Nota Fiscal — ${empAlvo.nome}</b>\n` +
            `Gerente: <b>${sessao.usuario.nome}</b>\n` +
            `Compra: <b>${idCompra}</b> (${fornecedor})\n` +
            `Valor: <b>${formatarMoeda(totalGeral)}</b> (${forma})\n` +
            `📌 <i>Compra registrada sem anexo de Nota Fiscal. Total pendente de anexo: <b>${totalSemNfAgora}</b> compra(s).</i>`
        );
      }
    }

    notificarPlanilhaPosMutacao(sessao);
    return {
      ok: true,
      idCompra,
      semNf,
      fileUrl,
      msg: isPrazo
        ? `Compra ${idCompra} (${formatarMoeda(totalGeral)}) lançada! Estoque atualizado e conta a pagar ${idCompra} gerada.`
        : `Compra ${idCompra} (${formatarMoeda(totalGeral)}) lançada! Estoque e saída no Caixa atualizados.`
    };
  }

  const db = loadLocalDb();
  for (const it of dados.itens) {
    const prod = db.produtos.find((p) => p.id === it.produto.id && p.empresa_id === empId);
    if (prod) {
      const estAnt = Number(prod.estoque_atual) || 0;
      const custoAnt = Number(prod.custo_medio) || 0;
      prod.estoque_atual = Number((estAnt + it.quantidade).toFixed(2));
      prod.custo_medio =
        estAnt > 0 && custoAnt > 0
          ? Number((((estAnt * custoAnt) + (it.quantidade * it.custoUnitario)) / (estAnt + it.quantidade)).toFixed(2))
          : Number(it.custoUnitario.toFixed(2));
      prod.margem_pct =
        prod.custo_medio > 0
          ? Number((((prod.preco_venda - prod.custo_medio) / prod.custo_medio) * 100).toFixed(2))
          : 0;
    }
  }
  if (isPrazo) {
    db.contasPagar.unshift({
      id: idCompra,
      empresa_id: empId,
      descricao: fornecedor,
      fornecedor,
      categoria: 'Fornecedores',
      valor: totalGeral,
      vencimento: dados.vencimento || agora.slice(0, 10),
      status: 'PENDENTE',
      forma_pagamento: forma
    });
  } else if (totalGeral > 0) {
    db.caixa.unshift({
      id: gerarId('CX'),
      empresa_id: empId,
      data_hora: agora,
      tipo: 'SAIDA',
      valor: totalGeral,
      forma_pagamento: forma,
      descricao: `COMPRA ${idCompra} (${fornecedor})`,
      operador: sessao.usuario.username,
      origem: 'COMPRA'
    });
  }
  appendLocalLog(db, empId, sessao.usuario.username, 'COMPRA_REGISTRADA', `${idCompra} — ${formatarMoeda(totalGeral)}`);
  saveLocalDb(db);
  return { ok: true, idCompra, msg: `Compra ${idCompra} registrada com sucesso!` };
}

export function contaPagarEstaCancelada(
  c: Pick<ContaPagar, 'status' | 'forma_pagamento' | 'descricao'>
): boolean {
  return (
    String(c.status || '').toUpperCase().includes('CANCEL') ||
    String(c.forma_pagamento || '').toUpperCase() === 'CANCELADO' ||
    String(c.descricao || '').includes('[CANCELADA:')
  );
}

export function contaPagarEhTaxaEntrega(c: Pick<ContaPagar, 'id' | 'categoria'>): boolean {
  const cat = String(c.categoria || '').toLowerCase();
  return (
    /^TXE-/i.test(String(c.id || '').trim()) ||
    cat.includes('taxa de entrega')
  );
}

export function contaPagarEhComissao(c: Pick<ContaPagar, 'id' | 'categoria'>): boolean {
  const cat = String(c.categoria || '').toLowerCase();
  const id = String(c.id || '').trim();
  return (
    /^COM(?:\s|-|10-)/i.test(id) ||
    cat.includes('comissão 10%') ||
    cat.includes('comissao 10%')
  );
}

async function registrarOuAcumularComissaoVendedor10(
  client: ReturnType<typeof getTenantSupabaseClient>,
  empId: string,
  vendedorBruto: string,
  comandaCodigo: string,
  valorComissao: number,
  agoraIso: string,
  dbLocal?: LocalDatabase
): Promise<void> {
  const com = Number(valorComissao) || 0;
  if (!(com > 0)) return;
  const nomeLimpo = vendedorBruto.trim().replace(/^Vend\.\s*/i, '') || 'Vendedor';
  const fornecedorVend = `Vend. ${nomeLimpo}`;
  const mNum = String(comandaCodigo || '').match(/(\d+)/);
  const baseComId = mNum ? `COM ${String(Number(mNum[1])).padStart(4, '0')}` : `COM ${comandaCodigo}`;

  if (client) {
    const { data } = await client.from('contas_a_pagar').select('id').eq('empresa_id', empId);
    const idsExistentes = new Set((data || []).map((r: { id: string }) => String(r.id || '').trim().toUpperCase()));
    let novoId = baseComId;
    let seq = 2;
    while (idsExistentes.has(novoId.toUpperCase())) {
      novoId = `${baseComId}-${seq++}`;
    }
    await client.from('contas_a_pagar').insert({
      id: novoId,
      empresa_id: empId,
      descricao: `Comissão 10% — Comanda ${comandaCodigo}`,
      categoria: 'Comissão 10% (Vendedor)',
      fornecedor: fornecedorVend,
      valor: Number(com.toFixed(2)),
      vencimento: agoraIso.slice(0, 10),
      status: 'PENDENTE',
      forma_pagamento: 'Dinheiro'
    });
    return;
  }

  if (!dbLocal) return;
  const idsLocal = new Set(
    dbLocal.contasPagar.filter((x) => x.empresa_id === empId).map((x) => String(x.id || '').trim().toUpperCase())
  );
  let novoId = baseComId;
  let seq = 2;
  while (idsLocal.has(novoId.toUpperCase())) {
    novoId = `${baseComId}-${seq++}`;
  }
  dbLocal.contasPagar.unshift({
    id: novoId,
    empresa_id: empId,
    descricao: `Comissão 10% — Comanda ${comandaCodigo}`,
    categoria: 'Comissão 10% (Vendedor)',
    fornecedor: fornecedorVend,
    valor: Number(com.toFixed(2)),
    vencimento: agoraIso.slice(0, 10),
    status: 'PENDENTE',
    forma_pagamento: 'Dinheiro'
  });
}

async function registrarOuAcumularTaxaEntregaMotoboy(
  client: ReturnType<typeof getTenantSupabaseClient>,
  empId: string,
  motoboyBruto: string,
  pedidoCodigo: string,
  taxaEntrega: number,
  agoraIso: string,
  dbLocal?: LocalDatabase
): Promise<void> {
  const taxa = Number(taxaEntrega) || 0;
  if (!(taxa > 0)) return;
  const motoboy = motoboyBruto.trim() || 'Motoboy';
  const motoboyKey = motoboy.toLowerCase();

  if (client) {
    const { data } = await client
      .from('contas_a_pagar')
      .select('*')
      .eq('empresa_id', empId);
    const lista = (data || []) as ContaPagar[];
    const pendente = lista.find(
      (c) =>
        /^TXE-/i.test(String(c.id || '')) &&
        c.status !== 'PAGO' &&
        !contaPagarEstaCancelada(c) &&
        String(c.fornecedor || '').trim().toLowerCase() === motoboyKey
    );

    if (pendente) {
      const novoValor = Number(((Number(pendente.valor) || 0) + taxa).toFixed(2));
      const novaDesc = pendente.descricao.includes(pedidoCodigo)
        ? pendente.descricao
        : `${pendente.descricao}, ${pedidoCodigo}`;
      await client
        .from('contas_a_pagar')
        .update({
          valor: novoValor,
          descricao: novaDesc,
          vencimento: agoraIso.slice(0, 10)
        })
        .eq('id', pendente.id)
        .eq('empresa_id', empId);
      return;
    }

    let maxTxe = 0;
    for (const c of lista) {
      const m = String(c.id || '').match(/^TXE-0*(\d+)$/i);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > maxTxe) maxTxe = n;
      }
    }
    const novoId = `TXE-${String(maxTxe + 1).padStart(3, '0')}`;
    await client.from('contas_a_pagar').insert({
      id: novoId,
      empresa_id: empId,
      descricao: `Taxa Entrega — ${pedidoCodigo}`,
      categoria: 'Taxa de Entrega',
      fornecedor: motoboy,
      valor: Number(taxa.toFixed(2)),
      vencimento: agoraIso.slice(0, 10),
      status: 'PENDENTE',
      forma_pagamento: 'Dinheiro'
    });
    return;
  }

  if (!dbLocal) return;
  const daEmpresa = dbLocal.contasPagar.filter((x) => x.empresa_id === empId);
  const pendente = daEmpresa.find(
    (c) =>
      /^TXE-/i.test(String(c.id || '')) &&
      c.status !== 'PAGO' &&
      !contaPagarEstaCancelada(c) &&
      String(c.fornecedor || '').trim().toLowerCase() === motoboyKey
  );
  if (pendente) {
    pendente.valor = Number(((Number(pendente.valor) || 0) + taxa).toFixed(2));
    if (!pendente.descricao.includes(pedidoCodigo)) {
      pendente.descricao = `${pendente.descricao}, ${pedidoCodigo}`;
    }
    pendente.vencimento = agoraIso.slice(0, 10);
    return;
  }

  let maxTxe = 0;
  for (const c of daEmpresa) {
    const m = String(c.id || '').match(/^TXE-0*(\d+)$/i);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > maxTxe) maxTxe = n;
    }
  }
  const novoId = `TXE-${String(maxTxe + 1).padStart(3, '0')}`;
  dbLocal.contasPagar.unshift({
    id: novoId,
    empresa_id: empId,
    descricao: `Taxa Entrega — ${pedidoCodigo}`,
    categoria: 'Taxa de Entrega',
    fornecedor: motoboy,
    valor: Number(taxa.toFixed(2)),
    vencimento: agoraIso.slice(0, 10),
    status: 'PENDENTE',
    forma_pagamento: 'Dinheiro',
    tipo_despesa: 'AVULSA'
  });
}

export function movimentoCaixaEstaCancelado(
  cx: Pick<MovimentoCaixa, 'forma_pagamento' | 'origem'>
): boolean {
  return (
    String(cx.forma_pagamento || '').toUpperCase() === 'CANCELADO' ||
    String(cx.origem || '').toUpperCase() === 'CANCELADO'
  );
}

export async function cancelarContaPagar(
  sessao: SessaoAtiva,
  conta: ContaPagar,
  motivo: string
): Promise<{ ok: boolean; msg: string }> {
  const perfil = String(sessao.usuario.perfil || '').toUpperCase();
  if (perfil !== 'DONO' && perfil !== 'ADMIN') {
    return { ok: false, msg: 'Apenas Dono e Admin podem cancelar uma conta a pagar.' };
  }
  const motivoLimpo = motivo.trim();
  if (!motivoLimpo) {
    return { ok: false, msg: 'Informe a explicação/motivo do cancelamento.' };
  }
  if (contaPagarEstaCancelada(conta)) {
    return { ok: false, msg: 'Esta conta a pagar já está cancelada.' };
  }
  if (String(conta.status || '').toUpperCase() === 'PAGO') {
    return { ok: false, msg: 'Não é possível cancelar uma conta já paga.' };
  }

  const empId = sessao.unidadeAtivaId;
  const agora = new Date().toISOString();
  const novaDescricao = conta.descricao.includes('[CANCELADA:')
    ? conta.descricao
    : `${conta.descricao} [CANCELADA: ${motivoLimpo}]`;

  const client = getTenantSupabaseClient(sessao);
  if (client) {
    const { error } = await client
      .from('contas_a_pagar')
      .update({
        status: 'PAGO',
        forma_pagamento: 'CANCELADO',
        descricao: novaDescricao
      })
      .eq('id', conta.id)
      .eq('empresa_id', empId);
    if (error) return { ok: false, msg: error.message };

    await client.from('caixa').insert({
      id: gerarId('CX'),
      empresa_id: empId,
      data_hora: agora,
      tipo: 'SAIDA',
      valor: Number(conta.valor) || 0,
      forma_pagamento: 'CANCELADO',
      descricao: `CANCELADA (${conta.id}): ${conta.descricao} | Motivo: ${motivoLimpo}`,
      operador: sessao.usuario.username,
      origem: 'CANCELADO'
    });

    await client.from('auditoria_logs').insert({
      id: gerarId('LOG'),
      empresa_id: empId,
      usuario: sessao.usuario.username,
      acao: 'CONTA_PAGAR_CANCELADA',
      detalhes: `${conta.id} | ${conta.descricao} | ${formatarMoeda(conta.valor)} | Motivo: ${motivoLimpo}`,
      canal: 'WEB'
    });

    notificarPlanilhaPosMutacao(sessao);
    return {
      ok: true,
      msg: `Conta "${conta.descricao}" cancelada e registrada no extrato (não contabilizada).`
    };
  }

  const db = loadLocalDb();
  const alvo = db.contasPagar.find((c) => c.id === conta.id && c.empresa_id === empId);
  if (!alvo) return { ok: false, msg: 'Conta não encontrada.' };
  alvo.status = 'CANCELADO';
  alvo.forma_pagamento = 'CANCELADO';
  alvo.descricao = novaDescricao;

  db.caixa.unshift({
    id: gerarId('CX'),
    empresa_id: empId,
    data_hora: agora,
    tipo: 'SAIDA',
    valor: Number(alvo.valor) || 0,
    forma_pagamento: 'CANCELADO',
    descricao: `CANCELADA (${alvo.id}): ${conta.descricao} | Motivo: ${motivoLimpo}`,
    operador: sessao.usuario.username,
    origem: 'CANCELADO'
  });

  appendLocalLog(
    db,
    empId,
    sessao.usuario.username,
    'CONTA_PAGAR_CANCELADA',
    `${alvo.id} | ${conta.descricao} | ${formatarMoeda(alvo.valor)} | Motivo: ${motivoLimpo}`
  );
  saveLocalDb(db);
  return {
    ok: true,
    msg: `Conta "${conta.descricao}" cancelada e registrada no extrato (não contabilizada).`
  };
}

export async function pagarContaPagar(
  sessao: SessaoAtiva,
  conta: ContaPagar,
  formaPagamento: FormaPagamento | string,
  comprovante?: { base64: string; mimeType: string; fileName: string } | null
): Promise<{ ok: boolean; msg: string }> {
  const empId = sessao.unidadeAtivaId;
  const agora = new Date().toISOString();
  let comprovanteUrl = '';
  let infoComprovante = '';

  if (comprovante && comprovante.base64) {
    const nomeArq = `${conta.id}_${Date.now()}_${comprovante.fileName}`;
    try {
      const byteStr = atob(comprovante.base64);
      const bytes = new Uint8Array(byteStr.length);
      for (let i = 0; i < byteStr.length; i++) bytes[i] = byteStr.charCodeAt(i);
      const blob = new Blob([bytes], { type: comprovante.mimeType || 'application/octet-stream' });

      const anoMes = `${agora.slice(0, 4)}-${agora.slice(5, 7)}`;
      await salvarArquivoNaPastaLocal(sessao.empresa.nome, 'Despesas', anoMes, nomeArq, blob).catch(() => null);

      const drv = await enviarComprovanteDespesaParaDrive(
        empId,
        sessao.empresa.nome,
        nomeArq,
        blob,
        comprovante.mimeType
      ).catch(() => ({ ok: false, fileUrl: '' }));
      if (drv.ok && drv.fileUrl) {
        comprovanteUrl = drv.fileUrl;
      } else {
        const webAppUrl = obterWebappUrlSyncEmpresa(sessao);
        if (webAppUrl) {
          const resp = await fetch(webAppUrl, {
            method: 'POST',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
              action: 'UPLOAD_NF_DRIVE',
              empresa_id: empId,
              idCompra: `DESP-${conta.id}`,
              base64: comprovante.base64,
              mimeType: comprovante.mimeType,
              fileName: `Despesas_${nomeArq}`
            })
          }).catch(() => null);
          if (resp) {
            const j = (await resp.json().catch(() => ({}))) as { ok?: boolean; fileUrl?: string };
            if (j.ok && j.fileUrl) comprovanteUrl = j.fileUrl;
          }
        }
      }
      infoComprovante = comprovanteUrl ? ` | Comprovante: ${comprovanteUrl}` : ` | Comprovante local: Despesas/${anoMes}/${nomeArq}`;
    } catch {
      infoComprovante = ` | Comprovante: ${nomeArq}`;
    }
  }

  const novaDescricao = infoComprovante && !String(conta.descricao || '').includes('Comprovante:')
    ? `${conta.descricao}${infoComprovante}`
    : conta.descricao;

  const client = getTenantSupabaseClient(sessao);
  if (client) {
    const { error } = await client
      .from('contas_a_pagar')
      .update({
        status: 'PAGO',
        data_pagamento: agora,
        forma_pagamento: formaPagamento,
        descricao: novaDescricao
      })
      .eq('id', conta.id)
      .eq('empresa_id', empId);
    if (error) return { ok: false, msg: error.message };

    const ehTaxa = contaPagarEhTaxaEntrega(conta);
    const descCaixa = ehTaxa
      ? `Pgto Taxa/Comissão ${conta.id} — ${conta.fornecedor || conta.descricao}${infoComprovante}`
      : `Pgto Conta: ${novaDescricao}`;
    await client.from('caixa').insert({
      id: gerarId('CX'),
      empresa_id: empId,
      data_hora: agora,
      tipo: 'SAIDA',
      valor: conta.valor,
      forma_pagamento: formaPagamento,
      descricao: descCaixa,
      operador: sessao.usuario.username,
      origem: ehTaxa ? 'Taxa/Comissão' : 'Financeiro'
    });
    if (infoComprovante) {
      await client.from('auditoria_logs').insert({
        id: gerarId('LOG'),
        empresa_id: empId,
        usuario: sessao.usuario.username,
        acao: 'COMPROVANTE_DESPESA',
        detalhes: `${conta.id} | ${conta.descricao}${infoComprovante}`,
        canal: 'WEB'
      });
    }
    notificarPlanilhaPosMutacao(sessao);
    return {
      ok: true,
      msg: ehTaxa
        ? `Pago (${conta.fornecedor || 'Beneficiário'}) e abatido do Caixa!`
        : `Conta "${conta.descricao}" paga${infoComprovante ? ' com comprovante salvo em Despesas' : ''} e saída lançada no Caixa!`
    };
  }

  const db = loadLocalDb();
  const alvo = db.contasPagar.find((c) => c.id === conta.id && c.empresa_id === empId);
  if (!alvo) return { ok: false, msg: 'Conta não encontrada.' };
  alvo.status = 'PAGO';
  alvo.data_pagamento = agora;
  alvo.forma_pagamento = formaPagamento;
  alvo.descricao = novaDescricao;

  const ehTaxaLocal = contaPagarEhTaxaEntrega(alvo);
  db.caixa.unshift({
    id: gerarId('CX'),
    empresa_id: empId,
    data_hora: agora,
    tipo: 'SAIDA',
    valor: alvo.valor,
    forma_pagamento: formaPagamento,
    descricao: ehTaxaLocal
      ? `Pgto Taxa Entrega ${alvo.id} — ${alvo.fornecedor || alvo.descricao}`
      : `Pgto Conta: ${alvo.descricao}`,
    operador: sessao.usuario.username,
    origem: ehTaxaLocal ? 'Taxa Motoboy' : 'Financeiro'
  });
  appendLocalLog(db, empId, sessao.usuario.username, 'CONTA_PAGA', `${alvo.descricao} (${formatarMoeda(alvo.valor)})`);
  saveLocalDb(db);
  return {
    ok: true,
    msg: ehTaxaLocal
      ? `Taxa ${alvo.id} paga ao motoboy (${alvo.fornecedor || 'Motoboy'}) e abatida do Caixa!`
      : `Conta "${alvo.descricao}" paga e lançada no Caixa!`
  };
}

export async function receberFiado(
  sessao: SessaoAtiva,
  conta: ContaReceber,
  formaPagamento: FormaPagamento,
  valorRecebido?: number
): Promise<{ ok: boolean; msg: string }> {
  const empId = sessao.unidadeAtivaId;
  const agora = new Date().toISOString();
  const saldoAtual = Number(conta.valor) || 0;
  const valorFinal = valorRecebido !== undefined ? Number(valorRecebido) : saldoAtual;

  if (!(valorFinal > 0)) {
    return { ok: false, msg: 'Informe um valor de recebimento maior que zero.' };
  }
  if (valorFinal > saldoAtual + 0.01) {
    return { ok: false, msg: `O valor informado excede o saldo pendente (${formatarMoeda(saldoAtual)}).` };
  }

  const ehQuitacao = valorFinal >= saldoAtual - 0.009;
  const valorLancado = ehQuitacao ? saldoAtual : Number(valorFinal.toFixed(2));
  const restante = ehQuitacao ? 0 : Number((saldoAtual - valorLancado).toFixed(2));

  const client = getTenantSupabaseClient(sessao);
  if (client) {
    if (ehQuitacao) {
        const { error } = await client
          .from('contas_a_receber')
          .update({ status: 'PAGO', data_pagamento: agora, forma_pagamento: formaPagamento })
          .eq('id', conta.id)
          .eq('empresa_id', empId);
        if (error) return { ok: false, msg: error.message };
      } else {
        const { error: updErr } = await client
          .from('contas_a_receber')
          .update({ valor: restante })
          .eq('id', conta.id)
          .eq('empresa_id', empId);
        if (updErr) return { ok: false, msg: updErr.message };

        await client.from('contas_a_receber').insert({
          id: gerarId('REC'),
          empresa_id: empId,
          data: agora,
          cliente: conta.cliente,
          descricao: `Abatimento parcial: ${conta.descricao}`,
          valor: valorLancado,
          status: 'PAGO',
          data_pagamento: agora,
          forma_pagamento: formaPagamento,
          comanda_origem: conta.id
        });
      }

      await client.from('caixa').insert({
        id: gerarId('CX'),
        empresa_id: empId,
        data_hora: agora,
        tipo: 'ENTRADA',
        valor: valorLancado,
        forma_pagamento: formaPagamento,
        descricao: `${ehQuitacao ? 'Recebimento Fiado' : 'Recebimento Parcial Fiado'}: ${conta.cliente}`,
        operador: sessao.usuario.username,
        origem: 'Financeiro'
      });

      await client.from('auditoria_logs').insert({
        id: gerarId('LOG'),
        empresa_id: empId,
        usuario: sessao.usuario.username,
        acao: ehQuitacao ? 'FIADO_RECEBIDO' : 'FIADO_PARCIAL',
        detalhes: `${conta.cliente}: ${formatarMoeda(valorLancado)}${ehQuitacao ? ' (Quitado)' : ` | Restante: ${formatarMoeda(restante)}`}`,
        canal: 'WEB'
      });

      notificarPlanilhaPosMutacao(sessao);
      return {
        ok: true,
        msg: ehQuitacao
          ? `Recebimento integral de ${conta.cliente} (${formatarMoeda(valorLancado)}) lançado no Caixa!`
          : `Abatimento de ${formatarMoeda(valorLancado)} registrado para ${conta.cliente}! Restam ${formatarMoeda(restante)}.`
      };
  }

  const db = loadLocalDb();
  const alvo = db.contasReceber.find((c) => c.id === conta.id && c.empresa_id === empId);
  if (!alvo) return { ok: false, msg: 'Recebível não encontrado.' };

  if (ehQuitacao) {
    alvo.status = 'PAGO';
    alvo.data_pagamento = agora;
    alvo.forma_pagamento = formaPagamento;
  } else {
    alvo.valor = restante;
    db.contasReceber.unshift({
      id: gerarId('REC'),
      empresa_id: empId,
      data: agora,
      cliente: alvo.cliente,
      descricao: `Abatimento parcial: ${alvo.descricao}`,
      valor: valorLancado,
      status: 'PAGO',
      data_pagamento: agora,
      forma_pagamento: formaPagamento,
      comanda_origem: alvo.id
    });
  }

  db.caixa.unshift({
    id: gerarId('CX'),
    empresa_id: empId,
    data_hora: agora,
    tipo: 'ENTRADA',
    valor: valorLancado,
    forma_pagamento: formaPagamento,
    descricao: `${ehQuitacao ? 'Recebimento Fiado' : 'Recebimento Parcial Fiado'}: ${alvo.cliente}`,
    operador: sessao.usuario.username,
    origem: 'Financeiro'
  });
  appendLocalLog(
    db,
    empId,
    sessao.usuario.username,
    ehQuitacao ? 'FIADO_RECEBIDO' : 'FIADO_PARCIAL',
    `${alvo.cliente} (${formatarMoeda(valorLancado)})${ehQuitacao ? '' : ` | Restante: ${formatarMoeda(restante)}`}`
  );
  saveLocalDb(db);
  return {
    ok: true,
    msg: ehQuitacao
      ? `Recebimento de ${alvo.cliente} lançado no Caixa!`
      : `Abatimento de ${formatarMoeda(valorLancado)} lançado! Saldo restante: ${formatarMoeda(restante)}.`
  };
}

// ====================================================================
// 6. EQUIPE (RBAC: 1 ÚNICO ADMIN) & CONFIGURAÇÕES / REPLICAÇÃO
// ====================================================================

export async function criarUsuarioEquipe(
  sessao: SessaoAtiva,
  dados: { username: string; nome: string; email: string; perfil: PerfilUsuario; senha: string }
): Promise<{ ok: boolean; msg: string }> {
  // Regra estrita: nunca criar outro ADMIN
  if (dados.perfil === 'ADMIN') {
    return {
      ok: false,
      msg: 'Não é permitido criar novos usuários ADMIN. Existe apenas 1 administrador técnico no sistema.'
    };
  }

  const empId = sessao.unidadeAtivaId;
  const uname = dados.username.trim().toLowerCase();
  const senhaHash = await sha256Hex(dados.senha.trim());
  const novoUser: Usuario & { senha_hash: string } = {
    id: gerarId('USR'),
    empresa_id: empId,
    grupo_id: sessao.empresa.grupo_id,
    username: uname,
    nome: dados.nome.trim(),
    email: dados.email.trim().toLowerCase(),
    senha_hash: senhaHash,
    perfil: dados.perfil,
    ativo: true
  };

  const client = getTenantSupabaseClient(sessao);
  if (client) {
    const { error } = await client.from('usuarios').insert(novoUser);
    if (error) return { ok: false, msg: error.message };
    notificarPlanilhaPosMutacao(sessao);
    return { ok: true, msg: `Colaborador ${novoUser.nome} cadastrado com sucesso!` };
  }

  const db = loadLocalDb();
  const dup = db.usuarios.some((u) => u.empresa_id === empId && u.username.toLowerCase() === uname);
  if (dup) return { ok: false, msg: 'Já existe um colaborador com este usuário nesta unidade.' };

  db.usuarios.push(novoUser);
  appendLocalLog(db, empId, sessao.usuario.username, 'USUARIO_CRIADO', `${novoUser.nome} (${novoUser.perfil})`);
  saveLocalDb(db);
  return { ok: true, msg: `Colaborador ${novoUser.nome} cadastrado!` };
}

export async function alternarStatusUsuario(
  sessao: SessaoAtiva,
  usuarioAlvo: Usuario
): Promise<{ ok: boolean; msg: string }> {
  if (usuarioAlvo.perfil === 'ADMIN') {
    return { ok: false, msg: 'O administrador técnico único não pode ser bloqueado.' };
  }
  const novoStatus = !usuarioAlvo.ativo;
  const empId = sessao.unidadeAtivaId;

  const client = getTenantSupabaseClient(sessao);
  if (client) {
    const { error } = await client
      .from('usuarios')
      .update({ ativo: novoStatus })
      .eq('id', usuarioAlvo.id)
      .eq('empresa_id', empId);
    if (error) return { ok: false, msg: error.message };
    notificarPlanilhaPosMutacao(sessao);
    return { ok: true, msg: `Usuário ${novoStatus ? 'ativado' : 'desativado'}.` };
  }

  const db = loadLocalDb();
  const u = db.usuarios.find((x) => x.id === usuarioAlvo.id && x.empresa_id === empId);
  if (u) {
    u.ativo = novoStatus;
    saveLocalDb(db);
  }
  return { ok: true, msg: `Usuário ${novoStatus ? 'ativado' : 'desativado'}.` };
}

export async function excluirUsuario(
  sessao: SessaoAtiva,
  usuarioAlvo: Usuario
): Promise<{ ok: boolean; msg: string }> {
  if (usuarioAlvo.perfil === 'ADMIN') {
    return { ok: false, msg: 'O administrador técnico único não pode ser excluído.' };
  }
  if (usuarioAlvo.id === sessao.usuario.id) {
    return { ok: false, msg: 'Você não pode excluir seu próprio usuário logado.' };
  }
  const empId = sessao.unidadeAtivaId;

  const client = getTenantSupabaseClient(sessao);
  if (client) {
    const { error } = await client
      .from('usuarios')
      .delete()
      .eq('id', usuarioAlvo.id)
      .eq('empresa_id', empId);
    if (error) return { ok: false, msg: error.message };
    notificarPlanilhaPosMutacao(sessao);
    return { ok: true, msg: `Membro "${usuarioAlvo.nome}" excluído da equipe.` };
  }

  const db = loadLocalDb();
  db.usuarios = db.usuarios.filter((x) => !(x.id === usuarioAlvo.id && x.empresa_id === empId));
  saveLocalDb(db);
  return { ok: true, msg: `Membro "${usuarioAlvo.nome}" excluído da equipe.` };
}

export async function salvarConfiguracoesEmpresa(
  sessao: SessaoAtiva,
  dados: Partial<Empresa>,
  extras?: Partial<ConfigsSistemaExtras>
): Promise<{ ok: boolean; msg: string }> {
  const empId = sessao.unidadeAtivaId;
  if (extras) {
    salvarConfigsExtrasLocal(empId, extras);
  }

  const client = getTenantSupabaseClient(sessao);
  if (client) {
    const planilhaMatch = extras?.spreadsheetUrl?.match(/\/d\/([a-zA-Z0-9-_]+)/);
    const patchEmp: Record<string, unknown> = {
      nome: dados.nome,
      dono_nome: dados.dono_nome,
      cnpj: dados.cnpj,
      telefone: dados.telefone,
      cidade: dados.cidade,
      chave_pix: dados.chave_pix,
      telegram_bot_token: dados.telegram_bot_token,
      telegram_chat_id: dados.telegram_chat_id,
      updated_at: new Date().toISOString()
    };
    if (planilhaMatch?.[1]) {
      patchEmp.planilha_espelho_id = planilhaMatch[1];
    }

    const { error } = await client
      .from('empresas')
      .update(patchEmp)
      .eq('id', empId);
    if (error) return { ok: false, msg: error.message };

    if (empId === 'EMP-MATRIZ-DEFAULT' || sessao.empresa.tipo === 'MATRIZ') {
      try {
        const agoraIso = new Date().toISOString();
        const rowsCfg: Array<{ chave: string; valor: string; updated_at: string }> = [
          { chave: 'NOME_DEPOSITO', valor: String(dados.nome || ''), updated_at: agoraIso },
          { chave: 'DONO', valor: String(dados.dono_nome || ''), updated_at: agoraIso },
          { chave: 'CNPJ', valor: String(dados.cnpj || ''), updated_at: agoraIso },
          { chave: 'TELEFONE', valor: String(dados.telefone || ''), updated_at: agoraIso },
          { chave: 'CIDADE', valor: String(dados.cidade || ''), updated_at: agoraIso },
          { chave: 'CHAVE_PIX', valor: String(dados.chave_pix || ''), updated_at: agoraIso },
          { chave: 'TELEGRAM_BOT_TOKEN', valor: String(dados.telegram_bot_token || ''), updated_at: agoraIso },
          { chave: 'TELEGRAM_DONO_CHAT_ID', valor: String(dados.telegram_chat_id || ''), updated_at: agoraIso }
        ];
        if (extras) {
          if (extras.driveUrl !== undefined) {
            rowsCfg.push({ chave: 'DRIVE_URL', valor: extras.driveUrl, updated_at: agoraIso });
          }
          if (extras.spreadsheetUrl !== undefined) {
            rowsCfg.push({ chave: 'SPREADSHEET_URL', valor: extras.spreadsheetUrl, updated_at: agoraIso });
          }
          if (extras.webappUrl !== undefined) {
            rowsCfg.push({ chave: 'WEBAPP_URL', valor: extras.webappUrl, updated_at: agoraIso });
            registrarWebappUrlEmpresa(empId, extras.webappUrl);
          }
          if (extras.permitirEstoqueNegativo !== undefined) {
            rowsCfg.push({
              chave: 'PERMITIR_ESTOQUE_NEGATIVO',
              valor: extras.permitirEstoqueNegativo ? 'SIM' : 'NAO',
              updated_at: agoraIso
            });
          }
          if (extras.autoRefresh !== undefined) {
            rowsCfg.push({
              chave: 'AUTO_REFRESH',
              valor: extras.autoRefresh ? 'SIM' : 'NAO',
              updated_at: agoraIso
            });
          }
          if (extras.intervaloRefreshMin !== undefined) {
            rowsCfg.push({
              chave: 'INTERVALO_REFRESH',
              valor: String(extras.intervaloRefreshMin),
              updated_at: agoraIso
            });
          }
          if (extras.backupAuto !== undefined) {
            rowsCfg.push({
              chave: 'BACKUP_AUTO',
              valor: extras.backupAuto ? 'SIM' : 'NAO',
              updated_at: agoraIso
            });
          }
        }
        const { error: errCfg } = await client.from('config').upsert(rowsCfg, { onConflict: 'chave' });
        if (errCfg) {
          for (const row of rowsCfg) {
            await client
              .from('config')
              .update({ valor: row.valor, updated_at: row.updated_at })
              .eq('chave', row.chave);
          }
        }
      } catch {
        // Sync com tabela legada config não bloqueia gravação multi-tenant em empresas
      }
    }

    notificarPlanilhaPosMutacao(sessao);
    return { ok: true, msg: 'Configurações da empresa salvas no Supabase!' };
  }

  const db = loadLocalDb();
  const emp = db.empresas.find((e) => e.id === empId);
  if (emp) {
    Object.assign(emp, dados);
    saveLocalDb(db);
  }
  return { ok: true, msg: 'Configurações salvas!' };
}

export async function criarNovaUnidade(
  sessao: SessaoAtiva,
  payload: {
    tipo: 'FILIAL' | 'NOVA_EMPRESA';
    nome: string;
    copiarProdutos: boolean;
    copiarClientes: boolean;
  }
): Promise<{ ok: boolean; msg: string; unidadesAtualizadas?: UnidadeResumo[]; empresaIdCriada?: string }> {
  if (payload.tipo === 'NOVA_EMPRESA' && sessao.usuario.perfil !== 'ADMIN') {
    return { ok: false, msg: 'Apenas o Administrador Técnico pode criar uma Nova Empresa independente.' };
  }
  if (payload.tipo === 'FILIAL' && sessao.usuario.perfil !== 'DONO' && sessao.usuario.perfil !== 'ADMIN') {
    return { ok: false, msg: 'Apenas o Dono ou Administrador podem criar uma Filial.' };
  }

  const client = getTenantSupabaseClient(sessao);
  if (client) {
    const { data, error } = await client.rpc('rpc_criar_unidade', {
        p_tipo: payload.tipo,
        p_nome: payload.nome.trim(),
        p_matriz_empresa_id: sessao.unidadeAtivaId,
        p_copiar_produtos: payload.copiarProdutos,
        p_copiar_clientes: payload.copiarClientes
      });
      if (error) return { ok: false, msg: error.message };
      const res = data as { ok: boolean; msg?: string; empresa_id?: string; grupo_id?: string };
      if (!res.ok) return { ok: false, msg: res.msg || 'Erro ao criar unidade.' };

      const novaLista = [...sessao.unidades];
      if (payload.tipo === 'FILIAL' && res.empresa_id) {
        novaLista.push({
          id: res.empresa_id,
          nome: payload.nome.trim(),
          tipo: 'FILIAL',
          grupo_id: res.grupo_id || sessao.empresa.grupo_id,
          ehMatriz: false
        });
      }
      return {
        ok: true,
        msg: payload.tipo === 'FILIAL'
          ? `Filial "${payload.nome}" criada e liberada no seletor do Dashboard!`
          : `Nova Empresa "${payload.nome}" criada com ambiente isolado!`,
        unidadesAtualizadas: novaLista,
        empresaIdCriada: res.empresa_id
      };
  }

  const db = loadLocalDb();
  const novaId = gerarId('EMP');
  const agora = new Date().toISOString();

  if (payload.tipo === 'FILIAL') {
    const matriz = db.empresas.find((e) => e.id === sessao.unidadeAtivaId) || db.empresas[0];
    const novaFilial: Empresa = {
      ...matriz,
      id: novaId,
      matriz_id: matriz.id,
      tipo: 'FILIAL',
      nome: payload.nome.trim(),
      setup_concluido: true,
      created_at: agora
    };
    db.empresas.push(novaFilial);

    // Mantém DONO(s) da Matriz com o mesmo login e senha
    const donosMatriz = db.usuarios.filter(
      (u) => u.empresa_id === matriz.id && u.perfil === 'DONO' && u.ativo
    );
    for (const dono of donosMatriz) {
      db.usuarios.push({
        ...dono,
        id: gerarId('USR'),
        empresa_id: novaId
      });
    }

    if (payload.copiarProdutos) {
      const prodsOrig = db.produtos.filter((p) => p.empresa_id === matriz.id);
      for (const p of prodsOrig) {
        db.produtos.push({ ...p, id: gerarId('PRD'), empresa_id: novaId, estoque_atual: 0 });
      }
    }
    if (payload.copiarClientes) {
      const cliOrig = db.clientes.filter((c) => c.empresa_id === matriz.id);
      for (const c of cliOrig) {
        db.clientes.push({ ...c, id: gerarId('CLI'), empresa_id: novaId, saldo_devedor: 0 });
      }
    }
  } else {
    const novoGrupo = gerarId('GRP');
    db.empresas.push({
      id: novaId,
      grupo_id: novoGrupo,
      tipo: 'MATRIZ',
      nome: payload.nome.trim(),
      dono_nome: '',
      cnpj: '',
      telefone: '',
      cidade: '',
      chave_pix: '',
      drive_folder_id: '',
      planilha_espelho_id: '',
      plano: 'PRO',
      status_assinatura: 'TRIAL',
      setup_concluido: false,
      created_at: agora
    });
  }

  saveLocalDb(db);
  return {
    ok: true,
    msg: payload.tipo === 'FILIAL'
      ? `Filial "${payload.nome}" criada e disponível no seletor do topo!`
      : `Nova Empresa "${payload.nome}" criada! No primeiro acesso ela abrirá a tela de Boas-Vindas.`,
    unidadesAtualizadas: buildUnidadesResumo(db.empresas, sessao.usuario),
    empresaIdCriada: novaId
  };
}

// ====================================================================
// 7. MOTOR DE RELATÓRIOS FILTRADOS (MÊS / DATA A DATA / PERÍODO)
// ====================================================================

function dentroDoFiltro(isoData: string, filtro: FiltroRelatorio): boolean {
  const ymd = String(isoData || '').slice(0, 10);
  if (!ymd) return false;

  if (filtro.modo === 'MES') {
    return ymd.startsWith(filtro.mesReferencia);
  }
  if (filtro.modo === 'DATA_A_DATA') {
    const ini = filtro.dataInicio || '0000-01-01';
    const fim = filtro.dataFim || '9999-12-31';
    return ymd >= ini && ymd <= fim;
  }

  // MODO PERIODO
  const hoje = new Date();
  const hojeStr = hoje.toISOString().slice(0, 10);
  if (filtro.periodoRapido === 'HOJE') return ymd === hojeStr;
  if (filtro.periodoRapido === 'MES_ATUAL') return ymd.startsWith(hojeStr.slice(0, 7));

  const dias = filtro.periodoRapido === '7_DIAS' ? 7 : 30;
  const limite = new Date(hoje.getTime() - dias * 86400000).toISOString().slice(0, 10);
  return ymd >= limite && ymd <= hojeStr;
}

function descreverFiltroPeriodo(filtro: FiltroRelatorio): { label: string; subpastaMes: string } {
  if (filtro.modo === 'MES') {
    const sub = obterSubpastaMesDeYmd(filtro.mesReferencia);
    return { label: `Mês: ${sub}`, subpastaMes: sub };
  }
  if (filtro.modo === 'DATA_A_DATA') {
    return {
      label: `De ${formatarDataBr(filtro.dataInicio)} até ${formatarDataBr(filtro.dataFim)}`,
      subpastaMes: obterSubpastaMesDeYmd(filtro.dataInicio?.slice(0, 7))
    };
  }
  const mapa: Record<FiltroRelatorio['periodoRapido'], string> = {
    HOJE: 'Hoje',
    '7_DIAS': 'Últimos 7 dias',
    '30_DIAS': 'Últimos 30 dias',
    MES_ATUAL: 'Mês Atual'
  };
  return { label: `Período: ${mapa[filtro.periodoRapido]}`, subpastaMes: obterSubpastaMesAtual() };
}

export function gerarRelatorioFiltrado(
  snapshot: PainelSnapshot,
  filtro: FiltroRelatorio
): RelatorioGerado {
  const { label: periodoLabel, subpastaMes } = descreverFiltroPeriodo(filtro);
  const stamp = new Date().toISOString().slice(0, 10);

  if (filtro.categoria === 'Estoque') {
    const prods = snapshot.produtos;
    const totalUnidades = prods.reduce((acc, p) => acc + (Number(p.estoque_atual) || 0), 0);
    const baixo = prods.filter((p) => p.estoque_atual <= p.estoque_minimo).length;
    return {
      titulo: 'Relatório Analítico de Estoque & Valores',
      categoria: 'Estoque',
      periodoLabel,
      subpastaMes,
      nomeArquivoPdf: `Relatorio_Estoque_${stamp}.pdf`,
      resumo: [
        { label: 'Itens Cadastrados', valor: String(prods.length) },
        { label: 'Unidades Físicas', valor: String(totalUnidades) },
        { label: 'Valor em Venda', valor: formatarMoeda(snapshot.kpis.valorEstoqueVenda) },
        { label: 'Abaixo do Mínimo', valor: String(baixo) }
      ],
      colunas: ['Produto', 'Categoria', 'Qtd Atual', 'Mínimo', 'Custo Un.', 'Venda Un.', 'Total Venda', 'Status'],
      linhas: prods.map((p) => [
        p.nome,
        p.categoria,
        String(p.estoque_atual),
        String(p.estoque_minimo),
        formatarMoeda(p.custo_medio),
        formatarMoeda(p.preco_venda),
        formatarMoeda(p.estoque_atual * p.preco_venda),
        p.estoque_atual <= 0 ? 'ZERADO' : p.estoque_atual <= p.estoque_minimo ? 'BAIXO' : 'OK'
      ])
    };
  }

  if (filtro.categoria === 'Compras') {
    const comprasEstoque = (snapshot.compras || []).filter((c) => dentroDoFiltro(c.data_hora, filtro));
    const mapaContasPorId = new Map(snapshot.contasPagar.map((cp) => [cp.id, cp]));
    const idsCompras = new Set<string>();
    const totaisPorCompra = new Map<string, { fornecedor: string; ymd: string; total: number }>();

    const registrosCompras = comprasEstoque.map((c) => {
      const { idCompra, forma, temNf } = extrairResumoCompra(c);
      idsCompras.add(idCompra);
      const valor = Number(c.valor_total) || 0;
      const grp = totaisPorCompra.get(idCompra);
      if (!grp) {
        totaisPorCompra.set(idCompra, {
          fornecedor: normalizarNomeClienteChave(c.fornecedor),
          ymd: String(c.data_hora || '').slice(0, 10),
          total: valor
        });
      } else {
        grp.total = Number((grp.total + valor).toFixed(2));
      }

      const cpRel = mapaContasPorId.get(idCompra);
      const status = cpRel
        ? contaPagarEstaCancelada(cpRel)
          ? 'CANCELADO'
          : cpRel.status
        : 'PAGO';
      return {
        descricao: `${c.produto_nome} (${c.quantidade}x ${formatarMoeda(c.custo_unitario)})`,
        fornecedor: c.fornecedor || '--',
        categoria: `Compra (${forma})${temNf ? '' : ' • Sem NF'}`,
        dataBr: formatarDataBr(c.data_hora),
        valor,
        status
      };
    });

    const fpsCompras = new Set(
      Array.from(totaisPorCompra.values()).map((g) => `${g.ymd}|${g.fornecedor}|${g.total.toFixed(2)}`)
    );

    const contasAvulsas = snapshot.contasPagar
      .filter((cp) => {
        if (idsCompras.has(cp.id) || contaPagarEhTaxaEntrega(cp)) return false;
        if (!dentroDoFiltro(cp.vencimento, filtro)) return false;
        const fpCp = `${String(cp.vencimento || '').slice(0, 10)}|${normalizarNomeClienteChave(cp.fornecedor || cp.descricao)}|${(Number(cp.valor) || 0).toFixed(2)}`;
        return !fpsCompras.has(fpCp);
      })
      .map((cp) => ({
        descricao: cp.descricao,
        fornecedor: cp.fornecedor || '--',
        categoria: cp.categoria,
        dataBr: formatarDataBr(cp.vencimento),
        valor: Number(cp.valor) || 0,
        status: contaPagarEstaCancelada(cp) ? 'CANCELADO' : cp.status
      }));

    const todosRegistros = [...registrosCompras, ...contasAvulsas];
    const registrosAtivos = todosRegistros.filter((r) => !String(r.status || '').toUpperCase().includes('CANCEL'));
    const total = registrosAtivos.reduce((acc, r) => acc + r.valor, 0);
    return {
      titulo: 'Relatório de Compras & Fornecedores',
      categoria: 'Compras',
      periodoLabel,
      subpastaMes,
      nomeArquivoPdf: `Relatorio_Compras_${stamp}.pdf`,
      resumo: [
        { label: 'Lançamentos', valor: String(todosRegistros.length) },
        { label: 'Valor Total', valor: formatarMoeda(total) },
        { label: 'Pagos', valor: String(registrosAtivos.filter((r) => r.status === 'PAGO').length) },
        { label: 'Pendentes', valor: String(registrosAtivos.filter((r) => r.status !== 'PAGO').length) }
      ],
      colunas: ['Descrição', 'Fornecedor', 'Categoria / Pgto', 'Data / Venc.', 'Valor', 'Status'],
      linhas: todosRegistros.map((r) => [
        r.descricao,
        r.fornecedor,
        r.categoria,
        r.dataBr,
        formatarMoeda(r.valor),
        r.status
      ])
    };
  }

  if (filtro.categoria === 'Auditoria_Logs') {
    const logsFiltrados = snapshot.logs.filter((lg) => dentroDoFiltro(lg.data_hora, filtro));
    return {
      titulo: 'Relatório de Auditoria & Logs do Sistema',
      categoria: 'Auditoria_Logs',
      periodoLabel,
      subpastaMes,
      nomeArquivoPdf: `Relatorio_Auditoria_Logs_${stamp}.pdf`,
      resumo: [
        { label: 'Eventos no Período', valor: String(logsFiltrados.length) },
        { label: 'Unidade', valor: snapshot.empresa.nome }
      ],
      colunas: ['Data/Hora', 'Usuário', 'Ação', 'Canal', 'Detalhes'],
      linhas: logsFiltrados.map((l) => [
        formatarDataHoraBr(l.data_hora),
        l.usuario || '--',
        l.acao,
        l.canal,
        l.detalhes
      ])
    };
  }

  // Financeiro (Padrão)
  const movs = snapshot.caixa.filter((c) => dentroDoFiltro(c.data_hora, filtro));
  const movsContabilizados = movs.filter((m) => !movimentoCaixaEstaCancelado(m));
  const entradas = movsContabilizados.filter((m) => m.tipo === 'ENTRADA').reduce((a, m) => a + m.valor, 0);
  const saidas = movsContabilizados.filter((m) => m.tipo === 'SAIDA').reduce((a, m) => a + m.valor, 0);
  const vendasFilt = snapshot.vendas.filter((v) => dentroDoFiltro(v.data_hora, filtro));

  return {
    titulo: 'Relatório Financeiro & Fluxo de Caixa',
    categoria: 'Financeiro',
    periodoLabel,
    subpastaMes,
    nomeArquivoPdf: `Relatorio_Financeiro_${stamp}.pdf`,
    resumo: [
      { label: 'Entradas', valor: formatarMoeda(entradas) },
      { label: 'Saídas', valor: formatarMoeda(saidas) },
      { label: 'Saldo Período', valor: formatarMoeda(entradas - saidas) },
      { label: 'Vendas (Qtd)', valor: String(vendasFilt.length) }
    ],
    colunas: ['Data/Hora', 'Tipo', 'Descrição', 'Forma Pgto', 'Origem', 'Valor', 'Operador'],
    linhas: movs.map((m) => [
      formatarDataHoraBr(m.data_hora),
      m.tipo,
      m.descricao,
      m.forma_pagamento,
      m.origem,
      formatarMoeda(m.valor),
      m.operador || '--'
    ])
  };
}

// ====================================================================
// 8. COMANDAS DE BALCÃO (ABRIR, ADICIONAR ITEM, RECEBER/FECHAR)
// ====================================================================

function calcularProximoNumeroSequencial(
  pedidos: Array<string | number | null | undefined>
): string {
  let maxNum = 0;
  for (const raw of pedidos) {
    const txt = String(raw ?? '').trim();
    if (/^\d+$/.test(txt)) {
      const n = parseInt(txt, 10);
      if (n > maxNum) maxNum = n;
    }
  }
  return String(maxNum + 1);
}

function formatarCodigoPedidoPadrao(prefixo: 'C' | 'D', pedido: string | number): string {
  const raw = String(pedido ?? '').trim();
  const botMatch = raw.match(/^(?:D\s*-\s*0*)?(\d+)\s*\(?(BOT\s*)?(ZAP|TG)\)?$/i);
  if (botMatch) {
    return `${prefixo} - ${String(Number(botMatch[1])).padStart(4, '0')} ${botMatch[3].toUpperCase()}`;
  }
  const m = raw.match(/^(?:C\s*-\s*0*|D\s*-\s*0*|#)?(\d+)$/i);
  if (m) {
    return `${prefixo} - ${String(Number(m[1])).padStart(4, '0')}`;
  }
  return raw;
}

async function gerarProximoIdVendaBalcao(
  client: ReturnType<typeof getTenantSupabaseClient>,
  empId: string
): Promise<string> {
  let maxNum = 0;
  if (client) {
    const { data } = await client
      .from('vendas')
      .select('pedido_id')
      .eq('empresa_id', empId)
      .ilike('pedido_id', 'B%');
    for (const r of (data || []) as Array<{ pedido_id?: string }>) {
      const m = String(r.pedido_id || '').trim().match(/^B\s*-\s*0*(\d+)$/i);
      if (m) maxNum = Math.max(maxNum, Number(m[1]) || 0);
    }
  }
  return `B - ${String(maxNum + 1).padStart(4, '0')}`;
}

function gerarProtocoloConferencia(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `CONF-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

async function gerarProximoIdContasReceber(
  client: ReturnType<typeof getTenantSupabaseClient>,
  empId: string
): Promise<string> {
  let maxSeq = 0;
  if (client) {
    const { data } = await client
      .from('contas_a_receber')
      .select('id')
      .eq('empresa_id', empId);
    for (const row of (data || []) as Array<{ id: string }>) {
      const m = String(row.id || '').match(/^CR-0*(\d+)$/i);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > maxSeq) maxSeq = n;
      }
    }
  }
  return `CR-${String(maxSeq + 1).padStart(6, '0')}`;
}

export async function abrirComanda(
  sessao: SessaoAtiva,
  cliente: string
): Promise<{ ok: boolean; msg: string; comanda?: Comanda }> {
  const empId = sessao.unidadeAtivaId;
  const nomeCli = cliente.trim();
  if (!nomeCli) return { ok: false, msg: 'Informe o nome do cliente para abrir a comanda.' };

  const clientCmd = getTenantSupabaseClient(sessao);
  if (clientCmd) {
    const { data: existentes } = await clientCmd
      .from('comandas')
      .select('pedido')
      .eq('empresa_id', empId);
    let pedidoSeq = calcularProximoNumeroSequencial(
      ((existentes || []) as Array<{ pedido?: string }>).map((r) => r.pedido)
    );

    const nova: Comanda = {
      id: gerarId('CMDB'),
      empresa_id: empId,
      pedido: pedidoSeq,
      cliente: nomeCli,
      status: 'ABERTA',
      data_abertura: new Date().toISOString(),
      total: 0,
      pago: 0,
      saldo: 0,
      operador: sessao.usuario.username,
      itens: []
    };

    const { itens: _omit, ...row } = nova;
    void _omit;
    let { error } = await clientCmd.from('comandas').insert(row);
    if (error && (error.code === '23505' || String(error.message).includes('23505'))) {
      pedidoSeq = String(parseInt(pedidoSeq, 10) + 1);
      nova.pedido = pedidoSeq;
      const retryRes = await clientCmd.from('comandas').insert({ ...row, pedido: pedidoSeq });
      error = retryRes.error;
    }
    if (error) return { ok: false, msg: error.message };
    notificarPlanilhaPosMutacao(sessao);
    return { ok: true, msg: `Comanda #${nova.pedido} aberta!`, comanda: nova };
  }

  const db = loadLocalDb();
  const pedidoLocal = calcularProximoNumeroSequencial(
    db.comandas.filter((c) => c.empresa_id === empId).map((c) => c.pedido)
  );
  const novaLocal: Comanda = {
    id: gerarId('CMDB'),
    empresa_id: empId,
    pedido: pedidoLocal,
    cliente: nomeCli,
    status: 'ABERTA',
    data_abertura: new Date().toISOString(),
    total: 0,
    pago: 0,
    saldo: 0,
    operador: sessao.usuario.username,
    itens: []
  };
  db.comandas.unshift(novaLocal);
  appendLocalLog(db, empId, sessao.usuario.username, 'COMANDA_ABERTA', `${novaLocal.pedido} (${nomeCli})`);
  saveLocalDb(db);
  return { ok: true, msg: `Comanda #${novaLocal.pedido} aberta para ${nomeCli}!`, comanda: novaLocal };
}

export async function adicionarItemComanda(
  sessao: SessaoAtiva,
  comandaId: string,
  produto: Produto,
  quantidade: number,
  precoUnitarioCustom?: number,
  permitirEstoqueNegativo = false
): Promise<{ ok: boolean; msg: string }> {
  const empId = sessao.unidadeAtivaId;
  const qtd = Math.max(1, Number(quantidade) || 1);
  const perfil = String(sessao.usuario.perfil || '').toUpperCase();
  const podeAlterarValor = perfil === 'ADMIN' || perfil === 'DONO';
  const precoUnit =
    podeAlterarValor && precoUnitarioCustom !== undefined && Number(precoUnitarioCustom) > 0
      ? Number(precoUnitarioCustom)
      : Number(produto.preco_venda) || 0;
  const subtotal = Number((qtd * precoUnit).toFixed(2));
  const agora = new Date().toISOString();

  const client = getTenantSupabaseClient(sessao);
  if (client) {
    const { data: prodRow } = await client
      .from('produtos')
      .select('estoque_atual')
      .eq('id', produto.id)
      .eq('empresa_id', empId)
      .single();
    const estoqueAtual = prodRow
      ? Number((prodRow as { estoque_atual: number }).estoque_atual) || 0
      : Number(produto.estoque_atual) || 0;

    if (!permitirEstoqueNegativo && qtd > estoqueAtual) {
      return {
        ok: false,
        msg:
          estoqueAtual <= 0
            ? `❌ O produto "${produto.nome}" está ESGOTADO no estoque!`
            : `⚠️ Estoque insuficiente para "${produto.nome}" (${estoqueAtual} un disponíveis).`
      };
    }

    const { data: cmdRow, error: errCmd } = await client
      .from('comandas')
      .select('*')
      .eq('id', comandaId)
      .eq('empresa_id', empId)
      .single();
    if (errCmd || !cmdRow) return { ok: false, msg: 'Comanda não encontrada.' };

    await client.from('comanda_itens').insert({
      id: gerarId('CIT'),
      empresa_id: empId,
      comanda_id: comandaId,
      pedido: (cmdRow as Comanda).pedido,
      produto_id: produto.id,
      produto_nome: produto.nome,
      quantidade: qtd,
      preco_unitario: precoUnit,
      subtotal,
      hora: agora
    });

    const novoTotal = Number((Number((cmdRow as Comanda).total) + subtotal).toFixed(2));
    const novoSaldo = Math.max(0, Number((novoTotal - Number((cmdRow as Comanda).pago)).toFixed(2)));
    await client
      .from('comandas')
      .update({ total: novoTotal, saldo: novoSaldo, updated_at: agora })
      .eq('id', comandaId);

    await client
      .from('produtos')
      .update({ estoque_atual: Math.max(0, estoqueAtual - qtd), updated_at: agora })
      .eq('id', produto.id)
      .eq('empresa_id', empId);

    notificarPlanilhaPosMutacao(sessao);
    return { ok: true, msg: `${qtd}x ${produto.nome} adicionado à comanda!` };
  }

  const db = loadLocalDb();
  const cmd = db.comandas.find((c) => c.id === comandaId && c.empresa_id === empId);
  if (!cmd) return { ok: false, msg: 'Comanda não encontrada.' };

  const prod = db.produtos.find((p) => p.id === produto.id && p.empresa_id === empId);
  const estoqueAtual = prod ? Number(prod.estoque_atual) || 0 : Number(produto.estoque_atual) || 0;
  if (!permitirEstoqueNegativo && qtd > estoqueAtual) {
    return {
      ok: false,
      msg:
        estoqueAtual <= 0
          ? `❌ O produto "${produto.nome}" está ESGOTADO no estoque!`
          : `⚠️ Estoque insuficiente para "${produto.nome}" (${estoqueAtual} un disponíveis).`
    };
  }

  cmd.itens.push({
    id: gerarId('CIT'),
    produto_id: produto.id,
    produto_nome: produto.nome,
    quantidade: qtd,
    preco_unitario: precoUnit,
    subtotal,
    hora: agora
  });
  cmd.total = Number((cmd.total + subtotal).toFixed(2));
  cmd.saldo = Math.max(0, Number((cmd.total - cmd.pago).toFixed(2)));

  if (prod) {
    prod.estoque_atual = Math.max(0, prod.estoque_atual - qtd);
  }
  saveLocalDb(db);
  return { ok: true, msg: `${qtd}x ${produto.nome} adicionado à comanda!` };
}

export async function receberEFecharComanda(
  sessao: SessaoAtiva,
  comanda: Comanda,
  formaPagamento: FormaPagamento,
  observacaoOutro?: string,
  taxaServico10 = 0
): Promise<{ ok: boolean; msg: string }> {
  const empId = sessao.unidadeAtivaId;
  const agora = new Date().toISOString();
  const baseReceber = comanda.saldo > 0 ? comanda.saldo : comanda.total;
  const taxa10 = Math.max(0, Number(taxaServico10) || 0);
  const valorReceber = Number((baseReceber + taxa10).toFixed(2));
  if (formaPagamento === 'Fiado' && valorReceber > 0) {
    const valLim = await validarLimiteFiadoCliente(sessao, comanda.cliente, valorReceber);
    if (!valLim.ok) return { ok: false, msg: valLim.msg || 'Limite de fiado excedido.' };
  }

  const obsOutroLimpa = (observacaoOutro || '').trim();
  if (formaPagamento === 'Outro' && valorReceber > 0 && !obsOutroLimpa) {
    return { ok: false, msg: 'Informe a observação explicando o uso da forma de pagamento "Outro".' };
  }

  const client = getTenantSupabaseClient(sessao);
  if (client) {
    await client
      .from('comandas')
      .update({
        status: 'PAGA',
        pago: comanda.total,
        saldo: 0,
        data_fechamento: agora,
        updated_at: agora
      })
      .eq('id', comanda.id)
      .eq('empresa_id', empId);

      // Registra os itens da comanda na tabela de vendas (sem duplicar caso já existam)
      const { data: vendasExistentes } = await client
        .from('vendas')
        .select('id')
        .eq('empresa_id', empId)
        .eq('pedido_id', String(comanda.pedido));
      if (!vendasExistentes || vendasExistentes.length === 0) {
        let itensCmd = comanda.itens || [];
        if (itensCmd.length === 0) {
          const { data: itensDb } = await client
            .from('comanda_itens')
            .select('*')
            .eq('empresa_id', empId)
            .eq('comanda_id', comanda.id);
          itensCmd = (itensDb || []) as ComandaItem[];
        }
        if (itensCmd.length > 0) {
          const rowsVendas = itensCmd.map((item) => ({
            id: gerarId('VN'),
            empresa_id: empId,
            data_hora: agora,
            produto_id: item.produto_id || null,
            produto_nome: item.produto_nome,
            quantidade: item.quantidade,
            valor_unitario: item.preco_unitario,
            valor_total: item.subtotal,
            forma_pagamento: formaPagamento,
            origem: 'Comanda' as const,
            pedido_id: formatarCodigoPedidoPadrao('C', comanda.pedido),
            cliente_nome: comanda.cliente,
            vendedor: sessao.usuario.username
          }));
          await client.from('vendas').insert(rowsVendas);
        }
      }

      if (valorReceber > 0) {
        if (formaPagamento === 'Fiado') {
          const idCr = await gerarProximoIdContasReceber(client, empId);
          await client.from('contas_a_receber').insert({
            id: idCr,
            empresa_id: empId,
            data: agora,
            cliente: comanda.cliente,
            descricao: `Comanda Fiado ${formatarCodigoPedidoPadrao('C', comanda.pedido)}`,
            valor: valorReceber,
            status: 'PENDENTE',
            comanda_origem: formatarCodigoPedidoPadrao('C', comanda.pedido)
          });
        } else {
          await client.from('caixa').insert({
            id: gerarId('CX'),
            empresa_id: empId,
            data_hora: agora,
            tipo: 'ENTRADA',
            valor: valorReceber,
            forma_pagamento: formaPagamento,
            descricao: `Fechamento Comanda #${comanda.pedido} (${comanda.cliente}) [${formaPagamento}${taxa10 > 0 ? ` | +10% Serv: ${formatarMoeda(taxa10)}` : ''}${obsOutroLimpa ? ` | Obs: ${obsOutroLimpa}` : ''}]`,
            operador: sessao.usuario.username,
            origem: 'Comanda'
          });
          if (taxa10 > 0) {
            await registrarOuAcumularComissaoVendedor10(
              client,
              empId,
              sessao.usuario.nome || sessao.usuario.username,
              formatarCodigoPedidoPadrao('C', comanda.pedido),
              taxa10,
              agora
            );
          }
          if (formaPagamento === 'Outro') {
            await client.from('auditoria_logs').insert({
              id: gerarId('LOG'),
              empresa_id: empId,
              usuario: sessao.usuario.username,
              acao: 'PAGAMENTO_OUTRO',
              detalhes: `Comanda #${comanda.pedido} (${comanda.cliente}) | ${formatarMoeda(valorReceber)} | Obs: ${obsOutroLimpa}`,
              canal: 'WEB'
            });
            const empAlvo = sessao.empresa;
            if (empAlvo.telegram_bot_token && empAlvo.telegram_chat_id) {
              void enviarMensagemTelegram(
                empAlvo,
                `🏷️ <b>Pagamento em "Outro" — ${empAlvo.nome}</b>\n` +
                  `Comanda: <b>#${comanda.pedido}</b> (${comanda.cliente})\n` +
                  `Valor: <b>${formatarMoeda(valorReceber)}</b>\n` +
                  `Operador: <b>${sessao.usuario.nome}</b>\n` +
                  `Observação: <b>${obsOutroLimpa}</b>\n` +
                  `💡 <i>Apenas o Dono pode converter esta forma de pagamento em Financeiro → Extrato do Caixa.</i>`
              );
            }
          }
        }
      }
      notificarPlanilhaPosMutacao(sessao);
      return { ok: true, msg: `Comanda #${comanda.pedido} fechada!` };
  }

  const db = loadLocalDb();
  const cmd = db.comandas.find((c) => c.id === comanda.id && c.empresa_id === empId);
  if (!cmd) return { ok: false, msg: 'Comanda não encontrada.' };

  cmd.status = 'PAGA';
  cmd.pago = cmd.total;
  cmd.saldo = 0;
  cmd.data_fechamento = agora;

  const jaTemVendaLocal = db.vendas.some(
    (v) => v.empresa_id === empId && String(v.pedido_id || '') === String(cmd.pedido)
  );
  if (!jaTemVendaLocal && cmd.itens.length > 0) {
    for (const item of cmd.itens) {
      db.vendas.unshift({
        id: gerarId('VN'),
        empresa_id: empId,
        data_hora: agora,
        produto_id: item.produto_id || '',
        produto_nome: item.produto_nome,
        quantidade: item.quantidade,
        valor_unitario: item.preco_unitario,
        valor_total: item.subtotal,
        forma_pagamento: formaPagamento,
        origem: 'Comanda',
        pedido_id: String(cmd.pedido),
        cliente_nome: cmd.cliente,
        vendedor: sessao.usuario.username
      });
    }
  }

  if (valorReceber > 0) {
    if (formaPagamento === 'Fiado') {
      db.contasReceber.unshift({
        id: gerarId('REC'),
        empresa_id: empId,
        data: agora,
        cliente: cmd.cliente,
        descricao: `Comanda Fiado ${cmd.pedido}`,
        valor: valorReceber,
        status: 'PENDENTE',
        comanda_origem: cmd.pedido
      });
    } else {
      db.caixa.unshift({
        id: gerarId('CX'),
        empresa_id: empId,
        data_hora: agora,
        tipo: 'ENTRADA',
        valor: valorReceber,
        forma_pagamento: formaPagamento,
        descricao: `Fechamento Comanda #${cmd.pedido} (${cmd.cliente})`,
        operador: sessao.usuario.username,
        origem: 'Comanda'
      });
    }
  }
  appendLocalLog(db, empId, sessao.usuario.username, 'COMANDA_FECHADA', `${cmd.pedido} (${formatarMoeda(valorReceber)})`);
  saveLocalDb(db);
  return { ok: true, msg: `Comanda ${cmd.pedido} quitada e encerrada!` };
}

// ====================================================================
// 9. MÓDULO DELIVERY
// ====================================================================

export async function criarPedidoDelivery(
  sessao: SessaoAtiva,
  dados: {
    cliente: string;
    telefone: string;
    endereco: string;
    taxaEntrega: number;
    formaPagamento: FormaPagamento;
    entregador: string;
    observacoes: string;
    itens: ItemCarrinho[];
  },
  permitirEstoqueNegativo = false
): Promise<{ ok: boolean; msg: string; pedido?: DeliveryPedido }> {
  const empId = sessao.unidadeAtivaId;
  if (!dados.cliente.trim() || !dados.endereco.trim() || dados.itens.length === 0) {
    return { ok: false, msg: 'Informe cliente, endereço e pelo menos 1 item.' };
  }

  const client = getTenantSupabaseClient(sessao);
  const perfil = String(sessao.usuario.perfil || '').toUpperCase();
  const podeAlterarValor = perfil === 'ADMIN' || perfil === 'DONO';
  const mapaPrecoDel = new Map<string, number>();

  if (client) {
    const ids = Array.from(new Set(dados.itens.map((i) => i.produto.id)));
    const { data: prodsDb } = await client
      .from('produtos')
      .select('id,estoque_atual,preco_venda')
      .eq('empresa_id', empId)
      .in('id', ids);
    const mapaEst = new Map<string, number>();
    ((prodsDb || []) as Array<{ id: string; estoque_atual: number; preco_venda: number }>).forEach((r) => {
      mapaEst.set(r.id, Number(r.estoque_atual) || 0);
      mapaPrecoDel.set(r.id, Number(r.preco_venda) || 0);
    });
    if (!permitirEstoqueNegativo) {
      for (const i of dados.itens) {
        const disp = mapaEst.has(i.produto.id)
          ? (mapaEst.get(i.produto.id) as number)
          : Number(i.produto.estoque_atual) || 0;
        if (i.quantidade > disp) {
          return {
            ok: false,
            msg: `Delivery bloqueado: "${i.produto.nome}" possui apenas ${disp} un em estoque!`
          };
        }
      }
    }
  } else if (!client && !permitirEstoqueNegativo) {
    const dbCheck = loadLocalDb();
    for (const i of dados.itens) {
      const pDb = dbCheck.produtos.find((p) => p.id === i.produto.id && p.empresa_id === empId);
      const disp = pDb ? Number(pDb.estoque_atual) || 0 : 0;
      if (i.quantidade > disp) {
        return {
          ok: false,
          msg: `Delivery bloqueado: "${i.produto.nome}" possui apenas ${disp} un em estoque!`
        };
      }
    }
  }

  const agora = new Date().toISOString();
  const itensNorm = dados.itens.map((i) => {
    const precoUnit = podeAlterarValor
      ? i.produto.preco_venda
      : mapaPrecoDel.get(i.produto.id) ?? i.produto.preco_venda;
    return {
      id: gerarId('DIT'),
      produto_id: i.produto.id,
      produto_nome: i.produto.nome,
      quantidade: i.quantidade,
      preco_unitario: precoUnit,
      subtotal: Number((i.quantidade * precoUnit).toFixed(2)),
      hora: agora
    };
  });

  const valorProdutos = Number(
    itensNorm.reduce((acc, i) => acc + i.subtotal, 0).toFixed(2)
  );
  const taxa = Math.max(0, Number(dados.taxaEntrega) || 0);
  const total = Number((valorProdutos + taxa).toFixed(2));
  const pedidoId = gerarId('DEL');
  let pedidoNum = '1';
  if (client) {
    const { data: delsExistentes } = await client
      .from('delivery')
      .select('pedido')
      .eq('empresa_id', empId);
    pedidoNum = calcularProximoNumeroSequencial(
      ((delsExistentes || []) as Array<{ pedido?: string }>).map((r) => r.pedido)
    );
  } else {
    const dbSeq = loadLocalDb();
    pedidoNum = calcularProximoNumeroSequencial(
      (dbSeq.delivery || []).filter((d) => d.empresa_id === empId).map((d) => d.pedido)
    );
  }

  const novoPedido: DeliveryPedido = {
    id: pedidoId,
    empresa_id: empId,
    pedido: pedidoNum,
    cliente: dados.cliente.trim(),
    telefone: dados.telefone.trim(),
    endereco: dados.endereco.trim(),
    status: 'PENDENTE',
    valor_produtos: valorProdutos,
    taxa_entrega: taxa,
    total,
    forma_pagamento: dados.formaPagamento,
    entregador: dados.entregador.trim(),
    observacoes: dados.observacoes.trim(),
    data_hora: agora,
    itens: itensNorm
  };

  if (client) {
    const { itens: _omit, ...row } = novoPedido;
    void _omit;
    let { error } = await client.from('delivery').insert(row);
    if (error && (error.code === '23505' || String(error.message).includes('23505'))) {
      pedidoNum = String(parseInt(pedidoNum, 10) + 1);
      novoPedido.pedido = pedidoNum;
      const retryDel = await client.from('delivery').insert({ ...row, pedido: pedidoNum });
      error = retryDel.error;
    }
    if (error) return { ok: false, msg: error.message };

    await client.from('delivery_itens').insert(
      itensNorm.map((it) => ({
        id: it.id,
        empresa_id: empId,
        delivery_id: pedidoId,
        pedido: pedidoNum,
        produto_nome: it.produto_nome,
        quantidade: it.quantidade,
        preco_unitario: it.preco_unitario,
        subtotal: it.subtotal,
        hora: it.hora
      }))
    );
    notificarPlanilhaPosMutacao(sessao);
    return { ok: true, msg: `Pedido #${pedidoNum} criado!`, pedido: novoPedido };
  }

  const db = loadLocalDb();
  if (!db.delivery) db.delivery = [];
  db.delivery.unshift(novoPedido);
  appendLocalLog(db, empId, sessao.usuario.username, 'DELIVERY_CRIADO', `${pedidoNum} — ${novoPedido.cliente} (${formatarMoeda(total)})`);
  saveLocalDb(db);
  return { ok: true, msg: `Pedido ${pedidoNum} criado com sucesso!`, pedido: novoPedido };
}

export async function atualizarStatusDelivery(
  sessao: SessaoAtiva,
  pedido: DeliveryPedido,
  novoStatus: StatusDelivery,
  entregadorNovo?: string
): Promise<{ ok: boolean; msg: string }> {
  const empId = sessao.unidadeAtivaId;
  const agora = new Date().toISOString();
  const entregadorFinal = entregadorNovo !== undefined && entregadorNovo.trim() ? entregadorNovo.trim() : pedido.entregador;

  if (novoStatus === 'ENTREGUE' && pedido.status !== 'ENTREGUE' && pedido.forma_pagamento === 'Fiado') {
    const valLim = await validarLimiteFiadoCliente(sessao, pedido.cliente, Number(pedido.total) || 0);
    if (!valLim.ok) return { ok: false, msg: valLim.msg || 'Limite de fiado excedido.' };
  }

  const client = getTenantSupabaseClient(sessao);
  if (client) {
    const { error } = await client
      .from('delivery')
      .update({ status: novoStatus, entregador: entregadorFinal, updated_at: agora })
      .eq('id', pedido.id)
      .eq('empresa_id', empId);
    if (error) return { ok: false, msg: error.message };

    if (novoStatus === 'ENTREGUE' && pedido.status !== 'ENTREGUE') {
      for (const item of pedido.itens) {
        const { data: prodRow } = await client
          .from('produtos')
          .select('id,estoque_atual')
          .eq('empresa_id', empId)
          .eq('nome', item.produto_nome)
          .single();
        if (prodRow) {
          const novoEst = Math.max(0, (Number((prodRow as { estoque_atual: number }).estoque_atual) || 0) - item.quantidade);
          await client
            .from('produtos')
            .update({ estoque_atual: novoEst, updated_at: agora })
            .eq('id', (prodRow as { id: string }).id)
            .eq('empresa_id', empId);
        }
        await client.from('vendas').insert({
          id: gerarId('VN'),
          empresa_id: empId,
          data_hora: agora,
          produto_id: prodRow ? (prodRow as { id: string }).id : item.produto_id || '',
          produto_nome: item.produto_nome,
          quantidade: item.quantidade,
          valor_unitario: item.preco_unitario,
          valor_total: item.subtotal,
          forma_pagamento: pedido.forma_pagamento,
          origem: 'Delivery',
          pedido_id: formatarCodigoPedidoPadrao('D', pedido.pedido),
          cliente_nome: pedido.cliente,
          vendedor: sessao.usuario.username
        });
      }

      const taxa = Number(pedido.taxa_entrega) || 0;
      const ehDinheiro = String(pedido.forma_pagamento || '').trim().toLowerCase() === 'dinheiro';

      if (pedido.forma_pagamento === 'Fiado') {
        const idCrDel = await gerarProximoIdContasReceber(client, empId);
        await client.from('contas_a_receber').insert({
          id: idCrDel,
          empresa_id: empId,
          data: agora,
          cliente: pedido.cliente,
          descricao: `Delivery Fiado ${formatarCodigoPedidoPadrao('D', pedido.pedido)}`,
          valor: pedido.total,
          status: 'PENDENTE',
          comanda_origem: formatarCodigoPedidoPadrao('D', pedido.pedido)
        });
        if (taxa > 0) {
          await registrarOuAcumularTaxaEntregaMotoboy(
            client,
            empId,
            entregadorFinal,
            pedido.pedido,
            taxa,
            agora
          );
        }
      } else {
        const valorCaixa = ehDinheiro && taxa > 0
          ? Number(Math.max(0, (Number(pedido.total) || 0) - taxa).toFixed(2))
          : Number(pedido.total) || 0;
        const descCaixa = ehDinheiro && taxa > 0
          ? `Delivery ${pedido.pedido} (${pedido.cliente}) • Sem taxa (${formatarMoeda(taxa)} retida pelo motoboy)`
          : `Delivery ${pedido.pedido} (${pedido.cliente})`;

        await client.from('caixa').insert({
          id: gerarId('CX'),
          empresa_id: empId,
          data_hora: agora,
          tipo: 'ENTRADA',
          valor: valorCaixa,
          forma_pagamento: pedido.forma_pagamento,
          descricao: descCaixa,
          operador: sessao.usuario.username,
          origem: 'Delivery'
        });

        if (!ehDinheiro && taxa > 0) {
          await registrarOuAcumularTaxaEntregaMotoboy(
            client,
            empId,
            entregadorFinal,
            pedido.pedido,
            taxa,
            agora
          );
        }
      }
    }
    notificarPlanilhaPosMutacao(sessao);
    return { ok: true, msg: `Pedido ${pedido.pedido} atualizado para ${novoStatus}.` };
  }

  const db = loadLocalDb();
  const alvo = (db.delivery || []).find((d) => d.id === pedido.id && d.empresa_id === empId);
  if (!alvo) return { ok: false, msg: 'Pedido delivery não encontrado.' };

  const jaEntregue = alvo.status === 'ENTREGUE';
  alvo.status = novoStatus;
  if (entregadorNovo !== undefined && entregadorNovo.trim()) {
    alvo.entregador = entregadorNovo.trim();
  }

  if (novoStatus === 'ENTREGUE' && !jaEntregue) {
    for (const item of alvo.itens) {
      const prod = db.produtos.find((p) => p.nome === item.produto_nome && p.empresa_id === empId);
      if (prod) prod.estoque_atual = Math.max(0, prod.estoque_atual - item.quantidade);

      db.vendas.unshift({
        id: gerarId('VN'),
        empresa_id: empId,
        data_hora: agora,
        produto_id: prod ? prod.id : '',
        produto_nome: item.produto_nome,
        quantidade: item.quantidade,
        valor_unitario: item.preco_unitario,
        valor_total: item.subtotal,
        forma_pagamento: alvo.forma_pagamento,
        origem: 'Delivery',
        pedido_id: alvo.pedido,
        cliente_nome: alvo.cliente,
        vendedor: sessao.usuario.username
      });
    }
    const taxaLocal = Number(alvo.taxa_entrega) || 0;
    const ehDinheiroLocal = String(alvo.forma_pagamento || '').trim().toLowerCase() === 'dinheiro';

    if (alvo.forma_pagamento === 'Fiado') {
      db.contasReceber.unshift({
        id: gerarId('REC'),
        empresa_id: empId,
        data: agora,
        cliente: alvo.cliente,
        descricao: `Delivery Fiado ${alvo.pedido}`,
        valor: alvo.total,
        status: 'PENDENTE',
        comanda_origem: alvo.pedido
      });
      if (taxaLocal > 0) {
        await registrarOuAcumularTaxaEntregaMotoboy(
          null,
          empId,
          alvo.entregador || '',
          alvo.pedido,
          taxaLocal,
          agora,
          db
        );
      }
    } else {
      const valorCaixaLocal = ehDinheiroLocal && taxaLocal > 0
        ? Number(Math.max(0, (Number(alvo.total) || 0) - taxaLocal).toFixed(2))
        : Number(alvo.total) || 0;
      const descCaixaLocal = ehDinheiroLocal && taxaLocal > 0
        ? `Delivery ${alvo.pedido} (${alvo.cliente}) • Sem taxa (${formatarMoeda(taxaLocal)} retida pelo motoboy)`
        : `Delivery ${alvo.pedido} (${alvo.cliente})`;

      db.caixa.unshift({
        id: gerarId('CX'),
        empresa_id: empId,
        data_hora: agora,
        tipo: 'ENTRADA',
        valor: valorCaixaLocal,
        forma_pagamento: alvo.forma_pagamento,
        descricao: descCaixaLocal,
        operador: sessao.usuario.username,
        origem: 'Delivery'
      });

      if (!ehDinheiroLocal && taxaLocal > 0) {
        await registrarOuAcumularTaxaEntregaMotoboy(
          null,
          empId,
          alvo.entregador || '',
          alvo.pedido,
          taxaLocal,
          agora,
          db
        );
      }
    }
  }

  appendLocalLog(db, empId, sessao.usuario.username, 'DELIVERY_STATUS', `${alvo.pedido} -> ${novoStatus}`);
  saveLocalDb(db);
  return { ok: true, msg: `Pedido ${alvo.pedido} movido para ${novoStatus}!` };
}

// ====================================================================
// 10. CONFERÊNCIA DE CAIXA & FECHAMENTO FISCAL (PAINEL INTELIGENTE)
// ====================================================================

export function calcularPreviaConferenciaCaixa(snapshot: PainelSnapshot): ConferenciaCaixaPrevia {
  const hojeYmd = new Date().toISOString().slice(0, 10);
  const ultimaConf = snapshot.logs
    .filter((l) => l.acao === 'CONFERENCIA_CAIXA' && l.data_hora)
    .sort((a, b) => new Date(b.data_hora).getTime() - new Date(a.data_hora).getTime())[0];
  const corteConfMs = ultimaConf ? new Date(ultimaConf.data_hora).getTime() : 0;

  const movsHoje = snapshot.caixa.filter((c) => {
    if (movimentoCaixaEstaCancelado(c)) return false;
    const dtStr = String(c.data_hora || '');
    if (!dtStr.startsWith(hojeYmd)) return false;
    if (corteConfMs > 0) {
      const dtMs = new Date(dtStr).getTime();
      if (!Number.isNaN(dtMs) && dtMs <= corteConfMs) return false;
    }
    return true;
  });

  let entradasHoje = 0;
  let saidasHoje = 0;
  let entradasDinheiroHoje = 0;
  let saidasDinheiroHoje = 0;
  const porForma: Record<string, { valor: number; qtd: number }> = {};

  for (const m of movsHoje) {
    const val = Number(m.valor) || 0;
    const forma = m.forma_pagamento || 'Outros';
    const ehDinheiro = forma.toUpperCase().includes('DINHEIRO');
    if (m.tipo === 'ENTRADA') {
      entradasHoje += val;
      if (ehDinheiro) entradasDinheiroHoje += val;
      if (!porForma[forma]) porForma[forma] = { valor: 0, qtd: 0 };
      porForma[forma].valor = Number((porForma[forma].valor + val).toFixed(2));
      porForma[forma].qtd += 1;
    } else {
      saidasHoje += val;
      if (ehDinheiro) saidasDinheiroHoje += val;
    }
  }

  return {
    entradasHoje: Number(entradasHoje.toFixed(2)),
    saidasHoje: Number(saidasHoje.toFixed(2)),
    saldoSistema: Number((entradasHoje - saidasHoje).toFixed(2)),
    entradasDinheiroHoje: Number(entradasDinheiroHoje.toFixed(2)),
    saidasDinheiroHoje: Number(saidasDinheiroHoje.toFixed(2)),
    saldoDinheiroGaveta: Number((entradasDinheiroHoje - saidasDinheiroHoje).toFixed(2)),
    qtdMovimentos: movsHoje.length,
    porFormaPagamento: Object.entries(porForma)
      .map(([forma, info]) => ({ forma, valor: info.valor, qtd: info.qtd }))
      .sort((a, b) => b.valor - a.valor),
    movimentosHoje: movsHoje
  };
}

async function obterTextoPendenciaNfTelegram(
  client: ReturnType<typeof getTenantSupabaseClient>,
  empId: string
): Promise<string> {
  if (!client) return '';
  try {
    const { data } = await client
      .from('compras')
      .select('id,fornecedor,valor_total,nota_fiscal,data_hora')
      .eq('empresa_id', empId)
      .order('data_hora', { ascending: false })
      .limit(100);
    const pendentes = listarComprasSemNf((data || []) as Compra[]);
    if (pendentes.length === 0) return '';
    const amostra = pendentes
      .slice(0, 4)
      .map((p) => `• ${p.idCompra} (${p.fornecedor} — ${formatarMoeda(p.valorTotal)})`)
      .join('\n');
    return `\n\n📄 <b>Compras sem Nota Fiscal anexada (${pendentes.length}):</b>\n${amostra}${pendentes.length > 4 ? `\n<i>...e mais ${pendentes.length - 4} compra(s).</i>` : ''}`;
  } catch {
    return '';
  }
}

export async function registrarConferenciaCaixa(
  sessao: SessaoAtiva,
  saldoFisicoContado: number,
  previa: ConferenciaCaixaPrevia,
  observacao: string,
  empresa?: Empresa,
  modoComparacao: 'DINHEIRO_GAVETA' | 'GERAL' = 'DINHEIRO_GAVETA'
): Promise<{ ok: boolean; msg: string }> {
  const empId = sessao.unidadeAtivaId;
  const baseEsperada =
    modoComparacao === 'DINHEIRO_GAVETA' ? previa.saldoDinheiroGaveta : previa.saldoSistema;
  const dif = Number((saldoFisicoContado - baseEsperada).toFixed(2));
  const resumoFormas = previa.porFormaPagamento
    .map((f) => `${f.forma}: ${formatarMoeda(f.valor)} (${f.qtd}x)`)
    .join(', ');
  const detalhe =
    `Entradas: ${formatarMoeda(previa.entradasHoje)} | Saídas: ${formatarMoeda(previa.saidasHoje)} | ` +
    `Total Dia: ${formatarMoeda(previa.saldoSistema)} (${resumoFormas || 'sem entradas'}) | ` +
    `Esperado (${modoComparacao === 'DINHEIRO_GAVETA' ? 'Dinheiro Gaveta' : 'Geral'}): ${formatarMoeda(baseEsperada)} | ` +
    `Contado: ${formatarMoeda(saldoFisicoContado)} | Diferença: ${formatarMoeda(dif)}` +
    (observacao ? ` | Obs: ${observacao}` : '');
  const empAlvo = empresa || sessao.empresa;

  const clientConf = getTenantSupabaseClient(sessao);
  if (clientConf) {
    const { error } = await clientConf.from('auditoria_logs').insert({
        id: gerarProtocoloConferencia(),
        empresa_id: empId,
        usuario: sessao.usuario.username,
        acao: 'CONFERENCIA_CAIXA',
        detalhes: detalhe,
        canal: 'WEB'
      });
      if (error) return { ok: false, msg: error.message };
      if (empAlvo.telegram_bot_token && empAlvo.telegram_chat_id) {
        const avisoNf = await obterTextoPendenciaNfTelegram(clientConf, empId);
        void enviarMensagemTelegram(
          empAlvo,
          `🧮 <b>Conferência de Caixa — ${empAlvo.nome}</b>\n` +
            `Operador: <b>${sessao.usuario.nome}</b>\n` +
            `Entradas: ${formatarMoeda(previa.entradasHoje)} | Saídas: ${formatarMoeda(previa.saidasHoje)}\n` +
            `Saldo Sistema: ${formatarMoeda(previa.saldoSistema)}\n` +
            `Contado na Gaveta: <b>${formatarMoeda(saldoFisicoContado)}</b>\n` +
            `Diferença: <b>${formatarMoeda(dif)}</b>` +
            (observacao ? `\nObs: ${observacao}` : '') +
            avisoNf
        );
      }
      notificarPlanilhaPosMutacao(sessao);
      return { ok: true, msg: `Conferência de caixa registrada! (${detalhe})` };
  }

  const db = loadLocalDb();
  appendLocalLog(db, empId, sessao.usuario.username, 'CONFERENCIA_CAIXA', detalhe);
  saveLocalDb(db);
  if (empAlvo.telegram_bot_token && empAlvo.telegram_chat_id) {
    void enviarMensagemTelegram(
      empAlvo,
      `🧮 <b>Conferência de Caixa — ${empAlvo.nome}</b>\n` +
        `Operador: <b>${sessao.usuario.nome}</b>\n` +
        `Saldo Sistema: ${formatarMoeda(previa.saldoSistema)} | Contado: <b>${formatarMoeda(saldoFisicoContado)}</b>\n` +
        `Diferença: <b>${formatarMoeda(dif)}</b>`
    );
  }
  return { ok: true, msg: `Conferência registrada com sucesso! Diferença: ${formatarMoeda(dif)}` };
}

export function calcularPreviaFechamentoFiscal(
  snapshot: PainelSnapshot,
  responsavel: string
): FechamentoFiscalPrevia {
  const mesYm = new Date().toISOString().slice(0, 7);
  const ultimoFiscLog = snapshot.logs
    .filter((l) => l.acao === 'FECHAMENTO_FISCAL' && l.data_hora)
    .sort((a, b) => new Date(b.data_hora).getTime() - new Date(a.data_hora).getTime())[0];
  const corteFiscIso = ultimoFiscLog?.data_hora || snapshot.ultimoFechamentoFiscal || '';
  const corteFiscMs = corteFiscIso ? new Date(corteFiscIso).getTime() : 0;

  const movsPeriodo = snapshot.caixa.filter((c) => {
    if (movimentoCaixaEstaCancelado(c)) return false;
    const dtStr = String(c.data_hora || '');
    if (corteFiscMs > 0) {
      const dtMs = new Date(dtStr).getTime();
      return !Number.isNaN(dtMs) && dtMs > corteFiscMs;
    }
    return dtStr.startsWith(mesYm);
  });

  const entradas = Number(
    movsPeriodo.filter((m) => m.tipo === 'ENTRADA').reduce((a, m) => a + (Number(m.valor) || 0), 0).toFixed(2)
  );
  const saidas = Number(
    movsPeriodo.filter((m) => m.tipo === 'SAIDA').reduce((a, m) => a + (Number(m.valor) || 0), 0).toFixed(2)
  );

  return {
    periodoReferencia: obterSubpastaMesAtual(),
    entradas,
    saidas,
    saldo: Number((entradas - saidas).toFixed(2)),
    qtdMovimentos: movsPeriodo.length,
    responsavel
  };
}

export async function registrarFechamentoFiscal(
  sessao: SessaoAtiva,
  previa: FechamentoFiscalPrevia,
  empresa?: Empresa
): Promise<{ ok: boolean; msg: string }> {
  const empId = sessao.unidadeAtivaId;
  const detalhe = `Fechamento ${previa.periodoReferencia} | Entradas: ${formatarMoeda(previa.entradas)} | Saídas: ${formatarMoeda(previa.saidas)} | Saldo: ${formatarMoeda(previa.saldo)}`;
  const empAlvo = empresa || sessao.empresa;

  const clientConf = getTenantSupabaseClient(sessao);
  if (clientConf) {
    const { error } = await clientConf.from('auditoria_logs').insert({
        id: gerarId('FISC'),
        empresa_id: empId,
        usuario: sessao.usuario.username,
        acao: 'FECHAMENTO_FISCAL',
        detalhes: detalhe,
        canal: 'WEB'
      });
      if (error) return { ok: false, msg: error.message };
      if (empAlvo.telegram_bot_token && empAlvo.telegram_chat_id) {
        const avisoNf = await obterTextoPendenciaNfTelegram(clientConf, empId);
        void enviarMensagemTelegram(
          empAlvo,
          `📑 <b>Fechamento Fiscal — ${empAlvo.nome}</b>\n` +
            `Período: <b>${previa.periodoReferencia}</b>\n` +
            `Responsável: ${previa.responsavel}\n` +
            `Entradas: ${formatarMoeda(previa.entradas)} | Saídas: ${formatarMoeda(previa.saidas)}\n` +
            `Resultado: <b>${formatarMoeda(previa.saldo)}</b>` +
            avisoNf
        );
      }
      notificarPlanilhaPosMutacao(sessao);
      return { ok: true, msg: `Fechamento fiscal de ${previa.periodoReferencia} consolidado!` };
  }

  const db = loadLocalDb();
  appendLocalLog(db, empId, sessao.usuario.username, 'FECHAMENTO_FISCAL', detalhe);
  saveLocalDb(db);
  if (empAlvo.telegram_bot_token && empAlvo.telegram_chat_id) {
    void enviarMensagemTelegram(
      empAlvo,
      `📑 <b>Fechamento Fiscal — ${empAlvo.nome}</b>\n` +
        `Período: <b>${previa.periodoReferencia}</b>\n` +
        `Resultado: <b>${formatarMoeda(previa.saldo)}</b>`
    );
  }
  return { ok: true, msg: `Fechamento fiscal consolidado com sucesso!` };
}

// ====================================================================
// 11. CLIENTES, AÇÕES AVANÇADAS DE COMANDA & EDIÇÃO DE EQUIPE
// ====================================================================

function normalizarNomeClienteChave(nome?: string): string {
  return String(nome || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function normalizarTelefoneDigitos(telefone?: string): string {
  return String(telefone || '').replace(/\D/g, '');
}

async function validarLimiteFiadoCliente(
  sessao: SessaoAtiva,
  nomeCliente: string,
  valorNovoFiado: number,
  dbLocal?: LocalDatabase
): Promise<{ ok: boolean; msg?: string }> {
  const nomeChave = normalizarNomeClienteChave(nomeCliente);
  if (!nomeChave || !(valorNovoFiado > 0)) return { ok: true };

  const empId = sessao.unidadeAtivaId;
  let clientesLista: Cliente[] = [];
  let contasReceberLista: ContaReceber[] = [];

  const client = getTenantSupabaseClient(sessao);
  if (client) {
    const [cliRes, recRes] = await Promise.all([
      client.from('clientes').select('*').eq('empresa_id', empId),
      client.from('contas_a_receber').select('*').eq('empresa_id', empId)
    ]);
    clientesLista = (cliRes.data || []) as Cliente[];
    contasReceberLista = (recRes.data || []) as ContaReceber[];
  } else {
    const db = dbLocal || loadLocalDb();
    clientesLista = db.clientes.filter((c) => c.empresa_id === empId);
    contasReceberLista = db.contasReceber.filter((r) => r.empresa_id === empId);
  }

  const cliente = clientesLista.find((c) => normalizarNomeClienteChave(c.nome) === nomeChave);
  if (!cliente) return { ok: true };

  if (String(cliente.status || 'ATIVO').toUpperCase() !== 'ATIVO') {
    return {
      ok: false,
      msg: `Cliente "${cliente.nome}" está BLOQUEADO e não pode comprar no Fiado.`
    };
  }

  const limite = Number(cliente.limite_fiado) || 0;
  if (limite > 0) {
    const saldoAberto = contasReceberLista
      .filter((r) => r.status !== 'PAGO' && normalizarNomeClienteChave(r.cliente) === nomeChave)
      .reduce((acc, r) => acc + (Number(r.valor) || 0), 0);

    if (saldoAberto + valorNovoFiado > limite + 0.01) {
      return {
        ok: false,
        msg: `Limite de fiado excedido para "${cliente.nome}"! Limite: ${formatarMoeda(limite)} | Em aberto: ${formatarMoeda(saldoAberto)} | Novo fiado: ${formatarMoeda(valorNovoFiado)}.`
      };
    }
  }

  return { ok: true };
}

export async function cadastrarCliente(
  sessao: SessaoAtiva,
  dados: { nome: string; telefone: string; endereco: string; limite_fiado?: number; observacao?: string }
): Promise<{ ok: boolean; msg: string; cliente?: Cliente }> {
  const empId = sessao.unidadeAtivaId;
  const nomeLimpo = dados.nome.trim();
  const telLimpo = dados.telefone.trim();
  const telDigitos = normalizarTelefoneDigitos(telLimpo);
  const nomeChave = normalizarNomeClienteChave(nomeLimpo);
  if (!nomeLimpo) return { ok: false, msg: 'Informe o nome do cliente.' };

  const novo: Cliente = {
    id: gerarId('CLI'),
    empresa_id: empId,
    nome: nomeLimpo,
    telefone: telLimpo,
    endereco: dados.endereco.trim(),
    limite_fiado: Math.max(0, Number(dados.limite_fiado) || 0),
    saldo_devedor: 0,
    status: 'ATIVO',
    observacao: (dados.observacao || '').trim()
  };

  const clientCli = getTenantSupabaseClient(sessao);
  if (clientCli) {
    const { data: existentes } = await clientCli
      .from('clientes')
      .select('id,nome,telefone')
      .eq('empresa_id', empId);
    for (const c of (existentes || []) as Array<{ id: string; nome: string; telefone?: string }>) {
      if (normalizarNomeClienteChave(c.nome) === nomeChave) {
        return { ok: false, msg: `Já existe um cliente cadastrado com o nome "${c.nome}".` };
      }
      if (telDigitos && normalizarTelefoneDigitos(c.telefone) === telDigitos) {
        return { ok: false, msg: `Telefone já cadastrado para o cliente "${c.nome}".` };
      }
    }

    const { error } = await clientCli.from('clientes').insert({
        id: novo.id,
        empresa_id: novo.empresa_id,
        nome: novo.nome,
        telefone: novo.telefone,
        endereco: novo.endereco,
        limite_fiado: novo.limite_fiado,
        saldo_devedor: novo.saldo_devedor,
        status: novo.status,
        observacao: novo.observacao || ''
      });
      if (error) return { ok: false, msg: error.message };
      notificarPlanilhaPosMutacao(sessao);
      return { ok: true, msg: `Cliente "${nomeLimpo}" cadastrado!`, cliente: novo };
  }

  const db = loadLocalDb();
  for (const c of db.clientes.filter((x) => x.empresa_id === empId)) {
    if (normalizarNomeClienteChave(c.nome) === nomeChave) {
      return { ok: false, msg: `Já existe um cliente cadastrado com o nome "${c.nome}".` };
    }
    if (telDigitos && normalizarTelefoneDigitos(c.telefone) === telDigitos) {
      return { ok: false, msg: `Telefone já cadastrado para o cliente "${c.nome}".` };
    }
  }

  db.clientes.unshift(novo);
  appendLocalLog(db, empId, sessao.usuario.username, 'CLIENTE_CADASTRADO', nomeLimpo);
  saveLocalDb(db);
  return { ok: true, msg: `Cliente "${nomeLimpo}" cadastrado com sucesso!`, cliente: novo };
}

export async function editarCliente(
  sessao: SessaoAtiva,
  clienteId: string,
  dados: {
    nome: string;
    telefone: string;
    endereco: string;
    limite_fiado: number;
    status: string;
    observacao?: string;
  }
): Promise<{ ok: boolean; msg: string }> {
  const empId = sessao.unidadeAtivaId;
  const nomeLimpo = dados.nome.trim();
  const telLimpo = dados.telefone.trim();
  const telDigitos = normalizarTelefoneDigitos(telLimpo);
  const nomeChave = normalizarNomeClienteChave(nomeLimpo);
  if (!nomeLimpo) return { ok: false, msg: 'Informe o nome do cliente.' };

  const patch = {
    nome: nomeLimpo,
    telefone: telLimpo,
    endereco: dados.endereco.trim(),
    limite_fiado: Math.max(0, Number(dados.limite_fiado) || 0),
    status: dados.status || 'ATIVO',
    observacao: (dados.observacao || '').trim()
  };

  const client = getTenantSupabaseClient(sessao);
  if (client) {
    const { data: existentes } = await client
      .from('clientes')
      .select('id,nome,telefone')
      .eq('empresa_id', empId);
    const listaExistentes = (existentes || []) as Array<{ id: string; nome: string; telefone?: string }>;
    const alvoAtual = listaExistentes.find((c) => c.id === clienteId);
    const nomeOriginalChave = alvoAtual ? normalizarNomeClienteChave(alvoAtual.nome) : nomeChave;

    // Registros legados duplicados com o mesmo nome do cliente atual serão mesclados/removidos ao salvar
    const idsDuplicadosLegados = new Set(
      listaExistentes
        .filter((c) => c.id !== clienteId && normalizarNomeClienteChave(c.nome) === nomeOriginalChave)
        .map((c) => c.id)
    );

    for (const c of listaExistentes) {
      if (c.id === clienteId || idsDuplicadosLegados.has(c.id)) continue;
      if (normalizarNomeClienteChave(c.nome) === nomeChave) {
        return { ok: false, msg: `Já existe outro cliente com o nome "${c.nome}".` };
      }
      if (telDigitos && normalizarTelefoneDigitos(c.telefone) === telDigitos) {
        return { ok: false, msg: `Telefone já cadastrado para o cliente "${c.nome}".` };
      }
    }

    const { error } = await client
      .from('clientes')
      .update(patch)
      .eq('id', clienteId)
      .eq('empresa_id', empId);
    if (error) return { ok: false, msg: error.message };

    if (idsDuplicadosLegados.size > 0) {
      await client
        .from('clientes')
        .delete()
        .eq('empresa_id', empId)
        .in('id', Array.from(idsDuplicadosLegados));
    }

    await client.from('auditoria_logs').insert({
      id: gerarId('LOG'),
      empresa_id: empId,
      usuario: sessao.usuario.username,
      acao: 'CLIENTE_EDITADO',
      detalhes: `${nomeLimpo} (${clienteId})`,
      canal: 'WEB'
    });
    notificarPlanilhaPosMutacao(sessao);
    return { ok: true, msg: `Cliente "${nomeLimpo}" atualizado!` };
  }

  const db = loadLocalDb();
  const alvo = db.clientes.find((c) => c.id === clienteId && c.empresa_id === empId);
  if (!alvo) return { ok: false, msg: 'Cliente não encontrado.' };
  const nomeOriginalLocal = normalizarNomeClienteChave(alvo.nome);
  const idsDupLocal = new Set(
    db.clientes
      .filter((x) => x.empresa_id === empId && x.id !== clienteId && normalizarNomeClienteChave(x.nome) === nomeOriginalLocal)
      .map((x) => x.id)
  );
  for (const c of db.clientes.filter((x) => x.empresa_id === empId && x.id !== clienteId && !idsDupLocal.has(x.id))) {
    if (normalizarNomeClienteChave(c.nome) === nomeChave) {
      return { ok: false, msg: `Já existe outro cliente com o nome "${c.nome}".` };
    }
    if (telDigitos && normalizarTelefoneDigitos(c.telefone) === telDigitos) {
      return { ok: false, msg: `Telefone já cadastrado para o cliente "${c.nome}".` };
    }
  }
  if (idsDupLocal.size > 0) {
    db.clientes = db.clientes.filter((x) => !idsDupLocal.has(x.id));
  }
  Object.assign(alvo, patch);
  appendLocalLog(db, empId, sessao.usuario.username, 'CLIENTE_EDITADO', `${nomeLimpo} (${clienteId})`);
  saveLocalDb(db);
  return { ok: true, msg: `Cliente "${nomeLimpo}" atualizado!` };
}

export async function alternarStatusCliente(
  sessao: SessaoAtiva,
  cliente: Cliente
): Promise<{ ok: boolean; msg: string }> {
  const empId = sessao.unidadeAtivaId;
  const atualAtivo = String(cliente.status || 'ATIVO').toUpperCase() === 'ATIVO';
  const novoStatus = atualAtivo ? 'BLOQUEADO' : 'ATIVO';

  const client = getTenantSupabaseClient(sessao);
  if (client) {
    const { error } = await client
      .from('clientes')
      .update({ status: novoStatus })
      .eq('id', cliente.id)
      .eq('empresa_id', empId);
    if (error) return { ok: false, msg: error.message };

    await client.from('auditoria_logs').insert({
      id: gerarId('LOG'),
      empresa_id: empId,
      usuario: sessao.usuario.username,
      acao: 'CLIENTE_STATUS',
      detalhes: `${cliente.nome} -> ${novoStatus}`,
      canal: 'WEB'
    });
    notificarPlanilhaPosMutacao(sessao);
    return { ok: true, msg: `Cliente "${cliente.nome}" alterado para ${novoStatus}.` };
  }

  const db = loadLocalDb();
  const alvo = db.clientes.find((c) => c.id === cliente.id && c.empresa_id === empId);
  if (!alvo) return { ok: false, msg: 'Cliente não encontrado.' };
  alvo.status = novoStatus;
  appendLocalLog(db, empId, sessao.usuario.username, 'CLIENTE_STATUS', `${cliente.nome} -> ${novoStatus}`);
  saveLocalDb(db);
  return { ok: true, msg: `Cliente "${cliente.nome}" alterado para ${novoStatus}.` };
}

export async function registrarPagamentoParcialComanda(
  sessao: SessaoAtiva,
  comanda: Comanda,
  valorPago: number,
  formaPagamento: FormaPagamento,
  observacaoOutro?: string,
  taxaServico10 = 0
): Promise<{ ok: boolean; msg: string }> {
  const empId = sessao.unidadeAtivaId;
  const val = Number(valorPago) || 0;
  const taxa10 = Math.max(0, Number(taxaServico10) || 0);
  const valCaixa = Number((val + taxa10).toFixed(2));
  if (val <= 0) return { ok: false, msg: 'Informe um valor maior que zero para abater.' };
  if (formaPagamento === 'Fiado') {
    const valLim = await validarLimiteFiadoCliente(sessao, comanda.cliente, val);
    if (!valLim.ok) return { ok: false, msg: valLim.msg || 'Limite de fiado excedido.' };
  }

  const obsOutroLimpa = (observacaoOutro || '').trim();
  if (formaPagamento === 'Outro' && !obsOutroLimpa) {
    return { ok: false, msg: 'Informe a observação explicando o uso da forma de pagamento "Outro".' };
  }

  const agora = new Date().toISOString();
  const novoPago = Number((comanda.pago + val).toFixed(2));
  const novoSaldo = Math.max(0, Number((comanda.total - novoPago).toFixed(2)));
  const quitou = novoSaldo <= 0.009;

  const clientParc = getTenantSupabaseClient(sessao);
  if (clientParc) {
    const { error } = await clientParc
      .from('comandas')
        .update({
          pago: novoPago,
          saldo: novoSaldo,
          status: quitou ? 'PAGA' : 'ABERTA',
          data_fechamento: quitou ? agora : null,
          updated_at: agora
        })
        .eq('id', comanda.id)
        .eq('empresa_id', empId);
      if (error) return { ok: false, msg: error.message };

      await clientParc.from('caixa').insert({
        id: gerarId('CX'),
        empresa_id: empId,
        data_hora: agora,
        tipo: 'ENTRADA',
        valor: valCaixa,
        forma_pagamento: formaPagamento,
        descricao: `Abatimento Comanda #${comanda.pedido} (${comanda.cliente}) [${formaPagamento}${taxa10 > 0 ? ` | +10% Serv: ${formatarMoeda(taxa10)}` : ''}${obsOutroLimpa ? ` | Obs: ${obsOutroLimpa}` : ''}]`,
        operador: sessao.usuario.username,
        origem: 'Comanda'
      });
      if (taxa10 > 0) {
        await registrarOuAcumularComissaoVendedor10(
          clientParc,
          empId,
          sessao.usuario.nome || sessao.usuario.username,
          formatarCodigoPedidoPadrao('C', comanda.pedido),
          taxa10,
          agora
        );
      }

      if (formaPagamento === 'Outro') {
        await clientParc.from('auditoria_logs').insert({
          id: gerarId('LOG'),
          empresa_id: empId,
          usuario: sessao.usuario.username,
          acao: 'PAGAMENTO_OUTRO',
          detalhes: `Abatimento Comanda #${comanda.pedido} (${comanda.cliente}) | ${formatarMoeda(val)} | Obs: ${obsOutroLimpa}`,
          canal: 'WEB'
        });
        const empAlvo = sessao.empresa;
        if (empAlvo.telegram_bot_token && empAlvo.telegram_chat_id) {
          void enviarMensagemTelegram(
            empAlvo,
            `🏷️ <b>Pagamento Parcial em "Outro" — ${empAlvo.nome}</b>\n` +
              `Comanda: <b>#${comanda.pedido}</b> (${comanda.cliente})\n` +
              `Valor: <b>${formatarMoeda(val)}</b>\n` +
              `Operador: <b>${sessao.usuario.nome}</b>\n` +
              `Observação: <b>${obsOutroLimpa}</b>\n` +
              `💡 <i>Apenas o Dono pode converter esta forma de pagamento em Financeiro → Extrato do Caixa.</i>`
          );
        }
      }

      if (quitou) {
        const { data: vendasExistentes } = await clientParc
          .from('vendas')
          .select('id')
          .eq('empresa_id', empId)
          .eq('pedido_id', String(comanda.pedido));
        if (!vendasExistentes || vendasExistentes.length === 0) {
          let itensCmd = comanda.itens || [];
          if (itensCmd.length === 0) {
            const { data: itensDb } = await clientParc
              .from('comanda_itens')
              .select('*')
              .eq('empresa_id', empId)
              .eq('comanda_id', comanda.id);
            itensCmd = (itensDb || []) as ComandaItem[];
          }
          if (itensCmd.length > 0) {
            const rowsVendas = itensCmd.map((item) => ({
              id: gerarId('VN'),
              empresa_id: empId,
              data_hora: agora,
              produto_id: item.produto_id || null,
              produto_nome: item.produto_nome,
              quantidade: item.quantidade,
              valor_unitario: item.preco_unitario,
              valor_total: item.subtotal,
              forma_pagamento: formaPagamento,
              origem: 'Comanda' as const,
              pedido_id: String(comanda.pedido),
              cliente_nome: comanda.cliente,
              vendedor: sessao.usuario.username
            }));
            await clientParc.from('vendas').insert(rowsVendas);
          }
        }
      }

      notificarPlanilhaPosMutacao(sessao);
      return {
        ok: true,
        msg: quitou
          ? `Comanda #${comanda.pedido} quitada com sucesso!`
          : `Abatimento de ${formatarMoeda(val)} registrado! Saldo restante: ${formatarMoeda(novoSaldo)}.`
      };
  }

  const db = loadLocalDb();
  const alvo = db.comandas.find((c) => c.id === comanda.id && c.empresa_id === empId);
  if (!alvo) return { ok: false, msg: 'Comanda não encontrada.' };

  alvo.pago = novoPago;
  alvo.saldo = novoSaldo;
  if (quitou) {
    alvo.status = 'PAGA';
    alvo.data_fechamento = agora;
  }

  db.caixa.unshift({
    id: gerarId('CX'),
    empresa_id: empId,
    data_hora: agora,
    tipo: 'ENTRADA',
    valor: val,
    forma_pagamento: formaPagamento,
    descricao: `Abatimento Comanda #${alvo.pedido} (${alvo.cliente})`,
    operador: sessao.usuario.username,
    origem: 'Comanda'
  });
  appendLocalLog(db, empId, sessao.usuario.username, 'COMANDA_ABATIMENTO', `${alvo.pedido}: ${formatarMoeda(val)}`);
  saveLocalDb(db);
  return {
    ok: true,
    msg: quitou
      ? `Comanda ${alvo.pedido} quitada com sucesso!`
      : `Abatimento de ${formatarMoeda(val)} registrado! Saldo: ${formatarMoeda(novoSaldo)}.`
  };
}

export async function converterFormaPagamentoCaixa(
  sessao: SessaoAtiva,
  movimento: MovimentoCaixa,
  novaForma: Exclude<FormaPagamento, 'Outro'>
): Promise<{ ok: boolean; msg: string }> {
  if (String(sessao.usuario.perfil || '').toUpperCase() !== 'DONO') {
    return { ok: false, msg: 'Acesso negado: apenas o Dono pode converter a forma de pagamento.' };
  }
  const empId = sessao.unidadeAtivaId;
  const agora = new Date().toISOString();
  const formaAntiga = movimento.forma_pagamento || 'Outro';

  const mCmd = String(movimento.descricao || '').match(/Comanda\s*#?(\d+)\s*\(([^)]+)\)/i);
  const numCmd = mCmd?.[1] || '';
  const cliNome = mCmd?.[2]?.trim() || 'Cliente';

  const client = getTenantSupabaseClient(sessao);
  if (client) {
    if (novaForma === 'Fiado') {
      const idCr = await gerarProximoIdContasReceber(client, empId);
      const { error: errRec } = await client.from('contas_a_receber').insert({
        id: idCr,
        empresa_id: empId,
        data: agora,
        cliente: cliNome,
        descricao: numCmd ? `Comanda Fiado ${formatarCodigoPedidoPadrao('C', numCmd)}` : movimento.descricao,
        valor: movimento.valor,
        status: 'PENDENTE',
        forma_pagamento: 'Fiado',
        comanda_origem: numCmd ? formatarCodigoPedidoPadrao('C', numCmd) : movimento.id
      });
      if (errRec) return { ok: false, msg: errRec.message };

      await client.from('caixa').delete().eq('id', movimento.id).eq('empresa_id', empId);
    } else {
      const novaDesc = `${movimento.descricao} [Convertido de ${formaAntiga} → ${novaForma}]`;
      const { error } = await client
        .from('caixa')
        .update({ forma_pagamento: novaForma, descricao: novaDesc })
        .eq('id', movimento.id)
        .eq('empresa_id', empId);
      if (error) return { ok: false, msg: error.message };
    }

    if (numCmd) {
      await client
        .from('vendas')
        .update({ forma_pagamento: novaForma })
        .eq('empresa_id', empId)
        .eq('pedido_id', numCmd)
        .in('forma_pagamento', ['Outro', 'Outros', formaAntiga]);
    }

    await client.from('auditoria_logs').insert({
      id: gerarId('LOG'),
      empresa_id: empId,
      usuario: sessao.usuario.username,
      acao: 'CONVERSAO_FORMA_PGTO',
      detalhes: `${movimento.descricao} (${formatarMoeda(movimento.valor)}): ${formaAntiga} → ${novaForma}`,
      canal: 'WEB'
    });

    notificarPlanilhaPosMutacao(sessao);
    return {
      ok: true,
      msg:
        novaForma === 'Fiado'
          ? `Lançamento convertido de "${formaAntiga}" para Fiado (movido para Contas a Receber)!`
          : `Forma de pagamento convertida de "${formaAntiga}" para "${novaForma}"!`
    };
  }

  const db = loadLocalDb();
  if (novaForma === 'Fiado') {
    db.caixa = db.caixa.filter((c) => c.id !== movimento.id);
    db.contasReceber.unshift({
      id: gerarId('CR'),
      empresa_id: empId,
      data: agora,
      cliente: cliNome,
      descricao: numCmd ? `Comanda Fiado ${formatarCodigoPedidoPadrao('C', numCmd)}` : movimento.descricao,
      valor: movimento.valor,
      status: 'PENDENTE',
      comanda_origem: numCmd || movimento.id
    });
  } else {
    const alvo = db.caixa.find((c) => c.id === movimento.id && c.empresa_id === empId);
    if (!alvo) return { ok: false, msg: 'Lançamento não encontrado.' };
    alvo.forma_pagamento = novaForma;
    alvo.descricao = `${alvo.descricao} [Convertido de ${formaAntiga} → ${novaForma}]`;
  }
  appendLocalLog(db, empId, sessao.usuario.username, 'CONVERSAO_FORMA_PGTO', `${formaAntiga} -> ${novaForma}`);
  saveLocalDb(db);
  return { ok: true, msg: `Forma de pagamento convertida para "${novaForma}"!` };
}

export async function removerItemComanda(
  sessao: SessaoAtiva,
  comanda: Comanda,
  item: ComandaItem
): Promise<{ ok: boolean; msg: string }> {
  const empId = sessao.unidadeAtivaId;
  const novoTotal = Math.max(0, Number((comanda.total - item.subtotal).toFixed(2)));
  const novoSaldo = Math.max(0, Number((novoTotal - comanda.pago).toFixed(2)));
  const agora = new Date().toISOString();

  const clientRem = getTenantSupabaseClient(sessao);
  if (clientRem) {
    await clientRem.from('comanda_itens').delete().eq('id', item.id).eq('empresa_id', empId);
    await clientRem
      .from('comandas')
      .update({ total: novoTotal, saldo: novoSaldo, updated_at: agora })
      .eq('id', comanda.id)
      .eq('empresa_id', empId);
    if (item.produto_id) {
      const { data: prodRow } = await clientRem
        .from('produtos')
        .select('estoque_atual')
        .eq('id', item.produto_id)
        .single();
      if (prodRow) {
        await clientRem
          .from('produtos')
          .update({ estoque_atual: (Number((prodRow as { estoque_atual: number }).estoque_atual) || 0) + item.quantidade })
          .eq('id', item.produto_id);
      }
    }
    await clientRem.from('auditoria_logs').insert({
      id: gerarId('LOG'),
      empresa_id: empId,
      usuario: sessao.usuario.username,
      acao: 'COMANDA_ESTORNO_ITEM',
      detalhes: `Comanda #${comanda.pedido} (${comanda.cliente}): -${item.quantidade}x ${item.produto_nome} (${formatarMoeda(item.subtotal)})`,
      canal: 'WEB'
    });
    notificarPlanilhaPosMutacao(sessao);
    return { ok: true, msg: `Item "${item.produto_nome}" estornado para o estoque!` };
  }

  const db = loadLocalDb();
  const alvo = db.comandas.find((c) => c.id === comanda.id && c.empresa_id === empId);
  if (!alvo) return { ok: false, msg: 'Comanda não encontrada.' };
  alvo.itens = alvo.itens.filter((i) => i.id !== item.id);
  alvo.total = novoTotal;
  alvo.saldo = novoSaldo;

  const prod = db.produtos.find((p) => (p.id === item.produto_id || p.nome === item.produto_nome) && p.empresa_id === empId);
  if (prod) prod.estoque_atual += item.quantidade;

  appendLocalLog(db, empId, sessao.usuario.username, 'COMANDA_ESTORNO_ITEM', `${alvo.pedido}: -${item.quantidade}x ${item.produto_nome}`);
  saveLocalDb(db);
  return { ok: true, msg: `Item "${item.produto_nome}" removido e estornado ao estoque!` };
}

export async function arquivarComandasQuitadasOuVazias(
  sessao: SessaoAtiva
): Promise<{ ok: boolean; msg: string }> {
  const empId = sessao.unidadeAtivaId;
  const agora = new Date().toISOString();

  const client = getTenantSupabaseClient(sessao);
  if (client) {
    const { data: abertas } = await client
      .from('comandas')
      .select('id,total,pago,saldo')
      .eq('empresa_id', empId)
      .eq('status', 'ABERTA');
    const idsArquivar = ((abertas || []) as Array<{ id: string; total: number; pago: number; saldo: number }>)
      .filter((c) => c.saldo <= 0.009 || c.total <= 0)
      .map((c) => c.id);

    if (idsArquivar.length === 0) {
      return { ok: true, msg: 'Nenhuma comanda quitada ou zerada para arquivar.' };
    }
    await client
      .from('comandas')
      .update({ status: 'PAGA', data_fechamento: agora, updated_at: agora })
      .in('id', idsArquivar);
    notificarPlanilhaPosMutacao(sessao);
    return { ok: true, msg: `${idsArquivar.length} comanda(s) arquivada(s) com sucesso!` };
  }

  const db = loadLocalDb();
  let count = 0;
  for (const c of db.comandas) {
    if (c.empresa_id === empId && c.status === 'ABERTA' && (c.saldo <= 0.009 || c.total <= 0)) {
      c.status = 'PAGA';
      c.data_fechamento = agora;
      count += 1;
    }
  }
  saveLocalDb(db);
  return { ok: true, msg: `${count} comanda(s) quitada(s)/zerada(s) arquivada(s)!` };
}

export async function editarUsuarioEquipe(
  sessao: SessaoAtiva,
  usuarioAlvo: Usuario,
  dados: { username?: string; nome: string; email: string; perfil: PerfilUsuario; novaSenha?: string; ativo?: boolean }
): Promise<{ ok: boolean; msg: string }> {
  if (usuarioAlvo.perfil === 'ADMIN') {
    return { ok: false, msg: 'O administrador técnico único não pode ser rebaixado ou alterado aqui.' };
  }
  if (dados.perfil === 'ADMIN') {
    return { ok: false, msg: 'Não é permitido promover usuários para ADMIN.' };
  }

  const empId = sessao.unidadeAtivaId;
  const patch: Record<string, unknown> = {
    nome: dados.nome.trim(),
    email: dados.email.trim().toLowerCase(),
    perfil: dados.perfil
  };
  if (dados.username && dados.username.trim()) {
    const uname = dados.username
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '');
    if (uname === 'admin' || uname === 'administrador') {
      return { ok: false, msg: 'O login "admin" é reservado ao administrador técnico.' };
    }
    if (uname) patch.username = uname;
  }
  if (dados.ativo !== undefined) {
    patch.ativo = dados.ativo;
  }
  if (dados.novaSenha && dados.novaSenha.trim().length >= 4) {
    patch.senha_hash = await sha256Hex(dados.novaSenha.trim());
  }

  const client = getTenantSupabaseClient(sessao);
  if (client) {
    const { error } = await client
      .from('usuarios')
      .update(patch)
      .eq('id', usuarioAlvo.id)
      .eq('empresa_id', empId);
    if (error) return { ok: false, msg: error.message };
    notificarPlanilhaPosMutacao(sessao);
    return { ok: true, msg: `Dados de ${dados.nome} atualizados!` };
  }

  const db = loadLocalDb();
  const u = db.usuarios.find((x) => x.id === usuarioAlvo.id && x.empresa_id === empId);
  if (u) {
    if (patch.username) u.username = String(patch.username);
    u.nome = dados.nome.trim();
    u.email = dados.email.trim().toLowerCase();
    u.perfil = dados.perfil;
    if (dados.ativo !== undefined) u.ativo = dados.ativo;
    if (patch.senha_hash) u.senha_hash = String(patch.senha_hash);
    saveLocalDb(db);
  }
  return { ok: true, msg: `Colaborador ${dados.nome} atualizado!` };
}

export async function abrirComandaComItens(
  sessao: SessaoAtiva,
  clienteNome: string,
  itens: ItemCarrinho[],
  permitirEstoqueNegativo = false
): Promise<{ ok: boolean; msg: string; comanda?: Comanda }> {
  if (itens.length === 0) {
    return { ok: false, msg: 'Adicione itens ao carrinho antes de abrir a comanda.' };
  }

  const empId = sessao.unidadeAtivaId;
  const perfil = String(sessao.usuario.perfil || '').toUpperCase();
  const podeAlterarValor = perfil === 'ADMIN' || perfil === 'DONO';
  const mapaPrecoCmd = new Map<string, number>();

  const client = getTenantSupabaseClient(sessao);
  if (client) {
    const ids = Array.from(new Set(itens.map((i) => i.produto.id)));
    const { data: prodsDb } = await client
      .from('produtos')
      .select('id,estoque_atual,preco_venda')
      .eq('empresa_id', empId)
      .in('id', ids);
    const mapaEst = new Map<string, number>();
    ((prodsDb || []) as Array<{ id: string; estoque_atual: number; preco_venda: number }>).forEach((r) => {
      mapaEst.set(r.id, Number(r.estoque_atual) || 0);
      mapaPrecoCmd.set(r.id, Number(r.preco_venda) || 0);
    });
    if (!permitirEstoqueNegativo) {
      for (const item of itens) {
        const disp = mapaEst.has(item.produto.id)
          ? (mapaEst.get(item.produto.id) as number)
          : Number(item.produto.estoque_atual) || 0;
        if (item.quantidade > disp) {
          return {
            ok: false,
            msg: `Abertura bloqueada: "${item.produto.nome}" possui apenas ${disp} un em estoque!`
          };
        }
      }
    }
  } else if (!permitirEstoqueNegativo) {
    const dbCheck = loadLocalDb();
    for (const item of itens) {
      const prod = dbCheck.produtos.find((p) => p.id === item.produto.id && p.empresa_id === empId);
      const disp = prod ? Number(prod.estoque_atual) || 0 : 0;
      if (item.quantidade > disp) {
        return {
          ok: false,
          msg: `Abertura bloqueada: "${item.produto.nome}" possui apenas ${disp} un em estoque!`
        };
      }
    }
  }

  const nomeFinal = clienteNome.trim() || 'Balcão';
  const aberta = await abrirComanda(sessao, nomeFinal);
  if (!aberta.ok || !aberta.comanda) {
    return aberta;
  }

  for (const item of itens) {
    const precoCatalogo = mapaPrecoCmd.get(item.produto.id) ?? item.produto.preco_venda;
    const prodReal: Produto = { ...item.produto, preco_venda: precoCatalogo };
    const resItem = await adicionarItemComanda(
      sessao,
      aberta.comanda.id,
      prodReal,
      item.quantidade,
      podeAlterarValor ? item.produto.preco_venda : precoCatalogo,
      permitirEstoqueNegativo
    );
    if (!resItem.ok) {
      return {
        ok: false,
        msg: `Comanda ${aberta.comanda.pedido} aberta, mas falhou ao lançar "${item.produto.nome}": ${resItem.msg}`,
        comanda: aberta.comanda
      };
    }
  }

  return {
    ok: true,
    msg: `Comanda ${aberta.comanda.pedido} (${nomeFinal}) aberta com ${itens.length} item(ns)!`,
    comanda: aberta.comanda
  };
}

export async function recalcularValoresEstoque(
  sessao: SessaoAtiva,
  produtos: Produto[]
): Promise<{ ok: boolean; msg: string }> {
  const empId = sessao.unidadeAtivaId;
  let atualizados = 0;
  let totalCusto = 0;
  let totalVenda = 0;

  const client = getTenantSupabaseClient(sessao);
  if (client) {
    for (const p of produtos) {
      const custo = Number(p.custo_medio) || 0;
      const venda = Number(p.preco_venda) || 0;
      const qtd = Number(p.estoque_atual) || 0;
      totalCusto += custo * qtd;
      totalVenda += venda * qtd;
      const margemCalculada = custo > 0 ? Number((((venda - custo) / custo) * 100).toFixed(2)) : 0;
      if (Math.abs((Number(p.margem_pct) || 0) - margemCalculada) > 0.01) {
        await client
          .from('produtos')
          .update({ margem_pct: margemCalculada, preco_sugerido: venda, updated_at: new Date().toISOString() })
          .eq('id', p.id)
          .eq('empresa_id', empId);
        atualizados += 1;
      }
    }
    await client.from('auditoria_logs').insert({
      id: gerarId('LOG'),
      empresa_id: empId,
      usuario: sessao.usuario.username,
      acao: 'RECALCULO_ESTOQUE',
      detalhes: `${produtos.length} produto(s) | ${atualizados} margem(ns) corrigida(s) | Custo: ${formatarMoeda(totalCusto)} | Venda: ${formatarMoeda(totalVenda)}`,
      canal: 'WEB'
    });
    return {
      ok: true,
      msg: `Estoque recalculado! ${atualizados} produto(s) atualizado(s). Valor Venda: ${formatarMoeda(totalVenda)}.`
    };
  }

  const db = loadLocalDb();
  for (const p of db.produtos) {
    if (p.empresa_id !== empId) continue;
    const custo = Number(p.custo_medio) || 0;
    const venda = Number(p.preco_venda) || 0;
    const qtd = Number(p.estoque_atual) || 0;
    totalCusto += custo * qtd;
    totalVenda += venda * qtd;
    const margemCalculada = custo > 0 ? Number((((venda - custo) / custo) * 100).toFixed(2)) : 0;
    if (Math.abs((Number(p.margem_pct) || 0) - margemCalculada) > 0.01) {
      p.margem_pct = margemCalculada;
      p.preco_sugerido = venda;
      atualizados += 1;
    }
  }
  appendLocalLog(
    db,
    empId,
    sessao.usuario.username,
    'RECALCULO_ESTOQUE',
    `${atualizados} atualizado(s) | Custo: ${formatarMoeda(totalCusto)} | Venda: ${formatarMoeda(totalVenda)}`
  );
  saveLocalDb(db);
  return {
    ok: true,
    msg: `Recálculo concluído: ${atualizados} produto(s) atualizado(s). Patrimônio em venda: ${formatarMoeda(totalVenda)}.`
  };
}

export async function registrarLogoutOperadorSemConferencia(
  sessao: SessaoAtiva,
  snapshot: PainelSnapshot | null
): Promise<void> {
  const empId = sessao.unidadeAtivaId;
  const hojeYmd = new Date().toISOString().slice(0, 10);
  const empAlvo = snapshot?.empresa || sessao.empresa;

  const logsDisponiveis = snapshot?.logs || loadLocalDb().logs.filter((l) => l.empresa_id === empId);
  const fezConferenciaHoje = logsDisponiveis.some(
    (lg) =>
      lg.acao === 'CONFERENCIA_CAIXA' &&
      String(lg.usuario || '').toLowerCase() === sessao.usuario.username.toLowerCase() &&
      String(lg.data_hora || '').startsWith(hojeYmd)
  );

  if (fezConferenciaHoje) return;

  const detalhe = `Operador "${sessao.usuario.nome}" (${sessao.usuario.username}) encerrou sessão sem registro de conferência de caixa em ${formatarDataBr(hojeYmd)}.`;

  const client = getTenantSupabaseClient(sessao);
  if (client) {
    await client.from('auditoria_logs').insert({
      id: gerarId('LOG'),
      empresa_id: empId,
      usuario: sessao.usuario.username,
      acao: 'LOGOUT_SEM_CONFERENCIA',
      detalhes: detalhe,
      canal: 'WEB'
    });
  } else {
    const db = loadLocalDb();
    appendLocalLog(db, empId, sessao.usuario.username, 'LOGOUT_SEM_CONFERENCIA', detalhe);
    saveLocalDb(db);
  }

  if (empAlvo.telegram_bot_token && empAlvo.telegram_chat_id) {
    void enviarMensagemTelegram(
      empAlvo,
      `⚠️ <b>Alerta de Turno — ${empAlvo.nome}</b>\n${detalhe}`
    );
  }
}

// ====================================================================
// 13. PAINEL MASTER SAAS (EXCLUSIVO ADMIN — LICENÇAS, USUÁRIOS, CHAVES)
// ====================================================================

const MASTER_SAAS_CFG_KEY = 'saas_master_cfg_v1';
const MASTER_SAAS_COMPROVANTES_KEY = 'saas_master_comprovantes_v1';
const MASTER_SAAS_FATURAS_KEY = 'saas_master_faturas_v1';

export const APP_VERSION_SAAS = '2.0.0';

const DEFAULT_CONFIG_MASTER_SAAS: ConfigMasterSaas = {
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
  instrucoes_pagamento: '',
  site_empresa_master: ''
};

function lerJsonLocalStorage<T>(chave: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(chave);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function gravarJsonLocalStorage<T>(chave: string, val: T): void {
  try {
    localStorage.setItem(chave, JSON.stringify(val));
  } catch {
    // ignore storage quota errors
  }
}

async function lerChaveConfigSaas<T>(
  client: ReturnType<typeof getTenantSupabaseClient>,
  chaveConfig: string,
  chaveLocal: string,
  fallback: T
): Promise<T> {
  if (client) {
    try {
      const { data } = await client
        .from('config')
        .select('valor')
        .eq('chave', chaveConfig)
        .maybeSingle();
      if (data && (data as { valor?: string }).valor) {
        const parsed = JSON.parse(String((data as { valor: string }).valor)) as T;
        gravarJsonLocalStorage(chaveLocal, parsed);
        return parsed;
      }
    } catch {
      // fallback local
    }
  }
  return lerJsonLocalStorage<T>(chaveLocal, fallback);
}

async function gravarChaveConfigSaas<T>(
  client: ReturnType<typeof getTenantSupabaseClient>,
  chaveConfig: string,
  chaveLocal: string,
  valor: T
): Promise<void> {
  gravarJsonLocalStorage(chaveLocal, valor);
  if (client) {
    try {
      await client.from('config').upsert(
        {
          chave: chaveConfig,
          valor: JSON.stringify(valor),
          updated_at: new Date().toISOString()
        },
        { onConflict: 'chave' }
      );
    } catch {
      // ignore if config table is restricted
    }
  }
}

async function notificarAdminSaasTelegram(cfg: ConfigMasterSaas, mensagem: string): Promise<void> {
  const tok = String(cfg.telegram_bot_token_admin || '').trim();
  const chatId = String(cfg.telegram_chat_id_admin || '').trim();
  if (!tok || !chatId) return;
  try {
    await enviarMensagemTelegram(
      {
        nome: 'Master SaaS 360°',
        telegram_bot_token: tok,
        telegram_chat_id: chatId
      } as Empresa,
      mensagem
    );
  } catch {
    // non-blocking
  }
}

export async function obterConfigMasterSaasPublica(sessao: SessaoAtiva): Promise<ConfigMasterSaas> {
  const client = getTenantSupabaseClient(sessao);
  const cfg = await lerChaveConfigSaas<ConfigMasterSaas>(
    client,
    'SAAS_MASTER_CONFIG',
    MASTER_SAAS_CFG_KEY,
    DEFAULT_CONFIG_MASTER_SAAS
  );
  return { ...DEFAULT_CONFIG_MASTER_SAAS, ...cfg };
}

export async function obterDadosMasterSaasAdmin(sessao: SessaoAtiva): Promise<MasterSaasSnapshot> {
  if (String(sessao.usuario.perfil || '').toUpperCase() !== 'ADMIN') {
    throw new Error('Acesso restrito ao perfil ADMIN.');
  }

  const client = getTenantSupabaseClient(sessao);
  if (client) {
    const [empRes, usrRes, sesRes, cfg, comprovantes, faturas] = await Promise.all([
      client.from('empresas').select('*').order('created_at', { ascending: true }),
      client.from('usuarios').select('*').order('nome', { ascending: true }),
      client.from('sessoes').select('usuario_id,expires_at').gt('expires_at', new Date().toISOString()),
      lerChaveConfigSaas<ConfigMasterSaas>(client, 'SAAS_MASTER_CONFIG', MASTER_SAAS_CFG_KEY, DEFAULT_CONFIG_MASTER_SAAS),
      lerChaveConfigSaas<ComprovantePagamentoSaas[]>(client, 'SAAS_MASTER_COMPROVANTES', MASTER_SAAS_COMPROVANTES_KEY, []),
      lerChaveConfigSaas<FaturaSaas[]>(client, 'SAAS_MASTER_FATURAS', MASTER_SAAS_FATURAS_KEY, [])
    ]);

    const sessoesPorUsuario: Record<string, number> = {};
    for (const s of (sesRes.data || []) as Array<{ usuario_id?: string }>) {
      const uid = String(s.usuario_id || '');
      if (uid) sessoesPorUsuario[uid] = (sessoesPorUsuario[uid] || 0) + 1;
    }
    sessoesPorUsuario[sessao.usuario.id] = Math.max(1, sessoesPorUsuario[sessao.usuario.id] || 0);

    return {
      empresas: (empRes.data || []) as Empresa[],
      usuarios: (usrRes.data || []) as Usuario[],
      sessoesPorUsuario,
      comprovantes: Array.isArray(comprovantes) ? comprovantes : [],
      faturas: Array.isArray(faturas) ? faturas : [],
      configMaster: { ...DEFAULT_CONFIG_MASTER_SAAS, ...cfg }
    };
  }

  const db = loadLocalDb();
  return {
    empresas: db.empresas || [],
    usuarios: db.usuarios || [],
    sessoesPorUsuario: { [sessao.usuario.id]: 1 },
    comprovantes: lerJsonLocalStorage<ComprovantePagamentoSaas[]>(MASTER_SAAS_COMPROVANTES_KEY, []),
    faturas: lerJsonLocalStorage<FaturaSaas[]>(MASTER_SAAS_FATURAS_KEY, []),
    configMaster: {
      ...DEFAULT_CONFIG_MASTER_SAAS,
      ...lerJsonLocalStorage<ConfigMasterSaas>(MASTER_SAAS_CFG_KEY, DEFAULT_CONFIG_MASTER_SAAS)
    }
  };
}

export async function atualizarLicencaEmpresaAdmin(
  sessao: SessaoAtiva,
  empresaId: string,
  patch: {
    plano?: PlanoSaas;
    status_assinatura?: StatusAssinatura;
    valido_ate?: string;
  }
): Promise<{ ok: boolean; msg: string }> {
  if (String(sessao.usuario.perfil || '').toUpperCase() !== 'ADMIN') {
    return { ok: false, msg: 'Apenas o ADMIN pode alterar licenças.' };
  }

  const client = getTenantSupabaseClient(sessao);
  const agora = new Date().toISOString();
  if (client) {
    const { error } = await client
      .from('empresas')
      .update({ ...patch, updated_at: agora })
      .eq('id', empresaId);
    if (error) return { ok: false, msg: error.message };

    const cfg = await obterConfigMasterSaasPublica(sessao);
    void notificarAdminSaasTelegram(
      cfg,
      `👑 <b>Licença Atualizada — Master SaaS</b>\nEmpresa: <code>${empresaId}</code>\nPlano: <b>${patch.plano || '-'}</b> | Status: <b>${patch.status_assinatura || '-'}</b>\nVálido até: <b>${patch.valido_ate || '-'}</b>`
    );
    return { ok: true, msg: 'Licença da empresa atualizada no Supabase!' };
  }

  const db = loadLocalDb();
  const alvo = db.empresas.find((e) => e.id === empresaId);
  if (!alvo) return { ok: false, msg: 'Empresa não encontrada.' };
  Object.assign(alvo, patch);
  saveLocalDb(db);
  return { ok: true, msg: 'Licença da empresa atualizada!' };
}

export async function criarEmpresaPeloAdmin(
  sessao: SessaoAtiva,
  payload: {
    nomeEmpresa: string;
    donoNome: string;
    cnpj?: string;
    telefone?: string;
    cidade?: string;
    plano: PlanoSaas;
    statusAssinatura: StatusAssinatura;
    validoAte?: string;
    usernameDono: string;
    emailDono?: string;
    senhaDono: string;
  }
): Promise<{ ok: boolean; msg: string; empresa?: Empresa }> {
  if (String(sessao.usuario.perfil || '').toUpperCase() !== 'ADMIN') {
    return { ok: false, msg: 'Apenas o ADMIN pode criar novas empresas pelo Master.' };
  }
  const nomeEmp = payload.nomeEmpresa.trim();
  const uname = payload.usernameDono.trim().toLowerCase();
  const senhaLimpa = payload.senhaDono.trim();
  if (!nomeEmp || !uname || senhaLimpa.length < 4) {
    return { ok: false, msg: 'Informe nome da empresa, login do Dono e senha (mínimo 4 caracteres).' };
  }
  if (uname === 'admin' || uname === 'administrador') {
    return { ok: false, msg: 'Login reservado ao sistema. Escolha outro para o Dono.' };
  }

  const client = getTenantSupabaseClient(sessao);
  const empId = gerarId('EMP');
  const grpId = gerarId('GRP');
  const usrId = gerarId('USR');
  const senhaHash = await sha256Hex(senhaLimpa);

  const novaEmpresa: Empresa = {
    id: empId,
    grupo_id: grpId,
    tipo: 'MATRIZ',
    nome: nomeEmp,
    dono_nome: payload.donoNome.trim() || uname,
    cnpj: payload.cnpj?.trim() || '',
    telefone: payload.telefone?.trim() || '',
    cidade: payload.cidade?.trim() || '',
    chave_pix: '',
    drive_folder_id: '',
    planilha_espelho_id: '',
    plano: payload.plano,
    status_assinatura: payload.statusAssinatura,
    valido_ate: payload.validoAte?.trim() || undefined,
    setup_concluido: true
  };

  if (client) {
    const { data: rpcData, error: rpcErr } = await client.rpc('rpc_criar_empresa_pelo_admin', {
      p_empresa_id: empId,
      p_grupo_id: grpId,
      p_usuario_id: usrId,
      p_nome_empresa: nomeEmp,
      p_dono_nome: novaEmpresa.dono_nome,
      p_cnpj: novaEmpresa.cnpj,
      p_telefone: novaEmpresa.telefone,
      p_cidade: novaEmpresa.cidade,
      p_plano: novaEmpresa.plano,
      p_status_assinatura: novaEmpresa.status_assinatura,
      p_valido_ate: novaEmpresa.valido_ate || null,
      p_username_dono: uname,
      p_email_dono: payload.emailDono?.trim().toLowerCase() || '',
      p_senha_hash: senhaHash
    });
    if (rpcErr) return { ok: false, msg: rpcErr.message };
    const resRpc = rpcData as { ok?: boolean; msg?: string } | null;
    if (!resRpc?.ok) return { ok: false, msg: resRpc?.msg || 'Não foi possível criar a empresa.' };

    return { ok: true, msg: `Empresa "${nomeEmp}" e usuário Dono "${uname}" criados no Supabase!`, empresa: novaEmpresa };
  }

  const db = loadLocalDb();
  if (db.usuarios.some((u) => u.username.toLowerCase() === uname)) {
    return { ok: false, msg: `O login "${uname}" já está em uso.` };
  }
  db.empresas.push(novaEmpresa);
  db.usuarios.push({
    id: usrId,
    empresa_id: empId,
    grupo_id: grpId,
    username: uname,
    nome: novaEmpresa.dono_nome,
    email: payload.emailDono?.trim().toLowerCase() || '',
    senha_hash: senhaHash,
    perfil: 'DONO',
    ativo: true,
    ultimo_acesso: new Date().toISOString()
  });
  saveLocalDb(db);
  return { ok: true, msg: `Empresa "${nomeEmp}" criada com sucesso!`, empresa: novaEmpresa };
}

export async function excluirEmpresaAdmin(
  sessao: SessaoAtiva,
  empresaId: string
): Promise<{ ok: boolean; msg: string }> {
  if (String(sessao.usuario.perfil || '').toUpperCase() !== 'ADMIN') {
    return { ok: false, msg: 'Apenas o ADMIN pode excluir empresas.' };
  }
  if (empresaId === 'EMP-MATRIZ-DEFAULT') {
    return { ok: false, msg: 'A empresa matriz padrão do sistema não pode ser excluída.' };
  }
  const client = getTenantSupabaseClient(sessao);
  if (client) {
    const { data, error } = await client.rpc('rpc_excluir_empresa_admin', {
      p_empresa_id: empresaId
    });
    if (error) return { ok: false, msg: error.message };
    const res = data as { ok?: boolean; msg?: string } | null;
    return { ok: Boolean(res?.ok), msg: res?.msg || 'Empresa excluída.' };
  }
  const db = loadLocalDb();
  db.empresas = db.empresas.filter((e) => e.id !== empresaId);
  db.usuarios = db.usuarios.filter((u) => u.empresa_id !== empresaId);
  saveLocalDb(db);
  return { ok: true, msg: 'Empresa excluída com sucesso!' };
}

export async function listarComprovantesEmpresa(
  sessao: SessaoAtiva
): Promise<ComprovantePagamentoSaas[]> {
  const client = getTenantSupabaseClient(sessao);
  const todos = await lerChaveConfigSaas<ComprovantePagamentoSaas[]>(
    client,
    'SAAS_MASTER_COMPROVANTES',
    MASTER_SAAS_COMPROVANTES_KEY,
    []
  );
  return (Array.isArray(todos) ? todos : []).filter(
    (c) => c.empresa_id === sessao.unidadeAtivaId
  );
}

export async function enviarComprovantePagamentoEmpresa(
  sessao: SessaoAtiva,
  dados: {
    forma: string;
    valor: number;
    referencia: string;
    observacao?: string;
    anexo_nome?: string;
    anexo_data_url?: string;
  }
): Promise<{ ok: boolean; msg: string; comprovante?: ComprovantePagamentoSaas }> {
  const valorNum = Number(dados.valor) || 0;
  if (valorNum <= 0) return { ok: false, msg: 'Informe o valor pago.' };
  if (!dados.forma.trim()) return { ok: false, msg: 'Selecione a forma de pagamento.' };

  const client = getTenantSupabaseClient(sessao);
  const atuais = await lerChaveConfigSaas<ComprovantePagamentoSaas[]>(
    client,
    'SAAS_MASTER_COMPROVANTES',
    MASTER_SAAS_COMPROVANTES_KEY,
    []
  );

  const novo: ComprovantePagamentoSaas = {
    id: gerarId('CMP'),
    empresa_id: sessao.unidadeAtivaId,
    empresa_nome: sessao.empresa.nome,
    plano: sessao.empresa.plano || 'PRO',
    valor: valorNum,
    forma: dados.forma.trim(),
    referencia: dados.referencia.trim() || new Date().toISOString().slice(0, 7),
    observacao: dados.observacao?.trim() || undefined,
    anexo_nome: dados.anexo_nome || undefined,
    anexo_data_url: dados.anexo_data_url || undefined,
    status: 'PENDENTE',
    criado_em: new Date().toISOString()
  };

  const listaFinal = [novo, ...(Array.isArray(atuais) ? atuais : [])].slice(0, 150);
  await gravarChaveConfigSaas(
    client,
    'SAAS_MASTER_COMPROVANTES',
    MASTER_SAAS_COMPROVANTES_KEY,
    listaFinal
  );

  const cfg = await obterConfigMasterSaasPublica(sessao);
  void notificarAdminSaasTelegram(
    cfg,
    `🧾 <b>Novo Comprovante de Pagamento!</b>\nEmpresa: <b>${sessao.empresa.nome}</b> (${novo.plano})\nForma: <b>${novo.forma}</b>\nValor: <b>${formatarMoeda(novo.valor)}</b>\nRef.: ${novo.referencia}${novo.anexo_nome ? `\nAnexo: ${novo.anexo_nome}` : ''}\n\nAcesse o Painel Master para aprovar e liberar.`
  );

  return {
    ok: true,
    msg: 'Comprovante enviado! O administrador master foi notificado para validar e liberar seu acesso.',
    comprovante: novo
  };
}

export async function analisarComprovanteSaasAdmin(
  sessao: SessaoAtiva,
  comprovanteId: string,
  aprovar: boolean,
  opts?: { renovarDias?: number; motivoRecusa?: string }
): Promise<{ ok: boolean; msg: string }> {
  if (String(sessao.usuario.perfil || '').toUpperCase() !== 'ADMIN') {
    return { ok: false, msg: 'Apenas o ADMIN pode analisar comprovantes.' };
  }
  const client = getTenantSupabaseClient(sessao);
  const atuais = await lerChaveConfigSaas<ComprovantePagamentoSaas[]>(
    client,
    'SAAS_MASTER_COMPROVANTES',
    MASTER_SAAS_COMPROVANTES_KEY,
    []
  );
  const lista = Array.isArray(atuais) ? [...atuais] : [];
  const alvo = lista.find((c) => c.id === comprovanteId);
  if (!alvo) return { ok: false, msg: 'Comprovante não encontrado.' };
  if (alvo.status !== 'PENDENTE') {
    return { ok: false, msg: `Este comprovante já foi analisado (${alvo.status}).` };
  }

  alvo.status = aprovar ? 'APROVADO' : 'RECUSADO';
  alvo.analisado_em = new Date().toISOString();
  if (!aprovar && opts?.motivoRecusa?.trim()) {
    alvo.motivo_recusa = opts.motivoRecusa.trim();
  }

  await gravarChaveConfigSaas(
    client,
    'SAAS_MASTER_COMPROVANTES',
    MASTER_SAAS_COMPROVANTES_KEY,
    lista
  );

  if (aprovar) {
    const dias = opts?.renovarDias ?? 30;
    await registrarFaturaSaasAdmin(
      sessao,
      {
        empresa_id: alvo.empresa_id,
        empresa_nome: alvo.empresa_nome,
        plano: alvo.plano,
        valor: alvo.valor,
        data_pagamento: new Date().toISOString().slice(0, 10),
        forma: alvo.forma,
        referencia: alvo.referencia,
        observacao: `Aprovado via comprovante ${alvo.id}`
      },
      dias
    );
    if (dias <= 0) {
      await atualizarLicencaEmpresaAdmin(sessao, alvo.empresa_id, {
        status_assinatura: 'ATIVO',
        valido_ate: undefined
      });
    }
    return {
      ok: true,
      msg: `Comprovante de ${alvo.empresa_nome} aprovado! Fatura registrada e empresa liberada.`
    };
  }

  return {
    ok: true,
    msg: `Comprovante de ${alvo.empresa_nome} marcado como recusado.`
  };
}

export async function registrarFaturaSaasAdmin(
  sessao: SessaoAtiva,
  fatura: Omit<FaturaSaas, 'id'>,
  renovarDias = 30
): Promise<{ ok: boolean; msg: string }> {
  if (String(sessao.usuario.perfil || '').toUpperCase() !== 'ADMIN') {
    return { ok: false, msg: 'Apenas o ADMIN pode registrar mensalidades SaaS.' };
  }
  const client = getTenantSupabaseClient(sessao);
  const faturas = await lerChaveConfigSaas<FaturaSaas[]>(
    client,
    'SAAS_MASTER_FATURAS',
    MASTER_SAAS_FATURAS_KEY,
    []
  );
  const atuais = Array.isArray(faturas) ? faturas : [];
  const duplicada = atuais.find(
    (f) => f.empresa_id === fatura.empresa_id && String(f.referencia || '') === String(fatura.referencia || '')
  );
  if (duplicada) {
    return {
      ok: false,
      msg: `Já existe uma mensalidade registrada para ${fatura.empresa_nome} na competência ${fatura.referencia}. Selecione o próximo mês.`
    };
  }

  const nova: FaturaSaas = { id: gerarId('FAT'), ...fatura };
  const lista = [nova, ...atuais];
  await gravarChaveConfigSaas(client, 'SAAS_MASTER_FATURAS', MASTER_SAAS_FATURAS_KEY, lista);

  if (renovarDias > 0) {
    let validoAtual: string | undefined;
    if (client) {
      const { data: empRow } = await client
        .from('empresas')
        .select('valido_ate')
        .eq('id', fatura.empresa_id)
        .maybeSingle();
      validoAtual = (empRow as { valido_ate?: string } | null)?.valido_ate;
    } else {
      validoAtual = loadLocalDb().empresas.find((e) => e.id === fatura.empresa_id)?.valido_ate;
    }
    const hoje = new Date();
    const base = validoAtual ? new Date(validoAtual) : hoje;
    const ref = !Number.isNaN(base.getTime()) && base > hoje ? base : hoje;
    const novaData = new Date(ref.getTime() + renovarDias * 86400000).toISOString().slice(0, 10);
    await atualizarLicencaEmpresaAdmin(sessao, fatura.empresa_id, {
      plano: fatura.plano,
      status_assinatura: 'ATIVO',
      valido_ate: novaData
    });
  }

  return { ok: true, msg: `Pagamento ${formatarMoeda(fatura.valor)} registrado para ${fatura.empresa_nome}!` };
}

export async function salvarConfigMasterSaasAdmin(
  sessao: SessaoAtiva,
  cfg: ConfigMasterSaas
): Promise<{ ok: boolean; msg: string }> {
  if (String(sessao.usuario.perfil || '').toUpperCase() !== 'ADMIN') {
    return { ok: false, msg: 'Apenas o ADMIN pode alterar configurações do Master SaaS.' };
  }
  const client = getTenantSupabaseClient(sessao);
  await gravarChaveConfigSaas(client, 'SAAS_MASTER_CONFIG', MASTER_SAAS_CFG_KEY, cfg);
  return { ok: true, msg: 'Configurações do Master SaaS salvas com sucesso!' };
}

export async function salvarMeuPerfilAdmin(
  sessao: SessaoAtiva,
  dados: { username: string; nome: string; email: string; novaSenha?: string }
): Promise<{ ok: boolean; msg: string; sessaoAtualizada?: SessaoAtiva }> {
  if (String(sessao.usuario.perfil || '').toUpperCase() !== 'ADMIN') {
    return { ok: false, msg: 'Ação exclusiva do perfil ADMIN.' };
  }
  const usernameLimpo = dados.username.trim().toLowerCase();
  const nomeLimpo = dados.nome.trim();
  if (!usernameLimpo || !nomeLimpo) {
    return { ok: false, msg: 'Informe usuário e nome completos.' };
  }
  if (dados.novaSenha && dados.novaSenha.trim().length < 4) {
    return { ok: false, msg: 'A nova senha deve ter pelo menos 4 caracteres.' };
  }

  const patch: Record<string, unknown> = {
    username: usernameLimpo,
    nome: nomeLimpo,
    email: dados.email.trim()
  };
  let novoHash: string | undefined;
  if (dados.novaSenha && dados.novaSenha.trim()) {
    novoHash = await sha256Hex(dados.novaSenha.trim());
    patch.senha_hash = novoHash;
  }

  const client = getTenantSupabaseClient(sessao);
  if (client) {
    const { data: dup } = await client
      .from('usuarios')
      .select('id')
      .eq('username', usernameLimpo)
      .neq('id', sessao.usuario.id)
      .limit(1);
    if (dup && dup.length > 0) {
      return { ok: false, msg: `O login "${usernameLimpo}" já está em uso por outro usuário.` };
    }
    const { error } = await client
      .from('usuarios')
      .update(patch)
      .eq('id', sessao.usuario.id);
    if (error) return { ok: false, msg: error.message };
  } else {
    const db = loadLocalDb();
    const dup = db.usuarios.some(
      (u) => u.id !== sessao.usuario.id && u.username.toLowerCase() === usernameLimpo
    );
    if (dup) return { ok: false, msg: `O login "${usernameLimpo}" já está em uso.` };
    const alvo = db.usuarios.find((u) => u.id === sessao.usuario.id);
    if (!alvo) return { ok: false, msg: 'Usuário ADMIN não encontrado.' };
    alvo.username = usernameLimpo;
    alvo.nome = nomeLimpo;
    alvo.email = dados.email.trim();
    if (novoHash) alvo.senha_hash = novoHash;
    saveLocalDb(db);
  }

  const sessaoAtualizada: SessaoAtiva = {
    ...sessao,
    usuario: {
      ...sessao.usuario,
      username: usernameLimpo,
      nome: nomeLimpo,
      email: dados.email.trim()
    }
  };
  salvarSessaoLocal(sessaoAtualizada, ehLembrarSessaoAtiva());
  return { ok: true, msg: 'Usuário e senha do ADMIN atualizados com sucesso!', sessaoAtualizada };
}

export async function derrubarSessoesUsuarioAdmin(
  sessao: SessaoAtiva,
  usuarioId: string
): Promise<{ ok: boolean; msg: string }> {
  if (String(sessao.usuario.perfil || '').toUpperCase() !== 'ADMIN') {
    return { ok: false, msg: 'Apenas o ADMIN pode encerrar sessões remotamente.' };
  }
  const client = getTenantSupabaseClient(sessao);
  if (client) {
    const { error } = await client.from('sessoes').delete().eq('usuario_id', usuarioId);
    if (error) return { ok: false, msg: error.message };
    return { ok: true, msg: 'Sessões ativas do usuário encerradas no banco!' };
  }
  return { ok: true, msg: 'Modo local não mantém sessões remotas.' };
}

export async function solicitarCodigoSuporteAdmin(
  sessao: SessaoAtiva,
  empresa: Empresa
): Promise<{ ok: boolean; msg: string; codigo?: string; expiraEm?: number }> {
  if (String(sessao.usuario.perfil || '').trim().toUpperCase() !== 'ADMIN') {
    return { ok: false, msg: 'Apenas o Administrador Técnico pode solicitar acesso de suporte.' };
  }
  if (!empresa.telegram_bot_token || !empresa.telegram_chat_id) {
    return {
      ok: false,
      msg: `A empresa "${empresa.nome}" não possui Telegram configurado para enviar o código ao Dono.`
    };
  }

  const codigo = String(Math.floor(10 + Math.random() * 90));
  const expiraEm = Date.now() + 5 * 60 * 1000;

  try {
    await enviarMensagemTelegram(
      empresa,
      `🛡️ <b>Solicitação de Suporte Técnico — ${empresa.nome}</b>\n` +
        `Administrador: <b>${sessao.usuario.nome}</b>\n` +
        `🔑 <b>Código de autorização: <code>${codigo}</code></b>\n` +
        `<i>Informe este código ao suporte técnico apenas se você autorizou o acesso.</i>`
    );
  } catch {
    return { ok: false, msg: 'Falha ao enviar o código de autorização para o Telegram do Dono.' };
  }

  return {
    ok: true,
    codigo,
    expiraEm,
    msg: `Código de autorização enviado ao Dono de "${empresa.nome}" via Telegram!`
  };
}

export async function registrarAcessoSuporteAdmin(
  sessao: SessaoAtiva,
  empresa: Empresa
): Promise<void> {
  const detalhe = `Administrador Técnico (${sessao.usuario.username}) acessou a empresa "${empresa.nome}" (${empresa.id}) mediante autorização do Dono.`;
  const client = getTenantSupabaseClient(sessao);
  if (client) {
    try {
      await client.from('auditoria_logs').insert({
        id: gerarId('LOG'),
        empresa_id: empresa.id,
        usuario: sessao.usuario.username,
        acao: 'ACESSO_SUPORTE_AUTORIZADO',
        detalhes: detalhe,
        canal: 'WEB'
      });
    } catch {
      // non-blocking
    }
  } else {
    const db = loadLocalDb();
    appendLocalLog(db, empresa.id, sessao.usuario.username, 'ACESSO_SUPORTE_AUTORIZADO', detalhe);
    saveLocalDb(db);
  }
}
