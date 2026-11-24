import { useEffect, useState, type FormEvent } from 'react';
import {
  Building,
  Copy,
  Database,
  ExternalLink,
  RefreshCw,
  Save,
  Send
} from 'lucide-react';
import type { ConfigMasterSaas, PainelSnapshot, SessaoAtiva, StatusSync } from '../types/domain';
import { criarNovaUnidade, obterConfigMasterSaasPublica, salvarConfiguracoesEmpresa } from '../services/dataRepository';
import { PagamentoAssinaturaCard } from './PagamentoAssinaturaCard';
import { testarTelegramEmpresa } from '../services/telegramService';
import {
  getSupabaseConfig,
  saveSupabaseConfig,
  testarConexaoSupabaseReal
} from '../services/supabaseClient';
import {
  DEFAULT_GAS_WEBAPP_URL,
  dispararSyncPlanilhaImediata
} from '../services/sheetBridgeService';
import { normalizarChavePixBCB } from '../utils/pixPayload';
import schemaSqlRaw from '../../supabase/schema_saas_v2.sql?raw';

interface ConfigTabProps {
  sessao: SessaoAtiva;
  snapshot: PainelSnapshot;
  statusSync: StatusSync;
  onNotify: (texto: string, tipo?: 'success' | 'error' | 'warning' | 'info') => void;
  onRefreshSyncStatus: () => Promise<void>;
  onUnidadesAtualizadas: (novas: SessaoAtiva['unidades']) => void;
  onAtualizarDados: () => Promise<void>;
}

export function ConfigTab({
  sessao,
  snapshot,
  statusSync: _statusSync,
  onNotify,
  onRefreshSyncStatus,
  onUnidadesAtualizadas,
  onAtualizarDados
}: ConfigTabProps) {
  const emp = snapshot.empresa;
  const extras = snapshot.configsExtras;
  const isAdmin = sessao.usuario.perfil === 'ADMIN';
  const isDonoOuAdmin = isAdmin || sessao.usuario.perfil === 'DONO';

  // Empresa
  const [nome, setNome] = useState(emp.nome || '');
  const [donoNome, setDonoNome] = useState(emp.dono_nome || '');
  const [cnpj, setCnpj] = useState(emp.cnpj || '');
  const [telefone, setTelefone] = useState(emp.telefone || '');
  const [cidade, setCidade] = useState(emp.cidade || '');
  const [chavePix, setChavePix] = useState(emp.chave_pix || '');
  const [telegramToken, setTelegramToken] = useState(emp.telegram_bot_token || '');
  const [telegramChatId, setTelegramChatId] = useState(emp.telegram_chat_id || '');

  // Parâmetros operacionais / legado (configsExtras)
  const [driveUrl, setDriveUrl] = useState(extras?.driveUrl || '');
  const [spreadsheetUrl, setSpreadsheetUrl] = useState(extras?.spreadsheetUrl || '');
  const [webappUrl, setWebappUrl] = useState(extras?.webappUrl || '');
  const [permitirEstoqueNegativo, setPermitirEstoqueNegativo] = useState(
    Boolean(extras?.permitirEstoqueNegativo)
  );
  const [autoRefresh, setAutoRefresh] = useState(Boolean(extras?.autoRefresh));
  const [intervaloRefreshMin, setIntervaloRefreshMin] = useState(
    String(extras?.intervaloRefreshMin || 5)
  );
  const [backupAuto, setBackupAuto] = useState(Boolean(extras?.backupAuto));

  useEffect(() => {
    setNome(emp.nome || '');
    setDonoNome(emp.dono_nome || '');
    setCnpj(emp.cnpj || '');
    setTelefone(emp.telefone || '');
    setCidade(emp.cidade || '');
    setChavePix(emp.chave_pix || '');
    setTelegramToken(emp.telegram_bot_token || '');
    setTelegramChatId(emp.telegram_chat_id || '');
    setDriveUrl(extras?.driveUrl || '');
    setSpreadsheetUrl(extras?.spreadsheetUrl || '');
    setWebappUrl(extras?.webappUrl || '');
    setPermitirEstoqueNegativo(Boolean(extras?.permitirEstoqueNegativo));
    setAutoRefresh(Boolean(extras?.autoRefresh));
    setIntervaloRefreshMin(String(extras?.intervaloRefreshMin || 5));
    setBackupAuto(Boolean(extras?.backupAuto));
  }, [emp, extras]);

  // Supabase
  const supaCfg = getSupabaseConfig();
  const [supaUrl, setSupaUrl] = useState(supaCfg.url);
  const [supaKey, setSupaKey] = useState(supaCfg.anonKey);

  // Filial / Nova Empresa
  const [configMasterPublica, setConfigMasterPublica] = useState<ConfigMasterSaas | null>(null);

  useEffect(() => {
    void obterConfigMasterSaasPublica(sessao).then(setConfigMasterPublica);
  }, [sessao]);
  const [tipoUnidade, setTipoUnidade] = useState<'FILIAL' | 'NOVA_EMPRESA'>('FILIAL');
  const [nomeNovaUnidade, setNomeNovaUnidade] = useState('');
  const [copiarProdutos, setCopiarProdutos] = useState(true);
  const [copiarClientes, setCopiarClientes] = useState(false);

  const [busy, setBusy] = useState(false);

  async function handleSalvarEmpresa(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const intervaloNum = Math.max(1, parseInt(intervaloRefreshMin, 10) || 5);
      const res = await salvarConfiguracoesEmpresa(
        sessao,
        {
          nome,
          dono_nome: donoNome,
          cnpj,
          telefone,
          cidade,
          chave_pix: chavePix,
          telegram_bot_token: telegramToken,
          telegram_chat_id: telegramChatId
        },
        {
          driveUrl: driveUrl.trim(),
          spreadsheetUrl: spreadsheetUrl.trim(),
          webappUrl: webappUrl.trim(),
          permitirEstoqueNegativo,
          autoRefresh,
          intervaloRefreshMin: intervaloNum,
          backupAuto
        }
      );
      onNotify(res.msg, res.ok ? 'success' : 'error');
      await onAtualizarDados();
    } finally {
      setBusy(false);
    }
  }

  async function handleSincronizarBridgeAgora() {
    const urlAlvo =
      webappUrl.trim() ||
      extras?.webappUrl ||
      (emp.id === 'EMP-MATRIZ-DEFAULT' || emp.tipo === 'MATRIZ' ? DEFAULT_GAS_WEBAPP_URL : '');
    if (!urlAlvo) {
      onNotify('Informe a URL do Bridge Apps Script / Telegram (WEBAPP_URL) primeiro.', 'warning');
      return;
    }
    setBusy(true);
    try {
      const ok = await dispararSyncPlanilhaImediata(urlAlvo, emp.id, 'SYNC_BIDIRECTIONAL');
      if (ok) {
        await new Promise((r) => setTimeout(r, 1800));
        await onAtualizarDados();
        onNotify('Sincronização bidirecional Planilha ↔ Supabase concluída!', 'success');
      } else {
        onNotify('Não foi possível contatar o Bridge do Google Apps Script.', 'warning');
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleTestarTelegram() {
    setBusy(true);
    try {
      const res = await testarTelegramEmpresa({
        nome: nome || emp.nome,
        telegram_bot_token: telegramToken,
        telegram_chat_id: telegramChatId
      });
      onNotify(res.msg, res.ok ? 'success' : 'warning');
    } finally {
      setBusy(false);
    }
  }

  async function handleSalvarETestarSupabase() {
    setBusy(true);
    try {
      saveSupabaseConfig({ url: supaUrl, anonKey: supaKey });
      if (!supaUrl.trim() && !supaKey.trim()) {
        onNotify('Supabase desconectado. Operando em Modo Local-First.', 'info');
        await onRefreshSyncStatus();
        return;
      }
      const res = await testarConexaoSupabaseReal();
      onNotify(res.msg, res.ok ? 'success' : 'error');
      await onRefreshSyncStatus();
    } finally {
      setBusy(false);
    }
  }

  async function handleCopiarSchemaSql() {
    try {
      await navigator.clipboard.writeText(schemaSqlRaw);
      onNotify('Schema SQL Multi-tenant copiado! Cole no SQL Editor do Supabase.', 'success');
    } catch {
      onNotify('Não foi possível copiar automaticamente. Arquivo salvo em saas-app/supabase/schema_saas_v2.sql.', 'warning');
    }
  }

  async function handleCriarUnidade(e: FormEvent) {
    e.preventDefault();
    if (!nomeNovaUnidade.trim()) return;
    setBusy(true);
    try {
      const res = await criarNovaUnidade(sessao, {
        tipo: isAdmin ? tipoUnidade : 'FILIAL',
        nome: nomeNovaUnidade,
        copiarProdutos,
        copiarClientes
      });
      if (res.ok) {
        setNomeNovaUnidade('');
        if (res.unidadesAtualizadas) {
          onUnidadesAtualizadas(res.unidadesAtualizadas);
        }
        onNotify(res.msg, 'success');
      } else {
        onNotify(res.msg, 'error');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid-2">
      {/* 1. DADOS DA EMPRESA & ASSINATURA */}
      <div className="panel-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ fontSize: 16 }}>Dados da Empresa & Assinatura</h3>
          <span className="badge badge-ok">
            Plano {emp.plano} • {emp.status_assinatura}
          </span>
        </div>

        <div style={{ marginBottom: 14 }}>
          <PagamentoAssinaturaCard
            sessao={sessao}
            planoAtual={emp.plano || 'PRO'}
            configMaster={configMasterPublica}
            onNotify={onNotify}
            onAtualizado={onAtualizarDados}
          />
        </div>

        <form onSubmit={handleSalvarEmpresa} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label className="field-label">Nome Fantasia</label>
            <input className="field-input" value={nome} onChange={(e) => setNome(e.target.value)} required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label className="field-label">Responsável / Dono</label>
              <input className="field-input" value={donoNome} onChange={(e) => setDonoNome(e.target.value)} />
            </div>
            <div>
              <label className="field-label">CNPJ</label>
              <input className="field-input" value={cnpj} onChange={(e) => setCnpj(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Telefone / WhatsApp</label>
              <input className="field-input" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Cidade / UF</label>
              <input className="field-input" value={cidade} onChange={(e) => setCidade(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="field-label">Chave PIX</label>
            <input className="field-input" value={chavePix} onChange={(e) => setChavePix(e.target.value)} />
            {chavePix.trim() && (
              <div style={{ fontSize: 11.5, color: '#34d399', marginTop: 4, fontWeight: 600 }}>
                Chave BCB padronizada: <span style={{ fontFamily: 'monospace' }}>{normalizarChavePixBCB(chavePix)}</span>
              </div>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label className="field-label">Telegram Bot Token (Integrado)</label>
              <input type="password" className="field-input" placeholder="123456:ABC..." value={telegramToken} onChange={(e) => setTelegramToken(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Telegram Chat ID do Dono</label>
              <input className="field-input" placeholder="Ex: 528901234" value={telegramChatId} onChange={(e) => setTelegramChatId(e.target.value)} />
            </div>
          </div>

          <div
            style={{
              borderTop: '1px solid var(--border-subtle)',
              paddingTop: 10,
              marginTop: 2,
              display: 'flex',
              flexDirection: 'column',
              gap: 10
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="field-label">URL da Pasta Google Drive (DRIVE_URL)</label>
                {driveUrl.trim() && (
                  <a
                    href={driveUrl.trim()}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      fontSize: 11.5,
                      color: '#38bdf8',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      textDecoration: 'none',
                      fontWeight: 600
                    }}
                  >
                    <ExternalLink size={12} /> Abrir Drive
                  </a>
                )}
              </div>
              <input
                className="field-input"
                placeholder="https://drive.google.com/drive/folders/..."
                value={driveUrl}
                onChange={(e) => setDriveUrl(e.target.value)}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="field-label">URL da Planilha Oficial (SPREADSHEET_URL)</label>
                {spreadsheetUrl.trim() && (
                  <a
                    href={spreadsheetUrl.trim()}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      fontSize: 11.5,
                      color: '#34d399',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      textDecoration: 'none',
                      fontWeight: 600
                    }}
                  >
                    <ExternalLink size={12} /> Abrir Planilha
                  </a>
                )}
              </div>
              <input
                className="field-input"
                placeholder="https://docs.google.com/spreadsheets/d/..."
                value={spreadsheetUrl}
                onChange={(e) => setSpreadsheetUrl(e.target.value)}
              />
            </div>

            <div>
              <label className="field-label">URL do Bridge Apps Script / Telegram (WEBAPP_URL)</label>
              <input
                className="field-input"
                placeholder="https://script.google.com/macros/s/.../exec"
                value={webappUrl}
                onChange={(e) => setWebappUrl(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5, color: '#cbd5e1' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={permitirEstoqueNegativo}
                  onChange={(e) => setPermitirEstoqueNegativo(e.target.checked)}
                />
                <span>Permitir Venda com Estoque Negativo</span>
              </label>

              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                  />
                  <span>Auto-Refresh do Painel</span>
                </label>

                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Intervalo (min):</span>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    className="field-input"
                    style={{ width: 72, padding: '4px 8px', fontSize: 12 }}
                    value={intervaloRefreshMin}
                    onChange={(e) => setIntervaloRefreshMin(e.target.value)}
                    disabled={!autoRefresh}
                  />
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={backupAuto}
                  onChange={(e) => setBackupAuto(e.target.checked)}
                />
                <span>Backup Automático</span>
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={busy}>
              <Save size={15} /> Salvar Dados da Unidade
            </button>
            <button
              type="button"
              className="btn btn-success"
              onClick={handleSincronizarBridgeAgora}
              disabled={busy}
            >
              <RefreshCw size={14} /> 🔄 Sincronizar Planilha ↔ Supabase Agora
            </button>
            <button type="button" className="btn" onClick={handleTestarTelegram} disabled={busy}>
              <Send size={14} color="#38bdf8" /> Testar Envio Telegram
            </button>
          </div>
        </form>
      </div>

      {/* 2. BANCO DE DADOS SUPABASE (CAMINHO A - CÓDIGO PROTEGIDO - EXCLUSIVO ADMIN) */}
      {isAdmin && (
        <div className="panel-card">
          <h3 style={{ fontSize: 16, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Database size={16} color="#34d399" />
            <span>Banco de Dados SaaS (Supabase Multi-Tenant)</span>
          </h3>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.45 }}>
            Toda a inteligência e regras ficam protegidas no seu aplicativo e PostgreSQL. Use apenas a URL e a{' '}
            <strong>Anon Key pública</strong>.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label className="field-label">Project URL</label>
              <input
                className="field-input"
                placeholder="https://xxxxx.supabase.co"
                value={supaUrl}
                onChange={(e) => setSupaUrl(e.target.value)}
              />
            </div>
            <div>
              <label className="field-label">Anon Public Key</label>
              <input
                type="password"
                className="field-input"
                placeholder="eyJ..."
                value={supaKey}
                onChange={(e) => setSupaKey(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <button type="button" className="btn btn-success" onClick={handleSalvarETestarSupabase} disabled={busy}>
                Testar & Salvar Conexão
              </button>
              <button type="button" className="btn" onClick={handleCopiarSchemaSql}>
                <Copy size={14} /> Copiar Schema SQL v2
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. EXPANSÃO DE REDE: NOVA FILIAL / NOVA EMPRESA */}
      {isDonoOuAdmin && (
        <div className="panel-card">
          <h3 style={{ fontSize: 16, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Building size={16} color="#c4b5fd" />
            <span>{isAdmin ? 'Criar Nova Filial ou Nova Empresa' : 'Expansão de Rede — Nova Filial'}</span>
          </h3>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.45 }}>
            {isAdmin
              ? 'Filial mantém seu acesso de Dono e libera o Seletor de Unidades no Dashboard. Nova Empresa abre ambiente isolado com tela de Boas-Vindas para o cliente criar o próprio Dono.'
              : 'Crie uma nova filial vinculada ao seu painel (mesmo login e senha). O Seletor de Unidades aparecerá automaticamente no topo.'}
          </p>

          <form onSubmit={handleCriarUnidade} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {isAdmin && (
              <div>
                <label className="field-label">Tipo de Replicação</label>
                <select
                  className="field-select"
                  value={tipoUnidade}
                  onChange={(e) => setTipoUnidade(e.target.value as 'FILIAL' | 'NOVA_EMPRESA')}
                >
                  <option value="FILIAL">Nova Filial (mesma rede, mesmo Dono, aparece no seletor)</option>
                  <option value="NOVA_EMPRESA">Nova Empresa (ambiente isolado, Boas-Vindas no 1º acesso)</option>
                </select>
              </div>
            )}

            <div>
              <label className="field-label">Nome da Unidade / Empresa *</label>
              <input
                className="field-input"
                placeholder="Ex: Unidade Centro - Filial 2"
                value={nomeNovaUnidade}
                onChange={(e) => setNomeNovaUnidade(e.target.value)}
                required
              />
            </div>

            {(!isAdmin || tipoUnidade === 'FILIAL') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5, color: '#cbd5e1' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={copiarProdutos}
                    onChange={(e) => setCopiarProdutos(e.target.checked)}
                  />
                  <span>Copiar catálogo de produtos (com estoque zerado)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={copiarClientes}
                    onChange={(e) => setCopiarClientes(e.target.checked)}
                  />
                  <span>Copiar base de clientes da Matriz</span>
                </label>
              </div>
            )}

            <button type="submit" className="btn btn-primary" disabled={busy}>
              <Building size={15} />{' '}
              {!isAdmin || tipoUnidade === 'FILIAL' ? 'Criar Nova Filial' : 'Criar Nova Empresa'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
