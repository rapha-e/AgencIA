import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncMetaConnections, syncGoogleConnections } from "@admetrics/integrations";

export const dynamic = "force-dynamic";

/**
 * POST /api/integrations/sync
 * Dispara a sincronização idempotente de leitura das contas ativas (Meta Ads e Google Ads) do cliente.
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

    const body = await request.json().catch(() => ({}));
    const organizationId = body.organizationId;
    const clientId = body.clientId;

    if (!organizationId || !clientId) {
      return NextResponse.json(
        { error: "organizationId e clientId são obrigatórios." },
        { status: 400 }
      );
    }

    // 2. Validar autorização multi-tenant (RBAC)
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

    // 3. Executar sincronização assíncrona oficial (Meta Ads + Google Ads)
    const [metaResult, googleResult] = await Promise.all([
      syncMetaConnections({ daysToSync: 14 }),
      syncGoogleConnections({ daysToSync: 14 })
    ]);

    const errors = [...(metaResult.errors || []), ...(googleResult.errors || [])];

    return NextResponse.json({
      success: errors.length === 0,
      connectionsProcessed:
        (metaResult.connectionsProcessed || 0) + (googleResult.connectionsProcessed || 0),
      totalRecordsProcessed:
        (metaResult.totalRecordsProcessed || 0) + (googleResult.totalRecordsProcessed || 0),
      meta: metaResult,
      googleAds: googleResult,
      errors
    });
  } catch (err: any) {
    console.error("[POST /api/integrations/sync] Erro inesperado:", err);
    return NextResponse.json(
      { error: `Erro na sincronização: ${err.message}` },
      { status: 500 }
    );
  }
}
