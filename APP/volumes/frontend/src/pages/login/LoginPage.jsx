import { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext, ThemeContext } from "@/App";
import { Spinner } from "@ui";
import "@styles/login-page.css";

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
    <main className="login-shell">
      <button className="theme-toggle" type="button" aria-label="Cambiar tema" onClick={toggle}>
        Cambiar tema
      </button>

      <section className="login-layout" aria-label="Pantalla de acceso iTop Hub">
        <article className="brand-panel">
          <div>
            <div className="brand-top">
              <div className="brand-lockup">
                <div className="brand-mark" aria-hidden="true">
                  <span>IH</span>
                </div>
                <div>
                  <p className="eyebrow">Gestion TI</p>
                  <strong>iTop Hub</strong>
                </div>
              </div>
            </div>

            <div className="brand-copy">
              <h1>Acceso a iTop-Hub.</h1>
              <p>
                Aplicacion satelite orientada a extender la gestion de la CMDB en iTop
                mediante flujos operativos, documentales y de trazabilidad.
              </p>
            </div>

            <div className="highlight-grid" aria-label="Indicadores del portal">
              {highlightCards.map((card) => (
                <div key={card.title} className="highlight-card">
                  <strong>{card.title}</strong>
                  <span>{card.body}</span>
                </div>
              ))}
            </div>
          </div>
        </article>

        <article className="login-panel">
          <header className="login-header">
            <p className="eyebrow">Bienvenido</p>
            <h2>Inicia sesion</h2>
            <p>
              Accede con tus credenciales de iTop para operar la capa complementaria de
              gestion documental y trazabilidad.
            </p>
          </header>

          <form className="login-form" onSubmit={handleSubmit}>
            <label className="field login-field">
              <span>Correo o usuario</span>
              <div className="input-wrap">
                <div className="field-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
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
                />
              </div>
            </label>

            <label className="field login-field field-password">
              <span>Contrasena</span>
              <div className="input-wrap">
                <div className="field-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
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
                />
                <button
                  className="toggle-password"
                  type="button"
                  aria-label={showPassword ? "Ocultar contrasena" : "Mostrar contrasena"}
                  onClick={() => setShowPassword((currentValue) => !currentValue)}
                >
                  <svg viewBox="0 0 24 24">
                    <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" />
                    <circle cx="12" cy="12" r="2.8" />
                  </svg>
                </button>
              </div>
            </label>

            <div className="form-row">
              <label className="checkbox">
                <input
                  type="checkbox"
                  name="remember"
                  checked={rememberSession}
                  onChange={(event) => setRememberSession(event.target.checked)}
                />
                <span>Mantener sesion en este equipo</span>
              </label>
            </div>

            {error ? <p className="login-error">{error}</p> : null}

            <button className="primary-action" type="submit" disabled={loading}>
              {loading ? <Spinner size="sm" className="login-spinner" /> : null}
              <span>{loading ? "Accediendo..." : "Acceder al Hub"}</span>
            </button>
          </form>

          <aside className="security-note" aria-label="Nota de seguridad">
            <h3>Acceso restringido</h3>
            <p>
              Solucion complementaria para la operacion CMDB sobre Core iTop Combodo
              3.2.2-1, orientada a generar actas en PDF y registrar la gestion por
              integracion lateral.
            </p>
          </aside>

          <footer className="login-footer">
            <span>iTop-Hub v1</span>
            <span>Tecnocomp 2026</span>
          </footer>
        </article>
      </section>
    </main>
  );
}
