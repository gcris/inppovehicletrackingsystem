// src/components/TeamManagement.tsx
import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

interface Team {
  id: string;
  team_name: string;
  unit_id: string | null;
  description?: string;
  created_at: string;
}

interface TeamMember {
  id: string;
  team_id: string;
  personnel_id: string;
  is_team_leader: boolean;
  created_at: string;
}

const TeamManagement: React.FC = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [newTeamName, setNewTeamName] = useState("");
  const [newUnitId, setNewUnitId] = useState("");
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [newPersonnelId, setNewPersonnelId] = useState("");
  const [newIsTeamLeader, setIsTeamLeader] = useState(false);

  useEffect(() => {
    fetchTeams();
    fetchTeamMembers();
  }, []);

  const fetchTeams = async () => {
    const { data: teams, error } = await supabase.from("teams").select("*");
    if (error) throw error;
    setTeams(teams as Team[]);
  };

  const fetchTeamMembers = async () => {
    const { data: teamMembers, error } = await supabase
      .from("team_members")
      .select("*");
    if (error) throw error;
    setTeamMembers(teamMembers as TeamMember[]);
  };

  const createTeam = async () => {
    const { error } = await supabase
      .from("teams")
      .insert([{ team_name: newTeamName, unit_id: newUnitId }]);
    if (error) throw error;
    fetchTeams();
    setNewTeamName("");
    setNewUnitId("");
  };

  const deleteTeam = async (teamId: string) => {
    const { error } = await supabase.from("teams").delete().eq("id", teamId);
    if (error) throw error;
    fetchTeams();
  };

  const createTeamMember = async () => {
    const { error } = await supabase.from("team_members").insert([
      {
        team_id: selectedTeam?.id,
        personnel_id: newPersonnelId,
        is_team_leader: newIsTeamLeader,
      },
    ]);
    if (error) throw error;
    fetchTeamMembers();
    setSelectedTeam(null);
    setNewPersonnelId("");
    setIsTeamLeader(false);
  };

  const filteredTeams = teams.filter((team) =>
    team.team_name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div>
      <h1>Team Management</h1>

      {/* Search Bar */}
      <div style={{ marginBottom: "20px" }}>
        <input
          type="text"
          placeholder="Search teams..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            padding: "8px",
            width: "300px",
            border: "1px solid #ccc",
            borderRadius: "4px",
          }}
        />
      </div>

      {/* Add New Button */}
      <button
        onClick={() => setSelectedTeam(null)}
        style={{
          margin: "20px 0",
          padding: "8px 16px",
          backgroundColor: "#007bff",
          color: "#fff",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
        }}
      >
        Add New Team
      </button>

      {/* Create Team Form */}
      {selectedTeam === null ? (
        <div>
          <h2>Create Team</h2>
          <input
            type="text"
            placeholder="Team Name"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
          />
          <input
            type="text"
            placeholder="Unit ID"
            value={newUnitId}
            onChange={(e) => setNewUnitId(e.target.value)}
          />
          <button onClick={createTeam}>Create Team</button>
        </div>
      ) : (
        <div>
          <h2>Create Team Member for {selectedTeam.team_name}</h2>
          <input
            type="text"
            placeholder="Personnel ID"
            value={newPersonnelId}
            onChange={(e) => setNewPersonnelId(e.target.value)}
          />
          <label>
            Is Team Leader:
            <input
              type="checkbox"
              checked={newIsTeamLeader}
              onChange={(e) => setIsTeamLeader(e.target.checked)}
            />
          </label>
          <button onClick={createTeamMember}>Create Team Member</button>
        </div>
      )}

      {/* List Teams */}
      <h2>Teams</h2>
      <ul>
        {filteredTeams.map((team) => (
          <li key={team.id}>
            {team.team_name}
            <button onClick={() => setSelectedTeam(team)}>
              Select for Members
            </button>
            <button onClick={() => deleteTeam(team.id)}>Delete</button>
          </li>
        ))}
      </ul>

      {/* List Team Members */}
      <h2>Team Members</h2>
      <ul>
        {teamMembers.map((member) => (
          <li key={member.id}>
            {member.personnel_id}
            {member.is_team_leader ? " (Leader)" : ""}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TeamManagement;
