'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from 'react';
import {
  DEFAULT_DEMO_USER_ID,
  DEMO_PERSONAS,
  DEMO_USER_ID_STORAGE_KEY,
  DemoPersona,
  getDemoPersonaById,
  IS_DEMO_MODE,
} from '@/lib/demo-config';

interface DemoRoleContextValue {
  personas: DemoPersona[];
  selectedPersonaId: string;
  demoUser: DemoPersona;
  setPersonaId: (id: string) => void;
}

const DemoRoleContext = createContext<DemoRoleContextValue | null>(null);
const DEMO_PERSONA_CHANGE_EVENT = 'demo-persona-change';

function readPersonaIdFromStorage(): string {
  if (typeof window === 'undefined') {
    return DEFAULT_DEMO_USER_ID;
  }

  const storedId = sessionStorage.getItem(DEMO_USER_ID_STORAGE_KEY);
  if (storedId && DEMO_PERSONAS.some((persona) => persona.id === storedId)) {
    return storedId;
  }

  return DEFAULT_DEMO_USER_ID;
}

function subscribeToPersonaChanges(onStoreChange: () => void) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleChange = () => onStoreChange();
  window.addEventListener(DEMO_PERSONA_CHANGE_EVENT, handleChange);
  window.addEventListener('storage', handleChange);

  return () => {
    window.removeEventListener(DEMO_PERSONA_CHANGE_EVENT, handleChange);
    window.removeEventListener('storage', handleChange);
  };
}

export function DemoRoleProvider({ children }: { children: React.ReactNode }) {
  const selectedPersonaId = useSyncExternalStore(
    subscribeToPersonaChanges,
    readPersonaIdFromStorage,
    () => DEFAULT_DEMO_USER_ID,
  );

  const setPersonaId = useCallback((id: string) => {
    const persona = getDemoPersonaById(id);
    sessionStorage.setItem(DEMO_USER_ID_STORAGE_KEY, persona.id);
    window.dispatchEvent(new Event(DEMO_PERSONA_CHANGE_EVENT));
  }, []);

  const value = useMemo(
    () => ({
      personas: DEMO_PERSONAS,
      selectedPersonaId,
      demoUser: getDemoPersonaById(selectedPersonaId),
      setPersonaId,
    }),
    [selectedPersonaId, setPersonaId],
  );

  if (!IS_DEMO_MODE) {
    return <>{children}</>;
  }

  return (
    <DemoRoleContext.Provider value={value}>{children}</DemoRoleContext.Provider>
  );
}

export function useDemoRole(): DemoRoleContextValue {
  const context = useContext(DemoRoleContext);

  if (!IS_DEMO_MODE) {
    return {
      personas: DEMO_PERSONAS,
      selectedPersonaId: DEFAULT_DEMO_USER_ID,
      demoUser: DEMO_PERSONAS[0],
      setPersonaId: () => {},
    };
  }

  if (!context) {
    throw new Error('useDemoRole must be used within DemoRoleProvider');
  }

  return context;
}
