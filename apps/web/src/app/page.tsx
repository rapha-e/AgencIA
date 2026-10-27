"use client";

import React, { useState } from "react";
import {
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ShieldCheck,
  Zap,
  ArrowRight,
  Clock,
  Layers,
  BarChart3,
  RefreshCw,
  Info
} from "lucide-react";

interface ActionProposalItem {
  id: string;
  campaignName: string;
  actionType: string;
  currentValue: number;
  proposedValue: number;
  unit: string;
  reason: string;
  evidenceMetric: string;
  evidenceObserved: number;
  evidenceTarget: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  status: "pending" | "approved" | "rejected" | "succeeded";
  version: number;
}

export default function DashboardPage() {
  const [selectedChannel, setSelectedChannel] = useState<"all" | "meta" | "google">("all");
  const [isSyncing, setIsSyncing] = useState(false);

  // Estado interativo das propostas da Central de Aprovação
  const [proposals, setProposals] = useState<ActionProposalItem[]>([
    {
      id: "f0000000-0000-0000-0000-000000000001",
      campaignName: "Fundo de Funil - Leads Qualificados",
      actionType: "ADJUST_DAILY_BUDGET",
      currentValue: 280.0,
      proposedValue: 224.0,
      unit: "BRL",
      reason:
        "Redução preventiva de 20% no orçamento diário devido a CPA R$ 140,00 estar 180% acima da meta de R$ 50,00.",
      evidenceMetric: "CPA",
      evidenceObserved: 140.0,
      evidenceTarget: 50.0,
      riskLevel: "high",
      status: "pending",
      version: 1
    }
  ]);

  const handleApprove = (id: string) => {
    setProposals((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: "succeeded" } : p))
    );
  };

  const handleReject = (id: string) => {
    setProposals((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: "rejected" } : p))
    );
  };

  const handleSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 p-6 md:p-8 font-sans">
      {/* Top Header */}
      <header className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                AdMetrics & Growth AI
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  v1.0 MVP
                </span>
              </h1>
              <p className="text-xs md:text-sm text-slate-400">
                Sistema Operacional de Growth Marketing com Governança e IA
              </p>
            </div>
          </div>
        </div>

        {/* Client & Organization Context */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-slate-900/90 border border-slate-800 rounded-lg px-3.5 py-2 text-xs">
            <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">
              Cliente Selecionado
            </span>
            <span className="font-semibold text-slate-200">Alpha E-commerce B2B</span>
            <span className="text-slate-500 ml-1.5">(BRL · SP)</span>
          </div>

          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-slate-200 px-3.5 py-2 rounded-lg text-xs font-medium transition-all shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin text-blue-400" : ""}`} />
            {isSyncing ? "Sincronizando..." : "Sincronizar APIs"}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto mt-6 space-y-8">
        {/* Attribution & Notice banner */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 flex flex-col md:flex-row md:items-center justify-between text-xs text-slate-400 gap-3">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-400 shrink-0" />
            <span>
              <strong>Origem dos Dados:</strong> Meta Marketing API & Google Ads (Sincronização Oficial). Janela de Atribuição:{" "}
              <code className="text-slate-300 bg-slate-800/80 px-1 py-0.5 rounded">7d clique / 1d visualização</code>.
            </span>
          </div>
          <div className="flex items-center gap-2 text-emerald-400 shrink-0">
            <ShieldCheck className="w-4 h-4" />
            <span>Hard Cap Ativo: R$ 1.500,00/dia</span>
          </div>
        </div>

        {/* 1. KPI Cards (Determinísticos) */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-400" />
              Indicadores de Performance Consolidados (Últimos 14 Dias)
            </h2>
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-lg text-xs">
              <button
                onClick={() => setSelectedChannel("all")}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  selectedChannel === "all" ? "bg-blue-600 text-white font-medium" : "text-slate-400 hover:text-white"
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setSelectedChannel("meta")}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  selectedChannel === "meta" ? "bg-blue-600 text-white font-medium" : "text-slate-400 hover:text-white"
                }`}
              >
                Meta Ads
              </button>
              <button
                onClick={() => setSelectedChannel("google")}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  selectedChannel === "google" ? "bg-blue-600 text-white font-medium" : "text-slate-400 hover:text-white"
                }`}
              >
                Google Ads
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Card 1: Investimento */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm hover:border-slate-700 transition-all">
              <span className="text-xs text-slate-400 font-medium">Investimento Total</span>
              <div className="mt-2 text-2xl font-bold text-white tracking-tight">R$ 5.915,00</div>
              <div className="mt-1 text-xs text-slate-400 flex items-center gap-1">
                <span>154.200 impressões</span>
                <span>•</span>
                <span>5.120 cliques</span>
              </div>
            </div>

            {/* Card 2: Conversões & Leads */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm hover:border-slate-700 transition-all">
              <span className="text-xs text-slate-400 font-medium">Conversões / Leads</span>
              <div className="mt-2 text-2xl font-bold text-emerald-400 tracking-tight">154 leads</div>
              <div className="mt-1 text-xs text-slate-400">
                Taxa de Conv: <span className="text-slate-200 font-medium">3,01%</span>
              </div>
            </div>

            {/* Card 3: CPA Médio */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm hover:border-slate-700 transition-all">
              <span className="text-xs text-slate-400 font-medium">CPA Médio</span>
              <div className="mt-2 text-2xl font-bold text-white tracking-tight">R$ 38,41</div>
              <div className="mt-1 text-xs text-emerald-400 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Dentro da meta de R$ 50,00</span>
              </div>
            </div>

            {/* Card 4: ROAS Geral */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-sm hover:border-slate-700 transition-all">
              <span className="text-xs text-slate-400 font-medium">ROAS Atribuído</span>
              <div className="mt-2 text-2xl font-bold text-blue-400 tracking-tight">4,12x</div>
              <div className="mt-1 text-xs text-slate-400">
                Receita: <span className="text-slate-200 font-medium">R$ 24.370,00</span>
              </div>
            </div>
          </div>
        </section>

        {/* 2. Central de Aprovações (Governança e Human-in-the-Loop) */}
        <section className="bg-slate-900/70 border border-blue-900/40 rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/5 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-800 pb-4 mb-5">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-400" />
                Central de Aprovações (Ações Propostas pela IA)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Nenhuma alteração é aplicada diretamente sem revisão humana explícita e validação de estado remoto.
              </p>
            </div>
            <span className="self-start md:self-auto text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {proposals.filter((p) => p.status === "pending").length} pendente(s) de aprovação
            </span>
          </div>

          <div className="space-y-4">
            {proposals.map((proposal) => (
              <div
                key={proposal.id}
                className="bg-slate-950/70 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-all"
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="space-y-2 max-w-2xl">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 uppercase">
                        Risco {proposal.riskLevel}
                      </span>
                      <span className="text-xs font-semibold text-slate-300">
                        {proposal.campaignName}
                      </span>
                      <span className="text-xs text-slate-500">v{proposal.version}</span>
                    </div>

                    <p className="text-sm text-slate-200 font-medium">
                      {proposal.reason}
                    </p>

                    {/* Proposta Antes vs Depois */}
                    <div className="flex items-center gap-3 text-xs bg-slate-900 border border-slate-800 p-3 rounded-lg w-fit">
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase font-bold">Atual</span>
                        <span className="text-slate-300 font-semibold line-through">
                          R$ {proposal.currentValue.toFixed(2)} / dia
                        </span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-blue-400 shrink-0" />
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase font-bold">Proposto</span>
                        <span className="text-emerald-400 font-bold">
                          R$ {proposal.proposedValue.toFixed(2)} / dia
                        </span>
                      </div>
                    </div>

                    {/* Evidência Consultável */}
                    <div className="text-xs text-slate-400 flex items-center gap-2 pt-1">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span>
                        Evidência: {proposal.evidenceMetric} observado de{" "}
                        <strong className="text-rose-400">R$ {proposal.evidenceObserved.toFixed(2)}</strong>{" "}
                        contra meta de R$ {proposal.evidenceTarget.toFixed(2)}.
                      </span>
                    </div>
                  </div>

                  {/* Botões de Ação com Feedback */}
                  <div className="flex items-center gap-2.5 shrink-0 self-end md:self-center">
                    {proposal.status === "pending" ? (
                      <>
                        <button
                          onClick={() => handleReject(proposal.id)}
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
                        >
                          <XCircle className="w-4 h-4 text-slate-400" />
                          Rejeitar
                        </button>
                        <button
                          onClick={() => handleApprove(proposal.id)}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-600/20 transition-all"
                        >
                          <CheckCircle className="w-4 h-4 text-white" />
                          Aprovar e Executar
                        </button>
                      </>
                    ) : proposal.status === "succeeded" ? (
                      <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg text-xs font-semibold">
                        <CheckCircle className="w-4 h-4" />
                        Executado com Sucesso na API
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-slate-400 bg-slate-800 px-3 py-1.5 rounded-lg text-xs">
                        <XCircle className="w-4 h-4" />
                        Proposta Rejeitada
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 3. Diagnósticos Inteligentes Heurísticos */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Diagnósticos do Motor Heurístico
            </h2>
            <span className="text-xs text-slate-500">2 anomalias ativas detectadas</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 uppercase">
                  Severidade Alta
                </span>
                <span className="text-xs text-slate-500">Regra: CPA_ABOVE_TARGET</span>
              </div>
              <h3 className="text-base font-semibold text-white">
                CPA excessivamente alto (R$ 140,00 vs meta R$ 50,00)
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Campanha <em>Fundo de Funil - Leads Qualificados</em> teve 2 conversões para um investimento de R$ 280 nos últimos 7 dias.
              </p>
              <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-lg text-xs text-slate-400">
                <strong>Hipótese:</strong> Saturação de audiência no leilão ou desgaste da mensagem do anúncio.
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase">
                  Severidade Média
                </span>
                <span className="text-xs text-slate-500">Regra: ROAS_BELOW_TARGET</span>
              </div>
              <h3 className="text-base font-semibold text-white">
                Retorno sobre investimento abaixo da meta (0,89x vs meta 4,00x)
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                A campanha gerou R$ 250 em vendas para um gasto de R$ 280, resultando em margem deficitária momentânea.
              </p>
              <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-lg text-xs text-slate-400">
                <strong>Hipótese:</strong> Conversões de baixo ticket ou clientes que abandonaram o checkout no formulário final.
              </div>
            </div>
          </div>
        </section>

        {/* 4. Tabela de Campanhas Ativas */}
        <section className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="p-5 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-400" />
              Campanhas em Monitoramento Contínuo
            </h2>
            <span className="text-xs text-slate-500">3 campanhas ativas</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">Campanha</th>
                  <th className="py-3 px-4">Plataforma</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Orçamento / Dia</th>
                  <th className="py-3 px-4 text-right">Investimento</th>
                  <th className="py-3 px-4 text-right">Cliques</th>
                  <th className="py-3 px-4 text-right">CTR</th>
                  <th className="py-3 px-4 text-right">CPA</th>
                  <th className="py-3 px-4 text-right">ROAS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-slate-300">
                <tr className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3.5 px-4 font-medium text-white">
                    Topo de Funil - Vídeos & Alcance
                  </td>
                  <td className="py-3.5 px-4 text-blue-400 font-semibold">Meta Ads</td>
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center gap-1 text-emerald-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      ATIVA
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right font-medium">R$ 150,00</td>
                  <td className="py-3.5 px-4 text-right">R$ 1.950,00</td>
                  <td className="py-3.5 px-4 text-right">1.950</td>
                  <td className="py-3.5 px-4 text-right">3,00%</td>
                  <td className="py-3.5 px-4 text-right">R$ 18,75</td>
                  <td className="py-3.5 px-4 text-right font-semibold text-emerald-400">5,33x</td>
                </tr>

                <tr className="hover:bg-slate-800/40 transition-colors bg-rose-500/5">
                  <td className="py-3.5 px-4 font-medium text-white">
                    Fundo de Funil - Leads Qualificados
                  </td>
                  <td className="py-3.5 px-4 text-blue-400 font-semibold">Meta Ads</td>
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center gap-1 text-emerald-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      ATIVA
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right font-medium">R$ 280,00</td>
                  <td className="py-3.5 px-4 text-right">R$ 2.800,00</td>
                  <td className="py-3.5 px-4 text-right">2.100</td>
                  <td className="py-3.5 px-4 text-right">2,80%</td>
                  <td className="py-3.5 px-4 text-right font-semibold text-rose-400">R$ 140,00</td>
                  <td className="py-3.5 px-4 text-right font-semibold text-amber-400">0,89x</td>
                </tr>

                <tr className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3.5 px-4 font-medium text-white">
                    Remarketing - Visitantes 30D
                  </td>
                  <td className="py-3.5 px-4 text-blue-400 font-semibold">Meta Ads</td>
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center gap-1 text-emerald-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      ATIVA
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right font-medium">R$ 90,00</td>
                  <td className="py-3.5 px-4 text-right">R$ 1.165,00</td>
                  <td className="py-3.5 px-4 text-right">1.070</td>
                  <td className="py-3.5 px-4 text-right">4,32%</td>
                  <td className="py-3.5 px-4 text-right text-emerald-400 font-semibold">R$ 7,92</td>
                  <td className="py-3.5 px-4 text-right font-semibold text-emerald-400">16,47x</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto mt-12 pt-6 border-t border-slate-800/60 text-xs text-slate-500 flex flex-col md:flex-row items-center justify-between gap-3">
        <div>
          AdMetrics & Growth AI · Plataforma SaaS Multi-Tenant com IA e Governança de Tráfego Pago
        </div>
        <div className="flex items-center gap-4">
          <span>Ambiente: Local Development</span>
          <span>•</span>
          <span className="text-emerald-400">Audit Logs: Ativo</span>
        </div>
      </footer>
    </div>
  );
}
