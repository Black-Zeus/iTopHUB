export const HANDOVER_DOCUMENT_TYPE_OPTIONS = [
  { value: "acta", label: "Acta" },
  { value: "detalle", label: "Detalle" },
];

export function getHandoverDocumentTypeLabel(value) {
  return HANDOVER_DOCUMENT_TYPE_OPTIONS.find((option) => option.value === value)?.label || "";
}

export function getHandoverAttachmentIconName(name) {
  const extension = String(name || "").split(".").pop()?.toLowerCase();
  if (extension === "pdf") {
    return "fileLines";
  }
  if (extension === "doc" || extension === "docx") {
    return "regFileLines";
  }
  return "regFile";
}

export function inferHandoverLibraryDocumentType(documentItem) {
  const kind = String(documentItem?.kind || "").trim().toLowerCase();
  if (kind === "main") {
    return "acta";
  }
  if (kind === "detail") {
    return "detalle";
  }

  const explicitType = String(documentItem?.documentType || "").trim().toLowerCase();
  if (explicitType === "acta" || explicitType === "detalle") {
    return explicitType;
  }

  const normalizedName = String(documentItem?.name || documentItem?.storedName || documentItem?.code || "").trim().toUpperCase();
  if (normalizedName.includes("ENTD-")) {
    return "detalle";
  }
  if (normalizedName.includes("ENT-")) {
    return "acta";
  }
  return "";
}

export function buildHandoverDocumentLibraryEntries({
  generatedDocuments = [],
  evidenceAttachments = [],
  generatedFallbackUploadedAt = "",
}) {
  const entriesByType = new Map();

  evidenceAttachments.forEach((attachment, index) => {
    const documentType = inferHandoverLibraryDocumentType(attachment);
    if (!documentType || entriesByType.has(documentType)) {
      return;
    }
    entriesByType.set(documentType, {
      id: `attachment-${attachment.storedName || index}`,
      origin: "attachment",
      payload: attachment,
      documentType,
      name: attachment.name || attachment.storedName || getHandoverDocumentTypeLabel(documentType),
      uploadedAt: attachment.uploadedAt || "",
      iconName: getHandoverAttachmentIconName(attachment.name),
      isAvailable: Boolean(attachment.storedName),
    });
  });

  generatedDocuments.forEach((generatedDocument, index) => {
    const documentType = inferHandoverLibraryDocumentType(generatedDocument);
    if (!documentType || entriesByType.has(documentType)) {
      return;
    }
    entriesByType.set(documentType, {
      id: `generated-${generatedDocument.kind || index}`,
      origin: "generated",
      payload: generatedDocument,
      documentType,
      name: generatedDocument.name || generatedDocument.code || getHandoverDocumentTypeLabel(documentType),
      uploadedAt: generatedDocument.uploadedAt || generatedFallbackUploadedAt || "",
      iconName: "fileLines",
      isAvailable: Boolean(generatedDocument.kind),
    });
  });

  return ["acta", "detalle"]
    .map((documentType) => entriesByType.get(documentType))
    .filter(Boolean);
}
