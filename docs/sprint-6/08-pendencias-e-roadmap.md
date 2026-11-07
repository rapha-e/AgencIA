# 08 — Pendências, Checklist de Onboarding e Roadmap Pós-Homologação (Sprint 6)

**Data:** 27 de Outubro de 2026  
**Status Consolidado:** PRONTO PARA HOMOLOGAÇÃO CONTROLADA

---

## 1. Matriz de Pendências Técnicas e Operacionais

| Item | Prioridade | Risco | Dependência Externa | Critério Objetivo de Resolução |
|---|---|---|---|---|
| **1. Aplicação das Migrações no Supabase Remoto** | Alta | Médio (se executado com backup) | Janela de manutenção e aprovação explícita | Execução transacional de `20261027000001` e `20261027000002` com verificação pré e pós-migração sem erros. |
| **2. Integração com Gateway de Pagamento Real** | Alta | Médio | Definição comercial do gateway (Stripe, Asaas, etc.) e credenciais | Plugar adaptador específico implementando `BillingGatewayAdapter` e testar assinatura de webhook com chaves reais de homologação. |
| **3. Credenciais Reais da Meta Ads (App Review)** | Média | Baixo | Submissão e aprovação de escopos de leitura (`ads_read`, `read_insights`) na Meta | Conectar conta real de anúncios em modo de leitura e confirmar sincronização sem erros. |
| **4. Conector Google Ads em Produção** | Média | Baixo | Developer Token Google Ads aprovado | Completar pipeline de sincronização OAuth com Google Ads API oficial. |
| **5. Rate Limiting Distribuído (Redis)** | Baixa | Baixo | Cluster Redis / Upstash | Migrar Map em memória para Redis quando houver múltiplas instâncias em produção. |

---

## 2. Checklist de Onboarding

### 2.1 Checklist do Cliente-Piloto (TorxOS)
- [ ] Cadastro da Organização e Cliente TorxOS no AdMetrics.
- [ ] Criação e armazenamento seguro de API Key com escopo `events:write`.
- [ ] Inserção do snippet de tracking na landing page e app do TorxOS.
- [ ] Conexão da conta de anúncios da Meta em modo somente leitura.
- [ ] Validação de eventos de teste de aquisição (`lead_capture` e `free_trial_started`).
- [ ] Configuração do Webhook Financeiro no gateway com `BILLING_WEBHOOK_SECRET`.
- [ ] Revisão do plano de tração inicial gerado no Growth Studio.

### 2.2 Checklist Genérico para Novos Clientes (Multi-Produto)
1. **Configuração de Tenant:**
   - Criar Organização no AdMetrics com fuso horário e moeda canônica (`BRL`, `USD`, `EUR`).
   - Criar Cliente associado informando modelo de negócio (`b2b_saas`, `ecommerce`, `infoproduct`, `local_service`).
2. **Definição de Unit Economics:**
   - Preencher preço mensal, LTV estimado e Hard Cap de orçamento diário.
3. **Credenciamento e Rastreamento:**
   - Gerar API Key de ingestão para o cliente.
   - Instalar snippet de tracking determinístico e validar extração de UTMs.
4. **Governança:**
   - Vincular membros com papéis apropriados (`owner`, `manager`, `analyst`, `viewer`).

---

## 3. Roadmap de Evolução Pós-Homologação (Sprint 7 em diante)

1. **Sprint 7 — Multi-Versão de Growth Plans:**
   - Evolução da constraint `unique(client_id)` para suporte a histórico de versões arquivadas e comparação A/B de planos estratégicos.
2. **Sprint 7.1 — Adaptadores de Gateways Nativos:**
   - Implementação de adaptadores específicos prontos para uso: Stripe, Asaas, Kiwify, Hotmart e Iugu, utilizando a interface `BillingGatewayAdapter`.
3. **Sprint 8 — Automação Controlada de Propostas (Execução Remota Segura):**
   - Transição do modo simulado de execução para envio real de mutações autorizadas para a Meta Ads API após dupla aprovação humana.
4. **Sprint 8.1 — Observabilidade Avançada:**
   - Painel de métricas operacionais com latência de webhook, taxa de deduplicação e telemetria de falhas com OpenTelemetry / Sentry.
