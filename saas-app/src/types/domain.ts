export type PerfilUsuario = 'ADMIN' | 'DONO' | 'GERENTE' | 'VENDEDOR';
export type TipoUnidade = 'MATRIZ' | 'FILIAL';
export type PlanoSaas = 'START' | 'PRO' | 'ENTERPRISE';
export type StatusAssinatura = 'TRIAL' | 'ATIVO' | 'INADIMPLENTE' | 'BLOQUEADO';
export type FormaPagamento = 'PIX' | 'Dinheiro' | 'Cartão Débito' | 'Cartão Crédito' | 'Fiado' | 'Outro';

export interface Empresa {
  id: string;
  grupo_id: string;
  matriz_id?: string;
  tipo: TipoUnidade;
  nome: string;
  dono_nome: string;
  cnpj: string;
  telefone: string;
  endereco?: string;
  cidade: string;
  chave_pix: string;
  drive_folder_id: string;
  planilha_espelho_id: string;
  telegram_bot_token?: string;
  telegram_chat_id?: string;
  plano: PlanoSaas;
  status_assinatura: StatusAssinatura;
  valido_ate?: string;
  setup_concluido: boolean;
  created_at?: string;
}

export interface UnidadeResumo {
  id: string;
  nome: string;
  tipo: TipoUnidade;
  grupo_id: string;
  ehMatriz: boolean;
}

export interface Usuario {
  id: string;
  empresa_id: string;
  grupo_id: string;
  username: string;
  nome: string;
  email: string;
  senha_hash?: string;
  perfil: PerfilUsuario;
  ativo: boolean;
  telegram_chat_id?: string;
  ultimo_acesso?: string;
}

export interface SessaoAtiva {
  token: string;
  usuario: Usuario;
  empresa: Empresa;
  unidades: UnidadeResumo[];
  unidadeAtivaId: string;
  modoBanco: 'SUPABASE' | 'LOCAL';
}

export interface Produto {
  id: string;
  empresa_id: string;
  nome: string;
  categoria: string;
  marca: string;
  volume: string;
  preco_venda: number;
  estoque_minimo: number;
  custo_medio: number;
  margem_pct: number;
  preco_sugerido: number;
  estoque_atual: number;
  ativo: boolean;
}

export interface ItemCarrinho {
  produto: Produto;
  quantidade: number;
}

export interface Venda {
  id: string;
  empresa_id: string;
  data_hora: string;
  produto_id: string;
  produto_nome: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  forma_pagamento: FormaPagamento | string;
  origem: 'Balcão' | 'Comanda' | 'Delivery' | 'Telegram' | string;
  pedido_id: string;
  cliente_nome: string;
  vendedor: string;
}

export interface ComandaItem {
  id: string;
  produto_id: string;
  produto_nome: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
  hora: string;
}

export interface Comanda {
  id: string;
  empresa_id: string;
  pedido: string;
  cliente: string;
  status: 'ABERTA' | 'PAGA' | 'CANCELADA';
  data_abertura: string;
  data_fechamento?: string;
  total: number;
  pago: number;
  saldo: number;
  operador: string;
  itens: ComandaItem[];
}

export type StatusDelivery = 'PENDENTE' | 'PREPARANDO' | 'EM_ROTA' | 'ENTREGUE' | 'CANCELADO';

export interface DeliveryItem {
  id: string;
  produto_id?: string;
  produto_nome: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
  hora: string;
}

export interface DeliveryPedido {
  id: string;
  empresa_id: string;
  pedido: string;
  cliente: string;
  telefone: string;
  endereco: string;
  status: StatusDelivery;
  valor_produtos: number;
  taxa_entrega: number;
  total: number;
  forma_pagamento: FormaPagamento | string;
  entregador: string;
  observacoes: string;
  data_hora: string;
  itens: DeliveryItem[];
}

export interface ConferenciaCaixaPrevia {
  entradasHoje: number;
  saidasHoje: number;
  saldoSistema: number;
  entradasDinheiroHoje: number;
  saidasDinheiroHoje: number;
  saldoDinheiroGaveta: number;
  qtdMovimentos: number;
  porFormaPagamento: Array<{ forma: string; valor: number; qtd: number }>;
  movimentosHoje: MovimentoCaixa[];
}

export interface FechamentoFiscalPrevia {
  periodoReferencia: string;
  entradas: number;
  saidas: number;
  saldo: number;
  qtdMovimentos: number;
  responsavel: string;
}

export interface MovimentoCaixa {
  id: string;
  empresa_id: string;
  data_hora: string;
  tipo: 'ENTRADA' | 'SAIDA';
  valor: number;
  forma_pagamento: string;
  descricao: string;
  operador: string;
  origem: string;
}

export interface ContaPagar {
  id: string;
  empresa_id: string;
  descricao: string;
  categoria: string;
  fornecedor: string;
  valor: number;
  vencimento: string;
  status: 'PENDENTE' | 'PAGO' | 'ATRASADO' | 'CANCELADO';
  data_pagamento?: string;
  forma_pagamento?: string;
  tipo_despesa?: 'AVULSA' | 'FIXA';
}

export interface ContaReceber {
  id: string;
  empresa_id: string;
  data: string;
  cliente: string;
  descricao: string;
  valor: number;
  status: 'PENDENTE' | 'PAGO';
  data_pagamento?: string;
  forma_pagamento?: string;
  comanda_origem?: string;
  valor_original?: number;
  valor_recebido?: number;
}

export interface Cliente {
  id: string;
  empresa_id: string;
  nome: string;
  telefone: string;
  endereco: string;
  limite_fiado: number;
  saldo_devedor: number;
  status: string;
  observacao?: string;
}

export interface LogAuditoria {
  id: string;
  empresa_id: string;
  data_hora: string;
  usuario: string;
  acao: string;
  detalhes: string;
  canal: 'WEB' | 'WINDOWS' | 'ANDROID' | 'TELEGRAM' | 'DRIVE';
}

export type CategoriaRelatorio = 'Financeiro' | 'Estoque' | 'Compras' | 'Auditoria_Logs';
export type ModoFiltroRelatorio = 'MES' | 'DATA_A_DATA' | 'PERIODO';

export interface FiltroRelatorio {
  categoria: CategoriaRelatorio;
  modo: ModoFiltroRelatorio;
  mesReferencia: string; // YYYY-MM
  dataInicio: string; // YYYY-MM-DD
  dataFim: string; // YYYY-MM-DD
  periodoRapido: 'HOJE' | '7_DIAS' | '30_DIAS' | 'MES_ATUAL';
}

export interface ResumoKpiCard {
  label: string;
  valor: string;
}

export interface RelatorioGerado {
  titulo: string;
  categoria: CategoriaRelatorio;
  periodoLabel: string;
  subpastaMes: string;
  nomeArquivoPdf: string;
  resumo: ResumoKpiCard[];
  colunas: string[];
  linhas: string[][];
}

export interface ConfigsSistemaExtras {
  permitirEstoqueNegativo: boolean;
  driveUrl: string;
  spreadsheetUrl: string;
  webappUrl: string;
  autoRefresh: boolean;
  intervaloRefreshMin: number;
  backupAuto: boolean;
}

export interface Compra {
  id: string;
  empresa_id: string;
  data_hora: string;
  fornecedor: string;
  produto_nome: string;
  quantidade: number;
  custo_unitario: number;
  valor_total: number;
  nota_fiscal?: string;
  operador?: string;
}

export interface PainelSnapshot {
  empresa: Empresa;
  configsExtras: ConfigsSistemaExtras;
  ultimoFechamentoFiscal?: string;
  kpis: {
    faturamentoDia: number;
    faturamentoMes: number;
    vendasHojeCount: number;
    saldoCaixa: number;
    valorEstoqueVenda: number;
    valorEstoqueCusto: number;
    produtosBaixoEstoque: number;
    obrigacoesPendentesCount: number;
    totalPagarPendente: number;
    totalReceberPendente: number;
  };
  produtos: Produto[];
  vendas: Venda[];
  comandas: Comanda[];
  delivery: DeliveryPedido[];
  caixa: MovimentoCaixa[];
  contasPagar: ContaPagar[];
  contasReceber: ContaReceber[];
  clientes: Cliente[];
  usuarios: Usuario[];
  logs: LogAuditoria[];
  compras?: Compra[];
}

export interface StatusSync {
  bancoConectado: boolean;
  modoBanco: 'SUPABASE' | 'LOCAL';
  pastaLocalConectada: boolean;
  pastaLocalNome: string;
  driveConectado: boolean;
  drivePastaUrl: string;
  planilhaEspelhoUrl: string;
  ultimaSincronizacao?: string;
}

export interface ToastMensagem {
  id: string;
  texto: string;
  tipo: 'success' | 'error' | 'warning' | 'info';
}

export type StatusComprovanteSaas = 'PENDENTE' | 'APROVADO' | 'RECUSADO';

export interface ComprovantePagamentoSaas {
  id: string;
  empresa_id: string;
  empresa_nome: string;
  plano: PlanoSaas;
  valor: number;
  forma: string;
  referencia: string;
  observacao?: string;
  anexo_nome?: string;
  anexo_data_url?: string;
  status: StatusComprovanteSaas;
  motivo_recusa?: string;
  criado_em: string;
  analisado_em?: string;
}

export interface FaturaSaas {
  id: string;
  empresa_id: string;
  empresa_nome: string;
  plano: PlanoSaas;
  valor: number;
  data_pagamento: string;
  forma: string;
  referencia: string;
  observacao?: string;
}

export interface ConfigMasterSaas {
  valor_start: number;
  valor_pro: number;
  valor_enterprise: number;
  chave_pix_admin: string;
  whatsapp_suporte: string;
  telegram_bot_token_admin: string;
  telegram_chat_id_admin: string;
  versao_minima: string;
  link_atualizacao: string;
  link_checkout_pix: string;
  formas_pagamento_ativas?: string[];
  instrucoes_pagamento?: string;
  evolution_api_url?: string;
  evolution_api_key?: string;
  evolution_instancia_padrao?: string;
  resend_dominio?: string;
  resend_remetente?: string;
  github_repo?: string;
  site_empresa_master?: string;
}

export interface MasterSaasSnapshot {
  empresas: Empresa[];
  usuarios: Usuario[];
  sessoesPorUsuario: Record<string, number>;
  comprovantes: ComprovantePagamentoSaas[];
  faturas: FaturaSaas[];
  configMaster: ConfigMasterSaas;
}
