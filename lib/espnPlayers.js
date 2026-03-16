// ESPN tournament player fetching and ranking logic

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball";

async function fetchJSON(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

/**
 * Discover all tournament teams from the ESPN scoreboard.
 * Fetches first-round dates to find all 68 teams with their seeds.
 * Returns: [{ teamId, teamName, seed, abbrev }]
 */
export async function discoverTournamentTeams() {
  // Check multiple tournament dates to maximize discovery
  const tournamentDates = [
    "20260317", "20260318", "20260319", "20260320",
    "20260321", "20260322", "20260323",
  ];

  const teamsMap = new Map();

  const results = await Promise.allSettled(
    tournamentDates.map((date) =>
      fetchJSON(`${ESPN_BASE}/scoreboard?groups=100&dates=${date}&limit=100`)
    )
  );

  for (const r of results) {
    if (r.status !== "fulfilled" || !r.value?.events) continue;
    for (const event of r.value.events) {
      const comp = event.competitions?.[0];
      if (!comp) continue;
      for (const competitor of comp.competitors || []) {
        const team = competitor.team;
        if (!team?.id || teamsMap.has(team.id)) continue;
        const seed = parseInt(competitor.curatedRank?.current, 10)
          || parseInt(competitor.seed, 10)
          || 16;
        teamsMap.set(team.id, {
          teamId: team.id,
          teamName: team.displayName || team.name,
          abbrev: team.abbreviation || "",
          seed: isNaN(seed) ? 16 : seed,
        });
      }
    }
  }

  return Array.from(teamsMap.values());
}

/**
 * Fetch roster for a single ESPN team.
 * Returns: [{ id, name, position, jersey, experience }]
 */
export async function fetchTeamRoster(teamId) {
  const data = await fetchJSON(`${ESPN_BASE}/teams/${teamId}/roster`);
  const athletes = data?.athletes || [];
  return athletes.map((a) => ({
    id: a.id,
    name: a.fullName || a.displayName || `${a.firstName} ${a.lastName}`,
    position: a.position?.displayName || a.position?.abbreviation || "Unknown",
    jersey: a.jersey || "",
    experience: a.experience?.displayValue || "Unknown",
  }));
}

/**
 * Compute auto-pick ranking score for a player.
 * Lower score = better player (picked first in auto-pick).
 * Ranking: team seed (1-seeds first) + experience (seniors first).
 */
export function computeRankingScore(teamSeed, experience, playerIndex) {
  const seedScore = teamSeed * 1000;
  const expMap = {
    Senior: 0,
    Junior: 100,
    Sophomore: 200,
    Freshman: 300,
    Unknown: 400,
  };
  const expScore = expMap[experience] ?? 400;
  // Small tiebreaker by roster position
  const tiebreaker = Math.min(playerIndex, 99);
  return seedScore + expScore + tiebreaker;
}

/**
 * Fetch per-player season statistics for a team.
 * Returns a Map of athleteId -> { ppg }
 */
export async function fetchTeamPlayerStats(teamId) {
  const stats = new Map();
  try {
    const data = await fetchJSON(`${ESPN_BASE}/teams/${teamId}/statistics`);
    const categories = data?.splits?.categories || [];
    for (const cat of categories) {
      if (cat.name !== "general") continue;
      for (const athlete of cat.athletes || []) {
        const id = athlete.athlete?.id;
        if (!id) continue;
        // Find points per game in the stats array
        const statNames = cat.stats?.map((s) => s.abbreviation || s.name) || [];
        const ppgIdx = statNames.findIndex(
          (n) => n === "PTS" || n === "PPG" || n?.toLowerCase() === "pts"
        );
        const ppg = ppgIdx >= 0 ? parseFloat(athlete.stats?.[ppgIdx]) || 0 : 0;
        stats.set(id, { ppg });
      }
    }
  } catch (e) {
    // Stats not available for this team
  }
  return stats;
}

/**
 * Fetch injury report for a team.
 * Returns a Map of athleteId -> { status, description }
 */
export async function fetchTeamInjuries(teamId) {
  const injuries = new Map();
  try {
    const data = await fetchJSON(`${ESPN_BASE}/teams/${teamId}/injuries`);
    for (const item of data?.items || []) {
      const id = item.athlete?.id;
      if (!id) continue;
      injuries.set(id, {
        injuryStatus: item.status || item.type?.abbreviation || "OUT",
        injuryDesc: item.details?.detail || item.shortComment || "",
      });
    }
  } catch (e) {
    // Injuries endpoint not available
  }
  return injuries;
}

/**
 * Fetch all tournament players with rankings, PPG, and injury status.
 * Returns: [{ id, name, team, teamId, position, seed, experience, rankScore, ppg, injuryStatus, injuryDesc }]
 */
export async function fetchAllTournamentPlayers() {
  const teams = await discoverTournamentTeams();
  if (teams.length === 0) {
    throw new Error("No tournament teams found. The bracket may not be available yet.");
  }

  const allPlayers = [];
  const BATCH_SIZE = 10;

  for (let i = 0; i < teams.length; i += BATCH_SIZE) {
    const batch = teams.slice(i, i + BATCH_SIZE);
    const [rosterResults, statsResults, injuryResults] = await Promise.all([
      Promise.allSettled(batch.map((t) => fetchTeamRoster(t.teamId))),
      Promise.allSettled(batch.map((t) => fetchTeamPlayerStats(t.teamId))),
      Promise.allSettled(batch.map((t) => fetchTeamInjuries(t.teamId))),
    ]);

    for (let j = 0; j < rosterResults.length; j++) {
      const r = rosterResults[j];
      const team = batch[j];
      if (r.status !== "fulfilled") continue;

      const statsMap =
        statsResults[j]?.status === "fulfilled" ? statsResults[j].value : new Map();
      const injuryMap =
        injuryResults[j]?.status === "fulfilled" ? injuryResults[j].value : new Map();

      r.value.forEach((player, idx) => {
        const stat = statsMap.get(player.id) || {};
        const injury = injuryMap.get(player.id) || {};
        allPlayers.push({
          id: player.id,
          name: player.name,
          team: team.teamName,
          teamId: team.teamId,
          abbrev: team.abbrev,
          position: player.position,
          seed: team.seed,
          experience: player.experience,
          rankScore: computeRankingScore(team.seed, player.experience, idx),
          ppg: stat.ppg || 0,
          injuryStatus: injury.injuryStatus || "",
          injuryDesc: injury.injuryDesc || "",
        });
      });
    }
  }

  // Sort by ranking score (best first)
  allPlayers.sort((a, b) => a.rankScore - b.rankScore);
  return allPlayers;
}
