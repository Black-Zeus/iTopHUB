import { useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "@/App";
import { canViewModule } from "@services/authz-service";
import { Panel, PanelHeader } from "../../components/ui/general/Panel";
import { StatusChip } from "../../components/ui/general/StatusChip";
import { Icon } from "../../components/ui/icon/Icon";
import { Button } from "../../ui/Button";
import { listHandoverDocuments } from "../../services/handover-service";
import { listLabRecords } from "../../services/lab-service";

const HANDOVER_TYPE_LABELS = {
  initial_assignment: "Entrega",
  return: "Devolucion",
  reassignment: "Reasignacion",
  normalization: "Normalizacion",
};

const MODULE_SHORTCUTS = [
  { label: "Actas de entrega", path: "/handover", moduleCode: "handover", icon: "fileLines" },
  { label: "Devoluciones", path: "/returns", moduleCode: "handover", icon: "arrowLeft" },
  { label: "Reasignaciones", path: "/reassignment", moduleCode: "reassignment", icon: "arrowsRotate" },
  { label: "Normalizacion", path: "/normalization", moduleCode: "handover", icon: "sliders" },
  { label: "Laboratorio", path: "/lab", moduleCode: "lab", icon: "flask" },
  { label: "Informes", path: "/reports", moduleCode: "reports", icon: "chartBar" },
  { label: "Reportes por correo", path: "/email-reports", moduleCode: "email_reports", icon: "envelope" },
];

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeStatus(value) {
  return normalizeText(value).toLowerCase();
}

function formatCount(value) {
  return String(Number(value || 0)).padStart(2, "0");
}

function formatDate(value) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return normalizeText(value) || "-";
  return parsed.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function getHandoverTypeLabel(item) {
  return item.handoverType || HANDOVER_TYPE_LABELS[item.handoverTypeCode] || "Acta";
}

function getDocumentDate(item) {
  return item.generatedAt || item.date || item.createdAt || "";
}

function isHandoverPending(item) {
  const status = normalizeStatus(item.status);
  return !["completada", "confirmada", "anulada"].includes(status);
}

function isLabPending(item) {
  const status = normalizeText(item.statusCode);
  return !["completed_return_to_stock", "completed_obsolete", "cancelled"].includes(status);
}

function buildHandoverDocument(row) {
  return {
    id: `handover-${row.id}`,
    code: row.code,
    type: getHandoverTypeLabel(row),
    status: row.status,
    asset: row.asset || "Sin activo",
    owner: row.person || row.destinationPerson || row.ownerName || "-",
    date: getDocumentDate(row),
    path: `${row.handoverTypeCode === "return" ? "/returns" : row.handoverTypeCode === "normalization" ? "/normalization" : row.handoverTypeCode === "reassignment" ? "/reassignment" : "/handover"}/${row.id}`,
    pending: isHandoverPending(row),
    source: "handover",
  };
}

function buildLabDocument(row) {
  return {
    id: `lab-${row.id}`,
    code: row.code,
    type: "Laboratorio",
    status: row.status,
    asset: [row.assetCode, row.assetName].filter(Boolean).join(" / ") || "Sin activo",
    owner: row.ownerName || row.assetAssignedUser || "-",
    date: row.exitDate || row.entryDate || "",
    path: `/lab/${row.id}`,
    pending: isLabPending(row),
    source: "lab",
  };
}

function summarizeByType(items) {
  const index = new Map();
  items.forEach((item) => {
    const key = item.type || "Acta";
    const current = index.get(key) || { label: key, total: 0, pending: 0 };
    current.total += 1;
    if (item.pending) current.pending += 1;
    index.set(key, current);
  });
  return Array.from(index.values()).sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
}

function groupRecentItems(items) {
  const groups = new Map();
  items.forEach((item) => {
    const label = item.type || "Acta";
    const current = groups.get(label) || { label, latestDate: item.date, items: [] };
    current.items.push(item);
    if (normalizeText(item.date).localeCompare(normalizeText(current.latestDate)) > 0) {
      current.latestDate = item.date;
    }
    groups.set(label, current);
  });
  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      items: [...group.items].sort((a, b) => normalizeText(b.date).localeCompare(normalizeText(a.date))),
    }))
    .sort((a, b) => normalizeText(b.latestDate).localeCompare(normalizeText(a.latestDate)));
}

function buildPendingReason(item) {
  const status = normalizeStatus(item.status);
  if (status.includes("firma")) return "Requiere firma";
  if (status.includes("itop") || status.includes("registro")) return "Registrar ticket";
  if (status.includes("creacion") || status.includes("borrador")) return "Completar emision";
  if (status.includes("ejecucion") || status.includes("cierre")) return "Avanzar fase";
  return "Revisar estado";
}

function percent(value, total) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((Number(value || 0) / total) * 100)));
}

function EmptyState({ children }) {
  return (
    <div className="rounded-[14px] border border-dashed border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-5 text-sm text-[var(--text-muted)]">
      {children}
    </div>
  );
}

function MetricTile({ label, value, helper, tone = "default", iconName = "chartBar" }) {
  const toneClass = {
    default: "text-[var(--accent-strong)] bg-[var(--accent-soft)]",
    success: "text-[var(--success)] bg-[rgba(127,191,156,0.14)]",
    warning: "text-[var(--warning)] bg-[rgba(224,181,107,0.14)]",
    danger: "text-[var(--danger)] bg-[rgba(210,138,138,0.14)]",
  }[tone] || "text-[var(--accent-strong)] bg-[var(--accent-soft)]";

  return (
    <div className="min-h-[118px] bg-[var(--bg-app)] px-4 py-4">
      <div className="flex h-full flex-col justify-between gap-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{label}</p>
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] ${toneClass}`}>
            <Icon name={iconName} size={16} className="h-4 w-4" />
          </span>
        </div>
        <div>
          <strong className="block text-3xl font-bold leading-none text-[var(--text-primary)]">{value}</strong>
          {helper ? <p className="mt-2 text-xs font-semibold text-[var(--text-muted)]">{helper}</p> : null}
        </div>
      </div>
    </div>
  );
}

function FlowBar({ item, total }) {
  const width = percent(item.total, total);
  return (
    <div className="rounded-[14px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <span className="truncate text-sm font-bold text-[var(--text-primary)]">{item.label}</span>
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{width}% del total</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="block text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Actas</span>
          <strong className="text-xl text-[var(--text-primary)]">{formatCount(item.total)}</strong>
        </div>
        <div>
          <span className="block text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Pendientes</span>
          <strong className={item.pending ? "text-xl text-[var(--warning)]" : "text-xl text-[var(--success)]"}>{formatCount(item.pending)}</strong>
        </div>
      </div>
      <div className="mt-3 h-3 overflow-hidden rounded-full bg-[var(--bg-panel)]">
        <div className="h-full rounded-full bg-[var(--accent-strong)]" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function DonutStat({ total, pending }) {
  const done = Math.max(0, total - pending);
  const donePercent = percent(done, total);
  return (
    <div className="grid place-items-center gap-3">
      <div
        className="grid h-44 w-44 place-items-center rounded-full border border-[var(--border-color)]"
        style={{
          background: `conic-gradient(var(--success) 0 ${donePercent}%, var(--warning) ${donePercent}% 100%)`,
        }}
      >
        <div className="grid h-32 w-32 place-items-center rounded-full border border-[var(--border-color)] bg-[var(--bg-panel)] text-center">
          <div>
            <strong className="block text-3xl font-bold text-[var(--text-primary)]">{donePercent}%</strong>
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">resuelto</span>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-3 text-xs font-semibold text-[var(--text-muted)]">
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--success)]" /> Cerradas</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--warning)]" /> Pendientes</span>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [handoverRows, setHandoverRows] = useState([]);
  const [labRows, setLabRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [warnings, setWarnings] = useState([]);

  const canReadHandover = canViewModule(user, "handover") || canViewModule(user, "reassignment");
  const canReadLab = canViewModule(user, "lab");

  useEffect(() => {
    let cancelled = false;
    async function loadDashboard() {
      setLoading(true);
      const nextWarnings = [];
      const [handoverResult, labResult] = await Promise.allSettled([
        canReadHandover ? listHandoverDocuments({}) : Promise.resolve({ items: [] }),
        canReadLab ? listLabRecords({}) : Promise.resolve({ items: [] }),
      ]);

      if (cancelled) return;

      if (handoverResult.status === "fulfilled") {
        setHandoverRows(asArray(handoverResult.value?.items));
      } else {
        setHandoverRows([]);
        nextWarnings.push("No fue posible cargar actas de entrega, devolucion, reasignacion o normalizacion.");
      }

      if (labResult.status === "fulfilled") {
        setLabRows(asArray(labResult.value?.items));
      } else {
        setLabRows([]);
        nextWarnings.push("No fue posible cargar actas de laboratorio.");
      }

      setWarnings(nextWarnings);
      setLoading(false);
    }

    loadDashboard();
    return () => {
      cancelled = true;
    };
  }, [canReadHandover, canReadLab]);

  const documents = useMemo(() => [
    ...handoverRows.map(buildHandoverDocument),
    ...labRows.map(buildLabDocument),
  ], [handoverRows, labRows]);

  const pendingItems = useMemo(
    () => documents.filter((item) => item.pending).sort((a, b) => normalizeText(b.date).localeCompare(normalizeText(a.date))).slice(0, 15),
    [documents]
  );

  const recentItems = useMemo(
    () => [...documents].sort((a, b) => normalizeText(b.date).localeCompare(normalizeText(a.date))).slice(0, 30),
    [documents]
  );

  const recentGroups = useMemo(() => groupRecentItems(recentItems), [recentItems]);

  const summaryByType = useMemo(() => summarizeByType(documents), [documents]);

  const handoverPending = handoverRows.filter(isHandoverPending).length;
  const labPending = labRows.filter(isLabPending).length;
  const totalPending = handoverPending + labPending;
  const ticketPending = labRows.filter((row) => row.statusCode === "pending_itop_sync").length
    + handoverRows.filter((row) => normalizeText(row.status).toLowerCase().includes("firmada") && !row.itopTicketId).length;

  const kpis = [
    {
      label: "Actas gestionadas",
      value: formatCount(documents.length),
      helper: `${handoverRows.length} operativas / ${labRows.length} lab`,
      tone: "default",
      iconName: "fileLines",
    },
    {
      label: "Pendientes",
      value: formatCount(totalPending),
      helper: "Con accion abierta",
      tone: totalPending ? "warning" : "success",
      iconName: "clock",
    },
    {
      label: "Laboratorio",
      value: formatCount(labPending),
      helper: "En flujo tecnico",
      tone: labPending ? "warning" : "success",
      iconName: "flask",
    },
    {
      label: "Registro iTop",
      value: formatCount(ticketPending),
      helper: "Tickets pendientes",
      tone: ticketPending ? "danger" : "success",
      iconName: "paperPlane",
    },
  ];
  const totalDocuments = documents.length;

  return (
    <div className="grid gap-5">
      {warnings.length > 0 && (
        <Panel className="border-[rgba(224,181,107,0.4)] bg-[rgba(224,181,107,0.06)]">
          <div className="grid gap-2">
            {warnings.map((warning) => (
              <p key={warning} className="text-sm font-semibold text-[var(--warning)]">{warning}</p>
            ))}
          </div>
        </Panel>
      )}

      <div className="grid auto-rows-min gap-5 xl:grid-cols-12">
        <Panel className="xl:col-span-12">
          <PanelHeader eyebrow="Resumen ejecutivo" title="Operacion documental del Hub" />
          <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
            <div className="grid gap-px overflow-hidden rounded-[16px] border border-[var(--border-color)] bg-[var(--border-color)] sm:grid-cols-2 xl:grid-cols-4">
              {kpis.map((kpi) => (
                <MetricTile key={kpi.label} {...kpi} />
              ))}
            </div>
            <div className="rounded-[16px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-4">
              <p className="mb-3 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Estado general</p>
              {loading ? (
                <EmptyState>Cargando...</EmptyState>
              ) : (
                <DonutStat total={totalDocuments} pending={totalPending} />
              )}
            </div>
          </div>
        </Panel>

        <Panel className="xl:col-span-12">
          <PanelHeader eyebrow="Accesos" title="Gestionar" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {MODULE_SHORTCUTS.filter((item) => canViewModule(user, item.moduleCode)).map((item) => (
              <button
                key={item.path}
                type="button"
                onClick={() => navigate(item.path)}
                className="flex min-h-[92px] items-center gap-3 rounded-[14px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-3 text-left transition hover:border-[var(--accent-strong)] hover:bg-[var(--bg-hover)]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] border border-[var(--border-color)] bg-[var(--bg-panel)] text-[var(--accent-strong)]">
                  <Icon name={item.icon} size={16} className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-[var(--text-primary)]">{item.label}</span>
                  <span className="mt-0.5 block text-xs text-[var(--text-muted)]">Abrir modulo</span>
                </span>
              </button>
            ))}
          </div>
        </Panel>

        <Panel className="xl:col-span-12">
          <PanelHeader
            eyebrow="Cola operativa"
            title="Pendientes de accion"
            actions={canViewModule(user, "reports") ? (
              <Button size="sm" variant="secondary" onClick={() => navigate("/reports")}>
                <Icon name="chartBar" size={14} className="h-3.5 w-3.5" />
                Informes
              </Button>
            ) : null}
          />
          {loading ? (
            <EmptyState>Cargando actividad del Hub...</EmptyState>
          ) : pendingItems.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {pendingItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(item.path)}
                  className="grid min-h-[132px] w-full content-between gap-3 rounded-[14px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-3 text-left transition hover:border-[var(--accent-strong)] hover:bg-[var(--bg-hover)]"
                >
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-[var(--text-primary)]">{item.code}</span>
                      <StatusChip status={item.status} />
                    </span>
                    <span className="mt-1 block truncate text-sm text-[var(--text-secondary)]">{item.type} / {item.asset}</span>
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                    {buildPendingReason(item)}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState>No hay acciones pendientes visibles para tu perfil.</EmptyState>
          )}
        </Panel>

        <Panel className="xl:col-span-12">
          <PanelHeader eyebrow="Graficos" title="Actas por flujo" />
          {loading ? (
            <EmptyState>Cargando resumen...</EmptyState>
          ) : summaryByType.length ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {summaryByType.map((item) => (
                <FlowBar key={item.label} item={item} total={totalDocuments} />
              ))}
            </div>
          ) : (
            <EmptyState>Aun no hay actas registradas.</EmptyState>
          )}
        </Panel>
        <Panel className="xl:col-span-12">
          <PanelHeader eyebrow="Actividad reciente" title="Ultimas 30 actas" />
          {loading ? (
            <EmptyState>Cargando ultimos movimientos...</EmptyState>
          ) : recentItems.length ? (
            <div className="grid gap-4">
              {recentGroups.map((group) => (
                <div key={group.label} className="overflow-hidden rounded-[14px] border border-[var(--border-color)]">
                  <div className="flex items-center justify-between gap-3 bg-[var(--bg-app)] px-4 py-3">
                    <h3 className="text-sm font-bold text-[var(--text-primary)]">{group.label}</h3>
                    <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                      {group.items.length} movimiento(s) / ultimo {formatDate(group.latestDate)}
                    </span>
                  </div>
                  <table className="w-full text-left text-sm">
                    <thead className="bg-[var(--bg-panel)] text-[0.68rem] uppercase tracking-[0.08em] text-[var(--text-muted)]">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Acta</th>
                        <th className="px-4 py-3 font-semibold">Activo</th>
                        <th className="px-4 py-3 font-semibold">Estado</th>
                        <th className="px-4 py-3 font-semibold">Fecha</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-color)]">
                      {group.items.map((item) => (
                        <tr key={item.id} className="cursor-pointer bg-[var(--bg-panel)] hover:bg-[var(--bg-hover)]" onClick={() => navigate(item.path)}>
                          <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">{item.code}</td>
                          <td className="px-4 py-3 text-[var(--text-secondary)]">{item.asset}</td>
                          <td className="px-4 py-3"><StatusChip status={item.status} /></td>
                          <td className="px-4 py-3 text-[var(--text-muted)]">{formatDate(item.date)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState>No hay actividad reciente.</EmptyState>
          )}
        </Panel>
      </div>
    </div>
  );
}
