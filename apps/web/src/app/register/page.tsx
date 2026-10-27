"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Zap, Lock, Mail, Building2, User, AlertCircle, ArrowRight, Loader2, CheckCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [orgType, setOrgType] = useState<"smb" | "agency">("smb");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessNotice(null);

    if (password.length < 8) {
      setErrorMessage("A senha deve ter no mínimo 8 caracteres.");
      return;
    }

    if (orgName.trim().length < 2) {
      setErrorMessage("O nome da organização deve ter pelo menos 2 caracteres.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      // 1. Criar Usuário no Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            initial_org_name: orgName.trim(),
            initial_org_type: orgType,
          },
        },
      });

      if (authError) {
        setErrorMessage(authError.message || "Falha ao criar conta. Tente novamente.");
        setLoading(false);
        return;
      }

      // Se a sessão já foi estabelecida imediatamente (email confirmation desabilitada para dev)
      if (authData.session) {
        // Criar organização vinculada ao usuário via RPC atômica
        const { error: rpcError } = await supabase.rpc("create_organization_with_owner", {
          org_name: orgName.trim(),
          org_type: orgType,
        });

        if (rpcError) {
          console.warn("Aviso ao criar organização inicial via RPC:", rpcError);
        }

        router.push("/");
        router.refresh();
      } else {
        // Confirmação de e-mail ativada
        setSuccessNotice(
          "Cadastro realizado com sucesso! Enviamos um link de confirmação para o seu e-mail."
        );
      }
    } catch (err: unknown) {
      setErrorMessage("Erro inesperado ao processar o cadastro.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Glow Effects */}
      <div className="absolute top-1/4 right-1/3 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg bg-slate-900/90 border border-slate-800 rounded-2xl p-8 shadow-2xl relative z-10 backdrop-blur-sm">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 mx-auto flex items-center justify-center shadow-lg shadow-blue-500/20 mb-3">
            <Zap className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Criar Conta na Plataforma</h1>
          <p className="text-xs text-slate-400 mt-1">
            Configure sua organização para gerenciar tráfego pago com governança e IA
          </p>
        </div>

        {errorMessage && (
          <div className="mb-5 p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">{errorMessage}</div>
          </div>
        )}

        {successNotice ? (
          <div className="p-6 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-center space-y-4">
            <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto" />
            <h3 className="text-base font-semibold text-white">Verifique seu e-mail</h3>
            <p className="text-xs text-slate-300 leading-relaxed">{successNotice}</p>
            <Link
              href="/login"
              className="inline-block bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors"
            >
              Ir para Tela de Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Seu Nome
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Raphael Silva"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  E-mail corporativo
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="raphael@empresa.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Nome da Organização
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    required
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="Minha Agência / Empresa"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Tipo de Operação
                </label>
                <select
                  value={orgType}
                  onChange={(e) => setOrgType(e.target.value as "smb" | "agency")}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="smb">PME (Gestão Própria)</option>
                  <option value="agency">Agência (Múltiplos Clientes)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Senha (mínimo 8 caracteres)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800/60 text-white font-semibold py-2.5 rounded-xl text-sm transition-all shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  Criando Organização e Conta...
                </>
              ) : (
                <>
                  Finalizar Cadastro
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        <div className="mt-6 text-center text-xs text-slate-400 border-t border-slate-800/80 pt-5">
          Já possui conta?{" "}
          <Link
            href="/login"
            className="text-blue-400 hover:text-blue-300 font-semibold transition-colors"
          >
            Fazer login
          </Link>
        </div>
      </div>
    </div>
  );
}
