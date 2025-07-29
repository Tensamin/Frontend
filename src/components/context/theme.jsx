"use client";

// Package Imports
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { 
  useState, 
  useEffect, 
  createContext, 
  useContext,
} from "react";

// Lib Imports
import { generateTintPalette, generateMaterialYouPalette } from "@/lib/theme";

// Main
let ActualTheme = createContext(null);

// Use Context Function
export let useActualThemeProvider = () => useContext(ActualTheme);

// Provider
export function ActualThemeProvider({ children }) {
  let [customHex, setCustomHex] = useState('');
  let [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    let storedHex = localStorage.getItem('theme');
    if (storedHex) {
      setCustomHex(storedHex);
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;

    if (customHex) {
      localStorage.setItem('theme', customHex);
      let palette;
      switch (localStorage.getItem('tint')) {
        case "soft":
          palette = generateMaterialYouPalette(customHex, localStorage.getItem('colorScheme'));
          break;

        case "hard":
          palette = generateTintPalette(customHex, null, localStorage.getItem('colorScheme'));
          break;

        case "hard_a":
          palette = generateTintPalette(customHex, JSON.parse(localStorage.getItem('theme-control')), localStorage.getItem('colorScheme'));
          break;
      
        default:
          palette = generateMaterialYouPalette(customHex, localStorage.getItem('colorScheme'));
          localStorage.setItem('tint', 'soft')
          break;
      }
      
      for (let [cssVar, value] of Object.entries(palette)) {
        document.documentElement.style.setProperty(cssVar, value);
      }
    } else {
      localStorage.removeItem('theme');
    }
  }, [customHex, mounted]);

  return (
    <NextThemesProvider attribute="class" defaultTheme="" enableSystem>
      <ActualTheme.Provider value={''}>
        {children}
      </ActualTheme.Provider>
    </NextThemesProvider>
  );
};