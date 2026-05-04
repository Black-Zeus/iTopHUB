import { useEffect, useState } from "react";
import ModalManager from "../../components/ui/modal";
import { Button } from "../../ui/Button";
import {
  createLabSignatureSession,
  getLabSignatureSession,
} from "../../services/lab-service";

export function buildQrImageUrl(value = "") {
  const normalizedValue = String(value || "").trim();
  return normalizedValue
    ? `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(normalizedValue)}`
    : "";
}

export function SignatureQrModal({ context, sessionData, onRefresh, onRegenerate, onClose }) {
  const publicUrl = String(sessionData?.publicUrl || "").trim();
  const qrImageUrl = buildQrImageUrl(publicUrl);
  const [qrLoading, setQrLoading] = useState(Boolean(qrImageUrl));
  const [qrFailed, setQrFailed] = useState(false);

  useEffect(() => {
    if (!sessionData?.documentId) return undefined;
    if (!["pending", "claimed", "signed", "published"].includes(sessionData.status)) return undefined;
    const intervalId = window.setInterval(() => { onRefresh?.(); }, 4000);
    return () => window.clearInterval(intervalId);
  }, [onRefresh, sessionData?.documentId, sessionData?.status]);

  useEffect(() => {
    setQrLoading(Boolean(qrImageUrl));
    setQrFailed(false);
  }, [qrImageUrl]);

  const isSigned = ["signed", "published"].includes(sessionData?.status) ||
    ["Firmada", "Completada", "Derivada a obsoleto"].includes(sessionData?.documentStatus);
  const isExpired = sessionData?.status === "expired";
  const isClaimed = sessionData?.status === "claimed";
  const isOccupied = sessionData?.status === "occupied";
  const canRenderQr = Boolean(qrImageUrl) && !isExpired && !isOccupied && !qrFailed;
  const statusLabel = isSigned ? "Firmada" : isExpired ? "Expirada" : isOccupied ? "Ocupada" : isClaimed ? "En uso" : "Disponible";
  const statusClassName = isSigned
    ? "bg-[#dcfce7] text-[#15803d]"
    : isExpired || isOccupied
      ? "bg-[#fef3c7] text-[#92400e]"
      : isClaimed
        ? "bg-[#e0f2fe] text-[#0369a1]"
        : "bg-[#dbeafe] text-[#1d4ed8]";

  return (
    <div className="grid gap-5">
      <div className="rounded-[24px] border border-[var(--border-color)] bg-[var(--bg-panel)] shadow-[var(--shadow-soft)]">
        <div className="flex items-start justify-between gap-4 rounded-t-[24px] bg-[#0f172a] px-6 py-5 text-white">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-300">Firma digital</p>
            <h2 className="mt-2 text-xl font-bold">QR para {context.code}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              {context.isAdmin
                ? "El administrador seleccionado debe escanear este código para aprobar la derivación a obsoleto."
                : "El responsable actual del activo debe escanear este código desde su móvil para revisar el acta y registrar su firma digital."}
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] ${statusClassName}`}>
            {statusLabel}
          </span>
        </div>

        <div className="grid gap-5 p-6 lg:grid-cols-[320px_1fr]">
          <section className="rounded-[20px] border border-[var(--border-color)] bg-[var(--bg-app)] p-5 text-center">
            <div className="relative mx-auto flex h-[260px] w-[260px] items-center justify-center overflow-hidden rounded-[18px] border border-[#2d465b] bg-[#edf3fa] shadow-[0_16px_34px_rgba(15,23,42,0.08)]">
              {canRenderQr ? (
                <>
                  {qrLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-[#edf3fa]">
                      <div className="flex flex-col items-center gap-3">
                        <span className="h-8 w-8 animate-spin rounded-full border-2 border-[#bfd0e4] border-t-[#2563eb]" />
                        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Generando QR...</span>
                      </div>
                    </div>
                  ) : null}
                  <img
                    src={qrImageUrl}
                    alt={`QR de firma para ${context.code}`}
                    className={`h-[250px] w-[250px] object-contain transition-opacity duration-200 ${qrLoading ? "opacity-0" : "opacity-100"}`}
                    onLoad={() => setQrLoading(false)}
                    onError={() => { setQrLoading(false); setQrFailed(true); }}
                  />
                </>
              ) : (
                <span className="px-6 text-sm font-semibold text-slate-500">
                  {isExpired || isOccupied ? "Genera una nueva sesión QR para continuar." : "No fue posible preparar el código QR."}
                </span>
              )}
            </div>
            <p className="mt-4 text-sm text-slate-500">
              Este QR está pensado para uso móvil y queda reservado al primer dispositivo que lo abra.
            </p>
          </section>

          <section className="grid gap-4">
            <div className="grid gap-3 rounded-[20px] border border-[#2d465b] bg-[var(--bg-app)] p-4 md:grid-cols-2">
              <div className="rounded-[16px] bg-[#101b28] px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#8fa9be]">Acta</p>
                <p className="mt-1 text-sm font-semibold text-slate-100">{sessionData?.documentNumber || context.code}</p>
              </div>
              <div className="rounded-[16px] bg-[#101b28] px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#8fa9be]">Expira</p>
                <p className="mt-1 text-sm font-semibold text-slate-100">{sessionData?.expiresAt || "-"}</p>
              </div>
              <div className="rounded-[16px] bg-[#101b28] px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#8fa9be]">
                  {context.isAdmin ? "Administrador" : "Responsable del activo"}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-100">{sessionData?.receiver?.name || context.assetAssignedUser || "-"}</p>
              </div>
              <div className="rounded-[16px] bg-[#101b28] px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#8fa9be]">Estado Hub</p>
                <p className="mt-1 text-sm font-semibold text-slate-100">{sessionData?.documentStatus || context.status || "-"}</p>
              </div>
            </div>

            <div className={`rounded-[20px] border px-4 py-4 ${
              isSigned ? "border-[#1f6a45] bg-[#112c21]"
                : isExpired || isOccupied ? "border-[#7c5b18] bg-[#33250d]"
                : "border-[#2d5f88] bg-[#11283f]"
            }`}>
              <p className="text-sm font-semibold text-slate-100">
                {isSigned
                  ? "La firma ya fue registrada exitosamente en el acta."
                  : isExpired
                    ? "La vigencia del QR terminó. Genera una nueva sesión para retomar la firma."
                    : isOccupied
                      ? "Este QR fue abierto desde otro dispositivo. Genera una nueva sesión si necesitas reiniciar el proceso."
                      : isClaimed
                        ? "La sesión ya fue abierta desde un dispositivo móvil y quedó bloqueada para ese equipo hasta que firme o expire."
                        : "Esperando que el responsable abra el QR desde su móvil. Esta ventana se actualiza automáticamente."}
              </p>
              {sessionData?.claimedAt && !isSigned ? (
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-300">
                  Abierto en dispositivo móvil: {sessionData.claimedAt}
                </p>
              ) : null}
              {sessionData?.completedAt ? (
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-300">
                  Firmada en {sessionData.completedAt}
                </p>
              ) : null}
            </div>

            <div className="flex justify-end">
              <div className="flex flex-wrap justify-end gap-3">
                {!isSigned ? (
                  <Button variant="secondary" onClick={onRegenerate}>Regenerar QR</Button>
                ) : null}
                <Button variant="secondary" onClick={onRefresh}>Actualizar estado</Button>
              </div>
            </div>
          </section>
        </div>
      </div>

      <div className="flex justify-end">
        <Button variant="secondary" onClick={onClose} className="min-w-[7.5rem]">Cerrar</Button>
      </div>
    </div>
  );
}

export async function openLabQrModal({
  recordId,
  code,
  assetAssignedUser,
  currentStatus,
  phase = "",
  workflowKind = "",
  isAdmin = false,
  add,
  onDone,
}) {
  const PENDING_STATUSES = [
    "pending_entry_signature", "pending_processing_signature",
    "pending_exit_signature", "pending_admin_signature",
  ];
  const shouldCreate = PENDING_STATUSES.includes(currentStatus);

  const loadingModalId = ModalManager.loading({
    title: `Preparando QR ${code}`,
    message: "Generando la sesión de firma móvil...",
    showProgress: false,
    showCancel: false,
  });

  const context = { code, assetAssignedUser, status: currentStatus, isAdmin };

  try {
    const sessionOpts = { phase, workflowKind };
    const sessionData = shouldCreate
      ? await createLabSignatureSession(recordId, sessionOpts)
      : await getLabSignatureSession(recordId, sessionOpts);

    ModalManager.close(loadingModalId);
    let modalId = null;

    const refreshSession = async () => {
      const refreshed = await getLabSignatureSession(recordId, sessionOpts);
      if (modalId) {
        ModalManager.update(modalId, {
          content: (
            <SignatureQrModal
              context={context}
              sessionData={refreshed}
              onRefresh={refreshSession}
              onRegenerate={regenerateSession}
              onClose={() => ModalManager.close(modalId)}
            />
          ),
        });
      }
      if (["Firmada", "Completada", "Derivada a obsoleto"].includes(refreshed?.documentStatus)) {
        onDone?.();
      }
    };

    const regenerateSession = async () => {
      const confirmed = await ModalManager.confirm({
        title: "Regenerar QR",
        message: `Se invalidará el QR actual de ${code}.`,
        content: "El código actualmente abierto quedará dado de baja y se emitirá uno nuevo para continuar la firma desde otro dispositivo.",
        buttons: { cancel: "Cancelar", confirm: "Regenerar QR" },
      });
      if (!confirmed) return;

      const regenLoadingId = ModalManager.loading({
        title: "Regenerando QR",
        message: "Dando de baja la sesión actual y emitiendo un nuevo código...",
        showProgress: false,
        showCancel: false,
      });
      try {
        const refreshed = await createLabSignatureSession(recordId, { ...sessionOpts, forceNew: true });
        if (modalId) {
          ModalManager.update(modalId, {
            content: (
              <SignatureQrModal
                context={context}
                sessionData={refreshed}
                onRefresh={refreshSession}
                onRegenerate={regenerateSession}
                onClose={() => ModalManager.close(modalId)}
              />
            ),
          });
        }
        add?.({ title: "QR regenerado", description: `El código anterior de ${code} quedó invalidado.`, tone: "success" });
      } catch (regenerateError) {
        ModalManager.error({
          title: "No fue posible regenerar el QR",
          message: regenerateError.message || "No fue posible invalidar la sesión actual de firma.",
        });
      } finally {
        ModalManager.close(regenLoadingId);
      }
    };

    modalId = ModalManager.custom({
      title: `Firma QR — ${code}`,
      size: "clientWide",
      showFooter: false,
      content: (
        <SignatureQrModal
          context={context}
          sessionData={sessionData}
          onRefresh={refreshSession}
          onRegenerate={regenerateSession}
          onClose={() => ModalManager.close(modalId)}
        />
      ),
    });
  } catch (signatureError) {
    ModalManager.close(loadingModalId);
    ModalManager.error({
      title: "No fue posible abrir el QR",
      message: signatureError.message || "No fue posible preparar la sesión de firma digital.",
    });
  }
}
