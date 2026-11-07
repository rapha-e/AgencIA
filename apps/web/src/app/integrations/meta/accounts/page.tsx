"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Building2,
  Lock,
  Layers
} from "lucide-react";

interface AccountItem {
  id: string;
  name: string;
  currency: string;
  timezone: string;
}

export default function MetaAccountsSelectionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [scopes, setScopes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadAccounts() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/integrations/meta/accounts");
        const data = await res.json();

        if (!res.ok || data.error) {
          setError(data.error || "Não foi possível carregar as contas de anúncios.");
          return;
        }

        setAccounts(data.accounts || []);
        setScopes(data.scopes || []);
      } catch (err: any) {
        setError(`Erro de comunicação com o servidor: ${err.message}`);
      } finally {
        setLoading(false);
      }
    }

    loadAccounts();
  }, []);

  const handleSelectAccount = async (account: AccountItem) => {
    try {
      setSubmittingId(account.id);
      setError(null);

      const res = await fetch("/api/integrations/meta/select-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: account.id,
          accountName: account.name
        })
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || "Falha ao vincular a conta de anúncios.");
        setSubmittingId(null);
        return;
      }

      setSuccessMsg(
        `Conta "${account.name}" (${account.id}) conectada com sucesso em modo somente leitura!`
      );
      setTimeout(() => {
        router.push("/?meta_connected=true");
      }, 1500);
    } catch (err: any) {
      setError(`Erro ao concluir vinculação: ${err.message}`);
      setSubmittingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 p-6 md:p-12 flex flex-col items-center justify-center font-sans">
      <div className="w-full max-w-2xl bg-slate-900/90 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl backdrop-blur-xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-800/80 pb-5 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              Vincular Conta de Anúncios Meta
            </h1>
            <p className="text-xs text-slate-400">
              Selecione a conta de anúncios autorizada para sincronização no AdMetrics & Growth AI
            </p>
          </div>
        </div>

        {/* Informações de Governança e Permissões */}
        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 mb-6 text-xs text-slate-300">
          <div className="flex items-center gap-2 font-semibold text-emerald-400 mb-2">
            <ShieldCheck className="w-4 h-4" />
            Conexão Protegida em Modo Somente Leitura
          </div>
          <p className="text-slate-400 leading-relaxed mb-2">
            Esta integração utiliza escopos de leitura estritos (<code className="text-blue-300">ads_read</code>, <code className="text-blue-300">public_profile</code>). O sistema nunca solicita <code className="text-rose-300">ads_management</code> e não realiza mutações nas suas campanhas.
          </p>
          {scopes.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              <span className="text-[10px] text-slate-500 font-mono uppercase">Escopos Concedidos:</span>
              {scopes.map((s) => (
                <span
                  key={s}
                  className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-mono"
                >
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Mensagens de Sucesso ou Erro */}
        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-4 rounded-xl text-xs mb-6 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-400" />
            <div className="space-y-2">
              <p className="font-semibold">{error}</p>
              <button
                onClick={() => router.push("/")}
                className="inline-flex items-center gap-1.5 text-xs text-rose-200 underline hover:text-white"
              >
                Voltar ao painel principal
              </button>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 p-4 rounded-xl text-xs mb-6 flex items-center gap-3">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <p className="font-medium">{successMsg}</p>
          </div>
        )}

        {/* Lista de Contas */}
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-400" />
            <p className="text-xs">Consultando contas acessíveis na Meta Graph API...</p>
          </div>
        ) : accounts.length === 0 && !error ? (
          <div className="py-10 text-center text-slate-400 text-xs space-y-3">
            <p>Nenhuma conta de anúncios foi localizada no perfil autorizado.</p>
            <p className="text-slate-500">
              Certifique-se de que sua conta do Facebook possui acesso a uma Conta de Anúncios no Meta Business Suite.
            </p>
            <button
              onClick={() => router.push("/")}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 rounded-lg text-xs font-medium"
            >
              Voltar ao Início
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {accounts.map((acc) => (
              <div
                key={acc.id}
                className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-700 transition-all"
              >
                <div className="space-y-1">
                  <div className="font-semibold text-white text-sm flex items-center gap-2">
                    {acc.name}
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      {acc.id}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 flex items-center gap-3">
                    <span>Moeda: <strong className="text-slate-200">{acc.currency}</strong></span>
                    <span>·</span>
                    <span>Fuso: <strong className="text-slate-200">{acc.timezone}</strong></span>
                  </div>
                </div>

                <button
                  onClick={() => handleSelectAccount(acc)}
                  disabled={submittingId !== null}
                  className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-md shadow-blue-500/20 transition-all"
                >
                  {submittingId === acc.id ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Vinculando...
                    </>
                  ) : (
                    <>
                      Conectar esta Conta
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            Tokens protegidos com criptografia de ponta a ponta (AES-256-GCM)
          </span>
          <button
            onClick={() => router.push("/")}
            className="hover:text-slate-300 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
