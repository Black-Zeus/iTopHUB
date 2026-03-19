import { useState, useContext } from "react";
import { useNavigate }          from "react-router-dom";
import { AuthContext }           from "../../App";
import { Button, Spinner }       from "../../ui";

const API_URL = import.meta.env.VITE_API_URL ?? "";

export function LoginPage() {
  const { login }    = useContext(AuthContext);
  const navigate     = useNavigate();

  const [form, setForm]       = useState({ username: "", password: "" });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Credenciales incorrectas");
      const data = await res.json();
      login(data.user, data.token);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err.message ?? "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell min-h-screen">
      {/* Layout de dos columnas del Draft */}
      <div className="login-layout mx-auto">

        {/* Panel izquierdo — brand */}
        <div className="brand-panel flex flex-col justify-between p-10">
          <div className="brand-top flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-lg font-bold text-white backdrop-blur-sm border border-white/30">
              IH
            </div>
            <div>
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-white/70">Gestión TI</p>
              <h1 className="text-base font-bold text-white">iTop Hub</h1>
            </div>
          </div>

          <div>
            <p className="eyebrow text-white/60">Plataforma operacional</p>
            <h2 className="mt-2 text-3xl font-bold leading-tight text-white">
              Trazabilidad y<br />gestión de activos TI
            </h2>
            <div className="highlight-grid mt-5 flex flex-col gap-2.5 max-w-sm">
              {[
                { title: "Actas digitales",    body: "Entrega y recepción de equipos con firma electrónica" },
                { title: "CMDB integrada",     body: "Sincronización en tiempo real con iTop" },
                { title: "Laboratorio TI",     body: "Registro técnico y trazabilidad de reparaciones" },
              ].map((c) => (
                <div key={c.title} className="rounded-2xl border border-white/18 bg-white/12 px-4 py-3 backdrop-blur-sm">
                  <strong className="block text-[0.76rem] uppercase tracking-[0.08em] text-white">{c.title}</strong>
                  <span className="mt-1 block text-sm text-white/85 leading-snug">{c.body}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Panel derecho — formulario */}
        <div className="login-panel-wrap flex items-center justify-center p-6">
          <div className="w-full max-w-[390px] rounded-[22px] border border-[rgba(196,212,228,0.9)] bg-white/82 px-[1.35rem] py-[1.25rem] shadow-[0_16px_38px_rgba(44,84,122,0.10)] backdrop-blur-sm dark:bg-[rgba(24,38,50,0.92)] dark:border-[rgba(39,65,82,0.9)]">

            <div className="mb-4 text-center">
              <h2 className="text-[1.55rem] font-bold tracking-tight text-[var(--text-primary)]">
                Iniciar sesión
              </h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Ingresa tus credenciales para continuar
              </p>
            </div>

            <form onSubmit={handleSubmit} className="grid gap-3">
              {/* Usuario */}
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold text-[var(--text-secondary)]">Usuario</span>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21a8 8 0 1 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
                    </svg>
                  </span>
                  <input
                    type="text" value={form.username} onChange={set("username")}
                    required autoComplete="username" placeholder="nombre.usuario"
                    className="w-full rounded-[11px] border border-[rgba(194,209,224,0.88)] bg-white/94 py-3 pl-10 pr-4 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--accent-strong)] focus:shadow-[0_0_0_4px_rgba(120,182,217,0.14)] dark:bg-[rgba(255,255,255,0.06)] dark:border-[var(--border-color)]"
                  />
                </div>
              </label>

              {/* Contraseña */}
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold text-[var(--text-secondary)]">Contraseña</span>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                  </span>
                  <input
                    type={showPwd ? "text" : "password"} value={form.password} onChange={set("password")}
                    required autoComplete="current-password"
                    className="w-full rounded-[11px] border border-[rgba(194,209,224,0.88)] bg-white/94 py-3 pl-10 pr-10 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--accent-strong)] focus:shadow-[0_0_0_4px_rgba(120,182,217,0.14)] dark:bg-[rgba(255,255,255,0.06)] dark:border-[var(--border-color)]"
                  />
                  <button
                    type="button" onClick={() => setShowPwd((v) => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] transition hover:text-[var(--text-secondary)]"
                    aria-label={showPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                      {showPwd
                        ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></>
                        : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
                      }
                    </svg>
                  </button>
                </div>
              </label>

              {/* Error */}
              {error && (
                <p className="rounded-[var(--radius-sm)] bg-[rgba(210,138,138,0.12)] px-3 py-2 text-sm text-[var(--danger)]">
                  {error}
                </p>
              )}

              {/* Submit */}
              <button
                type="submit" disabled={loading}
                className="mt-1 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-br from-[#3b82e6] to-[#336fd0] py-3 text-sm font-bold text-white shadow-[0_10px_22px_rgba(59,130,230,0.18)] transition hover:-translate-y-px hover:shadow-[0_14px_24px_rgba(59,130,230,0.22)] disabled:opacity-55 disabled:cursor-not-allowed"
              >
                {loading && <Spinner size="sm" />}
                {loading ? "Ingresando…" : "Ingresar"}
              </button>
            </form>

            {/* Nota de seguridad */}
            <div className="mt-4 rounded-[14px] border border-[rgba(201,216,231,0.9)] bg-[rgba(246,249,253,0.88)] px-4 py-3 dark:bg-[rgba(255,255,255,0.04)] dark:border-[var(--border-color)]">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Acceso restringido</h3>
              <p className="mt-0.5 text-xs text-[var(--text-muted)] leading-snug">
                Solo personal autorizado. El uso de este sistema queda registrado.
              </p>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}