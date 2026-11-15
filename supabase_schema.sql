-- ====================================================================
-- SISTEMA GESTÃO DE DEPÓSITO & BAR - SCHEMA SUPABASE (POSTGRESQL)
-- Execute este script no SQL Editor do Supabase (SQL Editor -> New Query)
-- ====================================================================

-- 1. EXTENSÕES ÚTEIS
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- 2. TABELA DE PRODUTOS
CREATE TABLE IF NOT EXISTS public.produtos (
    id TEXT PRIMARY KEY,                       -- Ex: PRD-0001
    nome TEXT NOT NULL,                        -- Permite produtos com mesmo nome e volumes/marcas diferentes
    categoria TEXT DEFAULT 'Geral',
    marca TEXT,
    volume TEXT,
    preco_venda NUMERIC(10, 2) DEFAULT 0,
    estoque_minimo INTEGER DEFAULT 0,
    custo_medio NUMERIC(10, 2) DEFAULT 0,
    margem_pct NUMERIC(6, 2) DEFAULT 0,
    preco_sugerido NUMERIC(10, 2) DEFAULT 0,
    status_margem TEXT DEFAULT '🟢 OK',
    estoque_atual NUMERIC(10, 2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Remove restrições de nome único caso já tenham sido criadas
ALTER TABLE public.produtos DROP CONSTRAINT IF EXISTS produtos_nome_key;
ALTER TABLE public.estoque DROP CONSTRAINT IF EXISTS estoque_produto_nome_key;

-- Índices para busca ultra-rápida (insensível a maiúsculas/minúsculas)
CREATE INDEX IF NOT EXISTS idx_produtos_nome_lower ON public.produtos (LOWER(nome));
CREATE INDEX IF NOT EXISTS idx_produtos_categoria ON public.produtos (categoria);

-- 3. TABELA DE ESTOQUE (FONTE DA VERDADE FÍSICA)
CREATE TABLE IF NOT EXISTS public.estoque (
    id BIGSERIAL PRIMARY KEY,
    produto_nome TEXT NOT NULL,
    quantidade NUMERIC(10, 2) DEFAULT 0,
    estoque_minimo NUMERIC(10, 2) DEFAULT 0,
    status TEXT DEFAULT '🟢   OK   🔋',
    observacao TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_estoque_produto_nome ON public.estoque (LOWER(produto_nome));

-- 4. TABELA DE CAIXA
CREATE TABLE IF NOT EXISTS public.caixa (
    id BIGSERIAL PRIMARY KEY,
    data_hora TIMESTAMPTZ DEFAULT NOW(),
    tipo TEXT NOT NULL,                         -- 'ENTRADA' ou 'SAIDA'
    valor NUMERIC(10, 2) NOT NULL,
    forma_pagamento TEXT DEFAULT 'Dinheiro',    -- 'PIX', 'Dinheiro', 'Cartão Débito', 'Cartão Crédito', 'Fiado'
    descricao TEXT,
    operador TEXT,
    origem TEXT DEFAULT 'Balcão',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_caixa_data ON public.caixa (data_hora);
CREATE INDEX IF NOT EXISTS idx_caixa_tipo ON public.caixa (tipo);

-- 5. TABELA DE VENDAS
CREATE TABLE IF NOT EXISTS public.vendas (
    id BIGSERIAL PRIMARY KEY,
    data_hora TIMESTAMPTZ DEFAULT NOW(),
    produto_nome TEXT NOT NULL,
    quantidade NUMERIC(10, 2) NOT NULL,
    valor_unitario NUMERIC(10, 2) DEFAULT 0,
    valor_total NUMERIC(10, 2) NOT NULL,
    forma_pagamento TEXT DEFAULT 'Dinheiro',
    origem TEXT DEFAULT 'Balcão',               -- 'Balcão', 'Delivery', 'Comanda'
    pedido_id TEXT,
    vendedor TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendas_data ON public.vendas (data_hora);
CREATE INDEX IF NOT EXISTS idx_vendas_produto ON public.vendas (LOWER(produto_nome));

-- 6. TABELA DE COMANDAS DE BALCÃO
CREATE TABLE IF NOT EXISTS public.comandas (
    id BIGSERIAL PRIMARY KEY,
    pedido TEXT NOT NULL UNIQUE,               -- Ex: CMD-0001
    cliente TEXT NOT NULL,
    status TEXT DEFAULT 'ABERTA',              -- 'ABERTA', 'PAGA', 'CANCELADA'
    data_abertura TIMESTAMPTZ DEFAULT NOW(),
    data_fechamento TIMESTAMPTZ,
    total NUMERIC(10, 2) DEFAULT 0,
    pago NUMERIC(10, 2) DEFAULT 0,
    saldo NUMERIC(10, 2) DEFAULT 0,
    operador TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comandas_status ON public.comandas (status);

-- 7. ITENS DE COMANDAS
CREATE TABLE IF NOT EXISTS public.comanda_itens (
    id BIGSERIAL PRIMARY KEY,
    pedido TEXT NOT NULL,
    produto_nome TEXT NOT NULL,
    quantidade NUMERIC(10, 2) NOT NULL,
    preco_unitario NUMERIC(10, 2) NOT NULL,
    subtotal NUMERIC(10, 2) NOT NULL,
    hora TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comanda_itens_pedido ON public.comanda_itens (pedido);

-- 8. TABELA DE DELIVERY
CREATE TABLE IF NOT EXISTS public.delivery (
    id BIGSERIAL PRIMARY KEY,
    pedido TEXT NOT NULL UNIQUE,               -- Ex: DEL-0001
    cliente TEXT NOT NULL,
    telefone TEXT,
    endereco TEXT,
    status TEXT DEFAULT 'PENDENTE',            -- 'PENDENTE', 'PREPARANDO', 'EM_ROTA', 'ENTREGUE', 'CANCELADO'
    valor_produtos NUMERIC(10, 2) DEFAULT 0,
    taxa_entrega NUMERIC(10, 2) DEFAULT 0,
    total NUMERIC(10, 2) DEFAULT 0,
    forma_pagamento TEXT,
    entregador TEXT,
    observacoes TEXT,
    data_hora TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_status ON public.delivery (status);

-- 9. ITENS DE DELIVERY
CREATE TABLE IF NOT EXISTS public.delivery_itens (
    id BIGSERIAL PRIMARY KEY,
    pedido TEXT NOT NULL,
    produto_nome TEXT NOT NULL,
    quantidade NUMERIC(10, 2) NOT NULL,
    preco_unitario NUMERIC(10, 2) NOT NULL,
    subtotal NUMERIC(10, 2) NOT NULL,
    hora TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_itens_pedido ON public.delivery_itens (pedido);

-- 10. CLIENTES E FIADOS
CREATE TABLE IF NOT EXISTS public.clientes (
    id BIGSERIAL PRIMARY KEY,
    nome TEXT NOT NULL UNIQUE,
    telefone TEXT,
    endereco TEXT,
    limite_fiado NUMERIC(10, 2) DEFAULT 0,
    saldo_devedor NUMERIC(10, 2) DEFAULT 0,
    status TEXT DEFAULT 'ATIVO',
    observacao TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clientes_nome_lower ON public.clientes (LOWER(nome));

-- 11. CONTAS A RECEBER (HISTÓRICO DE FIADOS)
CREATE TABLE IF NOT EXISTS public.contas_a_receber (
    id BIGSERIAL PRIMARY KEY,
    data TIMESTAMPTZ DEFAULT NOW(),
    cliente TEXT NOT NULL,
    descricao TEXT,
    valor NUMERIC(10, 2) NOT NULL,
    status TEXT DEFAULT 'PENDENTE',            -- 'PENDENTE', 'PAGO'
    data_pagamento TIMESTAMPTZ,
    forma_pagamento TEXT,
    comanda_origem TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contas_receber_cliente ON public.contas_a_receber (LOWER(cliente));
CREATE INDEX IF NOT EXISTS idx_contas_receber_status ON public.contas_a_receber (status);

-- 12. TABELA DE USUÁRIOS E PERMISSÕES
CREATE TABLE IF NOT EXISTS public.usuarios (
    id TEXT PRIMARY KEY,                       -- Ex: U-000001 ou username
    username TEXT NOT NULL UNIQUE,
    nome TEXT NOT NULL,
    email TEXT,
    senha_hash TEXT NOT NULL,
    perfil TEXT DEFAULT 'VENDEDOR',            -- 'DONO', 'GERENCIAL', 'VENDEDOR'
    ativo BOOLEAN DEFAULT TRUE,
    telegram_chat_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usuarios_telegram_chat ON public.usuarios (telegram_chat_id);

-- 13. CONFIGURAÇÕES GERAIS DO SISTEMA
CREATE TABLE IF NOT EXISTS public.config (
    chave TEXT PRIMARY KEY,
    valor TEXT,
    descricao TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ====================================================================
-- POLÍTICAS DE ACESSO (ROW LEVEL SECURITY - RLS)
-- Como a integração do backend (Apps Script / Bot) usa a Secret Key / Service Key,
-- liberamos acesso seguro para a API do backend
-- ====================================================================

ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caixa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comandas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comanda_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contas_a_receber ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config ENABLE ROW LEVEL SECURITY;

-- Cria políticas para permitir leitura e gravação completa pela service_role / api do sistema
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name IN ('produtos', 'estoque', 'caixa', 'vendas', 'comandas', 'comanda_itens', 'delivery', 'delivery_itens', 'clientes', 'contas_a_receber', 'usuarios', 'config')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Acesso Total Backend" ON public.%I', t);
        EXECUTE format('CREATE POLICY "Acesso Total Backend" ON public.%I FOR ALL USING (true) WITH CHECK (true)', t);
    END LOOP;
END $$;
