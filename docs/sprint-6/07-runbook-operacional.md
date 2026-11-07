# 07 — Runbook Operacional e Guia de Troubleshooting (Sprint 6)

**Finalidade:** Orientar a equipe de engenharia e operações no diagnóstico e resolução de incidentes em ambiente de homologação e produção, priorizando ações não destrutivas.

---

## 1. Princípios Operacionais Fundamentais

1. **Nunca executar `DROP TABLE ... CASCADE` ou comandos `DELETE` sem cláusula `WHERE` explícita.**
2. **Nunca mascarar erros de banco de dados como sucesso ou valor zero.**
3. **Não ativar permissões de escrita em contas de anúncios em resposta a incidentes de leitura.**
4. **Preservar a integridade dos logs: nunca imprimir payloads sensíveis ou segredos.**

---

## 2. Diagnóstico e Resolução de Incidentes

### 2.1 Webhook Financeiro Rejeitando Assinatura (`INVALID_SIGNATURE`)
- **Sintoma:** Endpoint `/api/tracking/billing-webhook` retorna HTTP 403.
- **Diagnóstico:**
  1. Verificar se o segredo configurado no gateway coincide exatamente com a variável `BILLING_WEBHOOK_SECRET`.
  2. Verificar se o gateway envia a assinatura no formato bruto ou com prefixo `v1=`. A função `verifyWebhookSignature` suporta ambos, mas espaços extras no cabeçalho podem invalidar a comparação.
  3. Confirmar que o gateway está enviando a assinatura calculada sobre o **payload bruto** (raw body), e não sobre JSON reformatado.
- **Resolução:** Reconciliar o segredo no cofre de variáveis sem reiniciar o banco.

### 2.2 Token OAuth da Meta Expirado (Code 190 / `OAuthException`)
- **Sintoma:** Sincronização de métricas retorna falha de autenticação.
- **Diagnóstico:**
  1. Consultar a tabela `meta_connections` para verificar `expires_at` do token.
  2. Verificar os logs estruturados: o conector emite alerta seguro sem vazar o token.
- **Resolução:**
  1. O usuário gestor deve acessar `/integrations/meta/accounts` na interface do AdMetrics.
  2. Realizar nova autorização OAuth. O fluxo sobrescreve o token criptografado na tabela mantendo o vínculo de cliente e organização.

### 2.3 Taxa de Requisições Excedida no Tracking (`RATE_LIMIT_EXCEEDED`)
- **Sintoma:** Endpoints de tracking retornam HTTP 429.
- **Diagnóstico:**
  1. Verificar se o cliente configurou loop de retentativas sem backoff exponencial no frontend.
  2. Verificar se o volume de tráfego excede 120 req/min para aquela API key específica.
- **Resolução:**
  1. No cliente, agrupar chamadas ou aplicar debounce/throttle.
  2. Para clientes com alto volume contínuo, planejar alocação em cluster com Redis distribuído na Sprint 7.

### 2.4 Evento Não Persistido ou em Modo Simulado (`simulated_local`)
- **Sintoma:** Resposta do endpoint traz `persistence: "simulated_local"`.
- **Diagnóstico:**
  1. A tabela `tracking_events` ainda não foi criada no banco remoto porque as migrações `20261027000001` e `20261027000002` aguardam aplicação controlada.
  2. O endpoint mantém fallback não destrutivo de validação sem quebrar a integração do cliente piloto.
- **Resolução:**
  1. Seguir o roteiro oficial de aplicação descrito em `02-plano-migracao.md` no momento da janela de manutenção programada.
  2. Nunca forçar inserções manuais via SQL direto sem passar pelas triggers de auditoria.

---

## 3. Procedimento de Reconciliação Contábil

Para auditar e conciliar a receita apresentada no dashboard com os registros de pagamento:
1. Consultar `tracking_events` filtrando por `is_verified_origin = true` e `verified_value > 0`.
2. Comparar a soma com o relatório de extrato bancário/gateway do mesmo período.
3. Eventos com `is_verified_origin = false` devem ser exibidos apenas como "Receita Declarada de Marketing" e nunca compor o ROAS oficial auditado.
