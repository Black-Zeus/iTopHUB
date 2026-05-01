import { useParams } from "react-router-dom";
import { fetchPublicHandoverSignatureDocumentBlob, getPublicHandoverSignatureSession, submitPublicHandoverSignature } from "../../services/handover-service";
import MobileSignatureSessionPage from "../../modules/signature/MobileSignatureSessionPage";

export function HandoverSignaturePage() {
  const { token = "" } = useParams();

  return (
    <MobileSignatureSessionPage
      token={token}
      loadSession={getPublicHandoverSignatureSession}
      openDocument={async (currentToken, documentKind, options = {}) => {
        const { url } = await fetchPublicHandoverSignatureDocumentBlob(currentToken, documentKind, options);
        window.open(url, "_blank", "noopener,noreferrer");
      }}
      submitSignature={submitPublicHandoverSignature}
    />
  );
}

export default HandoverSignaturePage;
