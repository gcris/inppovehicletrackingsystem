import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type Theme = "light" | "dark";

const ThemeContext = createContext<Theme>("light");

const ThemeActionsContext = createContext<{
  toggleTheme: () => void;
}>({
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem("inppo-theme");

    if (saved === "light" || saved === "dark") {
      return saved;
    }

    return "light";
  });

  useEffect(() => {
    const root = document.documentElement;

    root.classList.remove("light", "dark");
    root.classList.add(theme);

    localStorage.setItem("inppo-theme", theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  }, []);

  const themeValue = useMemo(() => theme, [theme]);

  const actionsValue = useMemo(
    () => ({
      toggleTheme,
    }),
    [toggleTheme],
  );

  return (
    <ThemeActionsContext.Provider value={actionsValue}>
      <ThemeContext.Provider value={themeValue}>
        {children}
      </ThemeContext.Provider>
    </ThemeActionsContext.Provider>
  );
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

export function useThemeActions() {
  return useContext(ThemeActionsContext);
}
