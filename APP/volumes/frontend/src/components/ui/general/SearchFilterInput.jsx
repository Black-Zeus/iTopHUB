import { Icon } from "../icon/Icon";


export function SearchFilterInput({ value, placeholder, onChange, className = "" }) {
  return (
    <label className={`block min-w-0 ${className}`.trim()}>
      <div className="flex h-[66px] w-full min-w-0 items-center gap-3 rounded-[14px] border border-[var(--border-color)] bg-[var(--bg-app)] px-4 transition focus-within:border-[var(--accent-strong)] focus-within:bg-[var(--bg-panel)] focus-within:shadow-[0_0_0_4px_rgba(81,152,194,0.12)]">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-strong)]">
          <Icon name="sliders" size={14} className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <input
            type="search"
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className="w-full border-0 bg-transparent p-0 text-sm font-semibold text-[var(--text-primary)] outline-none placeholder:font-normal placeholder:text-[var(--text-muted)]"
          />
        </span>
      </div>
    </label>
  );
}
