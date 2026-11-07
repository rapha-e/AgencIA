import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { GoogleAdsConnector, GoogleAdsApiError } from "./connector.js";
import { GoogleAdsOAuthService } from "./oauth.js";
import { decryptToken, encryptToken } from "../meta/crypto.js";

export interface SyncGoogleOptions {
  supabaseUrl?: string;
  serviceRoleKey?: string;
  connectionId?: string;
  daysToSync?: number;
}

/**
 * Rotina Assíncrona de Sincronização do Google Ads com Persistência,
 * Renovação Automática de Token (Refresh Token) e Idempotência.
 */
export async function syncGoogleConnections(options: SyncGoogleOptions = {}): Promise<{
  success: boolean;
  connectionsProcessed: number;
  totalRecordsProcessed: number;
  errors: string[];
}> {
  const supabaseUrl = options.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = options.serviceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
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

  let query = supabase
    .from("ad_connections")
    .select("id, organization_id, client_id, external_account_id, status")
    .eq("platform", "google_ads")
    .eq("status", "active");

  if (options.connectionId) {
    query = query.eq("id", options.connectionId);
  }

  const { data: connections, error: connErr } = await query;

  if (connErr) {
    return {
      success: false,
      connectionsProcessed: 0,
      totalRecordsProcessed: 0,
      errors: [connErr.message]
    };
  }

  if (!connections || connections.length === 0) {
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
      // 1. Validar isolamento multi-tenant do cliente
      const { data: clientCheck, error: clientErr } = await supabase
        .from("clients")
        .select("id")
        .eq("id", conn.client_id)
        .eq("organization_id", conn.organization_id)
        .single();

      if (clientErr || !clientCheck) {
        throw new Error(
          `Vínculo multi-tenant inválido: o cliente ${conn.client_id} não pertence à organização ${conn.organization_id}.`
        );
      }

      // 2. Recuperar segredo criptografado em connection_secrets
      const { data: secret, error: secretErr } = await supabase
        .from("connection_secrets")
        .select("encrypted_access_token, encrypted_refresh_token, token_expires_at")
        .eq("connection_id", conn.id)
        .single();

      if (secretErr || !secret?.encrypted_access_token) {
        throw new Error(
          `Segredo da conexão Google Ads não localizado em connection_secrets: ${secretErr?.message || "Ausente"}`
        );
      }

      let accessToken = decryptToken(secret.encrypted_access_token);

      // 3. Se o token estiver expirado e houver refresh_token, renovar automaticamente
      const isExpired =
        secret.token_expires_at && new Date(secret.token_expires_at).getTime() <= Date.now() + 60000;

      if (isExpired && secret.encrypted_refresh_token) {
        const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
        const redirectUri =
          process.env.GOOGLE_ADS_REDIRECT_URI || "http://localhost:3000/api/integrations/google/callback";

        if (clientId && clientSecret) {
          const refreshToken = decryptToken(secret.encrypted_refresh_token);
          const oauth = new GoogleAdsOAuthService({ clientId, clientSecret, redirectUri });
          const refreshed = await oauth.refreshAccessToken(refreshToken);
          accessToken = refreshed.accessToken;

          const encryptedNew = encryptToken(accessToken);
          await supabase
            .from("connection_secrets")
            .update({
              encrypted_access_token: encryptedNew.versionedPayload,
              token_expires_at: new Date(Date.now() + refreshed.expiresIn * 1000).toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq("connection_id", conn.id);
        }
      }

      // 4. Inicializar GoogleAdsConnector
      const connector = new GoogleAdsConnector({
        accessToken,
        developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
        loginCustomerId: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID
      });

      // 5. Sincronizar campanhas
      const campResult = await connector.syncCampaigns(conn.external_account_id, conn.client_id);

      if (campResult.data && campResult.data.length > 0) {
        const campaignsPayload = campResult.data.map((c) => ({
          connection_id: conn.id,
          client_id: conn.client_id,
          platform: "google_ads",
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
        const metricsPayload = metricsResult.data.map((m) => ({
          client_id: conn.client_id,
          platform: "google_ads",
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
      errors.push(err.message);

      if (err instanceof GoogleAdsApiError && err.isAuthError()) {
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

