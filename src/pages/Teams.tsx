import React, { useState, useMemo } from "react";
import {
  Plus,
  Users,
  Search,
  Upload,
  FileText,
  UserCheck,
  GraduationCap,
  Briefcase,
  X,
  Trash2,
  CloudUpload,
  Edit,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import { executeSyncLeaderboardTeamMembers, executeDeleteAllLeaderboardTeamMembers } from "@/lib/sync-leaderboard-team-members";
import { useTeams, type Team, type User } from "@/contexts/TeamsContext";
import { useMilestones } from "@/hooks/useMilestones";
import { useTimer } from "@/contexts/TimerContext";

interface ImportedDataRow {
  [key: string]: string | number | undefined;
  checked_in_at?: string;
  name?: string;
  email?: string;
  "Experience Level"?: string;
  "Professional Experience Level"?: string;
  experience_level?: string;
  experienceLevel?: string;
}


const Teams = () => {
  const { teams, setTeams } = useTeams();
  const { milestones: milestoneConfigs } = useMilestones();
  const { state: timerState } = useTimer();

  // Timer-based restrictions:
  // - running/expired: fully locked (no add, no delete, no import, no upload)
  // - paused: allow creating teams and uploading to supabase, but not file import or delete
  // - idle: fully editable
  const isTimerActive = timerState.status === "running" || timerState.status === "expired";
  const canAddTeams = timerState.status === "idle" || timerState.status === "paused";
  const canImportFile = timerState.status === "idle";
  const canDeleteTeams = timerState.status === "idle";

  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamDescription, setNewTeamDescription] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  
  // Manual team creation state
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualTeamMembers, setManualTeamMembers] = useState<User[]>([]);
  const [currentMemberName, setCurrentMemberName] = useState("");
  const [currentMemberEmail, setCurrentMemberEmail] = useState("");
  const [currentMemberExperience, setCurrentMemberExperience] = useState<"student" | "working professional">("student");
  
  // Import functionality state
  const [importedUsers, setImportedUsers] = useState<User[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [workingProfessionals, setWorkingProfessionals] = useState<User[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [showTeamGeneration, setShowTeamGeneration] = useState(false);
  
  // Team generation form state
  const [teamSize, setTeamSize] = useState(4);
  const [minWorkingProfessionals, setMinWorkingProfessionals] = useState(1);
  const [isSyncingToSupabase, setIsSyncingToSupabase] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Edit team state
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editMemberName, setEditMemberName] = useState("");
  const [editMemberEmail, setEditMemberEmail] = useState("");
  const [editMemberExperience, setEditMemberExperience] = useState<"student" | "working professional">("student");

  const canEditTeams = timerState.status === "idle" || timerState.status === "paused";

  const filteredAndSortedTeams = useMemo(() => {
    const filtered = teams.filter((team) => {
      if (!searchTerm.trim()) return true;
      
      const searchLower = searchTerm.toLowerCase().trim();
      const teamNameLower = team.name.toLowerCase();
      const descriptionLower = team.description?.toLowerCase() || '';
      
      // Check for exact team name match first
      if (teamNameLower === searchLower) return true;
      
      // Check for exact word matches in team name
      const teamWords = teamNameLower.split(/\s+/);
      const searchWords = searchLower.split(/\s+/);
      
      // If all search words are found as complete words in team name
      const allWordsMatch = searchWords.every(searchWord => 
        teamWords.some(teamWord => teamWord === searchWord)
      );
      
      if (allWordsMatch) return true;
      
      // Check description for exact word matches
      if (team.description) {
        const descWords = descriptionLower.split(/\s+/);
        const descWordsMatch = searchWords.every(searchWord => 
          descWords.some(descWord => descWord === searchWord)
        );
        if (descWordsMatch) return true;
      }
      
      return false;
    });

    return filtered.sort((a, b) => {
      // Extract numbers from team names for proper numerical sorting
      const getTeamNumber = (name: string) => {
        const match = name.match(/(\d+)/);
        return match ? parseInt(match[1]) : 0;
      };

      const aNumber = getTeamNumber(a.name);
      const bNumber = getTeamNumber(b.name);

      // If both have numbers, sort numerically
      if (aNumber > 0 && bNumber > 0) {
        return aNumber - bNumber;
      }

      // If only one has a number, prioritize it
      if (aNumber > 0 && bNumber === 0) return -1;
      if (bNumber > 0 && aNumber === 0) return 1;

      // If neither has numbers, sort alphabetically
      return a.name.localeCompare(b.name);
    });
  }, [teams, searchTerm]);

  // Live attendee stats computed from teams (always up-to-date)
  const liveStats = useMemo(() => {
    const allMembers = teams.flatMap((t) => t.members);
    const total = allMembers.length;
    const studentCount = allMembers.filter((m) => m.experienceLevel === "student").length;
    const wpCount = allMembers.filter((m) => m.experienceLevel === "working professional").length;
    return { total, studentCount, wpCount };
  }, [teams]);

  const addTeam = () => {
    if (newTeamName.trim()) {
      const newTeam: Team = {
        id: Date.now().toString(),
        name: newTeamName.trim(),
        description: newTeamDescription.trim() || undefined,
        members: [],
        milestones: milestoneConfigs.map((m) => ({ ...m, completed: false })),
        totalTime: 0,
      };
      setTeams([...teams, newTeam]);
      setNewTeamName("");
      setNewTeamDescription("");
    }
  };

  const deleteTeam = (teamId: string) => {
    setTeams(teams.filter((team) => team.id !== teamId));
  };

  // Edit team functions
  const addMemberToTeam = (teamId: string) => {
    if (!editMemberName.trim() || !editMemberEmail.trim()) return;
    const normalizedEmail = editMemberEmail.trim().toLowerCase();
    // Check if already in any team (including this one)
    for (const team of teams) {
      const found = team.members.find(
        (m) => m.email.trim().toLowerCase() === normalizedEmail
      );
      if (found) {
        toast.error(`Member already in "${team.name}"`, {
          description: `${editMemberEmail.trim()} is already assigned to ${team.name}.`,
        });
        return;
      }
    }
    const newMember: User = {
      name: editMemberName.trim(),
      email: editMemberEmail.trim(),
      experienceLevel: editMemberExperience,
    };
    setTeams((prev) =>
      prev.map((team) =>
        team.id === teamId
          ? { ...team, members: [...team.members, newMember] }
          : team
      )
    );
    setEditMemberName("");
    setEditMemberEmail("");
    setEditMemberExperience("student");
  };

  const removeMemberFromTeam = (teamId: string, memberIndex: number) => {
    setTeams((prev) =>
      prev.map((team) =>
        team.id === teamId
          ? { ...team, members: team.members.filter((_, i) => i !== memberIndex) }
          : team
      )
    );
  };

  // Manual team creation functions
  const findMemberInExistingTeams = (email: string): string | null => {
    const normalizedEmail = email.trim().toLowerCase();
    for (const team of teams) {
      const found = team.members.find(
        (m) => m.email.trim().toLowerCase() === normalizedEmail
      );
      if (found) return team.name;
    }
    return null;
  };

  const addMemberToManualTeam = () => {
    if (currentMemberName.trim() && currentMemberEmail.trim()) {
      // Check if already in another team
      const existingTeam = findMemberInExistingTeams(currentMemberEmail);
      if (existingTeam) {
        toast.error(`Member already in "${existingTeam}"`, {
          description: `${currentMemberEmail.trim()} is already assigned to ${existingTeam}.`,
        });
        return;
      }
      // Check if already added to current manual form
      const alreadyInForm = manualTeamMembers.find(
        (m) => m.email.trim().toLowerCase() === currentMemberEmail.trim().toLowerCase()
      );
      if (alreadyInForm) {
        toast.error("Duplicate member", {
          description: `${currentMemberEmail.trim()} is already added to this team.`,
        });
        return;
      }
      const newMember: User = {
        name: currentMemberName.trim(),
        email: currentMemberEmail.trim(),
        experienceLevel: currentMemberExperience,
      };
      setManualTeamMembers([...manualTeamMembers, newMember]);
      setCurrentMemberName("");
      setCurrentMemberEmail("");
      setCurrentMemberExperience("student");
    }
  };

  const removeMemberFromManualTeam = (index: number) => {
    setManualTeamMembers(manualTeamMembers.filter((_, i) => i !== index));
  };

  // Function to generate next available team name
  const generateNextTeamName = () => {
    const existingTeamNumbers = teams
      .map(team => {
        const match = team.name.match(/^Team\s+(\d+)$/i);
        return match ? parseInt(match[1]) : 0;
      })
      .filter(num => num > 0);
    
    const nextTeamNumber = existingTeamNumbers.length > 0 
      ? Math.max(...existingTeamNumbers) + 1 
      : 1;
    
    return `Team ${String(nextTeamNumber).padStart(2, "0")}`;
  };

  const createManualTeam = () => {
    if (newTeamName.trim() && manualTeamMembers.length > 0) {
      // Check for duplicate team name
      const duplicateTeam = teams.find(
        (t) => t.name.trim().toLowerCase() === newTeamName.trim().toLowerCase()
      );
      if (duplicateTeam) {
        toast.error("Duplicate team name", {
          description: `A team named "${duplicateTeam.name}" already exists.`,
        });
        return;
      }

      // Auto-generate description based on team members
      const workingProfCount = manualTeamMembers.filter(member => member.experienceLevel === 'working professional').length;
      const studentCount = manualTeamMembers.filter(member => member.experienceLevel === 'student').length;
      const autoGeneratedDescription = `Generated team with ${manualTeamMembers.length} members (${workingProfCount} working professionals, ${studentCount} students)`;
      
      const newTeam: Team = {
        id: Date.now().toString() + `-${teams.length + 1}`,
        name: newTeamName.trim(),
        description: autoGeneratedDescription,
        members: manualTeamMembers,
        milestones: milestoneConfigs.map((m) => ({ ...m, completed: false })),
        totalTime: 0,
      };
      setTeams([...teams, newTeam]);
      setNewTeamName("");
      setNewTeamDescription("");
      setManualTeamMembers([]);
      setShowManualForm(false);
    }
  };

  // File import and processing functions
  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    
    if (fileExtension === 'csv') {
      Papa.parse(file, {
        header: true,
        complete: (results) => {
          processImportedData(results.data as ImportedDataRow[]);
        },
        error: (error) => {
          console.error('CSV parsing error:', error);
          alert('Error parsing CSV file');
        }
      });
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          processImportedData(jsonData as ImportedDataRow[]);
        } catch (error) {
          console.error('XLSX parsing error:', error);
          alert('Error parsing Excel file');
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      alert('Please select a CSV or Excel file');
    }
  };

  const processImportedData = (data: ImportedDataRow[]) => {
    // Filter rows that have checked_in_at values
    const checkedInUsers = data.filter(row => 
      row.checked_in_at && 
      row.checked_in_at.trim() !== '' &&
      row.name && 
      row.email
    );

    // Process and categorize users
    const processedUsers: User[] = checkedInUsers.map((row, index) => {
      const experienceLevel = row['Experience Level'] || row.experience_level || row.experienceLevel || row['Professional Experience Level'];
      const isStudent = experienceLevel && 
        (experienceLevel.toLowerCase().includes('student') || 
         experienceLevel.toLowerCase().includes('undergraduate') ||
         experienceLevel.toLowerCase().includes('graduate'));

      return {
        name: String(row.name || row.Name || `User ${index + 1}`),
        email: String(row.email || row.Email || ''),
        experienceLevel: isStudent ? 'student' : 'working professional'
      };
    });

    // Group by experience level
    const studentUsers = processedUsers.filter(user => user.experienceLevel === 'student');
    const workingProfessionalUsers = processedUsers.filter(user => user.experienceLevel === 'working professional');

    setImportedUsers(processedUsers);
    setStudents(studentUsers);
    setWorkingProfessionals(workingProfessionalUsers);
    setTotalCount(processedUsers.length);
    setShowTeamGeneration(true);
  };

  const generateTeams = () => {
    if (teamSize < 2 || minWorkingProfessionals < 0 || minWorkingProfessionals >= teamSize) {
      alert('Invalid team configuration. Team size must be at least 2, and minimum working professionals must be less than team size.');
      return;
    }

    const totalUsers = students.length + workingProfessionals.length;
    const maxTeams = Math.floor(totalUsers / teamSize);
    
    if (maxTeams === 0) {
      alert('Not enough users to create teams with the specified size.');
      return;
    }

    // Calculate optimal distribution of working professionals
    const totalWorkingProfessionals = workingProfessionals.length;
    const totalStudents = students.length;
    
    // Calculate how many working professionals each team should have for equal distribution
    const workingProfPerTeam = Math.floor(totalWorkingProfessionals / maxTeams);
    const remainingWorkingProfs = totalWorkingProfessionals % maxTeams;
    
    // Check if we can meet the minimum requirement
    if (workingProfPerTeam < minWorkingProfessionals) {
      alert(`Cannot create balanced teams. With ${totalWorkingProfessionals} working professionals and ${maxTeams} teams, each team can have at most ${workingProfPerTeam} working professionals, but you require minimum ${minWorkingProfessionals}.`);
      return;
    }

    // Shuffle arrays to randomize team assignment
    const shuffledStudents = [...students].sort(() => Math.random() - 0.5);
    const shuffledWorkingProfessionals = [...workingProfessionals].sort(() => Math.random() - 0.5);

    const newTeams: Team[] = [];
    
    for (let i = 0; i < maxTeams; i++) {
      const teamMembers: User[] = [];
      
      // Calculate working professionals for this team
      let workingProfForThisTeam = workingProfPerTeam;
      if (i < remainingWorkingProfs) {
        workingProfForThisTeam += 1;
      }
      
      // Add working professionals to this team
      for (let j = 0; j < workingProfForThisTeam && shuffledWorkingProfessionals.length > 0; j++) {
        teamMembers.push(shuffledWorkingProfessionals.pop()!);
      }
      
      // Fill remaining slots with students
      const remainingSlots = teamSize - teamMembers.length;
      for (let j = 0; j < remainingSlots && shuffledStudents.length > 0; j++) {
        teamMembers.push(shuffledStudents.pop()!);
      }

      if (teamMembers.length > 0) {
        const workingProfCount = teamMembers.filter(member => member.experienceLevel === 'working professional').length;
        const studentCount = teamMembers.filter(member => member.experienceLevel === 'student').length;
        const newTeam: Team = {
          id: Date.now().toString() + `-${i + 1}`,
          name: `Team ${String(i + 1).padStart(2, "0")}`,
          description: `Generated team with ${teamMembers.length} members (${workingProfCount} working professionals, ${studentCount} students)`,
          members: teamMembers,
          milestones: milestoneConfigs.map((m) => ({ ...m, completed: false })),
          totalTime: 0,
        };
        newTeams.push(newTeam);
      }
    }

    // Distribute leftover members across teams (round-robin)
    const leftovers = [...shuffledStudents, ...shuffledWorkingProfessionals];
    if (leftovers.length > 0 && newTeams.length > 0) {
      leftovers.forEach((member, idx) => {
        const targetTeam = newTeams[idx % newTeams.length];
        targetTeam.members.push(member);
      });
      // Update descriptions to reflect actual member counts
      newTeams.forEach((team) => {
        const wpCount = team.members.filter(m => m.experienceLevel === 'working professional').length;
        const stCount = team.members.filter(m => m.experienceLevel === 'student').length;
        team.description = `Generated team with ${team.members.length} members (${wpCount} working professionals, ${stCount} students)`;
      });
      toast.success(`${leftovers.length} leftover member${leftovers.length !== 1 ? "s" : ""} distributed across teams`);
    }

    setTeams([...teams, ...newTeams]);
    setShowTeamGeneration(false);
  };

  const executeSyncTeamsToSupabase = async (): Promise<void> => {
    try {
      setIsSyncingToSupabase(true);
      const outcome = await executeSyncLeaderboardTeamMembers(teams);
      if (outcome.rowCount === 0) {
        toast.message("No one to upload yet", {
          description: "Add team members with a name and email, then try again.",
        });
        return;
      }
      toast.success("Teams synced to Supabase", {
        description: `Cleared previous data and uploaded ${outcome.rowCount} members across ${teams.length} teams.`,
      });
    } catch (err) {
      const message: string = err instanceof Error ? err.message : String(err);
      toast.error("Could not save online", { description: message });
    } finally {
      setIsSyncingToSupabase(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-blue-400" />
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                Teams Management
              </h1>
            </div>
            {canDeleteTeams && teams.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-red-600 text-red-400 hover:bg-red-900/30 hover:text-red-300"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete All Teams
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-gray-800 border-gray-700">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-white">
                      Delete All Teams
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-gray-400">
                      This will permanently remove all {teams.length} team{teams.length !== 1 ? "s" : ""} and their members. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600">
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={async () => {
                        setTeams([]);
                        setImportedUsers([]);
                        setStudents([]);
                        setWorkingProfessionals([]);
                        setTotalCount(0);
                        setShowTeamGeneration(false);
                        try {
                          await executeDeleteAllLeaderboardTeamMembers();
                          toast.success("Supabase cleared", {
                            description: "All team records removed from Supabase.",
                          });
                        } catch (err) {
                          const message = err instanceof Error ? err.message : String(err);
                          toast.error("Failed to clear Supabase", { description: message });
                        }
                      }}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Delete All
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
          <p className="text-gray-400 text-xl">
            Manage and track all your teams' progress
          </p>
        </div>

        {/* Timer active banner */}
        {isTimerActive && (
          <div className="mb-4 p-3 rounded-lg bg-yellow-900/20 border border-yellow-600/30 text-yellow-300 text-sm flex items-center gap-2">
            <Users className="w-4 h-4" />
            Team editing is disabled while the timer is running. Pause the timer to add new teams.
          </div>
        )}

        {/* Controls */}
        <div className="mb-8 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
            <Card className="bg-gray-800 border-gray-700 flex flex-col">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Import attendees
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 flex-1 flex flex-col">
                <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileImport}
                    className="hidden"
                    id="file-import"
                    disabled={!canImportFile}
                  />
                  <label
                    htmlFor="file-import"
                    className={`${canImportFile ? "cursor-pointer bg-blue-600 hover:bg-blue-700" : "cursor-not-allowed bg-blue-600/50"} text-white px-4 py-2 rounded-lg inline-flex items-center gap-2 transition-colors w-fit`}
                  >
                    <FileText className="w-4 h-4" />
                    Choose file
                  </label>
                  <span className="text-sm text-gray-400">
                    CSV, Excel (.xlsx, .xls)
                  </span>
                </div>
                <p className="text-sm text-gray-400">
                  Pull in your attendee list so you can divide people into teams.
                </p>
                {(totalCount > 0 || liveStats.total > 0) && (
                  <div className="space-y-2 mt-auto">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-gray-700 rounded-lg">
                      <div className="flex items-center gap-2">
                        <UserCheck className="w-5 h-5 text-blue-400 shrink-0" />
                        <div>
                          <div className="text-white font-medium">Total in Teams</div>
                          <div className="text-2xl font-bold text-blue-400">{liveStats.total}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <GraduationCap className="w-5 h-5 text-green-400 shrink-0" />
                        <div>
                          <div className="text-white font-medium">Students</div>
                          <div className="text-2xl font-bold text-green-400">{liveStats.studentCount}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Briefcase className="w-5 h-5 text-purple-400 shrink-0" />
                        <div>
                          <div className="text-white font-medium">Working professionals</div>
                          <div className="text-2xl font-bold text-purple-400">{liveStats.wpCount}</div>
                        </div>
                      </div>
                    </div>
                    {totalCount > 0 && liveStats.total > 0 && totalCount !== liveStats.total && (
                      <div className="text-xs space-y-1">
                        <p className="text-yellow-400">
                          ⚠️ {totalCount - liveStats.total} attendee{totalCount - liveStats.total !== 1 ? "s" : ""} from the imported list {totalCount - liveStats.total !== 1 ? "are" : "is"} not assigned to any team (imported: {totalCount}, in teams: {liveStats.total}).
                        </p>
                        <div className="max-h-32 overflow-y-auto bg-gray-800 rounded p-2 space-y-1">
                          {importedUsers
                            .filter((user) => {
                              const emailLower = user.email.trim().toLowerCase();
                              return !teams.some((team) =>
                                team.members.some((m) => m.email.trim().toLowerCase() === emailLower)
                              );
                            })
                            .map((user, idx) => (
                              <div key={idx} className="text-gray-300 text-xs flex items-center gap-2">
                                <span className="font-medium">{user.name}</span>
                                <span className="text-gray-500">({user.email})</span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-gray-700 flex flex-col">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <CloudUpload className="w-5 h-5" />
                  Save teams online
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 flex-1 flex flex-col">
                <p className="text-sm text-gray-400">
                  Upload your roster to the shared leader board list (names, emails, teams).
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={() => {
                      void executeSyncTeamsToSupabase();
                    }}
                    disabled={isSyncingToSupabase || !canAddTeams}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-60"
                  >
                    <CloudUpload className="w-4 h-4 mr-2" />
                    {isSyncingToSupabase ? "Uploading…" : "Upload teams"}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!canAddTeams}
                        className="border-red-600 text-red-400 hover:bg-red-900/30 hover:text-red-300 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Clear Database
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-gray-800 border-gray-700">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-white">
                          Clear Supabase Table
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-gray-400">
                          This will delete all records from the Supabase leaderboard table. Local teams will not be affected. This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600">
                          Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={async () => {
                            try {
                              await executeDeleteAllLeaderboardTeamMembers();
                              toast.success("Database cleared", {
                                description: "All records removed from Supabase table.",
                              });
                            } catch (err) {
                              const message = err instanceof Error ? err.message : String(err);
                              toast.error("Failed to clear database", { description: message });
                            }
                          }}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Clear All Records
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Team Generation Form */}
          {showTeamGeneration && (
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Generate Teams</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Number of persons in one team
                    </label>
                    <Input
                      type="number"
                      min="2"
                      value={teamSize}
                      onChange={(e) => setTeamSize(parseInt(e.target.value) || 4)}
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Minimum number of working professionals in one team
                    </label>
                    <Input
                      type="number"
                      min="0"
                      max={teamSize - 1}
                      value={minWorkingProfessionals}
                      onChange={(e) => setMinWorkingProfessionals(parseInt(e.target.value) || 1)}
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>
                </div>
                {/* Validation Info */}
                <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                  <h4 className="text-blue-400 font-medium mb-2">Balanced Team Distribution:</h4>
                  <ul className="text-sm text-blue-300 space-y-1">
                    <li>• Each team will have exactly {teamSize} members (+ leftovers distributed)</li>
                    <li>• Minimum {minWorkingProfessionals} working professional(s) per team</li>
                    <li>• Maximum {Math.floor((students.length + workingProfessionals.length) / teamSize)} teams can be created</li>
                    <li>• {(students.length + workingProfessionals.length) % teamSize} leftover member{(students.length + workingProfessionals.length) % teamSize !== 1 ? "s" : ""} will be distributed across teams</li>
                    <li>• All teams will be mixed (both students and working professionals)</li>
                  </ul>
                </div>

                {/* Preview Calculation */}
                {showPreview && (() => {
                  const total = students.length + workingProfessionals.length;
                  const maxT = Math.floor(total / teamSize);
                  const leftoverCount = total % teamSize;
                  const allUsers = [...students, ...workingProfessionals];
                  // Simulate: last N users would be leftovers (distributed round-robin)
                  const leftoverUsers = allUsers.slice(maxT * teamSize);
                  return (
                    <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-lg p-4 space-y-2">
                      <h4 className="text-yellow-400 font-medium text-sm">Preview Calculation:</h4>
                      <div className="text-sm text-yellow-300 space-y-1">
                        <p>• {maxT} teams × {teamSize} members = {maxT * teamSize} assigned directly</p>
                        <p>• {leftoverCount} leftover member{leftoverCount !== 1 ? "s" : ""} will be distributed across teams (some teams will have {teamSize + 1} members)</p>
                        <p>• <strong>Everyone will be assigned. No one is left out.</strong></p>
                      </div>
                      {leftoverCount > 0 && (
                        <div className="mt-2">
                          <p className="text-xs text-yellow-400 mb-1">Potential leftover members (randomized during generation):</p>
                          <div className="max-h-24 overflow-y-auto bg-gray-800 rounded p-2 space-y-0.5">
                            {leftoverUsers.map((u, idx) => (
                              <div key={idx} className="text-xs text-gray-300">
                                {u.name} <span className="text-gray-500">({u.email})</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div className="flex gap-2">
                  <Button
                    onClick={() => setShowPreview(!showPreview)}
                    variant="outline"
                    className="bg-yellow-600/20 border-yellow-600 text-yellow-300 hover:bg-yellow-600/30"
                  >
                    {showPreview ? "Hide Preview" : "Preview"}
                  </Button>
                  <Button
                    onClick={generateTeams}
                    disabled={!canImportFile}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Users className="w-4 h-4 mr-2" />
                    Generate Teams
                  </Button>
                  <Button
                    onClick={() => setShowTeamGeneration(false)}
                    variant="outline"
                    className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Manual Team Creation Section */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center justify-between">
                <span>Create Team Manually</span>
                <Button
                  onClick={() => {
                    if (!showManualForm) {
                      // Auto-populate team name when opening the form
                      setNewTeamName(generateNextTeamName());
                    }
                    setShowManualForm(!showManualForm);
                  }}
                  disabled={!canAddTeams || (totalCount === 0 && liveStats.total === 0)}
                  variant="outline"
                  size="sm"
                  className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600 hover:text-white"
                  title={totalCount === 0 && liveStats.total === 0 ? "Import attendees first" : undefined}
                >
                  {showManualForm ? "Cancel" : "Create Team"}
                </Button>
              </CardTitle>
            </CardHeader>
            {showManualForm && (
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <Input
                    placeholder="Team name..."
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                  />
                </div>
                
                {/* Add Member Form */}
                <div className="border border-gray-600 rounded-lg p-4 space-y-4">
                  <h4 className="text-white font-medium">Add Team Members</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Input
                      placeholder="Member name..."
                      value={currentMemberName}
                      onChange={(e) => setCurrentMemberName(e.target.value)}
                      className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                    />
                    <Input
                      placeholder="Member email..."
                      value={currentMemberEmail}
                      onChange={(e) => setCurrentMemberEmail(e.target.value)}
                      className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                    />
                    <select
                      value={currentMemberExperience}
                      onChange={(e) => setCurrentMemberExperience(e.target.value as "student" | "working professional")}
                      className="bg-gray-700 border border-gray-600 text-white rounded-md px-3 py-2"
                    >
                      <option value="student">Student</option>
                      <option value="working professional">Working Professional</option>
                    </select>
                  </div>
                  <Button
                    onClick={addMemberToManualTeam}
                    className="bg-green-600 hover:bg-green-700"
                    disabled={!currentMemberName.trim() || !currentMemberEmail.trim()}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Member
                  </Button>
                </div>

                {/* Current Members List */}
                {manualTeamMembers.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-white font-medium">Team Members ({manualTeamMembers.length})</h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {manualTeamMembers.map((member, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-gray-700 rounded-lg">
                          <div className="flex-1">
                            <div className="text-sm font-medium text-white">{member.name}</div>
                            <div className="text-xs text-gray-400">{member.email}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className={`p-1.5 rounded-full cursor-help relative z-50 ${
                                    member.experienceLevel === 'student' 
                                      ? 'bg-green-600 text-white hover:bg-green-500' 
                                      : 'bg-purple-600 text-white hover:bg-purple-500'
                                  }`}>
                                    {member.experienceLevel === 'student' ? (
                                      <GraduationCap className="w-4 h-4" />
                                    ) : (
                                      <Briefcase className="w-4 h-4" />
                                    )}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent 
                                  className="z-[9999] relative" 
                                  side="left"
                                  align="center"
                                  sideOffset={5}
                                >
                                  <p className="capitalize">{member.experienceLevel}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <Button
                              onClick={() => removeMemberFromManualTeam(index)}
                              variant="ghost"
                              size="sm"
                              className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={createManualTeam}
                    className="bg-blue-600 hover:bg-blue-700 text-white hover:text-white"
                    disabled={!newTeamName.trim() || manualTeamMembers.length === 0}
                  >
                    <Users className="w-4 h-4 mr-2" />
                    Create Team
                  </Button>
                  <Button
                    onClick={() => {
                      setShowManualForm(false);
                      setNewTeamName("");
                      setNewTeamDescription("");
                      setManualTeamMembers([]);
                    }}
                    variant="outline"
                    className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600 hover:text-white"
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Search */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search teams..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-gray-700 border-gray-600 text-white placeholder-gray-400"
              />
            </div>
          </div>
        </div>

        {/* Teams Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAndSortedTeams.map((team) => (
            <Card
              key={team.id}
              className="bg-gray-800 border-gray-700 hover:border-gray-600 transition-all duration-200 transform hover:scale-105 relative z-10"
            >
              <CardHeader className="pb-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-xl font-bold text-white capitalize mb-1">
                      {team.name}
                    </CardTitle>
                      {team.description && (
                        <p className="text-sm text-gray-400 mb-2">
                          {team.description}
                        </p>
                      )}
                  </div>
                  <div className="flex items-center gap-1">
                    {canEditTeams && (
                      <Button
                        onClick={() => setEditingTeamId(editingTeamId === team.id ? null : team.id)}
                        variant="ghost"
                        size="sm"
                        className={editingTeamId === team.id
                          ? "text-green-400 hover:text-green-300 hover:bg-green-900/20"
                          : "text-blue-400 hover:text-blue-300 hover:bg-blue-900/20"
                        }
                        title={editingTeamId === team.id ? "Done Editing" : "Edit Team"}
                      >
                        {editingTeamId === team.id ? <Check className="w-4 h-4" /> : <Edit className="w-4 h-4" />}
                      </Button>
                    )}
                    <Button
                      onClick={() => deleteTeam(team.id)}
                      disabled={!canDeleteTeams}
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:text-red-300 hover:bg-red-900/20 disabled:opacity-30 disabled:cursor-not-allowed"
                      title={canDeleteTeams ? "Delete Team" : "Cannot delete while timer is active"}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <hr className="my-3 border-gray-700" />
                
                {/* Team Stats */}
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">Members</span>
                  <span className="text-white font-medium">
                    {team.members.length} member{team.members.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </CardHeader>
                <CardContent className="space-y-3 overflow-visible">
                {/* Team Members */}
                {team.members && team.members.length > 0 ? (
                  <div className="space-y-2 overflow-visible">
                    <div className="text-sm font-medium text-gray-300 mb-2">Team Members</div>
                    {team.members.map((member, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 bg-gray-700/50 rounded-lg overflow-visible">
                        <div className="flex-1">
                          <div className="text-sm font-medium text-white">{member.name}</div>
                          <div className="text-xs text-gray-400">{member.email}</div>
                        </div>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className={`p-1.5 rounded-full cursor-help relative z-50 ${
                                member.experienceLevel === 'student' 
                                  ? 'bg-green-600 text-white hover:bg-green-500' 
                                  : 'bg-purple-600 text-white hover:bg-purple-500'
                              }`}>
                                {member.experienceLevel === 'student' ? (
                                  <GraduationCap className="w-4 h-4" />
                                ) : (
                                  <Briefcase className="w-4 h-4" />
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent 
                              className="z-[9999] relative" 
                              side="left"
                              align="center"
                              sideOffset={5}
                            >
                              <p className="capitalize">{member.experienceLevel}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        {editingTeamId === team.id && (
                          <Button
                            onClick={() => removeMemberFromTeam(team.id, index)}
                            variant="ghost"
                            size="sm"
                            className="text-red-400 hover:text-red-300 hover:bg-red-900/20 p-1 h-auto"
                            title="Remove member"
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-gray-400">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No members added yet</p>
                  </div>
                )}

                {/* Add Member Form (when editing) */}
                {editingTeamId === team.id && (
                  <div className="mt-3 p-3 border border-gray-600 rounded-lg space-y-2">
                    <div className="text-xs font-medium text-gray-300">Add Member</div>
                    <Input
                      placeholder="Name"
                      value={editMemberName}
                      onChange={(e) => setEditMemberName(e.target.value)}
                      className="bg-gray-700 border-gray-600 text-white placeholder-gray-400 text-sm"
                    />
                    <Input
                      placeholder="Email"
                      value={editMemberEmail}
                      onChange={(e) => setEditMemberEmail(e.target.value)}
                      className="bg-gray-700 border-gray-600 text-white placeholder-gray-400 text-sm"
                    />
                    <select
                      value={editMemberExperience}
                      onChange={(e) => setEditMemberExperience(e.target.value as "student" | "working professional")}
                      className="w-full bg-gray-700 border border-gray-600 text-white rounded-md px-3 py-2 text-sm"
                    >
                      <option value="student">Student</option>
                      <option value="working professional">Working Professional</option>
                    </select>
                    <Button
                      onClick={() => addMemberToTeam(team.id)}
                      disabled={!editMemberName.trim() || !editMemberEmail.trim()}
                      size="sm"
                      className="w-full bg-green-600 hover:bg-green-700"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Add Member
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {filteredAndSortedTeams.length === 0 && (
          <div className="text-center py-16 flex flex-col items-center">
            <Users className="w-16 h-16 text-gray-600 mb-4" />
            <div className="text-gray-400 text-lg mb-2">
              {searchTerm ? "No teams found" : "No teams added yet"}
            </div>
            <p className="text-gray-500">
              {searchTerm 
                ? "Try adjusting your search criteria" 
                : "Create your first team to get started!"
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Teams;
