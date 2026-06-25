"use client";

import { Sun, Moon } from "@/lib/icons";
import { useTheme } from "@/app/page";

export default function FloatingThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="fixed bottom-4 right-4 w-10 h-10 rounded-full bg-[#3b82f6] hover:bg-[#2563eb] shadow-lg shadow-[#3b82f6]/25 flex items-center justify-center text-white transition-all cursor-pointer z-[9999]"
      title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
    >
      {theme === 'dark' ? (
        <Sun className="w-4 h-4" />
      ) : (
        <Moon className="w-4 h-4" />
      )}
    </button>
  );
}
