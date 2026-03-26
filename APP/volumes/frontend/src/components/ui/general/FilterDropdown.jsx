import { useEffect, useRef, useState } from "react";
import { Icon } from "../icon/Icon";

export function FilterDropdown({
  label,
  options = [],
  selectedValues = [],
  onToggleOption,
  onClear,
  selectionMode = "multiple",
  align = "left",
  title,
  description,
  clearLabel = "Limpiar",
  iconName = "sliders",
  showTriggerIcon = true,
  triggerClassName = "",
  menuClassName = "",
  buttonHeightClassName = "h-[62px]",
  menuOffsetClassName = "top-[calc(100%+0.35rem)]",
  renderSelection,
  renderOptionDescription,
  renderOptionLeading,
  renderOptionTrailing,
  getOptionClassName,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const resolvedDescription =
    description ?? (selectionMode === "single" ? "Puedes seleccionar un valor" : "Puedes seleccionar uno o varios valores");
  const selectedOptions = options.filter(
    (option) => option.value !== "all" && selectedValues.includes(option.value)
  );

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!ref.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  return (
    <div
      ref={ref}
      className={`relative ${align === "right" ? "ml-auto" : ""}`}
    >
      <button
        type="button"
        onClick={() => setOpen((currentValue) => !currentValue)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex w-full items-center gap-3 rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 text-left transition hover:border-[var(--accent-strong)] hover:bg-[var(--bg-panel)] ${buttonHeightClassName} ${triggerClassName}`.trim()}
      >
        {showTriggerIcon ? (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-strong)]">
            <Icon name={iconName} size={14} className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        ) : null}

        <span className="min-w-0 flex-1">
          {renderSelection({
            label,
            selectedOptions,
            selectedValues,
          })}
        </span>

        <Icon
          name="chevronDown"
          size={14}
          className={`h-3.5 w-3.5 shrink-0 text-[var(--text-secondary)] transition ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div
          className={`absolute z-20 w-full rounded-[16px] border border-[var(--border-color)] bg-[var(--bg-panel)] p-2 shadow-[var(--shadow-soft)] ${
            align === "right" ? "right-0" : "left-0"
          } ${menuOffsetClassName} ${menuClassName}`.trim()}
        >
          <div className="mb-2 flex items-center justify-between gap-3 border-b border-[var(--border-color)] px-3 py-2">
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                {title || `Filtrar por ${label.toLowerCase()}`}
              </p>
              <p className="text-xs text-[var(--text-muted)]">{resolvedDescription}</p>
            </div>

            {selectedValues.length > 0 ? (
              <button
                type="button"
                onClick={onClear}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--border-color)] bg-[var(--bg-app)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              >
                <Icon name="xmark" size={12} className="h-3 w-3" aria-hidden="true" />
                {clearLabel}
              </button>
            ) : null}
          </div>

          <div className="grid gap-1">
            {options.map((option) => {
              const isActive =
                option.value === "all"
                  ? selectedValues.length === 0
                  : selectedValues.includes(option.value);

              const optionClassName = getOptionClassName
                ? getOptionClassName(option, isActive)
                : isActive
                  ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-app)] hover:text-[var(--text-primary)]";

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onToggleOption(option.value);
                    if (selectionMode === "single" && option.value !== "all") {
                      setOpen(false);
                    }
                  }}
                  className={`flex items-center justify-between gap-3 rounded-[14px] border px-3 py-3 text-left text-sm transition ${optionClassName}`}
                  aria-pressed={isActive}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    {renderOptionLeading ? renderOptionLeading(option, isActive) : null}
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{option.label}</span>
                      {renderOptionDescription ? (
                        <span className="block text-xs opacity-75">
                          {renderOptionDescription(option, isActive)}
                        </span>
                      ) : null}
                    </span>
                  </span>

                  {renderOptionTrailing ? (
                    renderOptionTrailing(option, isActive)
                  ) : isActive ? (
                    <Icon name="check" size={12} className="h-3 w-3 shrink-0" aria-hidden="true" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
