import { useEffect, useState } from 'react';
import {
  BellRing,
  Building2,
  Clock,
  Cloud,
  FileSpreadsheet,
  Layers,
  LogOut,
  RefreshCw
} from 'lucide-react';
import type { SessaoAtiva, StatusSync } from '../types/domain';

interface HeaderProps {
  sessao: SessaoAtiva;
  nomeUnidadeAtiva: string;
  statusSync: StatusSync;
  sincronizando: boolean;
  obrigacoesPendentesCount: number;
  podeVerFinanceiro: boolean;
  isMasterAdminMode?: boolean;
  linkExternoPlanilhaOuDrive?: string;
  onTrocarUnidade: (unidadeId: string) => void;
  onSincronizar: () => void;
  onIrParaFinanceiro: () => void;
  onIrParaConfig: () => void;
  onSair: () => void;
}

export function Header({
  sessao,
  nomeUnidadeAtiva,
  statusSync,
  sincronizando,
  obrigacoesPendentesCount,
  podeVerFinanceiro,
  isMasterAdminMode = false,
  linkExternoPlanilhaOuDrive,
  onTrocarUnidade,
  onSincronizar,
  onIrParaFinanceiro,
  onIrParaConfig,
  onSair
}: HeaderProps) {
  const [horaAtual, setHoraAtual] = useState(() =>
    new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );

  useEffect(() => {
    const id = window.setInterval(() => {
      setHoraAtual(
        new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  // Regra estrita: o seletor SÓ aparece se houver pelo menos 1 filial cadastrada (e oculto no Master SaaS puro)
  const mostrarSeletorUnidade = !isMasterAdminMode && sessao.unidades.length > 1;
  const isVendedor = sessao.usuario.perfil === 'VENDEDOR';
  const linkPlanilhaDrive = isMasterAdminMode
    ? ''
    : linkExternoPlanilhaOuDrive || statusSync.planilhaEspelhoUrl || statusSync.drivePastaUrl;
  const driveAtivo = Boolean(linkPlanilhaDrive) || statusSync.driveConectado;

  return (
    <header className="app-header no-print">
      <div className="header-brand">
        <div className="header-logo">
          <Layers size={22} />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <strong className="brand-heading" style={{ fontSize: 18 }}>
              {nomeUnidadeAtiva || 'Gestão de Negócios'}
            </strong>
            <span className="badge badge-purple">PANORAMA 360°</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Terminal Executivo de Controle, Estoque &amp; PDV Inteligente
          </div>
        </div>
      </div>

      <div className="header-actions">
        {mostrarSeletorUnidade && (
          <div id="containerSeletorUnidade" className="unit-selector-box" title="Alternar Unidade / Filial">
            <Building2 size={15} color="#c4b5fd" />
            <select
              id="selectUnidadeAtiva"
              value={sessao.unidadeAtivaId}
              onChange={(e) => onTrocarUnidade(e.target.value)}
            >
              {sessao.unidades.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.ehMatriz ? `Matriz — ${u.nome}` : `Filial — ${u.nome}`}
                </option>
              ))}
            </select>
          </div>
        )}

        {podeVerFinanceiro && obrigacoesPendentesCount > 0 && (
          <button
            type="button"
            className="status-chip"
            onClick={onIrParaFinanceiro}
            title="Ver Obrigações a Pagar e Fiados a Receber"
            style={{
              cursor: 'pointer',
              background: 'rgba(239, 68, 68, 0.16)',
              borderColor: '#ef4444',
              color: '#fca5a5'
            }}
          >
            <BellRing size={13} color="#fca5a5" />
            <span>Obrigações ({obrigacoesPendentesCount})</span>
          </button>
        )}

        {!isVendedor && linkPlanilhaDrive && (
          <a
            href={linkPlanilhaDrive}
            target="_blank"
            rel="noreferrer"
            className="status-chip"
            style={{
              textDecoration: 'none',
              background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.9), rgba(4, 120, 87, 0.9))',
              borderColor: '#059669',
              color: '#ffffff'
            }}
            title={
              linkPlanilhaDrive.includes('docs.google.com/spreadsheets')
                ? 'Abrir Planilha Oficial Conectada'
                : 'Abrir Planilha / Pasta Drive'
            }
          >
            <FileSpreadsheet size={13} />
            <span>
              {linkPlanilhaDrive.includes('docs.google.com/spreadsheets')
                ? 'Abrir Planilha'
                : 'Abrir Planilha / Drive'}
            </span>
          </a>
        )}

        <div className="status-chip" title="Horário local ao vivo">
          <span className="pulse-dot" />
          <Clock size={13} color="#c4b5fd" />
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{horaAtual}</span>
        </div>

        {isVendedor ? (
          <div className="status-chip" title="Sistema conectado">
            <span className="status-dot ok" />
            <span>Conectado</span>
          </div>
        ) : (
          <>
            <button
              type="button"
              className="status-chip"
              onClick={onIrParaConfig}
              title="Status do Banco de Dados"
              style={{ cursor: 'pointer' }}
            >
              <span className={`status-dot ${statusSync.modoBanco === 'SUPABASE' ? 'ok' : 'warn'}`} />
              <span>{statusSync.modoBanco === 'SUPABASE' ? 'Supabase Ativo' : 'Local-First'}</span>
            </button>

            {!isMasterAdminMode && (
              <button
                type="button"
                className="status-chip"
                onClick={onIrParaConfig}
                title="Google Drive & Planilha Conectada"
                style={{ cursor: 'pointer' }}
              >
                <Cloud size={13} color={driveAtivo ? '#38bdf8' : '#94a3b8'} />
                <span>{driveAtivo ? 'Drive ON' : 'Drive OFF'}</span>
              </button>
            )}
          </>
        )}

        <div className="status-chip" style={{ borderColor: 'var(--border-accent)' }}>
          <strong style={{ color: '#f8fafc' }}>{sessao.usuario.nome}</strong>
          <span className="badge badge-purple" style={{ fontSize: 10 }}>
            {sessao.usuario.perfil}
          </span>
        </div>

        <button
          type="button"
          className="status-chip"
          onClick={onSincronizar}
          disabled={sincronizando}
          title={
            statusSync.ultimaSincronizacao
              ? `Sincronizar agora (última: ${statusSync.ultimaSincronizacao})`
              : 'Sincronizar dados do painel'
          }
          style={{
            cursor: sincronizando ? 'wait' : 'pointer',
            background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.88), rgba(3, 105, 161, 0.88))',
            borderColor: '#0284c7',
            color: '#ffffff'
          }}
        >
          <RefreshCw size={13} className={sincronizando ? 'spin-icon' : ''} />
          <span>{sincronizando ? 'Sincronizando...' : 'Sincronizar'}</span>
        </button>

        <button type="button" className="btn btn-danger" onClick={onSair} style={{ padding: '7px 12px' }}>
          <LogOut size={14} />
          <span>Sair</span>
        </button>
      </div>
    </header>
  );
}
