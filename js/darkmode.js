/**
 * Updates the active state of theme dropdown items.
 * @param {NodeList} themeDropdownItems - The dropdown items
 * @param {string} theme - The current theme
 */
function updateActiveTheme(themeDropdownItems, theme) {
  themeDropdownItems.forEach((item) => {
    const value = item.getAttribute("data-bs-theme-value");
    item.classList.toggle("active", value === theme);
  });
}

/**
 * Applies the specified theme.
 * @param {NodeList} themeDropdownItems - The dropdown items
 * @param {string} theme - The theme to apply
 */
function applyTheme(themeDropdownItems, theme) {
  document.documentElement.setAttribute("data-bs-theme", theme);
  localStorage.setItem("theme", theme);
  updateActiveTheme(themeDropdownItems, theme);
}

/**
 * Gets the preferred theme based on system settings.
 * @returns {string} - 'dark' or 'light'
 */
function getPreferredTheme() {
  if (typeof window.matchMedia === "function") {
    const prefersDarkScheme = window.matchMedia("(prefers-color-scheme: dark)");
    return prefersDarkScheme.matches ? "dark" : "light";
  }
  return "light";
}

/**
 * Gets the stored theme from localStorage.
 * @returns {string|null} - The stored theme or null
 */
function getStoredTheme() {
  return localStorage.getItem("theme");
}

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

  function handlePreferenceChange() {
    if (!autoMode) {
      return;
    }

    if (!prefersDarkScheme) {
      return;
    }

    const nextTheme = prefersDarkScheme.matches ? "dark" : "light";
    applyTheme(themeDropdownItems, nextTheme);
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
    applyTheme(themeDropdownItems, theme);
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

// Export functions for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    updateActiveTheme,
    applyTheme,
    getPreferredTheme,
    getStoredTheme
  };
}