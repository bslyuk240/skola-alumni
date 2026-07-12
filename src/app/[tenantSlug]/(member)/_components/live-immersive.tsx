"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type LiveImmersiveContextValue = {
  immersive: boolean;
  setImmersive: (value: boolean) => void;
};

const LiveImmersiveContext = createContext<LiveImmersiveContextValue | null>(null);

export function LiveImmersiveProvider({ children }: { children: React.ReactNode }) {
  const [immersive, setImmersiveState] = useState(false);
  const setImmersive = useCallback((value: boolean) => {
    setImmersiveState(value);
  }, []);
  const value = useMemo(() => ({ immersive, setImmersive }), [immersive, setImmersive]);
  return <LiveImmersiveContext.Provider value={value}>{children}</LiveImmersiveContext.Provider>;
}

export function useLiveImmersive() {
  return useContext(LiveImmersiveContext);
}

/** Call from fullscreen live surfaces so member chrome can hide header/nav. */
export function useSetLiveImmersive(active: boolean) {
  const setImmersive = useLiveImmersive()?.setImmersive;
  useEffect(() => {
    if (!setImmersive) return;
    setImmersive(active);
    return () => setImmersive(false);
  }, [active, setImmersive]);
}
