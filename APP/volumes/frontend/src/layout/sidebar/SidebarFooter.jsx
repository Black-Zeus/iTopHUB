/**
 * SidebarFooter — nota de versión al pie del sidebar
 */
export function SidebarFooter({ collapsed }) {
  return (
    <div className="mt-auto flex-shrink-0 pt-4">
      <p
        className="text-[0.78rem] leading-relaxed text-[var(--text-muted)] transition-[opacity,transform] duration-[180ms] overflow-hidden"
        style={collapsed ? { opacity: 0, transform: "translateX(-10px)", pointerEvents: "none" } : { opacity: 1, transform: "none" }}
      >
        iTop Hub
        <br />
        <span className="text-[0.72rem]">
          {import.meta.env.VITE_APP_NAME ?? "v0.1"} · dev
        </span>
      </p>
    </div>
  );
}