import { AlertTriangle, ArrowRight, Award, CreditCard, DollarSign, Package, ShieldAlert, ShoppingBag, TrendingUp } from 'lucide-react';
import type { PainelSnapshot } from '../types/domain';
import { formatarDataHoraBr, formatarMoeda } from '../utils/formatters';

interface DashboardTabProps {
  snapshot: PainelSnapshot;
  podeVerFinanceiro: boolean;
  onIrAba: (aba: string) => void;
  onIrParaObrigacoes?: () => void;
  onAbrirModalFiscal: () => void;
}

export function DashboardTab({
  snapshot,
  podeVerFinanceiro,
  onIrAba,
  onIrParaObrigacoes,
  onAbrirModalFiscal
}: DashboardTabProps) {
  const { kpis, vendas, produtos, contasPagar, ultimoFechamentoFiscal } = snapshot;
  const criticos = produtos.filter((p) => p.estoque_atual <= p.estoque_minimo);

  const hoje = new Date();
  const hojeYmd = hoje.toISOString().slice(0, 10);
  const ultimoDiaMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
  const diasRestantesMes = ultimoDiaMes - hoje.getDate();
  const isFimDeMes = diasRestantesMes <= 3;

  let diasSemFechamento = 999;
  if (ultimoFechamentoFiscal) {
    const dtUlt = new Date(ultimoFechamentoFiscal);
    if (!Number.isNaN(dtUlt.getTime())) {
      diasSemFechamento = Math.floor((hoje.getTime() - dtUlt.getTime()) / 86400000);
    }
  }

  const pagarVencidasOuHoje = contasPagar.filter(
    (c) =>
      c.status !== 'PAGO' &&
      !String(c.status || '').toUpperCase().includes('CANCEL') &&
      String(c.vencimento || '').slice(0, 10) <= hojeYmd
  );

  const alertaFiscalAtrasado = diasSemFechamento > 7 || isFimDeMes;
  const mostrarBannerFiscal =
    podeVerFinanceiro && (pagarVencidasOuHoje.length > 0 || alertaFiscalAtrasado);

  // Ranking Top 6 por quantidade (Giro Rápido — igual PainelDeposito360)
  const mapaRanking: Record<string, { nome: string; qtd: number; total: number }> = {};
  const mapaPagamentosHoje: Record<string, number> = {};
  let totalPagamentosHoje = 0;

  for (const v of vendas) {
    if (!mapaRanking[v.produto_nome]) {
      mapaRanking[v.produto_nome] = { nome: v.produto_nome, qtd: 0, total: 0 };
    }
    mapaRanking[v.produto_nome].qtd += Number(v.quantidade) || 0;
    mapaRanking[v.produto_nome].total += Number(v.valor_total) || 0;

    if (
      String(v.data_hora || '').startsWith(hojeYmd) &&
      String(v.forma_pagamento || '').toUpperCase().includes('FIADO')
    ) {
      const val = Number(v.valor_total) || 0;
      mapaPagamentosHoje['Fiado'] = (mapaPagamentosHoje['Fiado'] || 0) + val;
      totalPagamentosHoje += val;
    }
  }

  for (const cx of snapshot.caixa) {
    if (cx.tipo !== 'ENTRADA') continue;
    if (String(cx.forma_pagamento || '').toUpperCase() === 'CANCELADO') continue;
    if (String(cx.data_hora || '').startsWith(hojeYmd)) {
      const forma = cx.forma_pagamento || 'Outros';
      const val = Number(cx.valor) || 0;
      mapaPagamentosHoje[forma] = (mapaPagamentosHoje[forma] || 0) + val;
      totalPagamentosHoje += val;
    }
  }

  const topProdutos = Object.values(mapaRanking)
    .sort((a, b) => b.qtd - a.qtd)
    .slice(0, 6);

  const formasHojeOrdenadas = Object.entries(mapaPagamentosHoje).sort((a, b) => b[1] - a[1]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {mostrarBannerFiscal && (
        <div
          id="bannerAlertaFiscal"
          className="panel-card"
          style={{
            background: 'rgba(239, 68, 68, 0.14)',
            borderColor: 'rgba(239, 68, 68, 0.45)',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            padding: '14px 18px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <ShieldAlert size={24} color="#fca5a5" />
            <div>
              <strong style={{ fontSize: 14.5, display: 'block', color: '#ffffff' }}>
                {diasSemFechamento > 7
                  ? '⚠️ Atenção: Fechamento Fiscal Atrasado!'
                  : isFimDeMes
                  ? '📅 Alerta de Encerramento Mensal: Fechamento Fiscal'
                  : `⚠️ Atenção: ${pagarVencidasOuHoje.length} conta(s) a pagar vencida(s) ou vencendo hoje`}
              </strong>
              <span style={{ fontSize: 12.5, color: '#fecaca' }}>
                {diasSemFechamento > 7
                  ? `Último Fechamento Fiscal há ${diasSemFechamento >= 999 ? 'mais de 7' : diasSemFechamento} dias. `
                  : isFimDeMes
                  ? `Restam ${diasRestantesMes} dias para fechar o mês. `
                  : ''}
                {pagarVencidasOuHoje.length > 0 &&
                  `Obrigações vencidas/hoje: ${formatarMoeda(
                    pagarVencidasOuHoje.reduce((a, c) => a + (Number(c.valor) || 0), 0)
                  )}.`}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {pagarVencidasOuHoje.length > 0 && (
              <button
                type="button"
                className="btn"
                onClick={() => (onIrParaObrigacoes ? onIrParaObrigacoes() : onIrAba('financeiro'))}
              >
                Ver Obrigações
              </button>
            )}
            <button
              type="button"
              className="btn"
              style={{ background: '#ef4444', borderColor: '#dc2626', color: '#ffffff', fontWeight: 700 }}
              onClick={onAbrirModalFiscal}
            >
              📑 Fazer Fechamento Fiscal Agora
            </button>
          </div>
        </div>
      )}

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Faturamento Hoje</span>
            <TrendingUp size={15} color="#10b981" />
          </div>
          <div className="kpi-value" style={{ color: '#34d399' }}>
            {formatarMoeda(kpis.faturamentoDia)}
          </div>
          <div className="kpi-sub">{kpis.vendasHojeCount} venda(s) registrada(s) hoje</div>
        </div>

        {podeVerFinanceiro && (
          <>
            <div className="kpi-card">
              <div className="kpi-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Faturamento do Mês</span>
                <ShoppingBag size={15} color="#8b5cf6" />
              </div>
              <div className="kpi-value">{formatarMoeda(kpis.faturamentoMes)}</div>
              <div className="kpi-sub">Acumulado no mês corrente</div>
            </div>

            <div className="kpi-card">
              <div className="kpi-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Saldo do Caixa</span>
                <DollarSign size={15} color="#38bdf8" />
              </div>
              <div
                className="kpi-value"
                style={{ color: kpis.saldoCaixa < 0 ? '#f87171' : '#38bdf8' }}
              >
                {formatarMoeda(kpis.saldoCaixa)}
              </div>
              <div className="kpi-sub">Entradas menos saídas</div>
            </div>

            <div className="kpi-card">
              <div className="kpi-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Valor em Estoque</span>
                <Package size={15} color="#c4b5fd" />
              </div>
              <div className="kpi-value">{formatarMoeda(kpis.valorEstoqueVenda)}</div>
              <div className="kpi-sub">Custo: {formatarMoeda(kpis.valorEstoqueCusto)}</div>
            </div>
          </>
        )}

        <div className="kpi-card">
          <div className="kpi-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Alertas de Estoque</span>
            <AlertTriangle size={15} color="#f59e0b" />
          </div>
          <div className="kpi-value" style={{ color: kpis.produtosBaixoEstoque > 0 ? '#fbbf24' : '#34d399' }}>
            {kpis.produtosBaixoEstoque}
          </div>
          <div className="kpi-sub">Produtos no mínimo ou zerados</div>
        </div>
      </div>

      {/* RANKING & FORMAS DE PAGAMENTO HOJE (PANORAMA 360°) */}
      <div className="grid-2">
        <div className="panel-card">
          <h3 style={{ fontSize: 16, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Award size={17} color="#fbbf24" />
            <span>🏆 Mais Vendidos (Giro Rápido)</span>
          </h3>
          {topProdutos.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Sem vendas registradas ainda.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {topProdutos.map((item, idx) => {
                const maxQtd = topProdutos[0]?.qtd || 1;
                const pct = Math.min(100, Math.round((item.qtd / maxQtd) * 100));
                return (
                  <div key={item.nome}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                      <span>
                        <strong style={{ color: '#c4b5fd' }}>{idx + 1}º</strong> {item.nome}
                      </span>
                      <span>
                        <strong style={{ color: '#38bdf8' }}>{item.qtd} un</strong>{' '}
                        <span style={{ color: '#34d399', fontSize: 12 }}>({formatarMoeda(item.total)})</span>
                      </span>
                    </div>
                    <div style={{ height: 6, background: 'rgba(148,163,184,0.12)', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #7c3aed, #38bdf8)' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="panel-card">
          <h3 style={{ fontSize: 16, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <CreditCard size={17} color="#38bdf8" />
            <span>💳 Recebimentos Hoje por Forma de Pagamento</span>
          </h3>
          {formasHojeOrdenadas.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Sem recebimentos registrados hoje ainda.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {formasHojeOrdenadas.map(([forma, val]) => {
                const pct = totalPagamentosHoje > 0 ? Math.round((val / totalPagamentosHoje) * 100) : 0;
                return (
                  <div key={forma}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                      <span>
                        {forma} <span style={{ color: 'var(--text-muted)' }}>({pct}%)</span>
                      </span>
                      <strong style={{ color: '#34d399' }}>{formatarMoeda(val)}</strong>
                    </div>
                    <div style={{ height: 6, background: 'rgba(148,163,184,0.12)', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #10b981, #3b82f6)' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* FEED DE VENDAS RECENTES (6 COLUNAS) & ESTOQUE CRÍTICO */}
      <div className="grid-2">
        <div className="panel-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ fontSize: 16 }}>⚡ Feed de Vendas Recentes</h3>
            <button type="button" className="btn btn-primary" onClick={() => onIrAba('pdv')}>
              <span>Abrir PDV (F2)</span>
              <ArrowRight size={14} />
            </button>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Produto</th>
                  <th>Qtd</th>
                  <th>Valor</th>
                  <th>Pgto</th>
                  <th>Origem</th>
                </tr>
              </thead>
              <tbody>
                {vendas.slice(0, 10).map((v) => (
                  <tr key={v.id}>
                    <td>{formatarDataHoraBr(v.data_hora)}</td>
                    <td style={{ fontWeight: 600 }}>{v.produto_nome}</td>
                    <td>{v.quantidade}</td>
                    <td style={{ fontWeight: 700, color: '#34d399' }}>
                      {formatarMoeda(v.valor_total)}
                    </td>
                    <td>
                      <span className="badge badge-purple">{v.forma_pagamento}</span>
                    </td>
                    <td>{v.origem || 'Balcão'}</td>
                  </tr>
                ))}
                {vendas.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      Nenhuma venda registrada nesta unidade ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ fontSize: 16 }}>Reposição de Estoque &amp; Pendências</h3>
            {podeVerFinanceiro && (
              <button
                type="button"
                className="btn"
                onClick={() => (onIrParaObrigacoes ? onIrParaObrigacoes() : onIrAba('financeiro'))}
              >
                Ver Obrigações ({kpis.obrigacoesPendentesCount})
              </button>
            )}
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Atual</th>
                  <th>Mínimo</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {criticos.slice(0, 10).map((p) => (
                  <tr key={p.id}>
                    <td>{p.nome}</td>
                    <td style={{ fontWeight: 700 }}>{p.estoque_atual}</td>
                    <td>{p.estoque_minimo}</td>
                    <td>
                      <span className={`badge ${p.estoque_atual <= 0 ? 'badge-danger' : 'badge-warn'}`}>
                        {p.estoque_atual <= 0 ? 'ZERADO' : 'BAIXO'}
                      </span>
                    </td>
                  </tr>
                ))}
                {criticos.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', color: '#34d399' }}>
                      Todos os produtos estão acima do estoque mínimo.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
