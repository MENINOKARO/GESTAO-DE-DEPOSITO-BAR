import { useEffect, useState, type FormEvent } from 'react';
import {
  Building,
  Copy,
  Database,
  ExternalLink,
  FolderPlus,
  MessageCircle,
  Printer,
  QrCode,
  RefreshCw,
  Save,
  Send
} from 'lucide-react';
import QRCode from 'qrcode';
import type { ConfigMasterSaas, PainelSnapshot, SessaoAtiva, StatusSync } from '../types/domain';
import { criarNovaUnidade, obterConfigMasterSaasPublica, salvarConfiguracoesEmpresa } from '../services/dataRepository';
import { PagamentoAssinaturaCard } from './PagamentoAssinaturaCard';
import { detectarChatIdTelegram, obterInfoBotTelegram, testarTelegramEmpresa } from '../services/telegramService';
import {
  criarOuConectarInstanciaEvolution,
  enviarTesteWhatsAppEvolution,
  registrarWebhookTelegramBotPedidos
} from '../services/whatsappEvolutionService';
import { conectarGoogleDriveOAuth, getGoogleClientId, saveGoogleClientId } from '../services/googleDriveMirrorService';
import {
  conectarImpressoraBluetooth,
  conectarImpressoraSerialCom,
  desconectarImpressoraTermica,
  getAutoPrintDeliveryEmpresa,
  getLarguraTermicaEmpresa,
  getStatusImpressoraBluetooth,
  setAutoPrintDeliveryEmpresa,
  setLarguraTermicaEmpresa,
  testarImpressaoTermica,
  type LarguraBobinaTermica
} from '../services/thermalPrintService';
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
import { formatarCidadeUf, formatarCpfCnpjBr, formatarTelefoneBr, formatarTextoInicialMaiuscula } from '../utils/formatters';
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
  const [endereco, setEndereco] = useState(
    () => emp.endereco || localStorage.getItem(`gn360_empresa_endereco_${emp.id}`) || ''
  );
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
    setEndereco(emp.endereco || localStorage.getItem(`gn360_empresa_endereco_${emp.id}`) || '');
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
  const [qrTelegramDataUrl, setQrTelegramDataUrl] = useState('');
  const [linkBotTelegram, setLinkBotTelegram] = useState('');
  const [googleClientId, setGoogleClientId] = useState(() => getGoogleClientId());
  const [larguraTermica, setLarguraTermica] = useState<LarguraBobinaTermica>(() => getLarguraTermicaEmpresa(emp.id));
  const [autoPrintDelivery, setAutoPrintDelivery] = useState<boolean>(() => getAutoPrintDeliveryEmpresa(emp.id));
  const [evoUrl, setEvoUrl] = useState(() => localStorage.getItem(`gn360_evo_url_${emp.id}`) || '');
  const [evoInstance, setEvoInstance] = useState(() => localStorage.getItem(`gn360_evo_inst_${emp.id}`) || `mk-${emp.id.slice(-6).toLowerCase()}`);
  const [evoApiKey, setEvoApiKey] = useState(() => localStorage.getItem(`gn360_evo_key_${emp.id}`) || '');
  const [evoQrBase64, setEvoQrBase64] = useState('');
  const [evoConectado, setEvoConectado] = useState(false);

  useEffect(() => {
    void obterConfigMasterSaasPublica(sessao).then((cfg) => {
      setConfigMasterPublica(cfg);
      if (!evoUrl && cfg.evolution_api_url) setEvoUrl(cfg.evolution_api_url);
      if (!evoApiKey && cfg.evolution_api_key) setEvoApiKey(cfg.evolution_api_key);
    });
  }, [sessao]);

  async function handleConectarWhatsAppEvolution() {
    localStorage.setItem(`gn360_evo_url_${emp.id}`, evoUrl.trim());
    localStorage.setItem(`gn360_evo_inst_${emp.id}`, evoInstance.trim());
    localStorage.setItem(`gn360_evo_key_${emp.id}`, evoApiKey.trim());
    setBusy(true);
    try {
      const res = await criarOuConectarInstanciaEvolution(
        { url: evoUrl, instance: evoInstance, apiKey: evoApiKey },
        emp.id
      );
      setEvoConectado(Boolean(res.conectado));
      setEvoQrBase64(res.qrcodeBase64 || '');
      onNotify(res.msg, res.ok ? 'success' : 'warning');
    } finally {
      setBusy(false);
    }
  }

  async function handleTestarWhatsAppEvolution() {
    if (!telefone.trim()) {
      onNotify('Preencha o Telefone / WhatsApp da empresa acima para receber a mensagem de teste.', 'warning');
      return;
    }
    setBusy(true);
    try {
      const res = await enviarTesteWhatsAppEvolution(
        { url: evoUrl, instance: evoInstance, apiKey: evoApiKey },
        telefone,
        emp.nome
      );
      onNotify(res.msg, res.ok ? 'success' : 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleAtivarBotPedidosTelegram() {
    setBusy(true);
    try {
      const res = await registrarWebhookTelegramBotPedidos(telegramToken, emp.id);
      onNotify(res.msg, res.ok ? 'success' : 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleGerarQrTelegram() {
    if (!telegramToken.trim()) {
      onNotify('Cole o Token do Bot Telegram primeiro (ou crie um no @BotFather).', 'warning');
      return;
    }
    setBusy(true);
    try {
      const info = await obterInfoBotTelegram(telegramToken);
      if (!info.ok || !info.username) {
        onNotify(info.msg || 'Token inválido.', 'error');
        return;
      }
      const url = `https://t.me/${info.username}?start=CONECTAR_${emp.id}`;
      const qr = await QRCode.toDataURL(url, { width: 180, margin: 1 });
      setLinkBotTelegram(url);
      setQrTelegramDataUrl(qr);
      onNotify(`QR Code gerado para @${info.username}! Leia no celular, aperte "Começar" e clique em Detectar ID.`, 'success');
    } finally {
      setBusy(false);
    }
  }

  async function handleDetectarChatId() {
    setBusy(true);
    try {
      const res = await detectarChatIdTelegram(telegramToken);
      if (res.ok && res.chatId) {
        setTelegramChatId(res.chatId);
        onNotify(res.msg, 'success');
      } else {
        onNotify(res.msg, 'warning');
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleConectarGoogleDriveDireto() {
    if (googleClientId.trim()) saveGoogleClientId(googleClientId.trim());
    setBusy(true);
    try {
      const res = await conectarGoogleDriveOAuth(emp.id, emp.nome);
      if (!res.ok || !res.meta) {
        onNotify(res.msg, 'warning');
        return;
      }
      setDriveUrl(res.meta.rootFolderUrl);
      setSpreadsheetUrl(res.meta.planilhaUrl);
      await salvarConfiguracoesEmpresa(
        sessao,
        {
          drive_folder_id: res.meta.rootFolderId,
          planilha_espelho_id: res.meta.planilhaId
        },
        {
          permitirEstoqueNegativo,
          autoRefresh,
          intervaloRefreshMin: Number(intervaloRefreshMin) || 5,
          driveUrl: res.meta.rootFolderUrl,
          spreadsheetUrl: res.meta.planilhaUrl,
          webappUrl
        }
      );
      await onRefreshSyncStatus();
      await onAtualizarDados();
      onNotify(res.msg, 'success');
      window.open(res.meta.rootFolderUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Erro ao conectar Google Drive.', 'error');
    } finally {
      setBusy(false);
    }
  }
  const [tipoUnidade, setTipoUnidade] = useState<'FILIAL' | 'NOVA_EMPRESA'>('FILIAL');
  const [nomeNovaUnidade, setNomeNovaUnidade] = useState('');
  const [copiarProdutos, setCopiarProdutos] = useState(true);
  const [copiarClientes, setCopiarClientes] = useState(false);

  const [busy, setBusy] = useState(false);

  async function handleSalvarEmpresa(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      try {
        localStorage.setItem(`gn360_empresa_endereco_${emp.id}`, endereco.trim());
      } catch {
        // ignore
      }
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
              <input className="field-input" value={donoNome} onChange={(e) => setDonoNome(formatarTextoInicialMaiuscula(e.target.value))} />
            </div>
            <div>
              <label className="field-label">CNPJ / CPF</label>
              <input className="field-input" placeholder="00.000.000/0001-00" value={cnpj} onChange={(e) => setCnpj(formatarCpfCnpjBr(e.target.value))} />
            </div>
            <div>
              <label className="field-label">Telefone / WhatsApp</label>
              <input className="field-input" placeholder="(11) 99999-9999" value={telefone} onChange={(e) => setTelefone(formatarTelefoneBr(e.target.value))} />
            </div>
            <div>
              <label className="field-label">Cidade / UF</label>
              <input className="field-input" placeholder="Ex.: Salvador / BA" value={cidade} onChange={(e) => setCidade(formatarCidadeUf(e.target.value))} />
            </div>
          </div>
          <div>
            <label className="field-label">Endereço Completo (Cabeçalho da Impressão)</label>
            <input
              className="field-input"
              placeholder="Ex.: Rua das Flores, 123 - Centro"
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
            />
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
              padding: '10px 12px',
              borderRadius: 10,
              background: 'rgba(56, 189, 248, 0.08)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8
            }}
          >
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <a
                href="https://t.me/BotFather"
                target="_blank"
                rel="noreferrer"
                className="btn btn-xs"
                style={{ textDecoration: 'none' }}
              >
                <ExternalLink size={12} /> Criar Bot no @BotFather
              </a>
              <button type="button" className="btn btn-xs btn-primary" disabled={busy} onClick={() => void handleGerarQrTelegram()}>
                <QrCode size={12} /> QR Code p/ Conectar
              </button>
              <button type="button" className="btn btn-xs btn-success" disabled={busy} onClick={() => void handleDetectarChatId()}>
                Detectar ID Automaticamente
              </button>
              <button type="button" className="btn btn-xs" disabled={busy} onClick={() => void handleAtivarBotPedidosTelegram()}>
                Ativar Bot Delivery (Telegram)
              </button>
            </div>
            {qrTelegramDataUrl && (
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', paddingTop: 4 }}>
                <img src={qrTelegramDataUrl} alt="QR Code Telegram" style={{ width: 120, height: 120, borderRadius: 8, background: '#fff', padding: 4 }} />
                <div style={{ fontSize: 12, color: '#cbd5e1', maxWidth: 280 }}>
                  <div>1. Aponte a câmera do celular para o QR Code (ou clique abaixo).</div>
                  <div>2. Aperte <strong>Começar (Start)</strong> no Telegram.</div>
                  <div>3. Clique em <strong>Detectar ID Automaticamente</strong>.</div>
                  {linkBotTelegram && (
                    <a href={linkBotTelegram} target="_blank" rel="noreferrer" style={{ color: '#38bdf8', display: 'inline-block', marginTop: 4 }}>
                      Abrir no Telegram
                    </a>
                  )}
                </div>
              </div>
            )}
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
            <div
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.28)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#a7f3d0' }}>
                  Google Drive &amp; Planilha Espelho em 1 Clique
                </span>
                <button type="button" className="btn btn-xs btn-success" disabled={busy} onClick={() => void handleConectarGoogleDriveDireto()}>
                  <FolderPlus size={13} /> Conectar Google e Criar Pasta/Planilha
                </button>
              </div>
              {!import.meta.env.VITE_GOOGLE_CLIENT_ID && (
                <input
                  className="field-input"
                  style={{ fontSize: 12 }}
                  placeholder="Google OAuth Client ID (se não configurado no .env)"
                  value={googleClientId}
                  onChange={(e) => setGoogleClientId(e.target.value)}
                />
              )}
            </div>

            <div
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.28)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#6ee7b7', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <MessageCircle size={14} /> WhatsApp Delivery Automático (Evolution API)
                  {evoConectado && <span style={{ color: '#34d399' }}>• Conectado</span>}
                </span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-xs btn-primary" disabled={busy} onClick={() => void handleConectarWhatsAppEvolution()}>
                    <QrCode size={12} /> Gerar QR Code WhatsApp
                  </button>
                  <button type="button" className="btn btn-xs btn-success" disabled={busy} onClick={() => void handleTestarWhatsAppEvolution()}>
                    <Send size={12} /> Testar WhatsApp
                  </button>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 8 }}>
                <input
                  className="field-input"
                  style={{ fontSize: 12 }}
                  placeholder="URL Evolution API (https://...)"
                  value={evoUrl}
                  onChange={(e) => setEvoUrl(e.target.value)}
                />
                <input
                  className="field-input"
                  style={{ fontSize: 12 }}
                  placeholder="Instância (ex.: mk-loja)"
                  value={evoInstance}
                  onChange={(e) => setEvoInstance(e.target.value)}
                />
                <input
                  type="password"
                  className="field-input"
                  style={{ fontSize: 12 }}
                  placeholder="API Key Evolution"
                  value={evoApiKey}
                  onChange={(e) => setEvoApiKey(e.target.value)}
                />
              </div>
              {evoQrBase64 && (
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', paddingTop: 4 }}>
                  <img
                    src={evoQrBase64.startsWith('data:') ? evoQrBase64 : `data:image/png;base64,${evoQrBase64}`}
                    alt="QR Code WhatsApp"
                    style={{ width: 140, height: 140, borderRadius: 8, background: '#fff', padding: 4 }}
                  />
                  <div style={{ fontSize: 12, color: '#cbd5e1', maxWidth: 260 }}>
                    Abra o <strong>WhatsApp</strong> no celular → <strong>Dispositivos Conectados</strong> → aponte para o QR Code para ativar o robô de pedidos!
                  </div>
                </div>
              )}
            </div>

            <div
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                background: 'rgba(139, 92, 246, 0.08)',
                border: '1px solid rgba(139, 92, 246, 0.28)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 10
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 700, color: '#ddd6fe', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Printer size={14} /> Impressora Térmica (Delivery &amp; Relatórios)
                {getStatusImpressoraBluetooth().conectada && (
                  <span style={{ color: '#34d399' }}>• {getStatusImpressoraBluetooth().nome}</span>
                )}
              </span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-xs btn-primary"
                  onClick={async () => {
                    const r = await conectarImpressoraBluetooth();
                    onNotify(r.msg, r.ok ? 'success' : 'warning');
                  }}
                >
                  Conectar Bluetooth
                </button>
                <button
                  type="button"
                  className="btn btn-xs"
                  onClick={async () => {
                    const r = await conectarImpressoraSerialCom();
                    onNotify(r.msg, r.ok ? 'success' : 'warning');
                  }}
                >
                  Porta COM (Serial)
                </button>
                <button
                  type="button"
                  className="btn btn-xs btn-success"
                  onClick={async () => {
                    const r = await testarImpressaoTermica({ ...emp, endereco }, larguraTermica);
                    onNotify(r.msg, r.ok ? 'success' : 'warning');
                  }}
                >
                  Testar Impressão
                </button>
                {getStatusImpressoraBluetooth().conectada && (
                  <button
                    type="button"
                    className="btn btn-xs btn-danger"
                    onClick={async () => {
                      await desconectarImpressoraTermica();
                      onNotify('Impressora térmica desconectada.', 'info');
                    }}
                  >
                    Desconectar
                  </button>
                )}
                <select
                  className="field-select"
                  style={{ padding: '4px 8px', fontSize: 12 }}
                  value={larguraTermica}
                  onChange={(e) => {
                    const v = e.target.value as LarguraBobinaTermica;
                    setLarguraTermica(v);
                    setLarguraTermicaEmpresa(emp.id, v);
                    onNotify(`Bobina térmica definida para ${v}.`, 'info');
                  }}
                >
                  <option value="80mm">Bobina 80mm</option>
                  <option value="58mm">Bobina 58mm</option>
                </select>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={autoPrintDelivery}
                    onChange={(e) => {
                      const v = e.target.checked;
                      setAutoPrintDelivery(v);
                      setAutoPrintDeliveryEmpresa(emp.id, v);
                    }}
                  />
                  <span>Auto-imprimir novos pedidos</span>
                </label>
              </div>
            </div>
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
