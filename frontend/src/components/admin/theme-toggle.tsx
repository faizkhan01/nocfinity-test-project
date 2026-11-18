"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { createContext, useContext, useState } from "react";
import { ADMIN_THEME_COOKIE, type AdminTheme } from "@/lib/admin-theme";
import { cn } from "@/lib/format";

const ThemeContext = createContext<{ theme: AdminTheme; setTheme: (t: AdminTheme) => void } | null>(null);

/** Applies data-theme on its own element; the choice lives in a cookie so the server renders it without a flash. */
export function AdminThemeRoot({ initial, className, children }: { initial: AdminTheme; className?: string; children: React.ReactNode }) {
  const [theme, setThemeState] = useState(initial);

  const setTheme = (next: AdminTheme) => {
    setThemeState(next);
    document.cookie = `${ADMIN_THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <div data-theme={theme} className={cn("bg-canvas text-ink", className)}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

const OPTIONS: { value: AdminTheme; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
];

export function ThemeToggle({ className }: { className?: string }) {
  const ctx = useContext(ThemeContext);
  if (!ctx) return null;

  return (
    <div role="radiogroup" aria-label="Colour theme" className={cn("inline-flex rounded-full border border-line bg-surface p-0.5", className)}>
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={ctx.theme === value}
          aria-label={`${label} theme`}
          title={`${label} theme`}
          onClick={() => ctx.setTheme(value)}
          className={cn("grid size-8 place-items-center rounded-full text-ink/50 transition-colors hover:text-ink", ctx.theme === value && "bg-white text-ink shadow-sm")}
        >
          <Icon className="size-4" />
        </button>
      ))}
    </div>
  );
}
