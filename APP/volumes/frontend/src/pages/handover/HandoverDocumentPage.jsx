import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FilterDropdown, Panel, PanelHeader } from "../../components/ui/general";
import { ScrollToTopButton } from "../../components/ui/general/ScrollToTopButton";
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
import { getUsers } from "../../services/user-service";
import {
  HandoverEditorSections,
  MessageBanner,
  cloneTemplate,
  createEmptyForm,
  createFormFromDetail,
  getAssetAssignmentRestriction,
  matchesTemplateCmdbClass,
} from "./handover-editor-shared";
import { getHandoverModuleConfig } from "./handover-module-config";
import { buildNormalizationRequesterOptions } from "./normalization-requester-options";

const SECONDARY_ROLE_OPTIONS = ["Contraturno", "Referente de area", "Respaldo operativo", "Testigo"];
const NORMALIZATION_STATUS_FALLBACK_OPTIONS = [
  { value: "stock", label: "En stock" },
  { value: "production", label: "En produccion" },
  { value: "implementation", label: "En implementacion" },
  { value: "test", label: "En prueba" },
  { value: "obsolete", label: "Obsoleto" },
  { value: "inactive", label: "Inactivo" },
];

function resolveOptionLabel(options = [], value = "", fallback = "") {
  const normalizedValue = String(value || "").trim();
  if (!normalizedValue) {
    return fallback;
  }
  return options.find((option) => String(option?.value || "").trim() === normalizedValue)?.label || fallback || normalizedValue;
}

function renderNormalizationDropdownSelection({ label, selectedOptions, placeholder }) {
  const selectedOption = selectedOptions[0] || null;
  return (
    <span className="flex min-w-0 items-center gap-3">
      {selectedOption?.iconName ? (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-strong)]">
          <Icon name={selectedOption.iconName} size={14} className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
          {label}
        </span>
        <span className="mt-1 block truncate text-sm font-semibold text-[var(--text-primary)]">
          {selectedOption?.label || placeholder}
        </span>
      </span>
    </span>
  );
}

function renderCatalogDropdownSelection({ label, selectedOptions, placeholder }) {
  return (
    <>
      <span className="block text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
        {label}
      </span>
      <span className="mt-1 block truncate text-sm font-semibold text-[var(--text-primary)]">
        {selectedOptions[0]?.label || placeholder}
      </span>
    </>
  );
}

function renderCatalogDropdownOptionLeading() {
  return <span className="inline-flex h-2.5 w-2.5 rounded-full bg-current opacity-70" />;
}

function getCatalogDropdownOptionClassName(_, isActive) {
  return isActive
    ? "border-transparent bg-[var(--accent-soft)] text-[var(--accent-strong)] shadow-[0_10px_22px_rgba(81,152,194,0.14)]"
    : "border-transparent bg-transparent text-[var(--text-secondary)] hover:border-[var(--border-color)] hover:bg-[var(--bg-app)] hover:text-[var(--text-primary)]";
}

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

function AssignedAssetSelectionModalContent({
  responsible,
  selectedAssetIds,
  enforceSingleAssignment = false,
  helperText = "Esta lista se carga desde iTop solo con los activos actualmente asociados a esta persona.",
  onLoad,
  onSelectAsset,
  onCancel,
}) {
  const [filter, setFilter] = useState("");
  const [allItems, setAllItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [localSelectedAssetIds, setLocalSelectedAssetIds] = useState(() => new Set(Array.from(selectedAssetIds || [])));

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const nextItems = await onLoad();
        if (!cancelled) {
          setAllItems(nextItems);
        }
      } catch (loadError) {
        if (!cancelled) {
          setAllItems([]);
          setError(loadError.message || "No fue posible cargar los activos del responsable. Revisa la conexion con iTop.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    run();
    return () => { cancelled = true; };
  }, [onLoad]);

  const normalizedFilter = filter.trim().toLowerCase();
  const filteredItems = normalizedFilter
    ? allItems.filter((asset) => {
        const haystack = [asset.code, asset.name, asset.className, asset.serial, asset.organization, asset.location]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return normalizedFilter.split(/\s+/).every((token) => haystack.includes(token));
      })
    : allItems;

  return (
    <div className="grid gap-4">
      <div className="rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-app)] p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Responsable</p>
        <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">{responsible?.name || "Sin responsable"}</p>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          {[responsible?.code, responsible?.email].filter(Boolean).join(" / ") || "Sin informacion adicional."}
        </p>
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          {helperText}
        </p>
      </div>

      {!loading && allItems.length > 0 ? (
        <label className="grid gap-2">
          <span className="text-sm font-semibold text-[var(--text-primary)]">Filtrar activos</span>
          <input
            type="search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="h-[50px] rounded-[16px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 text-sm text-[var(--text-primary)] outline-none"
            placeholder="Codigo, nombre, tipo o ubicacion..."
            autoFocus
          />
        </label>
      ) : null}

      {error ? <MessageBanner tone="danger">{error}</MessageBanner> : null}

      {loading ? (
        <MessageBanner>Cargando activos del responsable desde iTop...</MessageBanner>
      ) : null}

      {!loading && !error && allItems.length === 0 ? (
        <MessageBanner>Este responsable no tiene activos asociados actualmente en iTop.</MessageBanner>
      ) : null}

      {!loading && !error && allItems.length > 0 && filteredItems.length === 0 ? (
        <MessageBanner>No hay activos que coincidan con el filtro ingresado.</MessageBanner>
      ) : null}

      <div className="grid gap-3 max-h-[min(420px,calc(100vh-20rem))] overflow-y-auto pr-1">
        {filteredItems.map((asset) => {
          const restrictionMessage = getAssetAssignmentRestriction(asset, {
            assetSelectionMode: "assigned_to_receiver",
            receiver: responsible,
            enforceSingleAssignment,
          });
          const alreadySelected = localSelectedAssetIds.has(Number(asset.id));

          return (
            <div key={asset.id} className="flex flex-wrap items-start justify-between gap-3 rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{asset.code} / {asset.name}</p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">{[asset.className, asset.serial].filter(Boolean).join(" / ")}</p>
                {(asset.organization || asset.location) ? (
                  <p className="mt-1 text-xs text-[var(--text-muted)]">{[asset.organization, asset.location].filter(Boolean).join(" / ")}</p>
                ) : null}
                <p className="mt-1 text-xs text-[var(--text-muted)]">{[asset.status, restrictionMessage].filter(Boolean).join(" — ")}</p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  onSelectAsset(asset);
                  setLocalSelectedAssetIds((current) => new Set([...current, Number(asset.id)]));
                }}
                disabled={alreadySelected || Boolean(restrictionMessage)}
              >
                {alreadySelected ? "Ya agregado" : "Vincular"}
              </Button>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        {!loading && allItems.length > 0 ? (
          <span className="text-xs text-[var(--text-muted)]">
            {filteredItems.length} de {allItems.length} {allItems.length === 1 ? "activo" : "activos"}
          </span>
        ) : <span />}
        <Button variant="secondary" onClick={onCancel}>Cerrar</Button>
      </div>
    </div>
  );
}

export function HandoverDocumentPage({ moduleVariant = "delivery" }) {
  const navigate = useNavigate();
  const { slug } = useParams();
  const isCreateMode = slug === "nueva";
  const { add } = useToast();
  const moduleConfig = getHandoverModuleConfig(moduleVariant);
  const isReturnFlow = moduleConfig.key === "return";
  const isReassignmentFlow = moduleConfig.key === "reassignment";
  const isNormalizationFlow = moduleConfig.key === "normalization";
  const isAssignedAssetFlow = isReturnFlow || isReassignmentFlow;

  const [bootstrap, setBootstrap] = useState(null);
  const [bootstrapLoading, setBootstrapLoading] = useState(true);
  const [editorLoading, setEditorLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [normalizationRequesterOptions, setNormalizationRequesterOptions] = useState([]);
  const [normalizationRequesterLoading, setNormalizationRequesterLoading] = useState(false);
  const [form, setForm] = useState(createEmptyForm(null, { moduleVariant, defaultHandoverType: moduleConfig.handoverType }));
  const isReadOnly = !isCreateMode && ["Firmada", "Confirmada", "Anulada"].includes(form.status);
  const activeModeConfig = isNormalizationFlow
    ? (moduleConfig.normalizationModes || []).find((mode) => mode.value === form.normalizationMode) || null
    : null;
  const normalizationRequiresReceiver = activeModeConfig?.requiresReceiver ?? false;
  const normalizationRequiresTargetStatus = Boolean(activeModeConfig?.requiresTargetStatus);
  const normalizationRequiresTargetLocation = Boolean(activeModeConfig?.requiresTargetLocation);
  const normalizationEnforceSingleAssignment = Boolean(activeModeConfig?.enforceSingleAssignment);
  const normalizationAssetSelectionMode = activeModeConfig?.assetSelectionMode || "inline";
  const isNormalizationAssignedAssetFlow = isNormalizationFlow && normalizationAssetSelectionMode === "modal";
  const effectiveIsAssignedAssetFlow = isAssignedAssetFlow || isNormalizationAssignedAssetFlow;
  const effectiveAssetRestrictionMode = isNormalizationFlow
    ? (isNormalizationAssignedAssetFlow ? "assigned_to_receiver" : "none")
    : (effectiveIsAssignedAssetFlow ? "assigned_to_receiver" : "stock_unassigned");
  const [sourceSearchQuery, setSourceSearchQuery] = useState("");
  const [sourceResults, setSourceResults] = useState([]);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [personSearchQuery, setPersonSearchQuery] = useState("");
  const [peopleResults, setPeopleResults] = useState([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [assetSearchQuery, setAssetSearchQuery] = useState("");
  const [assetResults, setAssetResults] = useState([]);
  const [assetLoading, setAssetLoading] = useState(false);
  const [selectedTemplateByAsset, setSelectedTemplateByAsset] = useState({});
  const [collapsedSections, setCollapsedSections] = useState({
    document: false,
    requester: false,
    itop: false,
    source: false,
    receiver: false,
    assets: false,
  });
  const sourceSearchInputRef = useRef(null);
  const personSearchInputRef = useRef(null);
  const sourceSelectionEndRef = useRef(null);
  const receiverSelectionEndRef = useRef(null);
  const itopPeopleWarningShownRef = useRef(false);
  const pageRootRef = useRef(null);
  const formRef = useRef(form);

  const statusOptions = bootstrap?.statusOptions || [];
  const normalizationStatusOptions = bootstrap?.normalizationCatalog?.statusOptions?.length
    ? bootstrap.normalizationCatalog.statusOptions
    : NORMALIZATION_STATUS_FALLBACK_OPTIONS;
  const normalizationLocationOptions = bootstrap?.normalizationCatalog?.locationOptions || [];
  const normalizationReceiverSectionTitle = isNormalizationFlow ? "Destino y parametros" : moduleConfig.receiverSectionTitle;
  const normalizationReceiverSectionHelper = isNormalizationFlow
    ? "Mantén en esta seccion la persona vinculada, cuando aplique, y los parametros CMDB que esta acta modificara."
    : moduleConfig.receiverSectionHelper;
  const activeTemplates = useMemo(() => (
    (bootstrap?.checklistTemplates || []).filter((template) => {
      const usageType = String(template?.usageType || "delivery").trim().toLowerCase();
      return usageType === String(moduleConfig.checklistUsageType || "delivery").trim().toLowerCase();
    })
  ), [bootstrap?.checklistTemplates, moduleConfig.checklistUsageType]);
  const minCharsPeople = bootstrap?.searchHints?.minCharsPeople || 2;
  const minCharsAssets = bootstrap?.searchHints?.minCharsAssets || 2;
  const templateOptionsById = useMemo(() => {
    const index = new Map();
    activeTemplates.forEach((template) => {
      index.set(template.id, template);
    });
    return index;
  }, [activeTemplates]);
  const sourceResponsible = useMemo(() => (
    (form.additionalReceivers || []).find((person) => String(person?.assignmentRole || "").trim().toLowerCase() === "responsable origen")
    || form.additionalReceivers?.[0]
    || null
  ), [form.additionalReceivers]);
  const normalizationParameterContent = useMemo(() => {
    if (!isNormalizationFlow || !form.normalizationMode) {
      return null;
    }

    if (!normalizationRequiresTargetStatus && !normalizationRequiresTargetLocation) {
      return null;
    }

    const parameterGridClass = normalizationRequiresTargetStatus && normalizationRequiresTargetLocation
      ? "md:grid-cols-2"
      : "grid-cols-1";

    return (
      <div className="grid gap-4 rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-panel)] p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Parametros del cambio</p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Define aqui los valores finales que la normalizacion aplicara sobre los activos seleccionados.
          </p>
        </div>
        <div className={`grid gap-4 ${parameterGridClass}`}>
          {normalizationRequiresTargetStatus && isReadOnly ? (
            <div className="grid gap-2">
              <span className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                Estado destino
              </span>
              <div className="min-h-[66px] rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-4 text-sm font-semibold text-[var(--text-primary)]">
                {resolveOptionLabel(
                  normalizationStatusOptions,
                  form.normalizationParams?.targetStatus || "",
                  "Sin configurar"
                )}
              </div>
            </div>
          ) : null}
          {normalizationRequiresTargetStatus && !isReadOnly ? (
            <FilterDropdown
              label="Estado destino"
              options={normalizationStatusOptions}
              selectedValues={form.normalizationParams?.targetStatus ? [String(form.normalizationParams.targetStatus)] : []}
              selectionMode="single"
              onToggleOption={(value) => setForm((current) => ({
                ...current,
                normalizationParams: { ...current.normalizationParams, targetStatus: value },
              }))}
              onClear={() => setForm((current) => ({
                ...current,
                normalizationParams: { ...current.normalizationParams, targetStatus: "" },
              }))}
              title="Seleccionar estado destino"
              description="Selecciona el estado final que quedara registrado en iTop."
              iconName="tag"
              showTriggerIcon={true}
              triggerClassName="min-h-[66px]"
              buttonHeightClassName="min-h-[66px]"
              menuOffsetClassName="top-[calc(100%+0.55rem)]"
              menuClassName="rounded-[18px]"
              renderSelection={({ label, selectedOptions }) => renderCatalogDropdownSelection({
                label,
                selectedOptions,
                placeholder: "Selecciona un estado",
              })}
              renderOptionDescription={(option) => option.description || "Selecciona un valor"}
              renderOptionLeading={renderCatalogDropdownOptionLeading}
              getOptionClassName={getCatalogDropdownOptionClassName}
            />
          ) : null}
          {normalizationRequiresTargetLocation && isReadOnly ? (
            <div className="grid gap-2">
              <span className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                Locacion destino
              </span>
              <div className="min-h-[66px] rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-4 text-sm font-semibold text-[var(--text-primary)]">
                {resolveOptionLabel(
                  normalizationLocationOptions,
                  form.normalizationParams?.targetLocationId || "",
                  form.normalizationParams?.targetLocationName || "Sin configurar"
                )}
              </div>
            </div>
          ) : null}
          {normalizationRequiresTargetLocation && !isReadOnly ? (
            <FilterDropdown
              label="Locacion destino"
              options={normalizationLocationOptions}
              selectedValues={form.normalizationParams?.targetLocationId ? [String(form.normalizationParams.targetLocationId)] : []}
              selectionMode="single"
              onToggleOption={(value) => {
                const selectedOption = normalizationLocationOptions.find((option) => String(option.value) === String(value)) || null;
                setForm((current) => ({
                  ...current,
                  normalizationParams: {
                    ...current.normalizationParams,
                    targetLocationId: value,
                    targetLocationName: selectedOption?.name || selectedOption?.label || "",
                  },
                }));
              }}
              onClear={() => setForm((current) => ({
                ...current,
                normalizationParams: {
                  ...current.normalizationParams,
                  targetLocationId: "",
                  targetLocationName: "",
                },
              }))}
              title="Seleccionar locacion destino"
              description="Selecciona la locacion logica final que quedara registrada en iTop."
              iconName="location"
              showTriggerIcon={true}
              triggerClassName="min-h-[66px]"
              buttonHeightClassName="min-h-[66px]"
              menuOffsetClassName="top-[calc(100%+0.55rem)]"
              menuClassName="rounded-[18px]"
              renderSelection={({ label, selectedOptions }) => renderCatalogDropdownSelection({
                label,
                selectedOptions,
                placeholder: normalizationLocationOptions.length ? "Selecciona una locacion" : "No hay locaciones disponibles",
              })}
              renderOptionDescription={(option) => option.description || "Selecciona un valor"}
              renderOptionLeading={renderCatalogDropdownOptionLeading}
              getOptionClassName={getCatalogDropdownOptionClassName}
            />
          ) : null}
        </div>
      </div>
    );
  }, [
    form.normalizationMode,
    form.normalizationParams,
    isNormalizationFlow,
    isReadOnly,
      normalizationLocationOptions,
      normalizationRequiresTargetLocation,
      normalizationRequiresTargetStatus,
      normalizationStatusOptions,
    ]);

  const normalizationRequesterContent = useMemo(() => {
    if (!isNormalizationFlow) {
      return null;
    }

    const selectedRequesterId = String(form.requesterAdmin?.userId || "").trim();
    const selectedOption = normalizationRequesterOptions.find((option) => option.value === selectedRequesterId) || null;

    if (isReadOnly) {
      const requesterName = String(form.requesterAdmin?.name || "").trim();
      return (
        <div className="grid gap-4 rounded-[20px] border border-[var(--border-color)] bg-[var(--bg-panel)] p-4">
          <p className="text-sm text-[var(--text-secondary)]">
            Este usuario se usa como solicitante del ticket iTop y como responsable emisor del PDF de normalización.
          </p>
          <div className="grid gap-2">
            <span className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
              Solicitante seleccionado
            </span>
            <div className="min-h-[66px] rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-4 text-sm font-semibold text-[var(--text-primary)]">
              {requesterName || "Sin solicitante administrador"}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="grid gap-4 rounded-[20px] border border-[var(--border-color)] bg-[var(--bg-panel)] p-4">
        <p className="text-sm text-[var(--text-secondary)]">
          Selecciona aquí el administrador que actuará como solicitante del ticket iTop y responsable emisor del PDF de normalización.
        </p>

        {normalizationRequesterLoading ? (
          <MessageBanner>Cargando administradores disponibles...</MessageBanner>
        ) : null}

        {!normalizationRequesterLoading && !normalizationRequesterOptions.length ? (
          <MessageBanner tone="danger">
            No hay usuarios Hub activos con perfil administrador. Primero debes vincular o activar uno desde Usuarios.
          </MessageBanner>
        ) : null}

        {selectedOption && !selectedOption.hasItopPersonLink ? (
          <MessageBanner tone="warning">
            El administrador seleccionado no tiene persona iTop vinculada todavía. Puedes guardarlo en el acta, pero no procesarla hasta completar esa asociación.
          </MessageBanner>
        ) : null}

        {normalizationRequesterOptions.length ? (
          <FilterDropdown
            label="Solicitante administrador"
            options={normalizationRequesterOptions}
            selectedValues={selectedRequesterId ? [selectedRequesterId] : []}
            selectionMode="single"
            onToggleOption={(value) => {
              const nextOption = normalizationRequesterOptions.find((option) => option.value === value) || null;
              setForm((current) => ({
                ...current,
                requesterAdmin: nextOption
                  ? {
                      userId: nextOption.hubUserId,
                      name: nextOption.label,
                      itopPersonKey: nextOption.itopPersonKey,
                    }
                  : null,
              }));
            }}
            onClear={() => setForm((current) => ({
              ...current,
              requesterAdmin: null,
            }))}
            title="Seleccionar solicitante administrador"
            description="Se listan usuarios Hub activos con perfil administrador. Si no tienen persona iTop asociada, podrás guardarlos pero no procesar el acta."
            triggerClassName="min-h-[66px]"
            buttonHeightClassName="min-h-[66px]"
            menuOffsetClassName="top-[calc(100%+0.55rem)]"
            menuClassName="rounded-[18px]"
            renderSelection={({ label, selectedOptions }) => renderCatalogDropdownSelection({
              label,
              selectedOptions,
              placeholder: "Selecciona un administrador",
            })}
            renderOptionDescription={(option) => {
              if (!option.hasItopPersonLink) {
                return option.username
                  ? `Usuario: ${option.username} · Sin persona iTop asociada`
                  : "Sin persona iTop asociada";
              }
              return option.username ? `Usuario: ${option.username}` : "Administrador disponible";
            }}
            renderOptionLeading={renderCatalogDropdownOptionLeading}
            getOptionClassName={getCatalogDropdownOptionClassName}
          />
        ) : (
          <div className="grid gap-2">
            <span className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
              Solicitante administrador
            </span>
            <div className="min-h-[66px] rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-4 text-sm font-semibold text-[var(--text-primary)]">
              Sin administradores disponibles
            </div>
          </div>
        )}
      </div>
    );
  }, [
    form.requesterAdmin,
    isNormalizationFlow,
    isReadOnly,
    normalizationRequesterLoading,
    normalizationRequesterOptions,
  ]);

  useEffect(() => {
    formRef.current = form;
  }, [form]);

  const toggleSection = (sectionKey) => {
    setCollapsedSections((current) => ({
      ...current,
      [sectionKey]: !current[sectionKey],
    }));
  };

  useEffect(() => {
    window.requestAnimationFrame(() => {
      pageRootRef.current?.closest("main")?.scrollTo({ top: 0, left: 0 });
    });
  }, [slug]);

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

  const resetSourceSearch = () => {
    setSourceSearchQuery("");
    setSourceResults([]);
    setSourceLoading(false);
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
          setForm(createEmptyForm(payload, { moduleVariant, defaultHandoverType: moduleConfig.handoverType }));
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
    if (!isNormalizationFlow) {
      setNormalizationRequesterOptions([]);
      setNormalizationRequesterLoading(false);
      return undefined;
    }

    let cancelled = false;

    const loadRequesterOptions = async () => {
      setNormalizationRequesterLoading(true);
      try {
        const users = await getUsers();
        if (!cancelled) {
          setNormalizationRequesterOptions(buildNormalizationRequesterOptions(users));
        }
      } catch {
        if (!cancelled) {
          setNormalizationRequesterOptions([]);
        }
      } finally {
        if (!cancelled) {
          setNormalizationRequesterLoading(false);
        }
      }
    };

    loadRequesterOptions();

    return () => {
      cancelled = true;
    };
  }, [isNormalizationFlow]);

  useEffect(() => {
    if (!bootstrap || isCreateMode) {
      if (isCreateMode && bootstrap) {
        setForm(createEmptyForm(bootstrap, { moduleVariant, defaultHandoverType: moduleConfig.handoverType }));
      }
      return;
    }

    let cancelled = false;

    const loadDocument = async () => {
      setEditorLoading(true);
      setError("");
      setSourceResults([]);
      setPeopleResults([]);
      setAssetResults([]);
      setSourceSearchQuery("");
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
    const query = sourceSearchQuery.trim();

    if (!isReassignmentFlow || query.length < minCharsPeople) {
      setSourceResults([]);
      setSourceLoading(false);
      return undefined;
    }

    const run = async () => {
      setSourceLoading(true);
      setNotice("");
      setError("");
      try {
        const items = await searchHandoverPeople({ query });
        if (!cancelled) {
          itopPeopleWarningShownRef.current = false;
          setSourceResults(items);
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
          setSourceResults([]);
        }
      } finally {
        if (!cancelled) {
          setSourceLoading(false);
        }
      }
    };

    const timer = window.setTimeout(run, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isReassignmentFlow, minCharsPeople, sourceSearchQuery]);

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
    if (effectiveIsAssignedAssetFlow) {
      setAssetResults([]);
      setAssetLoading(false);
      return undefined;
    }

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
  }, [assetSearchQuery, effectiveIsAssignedAssetFlow, minCharsAssets]);

  const addAssetToForm = (asset, receiverOverride = null) => {
    const resolvedAssignmentResponsible = receiverOverride || (isReassignmentFlow ? sourceResponsible : form.receiver);
    const restrictionMessage = isNormalizationFlow ? "" : getAssetAssignmentRestriction(asset, {
      assetSelectionMode: effectiveAssetRestrictionMode,
      receiver: resolvedAssignmentResponsible,
      enforceSingleAssignment: isReturnFlow,
    });
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

    const applicableTemplates = activeTemplates.filter((template) => (
      matchesTemplateCmdbClass(asset?.className, template.cmdbClassLabel)
    ));

    setForm((current) => ({
      ...current,
      items: [
        ...current.items,
        {
          asset,
          notes: "",
          evidences: [],
          checklists: applicableTemplates.length === 1 ? [cloneTemplate(applicableTemplates[0])] : [],
        },
      ],
    }));
    if (applicableTemplates.length === 1) {
      setSelectedTemplateByAsset((current) => {
        const next = { ...current };
        delete next[asset.id];
        return next;
      });
    }
    resetAssetSearch();
    setNotice("");
    setError("");
  };

  const addAdditionalReceiver = (person) => {
    if (isAssignedAssetFlow) {
      setNotice("Este flujo no permite participantes secundarios adicionales.");
      return;
    }

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
    setForm((current) => ({
      ...current,
      receiver: null,
      additionalReceivers: isReturnFlow ? [] : current.additionalReceivers,
      items: isReturnFlow ? [] : current.items,
    }));
  };

  const requestRemovePrimaryReceiver = async () => {
    const confirmed = await ModalManager.confirm({
      title: "Quitar persona principal",
      message: `Se quitara ${form.receiver?.name || "la persona principal"} de esta acta.`,
      content: isReturnFlow
        ? "Confirma para eliminar el responsable actual. Los activos seleccionados tambien se quitaran porque dependen de ese responsable."
        : "Confirma para eliminar la persona principal actualmente seleccionada.",
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
    if (isReturnFlow && form.receiver?.id && form.receiver.id !== person.id) {
      const replaceResponsible = async () => {
        const confirmed = await ModalManager.confirm({
          title: "Cambiar responsable",
          message: `Se reemplazara a ${form.receiver?.name || "el responsable actual"} por ${person.name}.`,
          content: form.items.length
            ? "Los activos seleccionados se quitaran para evitar mezclar equipos de responsables distintos."
            : "Confirma para continuar con el nuevo responsable.",
          buttons: { cancel: "Cancelar", confirm: "Cambiar" },
        });
        if (!confirmed) {
          return;
        }
        setForm((current) => ({
          ...current,
          receiver: person,
          additionalReceivers: [],
          items: [],
        }));
        resetPeopleSearch();
        resetAssetSearch();
        setNotice("");
        setError("");
        scrollToReceiverSelection();
        focusPersonSearchInput();
        window.requestAnimationFrame(() => {
          openAssignedAssetSelector(person, { revertResponsibleOnEmptyClose: true });
        });
      };
      void replaceResponsible();
      return;
    }

    if (isReassignmentFlow && Number(sourceResponsible?.id || 0) === Number(person?.id || 0)) {
      setError("El responsable origen y el responsable destino no pueden ser la misma persona.");
      return;
    }

    if (isReassignmentFlow && form.receiver?.id && form.receiver.id !== person.id) {
      setForm((current) => ({
        ...current,
        receiver: person,
      }));
      resetPeopleSearch();
      setNotice("");
      setError("");
      scrollToReceiverSelection();
      focusPersonSearchInput();
      return;
    }

    if (form.receiver?.id && form.receiver.id !== person.id) {
      openPrimaryReceiverConflictModal(person);
      return;
    }

    setForm((current) => ({
      ...current,
      receiver: person,
      additionalReceivers: isReturnFlow
        ? []
        : (current.additionalReceivers || []).filter((item) => item.id !== person.id),
    }));
    resetPeopleSearch();
    if (isReturnFlow) {
      resetAssetSearch();
    }
    setNotice("");
    setError("");
    scrollToReceiverSelection();
    focusPersonSearchInput();
    if (isReturnFlow) {
      window.requestAnimationFrame(() => {
        openAssignedAssetSelector(person, { revertResponsibleOnEmptyClose: true });
      });
    }
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

  const removeSourceResponsible = () => {
    setForm((current) => ({
      ...current,
      additionalReceivers: [],
      items: [],
    }));
  };

  const requestRemoveSourceResponsible = async () => {
    const confirmed = await ModalManager.confirm({
      title: "Quitar responsable origen",
      message: `Se quitara ${sourceResponsible?.name || "el responsable origen"} de esta acta.`,
      content: "Confirma para eliminar el responsable origen. Los activos seleccionados tambien se quitaran porque dependen de esa persona.",
      buttons: { cancel: "Cancelar", confirm: "Quitar" },
    });

    if (!confirmed) {
      return;
    }

    removeSourceResponsible();
    resetSourceSearch();
    resetAssetSearch();
    setNotice("");
    setError("");
  };

  const selectSourceResponsible = (person) => {
    if (!isReassignmentFlow) {
      return;
    }
    if (Number(form.receiver?.id || 0) === Number(person?.id || 0)) {
      setError("El responsable origen y el responsable destino no pueden ser la misma persona.");
      return;
    }

    const applySource = () => {
      setForm((current) => ({
        ...current,
        additionalReceivers: [{ ...person, assignmentRole: "Responsable origen" }],
        items: [],
      }));
      resetSourceSearch();
      resetAssetSearch();
      setNotice("");
      setError("");
      window.requestAnimationFrame(() => {
        sourceSelectionEndRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "end",
        });
      });
      window.requestAnimationFrame(() => {
        openAssignedAssetSelector(person, { revertResponsibleOnEmptyClose: true, responsibleRole: "source" });
      });
    };

    if (sourceResponsible?.id && sourceResponsible.id !== person.id && form.items.length) {
      const replaceSource = async () => {
        const confirmed = await ModalManager.confirm({
          title: "Cambiar responsable origen",
          message: `Se reemplazara a ${sourceResponsible.name} por ${person.name}.`,
          content: "Los activos seleccionados se quitaran para evitar mezclar equipos de responsables distintos.",
          buttons: { cancel: "Cancelar", confirm: "Cambiar" },
        });
        if (!confirmed) {
          return;
        }
        applySource();
      };
      void replaceSource();
      return;
    }

    applySource();
  };

  const removeAssetFromForm = (assetId) => {
    setForm((current) => {
      const removedItem = current.items.find((item) => item.asset?.id === assetId);
      (removedItem?.evidences || []).forEach((evidence) => {
        if (evidence?.previewUrl) {
          URL.revokeObjectURL(evidence.previewUrl);
        }
      });
      return {
        ...current,
        items: current.items.filter((item) => item.asset?.id !== assetId),
      };
    });
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

  const addItemEvidenceFiles = (assetId, files) => {
    const incomingFiles = Array.from(files || []).filter((file) => String(file?.type || "").startsWith("image/"));
    if (!incomingFiles.length) {
      setError("Solo puedes adjuntar imagenes por activo en esta seccion.");
      return;
    }

    setForm((current) => ({
      ...current,
      items: current.items.map((item) => {
        if (item.asset?.id !== assetId) {
          return item;
        }
        const nextEvidences = [...(item.evidences || [])];
        incomingFiles.forEach((file) => {
          nextEvidences.push({
            id: window.crypto?.randomUUID?.() || `${assetId}-${Date.now()}-${Math.random()}`,
            name: file.name,
            originalName: file.name,
            storedName: "",
            mimeType: file.type || "image/png",
            fileSize: file.size || 0,
            caption: "",
            source: "",
            previewUrl: URL.createObjectURL(file),
            file,
          });
        });
        return {
          ...item,
          evidences: nextEvidences,
        };
      }),
    }));
    setError("");
  };

  const updateItemEvidenceCaption = (assetId, evidenceId, value) => {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => {
        if (item.asset?.id !== assetId) {
          return item;
        }
        return {
          ...item,
          evidences: (item.evidences || []).map((evidence) => (
            evidence.id === evidenceId ? { ...evidence, caption: value } : evidence
          )),
        };
      }),
    }));
  };

  const removeItemEvidence = (assetId, evidenceId) => {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => {
        if (item.asset?.id !== assetId) {
          return item;
        }
        const evidenceToRemove = (item.evidences || []).find((evidence) => evidence.id === evidenceId);
        if (evidenceToRemove?.previewUrl) {
          URL.revokeObjectURL(evidenceToRemove.previewUrl);
        }
        return {
          ...item,
          evidences: (item.evidences || []).filter((evidence) => evidence.id !== evidenceId),
        };
      }),
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

  const openAssignedAssetSelector = (responsibleOverride = null, options = {}) => {
    const responsibleRole = options?.responsibleRole || (isReassignmentFlow ? "source" : "receiver");
    const fallbackResponsible = responsibleRole === "source" ? sourceResponsible : form.receiver;
    const resolvedResponsible = responsibleOverride || fallbackResponsible;
    if (!resolvedResponsible?.id) {
      setError("Debes seleccionar primero al responsable para buscar los activos asociados.");
      return;
    }

    const responsibleId = resolvedResponsible.id;
    const revertResponsibleOnEmptyClose = Boolean(options?.revertResponsibleOnEmptyClose);
    let assetLinked = false;
    let modalId = null;
    const selectedAssetIds = new Set((form.items || []).map((item) => Number(item.asset?.id || 0)));
    modalId = ModalManager.custom({
      title: `Seleccionar activos asociados${resolvedResponsible?.name ? ` · ${resolvedResponsible.name}` : ""}`,
      size: "personDetail",
      showFooter: false,
      onClose: () => {
        if (!revertResponsibleOnEmptyClose || assetLinked) {
          return;
        }
        const latestForm = formRef.current;
        const currentResponsible = responsibleRole === "source"
          ? ((latestForm?.additionalReceivers || []).find((person) => String(person?.assignmentRole || "").trim().toLowerCase() === "responsable origen")
            || latestForm?.additionalReceivers?.[0]
            || null)
          : latestForm?.receiver;
        const currentResponsibleId = Number(currentResponsible?.id || 0);
        const hasLinkedItems = Array.isArray(latestForm?.items) && latestForm.items.length > 0;
        if (currentResponsibleId === Number(responsibleId) && !hasLinkedItems) {
          setForm((current) => {
            const currentAssignedResponsible = responsibleRole === "source"
              ? ((current.additionalReceivers || []).find((person) => String(person?.assignmentRole || "").trim().toLowerCase() === "responsable origen")
                || current.additionalReceivers?.[0]
                || null)
              : current.receiver;
            if (Number(currentAssignedResponsible?.id || 0) !== Number(responsibleId) || (current.items || []).length > 0) {
              return current;
            }
            return {
              ...current,
              receiver: responsibleRole === "receiver" ? null : current.receiver,
              additionalReceivers: responsibleRole === "source" ? [] : current.additionalReceivers,
              items: [],
            };
          });
          setNotice("");
          setError("");
        }
      },
      content: (
        <AssignedAssetSelectionModalContent
          responsible={resolvedResponsible}
          selectedAssetIds={selectedAssetIds}
          enforceSingleAssignment={isReturnFlow || normalizationEnforceSingleAssignment}
          helperText={isReassignmentFlow
            ? "Esta lista se carga desde iTop solo con los activos actualmente asociados al responsable origen seleccionado."
            : "Esta lista se carga desde iTop solo con los activos actualmente asociados a este responsable."}
          onLoad={() => searchHandoverAssets({
            query: "",
            assignedPersonId: responsibleId,
          })}
          onSelectAsset={(asset) => {
            assetLinked = true;
            addAssetToForm(asset, resolvedResponsible);
          }}
          onCancel={() => ModalManager.close(modalId)}
        />
      ),
    });
  };

  const handleSave = async () => {
    setError("");
    setNotice("");

    if (!form.reason.trim()) {
      setError(moduleConfig.reasonValidationMessage);
      return;
    }
    if (isNormalizationFlow) {
      if (!form.normalizationMode) {
        setError("Debes seleccionar el modo de normalizacion antes de guardar.");
        return;
      }
      if (normalizationRequiresReceiver && !form.receiver?.id) {
        setError("Este modo de normalizacion requiere una persona vinculada.");
        return;
      }
      if (normalizationRequiresTargetStatus && !String(form.normalizationParams?.targetStatus || "").trim()) {
        setError("Debes seleccionar el estado destino para este modo de normalizacion.");
        return;
      }
      if (normalizationRequiresTargetLocation && !String(form.normalizationParams?.targetLocationId || "").trim()) {
        setError("Debes seleccionar la locacion destino para este modo de normalizacion.");
        return;
      }
    }
    if (isReassignmentFlow) {
      if (!sourceResponsible?.id) {
        setError("Debes seleccionar el responsable origen.");
        return;
      }
      if (!form.receiver?.id) {
        setError("Debes seleccionar el responsable destino.");
        return;
      }
      if (Number(sourceResponsible.id) === Number(form.receiver.id)) {
        setError("El responsable origen y el responsable destino no pueden ser la misma persona.");
        return;
      }
      if (!(form.items || []).length) {
        setError("Debes agregar al menos un activo para la reasignacion.");
        return;
      }
    }
    if (isReturnFlow) {
      const invalidEvidence = (form.items || []).find((item) => (
        (item.evidences || []).some((evidence) => !String(evidence?.caption || "").trim())
      ));
      if (invalidEvidence) {
        const assetLabel = invalidEvidence.asset?.name || invalidEvidence.asset?.code || "seleccionado";
        setError(`Cada imagen del activo ${assetLabel} debe incluir una glosa.`);
        return;
      }
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
      handoverType: form.handoverType || moduleConfig.handoverType,
      normalizationMode: isNormalizationFlow ? (form.normalizationMode || "") : undefined,
      normalizationParams: isNormalizationFlow ? (form.normalizationParams || {}) : undefined,
      requesterAdmin: isNormalizationFlow ? (form.requesterAdmin || {}) : undefined,
      reason: form.reason,
      notes: form.notes,
      receiver: form.receiver || {},
      additionalReceivers: form.additionalReceivers || [],
      items: form.items,
    };

    if (!isNormalizationFlow) {
      const invalidAsset = form.items.find((item) => getAssetAssignmentRestriction(item.asset, {
        assetSelectionMode: effectiveAssetRestrictionMode,
        receiver: isReassignmentFlow ? sourceResponsible : form.receiver,
        enforceSingleAssignment: isReturnFlow,
      }));
      if (invalidAsset) {
        setSaving(false);
        setError(getAssetAssignmentRestriction(invalidAsset.asset, {
          assetSelectionMode: effectiveAssetRestrictionMode,
          receiver: isReassignmentFlow ? sourceResponsible : form.receiver,
          enforceSingleAssignment: isReturnFlow,
        }));
        return;
      }
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

      navigate(moduleConfig.basePath);
    } catch (saveError) {
      setError(saveError.message || "No fue posible guardar el acta.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div ref={pageRootRef} className="grid gap-5">
      <Panel className="overflow-hidden">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
          <div className="grid gap-3">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Workspace</p>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
                  {isCreateMode ? moduleConfig.createTitle : isReadOnly ? moduleConfig.detailTitle : moduleConfig.editTitle}
                </h1>
                {!isCreateMode && form.documentNumber ? (
                  <span className="inline-flex min-h-8 items-center rounded-full border border-[var(--border-color)] bg-[var(--bg-app)] px-3 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
                    Folio {form.documentNumber}
                  </span>
                ) : null}
              </div>
              <p className="mt-2 max-w-3xl text-sm text-[var(--text-secondary)]">
                Trabaja el documento en una pagina completa para tener mejor separacion visual entre datos del acta, destinatario y activos asociados.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 xl:justify-end">
            <Button variant="secondary" onClick={() => navigate(moduleConfig.basePath)}>
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
        <>
          {isNormalizationFlow ? (
            <Panel>
              <div className="grid gap-4">
                <div>
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Normalizacion</p>
                  <h3 className="mt-1 text-base font-semibold text-[var(--text-primary)]">Modo de operacion</h3>
                  <p className="mt-2 max-w-3xl text-sm text-[var(--text-secondary)]">
                    Selecciona el tipo de cambio que se aplicara a los activos de esta acta. Solo se puede elegir un modo por acta. Cambiar el modo limpia los activos seleccionados.
                  </p>
                </div>
                {isReadOnly ? (
                  <div className="grid gap-4">
                    <div className="grid gap-2">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">Modo seleccionado</p>
                      <div className="min-h-[50px] rounded-[16px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-3 text-sm text-[var(--text-primary)]">
                        {activeModeConfig?.label || form.normalizationMode || "Sin modo seleccionado"}
                      </div>
                    </div>
                    {activeModeConfig?.description ? (
                      <div className="grid gap-2">
                        <p className="text-sm font-semibold text-[var(--text-primary)]">Descripcion</p>
                        <div className="min-h-[50px] rounded-[16px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-3 text-sm text-[var(--text-primary)]">
                          {activeModeConfig.description}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    <FilterDropdown
                      label="Modo de operacion"
                      options={moduleConfig.normalizationModes || []}
                      selectedValues={form.normalizationMode ? [String(form.normalizationMode)] : []}
                      selectionMode="single"
                      onToggleOption={(value) => {
                        const nextMode = (moduleConfig.normalizationModes || []).find((modeOption) => modeOption.value === value) || null;
                        setForm((current) => ({
                          ...current,
                          normalizationMode: value,
                          normalizationParams: {},
                          receiver: nextMode?.requiresReceiver ? current.receiver : null,
                          items: [],
                        }));
                      }}
                      onClear={() => setForm((current) => ({
                        ...current,
                        normalizationMode: "",
                        normalizationParams: {},
                        receiver: null,
                        items: [],
                      }))}
                      title="Seleccionar modo de operacion"
                      description="Selecciona una sola operacion por acta. Cambiar el modo limpia los activos seleccionados."
                      triggerClassName="py-3"
                      buttonHeightClassName="min-h-[66px]"
                      menuOffsetClassName="top-[calc(100%+0.55rem)]"
                      menuClassName="rounded-[18px]"
                      renderSelection={({ label, selectedOptions }) => renderNormalizationDropdownSelection({
                        label,
                        selectedOptions,
                        placeholder: "Selecciona un modo de operacion",
                      })}
                      renderOptionDescription={(option) => option.dropdownDescription || "Selecciona esta operacion para continuar"}
                      renderOptionLeading={(option) => (
                        option.iconName ? (
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--bg-app)]">
                            <Icon name={option.iconName} size={14} className="h-3.5 w-3.5" aria-hidden="true" />
                          </span>
                        ) : null
                      )}
                      getOptionClassName={getCatalogDropdownOptionClassName}
                    />
                    <div className="grid min-h-[66px] gap-2 rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-4">
                      <span className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                        Descripcion del modo
                      </span>
                      <p className="text-sm leading-6 text-[var(--text-secondary)]">
                        {activeModeConfig?.description || "Selecciona un modo de operacion para ver su alcance y las variables que deberas definir."}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </Panel>
          ) : null}
          <HandoverEditorSections
            form={form}
            statusOptions={statusOptions}
            sourceLoading={sourceLoading}
            sourceResults={sourceResults}
            sourceSearchQuery={sourceSearchQuery}
            setSourceSearchQuery={setSourceSearchQuery}
            sourceSearchInputRef={sourceSearchInputRef}
            sourceSelectionEndRef={sourceSelectionEndRef}
            sourceResponsible={sourceResponsible}
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
            minCharsPeople={minCharsPeople}
            minCharsAssets={minCharsAssets}
            requiresSourceResponsible={moduleConfig.requiresSourceResponsible}
            sourceSectionTitle={moduleConfig.sourceSectionTitle}
            sourceSectionHelper={moduleConfig.sourceSectionHelper}
            sourceSearchLabel={moduleConfig.sourceSearchLabel}
            primarySourceLabel={moduleConfig.primarySourceLabel}
            emptyPrimarySourceMessage={moduleConfig.emptyPrimarySourceMessage}
            selectSourceResponsible={selectSourceResponsible}
            requestRemoveSourceResponsible={requestRemoveSourceResponsible}
            selectPrimaryReceiver={selectPrimaryReceiver}
            promoteAdditionalReceiverToPrimary={promoteAdditionalReceiverToPrimary}
            requestRemovePrimaryReceiver={requestRemovePrimaryReceiver}
            addAdditionalReceiver={addAdditionalReceiver}
            requestRemoveAdditionalReceiver={requestRemoveAdditionalReceiver}
            updateAdditionalReceiverRole={updateAdditionalReceiverRole}
            allowEvidenceUpload={Boolean(bootstrap?.actions?.allowEvidenceUpload ?? true)}
            readOnly={isReadOnly}
            documentId={isCreateMode ? null : slug}
            itopIntegrationUrl={String(bootstrap?.itopIntegrationUrl || "").replace(/\/+$/, "")}
            reasonLabel={moduleConfig.reasonLabel}
            notesPlaceholder={bootstrap?.defaults?.notesPlaceholder || moduleConfig.notesPlaceholder}
            itemNotesLabel={moduleConfig.itemNotesLabel}
            itemNotesPlaceholder={moduleConfig.itemNotesPlaceholder}
            topRightSection={isNormalizationFlow ? {
              sectionKey: "requester",
              eyebrow: "Responsable",
              title: "Solicitante administrador",
              helper: "Selecciona el administrador que actuará como solicitante del ticket iTop y responsable emisor del PDF de normalización.",
              content: normalizationRequesterContent,
            } : null}
            receiverSectionTitle={normalizationReceiverSectionTitle}
            receiverSectionHelper={normalizationReceiverSectionHelper}
            receiverSearchLabel={moduleConfig.receiverSearchLabel}
            primaryReceiverLabel={moduleConfig.primaryReceiverLabel}
            emptyPrimaryReceiverMessage={moduleConfig.emptyPrimaryReceiverMessage}
            allowAdditionalReceivers={moduleConfig.allowAdditionalReceivers}
            addSecondaryLabel={moduleConfig.addSecondaryLabel}
            assetSectionTitle={moduleConfig.assetSectionTitle}
            assetSelectionMode={isNormalizationFlow ? normalizationAssetSelectionMode : moduleConfig.assetSelectionMode}
            assetRestrictionMode={effectiveAssetRestrictionMode}
            assetSearchLabel={moduleConfig.assetSearchLabel}
            assetSearchPlaceholder={moduleConfig.assetSearchPlaceholder}
            assetSelectorHelper={moduleConfig.assetSelectorHelper}
            assetSelectorButtonLabel={moduleConfig.assetSelectorButtonLabel}
            assetAssignmentResponsible={isReassignmentFlow ? sourceResponsible : form.receiver}
            enforceSingleAssignment={isReturnFlow || normalizationEnforceSingleAssignment}
            onOpenAssetSelector={effectiveIsAssignedAssetFlow ? openAssignedAssetSelector : null}
            assetLayoutMode={isNormalizationFlow ? "grouped" : "stacked"}
            showReceiverSection={isNormalizationFlow ? Boolean(form.normalizationMode) : true}
            showReceiverSearch={isNormalizationFlow ? normalizationRequiresReceiver : true}
            showReceiverSummary={isNormalizationFlow ? normalizationRequiresReceiver : true}
            receiverExtraContent={normalizationParameterContent}
            showChecklistSection={moduleConfig.showChecklistSection !== false}
            showItemEvidenceSection={isReturnFlow}
            addItemEvidenceFiles={addItemEvidenceFiles}
            updateItemEvidenceCaption={updateItemEvidenceCaption}
            removeItemEvidence={removeItemEvidence}
          />
        </>
      )}
      <ScrollToTopButton />
    </div>
  );
}
