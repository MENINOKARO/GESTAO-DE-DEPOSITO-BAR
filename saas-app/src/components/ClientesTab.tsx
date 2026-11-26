import { useMemo, useState, type FormEvent } from 'react';
import {
  Ban,
  CheckCircle2,
  CreditCard,
  MessageCircle,
  Pencil,
  Search,
  UserPlus,
  Users,
  X
} from 'lucide-react';
import {
  alternarStatusCliente,
  cadastrarCliente,
  editarCliente
} from '../services/dataRepository';
import type { Cliente, PainelSnapshot, SessaoAtiva } from '../types/domain';
import { formatarMoeda, formatarTelefoneBr, formatarTextoInicialMaiuscula } from '../utils/formatters';

interface ClientesTabProps {
  sessao: SessaoAtiva;
  snapshot: PainelSnapshot;
  onNotify: (msg: string, tipo?: 'success' | 'error' | 'info' | 'warning') => void;
  onAtualizar: () => Promise<void>;
  onIrParaFiados?: () => void;
}

type FiltroClientes = 'TODOS' | 'ATIVOS' | 'COM_FIADO' | 'BLOQUEADOS';

export function ClientesTab({
  sessao,
  snapshot,
  onNotify,
  onAtualizar,
  onIrParaFiados
}: ClientesTabProps) {
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<FiltroClientes>('TODOS');
  const [busy, setBusy] = useState(false);

  // Modal Novo / Editar Cliente
  const [modalAberto, setModalAberto] = useState(false);
  const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null);
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [endereco, setEndereco] = useState('');
  const [limiteFiado, setLimiteFiado] = useState('');
  const [status, setStatus] = useState('ATIVO');
  const [observacao, setObservacao] = useState('');

  const clientesEnriquecidos = useMemo(() => {
    const fiadosPorCliente = new Map<string, number>();
    for (const cr of snapshot.contasReceber || []) {
      if (String(cr.status || '').toUpperCase() === 'PAGO') continue;
      const key = String(cr.cliente || '').trim().toLowerCase();
      if (!key) continue;
      fiadosPorCliente.set(key, Number(((fiadosPorCliente.get(key) || 0) + (Number(cr.valor) || 0)).toFixed(2)));
    }

    const comprasPorCliente = new Map<string, { qtd: number; total: number }>();
    const somarCompra = (nomeCli: string | undefined, valor: number) => {
      const key = String(nomeCli || '').trim().toLowerCase();
      if (!key) return;
      const atual = comprasPorCliente.get(key) || { qtd: 0, total: 0 };
      atual.qtd += 1;
      atual.total = Number((atual.total + (Number(valor) || 0)).toFixed(2));
      comprasPorCliente.set(key, atual);
    };

    const pedidosContados = new Set<string>();
    for (const v of snapshot.vendas || []) {
      if (v.pedido_id) {
        const pKey = `${v.origem}:${v.pedido_id}`;
        if (!pedidosContados.has(pKey)) {
          pedidosContados.add(pKey);
          somarCompra(v.cliente_nome, 0);
        }
        const key = String(v.cliente_nome || '').trim().toLowerCase();
        if (key) {
          const atual = comprasPorCliente.get(key) || { qtd: 0, total: 0 };
          atual.total = Number((atual.total + (Number(v.valor_total) || 0)).toFixed(2));
          comprasPorCliente.set(key, atual);
        }
      } else {
        somarCompra(v.cliente_nome, Number(v.valor_total) || 0);
      }
    }

    return (snapshot.clientes || []).map((c) => {
      const key = String(c.nome || '').trim().toLowerCase();
      const fiadoAberto = fiadosPorCliente.get(key) ?? Number(c.saldo_devedor || 0);
      const hist = comprasPorCliente.get(key) || { qtd: 0, total: 0 };
      const ativo = String(c.status || 'ATIVO').toUpperCase() === 'ATIVO';
      return {
        cliente: c,
        fiadoAberto,
        qtdPedidos: hist.qtd,
        totalGasto: hist.total,
        ativo
      };
    });
  }, [snapshot.clientes, snapshot.contasReceber, snapshot.vendas]);

  const kpis = useMemo(() => {
    let ativos = 0;
    let comFiado = 0;
    let totalFiado = 0;
    for (const item of clientesEnriquecidos) {
      if (item.ativo) ativos += 1;
      if (item.fiadoAberto > 0.01) {
        comFiado += 1;
        totalFiado += item.fiadoAberto;
      }
    }
    return {
      total: clientesEnriquecidos.length,
      ativos,
      comFiado,
      totalFiado
    };
  }, [clientesEnriquecidos]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return clientesEnriquecidos.filter((item) => {
      if (filtro === 'ATIVOS' && !item.ativo) return false;
      if (filtro === 'BLOQUEADOS' && item.ativo) return false;
      if (filtro === 'COM_FIADO' && !(item.fiadoAberto > 0.01)) return false;
      if (!q) return true;
      const c = item.cliente;
      return (
        String(c.nome || '').toLowerCase().includes(q) ||
        String(c.telefone || '').toLowerCase().includes(q) ||
        String(c.endereco || '').toLowerCase().includes(q) ||
        String(c.observacao || '').toLowerCase().includes(q)
      );
    });
  }, [clientesEnriquecidos, filtro, busca]);

  function abrirNovo() {
    setClienteEditando(null);
    setNome('');
    setTelefone('');
    setEndereco('');
    setLimiteFiado('');
    setStatus('ATIVO');
    setObservacao('');
    setModalAberto(true);
  }

  function abrirEditar(c: Cliente) {
    setClienteEditando(c);
    setNome(c.nome || '');
    setTelefone(c.telefone || '');
    setEndereco(c.endereco || '');
    setLimiteFiado(c.limite_fiado ? String(c.limite_fiado) : '');
    setStatus(c.status || 'ATIVO');
    setObservacao(c.observacao || '');
    setModalAberto(true);
  }

  async function handleSalvar(e: FormEvent) {
    e.preventDefault();
    if (!nome.trim()) {
      onNotify('Informe o nome do cliente.', 'warning');
      return;
    }
    setBusy(true);
    try {
      const limiteNum = Number(String(limiteFiado).replace(',', '.')) || 0;
      const res = clienteEditando
        ? await editarCliente(sessao, clienteEditando.id, {
            nome,
            telefone,
            endereco,
            limite_fiado: limiteNum,
            status,
            observacao
          })
        : await cadastrarCliente(sessao, {
            nome,
            telefone,
            endereco,
            limite_fiado: limiteNum,
            observacao
          });
      onNotify(res.msg, res.ok ? 'success' : 'error');
      if (res.ok) {
        setModalAberto(false);
        await onAtualizar();
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleAlternarStatus(c: Cliente) {
    setBusy(true);
    try {
      const res = await alternarStatusCliente(sessao, c);
      onNotify(res.msg, res.ok ? 'success' : 'error');
      if (res.ok) await onAtualizar();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="kpi-grid">
        <div className="kpi-card kpi-left-info">
          <div className="kpi-label">👥 Total de Clientes</div>
          <div className="kpi-value">{kpis.total}</div>
        </div>
        <div className="kpi-card kpi-left-ok">
          <div className="kpi-label">✅ Clientes Ativos</div>
          <div className="kpi-value" style={{ color: '#34d399' }}>
            {kpis.ativos}
          </div>
        </div>
        <div className="kpi-card kpi-left-warn">
          <div className="kpi-label">🧾 Clientes com Fiado</div>
          <div className="kpi-value" style={{ color: '#fbbf24' }}>
            {kpis.comFiado}
          </div>
        </div>
        <div className="kpi-card kpi-left-danger">
          <div className="kpi-label">💰 Total Fiado em Aberto</div>
          <div className="kpi-value" style={{ color: '#f87171' }}>
            {formatarMoeda(kpis.totalFiado)}
          </div>
        </div>
      </div>

      <div className="panel-card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
            {(
              [
                ['TODOS', `Todos (${kpis.total})`],
                ['ATIVOS', `Ativos (${kpis.ativos})`],
                ['COM_FIADO', `Com Fiado (${kpis.comFiado})`],
                ['BLOQUEADOS', 'Bloqueados']
              ] as [FiltroClientes, string][]
            ).map(([chave, rotulo]) => (
              <button
                key={chave}
                type="button"
                className={`btn ${filtro === chave ? 'btn-primary' : ''}`}
                style={{ padding: '6px 12px', fontSize: 12 }}
                onClick={() => setFiltro(chave)}
              >
                {rotulo}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <div style={{ position: 'relative', minWidth: 230 }}>
              <Search
                size={14}
                color="#94a3b8"
                style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                type="text"
                className="field-input"
                style={{ paddingLeft: 32 }}
                placeholder="Buscar nome, telefone, endereço..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>

            <button type="button" className="btn btn-primary" onClick={abrirNovo}>
              <UserPlus size={15} />
              <span>Novo Cliente</span>
            </button>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Contato &amp; Endereço</th>
                <th style={{ textAlign: 'right' }}>Histórico</th>
                <th style={{ textAlign: 'right' }}>Limite / Fiado</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 28, color: 'var(--text-muted)' }}>
                    Nenhum cliente encontrado para o filtro atual.
                  </td>
                </tr>
              ) : (
                filtrados.map(({ cliente: c, fiadoAberto, qtdPedidos, totalGasto, ativo }) => {
                  const foneLimpo = String(c.telefone || '').replace(/\D/g, '');
                  const zapLink = foneLimpo ? `https://wa.me/55${foneLimpo}` : '';
                  const acimaLimite = c.limite_fiado > 0 && fiadoAberto > c.limite_fiado;
                  return (
                    <tr key={c.id} style={!ativo ? { opacity: 0.68 } : undefined}>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{c.nome}</div>
                        {c.observacao && (
                          <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{c.observacao}</div>
                        )}
                      </td>
                      <td style={{ fontSize: 12.5 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>{c.telefone || '-'}</span>
                          {zapLink && (
                            <a
                              href={zapLink}
                              target="_blank"
                              rel="noreferrer"
                              title="Chamar no WhatsApp"
                              style={{ color: '#34d399', display: 'inline-flex' }}
                            >
                              <MessageCircle size={13} />
                            </a>
                          )}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                          {c.endereco || 'Sem endereço'}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontSize: 12.5 }}>
                        <div style={{ fontWeight: 700 }}>{formatarMoeda(totalGasto)}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {qtdPedidos} pedido(s)
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontSize: 12.5 }}>
                        <div
                          style={{
                            fontWeight: 800,
                            color: fiadoAberto > 0.01 ? (acimaLimite ? '#f87171' : '#fbbf24') : '#34d399'
                          }}
                        >
                          {fiadoAberto > 0.01 ? formatarMoeda(fiadoAberto) : 'Sem débito'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          Limite: {c.limite_fiado > 0 ? formatarMoeda(c.limite_fiado) : 'Livre'}
                        </div>
                      </td>
                      <td>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '3px 8px',
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 700,
                            background: ativo ? 'rgba(16,185,129,0.16)' : 'rgba(239,68,68,0.16)',
                            color: ativo ? '#34d399' : '#f87171',
                            border: `1px solid ${ativo ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)'}`
                          }}
                        >
                          {ativo ? <CheckCircle2 size={11} /> : <Ban size={11} />}
                          {ativo ? 'ATIVO' : 'BLOQUEADO'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          {fiadoAberto > 0.01 && onIrParaFiados && (
                            <button
                              type="button"
                              className="btn btn-xs"
                              onClick={onIrParaFiados}
                              title="Ver fiados em Contas a Receber"
                            >
                              <CreditCard size={12} /> Fiados
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-xs"
                            disabled={busy}
                            onClick={() => abrirEditar(c)}
                          >
                            <Pencil size={12} /> Editar
                          </button>
                          <button
                            type="button"
                            className={`btn btn-xs ${ativo ? 'btn-danger' : 'btn-success'}`}
                            disabled={busy}
                            onClick={() => handleAlternarStatus(c)}
                          >
                            {ativo ? 'Bloquear' : 'Ativar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalAberto && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2, 6, 23, 0.78)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            zIndex: 9999
          }}
        >
          <div className="panel-card" style={{ maxWidth: 500, width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 17, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Users size={18} color="#a78bfa" />
                <span>{clienteEditando ? 'Editar Cliente' : 'Novo Cliente'}</span>
              </h3>
              <button type="button" className="btn" style={{ padding: 6 }} onClick={() => setModalAberto(false)}>
                <X size={15} />
              </button>
            </div>

            <form style={{ display: 'flex', flexDirection: 'column', gap: 12 }} onSubmit={handleSalvar}>
              <div>
                <label className="field-label">Nome Completo *</label>
                <input
                  className="field-input"
                  required
                  value={nome}
                  onChange={(e) => setNome(formatarTextoInicialMaiuscula(e.target.value))}
                  placeholder="Ex.: João da Silva"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="field-label">Telefone / WhatsApp</label>
                  <input
                    className="field-input"
                    value={telefone}
                    onChange={(e) => setTelefone(formatarTelefoneBr(e.target.value))}
                    placeholder="(71) 99999-0000"
                  />
                </div>
                <div>
                  <label className="field-label">Limite Fiado (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="field-input"
                    value={limiteFiado}
                    onChange={(e) => setLimiteFiado(e.target.value)}
                    placeholder="0,00"
                  />
                </div>
              </div>

              <div>
                <label className="field-label">Endereço de Entrega</label>
                <input
                  className="field-input"
                  value={endereco}
                  onChange={(e) => setEndereco(formatarTextoInicialMaiuscula(e.target.value))}
                  placeholder="Rua, número, bairro, referência"
                />
              </div>

              {clienteEditando && (
                <div>
                  <label className="field-label">Status</label>
                  <select className="field-input" value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="ATIVO">ATIVO</option>
                    <option value="BLOQUEADO">BLOQUEADO</option>
                  </select>
                </div>
              )}

              <div>
                <label className="field-label">Observações</label>
                <textarea
                  className="field-input"
                  rows={2}
                  value={observacao}
                  onChange={(e) => setObservacao(e.target.value)}
                  placeholder="Preferências, ponto de referência, etc."
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <button type="button" className="btn" onClick={() => setModalAberto(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {busy ? 'Salvando...' : '💾 Salvar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
