import { useState, type FormEvent } from 'react';
import { UserPlus, X } from 'lucide-react';
import type { Cliente, SessaoAtiva } from '../types/domain';
import { cadastrarCliente } from '../services/dataRepository';
import { formatarTelefoneBr, formatarTextoInicialMaiuscula } from '../utils/formatters';

interface ClienteQuickModalProps {
  sessao: SessaoAtiva;
  aberto: boolean;
  onFechar: () => void;
  onCriado: (cliente: Cliente) => void;
  onNotify: (texto: string, tipo?: 'success' | 'error' | 'warning' | 'info') => void;
}

export function ClienteQuickModal({
  sessao,
  aberto,
  onFechar,
  onCriado,
  onNotify
}: ClienteQuickModalProps) {
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [endereco, setEndereco] = useState('');
  const [limiteFiado, setLimiteFiado] = useState('0');
  const [observacao, setObservacao] = useState('');
  const [busy, setBusy] = useState(false);

  if (!aberto) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    setBusy(true);
    try {
      const res = await cadastrarCliente(sessao, {
        nome,
        telefone,
        endereco,
        limite_fiado: parseFloat(limiteFiado) || 0,
        observacao
      });
      if (res.ok && res.cliente) {
        onNotify(res.msg, 'success');
        setNome('');
        setTelefone('');
        setEndereco('');
        setLimiteFiado('0');
        setObservacao('');
        onCriado(res.cliente);
        onFechar();
      } else {
        onNotify(res.msg, 'error');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(5, 8, 18, 0.78)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        zIndex: 80
      }}
    >
      <div className="panel-card" style={{ maxWidth: 460, width: '100%', borderColor: 'var(--border-accent)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ fontSize: 17, display: 'flex', alignItems: 'center', gap: 8 }}>
            <UserPlus size={18} color="#c4b5fd" />
            <span>Cadastrar Novo Cliente</span>
          </h3>
          <button type="button" className="btn" style={{ padding: 6 }} onClick={onFechar}>
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label className="field-label">Nome Completo *</label>
            <input className="field-input" placeholder="Ex: João da Silva" value={nome} onChange={(e) => setNome(formatarTextoInicialMaiuscula(e.target.value))} required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label className="field-label">Telefone / WhatsApp</label>
              <input className="field-input" placeholder="(11) 99999-0000" value={telefone} onChange={(e) => setTelefone(formatarTelefoneBr(e.target.value))} />
            </div>
            <div>
              <label className="field-label">Limite Fiado (R$)</label>
              <input type="number" step="0.01" className="field-input" value={limiteFiado} onChange={(e) => setLimiteFiado(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="field-label">Endereço</label>
            <input className="field-input" placeholder="Rua, número, bairro..." value={endereco} onChange={(e) => setEndereco(formatarTextoInicialMaiuscula(e.target.value))} />
          </div>
          <div>
            <label className="field-label">Observações</label>
            <input className="field-input" placeholder="Preferências ou referência" value={observacao} onChange={(e) => setObservacao(e.target.value)} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
            <button type="button" className="btn" onClick={onFechar}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-success" disabled={busy}>
              {busy ? 'Salvando...' : 'Salvar Cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
