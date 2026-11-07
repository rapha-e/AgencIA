import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aggregateMetricFacts, RawFactItem } from "@admetrics/domain";

export const dynamic = "force-dynamic";

/**
 * GET /api/metrics/summary
 * Endpoint autenticado com validação multi-tenant estrita para consulta
 * e consolidação determinística de indicadores de performance reais.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 1. Validar autenticação do usuário
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
    const platform = searchParams.get("platform") || "all";
    const daysParam = parseInt(searchParams.get("days") || "14", 10);
    const days = isNaN(daysParam) || daysParam <= 0 ? 14 : Math.min(daysParam, 90);

    if (!organizationId || !clientId) {
      return NextResponse.json(
        { error: "organizationId e clientId são obrigatórios." },
        { status: 400 }
      );
    }

    // 2. Validação Multi-Tenant: verificar se o usuário é membro da organização solicitada
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

    // 3. Validação de Isolamento: verificar se o cliente pertence à organização
    const { data: client, error: clientErr } = await supabase
      .from("clients")
      .select("id, name, currency, timezone")
      .eq("organization_id", organizationId)
      .eq("id", clientId)
      .maybeSingle();

    if (clientErr || !client) {
      return NextResponse.json(
        { error: "Acesso negado: Cliente não pertence à organização informada." },
        { status: 403 }
      );
    }

    // 4. Inspecionar status de conexões ativas para o cliente
    let connQuery = supabase
      .from("ad_connections")
      .select("id, platform, external_account_id, external_account_name, status, last_synced_at")
      .eq("client_id", clientId)
      .eq("status", "active");

    if (platform !== "all") {
      connQuery = connQuery.eq("platform", platform);
    }

    const { data: connections, error: connErr } = await connQuery;

    if (connErr) {
      return NextResponse.json(
        { error: `Falha ao consultar conexões: ${connErr.message}` },
        { status: 500 }
      );
    }

    const hasActiveConnection = connections && connections.length > 0;
    const isSyncPending = hasActiveConnection && connections.every((c) => !c.last_synced_at);

    // 5. Definir janela de 14 dias consistente
    const endDateObj = new Date();
    const endDate = endDateObj.toISOString().split("T")[0];
    const startDateObj = new Date();
    startDateObj.setDate(startDateObj.getDate() - days);
    const startDate = startDateObj.toISOString().split("T")[0];

    // 6. Consultar fatos métricos em public.metric_facts
    let query = supabase
      .from("metric_facts")
      .select("id, client_id, platform, external_account_id, campaign_id, date, impressions, clicks, spend, conversions, revenue, currency, attribution_window")
      .eq("client_id", clientId)
      .gte("date", startDate)
      .lte("date", endDate);

    if (platform !== "all") {
      query = query.eq("platform", platform);
    }

    const { data: rawFacts, error: factsErr } = await query;

    if (factsErr) {
      return NextResponse.json(
        { error: `Falha ao carregar fatos analíticos: ${factsErr.message}` },
        { status: 500 }
      );
    }

    // Normalizar tipos para o agregador determinístico
    const factsList: RawFactItem[] = (rawFacts || []).map((row) => ({
      id: row.id,
      clientId: row.client_id,
      platform: row.platform,
      externalAccountId: row.external_account_id,
      campaignId: row.campaign_id,
      date: row.date,
      impressions: Number(row.impressions || 0),
      clicks: Number(row.clicks || 0),
      spend: Number(row.spend || 0),
      conversions: Number(row.conversions || 0),
      revenue: Number(row.revenue || 0),
      currency: row.currency || client.currency || "BRL",
      attributionWindow: row.attribution_window
    }));

    // 7. Agregação com deduplicação anti-duplicação e semântica estrita
    const aggregation = aggregateMetricFacts(factsList, client.currency || "BRL");

    // 8. Determinar o estado inequívoco da interface
    let state: "real_data" | "confirmed_zero" | "no_data" | "sync_pending" | "no_connection" = "no_data";

    if (!hasActiveConnection) {
      state = "no_connection";
    } else if (isSyncPending) {
      state = "sync_pending";
    } else if (aggregation.dataState === "ACTIVE_METRICS") {
      state = "real_data";
    } else if (aggregation.dataState === "CONFIRMED_ZERO") {
      state = "confirmed_zero";
    } else {
      state = "no_data";
    }

    return NextResponse.json({
      success: true,
      state,
      dataAvailability: aggregation.dataState,
      period: {
        startDate,
        endDate,
        days
      },
      summary: {
        spend: aggregation.totalSpend,
        impressions: aggregation.totalImpressions,
        clicks: aggregation.totalClicks,
        conversions: aggregation.totalConversions,
        purchases: aggregation.totalPurchases,
        leads: aggregation.totalLeads,
        contacts: aggregation.totalContacts,
        revenue: aggregation.totalRevenue,
        cpa: aggregation.cpa,
        cpl: aggregation.cpl,
        cac: aggregation.cac,
        roas: aggregation.roas,
        conversionRate: aggregation.conversionRate,
        ctr: aggregation.ctr,
        currency: aggregation.currency,
        recordCount: aggregation.recordCount,
        uniqueDays: aggregation.uniqueDays
      },
      connections: (connections || []).map((c) => ({
        id: c.id,
        platform: c.platform,
        accountName: c.external_account_name,
        accountId: c.external_account_id,
        lastSyncedAt: c.last_synced_at
      }))
    });
  } catch (err: any) {
    console.error("[GET /api/metrics/summary] Erro inesperado:", err);
    return NextResponse.json(
      { error: `Erro interno no servidor: ${err.message}` },
      { status: 500 }
    );
  }
}
