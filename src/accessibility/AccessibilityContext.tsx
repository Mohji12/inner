import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type ContrastMode = "default" | "light" | "high" | "monochrome";
type ColorblindMode = "none" | "protanopia" | "deuteranopia" | "tritanopia";
type TextAlignMode = "default" | "left" | "center" | "right" | "justify";
type CursorMode = "default" | "large";
type AccessibilityProfile = "none" | "vision" | "adhd" | "seizure";

export interface AccessibilitySettings {
  fontScale: number;
  lineHeight: number;
  letterSpacing: number;
  readableFont: boolean;
  boldText: boolean;
  textAlign: TextAlignMode;
  contrast: ContrastMode;
  colorblindMode: ColorblindMode;
  cursor: CursorMode;
  hideImages: boolean;
  highlightLinks: boolean;
  highlightContent: boolean;
  stopAnimations: boolean;
  profile: AccessibilityProfile;
}

const STORAGE_KEY = "accessibility-settings-v1";

const defaultSettings: AccessibilitySettings = {
  fontScale: 100,
  lineHeight: 1.5,
  letterSpacing: 0,
  readableFont: false,
  boldText: false,
  textAlign: "default",
  contrast: "default",
  colorblindMode: "none",
  cursor: "default",
  hideImages: false,
  highlightLinks: false,
  highlightContent: false,
  stopAnimations: false,
  profile: "none",
};

const profilePresets: Record<Exclude<AccessibilityProfile, "none">, AccessibilitySettings> = {
  vision: {
    ...defaultSettings,
    fontScale: 120,
    lineHeight: 1.8,
    letterSpacing: 1,
    readableFont: true,
    boldText: true,
    contrast: "high",
    cursor: "large",
    highlightLinks: true,
    profile: "vision",
  },
  adhd: {
    ...defaultSettings,
    fontScale: 110,
    lineHeight: 1.9,
    letterSpacing: 0.6,
    readableFont: true,
    textAlign: "left",
    highlightContent: true,
    hideImages: true,
    profile: "adhd",
  },
  seizure: {
    ...defaultSettings,
    contrast: "light",
    stopAnimations: true,
    profile: "seizure",
  },
};

interface AccessibilityContextType {
  settings: AccessibilitySettings;
  setSettings: (next: AccessibilitySettings) => void;
  patchSettings: (patch: Partial<AccessibilitySettings>) => void;
  applyProfile: (profile: AccessibilityProfile) => void;
  resetSettings: () => void;
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

function safeReadSettings(): AccessibilitySettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSettings;
    const parsed = JSON.parse(raw) as Partial<AccessibilitySettings>;
    return { ...defaultSettings, ...parsed };
  } catch {
    return defaultSettings;
  }
}

function applyToDom(settings: AccessibilitySettings) {
  const html = document.documentElement;
  const body = document.body;

  // Apply at root level so rem-based sizing across the app updates.
  html.style.fontSize = `${settings.fontScale}%`;
  html.style.setProperty("--a11y-font-scale", String(settings.fontScale / 100));
  html.style.setProperty("--a11y-line-height", String(settings.lineHeight));
  html.style.setProperty("--a11y-letter-spacing", `${settings.letterSpacing}px`);

  html.classList.toggle("a11y-readable-font", settings.readableFont);
  html.classList.toggle("a11y-bold-text", settings.boldText);
  html.classList.toggle("a11y-hide-images", settings.hideImages);
  html.classList.toggle("a11y-highlight-links", settings.highlightLinks);
  html.classList.toggle("a11y-highlight-content", settings.highlightContent);
  html.classList.toggle("a11y-stop-animations", settings.stopAnimations);
  html.classList.toggle("a11y-large-cursor", settings.cursor === "large");

  html.dataset.a11yContrast = settings.contrast;
  html.dataset.a11yColorblind = settings.colorblindMode;
  html.dataset.a11yTextAlign = settings.textAlign;
  html.style.setProperty("--a11y-filter-contrast", contrastToFilter(settings.contrast));
  html.style.setProperty("--a11y-filter-colorblind", colorblindToFilter(settings.colorblindMode));
  body.style.textAlign = settings.textAlign === "default" ? "" : settings.textAlign;
  body.style.lineHeight = String(settings.lineHeight);
  body.style.letterSpacing = `${settings.letterSpacing}px`;
}

function contrastToFilter(mode: ContrastMode): string {
  if (mode === "high") return "contrast(1.22) saturate(1.1)";
  if (mode === "light") return "contrast(0.92) brightness(1.03)";
  if (mode === "monochrome") return "grayscale(1) contrast(1.08)";
  return "none";
}

function colorblindToFilter(mode: ColorblindMode): string {
  // Approximate simulation/aid presets (browser-safe filters).
  if (mode === "protanopia") return "hue-rotate(-12deg) saturate(0.92)";
  if (mode === "deuteranopia") return "hue-rotate(18deg) saturate(0.9)";
  if (mode === "tritanopia") return "hue-rotate(55deg) saturate(0.92)";
  return "none";
}

export function AccessibilityProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AccessibilitySettings>(() => safeReadSettings());

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    applyToDom(settings);
  }, [settings]);

  const value = useMemo<AccessibilityContextType>(
    () => ({
      settings,
      setSettings,
      patchSettings: (patch) => setSettings((prev) => ({ ...prev, ...patch, profile: "none" })),
      applyProfile: (profile) => {
        if (profile === "none") {
          setSettings(defaultSettings);
          return;
        }
        setSettings(profilePresets[profile]);
      },
      resetSettings: () => setSettings(defaultSettings),
    }),
    [settings],
  );

  return <AccessibilityContext.Provider value={value}>{children}</AccessibilityContext.Provider>;
}

export function useAccessibility() {
  const ctx = useContext(AccessibilityContext);
  if (!ctx) throw new Error("useAccessibility must be used within AccessibilityProvider");
  return ctx;
}
