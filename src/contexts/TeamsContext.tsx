import React, { createContext, useContext, useEffect, useState } from "react";
import { useMilestones, INITIAL_MILESTONES } from "@/contexts/MilestonesContext";
import type { MilestoneConfig } from "@/contexts/MilestonesContext";

export interface Milestone {
  id: number;
  title: string;
  subtitle: string;
  completed: boolean;
  completedAt?: Date;
}

export interface User {
  name: string;
  email: string;
  experienceLevel: "student" | "working professional";
}

export interface Team {
  id: string;
  name: string;
  milestones: Milestone[];
  totalTime: number;
  description?: string;
  members: User[];
}

export interface TeamsContextValue {
  teams: Team[];
  setTeams: (teams: Team[] | ((prev: Team[]) => Team[])) => void;
  addTeam: (team: Team) => void;
  removeTeam: (teamId: string) => void;
  updateTeam: (teamId: string, updater: (team: Team) => Team) => void;
  milestoneConfigs: MilestoneConfig[];
}

const TeamsContext = createContext<TeamsContextValue | undefined>(undefined);

function loadTeamsFromStorage(): Team[] {
  if (typeof window === "undefined") {
    return [];
  }
  const saved = localStorage.getItem("teams");
  if (!saved) {
    return [];
  }
  try {
    const parsed = JSON.parse(saved);
    return parsed.map((team: Team) => ({
      ...team,
      milestones: team.milestones
        ? team.milestones.map((m: Milestone) => ({
            ...m,
            completedAt: m.completedAt ? new Date(m.completedAt) : undefined,
          }))
        : INITIAL_MILESTONES.map((m) => ({ ...m, completed: false })),
      members: team.members || [],
    }));
  } catch {
    return [];
  }
}

export const TeamsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [teams, setTeams] = useState<Team[]>(loadTeamsFromStorage);
  const { milestones: milestoneConfigs } = useMilestones();

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("teams", JSON.stringify(teams));
    }
  }, [teams]);

  // Convenience methods will be implemented in task 1.3
  const addTeam = (team: Team) => {
    const teamWithMilestones: Team = {
      ...team,
      milestones: team.milestones.length > 0
        ? team.milestones
        : milestoneConfigs.map((m) => ({ ...m, completed: false })),
    };
    setTeams((prev) => [...prev, teamWithMilestones]);
  };

  const removeTeam = (teamId: string) => {
    setTeams((prev) => prev.filter((t) => t.id !== teamId));
  };

  const updateTeam = (teamId: string, updater: (team: Team) => Team) => {
    setTeams((prev) =>
      prev.map((t) => (t.id === teamId ? updater(t) : t))
    );
  };

  return (
    <TeamsContext.Provider
      value={{ teams, setTeams, addTeam, removeTeam, updateTeam, milestoneConfigs }}
    >
      {children}
    </TeamsContext.Provider>
  );
};

export function useTeams(): TeamsContextValue {
  const context = useContext(TeamsContext);
  if (context === undefined) {
    throw new Error("useTeams must be used within a TeamsProvider");
  }
  return context;
}
