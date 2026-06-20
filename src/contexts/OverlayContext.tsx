"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
} from "react";

interface OverlayContextValue {
  /** 활성 풀스크린 오버레이가 하나라도 있는지 */
  active: boolean;
  /** 오버레이 진입 시 호출(언마운트 시 release 반환) */
  push: () => () => void;
}

const OverlayContext = createContext<OverlayContextValue>({
  active: false,
  push: () => () => {},
});

export function OverlayProvider({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState(0);

  const push = useCallback(() => {
    setCount((c) => c + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      setCount((c) => Math.max(0, c - 1));
    };
  }, []);

  const value = useMemo(
    () => ({ active: count > 0, push }),
    [count, push]
  );

  return (
    <OverlayContext.Provider value={value}>{children}</OverlayContext.Provider>
  );
}

export function useOverlay() {
  return useContext(OverlayContext);
}

/**
 * 마운트되어 있는 동안 풀스크린 오버레이로 등록한다(하단 푸터 숨김).
 * 컴포넌트 최상단에서 호출.
 */
export function useOverlayActive(isActive: boolean = true) {
  const { push } = useOverlay();
  useEffect(() => {
    if (!isActive) return;
    const release = push();
    return release;
  }, [isActive, push]);
}
