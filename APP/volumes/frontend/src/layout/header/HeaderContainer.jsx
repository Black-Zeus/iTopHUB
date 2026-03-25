import { HeaderBreadcrumb } from "./HeaderBreadcrumb";
import { HeaderSearch } from "./HeaderSearch";
import { HeaderDivider } from "./HeaderDivider";
import { HeaderThemeToggle } from "./HeaderThemeToggle";
import { HeaderUserMenu } from "./HeaderUserMenu";

/**
 * HeaderContainer - topbar sticky de la app autenticada.
 */
export function HeaderContainer() {
  return (
    <header className="sticky top-0 z-[5] flex items-center justify-between gap-5 border-b border-[var(--border-color)] bg-[rgba(255,255,255,0.45)] px-8 py-6 backdrop-blur-[14px] dark:bg-[rgba(15,24,33,0.78)] max-[1024px]:px-6 max-[1024px]:py-5 max-[768px]:flex-col max-[768px]:items-stretch max-[768px]:p-4">
      <HeaderBreadcrumb />
      <div className="flex items-center gap-4 max-[1024px]:gap-3 max-[768px]:flex-wrap">
        <HeaderSearch />
        <HeaderDivider />
        <HeaderThemeToggle />
        <HeaderUserMenu />
      </div>
    </header>
  );
}
