# 09 — Modelo de Integridade Contábil, Estornos e ROAS Líquido (Sprint 6.2)

**Classificação:** Contabilidade Analítica & Engenharia Financeira  
**Escopo:** AdMetrics & Growth AI — Módulo de Faturamento Confiável e Atribuição

---

## 1. Princípios Contábeis Fundamentais

1. **Razão Imutável (Append-Only Ledger):** Eventos de pagamento confirmados nunca são sobrescritos ou apagados por um estorno posterior. O histórico contábil é estritamente acumulativo.
2. **Separação de Funil:**
   - **Eventos de Marketing:** Captura de leads, visitas e ativações de trial (`is_verified_origin = false`, `verified_value = 0.00`).
   - **Crédito de Receita:** Pagamentos confirmados por gateway com validação de assinatura criptográfica (`subscription_activated`, `verified_value > 0.00`).
   - **Débito de Ajuste:** Reembolsos parciais, integrais e disputas (`billing_refund`, `billing_chargeback`, `verified_value < 0.00`).
3. **Idempotência por Chave Composta:** A unicidade no PostgreSQL é garantida por `(client_id, event_id)`. O gateway pode reenviar o webhook múltiplas vezes sem risco de duplicar receitas ou débitos.

---

## 2. Taxonomia e Semântica de Eventos Financeiros

| Evento de Negócio | Status Gateway | `event_name` no Ledger | Efeito Contábil (`accountingType`) | Valor (`verified_value`) | Identificador (`event_id`) |
|---|---|---|---|---|---|
| **Pagamento Confirmado** | `CONFIRMED`, `PAID`, `RECEIVED` | `subscription_activated` | `CREDIT` | `+amount` (Positivo) | `billing_pay_<paymentId>` |
| **Reembolso Integral** | `REFUNDED` | `billing_refund` | `DEBIT` | `-amount` (Negativo integral) | `billing_ref_<eventId>` |
| **Reembolso Parcial** | `REFUNDED` (com `refundAmount`) | `billing_refund` | `DEBIT` | `-refundAmount` (Negativo parcial) | `billing_ref_<eventId>` |
| **Contestação / Disputa** | `DISPUTED` | `billing_chargeback` | `DEBIT` (Cautelar) | `-amount` (Negativo integral) | `billing_chg_<eventId>` |
| **Disputa Ganha / Revertida** | `DISPUTE_REVERSED` | `billing_dispute_reversed` | `CREDIT` (Restauração) | `+amount` (Positivo) | `billing_rev_<eventId>` |
| **Informativo / Não Pago** | `PENDING`, `FAILED`, `CANCELLED` | N/A | `NEUTRAL` | `0.00` (Sem alteração) | Retorno `IGNORED_UNCONFIRMED_STATUS` |

---

## 3. Fórmulas Oficiais de Receita e ROAS

### 3.1 Receita Bruta Confirmada
$$\text{Receita Bruta} = \sum \text{verified\_value} \quad \text{onde } \text{event\_name} = \text{'subscription\_activated'} \land \text{is\_verified\_origin} = \text{true}$$

### 3.2 Total de Estornos e Disputas
$$\text{Total Estornado} = \left| \sum \text{verified\_value} \right| \quad \text{onde } \text{event\_name} \in (\text{'billing\_refund'}, \text{'billing\_chargeback'}) \land \text{is\_verified\_origin} = \text{true}$$

### 3.3 Receita Líquida Auditada
$$\text{Receita Líquida} = \text{Receita Bruta} - \text{Total Estornado} = \sum \text{verified\_value} \quad \text{onde } \text{is\_verified\_origin} = \text{true}$$

### 3.4 ROAS Bruto vs ROAS Líquido
- **ROAS Bruto (Informativo de Tração):**
  $$\text{ROAS Bruto} = \frac{\text{Receita Bruta}}{\text{Investimento Publicitário (Spend)}}$$
- **ROAS Líquido (Auditado para Tomada de Decisão):**
  $$\text{ROAS Líquido} = \frac{\text{Receita Líquida}}{\text{Investimento Publicitário (Spend)}}$$

> **Decisão Arquitetural:** O AdMetrics utiliza o **ROAS Líquido** nos alertas heurísticos e diagnósticos orçamentários, evitando que campanhas com alto índice de estorno ou chargeback sejam erroneamente classificadas como lucrativas.

---

## 4. Requisitos de Integração para Gateways Candidatos

| Gateway | Protocolo de Assinatura | Identificador de Replay | Tratamento de Reembolso | Status de Sandbox |
|---|---|---|---|---|
| **Stripe** | HMAC-SHA-256 no header `Stripe-Signature` (`t=timestamp,v1=signature`) | Timestamp `t` no header com tolerância de 5 minutos | Eventos `charge.refunded` com objeto `refund` | Pendente de credenciais de teste |
| **Asaas** | Header estático `asaas-access-token` ou HMAC configurado | ID único do evento (`event`) | Evento `PAYMENT_REFUNDED` e `PAYMENT_CHARGEBACK_REQUESTED` | Pendente de token de sandbox |
| **Kiwify** | Token de assinatura no payload ou webhook secret HMAC | `order_id` + `webhook_event_id` | Evento `order_refunded` e `chargeback` | Pendente de credenciais de homologação |
| **Hotmart** | Header `X-HOTMART-HOTTOK` verificado no servidor | ID de transação (`hottok`) | Evento `PURCHASE_REFUNDED` e `PURCHASE_CHARGEBACK` | Pendente de chave de webhook |
