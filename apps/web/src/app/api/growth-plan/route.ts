import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calculateUnitEconomics, buildTrackingUrl } from "@admetrics/domain";
import { createAiProvider } from "@admetrics/ai";

export const dynamic = "force-dynamic";

/**
 * GET /api/growth-plan
 * Consulta autenticada com isolamento multi-tenant para obter ou calcular
 * o plano de crescimento, unit economics e ativos de partida a frio.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 1. Validar autenticação
    const {
      data: { user },
      error: authErr
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json(
        { error: "Sessão não autenticada." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");
    const clientId = searchParams.get("clientId");

    if (!organizationId || !clientId) {
      return NextResponse.json(
        { error: "organizationId e clientId são obrigatórios." },
        { status: 400 }
      );
    }

    // 2. Validar membership na organização
    const { data: membership, error: memberErr } = await supabase
      .from("memberships")
      .select("role")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (memberErr || !membership) {
      return NextResponse.json(
        { error: "Acesso negado: Usuário não pertence à organização informada." },
        { status: 403 }
      );
    }

    // 3. Buscar dados do cliente e validar pertencimento à organização
    const { data: client, error: clientErr } = await supabase
      .from("clients")
      .select("id, name, currency, timezone, max_daily_budget_limit")
      .eq("id", clientId)
      .eq("organization_id", organizationId)
      .single();

    if (clientErr || !client) {
      return NextResponse.json(
        { error: "Cliente não localizado para esta organização." },
        { status: 404 }
      );
    }

    // 4. Verificar se há plano persistido em public.growth_plans com diferenciação estrita
    let storedPlan: any = null;
    let persistenceStatus: "persisted" | "no_records" | "simulated_in_memory" = "no_records";

    const { data: dbPlan, error: planErr } = await supabase
      .from("growth_plans")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("client_id", clientId)
      .maybeSingle();

    if (planErr) {
      // 42P01 indica que a tabela 'growth_plans' ainda não foi criada (migration pendente)
      if (planErr.code === "42P01" || planErr.message?.toLowerCase().includes("does not exist") || planErr.message?.includes("Could not find the table")) {
        persistenceStatus = "simulated_in_memory";
      } else {
        // Erro real de banco (ex: RLS, falha de rede, timeout, etc.) - não mascarar!
        return NextResponse.json(
          {
            error: `Erro ao consultar banco de dados: ${planErr.message}`,
            code: planErr.code,
            persistenceStatus: "db_error"
          },
          { status: 500 }
        );
      }
    } else if (dbPlan) {
      storedPlan = dbPlan;
      persistenceStatus = "persisted";
    } else {
      // Tabela existe e respondeu com sucesso, mas o cliente ainda não possui plano salvo
      persistenceStatus = "no_records";
    }

    // 5. Determinar atributos do plano (persistido ou calculado por perfil)
    const isTorxOS = client.name.toLowerCase().includes("torx") || client.name.toLowerCase().includes("assistência");

    const productName = storedPlan?.product_name || (isTorxOS ? "TorxOS" : client.name);
    const productUrl = storedPlan?.product_url || (isTorxOS ? "https://torxos.tech" : "https://app.growth.ai");
    const monthlyPrice = storedPlan?.monthly_price ?? (isTorxOS ? 97.00 : 149.00);
    const valueProposition = storedPlan?.value_proposition || (
      isTorxOS
        ? "Sistema operacional e de gestão voltado para assistências técnicas e centros de reparo de hardware."
        : "Plataforma de automação e inteligência de crescimento para operações B2B."
    );
    const targetAudience = storedPlan?.target_audience || (
      isTorxOS
        ? "Donos de assistências de celulares, computadores, videogames e eletrônicos."
        : "Gestores e empresários B2B em busca de previsibilidade."
    );
    const painPoints = storedPlan?.pain_points || (
      isTorxOS
        ? [
            "Cliente cobrando status no WhatsApp toda hora ('meu aparelho tá pronto?')",
            "Peças e componentes sumindo ou usados sem dar baixa no estoque",
            "Orçamentos manuais lentos e desorganizados em cadernos ou planilhas"
          ]
        : [
            "Processos manuais e retrabalho na equipe",
            "Falta de controle centralizado de indicadores",
            "Dificuldade de escala sem aumento proporcional de custos"
          ]
    );
    const mainDifferentiator = storedPlan?.main_differentiator || (
      isTorxOS
        ? "OS Digital com notificação automática via WhatsApp a cada etapa do conserto na bancada."
        : "Automação com IA e governança integrada."
    );

    // 6. Cálculo determinístico de Unit Economics
    const unitEconomics = calculateUnitEconomics({
      monthlyPrice,
      avgMonthsRetention: 10,
      targetCacPercentOfLtv: 0.20,
      leadToCustomerConversionRate: 0.08
    });

    // 7. Geração do Pacote de Criativos & Ativos com Provedor Gemini Oficial (com Fallback Determinístico)
    const aiProvider = createAiProvider();
    const { package: assetPackage, providerUsed: aiProviderUsed } =
      await aiProvider.generateColdStartAssets({
        productName,
        businessModel: storedPlan?.business_model || "b2b_saas",
        valueProposition,
        targetAudience,
        painPoints,
        mainDifferentiator,
        monthlyPrice,
        productUrl
      });

    // 8. Construção de URLs com UTMs normalizadas via módulo determinístico
    const trackingUrls = {
      metaReels: buildTrackingUrl(productUrl, {
        utm_source: "meta",
        utm_medium: "reels",
        utm_campaign: "os_whatsapp_v1",
        utm_content: "video_bancada"
      }),
      metaFeed: buildTrackingUrl(productUrl, {
        utm_source: "meta",
        utm_medium: "feed",
        utm_campaign: "estoque_pecas_v1",
        utm_content: "imagem_gaveta"
      }),
      googleSearch: buildTrackingUrl(productUrl, {
        utm_source: "google",
        utm_medium: "cpc",
        utm_campaign: "search_software_assistencia",
        utm_term: "{keyword}"
      }),
      whatsappDirect: `https://wa.me/5500000000000?text=${encodeURIComponent(
        `Olá! Vim pelo anúncio do ${productName} e gostaria de testar gratuitamente por 14 dias.`
      )}`
    };

    return NextResponse.json({
      success: true,
      persistenceStatus,
      aiProviderUsed,
      client: {
        id: client.id,
        name: client.name,
        currency: client.currency,
        hardCapDaily: client.max_daily_budget_limit || 50.00
      },
      plan: {
        id: storedPlan?.id,
        productName,
        productUrl,
        monthlyPrice,
        valueProposition,
        targetAudience,
        painPoints,
        mainDifferentiator,
        primaryOffer: storedPlan?.primary_offer || "free_trial",
        version: storedPlan?.version || 1
      },
      unitEconomics,
      assetPackage,
      trackingUrls
    });
  } catch (error: any) {
    console.error("[Growth Plan API Error]:", error);
    return NextResponse.json(
      { error: error.message || "Erro interno ao processar o plano de crescimento." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/growth-plan
 * Criação ou atualização idempotente de plano de crescimento com validação
 * de esquema e isolamento multi-tenant estrito no servidor.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 1. Validar autenticação
    const {
      data: { user },
      error: authErr
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json(
        { error: "Sessão não autenticada." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      organizationId,
      clientId,
      monthlyPrice,
      targetAudience,
      valueProposition,
      painPoints,
      mainDifferentiator,
      businessModel,
      primaryOffer,
      maxDailyBudget
    } = body;

    if (!organizationId || !clientId) {
      return NextResponse.json(
        { error: "organizationId e clientId são obrigatórios." },
        { status: 400 }
      );
    }

    // 2. Validar membership na organização
    const { data: membership, error: memberErr } = await supabase
      .from("memberships")
      .select("role")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (memberErr || !membership) {
      return NextResponse.json(
        { error: "Acesso negado: Usuário não pertence à organização informada." },
        { status: 403 }
      );
    }

    // 3. Validar se o cliente pertence à organização
    const { data: client, error: clientErr } = await supabase
      .from("clients")
      .select("id, name")
      .eq("id", clientId)
      .eq("organization_id", organizationId)
      .single();

    if (clientErr || !client) {
      return NextResponse.json(
        { error: "Cliente não pertence à organização informada." },
        { status: 404 }
      );
    }

    const price = Number(monthlyPrice) || 97.00;
    const unitEconomics = calculateUnitEconomics({
      monthlyPrice: price,
      avgMonthsRetention: 10,
      targetCacPercentOfLtv: 0.20,
      leadToCustomerConversionRate: 0.08
    });

    let persistenceStatus: "persisted" | "simulated_in_memory" = "simulated_in_memory";
    let planRecord: any = {
      organization_id: organizationId,
      client_id: clientId,
      business_model: businessModel || "b2b_saas",
      product_name: client.name,
      value_proposition: valueProposition || "Sistema de gestão e automação",
      target_audience: targetAudience || "Público alvo",
      pain_points: Array.isArray(painPoints) ? painPoints : [],
      main_differentiator: mainDifferentiator || "Diferencial de produto",
      primary_offer: primaryOffer || "free_trial",
      monthly_price: price,
      estimated_ltv: unitEconomics.estimatedLtv,
      target_cac: unitEconomics.targetCac,
      target_cpl: unitEconomics.targetCpl,
      max_daily_budget: Number(maxDailyBudget) || 50.00,
      version: 1,
      author_id: user.id
    };

    const { data: upsertData, error: upsertErr } = await supabase
      .from("growth_plans")
      .upsert(planRecord, { onConflict: "client_id" })
      .select()
      .single();

    if (upsertErr) {
      if (upsertErr.code === "42P01" || upsertErr.message?.toLowerCase().includes("does not exist") || upsertErr.message?.includes("Could not find the table")) {
        persistenceStatus = "simulated_in_memory";
      } else {
        // Erro real de banco (ex: RLS, constraint violada, etc.) - não mascarar!
        return NextResponse.json(
          {
            error: `Erro ao persistir plano no banco de dados: ${upsertErr.message}`,
            code: upsertErr.code,
            persistenceStatus: "db_error"
          },
          { status: 500 }
        );
      }
    } else if (upsertData) {
      persistenceStatus = "persisted";
      planRecord = upsertData;
    }

    return NextResponse.json({
      success: true,
      persistenceStatus,
      plan: planRecord,
      unitEconomics,
      message:
        persistenceStatus === "persisted"
          ? "Plano de crescimento salvo e persistido com sucesso no banco de dados."
          : "Plano validado e calculado em memória. A persistência física aguarda aplicação da migration 20261027000001 no Supabase remoto."
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erro interno ao salvar plano de crescimento." },
      { status: 500 }
    );
  }
}
