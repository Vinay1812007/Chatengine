// lib/themeContext.js
import React, { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(
    typeof window !== "undefined"
      ? localStorage.getItem("chat_theme") || "system"
      : "system"
  );

  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    // apply theme on html element
    const apply = (t) => {
      const root = document.documentElement;
      if (t === "system") {
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        root.setAttribute("data-theme", prefersDark ? "dark" : "light");
      } else {
        root.setAttribute("data-theme", t);
      }
    };
    apply(theme);
    localStorage.setItem("chat_theme", theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, drawerOpen, setDrawerOpen }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
