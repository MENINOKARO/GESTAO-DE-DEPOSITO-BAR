-- ====================================================================
-- GESTÃO DE NEGÓCIOS 360° — SCHEMA MULTI-TENANT SAAS (SUPABASE / POSTGRESQL)
-- Execute este script completo no SQL Editor do seu projeto Supabase.
-- Seguro para reexecução (idempotente).
-- ====================================================================

-- 1. EXTENSÕES NECESSÁRIAS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- ====================================================================
-- 2. NÚCLEO MULTI-TENANT, LICENCIAMENTO E GOVERNANÇA
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.grupos_empresariais (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.empresas (
    id TEXT PRIMARY KEY,
    grupo_id TEXT NOT NULL REFERENCES public.grupos_empresariais(id) ON DELETE CASCADE,
    matriz_id TEXT,
    tipo TEXT NOT NULL DEFAULT 'MATRIZ' CHECK (tipo IN ('MATRIZ', 'FILIAL')),
    nome TEXT NOT NULL,
    dono_nome TEXT DEFAULT '',
    cnpj TEXT DEFAULT '',
    telefone TEXT DEFAULT '',
    cidade TEXT DEFAULT '',
    chave_pix TEXT DEFAULT '',
    drive_folder_id TEXT DEFAULT '',
    planilha_espelho_id TEXT DEFAULT '',
    telegram_bot_token TEXT DEFAULT '',
    telegram_chat_id TEXT DEFAULT '',
    plano TEXT NOT NULL DEFAULT 'PRO' CHECK (plano IN ('START', 'PRO', 'ENTERPRISE')),
    status_assinatura TEXT NOT NULL DEFAULT 'TRIAL' CHECK (status_assinatura IN ('TRIAL', 'ATIVO', 'INADIMPLENTE', 'BLOQUEADO')),
    valido_ate TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
    setup_concluido BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS telegram_bot_token TEXT DEFAULT '';
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_empresas_grupo ON public.empresas (grupo_id);

CREATE TABLE IF NOT EXISTS public.usuarios (
    id TEXT PRIMARY KEY,
    empresa_id TEXT NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    grupo_id TEXT NOT NULL REFERENCES public.grupos_empresariais(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    nome TEXT NOT NULL,
    email TEXT DEFAULT '',
    senha_hash TEXT NOT NULL,
    perfil TEXT NOT NULL DEFAULT 'VENDEDOR' CHECK (perfil IN ('ADMIN', 'DONO', 'GERENTE', 'VENDEDOR')),
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    telegram_chat_id TEXT DEFAULT '',
    codigo_pareamento_telegram TEXT DEFAULT '',
    ultimo_acesso TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (empresa_id, username)
);

-- Migração segura caso public.usuarios já exista da versão v1
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS empresa_id TEXT DEFAULT 'EMP-MATRIZ-DEFAULT';
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS grupo_id TEXT DEFAULT 'GRP-DEFAULT';
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS codigo_pareamento_telegram TEXT DEFAULT '';
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS ultimo_acesso TIMESTAMPTZ;
UPDATE public.usuarios SET empresa_id = 'EMP-MATRIZ-DEFAULT' WHERE empresa_id IS NULL OR empresa_id = '';
UPDATE public.usuarios SET grupo_id = 'GRP-DEFAULT' WHERE grupo_id IS NULL OR grupo_id = '';
UPDATE public.usuarios SET perfil = 'GERENTE' WHERE UPPER(perfil) = 'GERENCIAL';
ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS usuarios_username_key;

-- Regra estrita: existe no máximo 1 usuário ADMIN técnico em todo o ecossistema
CREATE UNIQUE INDEX IF NOT EXISTS idx_unico_admin ON public.usuarios (perfil) WHERE perfil = 'ADMIN';
CREATE INDEX IF NOT EXISTS idx_usuarios_empresa ON public.usuarios (empresa_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_grupo ON public.usuarios (grupo_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_username_lower ON public.usuarios (LOWER(username));
CREATE INDEX IF NOT EXISTS idx_usuarios_telegram ON public.usuarios (telegram_chat_id) WHERE telegram_chat_id <> '';

CREATE TABLE IF NOT EXISTS public.sessoes (
    token TEXT PRIMARY KEY,
    usuario_id TEXT NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    empresa_id TEXT NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    grupo_id TEXT NOT NULL REFERENCES public.grupos_empresariais(id) ON DELETE CASCADE,
    perfil TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days')
);

CREATE INDEX IF NOT EXISTS idx_sessoes_expires ON public.sessoes (expires_at);

-- ====================================================================
-- 3. TABELAS OPERACIONAIS MULTI-TENANT (ISOLADAS POR EMPRESA_ID)
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.produtos (
    id TEXT PRIMARY KEY,
    empresa_id TEXT NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    categoria TEXT DEFAULT 'Geral',
    marca TEXT DEFAULT '',
    volume TEXT DEFAULT '',
    preco_venda NUMERIC(12, 2) NOT NULL DEFAULT 0,
    estoque_minimo NUMERIC(12, 2) NOT NULL DEFAULT 5,
    custo_medio NUMERIC(12, 2) NOT NULL DEFAULT 0,
    margem_pct NUMERIC(8, 2) NOT NULL DEFAULT 0,
    preco_sugerido NUMERIC(12, 2) NOT NULL DEFAULT 0,
    estoque_atual NUMERIC(12, 2) NOT NULL DEFAULT 0,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS empresa_id TEXT DEFAULT 'EMP-MATRIZ-DEFAULT';
ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT TRUE;
UPDATE public.produtos SET empresa_id = 'EMP-MATRIZ-DEFAULT' WHERE empresa_id IS NULL OR empresa_id = '';

CREATE INDEX IF NOT EXISTS idx_produtos_emp_nome ON public.produtos (empresa_id, LOWER(nome));
CREATE INDEX IF NOT EXISTS idx_produtos_emp_cat ON public.produtos (empresa_id, categoria);

CREATE TABLE IF NOT EXISTS public.clientes (
    id TEXT PRIMARY KEY,
    empresa_id TEXT NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    telefone TEXT DEFAULT '',
    endereco TEXT DEFAULT '',
    limite_fiado NUMERIC(12, 2) NOT NULL DEFAULT 0,
    saldo_devedor NUMERIC(12, 2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'ATIVO',
    observacao TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS empresa_id TEXT DEFAULT 'EMP-MATRIZ-DEFAULT';
UPDATE public.clientes SET empresa_id = 'EMP-MATRIZ-DEFAULT' WHERE empresa_id IS NULL OR empresa_id = '';
ALTER TABLE public.clientes DROP CONSTRAINT IF EXISTS clientes_nome_key;

CREATE INDEX IF NOT EXISTS idx_clientes_emp_nome ON public.clientes (empresa_id, LOWER(nome));

CREATE TABLE IF NOT EXISTS public.caixa (
    id TEXT PRIMARY KEY,
    empresa_id TEXT NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    data_hora TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    tipo TEXT NOT NULL CHECK (tipo IN ('ENTRADA', 'SAIDA')),
    valor NUMERIC(12, 2) NOT NULL,
    forma_pagamento TEXT NOT NULL DEFAULT 'Dinheiro',
    descricao TEXT DEFAULT '',
    operador TEXT DEFAULT '',
    origem TEXT DEFAULT 'Balcão',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.caixa ADD COLUMN IF NOT EXISTS empresa_id TEXT DEFAULT 'EMP-MATRIZ-DEFAULT';
UPDATE public.caixa SET empresa_id = 'EMP-MATRIZ-DEFAULT' WHERE empresa_id IS NULL OR empresa_id = '';

CREATE INDEX IF NOT EXISTS idx_caixa_emp_data ON public.caixa (empresa_id, data_hora DESC);

CREATE TABLE IF NOT EXISTS public.vendas (
    id TEXT PRIMARY KEY,
    empresa_id TEXT NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    data_hora TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    produto_id TEXT,
    produto_nome TEXT NOT NULL,
    quantidade NUMERIC(12, 2) NOT NULL,
    valor_unitario NUMERIC(12, 2) NOT NULL DEFAULT 0,
    valor_total NUMERIC(12, 2) NOT NULL,
    forma_pagamento TEXT NOT NULL DEFAULT 'Dinheiro',
    origem TEXT NOT NULL DEFAULT 'Balcão',
    pedido_id TEXT DEFAULT '',
    cliente_nome TEXT DEFAULT '',
    vendedor TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS empresa_id TEXT DEFAULT 'EMP-MATRIZ-DEFAULT';
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS produto_id TEXT;
ALTER TABLE public.vendas ADD COLUMN IF NOT EXISTS cliente_nome TEXT DEFAULT '';
UPDATE public.vendas SET empresa_id = 'EMP-MATRIZ-DEFAULT' WHERE empresa_id IS NULL OR empresa_id = '';

CREATE INDEX IF NOT EXISTS idx_vendas_emp_data ON public.vendas (empresa_id, data_hora DESC);

CREATE TABLE IF NOT EXISTS public.comandas (
    id TEXT PRIMARY KEY,
    empresa_id TEXT NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    pedido TEXT NOT NULL,
    cliente TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ABERTA' CHECK (status IN ('ABERTA', 'PAGA', 'CANCELADA')),
    data_abertura TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    data_fechamento TIMESTAMPTZ,
    total NUMERIC(12, 2) NOT NULL DEFAULT 0,
    pago NUMERIC(12, 2) NOT NULL DEFAULT 0,
    saldo NUMERIC(12, 2) NOT NULL DEFAULT 0,
    operador TEXT DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (empresa_id, pedido)
);

ALTER TABLE public.comandas ADD COLUMN IF NOT EXISTS empresa_id TEXT DEFAULT 'EMP-MATRIZ-DEFAULT';
UPDATE public.comandas SET empresa_id = 'EMP-MATRIZ-DEFAULT' WHERE empresa_id IS NULL OR empresa_id = '';
ALTER TABLE public.comandas DROP CONSTRAINT IF EXISTS comandas_pedido_key;

CREATE INDEX IF NOT EXISTS idx_comandas_emp_status ON public.comandas (empresa_id, status);

CREATE TABLE IF NOT EXISTS public.comanda_itens (
    id TEXT PRIMARY KEY,
    empresa_id TEXT NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    comanda_id TEXT NOT NULL REFERENCES public.comandas(id) ON DELETE CASCADE,
    pedido TEXT NOT NULL,
    produto_id TEXT,
    produto_nome TEXT NOT NULL,
    quantidade NUMERIC(12, 2) NOT NULL,
    preco_unitario NUMERIC(12, 2) NOT NULL,
    subtotal NUMERIC(12, 2) NOT NULL,
    hora TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.comanda_itens ADD COLUMN IF NOT EXISTS empresa_id TEXT DEFAULT 'EMP-MATRIZ-DEFAULT';
ALTER TABLE public.comanda_itens ADD COLUMN IF NOT EXISTS comanda_id TEXT DEFAULT '';
ALTER TABLE public.comanda_itens ADD COLUMN IF NOT EXISTS produto_id TEXT;
UPDATE public.comanda_itens SET empresa_id = 'EMP-MATRIZ-DEFAULT' WHERE empresa_id IS NULL OR empresa_id = '';

CREATE INDEX IF NOT EXISTS idx_comanda_itens_emp ON public.comanda_itens (empresa_id, comanda_id);

CREATE TABLE IF NOT EXISTS public.delivery (
    id TEXT PRIMARY KEY,
    empresa_id TEXT NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    pedido TEXT NOT NULL,
    cliente TEXT NOT NULL,
    telefone TEXT DEFAULT '',
    endereco TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'PREPARANDO', 'EM_ROTA', 'ENTREGUE', 'CANCELADO')),
    valor_produtos NUMERIC(12, 2) NOT NULL DEFAULT 0,
    taxa_entrega NUMERIC(12, 2) NOT NULL DEFAULT 0,
    total NUMERIC(12, 2) NOT NULL DEFAULT 0,
    forma_pagamento TEXT DEFAULT 'PIX',
    entregador TEXT DEFAULT '',
    observacoes TEXT DEFAULT '',
    data_hora TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (empresa_id, pedido)
);

ALTER TABLE public.delivery ADD COLUMN IF NOT EXISTS empresa_id TEXT DEFAULT 'EMP-MATRIZ-DEFAULT';
UPDATE public.delivery SET empresa_id = 'EMP-MATRIZ-DEFAULT' WHERE empresa_id IS NULL OR empresa_id = '';
ALTER TABLE public.delivery DROP CONSTRAINT IF EXISTS delivery_pedido_key;

CREATE INDEX IF NOT EXISTS idx_delivery_emp_status ON public.delivery (empresa_id, status);

CREATE TABLE IF NOT EXISTS public.delivery_itens (
    id TEXT PRIMARY KEY,
    empresa_id TEXT NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    delivery_id TEXT NOT NULL REFERENCES public.delivery(id) ON DELETE CASCADE,
    pedido TEXT NOT NULL,
    produto_nome TEXT NOT NULL,
    quantidade NUMERIC(12, 2) NOT NULL,
    preco_unitario NUMERIC(12, 2) NOT NULL,
    subtotal NUMERIC(12, 2) NOT NULL,
    hora TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.delivery_itens ADD COLUMN IF NOT EXISTS empresa_id TEXT DEFAULT 'EMP-MATRIZ-DEFAULT';
ALTER TABLE public.delivery_itens ADD COLUMN IF NOT EXISTS delivery_id TEXT DEFAULT '';
UPDATE public.delivery_itens SET empresa_id = 'EMP-MATRIZ-DEFAULT' WHERE empresa_id IS NULL OR empresa_id = '';

CREATE INDEX IF NOT EXISTS idx_delivery_itens_emp ON public.delivery_itens (empresa_id, delivery_id);

CREATE TABLE IF NOT EXISTS public.contas_a_pagar (
    id TEXT PRIMARY KEY,
    empresa_id TEXT NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    descricao TEXT NOT NULL,
    categoria TEXT DEFAULT 'Operacional',
    fornecedor TEXT DEFAULT '',
    valor NUMERIC(12, 2) NOT NULL,
    vencimento DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'PAGO', 'ATRASADO')),
    data_pagamento TIMESTAMPTZ,
    forma_pagamento TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.contas_a_pagar ADD COLUMN IF NOT EXISTS empresa_id TEXT DEFAULT 'EMP-MATRIZ-DEFAULT';
UPDATE public.contas_a_pagar SET empresa_id = 'EMP-MATRIZ-DEFAULT' WHERE empresa_id IS NULL OR empresa_id = '';

CREATE INDEX IF NOT EXISTS idx_contas_pagar_emp ON public.contas_a_pagar (empresa_id, status, vencimento);

CREATE TABLE IF NOT EXISTS public.contas_a_receber (
    id TEXT PRIMARY KEY,
    empresa_id TEXT NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    data TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cliente TEXT NOT NULL,
    descricao TEXT DEFAULT '',
    valor NUMERIC(12, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'PAGO')),
    data_pagamento TIMESTAMPTZ,
    forma_pagamento TEXT DEFAULT '',
    comanda_origem TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.contas_a_receber ADD COLUMN IF NOT EXISTS empresa_id TEXT DEFAULT 'EMP-MATRIZ-DEFAULT';
UPDATE public.contas_a_receber SET empresa_id = 'EMP-MATRIZ-DEFAULT' WHERE empresa_id IS NULL OR empresa_id = '';

-- Converte colunas id legadas (BIGINT/BIGSERIAL da v1) para TEXT para aceitar IDs prefixados do SaaS v2
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN SELECT UNNEST(ARRAY[
        'clientes', 'caixa', 'vendas', 'comandas',
        'comanda_itens', 'delivery', 'delivery_itens', 'contas_a_receber'
    ])
    LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'id' AND data_type <> 'text'
        ) THEN
            EXECUTE format('ALTER TABLE public.%I ALTER COLUMN id DROP DEFAULT', tbl);
            EXECUTE format('ALTER TABLE public.%I ALTER COLUMN id TYPE TEXT USING id::TEXT', tbl);
        END IF;
    END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_contas_receber_emp ON public.contas_a_receber (empresa_id, status, LOWER(cliente));

CREATE TABLE IF NOT EXISTS public.compras (
    id TEXT PRIMARY KEY,
    empresa_id TEXT NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    data_hora TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fornecedor TEXT NOT NULL,
    produto_nome TEXT NOT NULL,
    quantidade NUMERIC(12, 2) NOT NULL,
    custo_unitario NUMERIC(12, 2) NOT NULL,
    valor_total NUMERIC(12, 2) NOT NULL,
    nota_fiscal TEXT DEFAULT '',
    operador TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compras_emp_data ON public.compras (empresa_id, data_hora DESC);

CREATE TABLE IF NOT EXISTS public.auditoria_logs (
    id TEXT PRIMARY KEY,
    empresa_id TEXT NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    data_hora TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    usuario TEXT DEFAULT '',
    acao TEXT NOT NULL,
    detalhes TEXT DEFAULT '',
    canal TEXT DEFAULT 'WEB'
);

CREATE INDEX IF NOT EXISTS idx_logs_emp_data ON public.auditoria_logs (empresa_id, data_hora DESC);

CREATE TABLE IF NOT EXISTS public.arquivos_sync (
    id TEXT PRIMARY KEY,
    empresa_id TEXT NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    categoria TEXT NOT NULL CHECK (categoria IN ('Financeiro', 'Estoque', 'Compras', 'Auditoria_Logs', 'Backup', 'Notas')),
    subpasta_mes TEXT NOT NULL,
    nome_arquivo TEXT NOT NULL,
    origem_canal TEXT DEFAULT 'WEB',
    salvo_local BOOLEAN NOT NULL DEFAULT FALSE,
    salvo_drive BOOLEAN NOT NULL DEFAULT FALSE,
    drive_file_id TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_arquivos_sync_emp ON public.arquivos_sync (empresa_id, created_at DESC);

-- ====================================================================
-- 4. FUNÇÕES AUXILIARES DE CONTEXTO TENANT E SEGURANÇA (RLS)
-- ====================================================================

CREATE OR REPLACE FUNCTION public.get_request_header(header_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    headers_json JSON;
BEGIN
    headers_json := COALESCE(NULLIF(current_setting('request.headers', true), ''), '{}')::JSON;
    RETURN COALESCE(headers_json ->> LOWER(header_name), headers_json ->> header_name, '');
EXCEPTION WHEN OTHERS THEN
    RETURN '';
END;
$$;

CREATE OR REPLACE FUNCTION public.current_session()
RETURNS TABLE (
    usuario_id TEXT,
    empresa_id TEXT,
    grupo_id TEXT,
    perfil TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
    SELECT s.usuario_id, s.empresa_id, s.grupo_id, s.perfil
    FROM public.sessoes s
    WHERE s.token = public.get_request_header('x-session-token')
      AND s.expires_at > NOW()
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_empresa_id()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_req_emp TEXT;
    v_sess RECORD;
    v_claim_emp TEXT;
BEGIN
    -- 1. JWT Claim opcional (se usar Supabase Auth futuramente)
    v_claim_emp := COALESCE(NULLIF(auth.jwt() ->> 'empresa_id', ''), '');
    IF v_claim_emp <> '' THEN
        RETURN v_claim_emp;
    END IF;

    -- 2. Sessão validada via header x-session-token (permite ao DONO/ADMIN alternar filiais do mesmo grupo)
    SELECT * INTO v_sess FROM public.current_session();
    IF FOUND THEN
        v_req_emp := NULLIF(public.get_request_header('x-empresa-id'), '');
        IF v_req_emp IS NOT NULL AND v_req_emp <> v_sess.empresa_id THEN
            IF v_sess.perfil IN ('ADMIN', 'DONO') AND EXISTS (
                SELECT 1 FROM public.empresas e
                WHERE e.id = v_req_emp AND (e.grupo_id = v_sess.grupo_id OR v_sess.perfil = 'ADMIN')
            ) THEN
                RETURN v_req_emp;
            END IF;
        END IF;
        RETURN v_sess.empresa_id;
    END IF;

    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.current_grupo_id()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
    SELECT s.grupo_id FROM public.current_session() s LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.usuario_pode_acessar_empresa(p_empresa_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.current_session() s
        JOIN public.empresas e ON e.id = p_empresa_id
        WHERE e.id = s.empresa_id
           OR (s.perfil = 'DONO' AND e.grupo_id = s.grupo_id)
           OR (s.perfil = 'ADMIN')
    );
$$;

-- ====================================================================
-- 5. HABILITAÇÃO E POLÍTICAS DE ROW LEVEL SECURITY (RLS)
-- ====================================================================

ALTER TABLE public.grupos_empresariais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caixa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comandas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comanda_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contas_a_pagar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contas_a_receber ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arquivos_sync ENABLE ROW LEVEL SECURITY;

-- Remove TODAS as políticas antigas (ex: "Acesso Total Backend" da v1) para blindar o acesso anônimo
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN (
            'grupos_empresariais', 'empresas', 'usuarios', 'sessoes',
            'produtos', 'clientes', 'caixa', 'vendas',
            'comandas', 'comanda_itens', 'delivery', 'delivery_itens',
            'contas_a_pagar', 'contas_a_receber', 'compras',
            'auditoria_logs', 'arquivos_sync'
          )
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

CREATE POLICY "Tenant grupos" ON public.grupos_empresariais
    FOR ALL
    USING (id = public.current_grupo_id() OR EXISTS (SELECT 1 FROM public.current_session() s WHERE s.perfil = 'ADMIN'))
    WITH CHECK (id = public.current_grupo_id() OR EXISTS (SELECT 1 FROM public.current_session() s WHERE s.perfil = 'ADMIN'));

DROP POLICY IF EXISTS "Tenant empresas" ON public.empresas;
CREATE POLICY "Tenant empresas" ON public.empresas
    FOR ALL
    USING (public.usuario_pode_acessar_empresa(id))
    WITH CHECK (public.usuario_pode_acessar_empresa(id));

DROP POLICY IF EXISTS "Tenant usuarios" ON public.usuarios;
CREATE POLICY "Tenant usuarios" ON public.usuarios
    FOR ALL
    USING (public.usuario_pode_acessar_empresa(empresa_id))
    WITH CHECK (public.usuario_pode_acessar_empresa(empresa_id));

DROP POLICY IF EXISTS "Sessoes proprias" ON public.sessoes;
CREATE POLICY "Sessoes proprias" ON public.sessoes
    FOR ALL
    USING (token = public.get_request_header('x-session-token'))
    WITH CHECK (token = public.get_request_header('x-session-token'));

DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN SELECT UNNEST(ARRAY[
        'produtos', 'clientes', 'caixa', 'vendas',
        'comandas', 'comanda_itens', 'delivery', 'delivery_itens',
        'contas_a_pagar', 'contas_a_receber', 'compras',
        'auditoria_logs', 'arquivos_sync'
    ])
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Tenant isolation" ON public.%I', tbl);
        EXECUTE format(
            'CREATE POLICY "Tenant isolation" ON public.%I FOR ALL USING (empresa_id = public.current_empresa_id() OR public.usuario_pode_acessar_empresa(empresa_id)) WITH CHECK (empresa_id = public.current_empresa_id() OR public.usuario_pode_acessar_empresa(empresa_id))',
            tbl
        );
    END LOOP;
END $$;

-- ====================================================================
-- 6. FUNÇÕES RPC PROTEGIDAS NO SERVIDOR (LÓGICA DE NEGÓCIO NO SUPABASE)
-- ====================================================================

-- 6.1 Verifica status inicial (Nova Empresa sem DONO aguardando Boas-Vindas)
CREATE OR REPLACE FUNCTION public.rpc_verificar_setup_inicial(p_empresa_id TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_emp public.empresas%ROWTYPE;
    v_tem_dono BOOLEAN;
BEGIN
    IF p_empresa_id IS NOT NULL AND p_empresa_id <> '' THEN
        SELECT * INTO v_emp FROM public.empresas WHERE id = p_empresa_id LIMIT 1;
    ELSE
        SELECT * INTO v_emp FROM public.empresas WHERE tipo = 'MATRIZ' ORDER BY created_at ASC LIMIT 1;
    END IF;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', true, 'precisa_setup_dono', false, 'nome_empresa', '');
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.usuarios u
        WHERE u.empresa_id = v_emp.id AND u.perfil = 'DONO' AND u.ativo = TRUE
    ) INTO v_tem_dono;

    RETURN jsonb_build_object(
        'ok', true,
        'precisa_setup_dono', (NOT v_emp.setup_concluido AND NOT v_tem_dono),
        'empresa_id', v_emp.id,
        'nome_empresa', v_emp.nome
    );
END;
$$;

-- 6.2 Autenticação + Criação de Sessão + Lista de Unidades (para DONO/ADMIN)
CREATE OR REPLACE FUNCTION public.rpc_autenticar_usuario(
    p_login TEXT,
    p_senha_hash TEXT,
    p_empresa_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_login TEXT := LOWER(TRIM(COALESCE(p_login, '')));
    v_user public.usuarios%ROWTYPE;
    v_emp public.empresas%ROWTYPE;
    v_token TEXT;
    v_unidades JSONB;
BEGIN
    IF v_login = '' OR COALESCE(p_senha_hash, '') = '' THEN
        RETURN jsonb_build_object('ok', false, 'msg', 'Informe usuário e senha.');
    END IF;

    SELECT u.*
    INTO v_user
    FROM public.usuarios u
    WHERE (LOWER(u.username) = v_login OR LOWER(u.email) = v_login)
      AND (p_empresa_id IS NULL OR p_empresa_id = '' OR u.empresa_id = p_empresa_id OR u.perfil = 'ADMIN')
    ORDER BY (u.perfil = 'ADMIN') DESC, u.created_at ASC
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'msg', 'Usuário ou senha incorretos.');
    END IF;

    IF NOT v_user.ativo THEN
        RETURN jsonb_build_object('ok', false, 'msg', 'Este usuário está inativo ou bloqueado.');
    END IF;

    IF v_user.senha_hash <> p_senha_hash THEN
        RETURN jsonb_build_object('ok', false, 'msg', 'Usuário ou senha incorretos.');
    END IF;

    SELECT * INTO v_emp FROM public.empresas WHERE id = v_user.empresa_id LIMIT 1;

    IF v_emp.status_assinatura IN ('BLOQUEADO', 'INADIMPLENTE') AND v_user.perfil <> 'ADMIN' THEN
        RETURN jsonb_build_object(
            'ok', false,
            'msg', 'Assinatura pendente. Regularize o pagamento para liberar o acesso.',
            'status_assinatura', v_emp.status_assinatura
        );
    END IF;

    v_token := 'GN360_' || replace(gen_random_uuid()::text, '-', '') || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);

    INSERT INTO public.sessoes (token, usuario_id, empresa_id, grupo_id, perfil, expires_at)
    VALUES (v_token, v_user.id, v_user.empresa_id, v_user.grupo_id, v_user.perfil, NOW() + INTERVAL '7 days');

    UPDATE public.usuarios SET ultimo_acesso = NOW() WHERE id = v_user.id;

    -- Unidades acessíveis (somente para DONO do grupo ou ADMIN técnico)
    IF v_user.perfil = 'ADMIN' THEN
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'id', e.id, 'nome', e.nome, 'tipo', e.tipo, 'grupo_id', e.grupo_id,
            'plano', e.plano, 'status_assinatura', e.status_assinatura,
            'drive_folder_id', e.drive_folder_id, 'planilha_espelho_id', e.planilha_espelho_id,
            'eh_matriz', (e.tipo = 'MATRIZ')
        ) ORDER BY (e.tipo = 'MATRIZ') DESC, e.created_at ASC), '[]'::JSONB)
        INTO v_unidades
        FROM public.empresas e;
    ELSIF v_user.perfil = 'DONO' THEN
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'id', e.id, 'nome', e.nome, 'tipo', e.tipo, 'grupo_id', e.grupo_id,
            'plano', e.plano, 'status_assinatura', e.status_assinatura,
            'drive_folder_id', e.drive_folder_id, 'planilha_espelho_id', e.planilha_espelho_id,
            'eh_matriz', (e.tipo = 'MATRIZ')
        ) ORDER BY (e.tipo = 'MATRIZ') DESC, e.created_at ASC), '[]'::JSONB)
        INTO v_unidades
        FROM public.empresas e
        WHERE e.grupo_id = v_user.grupo_id;
    ELSE
        v_unidades := jsonb_build_array(jsonb_build_object(
            'id', v_emp.id, 'nome', v_emp.nome, 'tipo', v_emp.tipo, 'grupo_id', v_emp.grupo_id,
            'plano', v_emp.plano, 'status_assinatura', v_emp.status_assinatura,
            'drive_folder_id', v_emp.drive_folder_id, 'planilha_espelho_id', v_emp.planilha_espelho_id,
            'eh_matriz', (v_emp.tipo = 'MATRIZ')
        ));
    END IF;

    RETURN jsonb_build_object(
        'ok', true,
        'token', v_token,
        'usuario', jsonb_build_object(
            'id', v_user.id,
            'username', v_user.username,
            'nome', v_user.nome,
            'email', v_user.email,
            'perfil', v_user.perfil,
            'empresa_id', v_user.empresa_id,
            'grupo_id', v_user.grupo_id
        ),
        'empresa', to_jsonb(v_emp),
        'unidades', v_unidades
    );
END;
$$;

-- 6.3 Registro Atômico de Venda (Venda + Baixa de Estoque + Caixa/Fiado + Auditoria)
CREATE OR REPLACE FUNCTION public.rpc_registrar_venda_atomica(
    p_empresa_id TEXT,
    p_itens JSONB,
    p_forma_pagamento TEXT,
    p_cliente_nome TEXT DEFAULT '',
    p_origem TEXT DEFAULT 'Balcão',
    p_operador TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_item JSONB;
    v_total NUMERIC(12, 2) := 0;
    v_venda_id TEXT;
    v_caixa_id TEXT;
    v_receber_id TEXT;
    v_pedido_id TEXT := 'VND-' || to_char(NOW(), 'YYYYMMDDHH24MISS') || '-' || substr(md5(random()::text), 1, 4);
    v_qtd NUMERIC(12, 2);
    v_preco NUMERIC(12, 2);
    v_subtotal NUMERIC(12, 2);
    v_prod_id TEXT;
    v_prod_nome TEXT;
BEGIN
    IF NOT public.usuario_pode_acessar_empresa(p_empresa_id) THEN
        RETURN jsonb_build_object('ok', false, 'msg', 'Acesso negado para esta unidade.');
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
    LOOP
        v_prod_id := COALESCE(v_item ->> 'produto_id', '');
        v_prod_nome := COALESCE(v_item ->> 'produto_nome', '');
        v_qtd := COALESCE((v_item ->> 'quantidade')::NUMERIC, 0);
        v_preco := COALESCE((v_item ->> 'preco_unitario')::NUMERIC, 0);
        v_subtotal := ROUND(v_qtd * v_preco, 2);
        v_total := v_total + v_subtotal;
        v_venda_id := 'VN-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);

        INSERT INTO public.vendas (
            id, empresa_id, produto_id, produto_nome, quantidade,
            valor_unitario, valor_total, forma_pagamento, origem,
            pedido_id, cliente_nome, vendedor
        ) VALUES (
            v_venda_id, p_empresa_id, v_prod_id, v_prod_nome, v_qtd,
            v_preco, v_subtotal, p_forma_pagamento, p_origem,
            v_pedido_id, COALESCE(p_cliente_nome, ''), COALESCE(p_operador, '')
        );

        IF v_prod_id <> '' THEN
            UPDATE public.produtos
            SET estoque_atual = GREATEST(0, estoque_atual - v_qtd),
                updated_at = NOW()
            WHERE id = v_prod_id AND empresa_id = p_empresa_id;
        END IF;
    END LOOP;

    IF UPPER(TRIM(COALESCE(p_forma_pagamento, ''))) = 'FIADO' THEN
        v_receber_id := 'REC-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
        INSERT INTO public.contas_a_receber (
            id, empresa_id, cliente, descricao, valor, status, comanda_origem
        ) VALUES (
            v_receber_id, p_empresa_id,
            COALESCE(NULLIF(TRIM(p_cliente_nome), ''), 'Cliente Balcão'),
            'Venda Fiado ' || v_pedido_id, v_total, 'PENDENTE', v_pedido_id
        );
    ELSE
        v_caixa_id := 'CX-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
        INSERT INTO public.caixa (
            id, empresa_id, tipo, valor, forma_pagamento, descricao, operador, origem
        ) VALUES (
            v_caixa_id, p_empresa_id, 'ENTRADA', v_total, p_forma_pagamento,
            'Venda ' || v_pedido_id, COALESCE(p_operador, ''), p_origem
        );
    END IF;

    INSERT INTO public.auditoria_logs (id, empresa_id, usuario, acao, detalhes, canal)
    VALUES (
        'LOG-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
        p_empresa_id, COALESCE(p_operador, ''),
        'VENDA_PDV', 'Pedido ' || v_pedido_id || ' — R$ ' || v_total::TEXT || ' (' || p_forma_pagamento || ')', 'WEB'
    );

    RETURN jsonb_build_object('ok', true, 'pedido_id', v_pedido_id, 'total', v_total);
END;
$$;

-- 6.4 Criação de Filial (DONO/ADMIN) ou Nova Empresa (apenas ADMIN)
CREATE OR REPLACE FUNCTION public.rpc_criar_unidade(
    p_tipo TEXT,
    p_nome TEXT,
    p_matriz_empresa_id TEXT DEFAULT NULL,
    p_copiar_produtos BOOLEAN DEFAULT TRUE,
    p_copiar_clientes BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_sess RECORD;
    v_tipo TEXT := CASE WHEN UPPER(TRIM(COALESCE(p_tipo, ''))) = 'NOVA_EMPRESA' THEN 'NOVA_EMPRESA' ELSE 'FILIAL' END;
    v_novo_emp_id TEXT := 'EMP-' || to_char(NOW(), 'YYYYMMDD') || '-' || upper(substr(md5(random()::text), 1, 5));
    v_novo_grp_id TEXT;
    v_matriz public.empresas%ROWTYPE;
    v_dono RECORD;
BEGIN
    SELECT * INTO v_sess FROM public.current_session();
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'msg', 'Sessão inválida ou expirada.');
    END IF;

    IF v_tipo = 'NOVA_EMPRESA' AND v_sess.perfil <> 'ADMIN' THEN
        RETURN jsonb_build_object('ok', false, 'msg', 'Apenas o Administrador Técnico pode criar uma Nova Empresa.');
    END IF;

    IF v_tipo = 'FILIAL' AND v_sess.perfil NOT IN ('ADMIN', 'DONO') THEN
        RETURN jsonb_build_object('ok', false, 'msg', 'Apenas o Dono ou Administrador podem criar uma Filial.');
    END IF;

    IF v_tipo = 'FILIAL' THEN
        SELECT * INTO v_matriz
        FROM public.empresas
        WHERE id = COALESCE(NULLIF(p_matriz_empresa_id, ''), v_sess.empresa_id)
        LIMIT 1;

        IF NOT FOUND THEN
            RETURN jsonb_build_object('ok', false, 'msg', 'Empresa Matriz não encontrada.');
        END IF;

        v_novo_grp_id := v_matriz.grupo_id;

        INSERT INTO public.empresas (
            id, grupo_id, matriz_id, tipo, nome, dono_nome, cnpj, telefone, cidade, chave_pix,
            plano, status_assinatura, setup_concluido
        ) VALUES (
            v_novo_emp_id, v_novo_grp_id, v_matriz.id, 'FILIAL', TRIM(p_nome), v_matriz.dono_nome,
            v_matriz.cnpj, v_matriz.telefone, v_matriz.cidade, v_matriz.chave_pix,
            v_matriz.plano, v_matriz.status_assinatura, TRUE
        );

        -- Copia DONO(s) da Matriz mantendo exatamente o mesmo login e senha
        FOR v_dono IN
            SELECT * FROM public.usuarios
            WHERE empresa_id = v_matriz.id AND perfil = 'DONO' AND ativo = TRUE
        LOOP
            INSERT INTO public.usuarios (
                id, empresa_id, grupo_id, username, nome, email, senha_hash, perfil, ativo
            ) VALUES (
                'USR-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
                v_novo_emp_id, v_novo_grp_id, v_dono.username, v_dono.nome, v_dono.email, v_dono.senha_hash, 'DONO', TRUE
            );
        END LOOP;

        IF p_copiar_produtos THEN
            INSERT INTO public.produtos (
                id, empresa_id, nome, categoria, marca, volume, preco_venda,
                estoque_minimo, custo_medio, margem_pct, preco_sugerido, estoque_atual, ativo
            )
            SELECT
                'PRD-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
                v_novo_emp_id, nome, categoria, marca, volume, preco_venda,
                estoque_minimo, custo_medio, margem_pct, preco_sugerido, 0, ativo
            FROM public.produtos
            WHERE empresa_id = v_matriz.id;
        END IF;

        IF p_copiar_clientes THEN
            INSERT INTO public.clientes (
                id, empresa_id, nome, telefone, endereco, limite_fiado, saldo_devedor, status, observacao
            )
            SELECT
                'CLI-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
                v_novo_emp_id, nome, telefone, endereco, limite_fiado, 0, status, observacao
            FROM public.clientes
            WHERE empresa_id = v_matriz.id;
        END IF;
    ELSE
        -- NOVA EMPRESA: grupo isolado e setup_concluido = FALSE (cadastra DONO nas Boas-Vindas)
        v_novo_grp_id := 'GRP-' || to_char(NOW(), 'YYYYMMDD') || '-' || upper(substr(md5(random()::text), 1, 5));
        INSERT INTO public.grupos_empresariais (id, nome) VALUES (v_novo_grp_id, TRIM(p_nome));
        INSERT INTO public.empresas (
            id, grupo_id, tipo, nome, plano, status_assinatura, setup_concluido
        ) VALUES (
            v_novo_emp_id, v_novo_grp_id, 'MATRIZ', TRIM(p_nome), 'PRO', 'TRIAL', FALSE
        );
    END IF;

    RETURN jsonb_build_object(
        'ok', true,
        'empresa_id', v_novo_emp_id,
        'grupo_id', v_novo_grp_id,
        'tipo', v_tipo,
        'nome', TRIM(p_nome)
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_criar_filial(
    p_nome TEXT,
    p_matriz_empresa_id TEXT DEFAULT NULL,
    p_copiar_produtos BOOLEAN DEFAULT TRUE,
    p_copiar_clientes BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
    SELECT public.rpc_criar_unidade('FILIAL', p_nome, p_matriz_empresa_id, p_copiar_produtos, p_copiar_clientes);
$$;

-- 6.5 Concluir Setup de Boas-Vindas para Nova Empresa (cria apenas DONO; nunca ADMIN)
CREATE OR REPLACE FUNCTION public.rpc_concluir_setup_nova_empresa(
    p_empresa_id TEXT,
    p_nome_empresa TEXT,
    p_username_dono TEXT,
    p_email_dono TEXT,
    p_senha_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_emp public.empresas%ROWTYPE;
    v_user_id TEXT := 'USR-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
    v_uname TEXT := LOWER(TRIM(COALESCE(p_username_dono, '')));
BEGIN
    IF v_uname IN ('admin', 'administrador') THEN
        RETURN jsonb_build_object('ok', false, 'msg', 'Nome de usuário reservado ao sistema.');
    END IF;

    SELECT * INTO v_emp FROM public.empresas WHERE id = p_empresa_id LIMIT 1;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'msg', 'Empresa não encontrada.');
    END IF;

    IF v_emp.setup_concluido THEN
        RETURN jsonb_build_object('ok', false, 'msg', 'Cadastro inicial já concluído.');
    END IF;

    UPDATE public.empresas
    SET nome = TRIM(p_nome_empresa),
        dono_nome = TRIM(p_username_dono),
        setup_concluido = TRUE,
        updated_at = NOW()
    WHERE id = v_emp.id;

    INSERT INTO public.usuarios (
        id, empresa_id, grupo_id, username, nome, email, senha_hash, perfil, ativo
    ) VALUES (
        v_user_id, v_emp.id, v_emp.grupo_id, v_uname, TRIM(p_username_dono),
        LOWER(TRIM(COALESCE(p_email_dono, ''))), p_senha_hash, 'DONO', TRUE
    );

    RETURN public.rpc_autenticar_usuario(v_uname, p_senha_hash, v_emp.id);
END;
$$;

-- ====================================================================
-- 7. SEED INICIAL (1 MATRIZ PADRÃO + 1 ADMIN TÉCNICO ÚNICO)
-- ====================================================================

INSERT INTO public.grupos_empresariais (id, nome)
VALUES ('GRP-DEFAULT', 'Gestão de Negócios 360°')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.empresas (id, grupo_id, tipo, nome, dono_nome, plano, status_assinatura, setup_concluido)
VALUES ('EMP-MATRIZ-DEFAULT', 'GRP-DEFAULT', 'MATRIZ', 'Matriz Principal', 'Administrador', 'ENTERPRISE', 'ATIVO', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Migra automaticamente dados da tabela legada public.config (v1) e vincula registros antigos à Matriz
DO $$
DECLARE
    v_nome TEXT;
    v_dono TEXT;
    v_cnpj TEXT;
    v_tel TEXT;
    v_cid TEXT;
    v_pix TEXT;
    v_tg_tok TEXT;
    v_tg_chat TEXT;
    tbl TEXT;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'config') THEN
        SELECT valor INTO v_nome FROM public.config WHERE UPPER(chave) = 'NOME_DEPOSITO' LIMIT 1;
        SELECT valor INTO v_dono FROM public.config WHERE UPPER(chave) = 'DONO' LIMIT 1;
        SELECT valor INTO v_cnpj FROM public.config WHERE UPPER(chave) = 'CNPJ' LIMIT 1;
        SELECT valor INTO v_tel FROM public.config WHERE UPPER(chave) = 'TELEFONE' LIMIT 1;
        SELECT valor INTO v_cid FROM public.config WHERE UPPER(chave) = 'CIDADE' LIMIT 1;
        SELECT valor INTO v_pix FROM public.config WHERE UPPER(chave) = 'CHAVE_PIX' LIMIT 1;
        SELECT valor INTO v_tg_tok FROM public.config WHERE UPPER(chave) = 'TELEGRAM_BOT_TOKEN' LIMIT 1;
        SELECT valor INTO v_tg_chat FROM public.config WHERE UPPER(chave) = 'TELEGRAM_DONO_CHAT_ID' LIMIT 1;

        UPDATE public.empresas
        SET nome = COALESCE(NULLIF(TRIM(v_nome), ''), nome),
            dono_nome = COALESCE(NULLIF(TRIM(v_dono), ''), dono_nome),
            cnpj = COALESCE(NULLIF(TRIM(v_cnpj), ''), cnpj),
            telefone = COALESCE(NULLIF(TRIM(v_tel), ''), telefone),
            cidade = COALESCE(NULLIF(TRIM(v_cid), ''), cidade),
            chave_pix = COALESCE(NULLIF(TRIM(v_pix), ''), chave_pix),
            telegram_bot_token = COALESCE(NULLIF(TRIM(v_tg_tok), ''), telegram_bot_token),
            telegram_chat_id = COALESCE(NULLIF(TRIM(v_tg_chat), ''), telegram_chat_id),
            updated_at = NOW()
        WHERE id = 'EMP-MATRIZ-DEFAULT';
    END IF;

    -- Vincula à Matriz quaisquer registros antigos (v1) cujo empresa_id ainda não exista em public.empresas
    FOR tbl IN SELECT UNNEST(ARRAY[
        'produtos', 'clientes', 'caixa', 'vendas',
        'comandas', 'comanda_itens', 'delivery', 'delivery_itens',
        'contas_a_pagar', 'contas_a_receber', 'usuarios'
    ])
    LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'empresa_id'
        ) THEN
            EXECUTE format(
                'UPDATE public.%I SET empresa_id = ''EMP-MATRIZ-DEFAULT'' WHERE empresa_id IS NULL OR empresa_id = '''' OR empresa_id NOT IN (SELECT id FROM public.empresas)',
                tbl
            );
        END IF;
    END LOOP;

    -- Garante que public.estoque antigo sincronize quantidades em produtos caso estoque_atual esteja zerado
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'estoque') THEN
        UPDATE public.produtos p
        SET estoque_atual = e.quantidade
        FROM public.estoque e
        WHERE LOWER(TRIM(p.nome)) = LOWER(TRIM(e.produto_nome))
          AND COALESCE(p.estoque_atual, 0) = 0
          AND COALESCE(e.quantidade, 0) > 0;
    END IF;
END $$;

-- Senha padrão inicial do ADMIN: admin123 (SHA-256)
INSERT INTO public.usuarios (id, empresa_id, grupo_id, username, nome, email, senha_hash, perfil, ativo)
VALUES (
    'U-ADMIN-01',
    'EMP-MATRIZ-DEFAULT',
    'GRP-DEFAULT',
    'admin',
    'Administrador Técnico',
    'admin@sistema.local',
    '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
    'ADMIN',
    TRUE
)
ON CONFLICT DO NOTHING;

-- Atualiza imediatamente o cache de funções RPC / tabelas da API do Supabase
NOTIFY pgrst, 'reload schema';
