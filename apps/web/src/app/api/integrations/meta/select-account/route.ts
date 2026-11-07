import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptToken } from "@admetrics/integrations";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Não autorizado. Sessão de usuário inválida." },
        { status: 401 }
      );
    }

    const cookieStore = await cookies();
    const stagingCookie = cookieStore.get("meta_staging_session")?.value;

    if (!stagingCookie) {
      return NextResponse.json(
        { error: "Sessão de vinculação expirou ou já foi utilizada (anti-replay)." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { accountId, accountName } = body;

    if (!accountId) {
      return NextResponse.json(
        { error: "Identificador da conta de anúncios (accountId) é obrigatório." },
        { status: 400 }
      );
    }

    // Descriptografar sessão temporária
    const stagingJson = decryptToken(stagingCookie);
    const stagingData = JSON.parse(stagingJson);

    // Validação de expiração da sessão temporária (15 minutos)
    if (stagingData.createdAt && Date.now() - stagingData.createdAt > 900000) {
      cookieStore.delete("meta_staging_session");
      return NextResponse.json(
        { error: "Sessão de vinculação expirou. Por favor, reinicie o processo de conexão." },
        { status: 400 }
      );
    }

    // Garantir que a sessão pertence ao usuário autenticado no Supabase
    if (stagingData.userId && stagingData.userId !== user.id) {
      cookieStore.delete("meta_staging_session");
      return NextResponse.json(
        { error: "Violação de segurança: A sessão de autorização pertence a outro usuário." },
        { status: 403 }
      );
    }

    // Validação estrita de RBAC no servidor: confirma que o usuário é membro autorizado da org
    const { data: membership, error: memberError } = await supabase
      .from("memberships")
      .select("role")
      .eq("organization_id", stagingData.organizationId)
      .eq("user_id", user.id)
      .single();

    if (memberError || !membership || !["owner", "admin", "manager"].includes(membership.role)) {
      return NextResponse.json(
        { error: "Permissão insuficiente para vincular conta de anúncios a esta organização." },
        { status: 403 }
      );
    }

    // Validação estrita de tenant: confirma que o cliente informado pertence à organização
    const { data: client, error: clientErr } = await supabase
      .from("clients")
      .select("id")
      .eq("organization_id", stagingData.organizationId)
      .eq("id", stagingData.clientId)
      .single();

    if (clientErr || !client) {
      return NextResponse.json(
        { error: "Cliente inválido ou não pertencente à organização autorizada." },
        { status: 404 }
      );
    }

    const admin = createAdminClient();

    // 1. Criar ou atualizar registro em public.ad_connections com vínculo rigoroso de tenant
    const { data: connection, error: connError } = await admin
      .from("ad_connections")
      .upsert(
        {
          organization_id: stagingData.organizationId,
          client_id: stagingData.clientId,
          platform: "meta",
          external_account_id: accountId,
          external_account_name: accountName || `Conta Meta ${accountId}`,
          status: "active",
          last_synced_at: null
        },
        { onConflict: "platform,external_account_id" }
      )
      .select("id")
      .single();

    if (connError || !connection) {
      console.error("[Select Account Connection Error]", connError?.message);
      return NextResponse.json(
        { error: `Erro ao persistir conexão no banco: ${connError?.message}` },
        { status: 500 }
      );
    }

    // 2. Persistir o token criptografado na tabela isolada public.connection_secrets
    const { error: secretError } = await admin
      .from("connection_secrets")
      .upsert(
        {
          connection_id: connection.id,
          encrypted_access_token: stagingData.encryptedToken,
          token_type: "bearer",
          expires_at: stagingData.expiresAt,
          scopes: stagingData.scopes || [],
          meta_user_id: stagingData.metaUserId,
          updated_at: new Date().toISOString()
        },
        { onConflict: "connection_id" }
      );

    if (secretError) {
      console.error("[Select Account Secret Error]", secretError?.message);
      return NextResponse.json(
        {
          error:
            "A conexão foi registrada, mas a tabela de segredos ainda não foi migrada ou falhou ao gravar o token."
        },
        { status: 500 }
      );
    }

    // 3. Excluir cookie temporário de staging imediatamente (anti-replay)
    cookieStore.delete("meta_staging_session");

    return NextResponse.json({
      success: true,
      message: "Conta de anúncios vinculada com sucesso!",
      connectionId: connection.id
    });
  } catch (err: any) {
    console.error("[Select Account Error]", err?.message);
    return NextResponse.json(
      { error: `Falha ao vincular conta de anúncios: ${err.message}` },
      { status: 500 }
    );
  }
}
