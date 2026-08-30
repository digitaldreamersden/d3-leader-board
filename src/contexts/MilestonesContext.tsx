import React, { createContext, useContext, useState } from "react";
import { INITIAL_MILESTONES, type MilestoneConfig } from "@/lib/constants";

export type { MilestoneConfig };
export { INITIAL_MILESTONES };

const STORAGE_KEY = "milestones-config";

function loadMilestones(): MilestoneConfig[] {
  if (typeof window === "undefined") {
    return INITIAL_MILESTONES;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_MILESTONES;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return INITIAL_MILESTONES;
    return parsed;
  } catch {
    return INITIAL_MILESTONES;
  }
}

function persistMilestones(milestones: MilestoneConfig[]): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(milestones));
  }
}

interface MilestonesContextValue {
  milestones: MilestoneConfig[];
  setMilestones: (ms: MilestoneConfig[]) => void;
  addMilestone: (title: string, subtitle: string) => void;
  removeMilestone: (id: number) => void;
  reorderMilestones: (fromIndex: number, toIndex: number) => void;
  renameMilestone: (id: number, title: string, subtitle: string) => void;
  clearMilestones: () => void;
}

const MilestonesContext = createContext<MilestonesContextValue | null>(null);

export const MilestonesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [milestones, setMilestonesState] = useState<MilestoneConfig[]>(loadMilestones);

  const setMilestones = (ms: MilestoneConfig[]) => {
    setMilestonesState(ms);
    persistMilestones(ms);
  };

  const addMilestone = (title: string, subtitle: string) => {
    setMilestonesState((prev) => {
      const maxId = prev.reduce((max, m) => Math.max(max, m.id), 0);
      const updated = [...prev, { id: maxId + 1, title, subtitle }];
      persistMilestones(updated);
      return updated;
    });
  };

  const removeMilestone = (id: number) => {
    setMilestonesState((prev) => {
      const updated = prev.filter((m) => m.id !== id);
      persistMilestones(updated);
      return updated;
    });
  };

  const reorderMilestones = (fromIndex: number, toIndex: number) => {
    setMilestonesState((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      persistMilestones(updated);
      return updated;
    });
  };

  const renameMilestone = (id: number, title: string, subtitle: string) => {
    setMilestonesState((prev) => {
      const updated = prev.map((m) =>
        m.id === id ? { ...m, title, subtitle } : m
      );
      persistMilestones(updated);
      return updated;
    });
  };

  const clearMilestones = () => {
    setMilestonesState([]);
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  return (
    <MilestonesContext.Provider
      value={{
        milestones,
        setMilestones,
        addMilestone,
        removeMilestone,
        reorderMilestones,
        renameMilestone,
        clearMilestones,
      }}
    >
      {children}
    </MilestonesContext.Provider>
  );
};

export function useMilestones(): MilestonesContextValue {
  const context = useContext(MilestonesContext);
  if (!context) {
    throw new Error("useMilestones must be used within a MilestonesProvider");
  }
  return context;
}
