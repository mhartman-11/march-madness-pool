// ESPN tournament player fetching and ranking logic

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball";
const ESPN_WEB_BASE = "https://site.web.api.espn.com/apis/common/v3/sports/basketball/mens-college-basketball";

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
    id: String(a.id),
    name: a.fullName || a.displayName || `${a.firstName} ${a.lastName}`,
    position: a.position?.displayName || a.position?.abbreviation || "Unknown",
    jersey: a.jersey || "",
    experience: a.experience?.displayValue || "Unknown",
  }));
}

/**
 * Compute auto-pick ranking score for a player.
 * Lower score = better player (picked first in auto-pick).
 * Ranking: team seed (1-seeds first), then PPG (higher first), then experience.
 */
export function computeRankingScore(teamSeed, experience, playerIndex, ppg = 0) {
  const seedScore = teamSeed * 10000;
  // Higher PPG = lower score (better rank). Max PPG ~35, so 500 - ppg*14 gives 0-500 range
  const ppgScore = Math.max(0, 500 - Math.round(ppg * 14));
  const expMap = {
    Senior: 0,
    Junior: 10,
    Sophomore: 20,
    Freshman: 30,
    Unknown: 40,
  };
  const expScore = expMap[experience] ?? 40;
  const tiebreaker = Math.min(playerIndex, 9);
  return seedScore + ppgScore + expScore + tiebreaker;
}

/**
 * Fetch per-player season statistics for a team.
 * Uses ESPN web API roster endpoint which includes individual player stats.
 * Returns a Map of athleteId -> { ppg }
 */
export async function fetchTeamPlayerStats(teamId) {
  const stats = new Map();
  try {
    const season = new Date().getFullYear();
    const data = await fetchJSON(
      `${ESPN_WEB_BASE}/teams/${teamId}/roster?season=${season}&seasontype=2`
    );
    const athletes = data?.athletes || [];
    for (const athlete of athletes) {
      const id = String(athlete.id);
      if (!id) continue;
      const categories = athlete.statistics?.splits?.categories || [];
      let ppg = 0;
      for (const cat of categories) {
        if (cat.name !== "offensive") continue;
        for (const stat of cat.stats || []) {
          if (stat.name === "avgPoints" || stat.abbreviation === "PTS") {
            ppg = parseFloat(stat.displayValue) || 0;
            break;
          }
        }
        break;
      }
      stats.set(id, { ppg });
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
      const id = item.athlete?.id ? String(item.athlete.id) : null;
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
          rankScore: computeRankingScore(team.seed, player.experience, idx, stat.ppg || 0),
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
