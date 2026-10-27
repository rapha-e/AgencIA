"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Zap, Mail, ArrowLeft, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sentNotice, setSentNotice] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const origin = window.location.origin;

      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${origin}/auth/callback?next=/reset-password`,
      });

      if (error) {
        setErrorMessage(error.message || "Não foi possível enviar o e-mail de recuperação.");
        return;
      }

      setSentNotice(true);
    } catch {
      setErrorMessage("Erro inesperado ao solicitar redefinição de senha.");
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
          <h1 className="text-xl font-bold tracking-tight text-white">Recuperação de Senha</h1>
          <p className="text-xs text-slate-400 mt-1">
            Informe seu e-mail para receber as instruções de redefinição
          </p>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {sentNotice ? (
          <div className="p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center space-y-3">
            <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto" />
            <h3 className="text-sm font-semibold text-white">E-mail enviado!</h3>
            <p className="text-xs text-slate-300">
              Se houver uma conta associada a <strong>{email}</strong>, você receberá um link de redefinição em instantes.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-semibold pt-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                E-mail cadastrado
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu.email@empresa.com"
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
                  Enviando link...
                </>
              ) : (
                "Enviar link de redefinição"
              )}
            </button>

            <div className="text-center pt-2">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao Login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
