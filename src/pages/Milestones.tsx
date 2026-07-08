import React, { useState } from "react";
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Edit,
  Check,
  X,
  Target,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMilestones } from "@/hooks/useMilestones";
import { useTeams } from "@/contexts/TeamsContext";
import { useTimer } from "@/contexts/TimerContext";

const Milestones = () => {
  const {
    milestones,
    addMilestone,
    removeMilestone,
    reorderMilestones,
    renameMilestone,
    clearMilestones,
  } = useMilestones();
  const { setTeams } = useTeams();
  const { state: timerState } = useTimer();

  // Milestones are read-only once the timer has been started
  const isReadOnly = timerState.status !== "idle";

  // Add milestone form state
  const [newTitle, setNewTitle] = useState("");
  const [newSubtitle, setNewSubtitle] = useState("");
  const [addError, setAddError] = useState("");

  // Inline edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSubtitle, setEditSubtitle] = useState("");
  const [editError, setEditError] = useState("");

  const handleAddMilestone = () => {
    const trimmedTitle = newTitle.trim();
    if (!trimmedTitle) {
      setAddError("Title is required");
      return;
    }
    setAddError("");

    addMilestone(trimmedTitle, newSubtitle.trim());

    const maxId = milestones.reduce((max, m) => Math.max(max, m.id), 0);
    const newId = maxId + 1;

    setTeams((prev) =>
      prev.map((team) => ({
        ...team,
        milestones: [
          ...team.milestones,
          {
            id: newId,
            title: trimmedTitle,
            subtitle: newSubtitle.trim(),
            completed: false,
          },
        ],
      }))
    );

    setNewTitle("");
    setNewSubtitle("");
  };

  const handleRemoveMilestone = (id: number) => {
    removeMilestone(id);

    setTeams((prev) =>
      prev.map((team) => {
        const updatedMilestones = team.milestones.filter((m) => m.id !== id);
        const allCompleted =
          updatedMilestones.length > 0 &&
          updatedMilestones.every((m) => m.completed);
        return {
          ...team,
          milestones: updatedMilestones,
          totalTime: allCompleted ? team.totalTime : 0,
        };
      })
    );
  };

  const handleMoveUp = (index: number) => {
    if (index > 0) {
      reorderMilestones(index, index - 1);
    }
  };

  const handleMoveDown = (index: number) => {
    if (index < milestones.length - 1) {
      reorderMilestones(index, index + 1);
    }
  };

  const startEditing = (id: number, title: string, subtitle: string) => {
    setEditingId(id);
    setEditTitle(title);
    setEditSubtitle(subtitle);
    setEditError("");
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditTitle("");
    setEditSubtitle("");
    setEditError("");
  };

  const saveEditing = () => {
    const trimmedTitle = editTitle.trim();
    if (!trimmedTitle) {
      setEditError("Title is required");
      return;
    }
    if (editingId === null) return;

    setEditError("");
    renameMilestone(editingId, trimmedTitle, editSubtitle.trim());

    setTeams((prev) =>
      prev.map((team) => ({
        ...team,
        milestones: team.milestones.map((m) =>
          m.id === editingId
            ? { ...m, title: trimmedTitle, subtitle: editSubtitle.trim() }
            : m
        ),
      }))
    );

    setEditingId(null);
    setEditTitle("");
    setEditSubtitle("");
  };

  const handleClearAll = () => {
    clearMilestones();
    // Also clear milestones from all teams
    setTeams((prev) =>
      prev.map((team) => ({
        ...team,
        milestones: [],
        totalTime: 0,
      }))
    );
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Target className="w-8 h-8 text-blue-400" />
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                Milestones
              </h1>
            </div>
            {!isReadOnly && milestones.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-red-600 text-red-400 hover:bg-red-900/30 hover:text-red-300"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Clear All
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-gray-800 border-gray-700">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-white">
                      Clear All Milestones
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-gray-400">
                      This will remove all milestones and clear them from all teams. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600">
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleClearAll}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Clear All
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
          <p className="text-gray-400 text-xl">
            {isReadOnly
              ? "Milestones cannot be edited while the timer is active."
              : "Define the milestones teams need to complete during the activity."}
          </p>
        </div>

        {/* Milestone List */}
        <div className="space-y-3 mb-8">
          {milestones.length === 0 ? (
            <div className="text-center py-16 flex flex-col items-center">
              <Target className="w-16 h-16 text-gray-600 mb-4" />
              <div className="text-gray-400 text-lg mb-2">No milestones defined</div>
              <p className="text-gray-500">Add your first milestone below to get started.</p>
            </div>
          ) : (
            milestones.map((milestone, index) => (
              <Card
                key={milestone.id}
                className="bg-gray-800 border-gray-700"
              >
                <CardContent className="p-4">
                  {editingId === milestone.id && !isReadOnly ? (
                    <div className="space-y-3">
                      <Input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="Title"
                        className="bg-gray-700 border-gray-600 text-white"
                      />
                      <Input
                        value={editSubtitle}
                        onChange={(e) => setEditSubtitle(e.target.value)}
                        placeholder="Subtitle (optional)"
                        className="bg-gray-700 border-gray-600 text-white"
                      />
                      {editError && (
                        <p className="text-red-400 text-xs">{editError}</p>
                      )}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={saveEditing}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <Check className="w-3 h-3 mr-1" />
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={cancelEditing}
                          className="border-gray-600 text-gray-300 hover:bg-gray-700"
                        >
                          <X className="w-3 h-3 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="text-sm font-mono text-gray-500 w-6 text-center flex-shrink-0">
                          {index + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-white truncate">
                            {milestone.title}
                          </div>
                          {milestone.subtitle && (
                            <div className="text-sm text-gray-400 truncate">
                              {milestone.subtitle}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => handleMoveUp(index)}
                          disabled={isReadOnly || index === 0 || milestones.length < 2}
                          className="p-1.5 rounded hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Move up"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleMoveDown(index)}
                          disabled={isReadOnly || index === milestones.length - 1 || milestones.length < 2}
                          className="p-1.5 rounded hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Move down"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => startEditing(milestone.id, milestone.title, milestone.subtitle)}
                          disabled={isReadOnly}
                          className="p-1.5 rounded hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Edit milestone"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button
                              disabled={isReadOnly}
                              className="p-1.5 rounded hover:bg-red-900/50 text-red-400 disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Remove milestone"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-gray-800 border-gray-700">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-white">
                                Remove Milestone
                              </AlertDialogTitle>
                              <AlertDialogDescription className="text-gray-400">
                                Are you sure you want to remove &quot;{milestone.title}&quot;? This will also remove it from all existing teams.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600">
                                Cancel
                              </AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleRemoveMilestone(milestone.id)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Remove
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Add Milestone Form */}
        {!isReadOnly && (
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Add New Milestone
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Title *"
                className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-500"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddMilestone();
                }}
              />
              <Input
                value={newSubtitle}
                onChange={(e) => setNewSubtitle(e.target.value)}
                placeholder="Subtitle (optional)"
                className="bg-gray-700 border-gray-600 text-white placeholder:text-gray-500"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddMilestone();
                }}
              />
              {addError && <p className="text-red-400 text-xs">{addError}</p>}
              <Button
                onClick={handleAddMilestone}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Milestone
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Milestones;
