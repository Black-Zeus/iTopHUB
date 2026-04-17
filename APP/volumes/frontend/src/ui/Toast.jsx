import { createContext, useContext, useMemo } from "react";
import toast, { Toaster } from "react-hot-toast";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Info,
  LoaderCircle,
  X,
  XCircle,
} from "lucide-react";

const ToastContext = createContext(null);

const DEFAULT_DURATION = 4200;

const TONE_CONFIG = {
  default: {
    title: "Notificación",
    icon: Bell,
    iconClassName: "bg-[var(--bg-panel-muted)] text-[var(--text-primary)]",
    progressClassName: "bg-[var(--accent-strong)]",
  },
  success: {
    title: "Operación completada",
    icon: CheckCircle2,
    iconClassName: "bg-[rgba(127,191,156,0.16)] text-[var(--success)]",
    progressClassName: "bg-[var(--success)]",
  },
  warning: {
    title: "Atención",
    icon: AlertTriangle,
    iconClassName: "bg-[rgba(224,181,107,0.16)] text-[var(--warning)]",
    progressClassName: "bg-[var(--warning)]",
  },
  danger: {
    title: "Ocurrió un problema",
    icon: XCircle,
    iconClassName: "bg-[rgba(210,138,138,0.16)] text-[var(--danger)]",
    progressClassName: "bg-[var(--danger)]",
  },
  info: {
    title: "Información",
    icon: Info,
    iconClassName: "bg-[var(--accent-soft)] text-[var(--accent-strong)]",
    progressClassName: "bg-[var(--accent-strong)]",
  },
  loading: {
    title: "Procesando",
    icon: LoaderCircle,
    iconClassName: "bg-[var(--bg-panel-muted)] text-[var(--accent-strong)]",
    progressClassName: "bg-[var(--accent-strong)]",
    iconSpin: true,
  },
};

function resolveToneConfig(tone) {
  return TONE_CONFIG[tone] || TONE_CONFIG.default;
}

function ToastCard({ toastItem, title, description, tone = "default", duration = DEFAULT_DURATION }) {
  const toneConfig = resolveToneConfig(tone);
  const Icon = toneConfig.icon;

  return (
    <div
      className={[
        "pointer-events-auto relative w-[min(26rem,calc(100vw-1.5rem))] overflow-hidden rounded-[18px]",
        "border border-[var(--border-color)] bg-[var(--bg-panel)]/95 shadow-[var(--shadow-soft)] backdrop-blur-xl",
        "transition-all duration-300",
        toastItem.visible
          ? "translate-y-0 scale-100 opacity-100"
          : "translate-y-2 scale-[0.98] opacity-0",
      ].join(" ")}
    >
      <div className="flex items-start gap-3 px-4 py-4">
        <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] ${toneConfig.iconClassName}`}>
          <Icon className={`h-5 w-5 ${toneConfig.iconSpin ? "animate-spin" : ""}`} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-[var(--text-primary)]">
            {title || toneConfig.title}
          </div>
          {description ? (
            <div className="mt-1 text-sm leading-5 text-[var(--text-secondary)]">
              {description}
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => toast.dismiss(toastItem.id)}
          className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          aria-label="Cerrar notificación"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {duration !== Number.POSITIVE_INFINITY ? (
        <div className="absolute inset-x-0 bottom-0 h-1 bg-[var(--bg-panel-muted)]/80">
          <div
            className={`h-full origin-left ${toneConfig.progressClassName}`}
            style={{ animation: `toast-progress ${duration}ms linear forwards` }}
          />
        </div>
      ) : null}
    </div>
  );
}

function normalizePayload(payload = {}) {
  return {
    title: payload.title || payload.message || "",
    description: payload.description || "",
    tone: payload.tone || "default",
    duration: payload.duration ?? DEFAULT_DURATION,
  };
}

export function ToastProvider({ children }) {
  const api = useMemo(
    () => ({
      add(payload = {}) {
        const normalized = normalizePayload(payload);
        return toast.custom(
          (toastItem) => (
            <ToastCard
              toastItem={toastItem}
              title={normalized.title}
              description={normalized.description}
              tone={normalized.tone}
              duration={normalized.duration}
            />
          ),
          {
            duration: normalized.duration,
          }
        );
      },

      dismiss(id) {
        toast.dismiss(id);
      },

      remove(id) {
        toast.remove(id);
      },
    }),
    []
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <Toaster
        position="bottom-right"
        reverseOrder={false}
        gutter={12}
        containerStyle={{
          bottom: 24,
          right: 24,
        }}
        toastOptions={{
          duration: DEFAULT_DURATION,
        }}
      />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast debe usarse dentro de <ToastProvider>");
  }
  return ctx;
}
