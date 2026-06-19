"use client";

import { createContext, useContext, useState, useCallback } from "react";

interface SearchContextValue {
  open: boolean;
  query: string;
  setQuery: (q: string) => void;
  setOpen: (o: boolean) => void;
  toggle: () => void;
}

const SearchContext = createContext<SearchContextValue>({
  open: false,
  query: "",
  setQuery: () => {},
  setOpen: () => {},
  toggle: () => {},
});

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const toggle = useCallback(() => setOpen((o) => !o), []);

  return (
    <SearchContext.Provider value={{ open, query, setQuery, setOpen, toggle }}>
      {children}
    </SearchContext.Provider>
  );
}

export function useSearch() {
  return useContext(SearchContext);
}
