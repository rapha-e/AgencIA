# AdMetrics & Growth AI

> **Plataforma SaaS de Growth Marketing com IA e Governança de Tráfego Pago**  
> *Conectando investimento publicitário a leads, clientes, receita e rentabilidade com aprovação explícita e cálculos determinísticos.*

---

## 🎯 Princípios Fundamentais Implementados

1. **Dados Reais Antes da IA**: Nenhum diagnóstico depende de métricas fictícias ou modelos geradores sem evidências.
2. **Cálculos Determinísticos**: CPA, ROAS, CAC, CTR, CPC e conversões calculados por código testável (`@admetrics/domain`), e não estimados por LLM.
3. **IA com Evidências Estruturadas**: Cada recomendação cita o problema, aponta métricas verificadas e respeita o contrato validado por esquema Zod (`@admetrics/ai`).
4. **Governança & Aprovação Explícita**: Nenhuma alteração em campanhas ou orçamentos é aplicada diretamente. A tríade de segurança é obrigatória: **Proposta Versionada $\rightarrow$ Aprovação Humana $\rightarrow$ Validação de Estado Remoto $\rightarrow$ Execução com Idempotência** (`@admetrics/execution`).
5. **Multi-Tenancy & Isolamento**: Estrutura hierárquica `organizations` (PME ou Agência) $\rightarrow$ `clients` (empresas geridas) $\rightarrow$ `ad_connections`, protegida por Row Level Security (RLS) no PostgreSQL do Supabase.

---

## 🏗️ Estrutura do Monorepo

```
admetrics-growth-ai/
├── apps/
│   ├── web/                   # Next.js 15 (App Router, Tailwind CSS, Dashboard, Central de Aprovação)
│   └── worker/                # Worker Node.js assíncrono para sincronização e jobs de governança
├── packages/
│   ├── domain/                # Entidades, métricas determinísticas, políticas de Hard Cap e schemas Zod
│   ├── integrations/          # Contrato AdsConnector e MockAdsConnector realista (Meta Ads e Google Ads)
│   ├── diagnostics/           # Motor de regras heurísticas determinísticas (anomalias de CPA, ROAS, CTR)
│   ├── ai/                    # Contratos de Growth Copilot, schemas de saída estruturados e fallbacks
│   └── execution/             # Máquina de estados de propostas e orquestrador de execução autorizada
├── supabase/
│   ├── migrations/            # Migrações SQL com tabelas multi-tenant e políticas RLS
│   └── seed.sql               # Dados sintéticos de teste para desenvolvimento local
├── .env.example
├── tsconfig.base.json
└── package.json
```

---

## 🚀 Como Executar Localmente

### 1. Pré-requisitos
* Node.js $\ge$ 20.x
* npm $\ge$ 10.x

### 2. Instalação de Dependências
```bash
npm install
```

### 3. Compilar todos os Pacotes
```bash
npm run build --workspaces
```

### 4. Executar os Testes Unitários
```bash
# Testar cálculos determinísticos e políticas de segurança
npm test --workspace=@admetrics/domain

# Testar o motor de diagnósticos heurísticos
npm test --workspace=@admetrics/diagnostics
```

### 5. Executar a Simulação do Worker Assíncrono
Simula o ciclo completo: Sincronização $\rightarrow$ Diagnóstico Heurístico $\rightarrow$ Recomendação de IA $\rightarrow$ Aprovação $\rightarrow$ Execução Autorizada com Idempotência.
```bash
node apps/worker/dist/index.js
```

### 6. Executar o Painel Web (Next.js)
```bash
npm run dev
# Acesse http://localhost:3000 no navegador
```
