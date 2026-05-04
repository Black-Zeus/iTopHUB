import { useParams } from "react-router-dom";
import {
  fetchPublicLabSignatureDocumentBlob,
  getPublicLabSignatureSession,
  submitPublicLabSignature,
} from "../../services/lab-service";
import MobileSignatureSessionPage from "../../modules/signature/MobileSignatureSessionPage";

export function LabSignaturePage() {
  const { token = "" } = useParams();

  return (
    <MobileSignatureSessionPage
      token={token}
      loadSession={getPublicLabSignatureSession}
      openDocument={async (currentToken, documentKind, options = {}) => {
        const { url } = await fetchPublicLabSignatureDocumentBlob(currentToken, documentKind, options);
        window.open(url, "_blank", "noopener,noreferrer");
      }}
      submitSignature={submitPublicLabSignature}
    />
  );
}

export default LabSignaturePage;
