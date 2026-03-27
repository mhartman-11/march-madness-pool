import { owners as hardcodedOwners } from "@/lib/draftData";
import { redis } from "@/lib/redis";

const SCOREBOARD_URL =
  "https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard";
const SUMMARY_URL =
  "https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/summary";

// In-memory caches
let responseCache = { data: null, timestamp: 0 };
const RESPONSE_CACHE_TTL = 30_000; // 30 seconds

// Cache individual completed game box scores permanently (they won't change)
const gameBoxScoreCache = new Map();

// Tournament dates for the 2026 NCAA Tournament (excluding First Four)
const TOURNAMENT_DATES = [
  "20260319", "20260320",
  "20260321", "20260322", "20260327", "20260328",
  "20260329", "20260330", "20260404", "20260406",
];

// Round labels by date
const DATE_TO_ROUND = {
  "2026-03-19": "Round of 64", "2026-03-20": "Round of 64",
  "2026-03-21": "Round of 32", "2026-03-22": "Round of 32",
  "2026-03-27": "Sweet 16", "2026-03-28": "Sweet 16",
  "2026-03-29": "Elite Eight", "2026-03-30": "Elite Eight",
  "2026-04-04": "Final Four",
  "2026-04-06": "Championship",
};

function getRound(dateString) {
  if (!dateString) return "Unknown";
  const d = new Date(dateString);
  const key = d.toISOString().slice(0, 10);
  return DATE_TO_ROUND[key] || "Tournament";
}

// --- Name normalization for fuzzy matching ---
function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/\./g, "")       // Remove periods (L.J. -> LJ)
    .replace(/,/g, "")
    .replace(/'|'/g, "'")     // Normalize apostrophes
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildNameVariants(name) {
  const norm = normalizeName(name);
  const parts = norm.split(" ");
  const variants = [norm];
  // Also try without middle names: first + last
  if (parts.length > 2) {
    variants.push(`${parts[0]} ${parts[parts.length - 1]}`);
  }
  return variants;
}

// --- Get owners from Redis (draft rosters) or fall back to hardcoded data ---
async function getOwners() {
  if (!redis) return hardcodedOwners;
  try {
    const kvRosters = await redis.get("draft:rosters");
    if (kvRosters) {
      const parsed = typeof kvRosters === "string" ? JSON.parse(kvRosters) : kvRosters;
      if (Array.isArray(parsed) && parsed.length > 0) {
        console.log("[scores] Using draft rosters from Redis");
        return parsed;
      }
    }
  } catch (err) {
    console.log("[scores] Redis unavailable, using hardcoded draft data:", err.message);
  }
  return hardcodedOwners;
}

// Build a lookup map of normalized draft player names -> player info
function buildDraftLookup(owners) {
  const allPlayers = owners.flatMap((owner) =>
    owner.players.map((player) => ({ ...player, owner: owner.name }))
  );
  const lookup = new Map();
  for (const player of allPlayers) {
    for (const variant of buildNameVariants(player.name)) {
      lookup.set(variant, player);
    }
  }
  return lookup;
}

function matchPlayer(espnName, draftLookup) {
  const espnVariants = buildNameVariants(espnName);
  for (const v of espnVariants) {
    if (draftLookup.has(v)) return draftLookup.get(v);
  }
  return null;
}

// --- ESPN API fetching ---

async function fetchJSON(url) {
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function fetchAllTournamentGames() {
  const results = await Promise.allSettled(
    TOURNAMENT_DATES.map((date) =>
      fetchJSON(`${SCOREBOARD_URL}?seasontype=3&dates=${date}&limit=50`)
    )
  );

  const allEvents = [];
  for (const r of results) {
    if (r.status === "fulfilled" && r.value?.events) {
      allEvents.push(...r.value.events);
    }
  }

  // Deduplicate by event ID
  const seen = new Set();
  return allEvents.filter((e) => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });
}

async function fetchBoxScore(gameId) {
  // Return cached result for completed games
  if (gameBoxScoreCache.has(gameId)) {
    return gameBoxScoreCache.get(gameId);
  }

  const data = await fetchJSON(`${SUMMARY_URL}?event=${gameId}`);
  return data;
}

function extractPlayerStats(boxScoreData, event) {
  const players = [];
  const bsPlayers = boxScoreData?.boxscore?.players || [];
  const gameDate = event.date;
  const round = getRound(gameDate);
  const competition = event.competitions?.[0];
  const isCompleted = event.status?.type?.completed === true;

  for (const teamData of bsPlayers) {
    const teamName = teamData.team?.displayName || teamData.team?.name || "Unknown";
    const teamAbbr = teamData.team?.abbreviation || "";
    const stats = teamData.statistics?.[0];
    if (!stats) continue;

    // Dynamically find PTS column index
    const names = stats.names || stats.labels || [];
    let ptsIdx = names.findIndex((n) => /^pts$/i.test(n));
    if (ptsIdx < 0) ptsIdx = 1; // Fallback to index 1

    // Determine opponent
    const competitors = competition?.competitors || [];
    const opponent = competitors.find(
      (c) => c.team?.abbreviation !== teamAbbr
    );
    const opponentName = opponent?.team?.displayName || opponent?.team?.name || "Unknown";

    for (const athlete of stats.athletes || []) {
      const displayName = athlete.athlete?.displayName;
      if (!displayName) continue;

      const rawPts = athlete.stats?.[ptsIdx];
      const points = rawPts && rawPts !== "--" && rawPts !== "DNP" ? parseInt(rawPts, 10) : 0;
      if (isNaN(points)) continue;

      players.push({
        espnName: displayName,
        espnTeam: teamName,
        espnTeamAbbr: teamAbbr,
        points,
        gameId: event.id,
        date: gameDate,
        round,
        opponent: opponentName,
        isCompleted,
      });
    }
  }

  return players;
}

// --- Check if a box score has real player stats (not an empty/in-progress fetch) ---
function hasPlayerStats(boxScoreData) {
  const bsPlayers = boxScoreData?.boxscore?.players || [];
  for (const teamData of bsPlayers) {
    const stats = teamData.statistics?.[0];
    if (!stats) continue;
    for (const athlete of stats.athletes || []) {
      const rawStats = athlete.stats || [];
      // If any athlete has a non-zero PTS value, the box score is real
      if (rawStats.length > 1 && rawStats[1] && rawStats[1] !== "0" && rawStats[1] !== "--") {
        return true;
      }
    }
  }
  return false;
}

// --- Determine eliminated teams (teams that lost and tournament is ongoing) ---
function getEliminatedTeams(events) {
  const eliminated = new Set();
  const advancing = new Set();

  for (const event of events) {
    const comp = event.competitions?.[0];
    if (!comp || event.status?.type?.completed !== true) continue;

    for (const competitor of comp.competitors || []) {
      const teamName = competitor.team?.displayName || "";
      if (competitor.winner) {
        advancing.add(teamName);
      } else {
        eliminated.add(teamName);
      }
    }
  }

  // A team is truly eliminated only if they lost at least once
  // (they might have won earlier games)
  return eliminated;
}

// --- Main handler ---
export async function GET() {
  // Serve from cache if fresh
  if (responseCache.data && Date.now() - responseCache.timestamp < RESPONSE_CACHE_TTL) {
    return Response.json(responseCache.data);
  }

  try {
    // 0. Load owners (from Redis draft rosters or hardcoded fallback)
    const owners = await getOwners();
    const draftLookup = buildDraftLookup(owners);

    // 1. Fetch all tournament games
    const events = await fetchAllTournamentGames();
    console.log(`[scores] Found ${events.length} tournament events`);

    // 2. Filter to completed or in-progress games
    const activeEvents = events.filter(
      (e) => e.status?.type?.state === "post" || e.status?.type?.state === "in"
    );
    console.log(`[scores] ${activeEvents.length} completed/in-progress games`);

    // 3. Fetch box scores with concurrency limit
    const BATCH_SIZE = 10;
    const allPlayerGameStats = [];

    for (let i = 0; i < activeEvents.length; i += BATCH_SIZE) {
      const batch = activeEvents.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async (event) => {
          const boxScore = await fetchBoxScore(event.id);

          // Cache completed games permanently, but only if box score has real stats
          if (event.status?.type?.completed && hasPlayerStats(boxScore)) {
            gameBoxScoreCache.set(event.id, boxScore);
          }

          return { boxScore, event };
        })
      );

      for (const r of results) {
        if (r.status === "fulfilled") {
          const playerStats = extractPlayerStats(r.value.boxScore, r.value.event);
          allPlayerGameStats.push(...playerStats);
        }
      }
    }

    console.log(`[scores] Extracted ${allPlayerGameStats.length} player-game stat lines`);

    // 4. Determine eliminated teams
    const eliminatedTeams = getEliminatedTeams(events);

    // 5. Match ESPN players to draft picks and aggregate
    const unmatchedEspn = new Set();
    const playerAggregates = new Map(); // "ownerName|playerName" -> aggregated data

    for (const stat of allPlayerGameStats) {
      const matched = matchPlayer(stat.espnName, draftLookup);
      if (!matched) {
        unmatchedEspn.add(stat.espnName);
        continue;
      }

      const key = `${matched.owner}|${matched.name}`;
      if (!playerAggregates.has(key)) {
        playerAggregates.set(key, {
          name: matched.name,
          owner: matched.owner,
          pick: matched.pick,
          team: stat.espnTeam || matched.team,
          totalPoints: 0,
          gamesPlayed: 0,
          eliminated: false,
          games: [],
        });
      }

      const agg = playerAggregates.get(key);
      agg.totalPoints += stat.points;
      agg.gamesPlayed += 1;
      agg.team = stat.espnTeam || agg.team; // Prefer ESPN team name
      if (eliminatedTeams.has(stat.espnTeam)) {
        agg.eliminated = true;
      }
      agg.games.push({
        gameId: stat.gameId,
        round: stat.round,
        opponent: stat.opponent,
        points: stat.points,
        date: stat.date,
      });
    }

    // Log unmatched for debugging (only draft-relevant ones could matter)
    if (unmatchedEspn.size > 0) {
      console.log(`[scores] ESPN players not in draft (expected): ${unmatchedEspn.size} total`);
    }

    // 6. Build owner results
    const ownerResults = owners.map((owner) => {
      const playerResults = owner.players.map((p) => {
        const key = `${owner.name}|${p.name}`;
        const agg = playerAggregates.get(key);
        if (agg) {
          return agg;
        }
        // Player not found in any ESPN box score
        return {
          name: p.name,
          owner: owner.name,
          pick: p.pick,
          team: p.team,
          totalPoints: 0,
          gamesPlayed: 0,
          eliminated: false,
          unmatched: true,
          games: [],
        };
      });

      // Sort players by points descending
      playerResults.sort((a, b) => b.totalPoints - a.totalPoints);

      const totalPoints = playerResults.reduce((s, p) => s + p.totalPoints, 0);
      const totalGames = playerResults.reduce((s, p) => s + p.gamesPlayed, 0);
      const playersRemaining = playerResults.filter((p) => !p.eliminated).length;

      return {
        name: owner.name,
        totalPoints,
        totalGames,
        playersRemaining,
        avgPPG: totalGames > 0 ? (totalPoints / totalGames).toFixed(2) : "0.00",
        players: playerResults,
      };
    });

    // Sort owners by total points descending
    ownerResults.sort((a, b) => b.totalPoints - a.totalPoints);

    // Assign ranks
    ownerResults.forEach((o, i) => {
      o.rank = i + 1;
    });

    const result = {
      owners: ownerResults,
      lastUpdated: new Date().toISOString(),
      gamesProcessed: activeEvents.length,
    };

    // Cache the result
    responseCache = { data: result, timestamp: Date.now() };

    return Response.json(result);
  } catch (error) {
    console.error("[scores] Error:", error);

    // Return cached data if available, even if stale
    if (responseCache.data) {
      return Response.json({
        ...responseCache.data,
        stale: true,
        error: error.message,
      });
    }

    return Response.json(
      { error: "Failed to fetch scores", message: error.message },
      { status: 500 }
    );
  }
}
