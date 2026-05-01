import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../icon/Icon";

export function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);
  const mainRef = useRef(null);

  useEffect(() => {
    mainRef.current = document.querySelector("main");

    const handleScroll = () => {
      const windowScroll = window.scrollY;
      const mainScroll = mainRef.current ? mainRef.current.scrollTop : 0;
      setVisible(windowScroll > 100 || mainScroll > 100);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    mainRef.current?.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      mainRef.current?.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!visible) return null;

  return createPortal(
    <button
      type="button"
      aria-label="Volver al inicio"
      title="Volver al inicio"
      onClick={scrollToTop}
      className="fixed bottom-6 right-6 z-[9999] flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent)] text-white shadow-[0_4px_20px_rgba(0,0,0,0.45)] ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--bg-app)] transition-all duration-200 hover:brightness-110 active:scale-95"
    >
      <Icon name="chevronUp" size={18} className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
    </button>,
    document.body
  );
}
