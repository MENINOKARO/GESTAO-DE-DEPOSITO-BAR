import { useState, type FormEvent } from 'react';
import { CheckCircle2, Sparkles } from 'lucide-react';
import type { Empresa, SessaoAtiva } from '../types/domain';
import { salvarConfiguracoesEmpresa } from '../services/dataRepository';
import { formatarCidadeUf, formatarCpfCnpjBr, formatarTelefoneBr, formatarTextoInicialMaiuscula } from '../utils/formatters';

interface BoasVindasOnboardingProps {
  sessao: SessaoAtiva;
  empresa: Empresa;
  onNotify: (msg: string, tipo?: 'success' | 'error' | 'warning' | 'info') => void;
  onConcluido: () => Promise<void>;
}

export function BoasVindasOnboarding({
  sessao,
  empresa,
  onNotify,
  onConcluido
}: BoasVindasOnboardingProps) {
  const [donoNome, setDonoNome] = useState(empresa.dono_nome || sessao.usuario.nome || '');
  const [cnpj, setCnpj] = useState(empresa.cnpj || '');
  const [telefone, setTelefone] = useState(formatarTelefoneBr(empresa.telefone || ''));
  const [cidade, setCidade] = useState(empresa.cidade || '');
  const [chavePix, setChavePix] = useState(empresa.chave_pix || '');
  const [salvando, setSalvando] = useState(false);

  async function finalizar() {
    try {
      localStorage.removeItem(`gn360_boas_vindas_${sessao.unidadeAtivaId}`);
    } catch {
      // ignore
    }
    await onConcluido();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      const res = await salvarConfiguracoesEmpresa(sessao, {
        dono_nome: donoNome.trim(),
        cnpj: cnpj.trim(),
        telefone: telefone.trim(),
        cidade: cidade.trim(),
        chave_pix: chavePix.trim()
      });
      if (!res.ok) {
        onNotify(res.msg, 'error');
        return;
      }
      onNotify('Cadastro da empresa finalizado! Bom trabalho!', 'success');
      await finalizar();
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="app-shell" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="panel-card" style={{ maxWidth: 560, width: '100%', display: 'flex', flexDirection: 'column', gap: 14, borderColor: 'rgba(139,92,246,0.45)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Sparkles size={26} color="#a78bfa" />
          <div>
            <h2 style={{ fontSize: 20, margin: 0 }}>Bem-vindo ao MK Gestão de Negócios 360°!</h2>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Finalize os dados da empresa <strong>{empresa.nome}</strong> para começar.
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label className="field-label">Nome do Responsável / Dono *</label>
            <input className="field-input" required value={donoNome} onChange={(e) => setDonoNome(formatarTextoInicialMaiuscula(e.target.value))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label className="field-label">CNPJ / CPF</label>
              <input className="field-input" placeholder="00.000.000/0001-00" value={cnpj} onChange={(e) => setCnpj(formatarCpfCnpjBr(e.target.value))} />
            </div>
            <div>
              <label className="field-label">Telefone / WhatsApp *</label>
              <input className="field-input" required placeholder="(11) 99999-9999" value={telefone} onChange={(e) => setTelefone(formatarTelefoneBr(e.target.value))} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label className="field-label">Cidade / UF</label>
              <input className="field-input" placeholder="Ex.: Salvador / BA" value={cidade} onChange={(e) => setCidade(formatarCidadeUf(e.target.value))} />
            </div>
            <div>
              <label className="field-label">Chave PIX da Loja (para receber vendas)</label>
              <input className="field-input" placeholder="CNPJ, E-mail, Celular ou Aleatória" value={chavePix} onChange={(e) => setChavePix(e.target.value)} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 8 }}>
            <button type="button" className="btn" onClick={() => void finalizar()} disabled={salvando}>
              Completar Depois
            </button>
            <button type="submit" className="btn btn-primary" disabled={salvando}>
              <CheckCircle2 size={15} /> {salvando ? 'Salvando...' : 'Concluir Cadastro e Entrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
