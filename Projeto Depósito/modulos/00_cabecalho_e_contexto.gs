/*************************************************
 *       GESTÃO DE DEPÓSITO 
 *            VERSÃO 1.0
 *************************************************
  *
  * ===============================================
  * SISTEMA DE GESTÃO – KARO PRO v1.0
  * Status: ✅ ESTÁVEL 
  * Data de fechamento: 2026-02
  * Última atualização: Março 2026
  * ===============================================
  *
  * 📌 IMPORTANTE - LEIA PRIMEIRO:
  * ==============================
  * 📋 DOCUMENTAÇÃO (Abra estes arquivos):
  * ─────────────────────────────────────────────────
  * 1. RESUMO_AJUSTES_REALIZADOS.md       ← COMECE AQUI (visão geral)
  * 2. README_FUNCIONAMENTO_CORRIGIDO.md  ← Guia completo (manual operacional)
  * 3. ESTUDO_FUNCIONAMENTO_SISTEMA.md    ← Análise profunda (arquitetura)
  * 4. BUGS_ENCONTRADOS_E_CORRECOES.md    ← Detalhes técnicos (para devs)
  * 5. INDICE_DOCUMENTACAO.md             ← MAPA COMPLETO (você está aqui!)
  *
  * 🎯 COMPORTAMENTO ESPERADO 
  * ─────────────────────────────────────────────
  * 🍺 COMANDA BALCÃO:
  *    • Estoque baixa IMEDIATAMENTE
  *    • Cliente fica TRAVADO após 1º item
  *    • Pode continuar vendendo depois
  *    • Pagamento parcial funciona corretamente
  *    • ✅ NÃO gera falso erro "sem estoque" (chaves normalizadas)
  *
  * 📂 COMANDA ABERTA:
  *    • Itens históricos aparecem TRAVADOS (cinza)
  *    • Itens novos podem ser REMOVIDOS (colorido)
  *    • Saldo calcula: total - pagamentos parciais
  *    • Estoque validado ANTES de cada operação
  *    • ✅ Produtos com espaços/capitalização diferentes funcionam
  *
  * 🚚 DELIVERY:
  *    • Estoque NÃO baixa ao criar (PEDIDO FEITO)
  *    • Estoque BAIXA ao encaminhar (EM ANDAMENTO)
  *    • Cancelamento DEVOLVE estoque se foi encaminhado
  *    • Fiado BLOQUEADO (não permitido)
  *    • ✅ Todos os produtos aparecem no dropdown (não filtra por estoque)
  *
  * ===============================================
  */

