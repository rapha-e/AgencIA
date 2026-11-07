# 03 — Análise de Segurança, Modelo de Ameaças e Proteção de Dados (Sprint 6)

**Data:** 27 de Outubro de 2026  
**Classificação:** Confidencial / Engenharia de Segurança  
**Escopo:** AdMetrics & Growth AI — Arquitetura Multi-Tenant

---

## 1. Modelo de Ameaças e Superfícies de Ataque

O sistema possui três superfícies críticas de interação:
1. **API Pública de Ingestão de Marketing (`POST /api/tracking/events`):** Recebe eventos de conversão de frontends ou servidores de clientes.
2. **API de Faturamento e Webhook Financeiro (`POST /api/tracking/billing-webhook`):** Recebe notificações criptográficas de gateways de pagamento.
3. **Dashboard e APIs Internas (`/api/growth-plan`, `/api/metrics/summary`, etc.):** Manipula estratégias, permissões e contas de anúncios conectadas.

---

## 2. Ciclo de Vida e Segurança de API Keys

### 2.1 Hashing Criptográfico e Armazenamento
- Chaves de integração recebem o formato padronizado `admk_live_<random_bytes>`.
- O segredo completo **nunca é armazenado no banco em texto puro**. Apenas o hash `SHA-256` (`key_hash`) é persistido, permitindo busca em tempo constante e inviabilizando roubo de credenciais em caso de vazamento de dump.
- Apenas os primeiros 8 caracteres (`key_prefix`) são armazenados para visualização do usuário na interface.

### 2.2 Derivação Autoritativa no Servidor (Anti-Hijacking)
- A requisição é autenticada estritamente pelo header `Authorization: Bearer <key>` ou `X-Admetrics-Key: <key>`.
- O servidor extrai o `organization_id` e `client_id` associados à chave no banco.
- Se o payload contiver campos `organizationId` ou `clientId` conflitantes com os metadados da chave, a requisição é **imediatamente rejeitada com HTTP 403 (`TENANT_MISMATCH` / `CLIENT_MISMATCH`)**, impedindo que um cliente envie eventos em nome de outro.

### 2.3 Escopos Mínimos (Princípio do Menor Privilégio)
- `events:write`: Permite exclusivamente o envio de eventos de marketing (`lead_capture`, `free_trial_started`).
- Essa chave **NÃO** possui autorização para criar receitas confirmadas nem alterar configurações de contas de anúncios.

---

## 3. Pseudonimização de Dados Pessoais (LGPD / GDPR)

### 3.1 Algoritmo HMAC-SHA-256 com Pepper do Servidor
- Dados pessoais sensíveis (`email`, `phone`, `userId`) nunca são persistidos em formato original na tabela `tracking_events`.
- A função `pseudonimizeUserTraits` utiliza HMAC-SHA-256 parametrizado pelo segredo exclusivo do servidor (`PII_PEPPER_SECRET`).
- Esse mecanismo neutraliza ataques de dicionário e *rainbow tables* contra hashes triviais de e-mails.

### 3.2 Política de Fail-Secure em Produção
- Em ambiente de produção (`NODE_ENV === "production"`), a ausência da variável `PII_PEPPER_SECRET` resulta em interrupção imediata da operação com HTTP 500 (`SECURITY_CONFIG_ERROR`), **sem qualquer fallback para segredos padrão de desenvolvimento**.

### 3.3 Normalização Consistente
- E-mails são convertidos para minúsculas e têm espaços removidos antes do cálculo do HMAC, garantindo deduplicação determinística sem perda de integridade.

---

## 4. Rate Limiting e Limitações da Solução Atual

### 4.1 Implementação Local
- Em `apps/web/src/app/api/tracking/events/route.ts`, o rate limit é implementado com token bucket / janela deslizante em memória:
  - **Limite:** 120 requisições por minuto por hash de chave / IP.
  - **Status:** HTTP 429 (`RATE_LIMIT_EXCEEDED`).

### 4.2 Limitação em Produção Multi-Instância
- Um limitador em memória reside exclusivamente no processo Node.js local.
- Em ambientes escalados horizontalmente (múltiplos pods ou instâncias serverless Vercel/Cloud Run), o limite total efetivo é multiplicado pelo número de nós ativos.
- **Recomendação para Produção:** Integrar Redis / Upstash com algoritmo distribuído de Leaky Bucket quando a plataforma atingir escala comercial. Para a fase atual de homologação, o limitador em memória é seguro e satisfatório.

---

## 5. Isolamento Multi-Tenant e Governança RLS

### 5.1 Validação em Duas Camadas
- **Camada 1 (Aplicação / API):** As funções de autorização em `@admetrics/domain/src/authorization.ts` verificam papéis (`owner`, `admin`, `manager`, `analyst`, `viewer`) e bloqueiam o acesso cruzado entre organizações antes de atingir o banco.
- **Camada 2 (Banco de Dados / RLS):** Todas as tabelas sensíveis (`growth_plans`, `marketing_assets`, `client_api_keys`, `tracking_events`, `meta_connections`) possuem Row Level Security ativado e forçado (`FORCE ROW LEVEL SECURITY`).
- As políticas invocam `public.user_has_org_access(organization_id)`, que valida a pertinência do usuário na tabela `organization_members`.

### 5.2 Testes Negativos Aprovados
- A suíte de testes de isolamento multi-tenant (`packages/domain/src/authorization.test.ts`) valida:
  1. Bloqueio de usuário da Org Alpha tentando acessar Org Beta.
  2. Rejeição de tentativa de forjar `organization_id` arbitrário no payload.
  3. Bloqueio de papéis `viewer` e `analyst` em operações de aprovação financeira.
  4. Bloqueio de escalonamento indevido de privilégios (admin promovendo owner).

---

## 6. Higiene de Logs e Prevenção de Vazamentos

- Nenhuma credencial de API, token de acesso (OAuth da Meta/Google), assinatura bruta ou dado pessoal identificável é impresso em logs de depuração.
- Strings de conexão e segredos residem exclusivamente em variáveis de ambiente protegidas no servidor.
