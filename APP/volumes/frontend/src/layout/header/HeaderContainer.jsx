import { HeaderBreadcrumb }   from "./HeaderBreadcrumb";
import { HeaderSearch }        from "./HeaderSearch";
import { HeaderDivider }       from "./HeaderDivider";
import { HeaderThemeToggle }   from "./HeaderThemeToggle";
import { HeaderUserMenu }      from "./HeaderUserMenu";

/**
 * HeaderContainer — topbar sticky de la app autenticada
 */
export function HeaderContainer() {
  return (
    <header className="sticky top-0 z-[5] flex items-center justify-between gap-5 border-b border-[var(--border-color)] px-8 py-6 backdrop-blur-[14px]"
      style={{ background: "rgba(255,255,255,0.45)" }}
    >
      {/* Lado izquierdo: breadcrumb + título */}
      <HeaderBreadcrumb />

      {/* Lado derecho: acciones */}
      <div className="flex items-center gap-4">
        <HeaderSearch />
        <HeaderDivider />
        <HeaderThemeToggle />
        <HeaderUserMenu />
      </div>
    </header>
  );
}