/** @type {import('tailwindcss').Config} */

const semanticTone = {
  info: {
    background: "var(--accent-soft)",
    color: "var(--accent-strong)",
  },
  success: {
    background: "rgba(127, 191, 156, 0.14)",
    color: "var(--success)",
  },
  warning: {
    background: "rgba(224, 181, 107, 0.14)",
    color: "var(--warning)",
  },
  danger: {
    background: "rgba(210, 138, 138, 0.14)",
    color: "var(--danger)",
  },
};

export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: ["class", '[data-theme="dark"]'],
  theme: {
    fontSize: {
      "2xs": ["0.72rem", { lineHeight: "1rem", letterSpacing: "0.08em" }],
      xs: ["0.75rem", { lineHeight: "1.1rem" }],
      sm: ["0.84rem", { lineHeight: "1.35rem" }],
      base: ["0.92rem", { lineHeight: "1.55rem" }],
      md: ["1rem", { lineHeight: "1.6rem" }],
      lg: ["1.25rem", { lineHeight: "1.65rem" }],
      xl: ["1.55rem", { lineHeight: "1.3" }],
      "2xl": ["1.7rem", { lineHeight: "1.25" }],
      "3xl": ["2rem", { lineHeight: "1.2" }],
      "4xl": ["2.5rem", { lineHeight: "1.15" }],
    },
    extend: {
      colors: {
        app: "var(--bg-app)",
        surface: "var(--bg-surface)",
        panel: "var(--bg-panel)",
        "panel-muted": "var(--bg-panel-muted)",
        sidebar: "var(--bg-sidebar)",
        hover: "var(--bg-hover)",
        border: "var(--border-color)",
        "border-strong": "var(--border-strong)",
        foreground: "var(--text-primary)",
        muted: "var(--text-secondary)",
        subtle: "var(--text-muted)",
        accent: "var(--accent)",
        "accent-strong": "var(--accent-strong)",
        "accent-soft": "var(--accent-soft)",
        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--danger)",
        info: "var(--info)",
      },
      fontFamily: {
        base: ['"Segoe UI"', "Tahoma", "Geneva", "Verdana", "sans-serif"],
        sans: ['"Segoe UI"', "Tahoma", "Geneva", "Verdana", "sans-serif"],
      },
      borderRadius: {
        xs: "6px",
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "28px",
      },
      boxShadow: {
        subtle: "var(--shadow-subtle)",
        soft: "var(--shadow-soft)",
        login: "0 24px 52px rgba(45, 86, 122, 0.12)",
        "login-dark": "0 28px 60px rgba(0, 0, 0, 0.28)",
        btn: "0 10px 22px rgba(59, 130, 230, 0.18)",
        "btn-hover": "0 14px 24px rgba(59, 130, 230, 0.22)",
        accent: "0 10px 22px rgba(81, 152, 194, 0.18)",
      },
      spacing: {
        1.5: "0.35rem",
        2.5: "0.6rem",
      },
      gridTemplateColumns: {
        "app-shell": "280px minmax(0, 1fr)",
        "app-shell-collapsed": "112px minmax(0, 1fr)",
        login: "minmax(0, 1.06fr) minmax(360px, 410px)",
        module: "repeat(2, minmax(0, 1fr))",
        kpi: "repeat(4, minmax(0, 1fr))",
        summary: "repeat(2, minmax(0, 1fr))",
        detail: "repeat(2, minmax(0, 1fr))",
        evidence: "repeat(2, minmax(0, 1fr))",
      },
      width: {
        "sidebar-open": "280px",
        "sidebar-collapsed": "112px",
        "brand-mark": "58px",
        "brand-mark-sm": "56px",
        "nav-icon": "20px",
        "nav-icon-lg": "24px",
      },
      height: {
        sidebar: "100vh",
        "brand-mark": "58px",
        "brand-mark-sm": "56px",
        "nav-icon": "20px",
        "nav-icon-lg": "24px",
      },
      minHeight: {
        sidebar: "100vh",
        "summary-card": "140px",
        "evidence-card": "160px",
      },
      maxWidth: {
        "modal-lead": "720px",
      },
      zIndex: {
        topbar: "5",
        sidebar: "20",
        "back-to-top": "30",
        backdrop: "99",
        modal: "100",
        toggle: "200",
      },
      transitionDuration: {
        160: "160ms",
        180: "180ms",
        220: "220ms",
        250: "250ms",
      },
      transitionProperty: {
        sidebar: "grid-template-columns",
        "nav-label": "opacity, transform, width, margin",
      },
      backdropBlur: {
        xs: "4px",
        sm: "10px",
        md: "14px",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in": {
          "0%": { opacity: "0", transform: "translateX(-10px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.22s ease both",
        "slide-in": "slide-in 0.2s ease both",
      },
    },
  },
  plugins: [
    function ({ addComponents, addUtilities, theme }) {
      addComponents({
        ".eyebrow": {
          fontSize: theme("fontSize.2xs")[0],
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
          fontWeight: "600",
        },
        ".panel": {
          background: "var(--bg-panel)",
          border: "1px solid var(--border-color)",
          borderRadius: theme("borderRadius.md"),
          boxShadow: theme("boxShadow.subtle"),
          padding: theme("spacing.6"),
        },
        ".panel-wide": {
          gridColumn: "span 2",
        },
        ".btn": {
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: theme("spacing.2"),
          border: "1px solid var(--border-color)",
          borderRadius: theme("borderRadius.full"),
          padding: "0.8rem 1.15rem",
          background: "var(--bg-panel)",
          color: "var(--text-primary)",
          fontWeight: "600",
          fontSize: "0.9rem",
          transition:
            "transform 0.2s ease, border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease",
          cursor: "pointer",
        },
        ".btn:hover": {
          transform: "translateY(-1px)",
        },
        ".btn:disabled": {
          opacity: "0.55",
          cursor: "not-allowed",
          transform: "none",
        },
        ".btn-primary": {
          background: "var(--accent-strong)",
          borderColor: "var(--accent-strong)",
          color: "#fff",
          boxShadow: theme("boxShadow.btn"),
        },
        ".btn-primary:hover": {
          boxShadow: theme("boxShadow.btn-hover"),
        },
        ".btn-secondary": {
          background: "var(--bg-panel)",
          color: "var(--text-primary)",
        },
        ".btn-ghost": {
          background: "transparent",
          borderColor: "transparent",
          color: "var(--text-secondary)",
        },
        ".badge": {
          display: "inline-flex",
          alignItems: "center",
          gap: theme("spacing.2"),
          borderRadius: theme("borderRadius.full"),
          padding: "0.35rem 0.7rem",
          fontSize: "0.75rem",
          fontWeight: "600",
          border: "1px solid var(--border-color)",
          color: "var(--text-secondary)",
          background: "var(--bg-panel-muted)",
        },
        ".badge-info": {
          background: semanticTone.info.background,
          color: semanticTone.info.color,
          border: "1px solid transparent",
        },
        ".badge-success": {
          background: semanticTone.success.background,
          color: semanticTone.success.color,
          border: "1px solid transparent",
        },
        ".badge-warning": {
          background: semanticTone.warning.background,
          color: semanticTone.warning.color,
          border: "1px solid transparent",
        },
        ".badge-danger": {
          background: semanticTone.danger.background,
          color: semanticTone.danger.color,
          border: "1px solid transparent",
        },
        ".status-chip": {
          display: "inline-flex",
          alignItems: "center",
          borderRadius: theme("borderRadius.full"),
          padding: "0.35rem 0.6rem",
          fontSize: "0.78rem",
          fontWeight: "600",
        },
        ".status-operativo, .status-asignado": {
          background: semanticTone.success.background,
          color: semanticTone.success.color,
        },
        ".status-laboratorio, .status-pendiente": {
          background: semanticTone.warning.background,
          color: semanticTone.warning.color,
        },
        ".status-baja, .status-no-operativo": {
          background: semanticTone.danger.background,
          color: semanticTone.danger.color,
        },
        ".status-stock, .status-disponible": {
          background: semanticTone.info.background,
          color: semanticTone.info.color,
        },
        ".kpi-card": {
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          textAlign: "center",
          background: "var(--bg-panel)",
          border: "1px solid var(--border-color)",
          borderRadius: theme("borderRadius.md"),
          padding: theme("spacing.5"),
          boxShadow: theme("boxShadow.subtle"),
          minHeight: "100%",
        },
        ".kpi-card .badge": {
          justifyContent: "center",
        },
        ".kpi-card strong": {
          display: "block",
          fontSize: "1.7rem",
          margin: "0.75rem 0 0.5rem",
        },
        ".nav-link": {
          display: "flex",
          alignItems: "center",
          gap: theme("spacing.3"),
          border: "1px solid transparent",
          background: "transparent",
          color: "var(--text-secondary)",
          textAlign: "left",
          padding: "0.82rem 0.95rem",
          borderRadius: "14px",
          whiteSpace: "nowrap",
          overflow: "hidden",
          transition:
            "background 0.2s ease, border-color 0.2s ease, color 0.2s ease, padding 0.22s ease",
        },
        ".nav-link:hover, .nav-link.is-active": {
          background: "var(--bg-panel)",
          borderColor: "var(--border-color)",
          color: "var(--text-primary)",
        },
        ".empty-state": {
          padding: theme("spacing.6"),
          background: "var(--bg-panel-muted)",
          border: "1px dashed var(--border-strong)",
          borderRadius: theme("borderRadius.sm"),
          color: "var(--text-muted)",
        },
        ".tab-button": {
          border: "1px solid var(--border-color)",
          background: "var(--bg-panel-muted)",
          color: "var(--text-secondary)",
          borderRadius: theme("borderRadius.full"),
          padding: "0.65rem 1rem",
        },
        ".tab-button.is-active": {
          background: "var(--bg-panel)",
          color: "var(--text-primary)",
          borderColor: "var(--accent)",
        },
        ".tab-button.is-disabled, .tab-button:disabled": {
          opacity: "0.45",
          cursor: "not-allowed",
        },
        ".modal-dialog": {
          position: "relative",
          width: "min(920px, calc(100vw - 120px))",
          margin: "78px auto",
          background: "var(--bg-panel)",
          border: "1px solid var(--border-color)",
          borderRadius: theme("borderRadius.lg"),
          padding: theme("spacing.8"),
          boxShadow: theme("boxShadow.soft"),
        },
      });

      addUtilities({
        ".scrollbar-gutter-stable": {
          scrollbarGutter: "stable",
        },
        ".transition-sidebar": {
          transition: "grid-template-columns 0.25s ease",
        },
        ".glass-light": {
          background: "rgba(255, 255, 255, 0.45)",
          backdropFilter: "blur(14px)",
        },
        ".glass-dark": {
          background: "rgba(15, 24, 33, 0.78)",
          backdropFilter: "blur(14px)",
        },
        ".topbar-sticky": {
          position: "sticky",
          top: "0",
          zIndex: "5",
        },
      });
    },
  ],
};
