import { HeaderBreadcrumb } from "./HeaderBreadcrumb";
import { HeaderSearch } from "./HeaderSearch";
import { HeaderDivider } from "./HeaderDivider";
import { HeaderThemeToggle } from "./HeaderThemeToggle";
import { HeaderUserMenu } from "./HeaderUserMenu";
import "@styles/layout_header.css";

/**
 * HeaderContainer - topbar sticky de la app autenticada.
 */
export function HeaderContainer() {
  return (
    <header className="topbar">
      <HeaderBreadcrumb />
      <div className="topbar-actions">
        <HeaderSearch />
        <HeaderDivider />
        <HeaderThemeToggle />
        <HeaderUserMenu />
      </div>
    </header>
  );
}
