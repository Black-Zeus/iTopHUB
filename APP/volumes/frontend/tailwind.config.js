/** @type {import('tailwindcss').Config} */

// ─────────────────────────────────────────────────────────────────────────────
// iTop Hub — Tailwind Config
// Derivado del sistema de diseño definido en Draft/ui/operations-hub
// variables.css → tokens canónicos · components.css → patrones de componentes
// ─────────────────────────────────────────────────────────────────────────────

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],

  // Dark mode via atributo data-theme en el html root (igual que el Draft)
  darkMode: ["class", '[data-theme="dark"]'],

  theme: {
    // ── Escala tipográfica ──────────────────────────────────────────────────
    fontSize: {
      "2xs": ["0.72rem",  { lineHeight: "1rem",    letterSpacing: "0.08em" }],  // eyebrow
      xs:    ["0.75rem",  { lineHeight: "1.1rem"  }],
      sm:    ["0.84rem",  { lineHeight: "1.35rem" }],
      base:  ["0.92rem",  { lineHeight: "1.55rem" }],
      md:    ["1rem",     { lineHeight: "1.6rem"  }],
      lg:    ["1.25rem",  { lineHeight: "1.65rem" }],
      xl:    ["1.55rem",  { lineHeight: "1.3"     }],
      "2xl": ["1.7rem",   { lineHeight: "1.25"    }],
      "3xl": ["2rem",     { lineHeight: "1.2"     }],
      "4xl": ["2.5rem",   { lineHeight: "1.15"    }],
    },

    // ── Radio ───────────────────────────────────────────────────────────────
    borderRadius: {
      none: "0",
      xs:   "6px",
      sm:   "10px",   // --radius-sm
      md:   "16px",   // --radius-md
      lg:   "22px",   // --radius-lg
      xl:   "28px",   // login-layout, brand-modal
      "2xl":"32px",
      full: "999px",  // badges, botones pill, searchbox
    },

    // ── Espaciado — refleja las variables --space-N del Draft ───────────────
    spacing: {
      px:  "1px",
      0:   "0",
      0.5: "0.125rem",
      1:   "0.25rem",   // --space-1
      2:   "0.5rem",    // --space-2
      3:   "0.75rem",   // --space-3
      4:   "1rem",      // --space-4
      5:   "1.25rem",   // --space-5
      6:   "1.5rem",    // --space-6
      7:   "1.75rem",
      8:   "2rem",      // --space-8
      9:   "2.25rem",
      10:  "2.5rem",    // --space-10
      12:  "3rem",
      14:  "3.5rem",
      16:  "4rem",
      20:  "5rem",
      24:  "6rem",
      32:  "8rem",
      40:  "10rem",
      48:  "12rem",
      56:  "14rem",
      64:  "16rem",
    },

    extend: {
      // ── Paleta de colores ─────────────────────────────────────────────────
      // Light → variables :root  |  Dark → variables [data-theme="dark"]
      // Nombrados igual que en variables.css para 1-1 trazabilidad
      colors: {

        // Fondos
        "bg-app":        { DEFAULT: "#eef4f8",  dark: "#0f1821" },
        "bg-surface":    { DEFAULT: "#f7fafc",  dark: "#15212c" },
        "bg-panel":      { DEFAULT: "#ffffff",  dark: "#182632" },
        "bg-panel-muted":{ DEFAULT: "#f3f7fb",  dark: "#1c2d3a" },
        "bg-sidebar":    { DEFAULT: "#e9f1f7",  dark: "#13202a" },
        "bg-hover":      { DEFAULT: "#edf4fa",  dark: "#213444" },

        // Bordes
        border:          { DEFAULT: "#d6e1ea",  dark: "#274152" },
        "border-strong": { DEFAULT: "#b8c9d9",  dark: "#33536a" },

        // Textos
        "text-primary":  { DEFAULT: "#17324a",  dark: "#e5eff8" },
        "text-secondary":{ DEFAULT: "#58718a",  dark: "#aac0d3" },
        "text-muted":    { DEFAULT: "#7f93a8",  dark: "#7f97ab" },

        // Acento principal (steel-blue)
        accent: {
          DEFAULT: "#78b6d9",
          dark:    "#82b7d9",
          strong:  { DEFAULT: "#5198c2", dark: "#9bc6e0" },
          soft:    { DEFAULT: "#dff0f9", dark: "rgba(130,183,217,0.14)" },
        },

        // Semánticos
        success: { DEFAULT: "#7fbf9c", dark: "#7ac69e" },
        warning: { DEFAULT: "#e0b56b", dark: "#d2b16e" },
        danger:  { DEFAULT: "#d28a8a", dark: "#d59898" },
        info:    { DEFAULT: "#8fb7d8", dark: "#93bbdc" },

        // Login brand panel gradient
        brand: {
          from: "#5c9de7",
          via:  "#84baeb",
          dark: { from: "#1c4d7e", via: "#315f91" },
        },

        // Alias cortos (compatibles con clases heredadas del App.jsx actual)
        ink:   "#08121a",
        mist:  "#e9f6fb",
        cyan:  "#60e8ff",
        teal:  "#19b7a7",
        slate: "#16303f",
      },

      // ── Familia tipográfica ───────────────────────────────────────────────
      fontFamily: {
        base: ['"Segoe UI"', "Tahoma", "Geneva", "Verdana", "sans-serif"],
        sans: ['"Segoe UI"', "Tahoma", "Geneva", "Verdana", "sans-serif"],
      },

      // ── Sombras ───────────────────────────────────────────────────────────
      boxShadow: {
        subtle:  "0 2px 10px rgba(23,50,74,0.05)",
        soft:    "0 10px 30px rgba(19,50,74,0.06)",
        panel:   "0 20px 60px rgba(0,0,0,0.35)",
        login:   "0 24px 52px rgba(45,86,122,0.12)",
        "login-dark": "0 28px 60px rgba(0,0,0,0.28)",
        accent:  "0 10px 22px rgba(81,152,194,0.18)",
        btn:     "0 10px 22px rgba(59,130,230,0.18)",
        "btn-hover": "0 14px 24px rgba(59,130,230,0.22)",
        // dark variants
        "subtle-dark": "0 3px 12px rgba(0,0,0,0.18)",
        "soft-dark":   "0 12px 34px rgba(0,0,0,0.22)",
      },

      // ── Transiciones ─────────────────────────────────────────────────────
      transitionDuration: {
        160: "160ms",
        220: "220ms",
      },

      // ── Backdrop blur ─────────────────────────────────────────────────────
      backdropBlur: {
        xs: "4px",
        sm: "10px",
        md: "14px",
      },

      // ── Tamaños de grid para app-shell ───────────────────────────────────
      gridTemplateColumns: {
        "app-shell":           "280px minmax(0,1fr)",
        "app-shell-collapsed": "112px minmax(0,1fr)",
        "login":    "minmax(0,1.06fr) minmax(360px,410px)",
        "kpi":      "repeat(4,minmax(0,1fr))",
        "module":   "repeat(2,minmax(0,1fr))",
        "summary":  "repeat(2,minmax(0,1fr))",
        "2col":     "repeat(2,minmax(0,1fr))",
        "3col":     "repeat(3,minmax(0,1fr))",
        "4col":     "repeat(4,minmax(0,1fr))",
      },

      // ── Alturas ───────────────────────────────────────────────────────────
      height: {
        screen:  "100vh",
        sidebar: "100vh",
      },

      minHeight: {
        screen: "100vh",
      },

      // ── z-index ───────────────────────────────────────────────────────────
      zIndex: {
        sidebar:  "20",
        topbar:   "5",
        toggle:   "200",
        modal:    "100",
        backdrop: "99",
      },

      // ── Ancho del sidebar toggle ──────────────────────────────────────────
      width: {
        "sidebar-open":      "280px",
        "sidebar-collapsed": "112px",
        "brand-mark":        "58px",
        "brand-mark-sm":     "56px",
        "nav-icon":          "20px",
        "nav-icon-lg":       "24px",
      },

      // ── Animaciones ───────────────────────────────────────────────────────
      transitionProperty: {
        "sidebar":  "grid-template-columns",
        "nav-label":"opacity, transform, width, margin",
        "layout":   "transform, box-shadow",
      },

      keyframes: {
        "fade-in": {
          "0%":   { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in": {
          "0%":   { opacity: "0", transform: "translateX(-10px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
      },

      animation: {
        "fade-in":  "fade-in 0.22s ease both",
        "slide-in": "slide-in 0.2s ease both",
      },
    },
  },

  // ── Plugins ───────────────────────────────────────────────────────────────
  plugins: [

    // ── Componentes utilitarios derivados del Draft ─────────────────────────
    function ({ addComponents, addUtilities, theme }) {

      // Eyebrow label (reutilizado en todo el sistema)
      addComponents({
        ".eyebrow": {
          fontSize:      "0.72rem",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color:         "var(--text-muted, #7f93a8)",
          fontWeight:    "600",
        },
      });

      // Panel base
      addComponents({
        ".panel": {
          background:   "var(--bg-panel, #ffffff)",
          border:       "1px solid var(--border-color, #d6e1ea)",
          borderRadius: theme("borderRadius.md"),
          boxShadow:    theme("boxShadow.subtle"),
          padding:      theme("spacing.6"),
        },
      });

      // Badge system (info · success · warning · danger)
      addComponents({
        ".badge": {
          display:        "inline-flex",
          alignItems:     "center",
          gap:            theme("spacing.2"),
          borderRadius:   "999px",
          padding:        `${theme("spacing[1.5]")} ${theme("spacing[3]")}`,
          fontSize:       "0.75rem",
          fontWeight:     "600",
          border:         "1px solid var(--border-color, #d6e1ea)",
          color:          "var(--text-secondary, #58718a)",
          background:     "var(--bg-panel-muted, #f3f7fb)",
        },
        ".badge-info": {
          background: "var(--accent-soft, #dff0f9)",
          color:      "var(--accent-strong, #5198c2)",
          border:     "1px solid transparent",
        },
        ".badge-success": {
          background: "rgba(127,191,156,0.14)",
          color:      "var(--success, #7fbf9c)",
          border:     "1px solid transparent",
        },
        ".badge-warning": {
          background: "rgba(224,181,107,0.14)",
          color:      "var(--warning, #e0b56b)",
          border:     "1px solid transparent",
        },
        ".badge-danger": {
          background: "rgba(210,138,138,0.14)",
          color:      "var(--danger, #d28a8a)",
          border:     "1px solid transparent",
        },
      });

      // Botones
      addComponents({
        ".btn": {
          border:       "1px solid var(--border-color, #d6e1ea)",
          borderRadius: "999px",
          padding:      `${theme("spacing[3]")} ${theme("spacing[5]")}`,
          background:   "var(--bg-panel, #ffffff)",
          color:        "var(--text-primary, #17324a)",
          fontWeight:   "600",
          fontSize:     "0.9rem",
          transition:   "transform 0.2s ease, border-color 0.2s ease, background 0.2s ease",
          cursor:       "pointer",
          "&:hover":    { transform: "translateY(-1px)" },
          "&:disabled": { opacity: "0.55", cursor: "not-allowed", transform: "none" },
        },
        ".btn-primary": {
          background:  "var(--accent-strong, #5198c2)",
          borderColor: "var(--accent-strong, #5198c2)",
          color:       "#fff",
          boxShadow:   theme("boxShadow.btn"),
          "&:hover":   { boxShadow: theme("boxShadow.btn-hover") },
        },
        ".btn-secondary": {
          background: "var(--bg-panel, #ffffff)",
        },
      });

      // Status chips (activos / estados operacionales)
      addComponents({
        ".status-chip": {
          display:      "inline-flex",
          padding:      `${theme("spacing[1.5]")} ${theme("spacing[2.5]")}`,
          borderRadius: "999px",
          fontSize:     "0.78rem",
          fontWeight:   "600",
        },
        ".status-operativo, .status-asignado": {
          background: "rgba(127,191,156,0.14)",
          color:      "var(--success, #7fbf9c)",
        },
        ".status-laboratorio, .status-pendiente": {
          background: "rgba(224,181,107,0.14)",
          color:      "var(--warning, #e0b56b)",
        },
        ".status-baja, .status-no-operativo": {
          background: "rgba(210,138,138,0.14)",
          color:      "var(--danger, #d28a8a)",
        },
        ".status-stock, .status-disponible": {
          background: "var(--accent-soft, #dff0f9)",
          color:      "var(--accent-strong, #5198c2)",
        },
      });

      // KPI card
      addComponents({
        ".kpi-card": {
          display:        "flex",
          flexDirection:  "column",
          justifyContent: "center",
          alignItems:     "center",
          textAlign:      "center",
          background:     "var(--bg-panel, #ffffff)",
          border:         "1px solid var(--border-color, #d6e1ea)",
          borderRadius:   theme("borderRadius.md"),
          padding:        theme("spacing.5"),
          boxShadow:      theme("boxShadow.subtle"),
          "& strong": {
            display:    "block",
            fontSize:   "1.7rem",
            margin:     `${theme("spacing.3")} 0 ${theme("spacing.2")}`,
          },
        },
      });

      // Nav link (sidebar)
      addComponents({
        ".nav-link": {
          display:     "flex",
          alignItems:  "center",
          gap:         theme("spacing.3"),
          border:      "1px solid transparent",
          background:  "transparent",
          color:       "var(--text-secondary, #58718a)",
          textAlign:   "left",
          padding:     "0.82rem 0.95rem",
          borderRadius:"14px",
          whiteSpace:  "nowrap",
          overflow:    "hidden",
          transition:  "background 0.2s ease, border-color 0.2s ease, color 0.2s ease",
          "&:hover, &.is-active": {
            background:  "var(--bg-panel, #ffffff)",
            borderColor: "var(--border-color, #d6e1ea)",
            color:       "var(--text-primary, #17324a)",
          },
        },
      });

      // Utilidades extras
      addUtilities({
        // Ocultar scrollbar pero mantener funcionalidad
        ".scrollbar-gutter-stable": { scrollbarGutter: "stable" },

        // Transición sidebar collapse
        ".transition-sidebar": { transition: "grid-template-columns 0.25s ease" },

        // Blur sobre glass panels
        ".glass-light": {
          background:     "rgba(255,255,255,0.45)",
          backdropFilter: "blur(14px)",
        },
        ".glass-dark": {
          background:     "rgba(15,24,33,0.78)",
          backdropFilter: "blur(14px)",
        },

        // Topbar sticky
        ".topbar-sticky": {
          position: "sticky",
          top:      "0",
          zIndex:   "5",
        },
      });
    },
  ],
};