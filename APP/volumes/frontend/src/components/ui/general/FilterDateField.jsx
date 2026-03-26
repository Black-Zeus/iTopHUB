import { useEffect, useMemo, useRef, useState } from "react";

const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const DAY_NAMES = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];

function parseDate(value) {
  if (!value) return null;

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;

  return new Date(year, month - 1, day);
}

function toIsoDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDateLabel(value) {
  if (!value) return "";

  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;

  return `${day}/${month}/${year}`;
}

function isSameDay(left, right) {
  return Boolean(left && right) && left.toDateString() === right.toDateString();
}

function isWithinRange(day, start, end) {
  if (!start || !end) return false;
  return day.getTime() > start.getTime() && day.getTime() < end.getTime();
}

function getMonthMatrix(baseDate) {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingOffset = (firstDay.getDay() + 6) % 7;
  const cells = [];

  for (let index = 0; index < leadingOffset; index += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(year, month, day));
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

export function FilterDateField({
  label,
  mode = "single",
  value = "",
  startValue = "",
  endValue = "",
  onChange,
  onRangeChange,
}) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const [activeBoundary, setActiveBoundary] = useState("start");

  const selectedDate = parseDate(value);
  const selectedStartDate = parseDate(startValue);
  const selectedEndDate = parseDate(endValue);

  const initialMonthDate =
    selectedEndDate ?? selectedStartDate ?? selectedDate ?? new Date();

  const [visibleMonth, setVisibleMonth] = useState(
    new Date(initialMonthDate.getFullYear(), initialMonthDate.getMonth(), 1)
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

  useEffect(() => {
    const nextReference = selectedEndDate ?? selectedStartDate ?? selectedDate;
    if (!nextReference) return;

    setVisibleMonth(new Date(nextReference.getFullYear(), nextReference.getMonth(), 1));
  }, [endValue, startValue, value]);

  const calendarDays = useMemo(() => getMonthMatrix(visibleMonth), [visibleMonth]);

  const displayValue = formatDateLabel(value) || "Seleccionar fecha";

  const updateSingleDate = (date) => {
    onChange?.(toIsoDate(date));
    setOpen(false);
  };

  const updateRangeDate = (date) => {
    const nextValue = toIsoDate(date);

    if (activeBoundary === "start") {
      const normalizedEnd =
        selectedEndDate && date.getTime() > selectedEndDate.getTime() ? nextValue : endValue;

      onRangeChange?.({
        start: nextValue,
        end: normalizedEnd,
      });
      setActiveBoundary("end");
      return;
    }

    const normalizedStart =
      selectedStartDate && date.getTime() < selectedStartDate.getTime() ? nextValue : startValue;

    onRangeChange?.({
      start: normalizedStart,
      end: nextValue,
    });
  };

  const handleDateSelect = (date) => {
    if (!date) return;

    if (mode === "range") {
      updateRangeDate(date);
      return;
    }

    updateSingleDate(date);
  };

  const handlePreviousMonth = () => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1));
  };

  return (
    <div ref={ref} className="relative min-w-0">
      <div
        className="flex h-[66px] w-full min-w-0 items-center gap-3 rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 py-3 text-left transition hover:border-[var(--accent-strong)] hover:bg-[var(--bg-panel)]"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-strong)]">
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <path
              d="M7 3v3M17 3v3M4 9h16M6 5h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>

        <span className="min-w-0 flex-1">
          <span className="block text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">
            {label}
          </span>

          {mode === "range" ? (
            <span className="mt-1 grid min-w-0 grid-cols-[1fr_auto_1fr] items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setActiveBoundary("start");
                  setOpen(true);
                }}
                className={`min-w-0 text-left transition ${activeBoundary === "start" && open ? "text-[var(--accent-strong)]" : ""}`}
              >
                <span className="flex items-baseline gap-2">
                  <span className="text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                    Inicio
                  </span>
                  <span className={`truncate text-sm font-semibold ${startValue ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}>
                    {formatDateLabel(startValue) || "--/--/----"}
                  </span>
                </span>
              </button>

              <span className="pt-3 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                -
              </span>

              <button
                type="button"
                onClick={() => {
                  setActiveBoundary("end");
                  setOpen(true);
                }}
                className={`min-w-0 text-left transition ${activeBoundary === "end" && open ? "text-[var(--accent-strong)]" : ""}`}
              >
                <span className="flex items-baseline gap-2">
                  <span className="text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                    Termino
                  </span>
                  <span className={`truncate text-sm font-semibold ${endValue ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}>
                    {formatDateLabel(endValue) || "--/--/----"}
                  </span>
                </span>
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className={`mt-1 block truncate text-sm font-semibold ${displayValue.includes("Seleccionar") ? "text-[var(--text-secondary)]" : "text-[var(--text-primary)]"}`}
            >
              {displayValue}
            </button>
          )}
        </span>

        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={`flex h-5 w-5 shrink-0 items-center justify-center text-[var(--text-secondary)] transition ${open ? "rotate-180" : ""}`}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <path
              d="M7 10l5 5 5-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {open ? (
        <div
          className={`absolute top-[calc(100%+0.55rem)] z-20 w-[52%] min-w-[280px] max-w-[340px] rounded-[18px] border border-[var(--border-color)] bg-[var(--bg-panel)] p-3 shadow-[var(--shadow-soft)] ${
            mode === "range" && activeBoundary === "end" ? "right-0" : "left-0"
          }`}
        >
          <div className="mb-3 flex items-center justify-between gap-3 px-1">
            <button
              type="button"
              onClick={handlePreviousMonth}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-color)] bg-[var(--bg-app)] text-[var(--text-secondary)] transition hover:border-[var(--accent-strong)] hover:text-[var(--text-primary)]"
              aria-label="Mes anterior"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                <path
                  d="M14.5 6.5L8.5 12l6 5.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            <div className="text-center">
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                {MONTH_NAMES[visibleMonth.getMonth()]} {visibleMonth.getFullYear()}
              </p>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-color)] bg-[var(--bg-app)] text-[var(--text-secondary)] transition hover:border-[var(--accent-strong)] hover:text-[var(--text-primary)]"
              aria-label="Mes siguiente"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                <path
                  d="M9.5 6.5l6 5.5-6 5.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {DAY_NAMES.map((dayName) => (
              <span
                key={dayName}
                className="px-1 py-2 text-center text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]"
              >
                {dayName}
              </span>
            ))}

            {calendarDays.map((day, index) => {
              if (!day) {
                return <span key={`empty-${index}`} className="h-10 rounded-[12px]" aria-hidden="true" />;
              }

              const isSelectedStart = isSameDay(day, selectedStartDate);
              const isSelectedEnd = isSameDay(day, selectedEndDate);
              const isSelectedSingle = isSameDay(day, selectedDate);
              const isSelected = mode === "range" ? isSelectedStart || isSelectedEnd : isSelectedSingle;
              const isRangeMiddle = mode === "range" && isWithinRange(day, selectedStartDate, selectedEndDate);
              const isToday = isSameDay(day, new Date());

              const dayClass = isSelected
                ? "border-transparent bg-[var(--accent-soft)] text-[var(--accent-strong)] shadow-[0_8px_18px_rgba(81,152,194,0.18)]"
                : isRangeMiddle
                  ? "border-transparent bg-[rgba(81,152,194,0.14)] text-[var(--text-primary)]"
                  : "border-[var(--border-color)] bg-[var(--bg-app)] text-[var(--text-secondary)] hover:border-[var(--accent-strong)] hover:text-[var(--text-primary)]";

              return (
                <button
                  key={toIsoDate(day)}
                  type="button"
                  onClick={() => handleDateSelect(day)}
                  className={`flex h-10 items-center justify-center rounded-[12px] border text-sm font-semibold transition ${dayClass}`}
                  aria-pressed={isSelected}
                >
                  <span className="relative">
                    {day.getDate()}
                    {isToday && !isSelected ? (
                      <span className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-[var(--accent-strong)]" />
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--border-color)] px-1 pt-3">
            <button
              type="button"
              onClick={() => {
                if (mode === "range") {
                  onRangeChange?.({ start: "", end: "" });
                  setActiveBoundary("start");
                  return;
                }

                onChange?.("");
              }}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--border-color)] bg-[var(--bg-app)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            >
              Limpiar
            </button>

            {mode === "range" ? (
              <p className="text-xs text-[var(--text-muted)]">
                {activeBoundary === "start" ? "Editando inicio" : "Editando termino"}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
