import React from "react";
import { Trophy } from "lucide-react";
import type { Team } from "@/contexts/TeamsContext";

interface PodiumViewProps {
  teams: Team[];
}

const PodiumView: React.FC<PodiumViewProps> = ({ teams }) => {
  const top3 = teams.slice(0, 3);
  const first = top3[0];
  const second = top3[1];
  const third = top3[2];

  if (!first) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-gray-400 text-2xl">
        No teams have completed yet.
      </div>
    );
  }

  const getMedalStyle = (position: number) => {
    switch (position) {
      case 1:
        return "text-yellow-400 border-yellow-400";
      case 2:
        return "text-gray-300 border-gray-300";
      case 3:
        return "text-amber-600 border-amber-600";
      default:
        return "text-gray-400 border-gray-400";
    }
  };

  const getMedalEmoji = (position: number) => {
    switch (position) {
      case 1:
        return "🥇";
      case 2:
        return "🥈";
      case 3:
        return "🥉";
      default:
        return "";
    }
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

  const PodiumCard = ({
    team,
    position,
    heightClass,
  }: {
    team: Team;
    position: number;
    heightClass: string;
  }) => {
    const completedCount = team.milestones.filter((m) => m.completed).length;
    const totalMilestones = team.milestones.length;
    const isFullyCompleted = completedCount === totalMilestones && totalMilestones > 0;

    return (
    <div className={`flex flex-col items-center justify-end ${heightClass}`}>
      <div className="text-8xl mb-4">{getMedalEmoji(position)}</div>
      <div
        className={`border-4 rounded-2xl p-8 bg-gray-800/80 backdrop-blur-sm ${getMedalStyle(position)} min-w-[280px]`}
      >
        <div className="text-center">
          <h2 className="text-5xl font-bold text-white capitalize mb-2">
            {team.name}
          </h2>
          {team.totalTime > 0 && (
            <p className="text-2xl text-gray-300">
              {formatDuration(team.totalTime)}
            </p>
          )}
          <div className="mt-3 flex items-center justify-center gap-2 text-xl">
            <Trophy className={`w-6 h-6 ${isFullyCompleted ? "text-green-400" : "text-gray-400"}`} />
            <span className={isFullyCompleted ? "text-green-400" : "text-gray-400"}>
              {completedCount}/{totalMilestones} milestones
            </span>
          </div>
        </div>

        {/* Team Members */}
        {team.members && team.members.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-600">
            <p className="text-sm text-gray-400 text-center mb-2">Team Members</p>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {team.members.map((member, idx) => (
                <div key={idx} className="text-center text-sm text-gray-200">
                  {member.name}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <div
        className={`w-full mt-4 rounded-t-lg ${
          position === 1
            ? "bg-yellow-500/30 h-32"
            : position === 2
            ? "bg-gray-400/30 h-24"
            : "bg-amber-700/30 h-16"
        } flex items-center justify-center`}
      >
        <span className="text-4xl font-bold text-white">#{position}</span>
      </div>
    </div>
  );
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-8">
      <h1 className="text-6xl font-bold mb-12 bg-gradient-to-r from-yellow-400 via-white to-yellow-400 bg-clip-text text-transparent">
        🏆 Final Standings 🏆
      </h1>
      <div className="flex items-end justify-center gap-8 w-full max-w-5xl">
        {/* 2nd place - left */}
        {second && <PodiumCard team={second} position={2} heightClass="h-[420px]" />}
        {/* 1st place - center */}
        {first && <PodiumCard team={first} position={1} heightClass="h-[480px]" />}
        {/* 3rd place - right */}
        {third && <PodiumCard team={third} position={3} heightClass="h-[360px]" />}
      </div>
    </div>
  );
};

export default PodiumView;
