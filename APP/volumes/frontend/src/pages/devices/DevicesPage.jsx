import { useEffect, useMemo, useRef, useState } from "react";
import { ActaModulePage } from "../../components/ui/general/ActaModulePage";
import { StatusChip } from "../../components/ui/general/StatusChip";
import { Button } from "../../ui/Button";
import { Icon } from "../../components/ui/icon/Icon";
import ModalManager from "../../components/ui/modal";

const INITIAL_DEVICE_ROWS = [
  {
    id: 1,
    code: "TAB-0101",
    name: "Tablet Recepcion 01",
    model: "Samsung Galaxy Tab A9",
    area: "Recepcion",
    date: "2026-03-24 09:12",
    status: "operativo",
    registrationCode: "481205",
  },
  {
    id: 2,
    code: "TAB-0102",
    name: "Tablet Laboratorio 02",
    model: "Lenovo Tab M10",
    area: "Laboratorio",
    date: "2026-03-23 18:40",
    status: "laboratorio",
    registrationCode: "193844",
  },
  {
    id: 3,
    code: "TAB-0103",
    name: "Tablet Entrega 03",
    model: "Samsung Galaxy Tab Active4 Pro",
    area: "Entrega",
    date: "2026-03-22 11:25",
    status: "pendiente",
    registrationCode: "220611",
  },
];

function buildDeviceKpis(rows) {
  const activeStatuses = new Set(["operativo"]);
  const pendingStatuses = new Set(["pendiente"]);
  const warningStatuses = new Set(["laboratorio"]);

  return [
    {
      label: "Total dispositivos",
      value: String(rows.length).padStart(2, "0"),
      helper: "Inventario visible",
      tone: "default",
    },
    {
      label: "Vinculados",
      value: String(rows.filter((row) => activeStatuses.has(row.status)).length).padStart(2, "0"),
      helper: "Listos para operar",
      tone: "success",
    },
    {
      label: "Pendientes",
      value: String(rows.filter((row) => pendingStatuses.has(row.status)).length).padStart(2, "0"),
      helper: "Esperando enlace",
      tone: "warning",
    },
    {
      label: "En laboratorio",
      value: String(rows.filter((row) => warningStatuses.has(row.status)).length).padStart(2, "0"),
      helper: "Revision tecnica",
      tone: "danger",
    },
  ];
}

function buildTabletDraft(code) {
  const suffix = code.slice(-3);

  return {
    id: Date.now(),
    code: `TAB-${suffix}`,
    name: `Tablet Android ${suffix}`,
    model: "Samsung Galaxy Tab Active5",
    area: "Laboratorio",
    date: "2026-03-25 10:30",
    status: "operativo",
    registrationCode: code,
  };
}

function DeviceCodeLinkModalContent({ onCancel, onSubmit }) {
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const inputRefs = useRef([]);
  const hasAutoSubmittedRef = useRef(false);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const code = digits.join("");
  const isComplete = digits.every((digit) => digit.length === 1);

  useEffect(() => {
    if (isComplete && !hasAutoSubmittedRef.current) {
      hasAutoSubmittedRef.current = true;
      onSubmit(code);
    }
  }, [code, isComplete, onSubmit]);

  const handleDigitChange = (index, value) => {
    const nextValue = value.replace(/\D/g, "").slice(-1);
    const nextDigits = [...digits];
    nextDigits[index] = nextValue;
    setDigits(nextDigits);

    if (nextValue && index < inputRefs.current.length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, event) => {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }

    if (event.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }

    if (event.key === "ArrowRight" && index < inputRefs.current.length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
          Dispositivos
        </p>
        <h3 className="mt-1 text-[1.85rem] font-bold tracking-[-0.04em] text-[var(--text-primary)]">
          Vincular tablet Android
        </h3>
        <p className="mt-4 max-w-[40rem] text-[1.02rem] leading-8 text-[var(--text-secondary)]">
          Ingresa el codigo de registro de 6 digitos que muestra la tablet para completar su
          vinculacion con el sistema.
        </p>
      </div>

      <div className="rounded-[26px] border border-[var(--border-color)] bg-[var(--bg-app)] px-6 py-10">
        <p className="text-center text-sm font-semibold text-[var(--text-secondary)]">
          Codigo de registro
        </p>

        <div className="mt-6 flex justify-center gap-3">
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={(element) => {
                inputRefs.current[index] = element;
              }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(event) => handleDigitChange(index, event.target.value)}
              onKeyDown={(event) => handleKeyDown(index, event)}
              className="h-14 w-12 rounded-[14px] border border-[rgba(70,122,161,0.45)] bg-[var(--bg-panel)] text-center text-lg font-semibold text-[var(--text-primary)] outline-none transition focus:border-[var(--accent-strong)] focus:shadow-[0_0_0_4px_rgba(81,152,194,0.12)]"
            />
          ))}
        </div>

        <p className="mt-6 text-center text-sm text-[var(--text-muted)]">
          La tablet entrega este codigo al iniciar el proceso de enlace.
        </p>
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          type="button"
          variant="primary"
          disabled={!isComplete}
          onClick={() => {
            hasAutoSubmittedRef.current = true;
            onSubmit(code);
          }}
        >
          Aceptar
        </Button>
      </div>
    </div>
  );
}

function DeviceLinkResultModalContent({ device, onCancel, onConfirm }) {
  const [deviceName, setDeviceName] = useState(device.name);

  return (
    <div className="space-y-6">
      <div className="rounded-[22px] border border-[var(--border-color)] bg-[var(--bg-app)] p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
          Tablet detectada
        </p>
        <div className="mt-4 grid gap-3 text-sm text-[var(--text-secondary)]">
          <p><span className="font-semibold text-[var(--text-primary)]">Codigo:</span> {device.registrationCode}</p>
          <p><span className="font-semibold text-[var(--text-primary)]">Serie interna:</span> {device.code}</p>
          <p><span className="font-semibold text-[var(--text-primary)]">Modelo:</span> {device.model}</p>
          <p><span className="font-semibold text-[var(--text-primary)]">Area sugerida:</span> {device.area}</p>
        </div>
      </div>

      <label className="block">
        <span className="mb-2 block text-sm font-semibold text-[var(--text-primary)]">
          Nombre de la tablet
        </span>
        <input
          type="text"
          value={deviceName}
          onChange={(event) => setDeviceName(event.target.value)}
          className="w-full rounded-[14px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--accent-strong)] focus:shadow-[0_0_0_4px_rgba(81,152,194,0.12)]"
          placeholder="Ej: Tablet Recepcion 04"
        />
      </label>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          type="button"
          variant="primary"
          disabled={deviceName.trim().length === 0}
          onClick={() => onConfirm({ ...device, name: deviceName.trim() })}
        >
          Vincular dispositivo
        </Button>
      </div>
    </div>
  );
}

export function DevicesPage() {
  const [devices, setDevices] = useState(INITIAL_DEVICE_ROWS);

  const openViewDeviceModal = (device) => {
    ModalManager.info({
      title: `Dispositivo ${device.code}`,
      message: "Vista placeholder del dispositivo vinculado.",
      content: (
        <div className="space-y-4">
          <div className="rounded-[22px] border border-[var(--border-color)] bg-[var(--bg-app)] p-5">
            <div className="grid gap-3 text-sm text-[var(--text-secondary)]">
              <p><span className="font-semibold text-[var(--text-primary)]">Tablet:</span> {device.name}</p>
              <p><span className="font-semibold text-[var(--text-primary)]">Serie:</span> {device.code}</p>
              <p><span className="font-semibold text-[var(--text-primary)]">Modelo:</span> {device.model}</p>
              <p><span className="font-semibold text-[var(--text-primary)]">Area:</span> {device.area}</p>
              <p><span className="font-semibold text-[var(--text-primary)]">Registro:</span> {device.registrationCode}</p>
              <p><span className="font-semibold text-[var(--text-primary)]">Estado:</span> {device.status}</p>
            </div>
          </div>
        </div>
      ),
    });
  };

  const handleDeactivateDevice = (device) => {
    ModalManager.confirm({
      title: `Desactivar ${device.code}`,
      message: `Se desactivara ${device.name} y quedara fuera de uso operativo.`,
      content: "Esta accion es un placeholder y por ahora dejara el equipo en estado pendiente.",
      buttons: {
        cancel: "Cancelar",
        confirm: "Desactivar",
      },
      onConfirm: () => {
        setDevices((currentDevices) =>
          currentDevices.map((currentDevice) =>
            currentDevice.id === device.id
              ? {
                  ...currentDevice,
                  status: "pendiente",
                  date: "2026-03-25 10:45",
                }
              : currentDevice
          )
        );

        ModalManager.warning({
          title: "Dispositivo desactivado",
          message: `${device.name} quedo marcado como pendiente.`,
        });
      },
    });
  };

  const deviceColumns = useMemo(
    () => [
      { key: "code", label: "Serie", sortable: true },
      { key: "name", label: "Tablet", sortable: true },
      { key: "model", label: "Modelo", sortable: true },
      { key: "area", label: "Area", sortable: true },
      { key: "date", label: "Ultima sincronizacion", sortable: true },
      {
        key: "status",
        label: "Estado",
        render: (value) => <StatusChip status={value} />,
      },
      {
        key: "actions",
        label: "Acciones",
        render: (_, row) => (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              className="h-9 w-9 min-w-0 rounded-full p-0 text-[var(--text-primary)]"
              aria-label="Ver dispositivo"
              title="Ver"
              onClick={() => openViewDeviceModal(row)}
            >
              <Icon name="eye" size={16} className="h-4 w-4 shrink-0" aria-hidden="true" />
            </Button>
            <Button
              size="sm"
              variant="danger"
              className="h-9 w-9 min-w-0 rounded-full p-0"
              aria-label="Desactivar dispositivo"
              title="Desactivar"
              onClick={() => handleDeactivateDevice(row)}
            >
              <Icon name="xmark" size={14} className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            </Button>
          </div>
        ),
      },
    ],
    [devices]
  );

  const openDeviceResultModal = (device) => {
    const modalId = ModalManager.custom({
      title: `Tablet ${device.code}`,
      size: "medium",
      showFooter: false,
      content: (
        <DeviceLinkResultModalContent
          device={device}
          onCancel={() => ModalManager.close(modalId)}
          onConfirm={(updatedDevice) => {
            setDevices((currentDevices) => {
              const existingIndex = currentDevices.findIndex(
                (currentDevice) => currentDevice.registrationCode === updatedDevice.registrationCode
              );

              if (existingIndex >= 0) {
                return currentDevices.map((currentDevice, index) =>
                  index === existingIndex ? updatedDevice : currentDevice
                );
              }

              return [updatedDevice, ...currentDevices];
            });

            ModalManager.close(modalId);
            ModalManager.success({
              title: "Dispositivo vinculado",
              message: `${updatedDevice.name} quedo asociado correctamente.`,
            });
          }}
        />
      ),
    });
  };

  const openDeviceLinkFlow = () => {
    const codeModalId = ModalManager.custom({
      title: "Vincular tablet Android",
      size: "large",
      showFooter: false,
      content: (
        <DeviceCodeLinkModalContent
          onCancel={() => ModalManager.close(codeModalId)}
          onSubmit={(code) => {
            ModalManager.close(codeModalId);

            const loadingModalId = ModalManager.progress({
              title: "Vinculando tablet",
              message: "Buscando informacion del dispositivo y preparando el enlace...",
              progress: 0,
              showProgress: true,
              showSteps: false,
              allowCancel: false,
              closeOnOverlayClick: false,
              closeOnEscape: false,
            });

            let currentProgress = 0;
            const progressStepMs = 250;
            const progressIncrement = 100 / (5000 / progressStepMs);

            const progressTimer = setInterval(() => {
              currentProgress = Math.min(100, currentProgress + progressIncrement);
              ModalManager.update(loadingModalId, {
                progress: currentProgress,
                message: currentProgress < 100
                  ? "Buscando informacion del dispositivo y preparando el enlace..."
                  : "Tablet encontrada. Preparando datos de vinculacion...",
              });
            }, progressStepMs);

            setTimeout(() => {
              clearInterval(progressTimer);
              ModalManager.update(loadingModalId, {
                progress: 100,
                message: "Tablet encontrada. Preparando datos de vinculacion...",
              });
              ModalManager.close(loadingModalId);
              openDeviceResultModal(buildTabletDraft(code));
            }, 5000);
          }}
        />
      ),
    });
  };

  return (
    <ActaModulePage
      eyebrow="Laboratorio"
      title="Dispositivos"
      searchPlaceholder="Buscar por serie, nombre, modelo o area"
      statusOptions={[
        { value: "operativo", label: "Operativo" },
        { value: "pendiente", label: "Pendiente" },
        { value: "laboratorio", label: "Laboratorio" },
      ]}
      rows={devices}
      columns={deviceColumns}
      searchKeys={["code", "name", "model", "area", "date", "registrationCode"]}
      buildKpis={buildDeviceKpis}
      primaryActionLabel="Nuevo dispositivo"
      primaryActionIcon="plus"
      onPrimaryAction={openDeviceLinkFlow}
      emptyMessage="No hay dispositivos que coincidan con los filtros actuales."
    />
  );
}
