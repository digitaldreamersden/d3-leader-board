import { useRef } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import { useTeams } from "@/contexts/TeamsContext";
import { useTimer } from "@/contexts/TimerContext";
import { useMilestones } from "@/hooks/useMilestones";
import { EVENT_TITLE } from "@/lib/constants";

function getDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function formatTimerDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

const ExportControls = () => {
  const { teams } = useTeams();
  const { state: timerState } = useTimer();
  const { milestones: milestoneConfigs } = useMilestones();
  const tableRef = useRef<HTMLDivElement>(null);

  // Only allow export when activity is completed (expired) and teams exist
  const isDisabled = teams.length === 0 || timerState.status !== "expired";

  const handleDownloadJPG = async () => {
    const tableEl = tableRef.current;
    if (!tableEl) {
      toast.error("Could not generate leaderboard image");
      return;
    }

    // Temporarily make the hidden element visible for capture
    tableEl.style.position = "fixed";
    tableEl.style.left = "-9999px";
    tableEl.style.top = "0";
    tableEl.style.display = "block";
    tableEl.style.width = "900px";

    try {
      const canvas = await html2canvas(tableEl, {
        backgroundColor: "#111827",
        scale: 2,
      });
      const link = document.createElement("a");
      link.download = `leaderboard-${getDateString()}.jpg`;
      link.href = canvas.toDataURL("image/jpeg", 0.95);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Leaderboard downloaded as JPG");
    } catch (error) {
      toast.error("Failed to download leaderboard");
    } finally {
      tableEl.style.display = "none";
      tableEl.style.position = "";
      tableEl.style.left = "";
      tableEl.style.top = "";
      tableEl.style.width = "";
    }
  };

  // Sort teams by milestones completed (descending), then by total time (ascending)
  const sortedTeams = [...teams].sort((a, b) => {
    const aCompleted = a.milestones.filter((m) => m.completed).length;
    const bCompleted = b.milestones.filter((m) => m.completed).length;
    if (aCompleted !== bCompleted) return bCompleted - aCompleted;

    const aCompletedMilestones = a.milestones.filter((m) => m.completed && m.completedAt);
    const bCompletedMilestones = b.milestones.filter((m) => m.completed && m.completedAt);

    if (aCompletedMilestones.length > 0 && bCompletedMilestones.length > 0) {
      const aLatest = Math.max(...aCompletedMilestones.map((m) => new Date(m.completedAt!).getTime()));
      const bLatest = Math.max(...bCompletedMilestones.map((m) => new Date(m.completedAt!).getTime()));
      return aLatest - bLatest;
    }
    return parseInt(a.id) - parseInt(b.id);
  });

  return (
    <>
      <button
        onClick={handleDownloadJPG}
        disabled={isDisabled}
        className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors flex items-center gap-1"
        title={isDisabled ? "Download available after activity ends" : "Download leaderboard as JPG"}
      >
        <Download className="w-4 h-4" />
        Download JPG
      </button>

      {/* Hidden table rendered off-screen for JPG capture */}
      <div
        ref={tableRef}
        style={{ display: "none" }}
      >
        <div style={{ padding: "40px", background: "#111827", color: "#F9FAFB", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: "32px" }}>
            <h1 style={{ fontSize: "32px", fontWeight: "bold", background: "linear-gradient(to right, #60A5FA, #A78BFA)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: "8px" }}>
              🏆 Final Leaderboard
            </h1>
            <p style={{ color: "#F9FAFB", fontSize: "18px", fontWeight: "600", marginBottom: "8px" }}>
              {EVENT_TITLE}
            </p>
            <p style={{ color: "#9CA3AF", fontSize: "14px", marginBottom: "4px" }}>
              {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
            <p style={{ color: "#60A5FA", fontSize: "18px", fontWeight: "600" }}>
              Total Time: {formatTimerDuration(timerState.durationSeconds)}
            </p>
          </div>

          {/* Table */}
          <table style={{ width: "100%", borderCollapse: "collapse", background: "#1F2937", borderRadius: "12px", overflow: "hidden" }}>
            <thead>
              <tr style={{ background: "#374151" }}>
                <th style={{ padding: "14px 12px", textAlign: "center", color: "#D1D5DB", fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: "600" }}>
                  Rank
                </th>
                <th style={{ padding: "14px 12px", textAlign: "left", color: "#D1D5DB", fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: "600" }}>
                  Team
                </th>
                <th style={{ padding: "14px 12px", textAlign: "left", color: "#D1D5DB", fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: "600" }}>
                  Members
                </th>
                <th style={{ padding: "14px 12px", textAlign: "center", color: "#D1D5DB", fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: "600" }}>
                  Milestones
                </th>
                <th style={{ padding: "14px 12px", textAlign: "center", color: "#D1D5DB", fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: "600" }}>
                  Total Time
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedTeams.map((team, idx) => {
                const completedCount = team.milestones.filter((m) => m.completed).length;
                const totalMilestones = milestoneConfigs.length;
                const rank = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`;
                const memberNames = team.members.length > 0
                  ? team.members.map((m) => m.name).join(", ")
                  : "—";
                const timeStr = team.totalTime > 0 ? formatDuration(team.totalTime) : "—";

                return (
                  <tr key={team.id} style={{ borderBottom: "1px solid #374151" }}>
                    <td style={{ padding: "14px 12px", textAlign: "center", fontSize: "22px" }}>
                      {rank}
                    </td>
                    <td style={{ padding: "14px 12px", fontWeight: "bold", fontSize: "16px", textTransform: "capitalize", color: "#F9FAFB" }}>
                      {team.name}
                    </td>
                    <td style={{ padding: "14px 12px", fontSize: "13px", color: "#D1D5DB", maxWidth: "250px" }}>
                      {memberNames}
                    </td>
                    <td style={{ padding: "14px 12px", textAlign: "center", fontSize: "15px", fontWeight: "600", color: completedCount === totalMilestones ? "#34D399" : "#D1D5DB" }}>
                      {completedCount}/{totalMilestones}
                    </td>
                    <td style={{ padding: "14px 12px", textAlign: "center", fontSize: "15px", fontWeight: "600", color: "#34D399" }}>
                      {timeStr}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Footer */}
          <p style={{ textAlign: "center", marginTop: "24px", color: "#6B7280", fontSize: "12px" }}>
            {EVENT_TITLE}
          </p>
        </div>
      </div>
    </>
  );
};

export default ExportControls;
