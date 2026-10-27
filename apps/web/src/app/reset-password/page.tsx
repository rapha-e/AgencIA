"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Zap, Lock, AlertCircle, Loader2, CheckCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (password.length < 8) {
      setErrorMessage("A nova senha deve ter no mínimo 8 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("As senhas informadas não coincidem.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        setErrorMessage(error.message || "Erro ao redefinir a senha.");
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/login?message=password_updated");
      }, 2000);
    } catch {
      setErrorMessage("Erro inesperado ao salvar a nova senha.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl p-8 shadow-2xl relative z-10">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 mx-auto flex items-center justify-center shadow-lg shadow-blue-500/20 mb-3">
            <Zap className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white">Criar Nova Senha</h1>
          <p className="text-xs text-slate-400 mt-1">
            Defina uma senha segura para a sua conta
          </p>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {success ? (
          <div className="p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center space-y-3">
            <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto" />
            <h3 className="text-sm font-semibold text-white">Senha alterada com sucesso!</h3>
            <p className="text-xs text-slate-300">Redirecionando para o login em instantes...</p>
          </div>
        ) : (
          <form onSubmit={handleUpdate} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Nova Senha (mín. 8 caracteres)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Confirmar Nova Senha
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800/60 text-white font-semibold py-2.5 rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  Salvando nova senha...
                </>
              ) : (
                "Atualizar Senha"
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
