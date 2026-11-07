"use client";

import React, { useState, useEffect } from "react";
import {
  Sparkles,
  TrendingUp,
  Target,
  DollarSign,
  Video,
  Search,
  Layout,
  MessageCircle,
  Copy,
  Check,
  ExternalLink,
  Shield,
  Layers,
  ChevronRight,
  Info
} from "lucide-react";

interface GrowthStudioProps {
  organizationId: string;
  clientId: string;
  clientName: string;
}

export function GrowthStudio({ organizationId, clientId, clientName }: GrowthStudioProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<"unit_economics" | "reels" | "google_ads" | "landing_page" | "outbound">("unit_economics");

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadStudioData() {
      setLoading(true);
      setErrorMessage(null);
      try {
        const res = await fetch(`/api/growth-plan?organizationId=${organizationId}&clientId=${clientId}`);
        const json = await res.json();
        if (res.ok && json.success) {
          setData(json);
        } else {
          setErrorMessage(json.error || "Falha ao consultar banco de dados.");
        }
      } catch (err: any) {
        setErrorMessage(err.message || "Erro de conexão ao carregar estúdio.");
      } finally {
        setLoading(false);
      }
    }
    if (organizationId && clientId) {
      loadStudioData();
    }
  }, [organizationId, clientId]);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  if (loading) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center space-y-4">
        <Sparkles className="w-8 h-8 text-blue-400 animate-spin mx-auto" />
        <h3 className="text-sm font-semibold text-slate-200">Carregando Estúdio de Crescimento & Criativos...</h3>
        <p className="text-xs text-slate-500">Calculando economia unitária e gerando ativos ancorados em dores de mercado.</p>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="bg-red-950/40 border border-red-500/30 rounded-2xl p-6 text-center space-y-2">
        <div className="text-xs font-bold uppercase tracking-wider text-red-400">Falha de Banco de Dados</div>
        <p className="text-sm text-red-200">{errorMessage}</p>
        <p className="text-xs text-slate-400">Verifique os logs ou políticas RLS do Supabase.</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center text-slate-400 text-xs">
        Não foi possível carregar a estratégia deste cliente. Verifique se o cliente está selecionado corretamente.
      </div>
    );
  }

  const { plan, unitEconomics, assetPackage, trackingUrls } = data;

  return (
    <div className="space-y-6">
      {/* Header do Estúdio */}
      <div className="bg-gradient-to-r from-blue-900/30 via-slate-900/80 to-indigo-900/20 border border-blue-500/20 rounded-2xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-[11px] font-semibold tracking-wide uppercase">
                <Sparkles className="w-3.5 h-3.5" /> Estúdio Cold Start & Tração Inicial
              </span>
              {data.persistenceStatus === "persisted" && (
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium">
                  Persistido em Banco
                </span>
              )}
              {data.persistenceStatus === "no_records" && (
                <span className="text-[10px] bg-slate-500/10 text-slate-300 border border-slate-500/20 px-2 py-0.5 rounded-full font-medium">
                  Sem Registros Salvos (Calculado Dinamicamente)
                </span>
              )}
              {data.persistenceStatus === "simulated_in_memory" && (
                <span className="text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2 py-0.5 rounded-full font-medium" title="Aguardando execução da migration 20261027000001 no SQL Editor do Supabase">
                  Cálculo em Memória (Migration 0001 Pendente)
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              {plan.productName} — Estratégia de Aquisição
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              {plan.valueProposition}
            </p>
          </div>
          <div className="flex items-center gap-3 bg-slate-900/90 border border-slate-800 p-3 rounded-xl">
            <Shield className="w-4 h-4 text-emerald-400" />
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-bold block">Hard Cap Diário</span>
              <span className="text-xs font-bold text-emerald-400">R$ {unitEconomics.maxRecommendedDailySpend.toFixed(2)}/dia</span>
            </div>
          </div>
        </div>

        {/* Sub-navegação do Estúdio */}
        <div className="flex flex-wrap gap-2 mt-6 border-t border-slate-800/80 pt-4">
          {[
            { id: "unit_economics", label: "Unit Economics & Metas", icon: DollarSign },
            { id: "reels", label: "Roteiros de Reels (Meta)", icon: Video },
            { id: "google_ads", label: "Campanha Google Ads", icon: Search },
            { id: "landing_page", label: "Landing Page & Conversão", icon: Layout },
            { id: "outbound", label: "Outbound & WhatsApp (R$ 0)", icon: MessageCircle }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as any)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                    : "bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/50"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Conteúdo das Abas */}

      {/* ABA 1: UNIT ECONOMICS & METAS */}
      {activeSubTab === "unit_economics" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Mensalidade SaaS</span>
              <div className="text-xl font-extrabold text-white mt-1">R$ {plan.monthlyPrice.toFixed(2)}<span className="text-xs font-normal text-slate-400">/mês</span></div>
              <span className="text-[11px] text-slate-500 mt-1 block">Ticket inicial da assistência</span>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">LTV Estimado (10 Meses)</span>
              <div className="text-xl font-extrabold text-blue-400 mt-1">R$ {unitEconomics.estimatedLtv.toFixed(2)}</div>
              <span className="text-[11px] text-slate-500 mt-1 block">Receita total gerada por cliente</span>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">CAC Teto (Meta Máxima)</span>
              <div className="text-xl font-extrabold text-amber-400 mt-1">R$ {unitEconomics.targetCac.toFixed(2)}</div>
              <span className="text-[11px] text-slate-500 mt-1 block">20% do LTV (margem saudável)</span>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">CPL Alvo (No WhatsApp)</span>
              <div className="text-xl font-extrabold text-emerald-400 mt-1">R$ {unitEconomics.targetCpl.toFixed(2)}</div>
              <span className="text-[11px] text-slate-500 mt-1 block">Custo máximo por conversa/lead</span>
            </div>
          </div>

          {/* Dores Mapeadas & Posicionamento */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-400" /> Dores Mapeadas do Cliente Ideal (ICP)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {plan.painPoints.map((pain: string, i: number) => (
                <div key={i} className="bg-slate-800/40 border border-slate-800 p-3.5 rounded-lg text-xs text-slate-300 flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-rose-500/10 text-rose-400 font-bold flex items-center justify-center shrink-0 text-[10px]">
                    {i + 1}
                  </span>
                  <span>{pain}</span>
                </div>
              ))}
            </div>
            <div className="bg-blue-500/5 border border-blue-500/20 p-3.5 rounded-lg text-xs text-blue-300 flex items-center gap-2.5">
              <Info className="w-4 h-4 text-blue-400 shrink-0" />
              <span><strong>Diferencial Competitivo:</strong> {plan.mainDifferentiator}</span>
            </div>
          </div>

          {/* Links Rastreáveis com UTMs */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" /> Links Rastreáveis Prontos com UTMs (Para Anúncios)
            </h3>
            <div className="space-y-2">
              {Object.entries(trackingUrls).map(([key, url]: [string, any]) => (
                <div key={key} className="flex items-center justify-between bg-slate-950 border border-slate-800 p-2.5 rounded-lg text-xs">
                  <div className="flex items-center gap-2 overflow-hidden mr-3">
                    <span className="text-[10px] font-bold uppercase bg-slate-800 text-slate-400 px-2 py-0.5 rounded shrink-0">
                      {key.replace(/([A-Z])/g, " $1")}
                    </span>
                    <span className="text-slate-400 truncate font-mono text-[11px]">{url}</span>
                  </div>
                  <button
                    onClick={() => handleCopy(url, key)}
                    className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded text-[11px] font-medium transition-colors shrink-0"
                  >
                    {copiedKey === key ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedKey === key ? "Copiado!" : "Copiar"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ABA 2: ROTEIROS DE REELS */}
      {activeSubTab === "reels" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Roteiros validados com gancho forte nos 3 primeiros segundos, projetados para filmar na bancada da assistência.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {assetPackage.reelsScripts.map((script: any, idx: number) => (
              <div key={script.id} className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded">
                      Roteiro #{idx + 1} · {script.durationEstimateSeconds}s
                    </span>
                    <button
                      onClick={() => handleCopy(
                        `TÍTULO: ${script.title}\n\nGANCHO (0-3s): ${script.hook}\n\nDOR: ${script.pain}\n\nSOLUÇÃO: ${script.solution}\n\nCTA: ${script.cta}\n\nDIRETRIZES DE FILMAGEM:\n${script.visualDirections.join("\n")}`,
                        script.id
                      )}
                      className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white bg-slate-800 px-2.5 py-1 rounded transition-colors"
                    >
                      {copiedKey === script.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedKey === script.id ? "Copiado!" : "Copiar Roteiro"}
                    </button>
                  </div>

                  <h3 className="text-sm font-bold text-white">{script.title}</h3>

                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800/80 space-y-2 text-xs">
                    <div>
                      <strong className="text-amber-400 block text-[10px] uppercase">1. Gancho (Primeiros 3 segundos):</strong>
                      <p className="text-slate-200 mt-0.5 italic">"{script.hook}"</p>
                    </div>
                    <div>
                      <strong className="text-rose-400 block text-[10px] uppercase">2. A Dor da Bancada:</strong>
                      <p className="text-slate-300 mt-0.5">{script.pain}</p>
                    </div>
                    <div>
                      <strong className="text-emerald-400 block text-[10px] uppercase">3. A Solução:</strong>
                      <p className="text-slate-300 mt-0.5">{script.solution}</p>
                    </div>
                    <div>
                      <strong className="text-blue-400 block text-[10px] uppercase">4. Chamada para Ação:</strong>
                      <p className="text-slate-200 font-semibold mt-0.5">{script.cta}</p>
                    </div>
                  </div>

                  <div>
                    <strong className="text-[10px] uppercase text-slate-500 block mb-1">Como Gravar (Diretrizes Visuais):</strong>
                    <ul className="space-y-1">
                      {script.visualDirections.map((dir: string, dIdx: number) => (
                        <li key={dIdx} className="text-[11px] text-slate-400 flex items-start gap-1.5">
                          <ChevronRight className="w-3 h-3 text-blue-400 shrink-0 mt-0.5" />
                          <span>{dir}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ABA 3: CAMPANHA GOOGLE ADS */}
      {activeSubTab === "google_ads" && (
        <div className="space-y-4">
          <p className="text-xs text-slate-400">
            Grupo de anúncios pronto para copiar e colar na Rede de Pesquisa do Google Ads. Palavras de alta intenção com títulos ($\le$ 30 caracteres) e descrições ($\le$ 90 caracteres) já validados.
          </p>

          {assetPackage.googleSearchCampaign.map((adGroup: any, i: number) => (
            <div key={i} className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-500">Grupo de Anúncios</span>
                  <h3 className="text-sm font-bold text-white">{adGroup.adGroupName}</h3>
                </div>
                <button
                  onClick={() => handleCopy(
                    `PALAVRAS-CHAVE:\n${adGroup.keywords.map((k: any) => k.keyword).join("\n")}\n\nTÍTULOS:\n${adGroup.headlines.join("\n")}\n\nDESCRIÇÕES:\n${adGroup.descriptions.join("\n")}`,
                    `adgroup_${i}`
                  )}
                  className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded text-xs transition-colors"
                >
                  {copiedKey === `adgroup_${i}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedKey === `adgroup_${i}` ? "Copiado!" : "Copiar Tudo"}
                </button>
              </div>

              {/* Palavras-Chave */}
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Palavras-Chave de Alta Intenção</span>
                <div className="flex flex-wrap gap-2">
                  {adGroup.keywords.map((kw: any, kIdx: number) => (
                    <span key={kIdx} className="bg-slate-950 border border-slate-800 px-2.5 py-1 rounded text-xs font-mono text-blue-300">
                      {kw.matchType === "EXACT" ? `[${kw.keyword}]` : `"${kw.keyword}"`}
                    </span>
                  ))}
                </div>
              </div>

              {/* Títulos e Descrições */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Títulos Validados (Máx. 30 chars)</span>
                  {adGroup.headlines.map((hl: string, hIdx: number) => (
                    <div key={hIdx} className="flex items-center justify-between bg-slate-950 p-2 rounded border border-slate-800/80 text-xs">
                      <span className="text-slate-200">{hl}</span>
                      <span className="text-[10px] text-emerald-400 font-mono ml-2">{hl.length}/30</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Descrições Validadas (Máx. 90 chars)</span>
                  {adGroup.descriptions.map((desc: string, dIdx: number) => (
                    <div key={dIdx} className="flex items-center justify-between bg-slate-950 p-2 rounded border border-slate-800/80 text-xs">
                      <span className="text-slate-200">{desc}</span>
                      <span className="text-[10px] text-emerald-400 font-mono ml-2 shrink-0">{desc.length}/90</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ABA 4: LANDING PAGE */}
      {activeSubTab === "landing_page" && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <span className="text-[10px] font-bold uppercase text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">Estrutura de Alta Conversão</span>
            <h3 className="text-lg font-bold text-white mt-2">{assetPackage.landingPage.headline}</h3>
            <p className="text-xs text-slate-400 mt-1">{assetPackage.landingPage.subheadline}</p>
            <div className="mt-3">
              <span className="inline-block bg-blue-600 text-white font-semibold text-xs px-4 py-2 rounded-lg shadow-md shadow-blue-500/20">
                {assetPackage.landingPage.ctaButtonText}
              </span>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Benefícios Destacados na Página:</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {assetPackage.landingPage.benefitBullets.map((bullet: string, bIdx: number) => (
                <div key={bIdx} className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs text-slate-300 flex items-start gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{bullet}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">FAQ de Quebra de Objeções:</h4>
            <div className="space-y-2">
              {assetPackage.landingPage.faq.map((item: any, fIdx: number) => (
                <div key={fIdx} className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 text-xs space-y-1">
                  <strong className="text-white block font-semibold">{item.question}</strong>
                  <p className="text-slate-400">{item.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ABA 5: OUTBOUND WHATSAPP */}
      {activeSubTab === "outbound" && (
        <div className="space-y-4">
          <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl text-xs text-blue-300">
            <strong>Estratégia de Guerrilha (Custo R$ 0,00):</strong> Abra o Google Maps na sua cidade, busque por <i>"assistência técnica celular"</i> ou <i>"manutenção informática"</i>, copie o número de WhatsApp e envie a mensagem consultiva abaixo.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {assetPackage.outboundMessages.map((msg: any, mIdx: number) => (
              <div key={mIdx} className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded">
                      Canal: {msg.channel.toUpperCase()}
                    </span>
                    <button
                      onClick={() => handleCopy(msg.messageTemplate, `outbound_${mIdx}`)}
                      className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white bg-slate-800 px-2.5 py-1 rounded transition-colors"
                    >
                      {copiedKey === `outbound_${mIdx}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedKey === `outbound_${mIdx}` ? "Copiado!" : "Copiar Texto"}
                    </button>
                  </div>
                  <h4 className="text-xs font-bold text-white mb-2">{msg.angle}</h4>
                  <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 text-xs text-slate-300 leading-relaxed font-sans whitespace-pre-wrap">
                    {msg.messageTemplate}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
