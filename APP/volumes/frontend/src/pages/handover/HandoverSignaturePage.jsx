import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "../../ui/Button";
import SignatureCanvas from "../../components/ui/general/SignatureCanvas";
import {
  fetchPublicHandoverSignatureDocumentBlob,
  getPublicHandoverSignatureSession,
  submitPublicHandoverSignature,
} from "../../services/handover-service";

function SignatureStatusLayout({ tone = "default", badge = "", title, description, children }) {
  const toneClasses = {
    success: "border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d]",
    danger: "border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]",
    warning: "border-[#fde68a] bg-[#fffbeb] text-[#92400e]",
    default: "border-[#cbd5e1] bg-white text-[#0f172a]",
  };

  return (
    <div className="min-h-screen bg-[#eef1f5] px-4 py-6 text-[#1f2937]">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-[680px] grid-rows-[auto_1fr] overflow-hidden rounded-[28px] border border-[#d9dee7] bg-[#f8fafc] shadow-[0_24px_70px_rgba(15,23,42,0.12)]">
        <header className="bg-[#0f172a] px-6 py-6 text-white">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-300">iTop Hub</p>
          <h1 className="mt-2 text-[24px] font-bold">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-300">{description}</p>
        </header>
        <main className="space-y-4 p-5">
          <section className={`rounded-[20px] border px-5 py-4 ${toneClasses[tone] || toneClasses.default}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold">{title}</h2>
                <p className="mt-1 text-sm leading-6 opacity-80">{description}</p>
              </div>
              {badge ? <span className="rounded-full border border-current px-3 py-1 text-[11px] font-bold uppercase tracking-[0.1em]">{badge}</span> : null}
            </div>
          </section>
          {children}
        </main>
      </div>
    </div>
  );
}

export function HandoverSignaturePage() {
  const { token = "" } = useParams();
  const signaturePadRef = useRef(null);
  const [session, setSession] = useState(null);
  const [busy, setBusy] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [hasSignature, setHasSignature] = useState(false);

  const loadSession = async () => {
    try {
      setBusy(true);
      setError("");
      const payload = await getPublicHandoverSignatureSession(token);
      setSession(payload);
    } catch (loadError) {
      setError(loadError.message || "No fue posible cargar la sesión de firma.");
      setSession(null);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    loadSession();
  }, [token]);

  const openDocument = async (documentKind) => {
    const { url } = await fetchPublicHandoverSignatureDocumentBlob(token, documentKind);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleSubmit = async () => {
    const signatureDataUrl = signaturePadRef.current?.toDataUrl?.() || "";
    if (!signatureDataUrl) {
      setError("Debes dibujar tu firma antes de continuar.");
      return;
    }
    try {
      setSubmitting(true);
      setError("");
      const payload = await submitPublicHandoverSignature(token, {
        signatureDataUrl,
        signerName: session?.receiver?.name || "",
        signerRole: session?.receiver?.role || "",
      });
      setSession(payload);
    } catch (submitError) {
      setError(submitError.message || "No fue posible registrar la firma digital.");
    } finally {
      setSubmitting(false);
    }
  };

  if (busy) {
    return (
      <SignatureStatusLayout title="Cargando firma digital" description="Estamos preparando los datos del acta y validando la sesión QR.">
        <section className="rounded-[20px] border border-[#d9dee7] bg-white px-5 py-6 text-sm text-slate-600">
          Recuperando la sesión de firma...
        </section>
      </SignatureStatusLayout>
    );
  }

  if (error && !session) {
    return (
      <SignatureStatusLayout tone="danger" badge="Error" title="Error al procesar firma" description={error}>
        <section className="rounded-[20px] border border-[#d9dee7] bg-white px-5 py-6 text-sm text-slate-600">
          Revisa el QR recibido y solicita uno nuevo desde el Hub si el problema persiste.
        </section>
      </SignatureStatusLayout>
    );
  }

  if (!session || ["expired", "cancelled"].includes(session.status) || !["Emitida", "Firmada", "Confirmada"].includes(session.documentStatus)) {
    return (
      <SignatureStatusLayout tone="warning" badge="No disponible" title="Firma no disponible" description="Esta sesión ya no está activa o el documento cambió de estado en el Hub.">
        <section className="rounded-[20px] border border-[#d9dee7] bg-white px-5 py-6 text-sm text-slate-600">
          Pide al operador que genere un nuevo QR desde la acta correspondiente.
        </section>
      </SignatureStatusLayout>
    );
  }

  if (["signed", "published"].includes(session.status) || session.documentStatus === "Firmada" || session.documentStatus === "Confirmada") {
    return (
      <SignatureStatusLayout tone="success" badge="Completada" title="Firma registrada" description="La firma digital ya quedó asociada al acta. Puedes cerrar esta pantalla.">
        <section className="grid gap-3 rounded-[20px] border border-[#d9dee7] bg-white px-5 py-5 md:grid-cols-2">
          <div className="rounded-[16px] bg-[#f8fafc] px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">Acta</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{session.documentNumber || "-"}</p>
          </div>
          <div className="rounded-[16px] bg-[#f8fafc] px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">Estado actual</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{session.documentStatus || "-"}</p>
          </div>
        </section>
      </SignatureStatusLayout>
    );
  }

  return (
    <SignatureStatusLayout
      badge="Pendiente"
      title={`Firma de ${session.handoverType || "Acta"}`}
      description="Revisa los datos del documento, abre los PDFs si lo necesitas y firma en el recuadro inferior para continuar."
    >
      <section className="grid gap-3 rounded-[20px] border border-[#d9dee7] bg-white p-5 md:grid-cols-2">
        <div className="rounded-[16px] bg-[#f8fafc] px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">Acta</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{session.documentNumber || "-"}</p>
        </div>
        <div className="rounded-[16px] bg-[#f8fafc] px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">Persona destino</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{session.receiver?.name || "-"}</p>
        </div>
        <div className="rounded-[16px] bg-[#f8fafc] px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">Cargo</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{session.receiver?.role || "Sin cargo"}</p>
        </div>
        <div className="rounded-[16px] bg-[#f8fafc] px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">Fecha asignación</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{session.assignmentDate || "-"}</p>
        </div>
      </section>

      <section className="rounded-[20px] border border-[#d9dee7] bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Documentos asociados</h2>
            <p className="mt-1 text-sm text-slate-500">Puedes revisar el acta y su detalle técnico antes de firmar.</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3">
          {(session.documents || []).map((document) => (
            <button
              key={document.kind}
              type="button"
              className="flex items-center justify-between rounded-[16px] border border-[#d9dee7] bg-[#f8fafc] px-4 py-3 text-left transition hover:border-[#93c5fd] hover:bg-[#eff6ff]"
              onClick={() => openDocument(document.kind)}
            >
              <span>
                <span className="block text-sm font-semibold text-slate-900">{document.name || document.kind}</span>
                <span className="mt-1 block text-xs uppercase tracking-[0.08em] text-slate-500">{document.kind === "main" ? "Acta principal" : "Detalle técnico"}</span>
              </span>
              <span className="text-xs font-bold uppercase tracking-[0.08em] text-[#1d4ed8]">Abrir</span>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-[20px] border border-[#d9dee7] bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Firma digital</h2>
            <p className="mt-1 text-sm text-slate-500">Firma con el dedo o lápiz táctil dentro del recuadro.</p>
          </div>
          <button
            type="button"
            className="rounded-full border border-[#d9dee7] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.08em] text-slate-600"
            onClick={() => signaturePadRef.current?.clear?.()}
          >
            Limpiar
          </button>
        </div>
        <div className="mt-4">
          <SignatureCanvas canvasRef={signaturePadRef} onChange={setHasSignature} />
        </div>
        {error ? <p className="mt-3 text-sm font-medium text-[#b91c1c]">{error}</p> : null}
        <div className="mt-4">
          <Button className="w-full" onClick={handleSubmit} disabled={submitting || !hasSignature}>
            {submitting ? "Registrando firma..." : "Firmar acta"}
          </Button>
        </div>
      </section>
    </SignatureStatusLayout>
  );
}

export default HandoverSignaturePage;
