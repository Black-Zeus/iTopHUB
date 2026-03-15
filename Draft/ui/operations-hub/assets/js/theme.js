(function () {
  const root = document.documentElement;
  const toggleButton = document.getElementById("theme-toggle");
  const storedTheme = localStorage.getItem("itophub-theme");
  const initialTheme = storedTheme || "light";

  root.setAttribute("data-theme", initialTheme);

  function updateButtonLabel(theme) {
    if (!toggleButton) return;
    toggleButton.textContent = theme === "dark" ? "Modo claro" : "Modo oscuro";
  }

  updateButtonLabel(initialTheme);

  if (toggleButton) {
    toggleButton.addEventListener("click", function () {
      const nextTheme = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", nextTheme);
      localStorage.setItem("itophub-theme", nextTheme);
      updateButtonLabel(nextTheme);
    });
  }
})();
