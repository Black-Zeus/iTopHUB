import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Panel, PanelHeader } from "../../components/ui/general";
import { Icon } from "../../components/ui/icon/Icon";
import ModalManager from "../../components/ui/modal";
import { Button } from "../../ui/Button";
import { useToast } from "../../ui";
import {
  createHandoverDocument,
  getHandoverBootstrap,
  getHandoverDocument,
  searchHandoverAssets,
  searchHandoverPeople,
  updateHandoverDocument,
} from "../../services/handover-service";
import {
  HandoverEditorSections,
  MessageBanner,
  cloneTemplate,
  createEmptyForm,
  createFormFromDetail,
  getAssetAssignmentRestriction,
  matchesTemplateCmdbClass,
} from "./handover-editor-shared";

const SECONDARY_ROLE_OPTIONS = ["Contraturno", "Referente de area", "Respaldo operativo", "Testigo"];

function ResolveReceiverConflictModalContent({
  currentPrimary,
  nextPrimary,
  onCancel,
  onPromoteNewPrimary,
  onKeepCurrentPrimary,
}) {
  const [secondaryRole, setSecondaryRole] = useState("Contraturno");

  return (
    <div className="grid gap-5">
      <p className="text-sm text-[var(--text-secondary)]">
        Ya existe una persona principal en esta acta. Elige como quieres reorganizar a ambas personas antes de continuar.
      </p>

      <div className="grid gap-3 rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-app)] p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Principal actual</p>
          <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">{currentPrimary?.name}</p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{`${currentPrimary?.code || "Sin codigo"}${currentPrimary?.email ? ` / ${currentPrimary.email}` : ""}`}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Nueva seleccion</p>
          <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">{nextPrimary?.name}</p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{`${nextPrimary?.code || "Sin codigo"}${nextPrimary?.email ? ` / ${nextPrimary.email}` : ""}`}</p>
        </div>
        <label className="grid gap-2">
          <span className="text-sm font-semibold text-[var(--text-primary)]">Motivo para la persona secundaria</span>
          <select value={secondaryRole} onChange={(event) => setSecondaryRole(event.target.value)} className="h-[50px] rounded-[16px] border border-[var(--border-color)] bg-[var(--bg-panel)] px-4 text-sm text-[var(--text-primary)] outline-none">
            {SECONDARY_ROLE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap justify-between gap-3">
        <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => onKeepCurrentPrimary(secondaryRole)}>Mantener principal actual</Button>
          <Button variant="primary" onClick={() => onPromoteNewPrimary(secondaryRole)}>Dejar nueva como principal</Button>
        </div>
      </div>
    </div>
  );
}

export function HandoverDocumentPage() {
  const navigate = useNavigate();
  const { slug } = useParams();
  const isCreateMode = slug === "nueva";
  const { add } = useToast();

  const [bootstrap, setBootstrap] = useState(null);
  const [bootstrapLoading, setBootstrapLoading] = useState(true);
  const [editorLoading, setEditorLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState(createEmptyForm(null));
  const isReadOnly = !isCreateMode && ["Confirmada", "Anulada"].includes(form.status);
  const [personSearchQuery, setPersonSearchQuery] = useState("");
  const [peopleResults, setPeopleResults] = useState([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [assetSearchQuery, setAssetSearchQuery] = useState("");
  const [assetResults, setAssetResults] = useState([]);
  const [assetLoading, setAssetLoading] = useState(false);
  const [selectedTemplateByAsset, setSelectedTemplateByAsset] = useState({});
  const [collapsedSections, setCollapsedSections] = useState({
    document: false,
    receiver: false,
    assets: false,
  });
  const personSearchInputRef = useRef(null);
  const receiverSelectionEndRef = useRef(null);
  const itopPeopleWarningShownRef = useRef(false);

  const statusOptions = bootstrap?.statusOptions || [];
  const activeTemplates = bootstrap?.checklistTemplates || [];
  const minCharsPeople = bootstrap?.searchHints?.minCharsPeople || 2;
  const minCharsAssets = bootstrap?.searchHints?.minCharsAssets || 2;
  const templateOptionsById = useMemo(() => {
    const index = new Map();
    activeTemplates.forEach((template) => {
      index.set(template.id, template);
    });
    return index;
  }, [activeTemplates]);

  const toggleSection = (sectionKey) => {
    setCollapsedSections((current) => ({
      ...current,
      [sectionKey]: !current[sectionKey],
    }));
  };

  const focusPersonSearchInput = () => {
    window.requestAnimationFrame(() => {
      personSearchInputRef.current?.focus();
      personSearchInputRef.current?.select?.();
    });
  };

  const scrollToReceiverSelection = () => {
    window.requestAnimationFrame(() => {
      receiverSelectionEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    });
  };

  const resetPeopleSearch = () => {
    setPersonSearchQuery("");
    setPeopleResults([]);
    setPeopleLoading(false);
  };

  const resetAssetSearch = () => {
    setAssetSearchQuery("");
    setAssetResults([]);
    setAssetLoading(false);
  };

  const showItopUnavailableModal = (message) => {
    if (itopPeopleWarningShownRef.current) {
      return;
    }

    itopPeopleWarningShownRef.current = true;
    ModalManager.error({
      title: "Sin conexion con iTop",
      message: message || "No fue posible consultar Personas de iTop. Revisa la conectividad del servicio e intenta nuevamente.",
    });
  };

  useEffect(() => {
    let cancelled = false;

    const loadBootstrap = async () => {
      setBootstrapLoading(true);
      try {
        const payload = await getHandoverBootstrap();
        if (cancelled) {
          return;
        }
        setBootstrap(payload);
        if (isCreateMode) {
          setForm(createEmptyForm(payload));
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError.message || "No fue posible preparar el modulo.");
        }
      } finally {
        if (!cancelled) {
          setBootstrapLoading(false);
        }
      }
    };

    loadBootstrap();

    return () => {
      cancelled = true;
    };
  }, [isCreateMode]);

  useEffect(() => {
    if (!bootstrap || isCreateMode) {
      if (isCreateMode && bootstrap) {
        setForm(createEmptyForm(bootstrap));
      }
      return;
    }

    let cancelled = false;

    const loadDocument = async () => {
      setEditorLoading(true);
      setError("");
      setPeopleResults([]);
      setAssetResults([]);
      setPersonSearchQuery("");
      setAssetSearchQuery("");
      setSelectedTemplateByAsset({});
      try {
        const detail = await getHandoverDocument(slug);
        if (!cancelled) {
          setForm(createFormFromDetail(detail, bootstrap));
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError.message || "No fue posible abrir el acta seleccionada.");
        }
      } finally {
        if (!cancelled) {
          setEditorLoading(false);
        }
      }
    };

    loadDocument();

    return () => {
      cancelled = true;
    };
  }, [bootstrap, isCreateMode, slug]);

  useEffect(() => {
    let cancelled = false;
    const query = personSearchQuery.trim();

    if (query.length < minCharsPeople) {
      setPeopleResults([]);
      setPeopleLoading(false);
      return undefined;
    }

    const run = async () => {
      setPeopleLoading(true);
      setNotice("");
      setError("");
      try {
        const items = await searchHandoverPeople({ query });
        if (!cancelled) {
          itopPeopleWarningShownRef.current = false;
          setPeopleResults(items);
        }
      } catch (loadError) {
        if (!cancelled) {
          if (loadError.code === "ITOP_UNAVAILABLE") {
            const message = "No fue posible consultar Personas de iTop en este momento. Revisa la conexion del servicio y vuelve a intentar.";
            setError(message);
            showItopUnavailableModal(message);
          } else {
            setError(loadError.message || "No fue posible buscar personas.");
          }
          setPeopleResults([]);
        }
      } finally {
        if (!cancelled) {
          setPeopleLoading(false);
        }
      }
    };

    const timer = window.setTimeout(run, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [minCharsPeople, personSearchQuery]);

  useEffect(() => {
    let cancelled = false;
    const query = assetSearchQuery.trim();

    if (query.length < minCharsAssets) {
      setAssetResults([]);
      setAssetLoading(false);
      return undefined;
    }

    const run = async () => {
      setAssetLoading(true);
      setNotice("");
      setError("");
      try {
        const items = await searchHandoverAssets({ query });
        if (!cancelled) {
          setAssetResults(items);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError.message || "No fue posible buscar activos.");
          setAssetResults([]);
        }
      } finally {
        if (!cancelled) {
          setAssetLoading(false);
        }
      }
    };

    const timer = window.setTimeout(run, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [assetSearchQuery, minCharsAssets]);

  const addAssetToForm = (asset) => {
    const restrictionMessage = getAssetAssignmentRestriction(asset);
    if (restrictionMessage) {
      setError(restrictionMessage);
      resetAssetSearch();
      return;
    }

    if (form.items.some((item) => item.asset?.id === asset.id)) {
      setNotice("El activo seleccionado ya fue agregado al acta.");
      resetAssetSearch();
      return;
    }

    setForm((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          asset,
          notes: "",
          checklists: [],
        },
      ],
    }));
    resetAssetSearch();
    setNotice("");
    setError("");
  };

  const addAdditionalReceiver = (person) => {
    if (form.receiver?.id === person.id) {
      setNotice("La persona principal no puede repetirse como contacto adicional.");
      return;
    }
    if (form.additionalReceivers?.some((item) => item.id === person.id)) {
      setNotice("La persona seleccionada ya fue agregada como contacto adicional.");
      return;
    }

    setForm((current) => ({
      ...current,
      additionalReceivers: [
        ...(current.additionalReceivers || []),
        { ...person, assignmentRole: "Contraturno" },
      ],
    }));
    resetPeopleSearch();
    setError("");
    scrollToReceiverSelection();
    focusPersonSearchInput();
  };

  const upsertAdditionalReceiver = (person, assignmentRole) => {
    setForm((current) => {
      if (current.receiver?.id === person.id) {
        return current;
      }

      const currentItems = current.additionalReceivers || [];
      const existing = currentItems.find((item) => item.id === person.id);

      return {
        ...current,
        additionalReceivers: existing
          ? currentItems.map((item) => item.id === person.id ? { ...item, ...person, assignmentRole } : item)
          : [...currentItems, { ...person, assignmentRole }],
      };
    });
  };

  const openPrimaryReceiverConflictModal = (nextPrimary) => {
    const currentPrimary = form.receiver;
    const modalId = ModalManager.custom({
      title: "Resolver principal de destino",
      size: "medium",
      showFooter: false,
      content: (
        <ResolveReceiverConflictModalContent
          currentPrimary={currentPrimary}
          nextPrimary={nextPrimary}
          onCancel={() => ModalManager.close(modalId)}
          onKeepCurrentPrimary={(secondaryRole) => {
            upsertAdditionalReceiver(nextPrimary, secondaryRole);
            resetPeopleSearch();
            setNotice("");
            setError("");
            scrollToReceiverSelection();
            focusPersonSearchInput();
            ModalManager.close(modalId);
          }}
          onPromoteNewPrimary={(secondaryRole) => {
            setForm((current) => {
              const nextAdditionalReceivers = (current.additionalReceivers || [])
                .filter((item) => item.id !== nextPrimary.id && item.id !== currentPrimary?.id);

              if (currentPrimary?.id && currentPrimary.id !== nextPrimary.id) {
                nextAdditionalReceivers.unshift({ ...currentPrimary, assignmentRole: secondaryRole });
              }

              return {
                ...current,
                receiver: nextPrimary,
                additionalReceivers: nextAdditionalReceivers,
              };
            });
            resetPeopleSearch();
            setNotice("");
            setError("");
            scrollToReceiverSelection();
            focusPersonSearchInput();
            ModalManager.close(modalId);
          }}
        />
      ),
    });
  };

  const promoteAdditionalReceiverToPrimary = (personId) => {
    setForm((current) => {
      const promoted = (current.additionalReceivers || []).find((item) => item.id === personId);
      if (!promoted) {
        return current;
      }

      const nextAdditionalReceivers = (current.additionalReceivers || [])
        .filter((item) => item.id !== personId)
        .concat(current.receiver ? [{ ...current.receiver, assignmentRole: "Contraturno" }] : []);

      return {
        ...current,
        receiver: { ...promoted },
        additionalReceivers: nextAdditionalReceivers,
      };
    });
    setNotice("");
    setError("");
    scrollToReceiverSelection();
  };

  const removePrimaryReceiver = () => {
    setForm((current) => ({ ...current, receiver: null }));
  };

  const requestRemovePrimaryReceiver = async () => {
    const confirmed = await ModalManager.confirm({
      title: "Quitar persona principal",
      message: `Se quitara ${form.receiver?.name || "la persona principal"} de esta acta.`,
      content: "Confirma para eliminar la persona principal actualmente seleccionada.",
      buttons: { cancel: "Cancelar", confirm: "Quitar" },
    });

    if (!confirmed) {
      return;
    }

    removePrimaryReceiver();
    setNotice("");
    setError("");
  };

  const selectPrimaryReceiver = (person) => {
    if (form.receiver?.id && form.receiver.id !== person.id) {
      openPrimaryReceiverConflictModal(person);
      return;
    }

    setForm((current) => ({
      ...current,
      receiver: person,
      additionalReceivers: (current.additionalReceivers || []).filter((item) => item.id !== person.id),
    }));
    resetPeopleSearch();
    setNotice("");
    setError("");
    scrollToReceiverSelection();
    focusPersonSearchInput();
  };

  const removeAdditionalReceiver = (personId) => {
    setForm((current) => ({
      ...current,
      additionalReceivers: (current.additionalReceivers || []).filter((item) => item.id !== personId),
    }));
  };

  const requestRemoveAdditionalReceiver = async (personId) => {
    const person = (form.additionalReceivers || []).find((item) => item.id === personId);
    const confirmed = await ModalManager.confirm({
      title: "Quitar participante secundario",
      message: `Se quitara ${person?.name || "el participante"} de esta acta.`,
      content: "Confirma para eliminar este participante secundario del formulario.",
      buttons: { cancel: "Cancelar", confirm: "Quitar" },
    });

    if (!confirmed) {
      return;
    }

    removeAdditionalReceiver(personId);
    setNotice("");
    setError("");
  };

  const updateAdditionalReceiverRole = (personId, assignmentRole) => {
    setForm((current) => ({
      ...current,
      additionalReceivers: (current.additionalReceivers || []).map((item) => item.id === personId ? { ...item, assignmentRole } : item),
    }));
  };

  const removeAssetFromForm = (assetId) => {
    setForm((current) => ({
      ...current,
      items: current.items.filter((item) => item.asset?.id !== assetId),
    }));
  };

  const requestRemoveAssetFromForm = async (asset) => {
    const confirmed = await ModalManager.confirm({
      title: "Quitar activo",
      message: `Se quitara ${asset?.code || "el activo"} del acta actual.`,
      content: "Confirma para eliminar este activo y sus checklists asociados del formulario.",
      buttons: { cancel: "Cancelar", confirm: "Quitar" },
    });

    if (!confirmed) {
      return;
    }

    removeAssetFromForm(asset?.id);
    setNotice("");
    setError("");
  };

  const updateItemNotes = (assetId, value) => {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => item.asset?.id === assetId ? { ...item, notes: value } : item),
    }));
  };

  const addChecklistToAsset = (assetId) => {
    const templateId = Number(selectedTemplateByAsset[assetId] || 0);
    if (!templateId) {
      return;
    }

    const template = templateOptionsById.get(templateId);
    if (!template) {
      return;
    }

    const targetItem = form.items.find((item) => item.asset?.id === assetId);
    if (!targetItem) {
      return;
    }

    if (!matchesTemplateCmdbClass(targetItem.asset?.className, template.cmdbClassLabel)) {
      setError(`El checklist '${template.name}' no aplica para el activo ${targetItem.asset?.code || targetItem.asset?.name || "seleccionado"}.`);
      return;
    }

    if (targetItem?.checklists.some((checklist) => checklist.templateId === templateId)) {
      setNotice("La plantilla seleccionada ya fue aplicada a este activo.");
      return;
    }

    setForm((current) => ({
      ...current,
      items: current.items.map((item) => {
        if (item.asset?.id !== assetId) {
          return item;
        }
        return {
          ...item,
          checklists: [...item.checklists, cloneTemplate(template)],
        };
      }),
    }));
  };

  const removeChecklistFromAsset = (assetId, templateId) => {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => item.asset?.id === assetId ? { ...item, checklists: item.checklists.filter((checklist) => checklist.templateId !== templateId) } : item),
    }));
  };

  const requestRemoveChecklistFromAsset = async (assetId, templateId) => {
    const assetItem = form.items.find((item) => item.asset?.id === assetId);
    const checklist = assetItem?.checklists?.find((item) => item.templateId === templateId);

    const confirmed = await ModalManager.confirm({
      title: "Quitar checklist",
      message: `Se quitara ${checklist?.templateName || "el checklist"} del activo ${assetItem?.asset?.code || ""}.`,
      content: "Confirma para eliminar este checklist y todas sus respuestas cargadas del formulario.",
      buttons: { cancel: "Cancelar", confirm: "Quitar" },
    });

    if (!confirmed) {
      return;
    }

    removeChecklistFromAsset(assetId, templateId);
    setNotice("");
    setError("");
  };

  const updateChecklistAnswer = (assetId, templateId, checklistItemId, value) => {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => {
        if (item.asset?.id !== assetId) {
          return item;
        }

        return {
          ...item,
          checklists: item.checklists.map((checklist) => {
            if (checklist.templateId !== templateId) {
              return checklist;
            }

            return {
              ...checklist,
              answers: checklist.answers.map((answer) => answer.checklistItemId === checklistItemId ? { ...answer, value } : answer),
            };
          }),
        };
      }),
    }));
  };

  const handleSave = async () => {
    setError("");
    setNotice("");

    if (!form.reason.trim()) {
      setError("Debes indicar el motivo de entrega.");
      return;
    }

    setSaving(true);

    const payload = {
      generatedAt: form.creationDate,
      creationDate: form.creationDate,
      assignmentDate: form.assignmentDate,
      evidenceDate: form.evidenceDate,
      generatedDocuments: form.generatedDocuments || [],
      evidenceAttachments: form.evidenceAttachments || [],
      status: form.status,
      handoverType: form.handoverType,
      reason: form.reason,
      notes: form.notes,
      receiver: form.receiver || {},
      additionalReceivers: form.additionalReceivers || [],
      items: form.items,
    };

    const invalidAsset = form.items.find((item) => getAssetAssignmentRestriction(item.asset));
    if (invalidAsset) {
      setSaving(false);
      setError(getAssetAssignmentRestriction(invalidAsset.asset));
      return;
    }

    try {
      const savedItem = isCreateMode
        ? await createHandoverDocument(payload)
        : await updateHandoverDocument(slug, payload);

      add({
        title: isCreateMode ? "Acta creada" : "Acta actualizada",
        description: `El acta ${savedItem.documentNumber || ""} fue guardada correctamente.`,
        tone: "success",
      });

      navigate("/handover");
    } catch (saveError) {
      setError(saveError.message || "No fue posible guardar el acta.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-5">
      <Panel className="overflow-hidden">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
          <div className="grid gap-3">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Workspace</p>
            <div>
              <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
                {isCreateMode ? "Nueva acta de entrega" : isReadOnly ? "Detalle de acta de entrega" : "Edicion de acta de entrega"}
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-[var(--text-secondary)]">
                Trabaja el documento en una pagina completa para tener mejor separacion visual entre datos del acta, destinatario y activos asociados.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 xl:justify-end">
            <Button variant="secondary" onClick={() => navigate("/handover")}>
              <Icon name="arrowLeft" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Volver al listado
            </Button>
            {!isReadOnly ? (
              <Button variant="primary" onClick={handleSave} disabled={saving || bootstrapLoading || editorLoading}>
                <Icon name="save" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Guardar acta
              </Button>
            ) : null}
          </div>
        </div>
      </Panel>

      {error ? <MessageBanner tone="danger">{error}</MessageBanner> : null}
      {notice ? <MessageBanner tone="success">{notice}</MessageBanner> : null}

      {bootstrapLoading || editorLoading ? (
        <Panel>
          <PanelHeader eyebrow="Carga" title={isCreateMode ? "Preparando nueva acta" : "Cargando acta"} />
          <MessageBanner>{isCreateMode ? "Preparando datos base del formulario..." : "Cargando acta seleccionada..."}</MessageBanner>
        </Panel>
      ) : (
        <HandoverEditorSections
          form={form}
          statusOptions={statusOptions}
          peopleLoading={peopleLoading}
          peopleResults={peopleResults}
          personSearchQuery={personSearchQuery}
          setPersonSearchQuery={setPersonSearchQuery}
          personSearchInputRef={personSearchInputRef}
          receiverSelectionEndRef={receiverSelectionEndRef}
          setForm={setForm}
          assetLoading={assetLoading}
          assetResults={assetResults}
          assetSearchQuery={assetSearchQuery}
          setAssetSearchQuery={setAssetSearchQuery}
          activeTemplates={activeTemplates}
          selectedTemplateByAsset={selectedTemplateByAsset}
          setSelectedTemplateByAsset={setSelectedTemplateByAsset}
          addAssetToForm={addAssetToForm}
          requestRemoveAssetFromForm={requestRemoveAssetFromForm}
          updateItemNotes={updateItemNotes}
          addChecklistToAsset={addChecklistToAsset}
          requestRemoveChecklistFromAsset={requestRemoveChecklistFromAsset}
          updateChecklistAnswer={updateChecklistAnswer}
          collapsedSections={collapsedSections}
          toggleSection={toggleSection}
          isCreateMode={isCreateMode}
          notesPlaceholder={bootstrap?.defaults?.notesPlaceholder || ""}
          minCharsPeople={minCharsPeople}
          minCharsAssets={minCharsAssets}
          selectPrimaryReceiver={selectPrimaryReceiver}
          promoteAdditionalReceiverToPrimary={promoteAdditionalReceiverToPrimary}
          requestRemovePrimaryReceiver={requestRemovePrimaryReceiver}
          addAdditionalReceiver={addAdditionalReceiver}
          requestRemoveAdditionalReceiver={requestRemoveAdditionalReceiver}
          updateAdditionalReceiverRole={updateAdditionalReceiverRole}
          allowEvidenceUpload={Boolean(bootstrap?.actions?.allowEvidenceUpload ?? true)}
          readOnly={isReadOnly}
          documentId={isCreateMode ? null : slug}
        />
      )}
    </div>
  );
}
