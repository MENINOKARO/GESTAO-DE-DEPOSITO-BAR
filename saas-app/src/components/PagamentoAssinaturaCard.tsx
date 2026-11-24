import { type ChangeEvent, type FormEvent, useEffect, useState } from 'react';
import { CheckCircle2, Clock, Copy, CreditCard, ExternalLink, FileUp, Receipt, XCircle } from 'lucide-react';
import type { ComprovantePagamentoSaas, ConfigMasterSaas, PlanoSaas, SessaoAtiva } from '../types/domain';
import { enviarComprovantePagamentoEmpresa, listarComprovantesEmpresa } from '../services/dataRepository';
import { formatarDataBr, formatarMoeda } from '../utils/formatters';

interface PagamentoAssinaturaCardProps {
  sessao: SessaoAtiva;
  planoAtual: PlanoSaas;
  configMaster: ConfigMasterSaas | null;
  onNotify: (msg: string, tipo?: 'success' | 'error' | 'warning' | 'info') => void;
  onAtualizado?: () => Promise<void> | void;
}

function valorSugeridoPlano(plano: PlanoSaas, cfg: ConfigMasterSaas | null): number {
  if (!cfg) return plano === 'START' ? 89 : plano === 'ENTERPRISE' ? 269 : 169;
  if (plano === 'START') return Number(cfg.valor_start) || 89;
  if (plano === 'ENTERPRISE') return Number(cfg.valor_enterprise) || 269;
  return Number(cfg.valor_pro) || 169;
}

export function PagamentoAssinaturaCard({
  sessao,
  planoAtual,
  configMaster,
  onNotify,
  onAtualizado
}: PagamentoAssinaturaCardProps) {
  const formasDisponiveis =
    configMaster?.formas_pagamento_ativas && configMaster.formas_pagamento_ativas.length > 0
      ? configMaster.formas_pagamento_ativas
      : ['PIX', 'Cartão', 'Boleto', 'Transferência'];

  const [forma, setForma] = useState(formasDisponiveis[0] || 'PIX');
  const [valor, setValor] = useState(String(valorSugeridoPlano(planoAtual, configMaster)));
  const [referencia, setReferencia] = useState(new Date().toISOString().slice(0, 7));
  const [observacao, setObservacao] = useState('');
  const [anexoNome, setAnexoNome] = useState('');
  const [anexoDataUrl, setAnexoDataUrl] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [comprovantes, setComprovantes] = useState<ComprovantePagamentoSaas[]>([]);

  async function carregarComprovantes() {
    const lista = await listarComprovantesEmpresa(sessao);
    setComprovantes(lista);
  }

  useEffect(() => {
    setValor(String(valorSugeridoPlano(planoAtual, configMaster)));
  }, [planoAtual, configMaster]);

  useEffect(() => {
    void carregarComprovantes();
  }, [sessao.unidadeAtivaId]);

  function handleAnexo(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      onNotify('Arquivo muito grande. Envie imagem ou PDF de até 2 MB.', 'warning');
      return;
    }
    setAnexoNome(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      setAnexoDataUrl(result);
    };
    reader.readAsDataURL(file);
  }

  async function handleEnviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    try {
      const res = await enviarComprovantePagamentoEmpresa(sessao, {
        forma,
        valor: Number(String(valor).replace(',', '.')) || 0,
        referencia,
        observacao,
        anexo_nome: anexoNome,
        anexo_data_url: anexoDataUrl
      });
      onNotify(res.msg, res.ok ? 'success' : 'error');
      if (res.ok) {
        setObservacao('');
        setAnexoNome('');
        setAnexoDataUrl('');
        await carregarComprovantes();
        await onAtualizado?.();
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'left' }}>
      <div
        style={{
          padding: '10px 12px',
          borderRadius: 10,
          background: 'rgba(16, 185, 129, 0.08)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          fontSize: 12.5
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontWeight: 700, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 6 }}>
            <CreditCard size={14} color="#34d399" /> Formas de Pagamento ({planoAtual} — {formatarMoeda(valorSugeridoPlano(planoAtual, configMaster))})
          </span>
          {configMaster?.link_checkout_pix && (
            <a
              href={configMaster.link_checkout_pix}
              target="_blank"
              rel="noreferrer"
              className="btn btn-xs btn-success"
              style={{ textDecoration: 'none' }}
            >
              <ExternalLink size={12} /> Pagar Online
            </a>
          )}
        </div>

        {configMaster?.chave_pix_admin && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <span>
              Chave PIX: <code style={{ color: '#34d399' }}>{configMaster.chave_pix_admin}</code>
            </span>
            <button
              type="button"
              className="btn btn-xs"
              onClick={() => {
                void navigator.clipboard.writeText(configMaster.chave_pix_admin);
                onNotify('Chave PIX copiada!', 'success');
              }}
            >
              <Copy size={12} /> Copiar PIX
            </button>
          </div>
        )}

        {configMaster?.instrucoes_pagamento && (
          <div style={{ color: 'var(--text-muted)', whiteSpace: 'pre-line', fontSize: 12 }}>
            {configMaster.instrucoes_pagamento}
          </div>
        )}
      </div>

      <form
        onSubmit={handleEnviar}
        style={{
          padding: '10px 12px',
          borderRadius: 10,
          background: 'rgba(56, 189, 248, 0.07)',
          border: '1px solid rgba(56, 189, 248, 0.28)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8
        }}
      >
        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Receipt size={14} color="#38bdf8" /> Enviar Comprovante para Liberação pelo Master
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 120px', gap: 8 }}>
          <div>
            <label className="field-label">Forma de Pgto</label>
            <select className="field-select" value={forma} onChange={(e) => setForma(e.target.value)}>
              {formasDisponiveis.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Valor (R$)</label>
            <input className="field-input" value={valor} onChange={(e) => setValor(e.target.value)} required />
          </div>
          <div>
            <label className="field-label">Referência</label>
            <input type="month" className="field-input" value={referencia} onChange={(e) => setReferencia(e.target.value)} required />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'end' }}>
          <div>
            <label className="field-label">Observação / ID da Transação (opcional)</label>
            <input
              className="field-input"
              placeholder="Ex.: PIX enviado às 14:20"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
            />
          </div>
          <label className="btn" style={{ cursor: 'pointer', marginBottom: 0 }}>
            <FileUp size={14} /> {anexoNome ? anexoNome.slice(0, 18) : 'Anexar Comprovante'}
            <input type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={handleAnexo} />
          </label>
        </div>

        <button type="submit" className="btn btn-primary" disabled={enviando}>
          <CheckCircle2 size={14} /> {enviando ? 'Enviando...' : 'Enviar Comprovante para Aprovação'}
        </button>
      </form>

      {comprovantes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Últimos Comprovantes Enviados</div>
          {comprovantes.slice(0, 5).map((c) => (
            <div
              key={c.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8,
                padding: '7px 10px',
                borderRadius: 8,
                background: 'rgba(15, 23, 42, 0.5)',
                border: '1px solid rgba(148, 163, 184, 0.18)',
                fontSize: 12
              }}
            >
              <div>
                <strong>{c.forma}</strong> • {formatarMoeda(c.valor)} ({c.referencia})
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Enviado em {formatarDataBr(c.criado_em)}
                  {c.motivo_recusa ? ` • Motivo: ${c.motivo_recusa}` : ''}
                </div>
              </div>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 8px',
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 700,
                  background:
                    c.status === 'APROVADO'
                      ? 'rgba(16,185,129,0.18)'
                      : c.status === 'RECUSADO'
                      ? 'rgba(239,68,68,0.18)'
                      : 'rgba(245,158,11,0.18)',
                  color: c.status === 'APROVADO' ? '#34d399' : c.status === 'RECUSADO' ? '#f87171' : '#fbbf24'
                }}
              >
                {c.status === 'APROVADO' ? <CheckCircle2 size={12} /> : c.status === 'RECUSADO' ? <XCircle size={12} /> : <Clock size={12} />}
                {c.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
