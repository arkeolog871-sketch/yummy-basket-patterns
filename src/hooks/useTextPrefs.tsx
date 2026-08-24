import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  applyTextPrefs,
  DEFAULT_TEXT_PREFS,
  persistTextPrefs,
  readTextPrefs,
  type TextPrefs,
} from "@/lib/text-prefs";

type TextPrefsContextValue = {
  prefs: TextPrefs;
  ready: boolean;
  update: (patch: Partial<TextPrefs>) => void;
  reset: () => void;
};

const TextPrefsContext = createContext<TextPrefsContextValue>({
  prefs: DEFAULT_TEXT_PREFS,
  ready: false,
  update: () => {},
  reset: () => {},
});

export function TextPrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<TextPrefs>(DEFAULT_TEXT_PREFS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const loaded = readTextPrefs();
    setPrefs(loaded);
    applyTextPrefs(loaded);
    setReady(true);
  }, []);

  const update = useCallback((patch: Partial<TextPrefs>) => {
    setPrefs((current) => {
      const next = { ...current, ...patch };
      applyTextPrefs(next);
      persistTextPrefs(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setPrefs(DEFAULT_TEXT_PREFS);
    applyTextPrefs(DEFAULT_TEXT_PREFS);
    persistTextPrefs(DEFAULT_TEXT_PREFS);
  }, []);

  const value = useMemo(
    () => ({ prefs, ready, update, reset }),
    [prefs, ready, update, reset],
  );

  return <TextPrefsContext.Provider value={value}>{children}</TextPrefsContext.Provider>;
}

export function useTextPrefs() {
  return useContext(TextPrefsContext);
}
