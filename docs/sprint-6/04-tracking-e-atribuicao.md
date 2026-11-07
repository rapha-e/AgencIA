# 04 — Rastreamento de Conversões e Modelo de Atribuição (Sprint 6)

**Versão da API:** v1.0  
**Endpoint de Ingestão:** `POST /api/tracking/events`  
**Autenticação:** Header `Authorization: Bearer <api_key>` ou `X-Admetrics-Key: <api_key>`  
**Limite de Payload:** 32 KB

---

## 1. Catálogo Versionado de Eventos de Conversão

O sistema reconhece três eventos padronizados no funil de aquisição:

| Evento | Finalidade | Regra Contábil no Endpoint de Marketing |
|---|---|---|
| `lead_capture` | Cadastro inicial, download de material, captura de e-mail | Contabilizado para CPL (Custo por Lead). `verified_value = 0.00`. |
| `free_trial_started` | Início de período de testes ou demonstração | Contabilizado para taxa de ativação de trial. `verified_value = 0.00`. |
| `subscription_activated` | Contratação ou upgrade de plano pago | **NUNCA atribui receita pelo endpoint de marketing.** Registrado com `verified_value = 0.00` e `is_verified_origin = false`. Receita confiável é prerrogativa exclusiva do Webhook Financeiro. |

---

## 2. Contrato de Payload e Validação Zod

```typescript
{
  "eventId": string (1 a 128 chars),        // ID único do evento no cliente (deduplicação)
  "eventName": "lead_capture" | "free_trial_started" | "subscription_activated",
  "eventTimestamp": string (ISO-8601),       // Timestamp da conversão
  "utms": {                                  // Opcional: parâmetros observados
    "utm_source": string,
    "utm_medium": string,
    "utm_campaign": string,
    "utm_content": string,
    "utm_term": string
  },
  "pageUrl": string (URL válida até 2048 chars),
  "referrerUrl": string (URL válida até 2048 chars),
  "campaignId": string (até 128 chars),
  "userTraits": {                            // Identificadores submetidos a HMAC Pepper
    "userId": string,
    "email": string (formato de e-mail válido),
    "phone": string
  }
}
```

---

## 3. Modelo de Atribuição Determinística e Níveis de Confiança

A função `resolveAttributionChannel` classifica a origem do tráfego sem depender de suposições heurísticas não comprovadas:

| Canal Resolvido | Regra de Parâmetros UTM | Nível de Confiança |
|---|---|---|
| `meta_ads` | `utm_source` contém `meta`, `facebook` ou `instagram` | `EXACT_UTM` |
| `google_ads` | `utm_source` contém `google` E `utm_medium` contém `cpc`, `paid` ou `search` | `EXACT_UTM` |
| `organic_search` | `utm_source` contém `google` SEM indicação de mídia paga | `EXACT_UTM` |
| `whatsapp_direct` | `utm_source` ou `utm_medium` contém `whatsapp` | `EXACT_UTM` |
| `direct` | Ausência total de UTMs ou origem direta de navegação | `UNATTRIBUTED` |
| `unknown` | Origem não identificada nas regras acima | `UNATTRIBUTED` |

---

## 4. Janela Temporal e Prevenção de Dados Forjados

- **Validação de Futuro:** Eventos com timestamp no futuro em mais de 5 minutos são imediatamente rejeitados com HTTP 422 (`INVALID_TIMESTAMP_WINDOW`).
- **Validação de Retenção:** Eventos com mais de 30 dias de idade são rejeitados para evitar contaminação retroativa de períodos contábeis já consolidados.

---

## 5. Exemplo de Snippet de Integração (Cliente / Frontend)

Exemplo de implementação em JavaScript / TypeScript no site ou aplicação do cliente para envio seguro de eventos:

```javascript
// Exemplo de integração no frontend / backend do cliente
async function trackAdMetricsEvent(eventName, userTraits = {}) {
  const currentUrl = new URL(window.location.href);
  
  const payload = {
    eventId: "evt_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9),
    eventName: eventName,
    eventTimestamp: new Date().toISOString(),
    pageUrl: window.location.href,
    referrerUrl: document.referrer || undefined,
    utms: {
      utm_source: currentUrl.searchParams.get("utm_source") || undefined,
      utm_medium: currentUrl.searchParams.get("utm_medium") || undefined,
      utm_campaign: currentUrl.searchParams.get("utm_campaign") || undefined,
      utm_content: currentUrl.searchParams.get("utm_content") || undefined,
      utm_term: currentUrl.searchParams.get("utm_term") || undefined
    },
    userTraits: {
      email: userTraits.email || undefined,
      userId: userTraits.userId || undefined
    }
  };

  try {
    const response = await fetch("https://admetrics.app/api/tracking/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer admk_live_SUA_CHAVE_AQUI"
      },
      body: JSON.stringify(payload)
    });
    
    const result = await response.json();
    console.log("[AdMetrics] Evento registrado:", result);
  } catch (error) {
    console.error("[AdMetrics] Falha ao enviar evento:", error);
  }
}

// Disparo no clique ou cadastro
// trackAdMetricsEvent("lead_capture", { email: "lead@exemplo.com" });
```
