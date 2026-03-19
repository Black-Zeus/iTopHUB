import { useState, useEffect } from "react";

const STORAGE_KEY = "itophub-sidebar";

export function useSidebar() {
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) === "collapsed";
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, collapsed ? "collapsed" : "expanded");
  }, [collapsed]);

  const toggle = () => setCollapsed((c) => !c);

  return { collapsed, toggle };
}