import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { formatarTelefoneBr } from '../utils/formatters';
import type { SessaoAtiva } from '../types/domain';
import {
  autenticarUsuario,
  cadastrarNovaEmpresaTrial,
  concluirSetupBoasVindas,
  redefinirSenhaComCodigo,
  solicitarRecuperacaoSenha
} from '../services/dataRepository';
import {
  getSupabaseConfig,
  isSupabaseConfigured,
  saveSupabaseConfig,
  testarConexaoSupabaseReal
} from '../services/supabaseClient';

interface LoginScreenProps {
  precisaSetupDono: boolean;
  setupEmpresaId: string;
  setupNomeEmpresa: string;
  onLoginSucesso: (sessao: SessaoAtiva) => void;
}

export function LoginScreen({
  precisaSetupDono,
  setupEmpresaId,
  setupNomeEmpresa,
  onLoginSucesso
}: LoginScreenProps) {
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [lembrar, setLembrar] = useState(true);
  const [verSenha, setVerSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [alerta, setAlerta] = useState<{ tipo: 'error' | 'success'; texto: string } | null>(null);
  const [modoTela, setModoTela] = useState<'login' | 'trial' | 'recuperar'>('login');

  // Boas-Vindas (Nova Empresa)
  const [nomeEmpresa, setNomeEmpresa] = useState(setupNomeEmpresa || '');
  const [usuarioDono, setUsuarioDono] = useState('');
  const [emailDono, setEmailDono] = useState('');
  const [telefoneDono, setTelefoneDono] = useState('');
  const [senhaDono, setSenhaDono] = useState('');

  // Recuperar Senha via Telegram
  const [recIdent, setRecIdent] = useState('');
  const [recCodigoEnviado, setRecCodigoEnviado] = useState(false);
  const [recCodigo, setRecCodigo] = useState('');
  const [recNovaSenha, setRecNovaSenha] = useState('');

  // Modal discreto para configurar Supabase direto antes do login se desejado
  const [mostrarCfgSupa, setMostrarCfgSupa] = useState(false);
  const cfgAtual = getSupabaseConfig();
  const [supaUrl, setSupaUrl] = useState(cfgAtual.url);
  const [supaKey, setSupaKey] = useState(cfgAtual.anonKey);
  const supabaseAtivo = isSupabaseConfigured();

  async function handleLoginSubmit(e: FormEvent) {
    e.preventDefault();
    setAlerta(null);
    setCarregando(true);
    try {
      const res = await autenticarUsuario(login, senha, lembrar);
      if (res.ok && res.sessao) {
        onLoginSucesso(res.sessao);
      } else {
        setAlerta({ tipo: 'error', texto: res.msg || 'Usuário ou senha incorretos.' });
      }
    } finally {
      setCarregando(false);
    }
  }

  async function handleTrialSubmit(e: FormEvent) {
    e.preventDefault();
    setAlerta(null);
    setCarregando(true);
    try {
      const res = await cadastrarNovaEmpresaTrial({
        nomeEmpresa,
        usernameDono: usuarioDono,
        emailDono,
        senhaDono,
        telefone: telefoneDono
      });
      if (res.ok && res.sessao) {
        onLoginSucesso(res.sessao);
      } else {
        setAlerta({ tipo: 'error', texto: res.msg || 'Não foi possível criar a empresa.' });
      }
    } finally {
      setCarregando(false);
    }
  }

  async function handleEnviarCodigoRecuperacao(e: FormEvent) {
    e.preventDefault();
    setAlerta(null);
    setCarregando(true);
    try {
      const res = await solicitarRecuperacaoSenha(recIdent);
      setAlerta({ tipo: res.ok ? 'success' : 'error', texto: res.msg });
      if (res.ok) setRecCodigoEnviado(true);
    } finally {
      setCarregando(false);
    }
  }

  async function handleRedefinirSenha(e: FormEvent) {
    e.preventDefault();
    setAlerta(null);
    setCarregando(true);
    try {
      const res = await redefinirSenhaComCodigo(recIdent, recCodigo, recNovaSenha);
      setAlerta({ tipo: res.ok ? 'success' : 'error', texto: res.msg });
      if (res.ok) {
        setModoTela('login');
        setRecCodigoEnviado(false);
        setRecCodigo('');
        setRecNovaSenha('');
      }
    } finally {
      setCarregando(false);
    }
  }

  async function handleSetupSubmit(e: FormEvent) {
    e.preventDefault();
    setAlerta(null);
    setCarregando(true);
    try {
      const res = await concluirSetupBoasVindas({
        empresaId: setupEmpresaId,
        nomeEmpresa,
        usernameDono: usuarioDono,
        emailDono,
        senhaDono
      });
      if (res.ok && res.sessao) {
        onLoginSucesso(res.sessao);
      } else {
        setAlerta({ tipo: 'error', texto: res.msg || 'Não foi possível concluir o cadastro.' });
      }
    } finally {
      setCarregando(false);
    }
  }

  async function handleSalvarSupabase() {
    saveSupabaseConfig({ url: supaUrl, anonKey: supaKey });
    if (!supaUrl.trim() && !supaKey.trim()) {
      setAlerta({ tipo: 'success', texto: 'Modo Local-First ativado.' });
      setMostrarCfgSupa(false);
      return;
    }
    setCarregando(true);
    const teste = await testarConexaoSupabaseReal();
    setCarregando(false);
    setAlerta({ tipo: teste.ok ? 'success' : 'error', texto: teste.msg });
    if (teste.ok) setMostrarCfgSupa(false);
  }

  return (
    <div id="overlayLogin" className="login-backdrop">
      <div className="login-card">
        <div className="login-brand">
          <img
            src="./logo-mk.png"
            alt="MK Gestão de Negócios 360° — MeninoKaro"
            style={{
              width: 112,
              height: 112,
              objectFit: 'cover',
              borderRadius: 18,
              border: '1px solid rgba(56, 189, 248, 0.35)',
              boxShadow: '0 8px 28px rgba(15, 23, 42, 0.55)',
              marginBottom: 4
            }}
          />
          <div>
            <h2 id="loginBrandTitle">
              MK Gestão de Negócios <span className="login-pill-360">360°</span>
            </h2>
          </div>
          <p className="login-subtitle">MeninoKaro Tecnologia • Gestão Empresarial</p>
        </div>

        {alerta && <div className={`login-alert ${alerta.tipo}`}>{alerta.texto}</div>}

        {mostrarCfgSupa && !supabaseAtivo ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.4 }}>
              Conecte seu projeto <strong>Supabase</strong> (URL + Anon Key pública) ou deixe vazio para operar em modo Local-First.
            </div>
            <div className="login-input-group" style={{ marginBottom: 0 }}>
              <label htmlFor="supaUrlInput">Supabase URL</label>
              <input
                id="supaUrlInput"
                className="login-input"
                placeholder="https://seu-projeto.supabase.co"
                value={supaUrl}
                onChange={(e) => setSupaUrl(e.target.value)}
              />
            </div>
            <div className="login-input-group" style={{ marginBottom: 4 }}>
              <label htmlFor="supaKeyInput">Supabase Anon Key</label>
              <input
                id="supaKeyInput"
                type="password"
                className="login-input"
                placeholder="eyJ..."
                value={supaKey}
                onChange={(e) => setSupaKey(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn-login-submit"
                style={{ flex: 1, padding: 11, fontSize: 13.5 }}
                onClick={handleSalvarSupabase}
                disabled={carregando}
              >
                {carregando ? 'Testando...' : 'Salvar e Testar'}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => setMostrarCfgSupa(false)}
              >
                Voltar
              </button>
            </div>
          </div>
        ) : precisaSetupDono ? (
          <form id="formSetupBoasVindas" onSubmit={handleSetupSubmit}>
            <div
              style={{
                background: 'rgba(124, 58, 237, 0.14)',
                border: '1px solid rgba(139, 92, 246, 0.35)',
                borderRadius: 12,
                padding: '12px 14px',
                marginBottom: 16,
                fontSize: 12,
                color: '#ddd6fe',
                lineHeight: 1.45
              }}
            >
              <strong>Bem-vindo!</strong> Cadastre os dados da sua empresa e crie seu acesso de{' '}
              <strong>Dono</strong> para iniciar.
            </div>
            <div className="login-input-group">
              <label htmlFor="setupNomeEmpresa">Nome da Empresa</label>
              <input
                id="setupNomeEmpresa"
                className="login-input"
                placeholder="Nome da empresa"
                value={nomeEmpresa}
                onChange={(e) => setNomeEmpresa(e.target.value)}
                required
              />
            </div>
            <div className="login-input-group">
              <label htmlFor="setupNomeDono">Usuário do Dono</label>
              <input
                id="setupNomeDono"
                className="login-input"
                placeholder="Usuário"
                value={usuarioDono}
                onChange={(e) => setUsuarioDono(e.target.value)}
                required
              />
            </div>
            <div className="login-input-group">
              <label htmlFor="setupEmailDono">E-mail (opcional)</label>
              <input
                id="setupEmailDono"
                type="email"
                className="login-input"
                placeholder="contato@suaempresa.com"
                value={emailDono}
                onChange={(e) => setEmailDono(e.target.value)}
              />
            </div>
            <div className="login-input-group">
              <label htmlFor="setupSenhaDono">Senha</label>
              <input
                id="setupSenhaDono"
                type="password"
                className="login-input"
                placeholder="Senha"
                minLength={4}
                value={senhaDono}
                onChange={(e) => setSenhaDono(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn-login-submit" disabled={carregando}>
              {carregando ? 'Configurando...' : 'Concluir Cadastro e Acessar'}
            </button>
          </form>
        ) : modoTela === 'trial' ? (
          <form onSubmit={handleTrialSubmit}>
            <div
              style={{
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                borderRadius: 12,
                padding: '10px 12px',
                marginBottom: 14,
                fontSize: 12,
                color: '#a7f3d0',
                lineHeight: 1.45
              }}
            >
              <strong>Teste Grátis por 7 Dias!</strong> Crie sua empresa e seu acesso de <strong>Dono</strong> agora mesmo.
            </div>
            <div className="login-input-group">
              <label>Nome da Empresa *</label>
              <input className="login-input" placeholder="Ex.: Depósito Central" value={nomeEmpresa} onChange={(e) => setNomeEmpresa(e.target.value)} required />
            </div>
            <div className="login-input-group">
              <label>Usuário de Acesso (Dono) *</label>
              <input className="login-input" placeholder="Ex.: joao.silva" value={usuarioDono} onChange={(e) => setUsuarioDono(e.target.value)} required />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div className="login-input-group">
                <label>E-mail</label>
                <input type="email" className="login-input" placeholder="contato@empresa.com" value={emailDono} onChange={(e) => setEmailDono(e.target.value)} />
              </div>
              <div className="login-input-group">
                <label>WhatsApp</label>
                <input className="login-input" placeholder="(11) 99999-9999" value={telefoneDono} onChange={(e) => setTelefoneDono(formatarTelefoneBr(e.target.value))} />
              </div>
            </div>
            <div className="login-input-group">
              <label>Senha (mínimo 4 caracteres) *</label>
              <input type="password" className="login-input" placeholder="Senha" minLength={4} value={senhaDono} onChange={(e) => setSenhaDono(e.target.value)} required />
            </div>
            <button type="submit" className="btn-login-submit" disabled={carregando}>
              {carregando ? 'Criando empresa...' : 'Criar Empresa e Acessar'}
            </button>
            <button
              type="button"
              className="btn"
              style={{ width: '100%', marginTop: 10, justifyContent: 'center' }}
              onClick={() => { setAlerta(null); setModoTela('login'); }}
            >
              Voltar para Login
            </button>
          </form>
        ) : modoTela === 'recuperar' ? (
          <form onSubmit={recCodigoEnviado ? handleRedefinirSenha : handleEnviarCodigoRecuperacao}>
            <div style={{ fontSize: 12.5, color: '#cbd5e1', marginBottom: 12, lineHeight: 1.45 }}>
              Informe seu <strong>usuário ou e-mail</strong> para receber um código de 6 dígitos no seu <strong>E-mail</strong> ou <strong>Telegram</strong>.
            </div>
            <div className="login-input-group">
              <label>Usuário ou E-mail *</label>
              <input
                className="login-input"
                placeholder="Usuário ou e-mail"
                value={recIdent}
                onChange={(e) => setRecIdent(e.target.value)}
                disabled={recCodigoEnviado}
                required
              />
            </div>
            {recCodigoEnviado && (
              <>
                <div className="login-input-group">
                  <label>Código recebido *</label>
                  <input
                    className="login-input"
                    placeholder="000000"
                    value={recCodigo}
                    onChange={(e) => setRecCodigo(e.target.value)}
                    required
                  />
                </div>
                <div className="login-input-group">
                  <label>Nova Senha *</label>
                  <input
                    type="password"
                    className="login-input"
                    placeholder="Mínimo 4 caracteres"
                    minLength={4}
                    value={recNovaSenha}
                    onChange={(e) => setRecNovaSenha(e.target.value)}
                    required
                  />
                </div>
              </>
            )}
            <button type="submit" className="btn-login-submit" disabled={carregando}>
              {carregando
                ? 'Processando...'
                : recCodigoEnviado
                ? 'Redefinir Senha'
                : 'Enviar Código de Recuperação'}
            </button>
            <button
              type="button"
              className="btn"
              style={{ width: '100%', marginTop: 10, justifyContent: 'center' }}
              onClick={() => {
                setAlerta(null);
                setRecCodigoEnviado(false);
                setModoTela('login');
              }}
            >
              Voltar para Login
            </button>
          </form>
        ) : (
          <form id="formLoginWeb" onSubmit={handleLoginSubmit}>
            <div className="login-input-group">
              <label htmlFor="loginUsuarioInput">Usuário</label>
              <input
                type="text"
                id="loginUsuarioInput"
                className="login-input"
                placeholder="Usuário"
                autoComplete="username"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                required
              />
            </div>

            <div className="login-input-group">
              <label htmlFor="loginSenhaInput">Senha</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={verSenha ? 'text' : 'password'}
                  id="loginSenhaInput"
                  className="login-input"
                  placeholder="Senha"
                  autoComplete="current-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                  style={{ paddingRight: 42 }}
                />
                <button
                  type="button"
                  className="btn-toggle-pass"
                  onClick={() => setVerSenha((v) => !v)}
                  tabIndex={-1}
                  title="Ver / Ocultar Senha"
                >
                  {verSenha ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                margin: '14px 0 22px 0',
                fontSize: 13,
                color: '#94a3b8'
              }}
            >
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  id="loginLembrarCheckbox"
                  checked={lembrar}
                  onChange={(e) => setLembrar(e.target.checked)}
                  style={{ accentColor: '#7c3aed', width: 16, height: 16 }}
                />
                <span>Manter conectado</span>
              </label>
              <button
                type="button"
                onClick={() => { setAlerta(null); setModoTela('recuperar'); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#a78bfa',
                  cursor: 'pointer',
                  fontSize: 12.5,
                  padding: 0
                }}
              >
                Esqueci minha senha
              </button>
            </div>

            <button type="submit" id="btnLoginSubmit" className="btn-login-submit" disabled={carregando}>
              <span id="btnLoginText">{carregando ? 'Validando...' : 'Acessar Painel'}</span>
            </button>

            <div style={{ marginTop: 14, textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => { setAlerta(null); setNomeEmpresa(''); setModoTela('trial'); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#34d399',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 600
                }}
              >
                Não tem conta? Criar Empresa (Teste Grátis 7 dias)
              </button>
            </div>
          </form>
        )}

        <div className="login-footer">
          <span className="login-footer-center">
            <Lock size={13} aria-hidden="true" />
            <span>Acesso seguro</span>
          </span>
          {supabaseAtivo ? (
            <span className="login-mode-pill" style={{ cursor: 'default' }}>
              Nuvem Conectada
            </span>
          ) : (
            <button
              type="button"
              className="login-mode-pill"
              onClick={() => setMostrarCfgSupa((v) => !v)}
              title="Configurar conexão Supabase"
            >
              Modo Local-First
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
