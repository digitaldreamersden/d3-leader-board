import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import {
  Trophy,
  Clock,
  Target,
  Presentation,
  VolumeX,
  Users,
  GraduationCap,
  Briefcase,
  Settings,
  Pause,
  Play,
  AlertTriangle,
  Search,
  Menu,
  Undo2,
  CheckCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTeams } from "@/contexts/TeamsContext";
import { useTimer } from "@/contexts/TimerContext";
import { useMilestones } from "@/hooks/useMilestones";
import { executeDeleteAllLeaderboardTeamMembers } from "@/lib/sync-leaderboard-team-members";
import TimerSettingsPanel from "@/components/TimerSettingsPanel";
import ExportControls from "@/components/ExportControls";
import PodiumView from "@/components/PodiumView";

// Undo action type
interface UndoAction {
  teamId: string;
  milestoneId: number;
  action: "completed" | "undone";
}

const Index = () => {
  const { teams, setTeams } = useTeams();
  const { milestones: milestoneConfigs, clearMilestones } = useMilestones();

  const { state: timerState, displaySeconds, start, pause, resume, reset: resetTimer, addTime, stop } = useTimer();

  const [presentationMode, setPresentationMode] = useState(false);
  const [muteAudio, setMuteAudio] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [lastAction, setLastAction] = useState<UndoAction | null>(null);

  // Track which teams have already been fully completed (to avoid confetti on page load)
  const completedTeamsRef = useRef<Set<string>>(new Set());

  // Refs for settings panels (controlled open state)
  const [showTimerSettings, setShowTimerSettings] = useState(false);

  const gridRef = useRef<HTMLDivElement>(null);

  // Initialize completedTeamsRef with teams that are already fully completed on mount
  useEffect(() => {
    teams.forEach((team) => {
      const completedCount = team.milestones.filter((m) => m.completed).length;
      if (completedCount === milestoneConfigs.length && milestoneConfigs.length > 0) {
        completedTeamsRef.current.add(team.id);
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fullscreen effect for presentation mode
  useEffect(() => {
    const elem = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
      msRequestFullscreen?: () => Promise<void>;
    };
    if (presentationMode) {
      if (elem.requestFullscreen) {
        elem.requestFullscreen();
      } else if (typeof elem.webkitRequestFullscreen === "function") {
        elem.webkitRequestFullscreen();
      } else if (typeof elem.msRequestFullscreen === "function") {
        elem.msRequestFullscreen();
      }
    } else {
      if (document.fullscreenElement) {
        const doc = document as Document & {
          webkitExitFullscreen?: () => Promise<void>;
          msExitFullscreen?: () => Promise<void>;
        };
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if (typeof doc.webkitExitFullscreen === "function") {
          doc.webkitExitFullscreen();
        } else if (typeof doc.msExitFullscreen === "function") {
          doc.msExitFullscreen();
        }
      }
    }
  }, [presentationMode]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger when typing in input fields
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      // Space → pause/resume timer
      if (e.code === "Space" && (timerState.status === "running" || timerState.status === "paused")) {
        e.preventDefault();
        if (timerState.status === "running") pause();
        else resume();
      }

      // Ctrl+Z / Cmd+Z → undo last action (only when timer is running)
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && timerState.status === "running") {
        e.preventDefault();
        handleUndo();
      }

      // Escape → exit presentation mode
      if (e.key === "Escape" && presentationMode) {
        e.preventDefault();
        setPresentationMode(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [timerState.status, presentationMode, lastAction]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset Data handler
  const handleResetData = async () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("teams");
      localStorage.removeItem("timer-state");
      localStorage.removeItem("milestones-config");
    }
    setTeams([]);
    clearMilestones();
    resetTimer();
    setLastAction(null);
    completedTeamsRef.current.clear();

    try {
      await executeDeleteAllLeaderboardTeamMembers();
      toast.success("All data reset", {
        description: "Local data, milestones, and Supabase records cleared.",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error("Local data reset, but Supabase clear failed", { description: message });
    }
  };

  // Undo handler
  const handleUndo = useCallback(() => {
    if (!lastAction) return;
    const { teamId, milestoneId } = lastAction;

    setTeams((prev) =>
      prev.map((t) => {
        if (t.id === teamId) {
          const updatedMilestones = t.milestones.map((m) => {
            if (m.id === milestoneId) {
              return {
                ...m,
                completed: !m.completed,
                completedAt: !m.completed ? new Date() : undefined,
              };
            }
            return m;
          });
          // Recalculate total time
          let totalTime = 0;
          const completedMilestones = updatedMilestones.filter((m) => m.completed && m.completedAt);
          if (completedMilestones.length === milestoneConfigs.length) {
            const startTime = timerState.startTimestamp || Date.now();
            const endTime = Math.max(...completedMilestones.map((m) => m.completedAt!.getTime()));
            totalTime = endTime - startTime;
          }
          return { ...t, milestones: updatedMilestones, totalTime };
        }
        return t;
      })
    );

    setLastAction(null);
  }, [lastAction, teams, milestoneConfigs.length, timerState.startTimestamp, setTeams]);

  const sortedTeams = useMemo(() => {
    let filtered = [...teams];

    // Apply search filter
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase().trim();
      filtered = filtered.filter((team) =>
        team.name.toLowerCase().includes(search)
      );
    }

    return filtered.sort((a, b) => {
      const aCompleted = a.milestones.filter((m) => m.completed).length;
      const bCompleted = b.milestones.filter((m) => m.completed).length;

      if (aCompleted !== bCompleted) {
        return bCompleted - aCompleted;
      }

      const aCompletedMilestones = a.milestones.filter(
        (m) => m.completed && m.completedAt
      );
      const bCompletedMilestones = b.milestones.filter(
        (m) => m.completed && m.completedAt
      );

      if (aCompletedMilestones.length > 0 && bCompletedMilestones.length > 0) {
        const aLatestCompletion = Math.max(
          ...aCompletedMilestones.map((m) => {
            const time =
              m.completedAt instanceof Date
                ? m.completedAt.getTime()
                : new Date(m.completedAt!).getTime();
            return time;
          })
        );
        const bLatestCompletion = Math.max(
          ...bCompletedMilestones.map((m) => {
            const time =
              m.completedAt instanceof Date
                ? m.completedAt.getTime()
                : new Date(m.completedAt!).getTime();
            return time;
          })
        );

        return aLatestCompletion - bLatestCompletion;
      }

      return parseInt(a.id) - parseInt(b.id);
    });
  }, [teams, searchTerm]);

  // Fire confetti for team completion
  const fireConfetti = () => {
    confetti({
      particleCount: 150,
      spread: 80,
      origin: { y: 0.6 },
    });
  };

  // Check if a team is the first to fully complete (rank 1 among fully completed)
  const isFirstTeamToComplete = (teamId: string): boolean => {
    const fullyCompletedTeams = teams.filter((t) => {
      const count = t.milestones.filter((m) => m.completed).length;
      return count === milestoneConfigs.length;
    });
    return fullyCompletedTeams.length === 0 || (fullyCompletedTeams.length === 1 && fullyCompletedTeams[0].id === teamId);
  };

  const toggleMilestone = (teamId: string, milestoneId: number) => {
    // Block updates when timer is paused or expired
    if (timerState.status === "paused" || timerState.status === "expired") return;

    const team = teams.find((t) => t.id === teamId);
    if (!team) return;

    const milestone = team.milestones.find((m) => m.id === milestoneId);
    if (!milestone) return;

    const milestoneIndex = team.milestones.findIndex((m) => m.id === milestoneId);

    // Enforce sequential order
    if (!milestone.completed) {
      const allPreviousDone = team.milestones
        .slice(0, milestoneIndex)
        .every((m) => m.completed);
      if (!allPreviousDone) return;
    } else {
      const anyLaterCompleted = team.milestones
        .slice(milestoneIndex + 1)
        .some((m) => m.completed);
      if (anyLaterCompleted) return;
    }

    const isCompleting = !milestone.completed;

    // Check if this completion will make the team fully completed
    const willBeFullyCompleted = isCompleting &&
      team.milestones.filter((m) => m.completed).length + 1 === milestoneConfigs.length;

    // Determine if this will be the first team to complete
    const willBeFirst = willBeFullyCompleted && isFirstTeamToComplete(teamId);

    // Play sound
    if (!muteAudio) {
      if (willBeFirst) {
        // First-place completion: play sound louder / twice
        const audio1 = new window.Audio("/level-up.mp3");
        audio1.volume = 1.0;
        audio1.play();
        setTimeout(() => {
          const audio2 = new window.Audio("/level-up.mp3");
          audio2.volume = 1.0;
          audio2.play();
        }, 500);
      } else {
        const audio = new window.Audio("/level-up.mp3");
        audio.play();
      }
    }

    // Fire confetti if team just completed all milestones
    if (willBeFullyCompleted) {
      setTimeout(() => fireConfetti(), 200);
      if (willBeFirst) {
        // Extra confetti burst for first place
        setTimeout(() => fireConfetti(), 700);
      }
    }

    // Store undo action
    setLastAction({ teamId, milestoneId, action: isCompleting ? "completed" : "undone" });

    // Update the team and milestone state
    setTeams(
      teams.map((t) => {
        if (t.id === teamId) {
          const updatedMilestones = t.milestones.map((m) => {
            if (m.id === milestoneId) {
              const now = new Date();
              return {
                ...m,
                completed: !m.completed,
                completedAt: !m.completed ? now : undefined,
              };
            }
            return m;
          });

          // Calculate total time if all milestones are completed
          let totalTime = 0;
          const completedMilestones = updatedMilestones.filter(
            (m) => m.completed && m.completedAt
          );
          if (completedMilestones.length === milestoneConfigs.length) {
            const startTime = timerState.startTimestamp || Date.now();
            const endTime = Math.max(
              ...completedMilestones.map((m) => m.completedAt!.getTime())
            );
            totalTime = endTime - startTime;
          }

          return { ...t, milestones: updatedMilestones, totalTime };
        }
        return t;
      })
    );

    // Mark as fully completed in ref (for confetti tracking)
    if (willBeFullyCompleted) {
      completedTeamsRef.current.add(teamId);
    } else if (!isCompleting) {
      completedTeamsRef.current.delete(teamId);
    }

    // Scroll to the specific team card
    setTimeout(() => {
      const el = document.getElementById(`team-card-${teamId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }, 100);
  };

  // Bulk mark all milestones for a team
  const bulkCompleteAll = (teamId: string) => {
    if (timerState.status !== "running") return;

    const team = teams.find((t) => t.id === teamId);
    if (!team) return;

    const remainingMilestones = team.milestones.filter((m) => !m.completed);
    if (remainingMilestones.length === 0) return;

    const willBeFullyCompleted = true;
    const willBeFirst = isFirstTeamToComplete(teamId);

    // Play sound
    if (!muteAudio) {
      if (willBeFirst) {
        const audio1 = new window.Audio("/level-up.mp3");
        audio1.volume = 1.0;
        audio1.play();
        setTimeout(() => {
          const audio2 = new window.Audio("/level-up.mp3");
          audio2.volume = 1.0;
          audio2.play();
        }, 500);
      } else {
        const audio = new window.Audio("/level-up.mp3");
        audio.play();
      }
    }

    // Fire confetti
    setTimeout(() => fireConfetti(), 200);
    if (willBeFirst) {
      setTimeout(() => fireConfetti(), 700);
    }

    const now = new Date();

    setTeams(
      teams.map((t) => {
        if (t.id === teamId) {
          const updatedMilestones = t.milestones.map((m) => ({
            ...m,
            completed: true,
            completedAt: m.completedAt || now,
          }));

          const startTime = timerState.startTimestamp || Date.now();
          const endTime = now.getTime();
          const totalTime = endTime - startTime;

          return { ...t, milestones: updatedMilestones, totalTime };
        }
        return t;
      })
    );

    completedTeamsRef.current.add(teamId);

    // Store last action as the last milestone completed (for undo — note: undo after bulk only reverts the last milestone)
    // Disable undo after bulk since partial revert would be confusing
    setLastAction(null);

    setTimeout(() => {
      const el = document.getElementById(`team-card-${teamId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }, 100);
  };

  const formatTime = (timestamp: Date) => {
    return timestamp.toLocaleTimeString("en-US", {
      hour12: true,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatDuration = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const getPositionEmoji = (position: number) => {
    switch (position) {
      case 1:
        return "🥇";
      case 2:
        return "🥈";
      case 3:
        return "🥉";
      default:
        return `#${position}`;
    }
  };

  // Live stats bar data
  const milestoneStats = useMemo(() => {
    if (milestoneConfigs.length === 0 || teams.length === 0) return null;
    const stats = milestoneConfigs.map((mc) => {
      const completedCount = teams.filter((t) => {
        const milestone = t.milestones.find((m) => m.id === mc.id);
        return milestone?.completed;
      }).length;
      return { title: mc.title, completedCount, total: teams.length };
    });
    const fullyCompleted = teams.filter(
      (t) => t.milestones.filter((m) => m.completed).length === milestoneConfigs.length
    ).length;
    return { stats, fullyCompleted };
  }, [teams, milestoneConfigs]);

  // Guard: require both teams and milestones to view dashboard
  if (milestoneConfigs.length === 0 || teams.length === 0) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-6 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6">🏗️</div>
          <h1 className="text-2xl font-bold mb-4">Setup Required</h1>
          <p className="text-gray-400 text-lg mb-6">
            {milestoneConfigs.length === 0 && teams.length === 0
              ? "Add milestones and teams before starting the activity."
              : milestoneConfigs.length === 0
                ? "Add milestones before starting the activity."
                : "Add teams before starting the activity."}
          </p>
          <div className="flex gap-3 justify-center">
            {milestoneConfigs.length === 0 && (
              <Link
                to="/milestones"
                className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
              >
                Add Milestones
              </Link>
            )}
            {teams.length === 0 && (
              <Link
                to="/teams"
                className="px-4 py-2 rounded bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition-colors"
              >
                Add Teams
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Presentation mode + expired = show podium view
  if (presentationMode && timerState.status === "expired") {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-6">
        <div className="flex justify-between items-center mb-4">
          <div className="text-8xl font-mono text-red-400">
            00:00:00
          </div>
          <div className="flex items-center gap-4">
            <Badge className="bg-red-600 text-white animate-pulse text-2xl px-4 py-2">
              <AlertTriangle className="w-6 h-6 mr-2" />
              Time Out
            </Badge>
            <div className="flex items-center gap-2">
              <Presentation className="w-4 h-4" />
              <Switch
                checked={presentationMode}
                onCheckedChange={setPresentationMode}
              />
            </div>
          </div>
        </div>
        <PodiumView teams={sortedTeams} />
      </div>
    );
  }

  // Presentation mode (running/paused) — large TV-friendly layout
  if (presentationMode) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-6xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Leaderboard
          </h1>
          <div className="flex items-center gap-6">
            {timerState.status !== "idle" && (
              <div className="text-8xl font-mono text-green-400">
                {String(Math.floor(displaySeconds / 3600)).padStart(2, "0")}:
                {String(Math.floor((displaySeconds % 3600) / 60)).padStart(2, "0")}:
                {String(displaySeconds % 60).padStart(2, "0")}
              </div>
            )}
            {timerState.status === "paused" && (
              <Badge className="bg-yellow-600 text-white text-2xl px-4 py-2">
                <Pause className="w-6 h-6 mr-2" />
                Paused
              </Badge>
            )}
            <div className="flex items-center gap-2">
              <Presentation className="w-5 h-5" />
              <Switch
                checked={presentationMode}
                onCheckedChange={setPresentationMode}
              />
            </div>
          </div>
        </div>

        {/* Search Bar in Presentation Mode */}
        {teams.length > 0 && (
          <div className="mb-6 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search teams..."
                className="pl-10 bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
              />
            </div>
          </div>
        )}

        {/* Presentation mode grid — same design as normal view */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedTeams.map((team, index) => {
            const position = index + 1;
            const completedCount = team.milestones.filter((m) => m.completed).length;
            const isFullyCompleted = completedCount === milestoneConfigs.length;
            const isLocked = timerState.status === "paused" || timerState.status === "expired";
            const hasRemainingMilestones = completedCount < milestoneConfigs.length;

            return (
              <Card
                key={team.id}
                id={`team-card-${team.id}`}
                className="bg-gray-800 border-gray-700 hover:border-gray-600 transition-all duration-200 transform hover:scale-105"
              >
                <CardHeader className="pb-4">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-3xl font-bold text-white capitalize">
                      {team.name}
                    </CardTitle>
                    {isFullyCompleted && (
                      <Badge
                        variant="secondary"
                        className="bg-gray-700 text-white text-2xl px-2 py-1"
                      >
                        {getPositionEmoji(position)}
                      </Badge>
                    )}
                  </div>
                  <hr className="my-2 border-gray-700" />
                  <div className="flex justify-between items-start">
                    <div className="text-sm text-gray-400">
                      Progress: {completedCount}/{milestoneConfigs.length} milestones
                    </div>
                    {isFullyCompleted && team.totalTime > 0 && (
                      <div className="text-sm text-green-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Total time: {formatDuration(team.totalTime)}
                      </div>
                    )}
                  </div>

                  {/* Team Members: popover */}
                  {team.members && team.members.length > 0 && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <div className="text-sm text-gray-400 flex items-center gap-1 cursor-pointer hover:text-gray-300 transition-colors">
                          <Users className="w-4 h-4" />
                          {team.members.length} member{team.members.length !== 1 ? 's' : ''}
                        </div>
                      </PopoverTrigger>
                      <PopoverContent className="w-80 bg-gray-800 border-gray-600">
                        <div className="space-y-3">
                          <h4 className="text-white font-medium">Team Members</h4>
                          <div className="space-y-2 max-h-60 overflow-y-auto">
                            {team.members.map((member, idx) => (
                              <div key={idx} className="flex items-center gap-2 p-2 bg-gray-700/50 rounded-lg">
                                <div className="flex-1">
                                  <div className="text-sm font-medium text-white">{member.name}</div>
                                  <div className="text-xs text-gray-400">{member.email}</div>
                                </div>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className={`p-1.5 rounded-full cursor-help ${
                                        member.experienceLevel === 'student'
                                          ? 'bg-green-600 text-white hover:bg-green-500'
                                          : 'bg-purple-600 text-white hover:bg-purple-500'
                                      }`}>
                                        {member.experienceLevel === 'student' ? (
                                          <GraduationCap className="w-3 h-3" />
                                        ) : (
                                          <Briefcase className="w-3 h-3" />
                                        )}
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className="capitalize">{member.experienceLevel}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                            ))}
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}

                  <div className="flex justify-start items-start">
                    {isFullyCompleted && (
                      <Badge className="bg-green-600 text-white px-2 py-1">
                        <Trophy className="w-5 h-5 mr-1" />
                        Completed
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Milestones */}
                  {timerState.status !== "idle" && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-gray-300 mb-2">Milestones</div>
                    {team.milestones.map((milestone, mIdx) => {
                      const isNextToComplete = !milestone.completed &&
                        team.milestones.slice(0, mIdx).every((m) => m.completed);
                      const isLastCompleted = milestone.completed &&
                        !team.milestones.slice(mIdx + 1).some((m) => m.completed);
                      const isActionable = !isLocked && (isNextToComplete || isLastCompleted);

                      return (
                      <div key={milestone.id} className="space-y-2">
                      <div
                        className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                          isActionable ? "cursor-pointer" : "cursor-not-allowed opacity-70"
                        } ${
                          milestone.completed
                            ? "bg-green-900/30 border-green-500 shadow-lg shadow-green-500/20"
                            : isNextToComplete && !isLocked
                              ? "bg-gray-700/50 border-blue-500 hover:border-blue-400"
                              : "bg-gray-700/50 border-gray-600"
                        }`}
                        onClick={() => toggleMilestone(team.id, milestone.id)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Target
                                className={`w-4 h-4 ${
                                  milestone.completed
                                    ? "text-green-400"
                                    : "text-gray-400"
                                }`}
                              />
                              <h4 className="font-semibold text-white">
                                Milestone {milestone.id}: {milestone.title}
                              </h4>
                            </div>
                            <p className="text-sm text-gray-400 mb-2">
                              {milestone.subtitle}
                            </p>
                            {milestone.completed && milestone.completedAt && (
                              <div className="text-xs text-green-400 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Completed at {formatTime(milestone.completedAt)}
                              </div>
                            )}
                          </div>
                          <div
                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                              milestone.completed
                                ? "bg-green-500 border-green-500"
                                : "border-gray-400"
                            }`}
                          >
                            {milestone.completed && (
                              <div className="w-2 h-2 bg-white rounded-full"></div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                  })}

                    {/* Bulk Complete All Button */}
                    {timerState.status === "running" && hasRemainingMilestones && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          bulkCompleteAll(team.id);
                        }}
                        className="mt-2 w-full px-3 py-2 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1"
                        title="Mark all remaining milestones as completed"
                      >
                        <CheckCheck className="w-4 h-4" />
                        Mark All Milestones
                      </button>
                    )}
                  </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                Leaderboard
                </h1>
              </div>
              <p className="text-gray-400 text-xl mt-4">
                Track your team's progress through the milestones
              </p>
            </div>
            <div className="flex items-center gap-4">
              {timerState.status !== "idle" && (
                <div className="flex items-center gap-2 text-5xl font-mono">
                  <span className="text-green-400">⏱️</span>
                  <span>
                    {String(Math.floor(displaySeconds / 3600)).padStart(2, "0")}:
                    {String(Math.floor((displaySeconds % 3600) / 60)).padStart(2, "0")}
                    :{String(displaySeconds % 60).padStart(2, "0")}
                  </span>
                </div>
              )}
              {/* Time Out Indicator */}
              {timerState.status === "expired" && (
                <Badge className="bg-red-600 text-white animate-pulse">
                  <AlertTriangle className="w-4 h-4 mr-1" />
                  Time Out
                </Badge>
              )}
              {/* Paused Indicator */}
              {timerState.status === "paused" && (
                <Badge className="bg-yellow-600 text-white">
                  <Pause className="w-4 h-4 mr-1" />
                  Paused
                </Badge>
              )}

              {/* Undo Button — only when timer is running (not expired) */}
              {lastAction && timerState.status === "running" && (
                <button
                  onClick={handleUndo}
                  className="px-3 py-1 rounded bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold transition-colors flex items-center gap-1"
                  title="Undo last action (Ctrl+Z)"
                >
                  <Undo2 className="w-4 h-4" />
                  Undo
                </button>
              )}

              {timerState.status === "idle" && (
                <button
                  onClick={start}
                  disabled={teams.length === 0 || milestoneConfigs.length === 0}
                  className="px-3 py-1 rounded bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
                  title={teams.length === 0 ? "Add teams first" : milestoneConfigs.length === 0 ? "Add milestones first" : "Start Timer"}
                >
                  Start Timer
                </button>
              )}
              {timerState.status === "running" && (
                <button
                  onClick={pause}
                  className="px-3 py-1 rounded bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-semibold transition-colors"
                  title="Pause Timer"
                >
                  <span className="flex items-center gap-1">
                    <Pause className="w-4 h-4" />
                    Pause
                  </span>
                </button>
              )}
              {timerState.status === "paused" && (
                <button
                  onClick={resume}
                  className="px-3 py-1 rounded bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors"
                  title="Resume Timer"
                >
                  <span className="flex items-center gap-1">
                    <Play className="w-4 h-4" />
                    Resume
                  </span>
                </button>
              )}

              {/* Stop Activity — hard stop */}
              {(timerState.status === "running" || timerState.status === "paused") && (
                <button
                  onClick={stop}
                  className="px-3 py-1 rounded bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors"
                  title="End activity immediately"
                >
                  Stop
                </button>
              )}

              {/* Unified Settings Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-white text-sm transition-colors"
                    title="Settings & Actions"
                  >
                    <Menu className="w-4 h-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-gray-800 border-gray-600 text-white">
                  <DropdownMenuItem
                    className="cursor-pointer hover:bg-gray-700 focus:bg-gray-700"
                    onClick={() => setShowTimerSettings(true)}
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Timer Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-gray-600" />
                  <DropdownMenuItem
                    className="cursor-pointer hover:bg-red-900/50 focus:bg-red-900/50 text-red-400"
                    onClick={handleResetData}
                  >
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Reset All Data
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Export Controls */}
              <ExportControls />

              <div className="flex items-center gap-2">
                <Presentation className="w-4 h-4" />
                <span className="text-sm">Presentation</span>
                <Switch
                  checked={presentationMode}
                  onCheckedChange={setPresentationMode}
                />
              </div>
              <div className="flex items-center gap-2">
                <VolumeX className="w-4 h-4" />
                <span className="text-sm">Mute</span>
                <Switch checked={muteAudio} onCheckedChange={setMuteAudio} />
              </div>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        {timerState.status !== "idle" && teams.length > 0 && (
          <div className="mb-6 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search teams..."
                className="pl-10 bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
              />
            </div>
          </div>
        )}

        {/* Live Stats Bar */}
        {timerState.status === "running" && milestoneStats && (
          <div className="mb-6 p-4 rounded-lg bg-gray-800/80 border border-gray-700">
            <div className="flex flex-wrap items-center gap-6">
              {milestoneStats.stats.map((stat, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  <Target className="w-4 h-4 text-blue-400" />
                  <span className="text-gray-300">
                    {stat.completedCount}/{stat.total} completed
                  </span>
                  <span className="text-gray-500 text-xs">({stat.title})</span>
                </div>
              ))}
              <div className="flex items-center gap-2 text-sm border-l border-gray-600 pl-6">
                <Trophy className="w-4 h-4 text-green-400" />
                <span className="text-green-300 font-semibold">
                  {milestoneStats.fullyCompleted} team{milestoneStats.fullyCompleted !== 1 ? "s" : ""} fully completed
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Paused/Expired overlay message */}
        {timerState.status === "paused" && (
          <div className="mb-4 p-3 rounded-lg bg-yellow-900/20 border border-yellow-600/30 text-yellow-300 text-sm flex items-center gap-2">
            <Pause className="w-4 h-4" />
            Timer is paused — milestone updates are disabled until you resume.
          </div>
        )}
        {timerState.status === "expired" && (
          <div className="mb-4 p-3 rounded-lg bg-red-900/20 border border-red-600/30 text-red-300 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Time is up — milestone updates are disabled. Add extra time to continue.
          </div>
        )}

        {/* Add Time buttons */}
        {(timerState.status === "running" || timerState.status === "paused" || timerState.status === "expired") && (
          <div className="mb-4 flex items-center gap-2">
            <span className="text-sm text-gray-400">Add time:</span>
            <button
              onClick={() => addTime(5 * 60)}
              className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
            >
              +5 min
            </button>
            <button
              onClick={() => addTime(10 * 60)}
              className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
            >
              +10 min
            </button>
          </div>
        )}

        {/* Teams Grid */}
        <div id="leaderboard-grid" ref={gridRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedTeams.map((team, index) => {
            const position = index + 1;
            const completedCount = team.milestones.filter(
              (m) => m.completed
            ).length;
            const isFullyCompleted = completedCount === milestoneConfigs.length;
            const isLocked = timerState.status === "paused" || timerState.status === "expired";
            const hasRemainingMilestones = completedCount < milestoneConfigs.length;

            return (
              <Card
                key={team.id}
                id={`team-card-${team.id}`}
                className="bg-gray-800 border-gray-700 hover:border-gray-600 transition-all duration-200 transform hover:scale-105"
              >
                <CardHeader className="pb-4">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-3xl font-bold text-white capitalize">
                      {team.name}
                    </CardTitle>
                    {isFullyCompleted && (
                      <Badge
                        variant="secondary"
                        className="bg-gray-700 text-white text-2xl px-2 py-1"
                      >
                        {getPositionEmoji(position)}
                      </Badge>
                    )}
                  </div>
                  <hr className="my-2 border-gray-700" />
                  <div className="flex justify-between items-start">
                    <div className="text-sm text-gray-400">
                      Progress: {completedCount}/{milestoneConfigs.length} milestones
                    </div>
                    {isFullyCompleted && team.totalTime > 0 && (
                      <div className="text-sm text-green-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Total time: {formatDuration(team.totalTime)}
                      </div>
                    )}
                  </div>

                  {/* Team Members: show inline before timer starts, popover after */}
                  {team.members && team.members.length > 0 && timerState.status === "idle" && (
                    <div className="mt-3 space-y-2">
                      <div className="text-sm font-medium text-gray-300 flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        Team Members ({team.members.length})
                      </div>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {team.members.map((member, idx) => (
                          <div key={idx} className="flex items-center gap-2 p-2 bg-gray-700/50 rounded-lg">
                            <div className="flex-1">
                              <div className="text-sm font-medium text-white">{member.name}</div>
                              <div className="text-xs text-gray-400">{member.email}</div>
                            </div>
                            <div className={`p-1.5 rounded-full ${
                              member.experienceLevel === 'student'
                                ? 'bg-green-600 text-white'
                                : 'bg-purple-600 text-white'
                            }`}>
                              {member.experienceLevel === 'student' ? (
                                <GraduationCap className="w-3 h-3" />
                              ) : (
                                <Briefcase className="w-3 h-3" />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Team Members: popover after timer starts */}
                  {team.members && team.members.length > 0 && timerState.status !== "idle" && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <div className="text-sm text-gray-400 flex items-center gap-1 cursor-pointer hover:text-gray-300 transition-colors">
                          <Users className="w-4 h-4" />
                          {team.members.length} member{team.members.length !== 1 ? 's' : ''}
                        </div>
                      </PopoverTrigger>
                      <PopoverContent className="w-80 bg-gray-800 border-gray-600">
                        <div className="space-y-3">
                          <h4 className="text-white font-medium">Team Members</h4>
                          <div className="space-y-2 max-h-60 overflow-y-auto">
                            {team.members.map((member, idx) => (
                              <div key={idx} className="flex items-center gap-2 p-2 bg-gray-700/50 rounded-lg">
                                <div className="flex-1">
                                  <div className="text-sm font-medium text-white">{member.name}</div>
                                  <div className="text-xs text-gray-400">{member.email}</div>
                                </div>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className={`p-1.5 rounded-full cursor-help ${
                                        member.experienceLevel === 'student'
                                          ? 'bg-green-600 text-white hover:bg-green-500'
                                          : 'bg-purple-600 text-white hover:bg-purple-500'
                                      }`}>
                                        {member.experienceLevel === 'student' ? (
                                          <GraduationCap className="w-3 h-3" />
                                        ) : (
                                          <Briefcase className="w-3 h-3" />
                                        )}
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className="capitalize">{member.experienceLevel}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                            ))}
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}

                  <div className="flex justify-start items-start">
                    {isFullyCompleted && (
                      <Badge className="bg-green-600 text-white px-2 py-1">
                        <Trophy className="w-5 h-5 mr-1" />
                        Completed
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Milestones: only show when timer has been started */}
                  {timerState.status !== "idle" && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-gray-300 mb-2">Milestones</div>
                    {team.milestones.map((milestone, mIdx) => {
                      // Determine if this milestone is actionable
                      const isNextToComplete = !milestone.completed &&
                        team.milestones.slice(0, mIdx).every((m) => m.completed);
                      const isLastCompleted = milestone.completed &&
                        !team.milestones.slice(mIdx + 1).some((m) => m.completed);
                      const isActionable = !isLocked && (isNextToComplete || isLastCompleted);

                      return (
                      <div key={milestone.id} className="space-y-2">
                      <div
                        className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                          isActionable ? "cursor-pointer" : "cursor-not-allowed opacity-70"
                        } ${
                          milestone.completed
                            ? "bg-green-900/30 border-green-500 shadow-lg shadow-green-500/20"
                            : isNextToComplete && !isLocked
                              ? "bg-gray-700/50 border-blue-500 hover:border-blue-400"
                              : "bg-gray-700/50 border-gray-600"
                        }`}
                        onClick={() => toggleMilestone(team.id, milestone.id)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Target
                                className={`w-4 h-4 ${
                                  milestone.completed
                                    ? "text-green-400"
                                    : "text-gray-400"
                                }`}
                              />
                              <h4 className="font-semibold text-white">
                                Milestone {milestone.id}: {milestone.title}
                              </h4>
                            </div>
                            <p className="text-sm text-gray-400 mb-2">
                              {milestone.subtitle}
                            </p>
                            {milestone.completed && milestone.completedAt && (
                              <div className="text-xs text-green-400 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Completed at {formatTime(milestone.completedAt)}
                              </div>
                            )}
                          </div>
                          <div
                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                              milestone.completed
                                ? "bg-green-500 border-green-500"
                                : "border-gray-400"
                            }`}
                          >
                            {milestone.completed && (
                              <div className="w-2 h-2 bg-white rounded-full"></div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                  })}

                    {/* Bulk Complete All Button */}
                    {timerState.status === "running" && hasRemainingMilestones && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          bulkCompleteAll(team.id);
                        }}
                        className="mt-2 w-full px-3 py-2 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1"
                        title="Mark all remaining milestones as completed"
                      >
                        <CheckCheck className="w-4 h-4" />
                        Mark All Milestones
                      </button>
                    )}
                  </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {teams.length === 0 && (
          <div className="text-center py-16 flex flex-col items-center">
            <svg
              width="64"
              height="64"
              viewBox="0 0 64 64"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="mb-4"
            >
              <circle cx="32" cy="32" r="32" fill="#1E293B" />
              <ellipse cx="32" cy="44" rx="18" ry="8" fill="#64748B" />
              <circle cx="32" cy="28" r="8" fill="#94A3B8" />
              <circle cx="18" cy="34" r="5" fill="#94A3B8" />
              <circle cx="46" cy="34" r="5" fill="#94A3B8" />
            </svg>
            <div className="text-gray-400 text-lg mb-4">No teams available yet</div>
            <p className="text-gray-500">Create teams in the Teams page to start tracking progress!</p>
          </div>
        )}
      </div>

      {/* Timer Settings Dialog (controlled) */}
      {showTimerSettings && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20" onClick={() => setShowTimerSettings(false)}>
          <div className="fixed inset-0 bg-black/50" />
          <div className="relative z-50 w-72 bg-gray-800 border border-gray-600 rounded-lg shadow-lg p-4" onClick={(e) => e.stopPropagation()}>
            <TimerSettingsPanel onSave={() => setShowTimerSettings(false)} />
          </div>
        </div>
      )}

    </div>
  );
};

export default Index;
