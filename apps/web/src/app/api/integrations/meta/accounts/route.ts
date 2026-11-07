import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  decryptToken,
  MetaAdsConnector
} from "@admetrics/integrations";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Não autorizado. Faça login para acessar as contas de anúncios." },
        { status: 401 }
      );
    }

    const cookieStore = await cookies();
    const stagingCookie = cookieStore.get("meta_staging_session")?.value;

    if (!stagingCookie) {
      return NextResponse.json(
        { error: "Sessão de autorização da Meta expirada ou não encontrada. Por favor, conecte-se novamente." },
        { status: 401 }
      );
    }

    // Descriptografar payload da sessão temporária no servidor
    const stagingJson = decryptToken(stagingCookie);
    const stagingData = JSON.parse(stagingJson);

    // Validação de expiração da sessão de staging (15 min)
    if (stagingData.createdAt && Date.now() - stagingData.createdAt > 900000) {
      cookieStore.delete("meta_staging_session");
      return NextResponse.json(
        { error: "A sessão de vinculação expirou. Por favor, reinicie a conexão." },
        { status: 401 }
      );
    }

    // Garantir que a sessão de staging pertence ao usuário atual
    if (stagingData.userId && stagingData.userId !== user.id) {
      return NextResponse.json(
        { error: "Acesso negado: Sessão de autorização pertence a outro usuário." },
        { status: 403 }
      );
    }

    // Validar vínculo do usuário na organização
    const { data: membership, error: memberErr } = await supabase
      .from("memberships")
      .select("role")
      .eq("organization_id", stagingData.organizationId)
      .eq("user_id", user.id)
      .single();

    if (memberErr || !membership || !["owner", "admin", "manager"].includes(membership.role)) {
      return NextResponse.json(
        { error: "Acesso negado: Permissão insuficiente na organização informada." },
        { status: 403 }
      );
    }

    // Descriptografar o token em memória temporária estritamente para consulta à API
    const plainAccessToken = decryptToken(stagingData.encryptedToken);

    const connector = new MetaAdsConnector({
      accessToken: plainAccessToken
    });

    const accounts = await connector.listAccounts();

    return NextResponse.json({
      success: true,
      organizationId: stagingData.organizationId,
      clientId: stagingData.clientId,
      scopes: stagingData.scopes,
      accounts: accounts.map((acc) => ({
        id: acc.id,
        name: acc.name,
        currency: acc.currency,
        timezone: acc.timezone
      }))
    });
  } catch (err: any) {
    console.error("[Meta Accounts Fetch Error]", err);
    return NextResponse.json(
      { error: `Erro ao obter contas de anúncios da Meta: ${err.message}` },
      { status: 500 }
    );
  }
}
