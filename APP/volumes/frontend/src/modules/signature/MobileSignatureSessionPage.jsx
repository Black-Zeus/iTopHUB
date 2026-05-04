import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../../ui/Button";
import { Spinner } from "../../ui/Spinner";
import SignatureCanvas from "./SignatureCanvas";
import { collectSignatureDeviceContext } from "./device-context";

function buildClaimStorageKey(token) {
  return `hub-signature-claim:${String(token || "").trim()}`;
}

function buildLocalClaimToken() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return `claim${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`;
}

function readStoredClaimToken(token) {
  if (typeof window === "undefined") {
    return "";
  }
  return window.sessionStorage.getItem(buildClaimStorageKey(token)) || "";
}

function persistClaimToken(token, claimToken) {
  if (typeof window === "undefined") {
    return;
  }
  if (claimToken) {
    window.sessionStorage.setItem(buildClaimStorageKey(token), claimToken);
    return;
  }
  window.sessionStorage.removeItem(buildClaimStorageKey(token));
}

function ensureLocalClaimToken(token, currentClaimToken = "") {
  const normalizedCurrentToken = String(currentClaimToken || "").trim();
  if (normalizedCurrentToken) {
    persistClaimToken(token, normalizedCurrentToken);
    return normalizedCurrentToken;
  }
  const storedClaimToken = readStoredClaimToken(token);
  if (storedClaimToken) {
    return storedClaimToken;
  }
  const provisionalClaimToken = buildLocalClaimToken();
  persistClaimToken(token, provisionalClaimToken);
  return provisionalClaimToken;
}

function SignatureStatusLayout({ brand = {}, tone = "default", title, description, children }) {
  const toneClasses = {
    success: "border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]",
    danger: "border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]",
    warning: "border-[#fde68a] bg-[#fffbeb] text-[#92400e]",
    default: "border-[#c8d7ea] bg-[#edf3fa] text-[#0f172a]",
  };

  const organizationName = `${brand?.organizationName || "iTop Hub"}`.trim();
  const organizationAcronym = `${brand?.organizationAcronym || "ITH"}`.trim();
  const organizationLogoUrl = `${brand?.organizationLogoDataUrl || brand?.organizationLogoUrl || ""}`.trim();

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f3f7fb_0%,#e9eef6_100%)] px-4 py-6 text-[#1f2937]">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-[720px] grid-rows-[auto_1fr] overflow-hidden rounded-[30px] border border-[#d9dee7] bg-[#eef4fb] shadow-[0_24px_70px_rgba(15,23,42,0.12)]">
        <header className="bg-[#0f172a] px-6 py-6 text-white">
          <div className="flex items-center gap-4">
            {organizationLogoUrl ? (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[18px] bg-white/95 p-2 shadow-[0_10px_26px_rgba(15,23,42,0.2)]">
                <img src={organizationLogoUrl} alt={organizationName} className="max-h-full max-w-full object-contain" />
              </div>
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[18px] bg-white/10 text-lg font-bold tracking-[0.14em] text-slate-100">
                {organizationAcronym || "ITH"}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-300">{organizationName}</p>
              <h1 className="mt-2 text-[24px] font-bold">{title}</h1>
              <p className="mt-2 text-sm leading-6 text-slate-300">{description}</p>
            </div>
          </div>
        </header>
        <main className="space-y-4 p-5">
          <section className={`rounded-[20px] border px-5 py-4 ${toneClasses[tone] || toneClasses.default}`}>
            <h2 className="text-lg font-bold">{title}</h2>
            <p className="mt-1 text-sm leading-6 opacity-80">{description}</p>
          </section>
          {children}
        </main>
      </div>
    </div>
  );
}

export function MobileSignatureSessionPage({
  token = "",
  loadSession,
  openDocument,
  submitSignature,
}) {
  const allowedPendingStatuses = ["Emitida", "Pendiente de firma", "En laboratorio"];
  const allowedCompletedStatuses = ["Firmada", "Confirmada", "Completada", "Derivada a obsoleto"];
  const signaturePadRef = useRef(null);
  const [session, setSession] = useState(null);
  const [brand, setBrand] = useState({});
  const [busy, setBusy] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [hasSignature, setHasSignature] = useState(false);
  const [signatureModalOpen, setSignatureModalOpen] = useState(false);
  const [signatureObservation, setSignatureObservation] = useState("");
  const [signatureError, setSignatureError] = useState("");
  const [claimToken, setClaimToken] = useState(() => readStoredClaimToken(token));

  const loadCurrentSession = async (overrideClaimToken = claimToken) => {
    const resolvedRequestClaimToken = ensureLocalClaimToken(token, overrideClaimToken);
    try {
      setBusy(true);
      setError("");
      if (resolvedRequestClaimToken !== claimToken) {
        setClaimToken(resolvedRequestClaimToken);
      }
      const payload = await loadSession(token, { claimToken: resolvedRequestClaimToken });
      const resolvedClaimToken = `${payload?.claimToken || ""}`.trim();
      if (resolvedClaimToken && resolvedClaimToken !== resolvedRequestClaimToken) {
        persistClaimToken(token, resolvedClaimToken);
        setClaimToken(resolvedClaimToken);
      }
      if (payload?.brand) {
        setBrand(payload.brand);
      }
      setSession(payload);
    } catch (loadError) {
      setError(loadError.message || "No fue posible cargar la sesión de firma.");
      if (loadError.brand) {
        setBrand(loadError.brand);
      }
      setSession(null);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    loadCurrentSession(readStoredClaimToken(token));
  }, [token]);

  const completionMessage = useMemo(
    () => session?.messages?.success || "Tu firma ya quedó registrada en el acta. Desde tu lado no debes hacer nada más; el agente continuará la finalización en iTop Hub.",
    [session?.messages?.success],
  );

  const completionHint = useMemo(
    () => session?.messages?.completionHint || "Cuando veas este mensaje puedes cerrar la ventana.",
    [session?.messages?.completionHint],
  );

  const sessionStatus = `${session?.status || ""}`.trim().toLowerCase();
  const documentStatus = `${session?.documentStatus || ""}`.trim();
  const isUnavailable = !session || ["expired", "cancelled", "occupied"].includes(sessionStatus) || ![...allowedPendingStatuses, ...allowedCompletedStatuses].includes(documentStatus);
  const isCompleted = ["signed", "published"].includes(sessionStatus) || allowedCompletedStatuses.includes(documentStatus);
  const isClaimed = sessionStatus === "claimed";

  const handleSubmit = async () => {
    const signatureDataUrl = signaturePadRef.current?.toDataUrl?.() || "";
    if (!signatureDataUrl) {
      setSignatureError("Debes firmar en el recuadro antes de continuar.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setSignatureError("");
      const resolvedClaimToken = ensureLocalClaimToken(token, claimToken || readStoredClaimToken(token));
      if (resolvedClaimToken !== claimToken) {
        setClaimToken(resolvedClaimToken);
      }
      const payload = await submitSignature(token, {
        signatureDataUrl,
        signerName: session?.signatureTarget?.name || session?.receiver?.name || "",
        signerRole: session?.signatureTarget?.role || session?.receiver?.role || "",
        observation: signatureObservation,
        claimToken: resolvedClaimToken,
        deviceContext: collectSignatureDeviceContext(),
      });
      const responseClaimToken = `${payload?.claimToken || ""}`.trim();
      if (responseClaimToken) {
        persistClaimToken(token, responseClaimToken);
        setClaimToken(responseClaimToken);
      }
      setSession(payload);
      setSignatureModalOpen(false);
      setSignatureObservation("");
      signaturePadRef.current?.clear?.();
      setHasSignature(false);
    } catch (submitError) {
      const message = submitError.message || "No fue posible registrar la firma digital.";
      setError(message);
      setSignatureError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (busy) {
    return (
      <SignatureStatusLayout
        brand={brand}
        title="Preparando firma digital"
        description="Estamos validando el código QR y cargando la información del acta."
      >
        <section className="rounded-[20px] border border-[#d5dfeb] bg-[#edf3fa] px-5 py-6 text-sm text-slate-600">
          <div className="flex items-center gap-3">
            <Spinner size="md" className="border-[#bfd0e4] border-t-[#1d4ed8]" />
            <span>Validando acceso y preparando los documentos...</span>
          </div>
        </section>
      </SignatureStatusLayout>
    );
  }

  if (error && !session) {
    return (
      <SignatureStatusLayout
        brand={brand}
        tone="danger"
        title="No fue posible abrir la firma"
        description={error}
      >
        <section className="rounded-[20px] border border-[#d5dfeb] bg-[#edf3fa] px-5 py-6 text-sm text-slate-600">
          Solicita un nuevo código QR desde iTop Hub si el problema continúa.
        </section>
      </SignatureStatusLayout>
    );
  }

  if (isUnavailable) {
    const unavailableTitle = sessionStatus === "occupied" ? "Este QR ya está en uso" : "Firma no disponible";
    const unavailableDescription = sessionStatus === "occupied"
      ? "Este código QR ya fue abierto desde otro dispositivo. Por seguridad, la firma quedó reservada para ese equipo."
      : "Esta sesión ya no está disponible o el estado del acta cambió en iTop Hub.";
    return (
      <SignatureStatusLayout
        brand={brand}
        tone="warning"
        title={unavailableTitle}
        description={unavailableDescription}
      >
        <section className="rounded-[20px] border border-[#d5dfeb] bg-[#edf3fa] px-5 py-6 text-sm text-slate-600">
          {sessionStatus === "occupied"
            ? "Si eres el destinatario correcto, solicita al agente que genere un nuevo QR."
            : "Pide al agente que emita una nueva sesión desde el acta correspondiente."}
        </section>
      </SignatureStatusLayout>
    );
  }

  if (isCompleted) {
    return (
      <SignatureStatusLayout
        brand={brand}
        tone="success"
        title="Firma registrada correctamente"
        description={completionMessage}
      >
        <section className="grid gap-3 rounded-[20px] border border-[#d5dfeb] bg-[#edf3fa] px-5 py-5 md:grid-cols-2">
          <div className="rounded-[16px] bg-[#f6f9fd] px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">Acta</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{session?.documentNumber || "-"}</p>
          </div>
          <div className="rounded-[16px] bg-[#f6f9fd] px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">Estado actual</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{session?.documentStatus || "-"}</p>
          </div>
        </section>
        <section className="rounded-[20px] border border-[#d5dfeb] bg-[#edf3fa] px-5 py-5 text-sm leading-6 text-slate-700">
          <p>{completionMessage}</p>
          <p className="mt-3 font-semibold text-slate-900">{completionHint}</p>
        </section>
      </SignatureStatusLayout>
    );
  }

  return (
    <SignatureStatusLayout
      brand={brand}
      title={`Firma de ${session?.handoverType || "Acta"}`}
      description={isClaimed
        ? "Este QR ya quedó reservado para este dispositivo. Revisa la información y firma cuando estés listo."
        : "Revisa la información del acta y firma en el recuadro inferior para completar tu parte del proceso."}
    >
      <section className="grid gap-3 rounded-[20px] border border-[#d5dfeb] bg-[#edf3fa] p-5 md:grid-cols-2">
        <div className="rounded-[16px] bg-[#f6f9fd] px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">Acta</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{session?.documentNumber || "-"}</p>
        </div>
        <div className="rounded-[16px] bg-[#f6f9fd] px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">Persona destino</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{session?.receiver?.name || "-"}</p>
        </div>
        <div className="rounded-[16px] bg-[#f6f9fd] px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">Cargo</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{session?.receiver?.role || "Sin cargo"}</p>
        </div>
        <div className="rounded-[16px] bg-[#f6f9fd] px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">Vigencia del QR</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{session?.expiresAt || "-"}</p>
        </div>
      </section>

      <section className="rounded-[20px] border border-[#d5dfeb] bg-[#edf3fa] p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Documentos disponibles</h2>
            <p className="mt-1 text-sm text-slate-500">Puedes revisar el acta y sus anexos antes de firmar.</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3">
          {(session?.documents || []).map((document) => (
            <button
              key={document.kind}
              type="button"
              className="flex items-center justify-between rounded-[16px] border border-[#d5dfeb] bg-[#f6f9fd] px-4 py-3 text-left transition hover:border-[#93c5fd] hover:bg-[#eaf2fb]"
              onClick={() => openDocument(token, document.kind, { claimToken })}
            >
              <span>
                <span className="block text-sm font-semibold text-slate-900">{document.name || document.kind}</span>
                <span className="mt-1 block text-xs uppercase tracking-[0.08em] text-slate-500">
                  {document.kind === "main" ? "Acta principal" : "Documento complementario"}
                </span>
              </span>
              <span className="text-xs font-bold uppercase tracking-[0.08em] text-[#1d4ed8]">Abrir</span>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-[20px] border border-[#d5dfeb] bg-[#edf3fa] p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Firma digital</h2>
            <p className="mt-1 text-sm text-slate-500">Cuando estés listo, abre el formulario de firma para dibujar tu firma y agregar observaciones si corresponde.</p>
          </div>
        </div>
        <div className="mt-4 rounded-[16px] border border-[#d5dfeb] bg-[#f6f9fd] px-4 py-4 text-sm leading-6 text-slate-600">
          <p>La firma quedará asociada al acta y el agente continuará el cierre del proceso en iTop Hub.</p>
          <p className="mt-2">Si necesitas informar algo al recibir el activo, podrás escribirlo en el mismo formulario de firma.</p>
        </div>
        <div className="mt-4">
          <Button className="w-full" onClick={() => {
            setSignatureError("");
            setSignatureModalOpen(true);
          }}>
            Firmar
          </Button>
        </div>
      </section>

      {signatureModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#0f172a]/65 p-3 md:items-center md:p-6">
          <div className="w-full max-w-[640px] rounded-[28px] border border-[#d5dfeb] bg-[#eef4fb] shadow-[0_24px_70px_rgba(15,23,42,0.25)]">
            <div className="border-b border-[#d5dfeb] px-5 py-4">
              <h3 className="text-lg font-bold text-slate-900">Firma del receptor</h3>
              <p className="mt-1 text-sm text-slate-600">Firma dentro del recuadro y agrega una observación si necesitas dejar constancia de algo recibido.</p>
            </div>

            <div className="space-y-4 px-5 py-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-800">Firma</p>
                <button
                  type="button"
                  className="rounded-full border border-[#d9dee7] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.08em] text-slate-600"
                  onClick={() => {
                    signaturePadRef.current?.clear?.();
                    setHasSignature(false);
                    setSignatureError("");
                  }}
                >
                  Limpiar
                </button>
              </div>

              <SignatureCanvas canvasRef={signaturePadRef} onChange={setHasSignature} />

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-800">Observaciones</span>
                <textarea
                  value={signatureObservation}
                  onChange={(event) => setSignatureObservation(event.target.value)}
                  rows={4}
                  placeholder="Ejemplo: equipo recibido con una observación menor, accesorio pendiente, comentario de entrega, etc."
                  className="w-full rounded-[18px] border border-[#d5dfeb] bg-[#f6f9fd] px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-[#93c5fd] focus:ring-2 focus:ring-[#bfdbfe]"
                />
              </label>

              {signatureError ? <p className="text-sm font-medium text-[#b91c1c]">{signatureError}</p> : null}

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSignatureModalOpen(false);
                    setSignatureError("");
                  }}
                  disabled={submitting}
                >
                  Cancelar
                </Button>
                <Button onClick={handleSubmit} disabled={submitting || !hasSignature}>
                  {submitting ? "Registrando firma..." : "Confirmar firma"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </SignatureStatusLayout>
  );
}

export default MobileSignatureSessionPage;
