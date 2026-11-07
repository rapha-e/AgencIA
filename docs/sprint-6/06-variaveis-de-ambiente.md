# 06 — Catálogo de Variáveis de Ambiente e Segredos (Sprint 6)

**Aviso de Segurança:** Este documento define as variáveis necessárias para a execução do AdMetrics & Growth AI sem conter segredos ou senhas reais. Valores de produção devem ser injetados exclusivamente através do cofre de segredos da infraestrutura (Vercel Secrets, Doppler ou AWS Secrets Manager).

---

## 1. Variáveis de Autenticação e Banco de Dados (Supabase)

| Variável | Escopo | Ambiente | Obrigatória? | Finalidade |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Público (Browser & Server) | Todos | Sim | URL base da instância Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Público (Browser & Server) | Todos | Sim | Chave pública do Supabase com privilégios restritos por RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | Privado (Apenas Servidor) | Todos | Sim | Chave administrativa para operações do sistema e webhooks |

---

## 2. Variáveis de Criptografia, Segurança e LGPD

| Variável | Escopo | Ambiente | Obrigatória? | Finalidade |
|---|---|---|---|---|
| `PII_PEPPER_SECRET` | Privado (Apenas Servidor) | Homologação e Produção | **Sim (em Produção)** | Segredo exclusivo do servidor para HMAC-SHA-256 de identificadores pessoais (LGPD). Possui fail-secure estrito sem fallback em produção. |
| `BILLING_WEBHOOK_SECRET` | Privado (Apenas Servidor) | Homologação e Produção | **Sim (em Produção)** | Segredo compartilhado com gateway de pagamento para validação de assinatura HMAC dos webhooks financeiros. |
| `ENCRYPTION_MASTER_KEY` | Privado (Apenas Servidor) | Homologação e Produção | Sim | Chave de 32 bytes (hex) para criptografia AES-256-GCM de tokens de integração. |

---

## 3. Variáveis de Integração com Plataformas de Anúncios

| Variável | Escopo | Ambiente | Obrigatória? | Finalidade |
|---|---|---|---|---|
| `META_APP_ID` | Privado (Servidor) | Todos | Sim | ID do aplicativo registrado na Meta for Developers |
| `META_APP_SECRET` | Privado (Servidor) | Todos | Sim | Segredo do aplicativo Meta para troca de tokens OAuth |
| `NEXT_PUBLIC_APP_URL` | Público / Servidor | Todos | Sim | URL canônica da aplicação para callbacks OAuth e redirecionamentos |
| `GOOGLE_ADS_CLIENT_ID` | Privado (Servidor) | Produção | Não (em Homologação) | Client ID para autenticação Google Ads API |
| `GOOGLE_ADS_CLIENT_SECRET` | Privado (Servidor) | Produção | Não (em Homologação) | Client Secret da Google Ads API |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Privado (Servidor) | Produção | Não (em Homologação) | Token de desenvolvedor Google Ads |

---

## 4. Variáveis de Inteligência Artificial e Modelos

| Variável | Escopo | Ambiente | Obrigatória? | Finalidade |
|---|---|---|---|---|
| `GEMINI_API_KEY` | Privado (Servidor) | Todos | Opcional (possui gerador heurístico local) | Chave de acesso à API Gemini para geração de criativos de alta densidade no Growth Studio |

---

## 5. Diretrizes de Rotação de Segredos

1. **Rotação de `PII_PEPPER_SECRET`:** Deve ser planejada com antecedência, pois a alteração do pepper altera o hash determinístico dos identificadores de usuários e invalida a deduplicação retroativa de perfis anteriores.
2. **Rotação de `BILLING_WEBHOOK_SECRET`:** Pode ser realizada configurando o segredo simultaneamente no gateway e no cofre de variáveis de ambiente.
