import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { MetaAdsConnector, MetaApiError } from "./connector.js";
import { decryptToken } from "./crypto.js";

export interface SyncMetaOptions {
  supabaseUrl?: string;
  serviceRoleKey?: string;
  connectionId?: string;
  daysToSync?: number;
}

/**
 * Rotina Assíncrona de Sincronização do Meta Ads com Persistência e Idempotência
 */
export async function syncMetaConnections(options: SyncMetaOptions = {}): Promise<{
  success: boolean;
  connectionsProcessed: number;
  totalRecordsProcessed: number;
  errors: string[];
}> {
  const supabaseUrl = options.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = options.serviceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.log("[Worker Meta Sync] Variáveis do Supabase ausentes. Pulando sincronização remota.");
    return {
      success: false,
      connectionsProcessed: 0,
      totalRecordsProcessed: 0,
      errors: ["Supabase credentials missing"]
    };
  }

  const supabase: SupabaseClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // 1. Buscar conexões ativas do Meta Ads
  let query = supabase
    .from("ad_connections")
    .select("id, organization_id, client_id, external_account_id, status")
    .eq("platform", "meta")
    .eq("status", "active");

  if (options.connectionId) {
    query = query.eq("id", options.connectionId);
  }

  const { data: connections, error: connErr } = await query;

  if (connErr) {
    console.error("[Worker Meta Sync] Erro ao consultar ad_connections:", connErr.message);
    return {
      success: false,
      connectionsProcessed: 0,
      totalRecordsProcessed: 0,
      errors: [connErr.message]
    };
  }

  if (!connections || connections.length === 0) {
    console.log("[Worker Meta Sync] Nenhuma conexão ativa da Meta encontrada para sincronizar.");
    return {
      success: true,
      connectionsProcessed: 0,
      totalRecordsProcessed: 0,
      errors: []
    };
  }

  let totalRecords = 0;
  const errors: string[] = [];

  for (const conn of connections) {
    // Iniciar rastreamento de sync_run
    const { data: syncRun } = await supabase
      .from("sync_runs")
      .insert({
        connection_id: conn.id,
        status: "running",
        started_at: new Date().toISOString()
      })
      .select("id")
      .single();

    const syncRunId = syncRun?.id;

    try {
      // 2. Validação estrita de tenant: garantir que o cliente ainda pertence à organização da conexão
      const { data: clientCheck, error: clientErr } = await supabase
        .from("clients")
        .select("id")
        .eq("id", conn.client_id)
        .eq("organization_id", conn.organization_id)
        .single();

      if (clientErr || !clientCheck) {
        throw new Error(
          `Vínculo multi-tenant corrompido: o cliente ${conn.client_id} não pertence à organização ${conn.organization_id}.`
        );
      }

      // 3. Recuperar token criptografado da tabela isolada connection_secrets
      const { data: secret, error: secretErr } = await supabase
        .from("connection_secrets")
        .select("encrypted_access_token")
        .eq("connection_id", conn.id)
        .single();

      if (secretErr || !secret?.encrypted_access_token) {
        throw new Error(
          `Segredo da conexão não encontrado em connection_secrets: ${secretErr?.message || "Registro ausente"}`
        );
      }

      // 4. Descriptografar token exclusivamente em memória de execução
      const accessToken = decryptToken(secret.encrypted_access_token);

      // 4. Inicializar conector oficial
      const connector = new MetaAdsConnector({ accessToken });

      // 5. Sincronizar campanhas
      const campResult = await connector.syncCampaigns(conn.external_account_id, conn.client_id);

      if (campResult.data && campResult.data.length > 0) {
        // Upsert idempotente na tabela public.campaigns
        const campaignsPayload = campResult.data.map((c) => ({
          connection_id: conn.id,
          client_id: conn.client_id,
          platform: "meta",
          external_campaign_id: c.externalCampaignId,
          name: c.name,
          status: c.status,
          daily_budget: c.dailyBudget,
          lifetime_budget: c.lifetimeBudget,
          objective: c.objective,
          last_synced_at: new Date().toISOString()
        }));

        await supabase.from("campaigns").upsert(campaignsPayload, {
          onConflict: "platform,external_campaign_id"
        });
      }

      // 6. Sincronizar métricas diárias
      const days = options.daysToSync || 14;
      const endDate = new Date().toISOString().split("T")[0];
      const startDate = new Date(Date.now() - days * 86400000).toISOString().split("T")[0];

      const metricsResult = await connector.fetchMetrics(
        conn.external_account_id,
        conn.client_id,
        { start: startDate, end: endDate }
      );

      if (metricsResult.data && metricsResult.data.length > 0) {
        // Upsert idempotente em public.metric_facts
        const metricsPayload = metricsResult.data.map((m) => ({
          client_id: conn.client_id,
          platform: "meta",
          external_account_id: conn.external_account_id,
          campaign_id: m.campaignId,
          date: m.date,
          impressions: m.impressions,
          clicks: m.clicks,
          spend: m.spend,
          conversions: m.conversions,
          revenue: m.revenue,
          currency: m.currency,
          attribution_window: m.attributionWindow,
          source: m.source
        }));

        await supabase.from("metric_facts").upsert(metricsPayload, {
          onConflict: "client_id,platform,external_account_id,campaign_id,date,attribution_window"
        });
      }

      const count = (campResult.recordsCount || 0) + (metricsResult.recordsCount || 0);
      totalRecords += count;

      // 7. Atualizar status da conexão e sync_run
      await supabase
        .from("ad_connections")
        .update({ last_synced_at: new Date().toISOString() })
        .eq("id", conn.id);

      if (syncRunId) {
        await supabase
          .from("sync_runs")
          .update({
            status: "completed",
            records_processed: count,
            finished_at: new Date().toISOString()
          })
          .eq("id", syncRunId);
      }
    } catch (err: any) {
      console.error(`[Worker Meta Sync] Falha ao sincronizar conta ${conn.external_account_id}:`, err.message);
      errors.push(err.message);

      // Tratamento seguro de token revogado ou expirado
      if (err instanceof MetaApiError && err.isAuthError()) {
        await supabase
          .from("ad_connections")
          .update({ status: "expired" })
          .eq("id", conn.id);
      }

      if (syncRunId) {
        await supabase
          .from("sync_runs")
          .update({
            status: "failed",
            error_message: err.message,
            finished_at: new Date().toISOString()
          })
          .eq("id", syncRunId);
      }
    }
  }

  return {
    success: errors.length === 0,
    connectionsProcessed: connections.length,
    totalRecordsProcessed: totalRecords,
    errors
  };
}
