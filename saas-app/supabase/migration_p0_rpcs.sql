-- ====================================================================
-- MK Gestão de Negócios 360° — RPCs SECURITY DEFINER (Cadastro Trial & Recuperação de Senha)
-- Execute este script no SQL Editor do Supabase.
-- ====================================================================

CREATE OR REPLACE FUNCTION public.rpc_cadastrar_empresa_trial(
  p_empresa_id TEXT,
  p_grupo_id TEXT,
  p_usuario_id TEXT,
  p_nome_empresa TEXT,
  p_username_dono TEXT,
  p_email_dono TEXT,
  p_telefone TEXT,
  p_senha_hash TEXT,
  p_valido_ate DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uname TEXT := lower(trim(p_username_dono));
BEGIN
  IF v_uname IN ('admin', 'administrador') THEN
    RETURN jsonb_build_object('ok', false, 'msg', 'Este usuário é reservado ao sistema. Escolha outro login.');
  END IF;

  IF EXISTS (SELECT 1 FROM public.usuarios WHERE lower(username) = v_uname) THEN
    RETURN jsonb_build_object('ok', false, 'msg', 'O usuário "' || v_uname || '" já está em uso. Escolha outro.');
  END IF;

  INSERT INTO public.grupos_empresariais (id, nome)
  VALUES (p_grupo_id, trim(p_nome_empresa))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.empresas (
    id, grupo_id, tipo, nome, dono_nome, cnpj, telefone, cidade,
    chave_pix, drive_folder_id, planilha_espelho_id,
    plano, status_assinatura, valido_ate, setup_concluido
  ) VALUES (
    p_empresa_id, p_grupo_id, 'MATRIZ', trim(p_nome_empresa), trim(p_username_dono), '', COALESCE(trim(p_telefone), ''), '',
    '', '', '',
    'PRO', 'TRIAL', p_valido_ate, true
  );

  INSERT INTO public.usuarios (
    id, empresa_id, grupo_id, username, nome, email, senha_hash, perfil, ativo
  ) VALUES (
    p_usuario_id, p_empresa_id, p_grupo_id, v_uname, trim(p_username_dono), lower(COALESCE(trim(p_email_dono), '')), p_senha_hash, 'DONO', true
  );

  RETURN jsonb_build_object('ok', true, 'empresa_id', p_empresa_id, 'usuario_id', p_usuario_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_solicitar_codigo_recuperacao(
  p_identificador TEXT,
  p_codigo TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ident TEXT := lower(trim(p_identificador));
  v_usr RECORD;
  v_emp RECORD;
  v_expira BIGINT := (extract(epoch from now()) * 1000)::BIGINT + 600000;
BEGIN
  SELECT id, empresa_id, grupo_id, username, email, perfil, ativo
  INTO v_usr
  FROM public.usuarios
  WHERE lower(username) = v_ident OR (email IS NOT NULL AND lower(email) = v_ident)
  LIMIT 1;

  IF v_usr IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'msg', 'Usuário ou e-mail não encontrado.');
  END IF;

  IF NOT COALESCE(v_usr.ativo, true) THEN
    RETURN jsonb_build_object('ok', false, 'msg', 'Usuário inativo. Contate o administrador.');
  END IF;

  SELECT telegram_bot_token, telegram_chat_id
  INTO v_emp
  FROM public.empresas
  WHERE id = v_usr.empresa_id
  LIMIT 1;

  INSERT INTO public.config (chave, valor, updated_at)
  VALUES (
    'PWD_RESET_' || v_usr.id,
    jsonb_build_object('userId', v_usr.id, 'codigo', p_codigo, 'expiraEm', v_expira)::TEXT,
    now()
  )
  ON CONFLICT (chave) DO UPDATE
  SET valor = EXCLUDED.valor, updated_at = now();

  RETURN jsonb_build_object(
    'ok', true,
    'usuario_id', v_usr.id,
    'username', v_usr.username,
    'email', COALESCE(v_usr.email, ''),
    'perfil', COALESCE(v_usr.perfil, ''),
    'telegram_bot_token', COALESCE(v_emp.telegram_bot_token, ''),
    'telegram_chat_id', COALESCE(v_emp.telegram_chat_id, '')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_redefinir_senha_com_codigo(
  p_identificador TEXT,
  p_codigo TEXT,
  p_nova_senha_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ident TEXT := lower(trim(p_identificador));
  v_usr RECORD;
  v_kv_val TEXT;
  v_json JSONB;
  v_now BIGINT := (extract(epoch from now()) * 1000)::BIGINT;
BEGIN
  SELECT id
  INTO v_usr
  FROM public.usuarios
  WHERE lower(username) = v_ident OR (email IS NOT NULL AND lower(email) = v_ident)
  LIMIT 1;

  IF v_usr IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'msg', 'Usuário ou e-mail não encontrado.');
  END IF;

  SELECT valor INTO v_kv_val
  FROM public.config
  WHERE chave = 'PWD_RESET_' || v_usr.id
  LIMIT 1;

  IF v_kv_val IS NULL OR v_kv_val = '' THEN
    RETURN jsonb_build_object('ok', false, 'msg', 'Código inválido ou expirado. Solicite um novo.');
  END IF;

  v_json := v_kv_val::JSONB;
  IF (v_json->>'codigo') <> trim(p_codigo) OR (v_json->>'expiraEm')::BIGINT < v_now THEN
    RETURN jsonb_build_object('ok', false, 'msg', 'Código inválido ou expirado. Solicite um novo.');
  END IF;

  UPDATE public.usuarios
  SET senha_hash = p_nova_senha_hash
  WHERE id = v_usr.id;

  DELETE FROM public.config WHERE chave = 'PWD_RESET_' || v_usr.id;

  RETURN jsonb_build_object('ok', true, 'msg', 'Senha redefinida com sucesso! Já pode acessar com a nova senha.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_cadastrar_empresa_trial(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DATE) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_solicitar_codigo_recuperacao(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_redefinir_senha_com_codigo(TEXT, TEXT, TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.rpc_criar_empresa_pelo_admin(
  p_empresa_id TEXT,
  p_grupo_id TEXT,
  p_usuario_id TEXT,
  p_nome_empresa TEXT,
  p_dono_nome TEXT,
  p_cnpj TEXT,
  p_telefone TEXT,
  p_cidade TEXT,
  p_plano TEXT,
  p_status_assinatura TEXT,
  p_valido_ate DATE,
  p_username_dono TEXT,
  p_email_dono TEXT,
  p_senha_hash TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uname TEXT := lower(trim(p_username_dono));
BEGIN
  IF v_uname IN ('admin', 'administrador') THEN
    RETURN jsonb_build_object('ok', false, 'msg', 'Login reservado ao sistema. Escolha outro para o Dono.');
  END IF;

  IF EXISTS (SELECT 1 FROM public.usuarios WHERE lower(username) = v_uname) THEN
    RETURN jsonb_build_object('ok', false, 'msg', 'O login "' || v_uname || '" já está em uso.');
  END IF;

  INSERT INTO public.grupos_empresariais (id, nome)
  VALUES (p_grupo_id, trim(p_nome_empresa))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.empresas (
    id, grupo_id, tipo, nome, dono_nome, cnpj, telefone, cidade,
    chave_pix, drive_folder_id, planilha_espelho_id,
    plano, status_assinatura, valido_ate, setup_concluido
  ) VALUES (
    p_empresa_id, p_grupo_id, 'MATRIZ', trim(p_nome_empresa), COALESCE(NULLIF(trim(p_dono_nome), ''), v_uname),
    COALESCE(trim(p_cnpj), ''), COALESCE(trim(p_telefone), ''), COALESCE(trim(p_cidade), ''),
    '', '', '',
    COALESCE(NULLIF(trim(p_plano), ''), 'PRO'),
    COALESCE(NULLIF(trim(p_status_assinatura), ''), 'ATIVO'),
    p_valido_ate,
    true
  );

  INSERT INTO public.usuarios (
    id, empresa_id, grupo_id, username, nome, email, senha_hash, perfil, ativo
  ) VALUES (
    p_usuario_id, p_empresa_id, p_grupo_id, v_uname, COALESCE(NULLIF(trim(p_dono_nome), ''), v_uname),
    lower(COALESCE(trim(p_email_dono), '')), p_senha_hash, 'DONO', true
  );

  RETURN jsonb_build_object('ok', true, 'empresa_id', p_empresa_id, 'usuario_id', p_usuario_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_criar_empresa_pelo_admin(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, TEXT, TEXT, TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.rpc_excluir_empresa_admin(
  p_empresa_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF trim(COALESCE(p_empresa_id, '')) = '' THEN
    RETURN jsonb_build_object('ok', false, 'msg', 'ID da empresa inválido.');
  END IF;

  IF p_empresa_id = 'EMP-MATRIZ-DEFAULT' THEN
    RETURN jsonb_build_object('ok', false, 'msg', 'A empresa matriz padrão do sistema não pode ser excluída.');
  END IF;

  DELETE FROM public.empresas WHERE id = p_empresa_id;
  RETURN jsonb_build_object('ok', true, 'msg', 'Empresa excluída com sucesso.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_excluir_empresa_admin(TEXT) TO anon, authenticated;
