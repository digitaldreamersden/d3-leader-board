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
import { executeSyncLeaderboardTeamMembers } from "@/lib/sync-leaderboard-team-members";


interface User {
  name: string;
  email: string;
  experienceLevel: "student" | "working professional";
}

interface ImportedDataRow {
  [key: string]: string | number | undefined;
  checked_in_at?: string;
  name?: string;
  email?: string;
  "Experience Level"?: string;
  experience_level?: string;
  experienceLevel?: string;
}

interface Team {
  id: string;
  name: string;
  description?: string;
  members: User[];
}


const Teams = () => {
  const [teams, setTeams] = useState<Team[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("teams");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          return parsed.map((team: Team) => ({
            ...team,
            members: team.members || [],
          }));
        } catch {
          return [];
        }
      }
    }
    return [];
  });

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

  // Persist teams to localStorage whenever it changes
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("teams", JSON.stringify(teams));
    }
  }, [teams]);

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

  const addTeam = () => {
    if (newTeamName.trim()) {
      const newTeam: Team = {
        id: Date.now().toString(),
        name: newTeamName.trim(),
        description: newTeamDescription.trim() || undefined,
        members: [],
      };
      setTeams([...teams, newTeam]);
      setNewTeamName("");
      setNewTeamDescription("");
    }
  };

  const deleteTeam = (teamId: string) => {
    setTeams(teams.filter((team) => team.id !== teamId));
  };

  // Manual team creation functions
  const addMemberToManualTeam = () => {
    if (currentMemberName.trim() && currentMemberEmail.trim()) {
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
    
    return `Team ${nextTeamNumber}`;
  };

  const createManualTeam = () => {
    if (newTeamName.trim() && manualTeamMembers.length > 0) {
      // Auto-generate description based on team members
      const workingProfCount = manualTeamMembers.filter(member => member.experienceLevel === 'working professional').length;
      const studentCount = manualTeamMembers.filter(member => member.experienceLevel === 'student').length;
      const autoGeneratedDescription = `Generated team with ${manualTeamMembers.length} members (${workingProfCount} working professionals, ${studentCount} students)`;
      
      const newTeam: Team = {
        id: `Date.now().toString()` + `${teams.length + 1}`,
        name: newTeamName.trim(),
        description: autoGeneratedDescription,
        members: manualTeamMembers,
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
      const experienceLevel = row['Experience Level'] || row.experience_level || row.experienceLevel;
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

    // Check if we have enough students for the remaining slots
    const studentsNeeded = maxTeams * teamSize - totalWorkingProfessionals;
    if (totalStudents < studentsNeeded) {
      alert(`Not enough students. You need ${studentsNeeded} students to fill the remaining slots after assigning working professionals.`);
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
      // Distribute remaining working professionals to first few teams
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

      // Validate team composition
      const workingProfCount = teamMembers.filter(member => member.experienceLevel === 'working professional').length;
      const studentCount = teamMembers.filter(member => member.experienceLevel === 'student').length;
      
      // Ensure team meets minimum working professional requirement
      if (workingProfCount < minWorkingProfessionals) {
        alert(`Unable to create team ${i + 1} with minimum ${minWorkingProfessionals} working professionals. Not enough working professionals available.`);
        return;
      }

      // Ensure team is mixed (not all students or all working professionals)
      if (studentCount === 0 || workingProfCount === 0) {
        alert(`Unable to create mixed team ${i + 1}. Need both students and working professionals for proper team composition.`);
        return;
      }

      if (teamMembers.length > 0) {
        const newTeam: Team = {
          id: Date.now().toString() + `-${i + 1}`,
          name: `Team ${i + 1}`,
          description: `Generated team with ${teamMembers.length} members (${workingProfCount} working professionals, ${studentCount} students)`,
          members: teamMembers
        };
        newTeams.push(newTeam);
      }
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
      toast.success("Teams saved online", {
        description: `Uploaded ${outcome.rowCount} people from your teams.`,
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
          <div className="flex items-center gap-3 mb-4">
            <Users className="w-8 h-8 text-blue-400" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              Teams Management
            </h1>
          </div>
          <p className="text-gray-400 text-xl">
            Manage and track all your teams' progress
          </p>
        </div>

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
                  />
                  <label
                    htmlFor="file-import"
                    className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg inline-flex items-center gap-2 transition-colors w-fit"
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
                {totalCount > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-gray-700 rounded-lg mt-auto">
                    <div className="flex items-center gap-2">
                      <UserCheck className="w-5 h-5 text-blue-400 shrink-0" />
                      <div>
                        <div className="text-white font-medium">Total</div>
                        <div className="text-2xl font-bold text-blue-400">{totalCount}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <GraduationCap className="w-5 h-5 text-green-400 shrink-0" />
                      <div>
                        <div className="text-white font-medium">Students</div>
                        <div className="text-2xl font-bold text-green-400">{students.length}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Briefcase className="w-5 h-5 text-purple-400 shrink-0" />
                      <div>
                        <div className="text-white font-medium">Working professionals</div>
                        <div className="text-2xl font-bold text-purple-400">{workingProfessionals.length}</div>
                      </div>
                    </div>
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
                <Button
                  type="button"
                  onClick={() => {
                    void executeSyncTeamsToSupabase();
                  }}
                  disabled={isSyncingToSupabase}
                  className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-60 self-start"
                >
                  <CloudUpload className="w-4 h-4 mr-2" />
                  {isSyncingToSupabase ? "Uploading…" : "Upload teams"}
                </Button>
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
                    <li>• Each team will have exactly {teamSize} members</li>
                    <li>• Minimum {minWorkingProfessionals} working professional(s) per team</li>
                    <li>• Maximum {Math.floor((students.length + workingProfessionals.length) / teamSize)} teams can be created</li>
                    <li>• Equal distribution: {Math.floor(workingProfessionals.length / Math.floor((students.length + workingProfessionals.length) / teamSize))} working professionals per team</li>
                    <li>• {workingProfessionals.length % Math.floor((students.length + workingProfessionals.length) / teamSize)} team(s) will have 1 extra working professional</li>
                    <li>• All teams will be mixed (both students and working professionals)</li>
                  </ul>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={generateTeams}
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
                  variant="outline"
                  size="sm"
                  className="bg-gray-700 border-gray-600 text-white hover:bg-gray-600 hover:text-white"
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
                  <Button
                    onClick={() => deleteTeam(team.id)}
                    variant="ghost"
                    size="sm"
                    className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                    title="Delete Team"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
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
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-gray-400">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No members added yet</p>
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
