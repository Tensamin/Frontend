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
import ls from "@/lib/localStorageManager";

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
    let storedHex = ls.get('theme');
    if (storedHex) {
      setCustomHex(storedHex);
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;

    if (customHex) {
      ls.set('theme', customHex);
      let palette;
      switch (ls.get('tint')) {
        case "soft":
          palette = generateMaterialYouPalette(customHex, ls.get('colorScheme'));
          break;

        case "hard":
          palette = generateTintPalette(customHex, null, ls.get('colorScheme'));
          break;

        case "hard_a":
          palette = generateTintPalette(customHex, JSON.parse(ls.get('theme-control')), ls.get('colorScheme'));
          break;
      
        default:
          palette = generateMaterialYouPalette(customHex, ls.get('colorScheme'));
          ls.set('tint', 'soft')
          break;
      }
      
      for (let [cssVar, value] of Object.entries(palette)) {
        document.documentElement.style.setProperty(cssVar, value);
      }
    } else {
      ls.remove('theme');
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