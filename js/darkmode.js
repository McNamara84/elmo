document.addEventListener("DOMContentLoaded", function () {
  const themeDropdown = document.getElementById("bd-theme");
  if (!themeDropdown || !themeDropdown.parentElement) {
    return;
  }

  const themeDropdownItems = themeDropdown.parentElement.querySelectorAll(".dropdown-item");
  const prefersDarkScheme =
    typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-color-scheme: dark)")
      : null;
  let autoMode = false;
  let removePreferenceListener = null;

  function updateActiveTheme(theme) {
    themeDropdownItems.forEach((item) => {
      const value = item.getAttribute("data-bs-theme-value");
      item.classList.toggle("active", value === theme);
    });
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-bs-theme", theme);
    localStorage.setItem("theme", theme);
    updateActiveTheme(theme);
  }

  function handlePreferenceChange() {
    if (!autoMode) {
      return;
    }

    if (!prefersDarkScheme) {
      return;
    }

    const nextTheme = prefersDarkScheme.matches ? "dark" : "light";
    applyTheme(nextTheme);
  }

  function enablePreferenceListener() {
    if (removePreferenceListener || !prefersDarkScheme) {
      return;
    }

    if (typeof prefersDarkScheme.addEventListener === "function") {
      const listener = () => {
        handlePreferenceChange();
      };
      prefersDarkScheme.addEventListener("change", listener);
      removePreferenceListener = () => {
        prefersDarkScheme.removeEventListener("change", listener);
      };
    } else if (typeof prefersDarkScheme.addListener === "function") {
      const listener = () => {
        handlePreferenceChange();
      };
      prefersDarkScheme.addListener(listener);
      removePreferenceListener = () => {
        prefersDarkScheme.removeListener(listener);
      };
    }
  }

  function disablePreferenceListener() {
    if (removePreferenceListener) {
      removePreferenceListener();
      removePreferenceListener = null;
    }
  }

  function setTheme(theme) {
    autoMode = false;
    disablePreferenceListener();
    applyTheme(theme);
  }

  function setAutoTheme() {
    if (!prefersDarkScheme) {
      setTheme("light");
      return;
    }

    autoMode = true;
    enablePreferenceListener();
    handlePreferenceChange();
  }

  themeDropdownItems.forEach((item) => {
    item.addEventListener("click", function (e) {
      e.preventDefault();
      const theme = this.getAttribute("data-bs-theme-value");
      if (theme === "auto") {
        setAutoTheme();
      } else if (theme) {
        setTheme(theme);
      }
    });
  });

  const storedTheme = localStorage.getItem("theme");
  if (storedTheme === "dark" || storedTheme === "light") {
    setTheme(storedTheme);
  } else {
    setAutoTheme();
  }
});