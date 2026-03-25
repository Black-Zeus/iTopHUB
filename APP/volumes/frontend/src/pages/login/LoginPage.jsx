import { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext, ThemeContext } from "@/App";
import { Spinner } from "@ui";

const highlightCards = [
  {
    title: "Finalidad",
    body: "Ampliar la funcionalidad de iTop con procesos complementarios asociados a la operacion CMDB.",
  },
  {
    title: "Alcance",
    body: "Gestion de actas de entrega, devolucion, ingreso a laboratorio y egreso operacional.",
  },
  {
    title: "Control",
    body: "Generacion de documentos PDF listos para su registro y vinculacion posterior dentro de iTop.",
  },
  {
    title: "Integracion",
    body: "Gestion lateral conectada con iTop para consolidar evidencia documental sin alterar su nucleo funcional.",
  },
];

const iconStrokeClass =
  "[&_circle]:fill-none [&_circle]:stroke-current [&_circle]:stroke-[1.9] [&_circle]:stroke-linecap-round [&_circle]:stroke-linejoin-round [&_path]:fill-none [&_path]:stroke-current [&_path]:stroke-[1.9] [&_path]:stroke-linecap-round [&_path]:stroke-linejoin-round";

const inputClass =
  "w-full rounded-[11px] border border-[rgba(194,209,224,0.88)] bg-white/95 px-4 py-[0.82rem] pl-[2.7rem] text-[var(--text-primary)] outline-none transition focus:border-[var(--accent-strong)] focus:shadow-[0_0_0_4px_rgba(120,182,217,0.14)] dark:border-[var(--border-color)] dark:bg-white/5";

export function LoginPage() {
  const { login } = useContext(AuthContext);
  const { toggle } = useContext(ThemeContext);
  const navigate = useNavigate();

  const [form, setForm] = useState({ username: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [rememberSession, setRememberSession] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const setField = (key) => (event) =>
    setForm((currentForm) => ({ ...currentForm, [key]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(form);
      navigate("/dashboard", { replace: true });
    } catch (submitError) {
      setError(submitError.message ?? "Error al iniciar sesion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative grid min-h-screen items-center overflow-hidden bg-[linear-gradient(180deg,#f2f6fb_0%,#e8f0f8_100%)] px-5 py-4 dark:bg-[linear-gradient(180deg,#0f1821_0%,#14202a_100%)]">
      <div className="pointer-events-none absolute -left-[10%] -top-[12%] h-[min(42vw,420px)] w-[min(42vw,420px)] rounded-full bg-white/75" />
      <div className="pointer-events-none absolute -bottom-[20%] -right-[16%] h-[min(48vw,520px)] w-[min(48vw,520px)] rounded-full bg-white/70" />

      <button
        className="absolute right-4 top-4 z-[2] rounded-full border border-[var(--border-color)] bg-white/90 px-4 py-2 text-[var(--text-primary)] shadow-[var(--shadow-subtle)] backdrop-blur-[10px] transition hover:-translate-y-px hover:bg-[var(--bg-hover)] dark:bg-[rgba(24,38,50,0.82)]"
        type="button"
        aria-label="Cambiar tema"
        onClick={toggle}
      >
        Cambiar tema
      </button>

      <section
        className="relative z-[1] mx-auto grid h-[min(680px,calc(100vh-2rem))] w-full max-w-[1180px] overflow-hidden rounded-[28px] bg-[linear-gradient(112deg,#5c9de7_0%,#84baeb_43%,#f8fbff_43%,#f8fbff_100%)] shadow-[0_24px_52px_rgba(45,86,122,0.12)] dark:bg-[linear-gradient(112deg,#1c4d7e_0%,#315f91_43%,#182632_43%,#182632_100%)] dark:shadow-[0_28px_60px_rgba(0,0,0,0.28)] max-[1080px]:h-auto max-[1080px]:grid-cols-1 max-[1080px]:bg-[linear-gradient(180deg,#4f96e6_0%,#78b7ee_38%,#f7fbff_38%,#f7fbff_100%)] dark:max-[1080px]:bg-[linear-gradient(180deg,#1c4d7e_0%,#315f91_38%,#182632_38%,#182632_100%)] [grid-template-columns:minmax(0,1.06fr)_minmax(360px,410px)]"
        aria-label="Pantalla de acceso iTop Hub"
      >
        <div className="pointer-events-none absolute bottom-[-16%] left-[41%] h-[34%] w-[72%] rotate-[8deg] rounded-[50%_0_0_0] bg-[linear-gradient(180deg,rgba(168,211,245,0.34),rgba(168,211,245,0))]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_64%,rgba(255,255,255,0.06),transparent_22%),radial-gradient(circle_at_78%_24%,rgba(120,182,217,0.05),transparent_16%)]" />

        <article className="relative z-[1] flex min-h-full flex-col justify-between bg-[linear-gradient(180deg,rgba(255,255,255,0.07),transparent_28%)] px-8 py-7 text-[#f8fbff] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent_35%),linear-gradient(145deg,rgba(24,38,50,0.12)_0%,rgba(24,38,50,0.02)_100%)] max-[1080px]:gap-8 max-[720px]:px-5 max-[720px]:py-5">
          <div>
            <div className="flex items-start justify-between gap-6 max-[720px]:flex-col max-[720px]:items-start">
              <div className="flex items-center gap-4">
                <div className="relative grid h-14 w-14 place-items-center rounded-[18px] bg-[linear-gradient(135deg,rgba(255,255,255,0.97)_0%,rgba(238,246,253,0.94)_100%)] font-bold text-[#315f91] shadow-[0_12px_24px_rgba(35,85,136,0.1)] before:absolute before:inset-[-7px] before:rotate-[8deg] before:rounded-[22px] before:border before:border-white/25 before:content-['']">
                  <span className="relative">IH</span>
                </div>
                <div>
                  <p className="eyebrow text-white/80">Gestion TI</p>
                  <strong className="text-2xl font-bold text-[#f8fbff]">iTop Hub</strong>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <h1 className="text-[clamp(2rem,3vw,3.2rem)] font-bold leading-[0.98] tracking-[-0.04em] text-[#f8fbff] max-[720px]:mt-4 max-[720px]:whitespace-normal">
                Acceso a iTop-Hub.
              </h1>
              <p className="mt-4 max-w-[44ch] text-[0.96rem] leading-[1.55] text-[#f8fbff] opacity-90">
                Aplicacion satelite orientada a extender la gestion de la CMDB en iTop
                mediante flujos operativos, documentales y de trazabilidad.
              </p>
            </div>

            <div className="mt-5 flex max-w-[410px] flex-col gap-3 max-[720px]:max-w-none" aria-label="Indicadores del portal">
              {highlightCards.map((card) => (
                <div
                  key={card.title}
                  className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur-[4px] dark:border-[rgba(39,65,82,0.9)] dark:bg-[rgba(21,33,44,0.55)]"
                >
                  <strong className="block text-[0.76rem] uppercase tracking-[0.08em] text-[#f8fbff]">
                    {card.title}
                  </strong>
                  <span className="mt-1 block text-[0.88rem] leading-[1.4] text-[rgba(248,251,255,0.9)]">
                    {card.body}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </article>

        <article className="relative z-[1] my-auto ml-[-1.25rem] w-[min(calc(100%-2rem),390px)] self-center rounded-[22px] border border-[rgba(196,212,228,0.9)] bg-white/80 px-[1.35rem] py-[1.35rem] shadow-[0_16px_38px_rgba(44,84,122,0.1)] backdrop-blur-[10px] dark:border-[rgba(39,65,82,0.9)] dark:bg-[rgba(24,38,50,0.92)] dark:shadow-[0_18px_45px_rgba(0,0,0,0.3)] max-[1080px]:mb-6 max-[1080px]:ml-auto max-[1080px]:mr-auto max-[720px]:w-[calc(100%-1.5rem)] max-[720px]:px-4 max-[720px]:py-5">
          <header className="mb-4 text-center max-[720px]:text-left">
            <p className="eyebrow">Bienvenido</p>
            <h2 className="mb-1 text-[1.55rem] font-bold tracking-[-0.04em]">Inicia sesion</h2>
            <p className="mx-auto max-w-[28ch] text-[0.92rem] leading-[1.45] text-[#5a748c] dark:text-[var(--text-secondary)] max-[720px]:mx-0">
              Accede con tus credenciales de iTop para operar la capa complementaria de
              gestion documental y trazabilidad.
            </p>
          </header>

          <form className="grid gap-3" onSubmit={handleSubmit}>
            <label className="field flex flex-col gap-1.5">
              <span className="text-[0.9rem] font-semibold text-[#4f6880] dark:text-[var(--text-secondary)]">
                Correo o usuario
              </span>
              <div className="relative">
                <div className={`pointer-events-none absolute left-[0.9rem] top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[var(--text-muted)] ${iconStrokeClass}`} aria-hidden="true">
                  <svg viewBox="0 0 24 24" className="h-full w-full">
                    <path d="M4 7.5h16v9H4z" />
                    <path d="m5.5 8.5 6.5 5 6.5-5" />
                  </svg>
                </div>
                <input
                  type="text"
                  name="username"
                  value={form.username}
                  onChange={setField("username")}
                  placeholder="victor.soto o usuario@dominio"
                  autoComplete="username"
                  required
                  className={inputClass}
                />
              </div>
            </label>

            <label className="field flex flex-col gap-1.5">
              <span className="text-[0.9rem] font-semibold text-[#4f6880] dark:text-[var(--text-secondary)]">
                Contrasena
              </span>
              <div className="relative">
                <div className={`pointer-events-none absolute left-[0.9rem] top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[var(--text-muted)] ${iconStrokeClass}`} aria-hidden="true">
                  <svg viewBox="0 0 24 24" className="h-full w-full">
                    <path d="M7.5 10V8a4.5 4.5 0 1 1 9 0v2" />
                    <path d="M5 10.5h14v9H5z" />
                    <circle cx="12" cy="15" r="1.2" />
                  </svg>
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={form.password}
                  onChange={setField("password")}
                  placeholder="Ingresa tu contrasena"
                  autoComplete="current-password"
                  required
                  className={`${inputClass} pr-[2.8rem]`}
                />
                <button
                  className={`absolute right-[0.9rem] top-1/2 h-[18px] w-[18px] -translate-y-1/2 border-0 bg-transparent p-0 text-[var(--text-muted)] ${iconStrokeClass}`}
                  type="button"
                  aria-label={showPassword ? "Ocultar contrasena" : "Mostrar contrasena"}
                  onClick={() => setShowPassword((currentValue) => !currentValue)}
                >
                  <svg viewBox="0 0 24 24" className="h-full w-full">
                    <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" />
                    <circle cx="12" cy="12" r="2.8" />
                  </svg>
                </button>
              </div>
            </label>

            <div className="flex items-center justify-start gap-4 text-[0.9rem] text-[var(--text-secondary)] max-[720px]:flex-col max-[720px]:items-start">
              <label className="inline-flex cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  name="remember"
                  checked={rememberSession}
                  onChange={(event) => setRememberSession(event.target.checked)}
                  className="m-0 h-4 w-4 accent-[var(--accent-strong)]"
                />
                <span>Mantener sesion en este equipo</span>
              </label>
            </div>

            {error ? (
              <p className="m-0 rounded-[var(--radius-sm)] bg-[rgba(210,138,138,0.12)] px-4 py-3 text-[0.88rem] text-[var(--danger)]">
                {error}
              </p>
            ) : null}

            <button
              className="mt-1 inline-flex items-center justify-center gap-2 rounded-full border-0 bg-[linear-gradient(135deg,#3b82e6_0%,#336fd0_100%)] px-4 py-[0.82rem] font-bold tracking-[0.03em] text-white shadow-[0_10px_22px_rgba(59,130,230,0.18)] transition hover:-translate-y-px hover:shadow-[0_14px_24px_rgba(59,130,230,0.22)] disabled:cursor-not-allowed disabled:opacity-70 disabled:transform-none"
              type="submit"
              disabled={loading}
            >
              {loading ? <Spinner size="sm" className="shrink-0" /> : null}
              <span>{loading ? "Accediendo..." : "Acceder al Hub"}</span>
            </button>
          </form>

          <aside className="mt-4 rounded-[14px] border border-[rgba(201,216,231,0.9)] bg-[rgba(246,249,253,0.88)] px-4 py-3 dark:border-[var(--border-color)] dark:bg-white/5" aria-label="Nota de seguridad">
            <h3 className="mb-1 text-[0.84rem] font-semibold">Acceso restringido</h3>
            <p className="text-[0.85rem] leading-[1.42] text-[#60788f] dark:text-[var(--text-secondary)]">
              Solucion complementaria para la operacion CMDB sobre Core iTop Combodo
              3.2.2-1, orientada a generar actas en PDF y registrar la gestion por
              integracion lateral.
            </p>
          </aside>

          <footer className="mt-3 flex justify-center gap-4 text-[0.8rem] text-[var(--text-muted)] max-[720px]:flex-col max-[720px]:items-start">
            <span>iTop-Hub v1</span>
            <span>Tecnocomp 2026</span>
          </footer>
        </article>
      </section>
    </main>
  );
}
