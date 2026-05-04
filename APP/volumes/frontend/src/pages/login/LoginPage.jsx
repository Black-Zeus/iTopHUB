import { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext, ThemeContext } from "@/App";
import { Spinner } from "@ui";
import { getDefaultRoute } from "@services/authz-service";
import { fetchBootstrapStatus } from "@services/auth-session-service";

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

const wizardSteps = [
  {
    number: "1",
    title: "Ruta iTop",
    body: "La URL base se guarda como configuracion activa y el Hub deriva desde ahi la ruta REST.",
  },
  {
    number: "2",
    title: "Admin iTop",
    body: "Las credenciales del administrador se validan contra iTop antes de crear cualquier usuario local.",
  },
  {
    number: "3",
    title: "Token personal",
    body: "El token del administrador se cifra en backend y se usa para iniciar la primera sesion con acceso completo.",
  },
];

const iconStrokeClass =
  "[&_circle]:fill-none [&_circle]:stroke-current [&_circle]:stroke-[1.9] [&_circle]:stroke-linecap-round [&_circle]:stroke-linejoin-round [&_path]:fill-none [&_path]:stroke-current [&_path]:stroke-[1.9] [&_path]:stroke-linecap-round [&_path]:stroke-linejoin-round";

const inputClass =
  "w-full rounded-[11px] border border-[rgba(184,202,216,0.92)] bg-[rgba(238,244,248,0.94)] px-4 py-[0.82rem] pl-[2.7rem] text-[var(--text-primary)] outline-none transition focus:border-[var(--accent-strong)] focus:bg-[rgba(244,248,251,0.98)] focus:shadow-[0_0_0_4px_rgba(120,182,217,0.12)] dark:border-[var(--border-color)] dark:bg-white/5";

const wizardInputClass =
  "w-full rounded-[11px] border border-[rgba(184,202,216,0.92)] bg-[rgba(238,244,248,0.94)] px-4 py-[0.82rem] text-[var(--text-primary)] outline-none transition focus:border-[var(--accent-strong)] focus:bg-[rgba(244,248,251,0.98)] focus:shadow-[0_0_0_4px_rgba(120,182,217,0.12)] dark:border-[var(--border-color)] dark:bg-white/5";

function SecurityNote({ title, body }) {
  return (
    <aside
      className="mt-4 rounded-[14px] border border-[rgba(190,205,218,0.94)] bg-[rgba(232,239,245,0.9)] px-4 py-3 dark:border-[var(--border-color)] dark:bg-white/5"
      aria-label="Nota de seguridad"
    >
      <h3 className="mb-1 text-[0.84rem] font-semibold text-[#20394f] dark:text-[var(--text-primary)]">{title}</h3>
      <p className="text-[0.85rem] leading-[1.42] text-[#526c84] dark:text-[var(--text-secondary)]">{body}</p>
    </aside>
  );
}

export function LoginPage() {
  const { login, bootstrapFirstAdmin } = useContext(AuthContext);
  const { toggle } = useContext(ThemeContext);
  const navigate = useNavigate();

  const [form, setForm] = useState({ username: "", password: "" });
  const [wizardForm, setWizardForm] = useState({
    integrationUrl: "",
    username: "",
    password: "",
    tokenValue: "",
    verifySsl: true,
    timeoutSeconds: 30,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showWizardPassword, setShowWizardPassword] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [bootstrapLoading, setBootstrapLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);

  useEffect(() => {
    let active = true;

    const loadBootstrapStatus = async () => {
      try {
        const payload = await fetchBootstrapStatus();
        if (!active) {
          return;
        }

        setSetupRequired(Boolean(payload?.setupRequired));
        setWizardForm((current) => ({
          ...current,
          integrationUrl: payload?.config?.integrationUrl || current.integrationUrl,
          verifySsl: payload?.config?.verifySsl ?? current.verifySsl,
          timeoutSeconds: payload?.config?.timeoutSeconds ?? current.timeoutSeconds,
        }));
      } catch (statusError) {
        if (!active) {
          return;
        }
        setError(statusError?.message || "No fue posible consultar el estado inicial del Hub.");
      } finally {
        if (active) {
          setBootstrapLoading(false);
        }
      }
    };

    loadBootstrapStatus();
    return () => {
      active = false;
    };
  }, []);

  const setField = (key) => (event) =>
    setForm((currentForm) => ({ ...currentForm, [key]: event.target.value }));

  const setWizardField = (key) => (event) =>
    setWizardForm((currentForm) => ({ ...currentForm, [key]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const session = await login(form);
      navigate(getDefaultRoute(session.user), { replace: true });
    } catch (submitError) {
      setError(submitError.message ?? "Error al iniciar sesion");
    } finally {
      setLoading(false);
    }
  };

  const handleBootstrapSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const session = await bootstrapFirstAdmin(wizardForm);
      navigate(getDefaultRoute(session.user), { replace: true });
    } catch (submitError) {
      setError(submitError.message ?? "No fue posible crear el primer administrador.");
    } finally {
      setLoading(false);
    }
  };

  const normalizedIntegrationUrl = (wizardForm.integrationUrl || "").trim().replace(/\/$/, "");
  const derivedApiUrl = normalizedIntegrationUrl
    ? `${normalizedIntegrationUrl}/webservices/rest.php`
    : "Se completará cuando indiques la IP o URL base de iTop";

  return (
    <main className="relative grid min-h-screen items-center overflow-hidden bg-[linear-gradient(180deg,#d7e2ea_0%,#cedbe4_100%)] px-5 py-4 dark:bg-[linear-gradient(180deg,#0f1821_0%,#14202a_100%)]">
      <div className="pointer-events-none absolute -left-[12%] -top-[16%] h-[min(44vw,460px)] w-[min(44vw,460px)] rounded-full bg-[rgba(246,249,252,0.56)]" />
      <div className="pointer-events-none absolute -bottom-[26%] -right-[14%] h-[min(50vw,560px)] w-[min(50vw,560px)] rounded-full bg-[rgba(240,246,250,0.5)]" />

      <button
        className="absolute right-4 top-4 z-[2] rounded-full border border-[var(--border-color)] bg-[rgba(239,245,249,0.94)] px-4 py-2 text-[var(--text-primary)] shadow-[var(--shadow-subtle)] backdrop-blur-[10px] transition hover:-translate-y-px hover:bg-[var(--bg-hover)] dark:bg-[rgba(24,38,50,0.82)]"
        type="button"
        aria-label="Cambiar tema"
        onClick={toggle}
      >
        Cambiar tema
      </button>

      <section
        className="relative z-[1] mx-auto grid h-[min(680px,calc(100vh-2rem))] w-full max-w-[1180px] overflow-hidden rounded-[28px] bg-[linear-gradient(111deg,#5d9bdd_0%,#7eb1dd_36%,#eef4f8_36%,#eef4f8_100%)] shadow-[0_24px_52px_rgba(45,86,122,0.12)] dark:bg-[linear-gradient(112deg,#1c4d7e_0%,#315f91_43%,#182632_43%,#182632_100%)] dark:shadow-[0_28px_60px_rgba(0,0,0,0.28)] max-[1080px]:h-auto max-[1080px]:grid-cols-1 max-[1080px]:bg-[linear-gradient(180deg,#4f96e6_0%,#78b7ee_38%,#eaf1f6_38%,#eaf1f6_100%)] dark:max-[1080px]:bg-[linear-gradient(180deg,#1c4d7e_0%,#315f91_38%,#182632_38%,#182632_100%)] [grid-template-columns:minmax(0,1.08fr)_minmax(360px,410px)]"
        aria-label="Pantalla de acceso iTop Hub"
      >
        <div className="pointer-events-none absolute bottom-[-14%] left-[40%] h-[34%] w-[72%] rotate-[8deg] rounded-[50%_0_0_0] bg-[linear-gradient(180deg,rgba(168,211,245,0.24),rgba(168,211,245,0))]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_64%,rgba(255,255,255,0.06),transparent_22%),radial-gradient(circle_at_78%_24%,rgba(120,182,217,0.04),transparent_16%)]" />

        <article className="relative z-[1] flex min-h-full flex-col justify-between bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent_28%)] px-8 py-7 text-[#f8fbff] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent_35%),linear-gradient(145deg,rgba(24,38,50,0.12)_0%,rgba(24,38,50,0.02)_100%)] max-[1080px]:gap-8 max-[720px]:px-5 max-[720px]:py-5">
          <div>
            <div className="flex items-start justify-between gap-6 max-[720px]:flex-col max-[720px]:items-start">
              <div className="flex items-center gap-4">
                <div className="relative grid h-14 w-14 place-items-center rounded-[18px] bg-[linear-gradient(135deg,rgba(255,255,255,0.97)_0%,rgba(238,246,253,0.94)_100%)] font-bold text-[#315f91] shadow-[0_12px_24px_rgba(35,85,136,0.1)] before:absolute before:inset-[-7px] before:rotate-[8deg] before:rounded-[22px] before:border before:border-white/25 before:content-['']">
                  <span className="relative">IH</span>
                </div>
                <div>
                  <p className="eyebrow text-white/90">Gestion TI</p>
                  <strong className="text-2xl font-bold text-white drop-shadow-[0_1px_2px_rgba(32,73,110,0.18)]">iTop Hub</strong>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <h1 className="text-[clamp(2rem,3vw,3.2rem)] font-bold leading-[0.98] tracking-[-0.04em] text-white drop-shadow-[0_2px_4px_rgba(35,84,128,0.18)] max-[720px]:mt-4 max-[720px]:whitespace-normal">
                {setupRequired ? "Primera configuracion de iTop-Hub." : "Acceso a iTop-Hub."}
              </h1>
              <p className="mt-4 max-w-[44ch] text-[0.96rem] font-medium leading-[1.55] text-[rgba(248,251,255,0.98)] drop-shadow-[0_1px_2px_rgba(35,84,128,0.12)]">
                {setupRequired
                  ? "Define la conexion con iTop y registra al primer administrador local sin depender de inserts manuales."
                  : "Aplicacion satelite orientada a extender la gestion de la CMDB en iTop mediante flujos operativos, documentales y de trazabilidad."}
              </p>
            </div>

            <div className="mt-5 flex max-w-[390px] flex-col gap-3 max-[720px]:max-w-none" aria-label="Indicadores del portal">
              {(setupRequired ? wizardSteps : highlightCards).map((card) => (
                <div
                  key={card.title}
                  className="rounded-2xl border border-[rgba(255,255,255,0.28)] bg-[rgba(93,150,210,0.34)] px-4 py-3 backdrop-blur-[6px] dark:border-[rgba(39,65,82,0.9)] dark:bg-[rgba(21,33,44,0.55)]"
                >
                  {"number" in card ? (
                    <span className="mb-2 inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/35 bg-white/10 text-[0.82rem] font-bold text-white">
                      {card.number}
                    </span>
                  ) : null}
                  <strong className="block text-[0.76rem] uppercase tracking-[0.08em] text-white [text-shadow:0_1px_2px_rgba(16,36,54,0.55)]">
                    {card.title}
                  </strong>
                  <span className="mt-1 block text-[0.88rem] font-semibold leading-[1.45] text-white [text-shadow:0_1px_2px_rgba(16,36,54,0.52)]">
                    {card.body}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </article>

        <article className="relative z-[1] my-auto mr-12 w-[min(calc(100%-2rem),382px)] self-center rounded-[24px] border border-[rgba(181,199,214,0.98)] bg-[rgba(239,245,249,0.92)] px-[1.35rem] py-[1.45rem] shadow-[0_18px_42px_rgba(44,84,122,0.1)] backdrop-blur-[10px] dark:border-[rgba(39,65,82,0.9)] dark:bg-[rgba(24,38,50,0.92)] dark:shadow-[0_18px_45px_rgba(0,0,0,0.3)] max-[1080px]:mb-6 max-[1080px]:ml-auto max-[1080px]:mr-auto max-[720px]:w-[calc(100%-1.5rem)] max-[720px]:px-4 max-[720px]:py-5">
          {bootstrapLoading ? (
            <div className="flex min-h-[360px] flex-col items-center justify-center gap-4 text-center">
              <Spinner size="md" className="shrink-0" />
              <div>
                <p className="eyebrow">Preparando acceso</p>
                <h2 className="text-[1.4rem] font-bold tracking-[-0.04em] text-[#1a3349] dark:text-[var(--text-primary)]">
                  Revisando estado del Hub
                </h2>
                <p className="mt-2 text-[0.92rem] leading-[1.45] text-[#4f6982] dark:text-[var(--text-secondary)]">
                  Estamos verificando si corresponde mostrar inicio de sesion normal o el wizard inicial.
                </p>
              </div>
            </div>
          ) : setupRequired ? (
            <>
              <header className="mb-4 text-center max-[720px]:text-left">
                <p className="eyebrow">Bootstrap inicial</p>
                <h2 className="mb-1 text-[1.55rem] font-bold tracking-[-0.04em] text-[#1a3349] dark:text-[var(--text-primary)]">
                  Crear primer administrador
                </h2>
                <p className="mx-auto max-w-[30ch] text-[0.92rem] leading-[1.45] text-[#4f6982] dark:text-[var(--text-secondary)] max-[720px]:mx-0">
                  Ingresa la ruta de iTop, las credenciales del administrador y su token personal para dejar el Hub operativo.
                </p>
              </header>

              <form className="grid gap-3" onSubmit={handleBootstrapSubmit}>
                <label className="field flex flex-col gap-1.5">
                  <span className="text-[0.9rem] font-semibold text-[#46627c] dark:text-[var(--text-secondary)]">
                    URL base de iTop
                  </span>
                  <input
                    type="url"
                    name="integrationUrl"
                    value={wizardForm.integrationUrl}
                    onChange={setWizardField("integrationUrl")}
                    placeholder="http://192.168.1.50 o http://itop-servidor"
                    required
                    className={wizardInputClass}
                  />
                  <span className="text-[0.78rem] leading-[1.4] text-[#688199] dark:text-[var(--text-muted)]">
                    Ruta REST derivada: <strong>{derivedApiUrl}</strong>
                  </span>
                </label>

                <label className="field flex flex-col gap-1.5">
                  <span className="text-[0.9rem] font-semibold text-[#46627c] dark:text-[var(--text-secondary)]">
                    Usuario administrador iTop
                  </span>
                  <input
                    type="text"
                    name="wizard-username"
                    value={wizardForm.username}
                    onChange={setWizardField("username")}
                    placeholder="usuario.admin"
                    autoComplete="username"
                    required
                    className={wizardInputClass}
                  />
                </label>

                <label className="field flex flex-col gap-1.5">
                  <span className="text-[0.9rem] font-semibold text-[#46627c] dark:text-[var(--text-secondary)]">
                    Contrasena administrador iTop
                  </span>
                  <div className="relative">
                    <input
                      type={showWizardPassword ? "text" : "password"}
                      name="wizard-password"
                      value={wizardForm.password}
                      onChange={setWizardField("password")}
                      placeholder="Ingresa la contrasena del administrador"
                      autoComplete="current-password"
                      required
                      className={`${wizardInputClass} pr-[2.8rem]`}
                    />
                    <button
                      className={`absolute right-[0.9rem] top-1/2 h-[18px] w-[18px] -translate-y-1/2 border-0 bg-transparent p-0 text-[var(--text-muted)] ${iconStrokeClass}`}
                      type="button"
                      aria-label={showWizardPassword ? "Ocultar contrasena" : "Mostrar contrasena"}
                      onClick={() => setShowWizardPassword((currentValue) => !currentValue)}
                    >
                      <svg viewBox="0 0 24 24" className="h-full w-full">
                        <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" />
                        <circle cx="12" cy="12" r="2.8" />
                      </svg>
                    </button>
                  </div>
                </label>

                <label className="field flex flex-col gap-1.5">
                  <span className="text-[0.9rem] font-semibold text-[#46627c] dark:text-[var(--text-secondary)]">
                    Token personal iTop
                  </span>
                  <div className="relative">
                    <input
                      type={showToken ? "text" : "password"}
                      name="wizard-token"
                      value={wizardForm.tokenValue}
                      onChange={setWizardField("tokenValue")}
                      placeholder="Pega aqui el token del administrador"
                      autoComplete="off"
                      required
                      className={`${wizardInputClass} pr-[2.8rem]`}
                    />
                    <button
                      className={`absolute right-[0.9rem] top-1/2 h-[18px] w-[18px] -translate-y-1/2 border-0 bg-transparent p-0 text-[var(--text-muted)] ${iconStrokeClass}`}
                      type="button"
                      aria-label={showToken ? "Ocultar token" : "Mostrar token"}
                      onClick={() => setShowToken((currentValue) => !currentValue)}
                    >
                      <svg viewBox="0 0 24 24" className="h-full w-full">
                        <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" />
                        <circle cx="12" cy="12" r="2.8" />
                      </svg>
                    </button>
                  </div>
                </label>

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
                  <span>{loading ? "Configurando..." : "Configurar y entrar al Hub"}</span>
                </button>
              </form>

              <SecurityNote
                title="Instalacion vacia detectada"
                body="Este wizard solo aparece mientras no existan usuarios en el Hub. Al finalizar, se crea el primer administrador local y se inicia la sesion en la misma operacion."
              />
            </>
          ) : (
            <>
              <header className="mb-4 text-center max-[720px]:text-left">
                <p className="eyebrow">Bienvenido</p>
                <h2 className="mb-1 text-[1.55rem] font-bold tracking-[-0.04em] text-[#1a3349] dark:text-[var(--text-primary)]">
                  Inicia sesion
                </h2>
                <p className="mx-auto max-w-[28ch] text-[0.92rem] leading-[1.45] text-[#4f6982] dark:text-[var(--text-secondary)] max-[720px]:mx-0">
                  Accede con tus credenciales de iTop para operar la capa complementaria de gestion documental y trazabilidad.
                </p>
              </header>

              <form className="grid gap-3" onSubmit={handleSubmit}>
                <label className="field flex flex-col gap-1.5">
                  <span className="text-[0.9rem] font-semibold text-[#46627c] dark:text-[var(--text-secondary)]">
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
                      placeholder="usuario.itop o usuario@dominio"
                      autoComplete="username"
                      required
                      className={inputClass}
                    />
                  </div>
                </label>

                <label className="field flex flex-col gap-1.5">
                  <span className="text-[0.9rem] font-semibold text-[#46627c] dark:text-[var(--text-secondary)]">
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

              <SecurityNote
                title="Acceso restringido"
                body="Solucion complementaria para la operacion CMDB sobre Core iTop Combodo 3.2.2-1, orientada a generar actas en PDF y registrar la gestion por integracion lateral."
              />
            </>
          )}

          <footer className="mt-3 flex justify-center gap-4 text-[0.8rem] text-[#6a8197] dark:text-[var(--text-muted)] max-[720px]:flex-col max-[720px]:items-start">
            <span>iTop-Hub v1</span>
            <span>Tecnocomp 2026</span>
          </footer>
        </article>
      </section>
    </main>
  );
}
