import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, Layers, Lock } from 'lucide-react';
import type { SessaoAtiva } from '../types/domain';
import {
  autenticarUsuario,
  concluirSetupBoasVindas
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

  // Boas-Vindas (Nova Empresa)
  const [nomeEmpresa, setNomeEmpresa] = useState(setupNomeEmpresa || '');
  const [usuarioDono, setUsuarioDono] = useState('');
  const [emailDono, setEmailDono] = useState('');
  const [senhaDono, setSenhaDono] = useState('');

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
          <div className="login-icon" aria-hidden="true">
            <Layers size={28} />
          </div>
          <div>
            <h2 id="loginBrandTitle">
              Gestão de Negócios <span className="login-pill-360">360°</span>
            </h2>
          </div>
          <p className="login-subtitle">Plataforma multimodal de gestão para o seu negócio</p>
        </div>

        {alerta && <div className={`login-alert ${alerta.tipo}`}>{alerta.texto}</div>}

        {mostrarCfgSupa ? (
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
            </div>

            <button type="submit" id="btnLoginSubmit" className="btn-login-submit" disabled={carregando}>
              <span id="btnLoginText">{carregando ? 'Validando...' : 'Acessar Painel'}</span>
            </button>
          </form>
        )}

        <div className="login-footer">
          <span className="login-footer-center">
            <Lock size={13} aria-hidden="true" />
            <span>Acesso seguro</span>
          </span>
          <button
            type="button"
            className="login-mode-pill"
            onClick={() => setMostrarCfgSupa((v) => !v)}
            title="Alternar ou configurar conexão Supabase"
          >
            {supabaseAtivo ? 'Supabase Conectado' : 'Modo Local-First'}
          </button>
        </div>
      </div>
    </div>
  );
}
