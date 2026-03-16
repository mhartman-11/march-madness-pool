import { redis } from "@/lib/redis";
import { fetchAllTournamentPlayers } from "@/lib/espnPlayers";

function validateAdmin(request) {
  const secret = request.headers.get("x-admin-secret");
  return secret && secret === process.env.ADMIN_SECRET;
}

export async function POST(request) {
  if (!validateAdmin(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));

    let players;

    if (body.manualTeams && Array.isArray(body.manualTeams)) {
      // Manual fallback: admin provides team data directly
      // Format: [{ teamId, teamName, seed }]
      // We'll still fetch rosters from ESPN using the provided team IDs
      const { fetchTeamRoster, computeRankingScore } = await import("@/lib/espnPlayers");
      players = [];
      const BATCH_SIZE = 10;

      for (let i = 0; i < body.manualTeams.length; i += BATCH_SIZE) {
        const batch = body.manualTeams.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
          batch.map((t) => fetchTeamRoster(t.teamId))
        );

        for (let j = 0; j < results.length; j++) {
          const r = results[j];
          const team = batch[j];
          if (r.status !== "fulfilled") continue;

          r.value.forEach((player, idx) => {
            players.push({
              id: player.id,
              name: player.name,
              team: team.teamName,
              teamId: team.teamId,
              abbrev: team.abbrev || "",
              position: player.position,
              seed: team.seed || 16,
              experience: player.experience,
              rankScore: computeRankingScore(team.seed || 16, player.experience, idx),
            });
          });
        }
      }
      players.sort((a, b) => a.rankScore - b.rankScore);
    } else {
      // Auto-discover from ESPN tournament data
      players = await fetchAllTournamentPlayers();
    }

    if (players.length === 0) {
      return Response.json(
        { error: "No players found. The bracket may not be available yet on ESPN." },
        { status: 404 }
      );
    }

    // Clear existing player data
    await redis.del("draft:players", "draft:players:picked", "draft:players:byid");

    // Store players in a sorted set (score = rankScore, member = JSON string)
    // Also store in a hash for O(1) lookup by player ID
    const pipe = redis.pipeline();
    const byIdMap = {};
    for (const player of players) {
      const json = JSON.stringify(player);
      pipe.zadd("draft:players", {
        score: player.rankScore,
        member: json,
      });
      byIdMap[player.id] = json;
    }
    pipe.hset("draft:players:byid", byIdMap);

    // Update config status
    pipe.hset("draft:config", { status: "ready" });
    await pipe.exec();

    // Count unique teams
    const uniqueTeams = new Set(players.map((p) => p.team));

    return Response.json({
      success: true,
      playerCount: players.length,
      teamCount: uniqueTeams.size,
      teams: Array.from(uniqueTeams).sort(),
    });
  } catch (error) {
    console.error("[admin/load-players] Error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
