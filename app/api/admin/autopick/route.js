import { redis } from "@/lib/redis";
import { getTeamIndexForPick, getRoundForPick, TOTAL_PICKS } from "@/lib/draftLogic";

function validateAdmin(request) {
  const secret = request.headers.get("x-admin-secret");
  return secret && secret === process.env.ADMIN_SECRET;
}

/**
 * Find the best available player (lowest rank score not yet picked).
 */
async function getBestAvailable() {
  const allPlayers = await redis.zrange("draft:players", 0, -1);
  const pickedRaw = await redis.smembers("draft:players:picked");
  const pickedSet = new Set(pickedRaw);

  for (const memberRaw of allPlayers) {
    const player = typeof memberRaw === "string" ? JSON.parse(memberRaw) : memberRaw;
    if (!pickedSet.has(player.id)) {
      return player;
    }
  }
  return null;
}

/**
 * Make an auto-pick for the current team on the clock.
 */
async function makeAutoPick(currentPick, draftOrder) {
  const teamIndex = getTeamIndexForPick(currentPick);
  const teamToken = draftOrder[teamIndex];
  const teamData = await redis.hgetall(`draft:team:${teamToken}`);

  const bestPlayer = await getBestAvailable();
  if (!bestPlayer) {
    return { error: "No available players remaining." };
  }

  const now = new Date().toISOString();
  const pipe = redis.pipeline();

  // Mark player as picked
  pipe.sadd("draft:players:picked", bestPlayer.id);

  // Update pick slot
  pipe.hset(`draft:pick:${currentPick}`, {
    pickNumber: String(currentPick),
    round: String(getRoundForPick(currentPick)),
    teamToken: teamToken,
    teamName: teamData?.name || "Unknown",
    playerId: bestPlayer.id,
    playerName: bestPlayer.name,
    playerTeam: bestPlayer.team,
    playerPosition: bestPlayer.position,
    timestamp: now,
    isAutoPick: "true",
  });

  // Update team's picks array
  const existingPicks = teamData?.picks ? JSON.parse(teamData.picks) : [];
  existingPicks.push(currentPick);
  pipe.hset(`draft:team:${teamToken}`, { picks: JSON.stringify(existingPicks) });

  // Advance current pick
  const nextPick = currentPick + 1;
  if (nextPick > TOTAL_PICKS) {
    pipe.hset("draft:config", {
      currentPick: String(nextPick),
      lastPickAt: now,
      status: "completed",
    });
  } else {
    pipe.hset("draft:config", {
      currentPick: String(nextPick),
      lastPickAt: now,
    });
  }

  await pipe.exec();

  return {
    success: true,
    pick: {
      pickNumber: currentPick,
      round: getRoundForPick(currentPick),
      teamName: teamData?.name || "Unknown",
      playerName: bestPlayer.name,
      playerTeam: bestPlayer.team,
      isAutoPick: true,
    },
  };
}

/**
 * Auto-fill all remaining picks (used when deadline passes).
 */
async function autoFillRemaining() {
  const config = await redis.hgetall("draft:config");
  let currentPick = parseInt(config.currentPick, 10);
  const totalPicks = parseInt(config.totalPicks, 10) || TOTAL_PICKS;
  const draftOrder = await redis.lrange("draft:order", 0, -1);

  const results = [];
  while (currentPick <= totalPicks) {
    const result = await makeAutoPick(currentPick, draftOrder);
    if (result.error) break;
    results.push(result.pick);
    currentPick++;
  }

  // Generate final rosters
  if (results.length > 0) {
    await generateFinalRosters();
  }

  return results;
}

/**
 * Generate the final rosters in draftData.js format and store in Redis.
 */
async function generateFinalRosters() {
  const tokensRaw = await redis.get("draft:tokens");
  const teams = typeof tokensRaw === "string" ? JSON.parse(tokensRaw) : tokensRaw;
  const totalPicks = TOTAL_PICKS;

  // Read all picks
  const pipe = redis.pipeline();
  for (let i = 1; i <= totalPicks; i++) {
    pipe.hgetall(`draft:pick:${i}`);
  }
  const allPicks = await pipe.exec();

  // Group picks by team
  const teamPicks = new Map();
  for (const t of teams) {
    teamPicks.set(t.token, { name: t.name, players: [] });
  }

  for (const pick of allPicks) {
    if (!pick || !pick.playerName) continue;
    const entry = teamPicks.get(pick.teamToken);
    if (entry) {
      entry.players.push({
        name: pick.playerName,
        pick: parseInt(pick.pickNumber, 10),
        team: pick.playerTeam,
      });
    }
  }

  const rosters = Array.from(teamPicks.values());
  await redis.set("draft:rosters", JSON.stringify(rosters));
  return rosters;
}

// POST: Trigger auto-pick for current team (admin manual)
export async function POST(request) {
  if (!validateAdmin(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const config = await redis.hgetall("draft:config");

    if (!config || config.status !== "active") {
      return Response.json({ error: "Draft is not active." }, { status: 400 });
    }

    const draftOrder = await redis.lrange("draft:order", 0, -1);

    if (body.fillAll) {
      // Fill all remaining picks
      const results = await autoFillRemaining();
      return Response.json({
        success: true,
        message: `Auto-filled ${results.length} remaining picks.`,
        picks: results,
      });
    }

    // Single auto-pick
    const currentPick = parseInt(config.currentPick, 10);
    if (currentPick > TOTAL_PICKS) {
      return Response.json({ error: "Draft is already complete." }, { status: 400 });
    }

    const result = await makeAutoPick(currentPick, draftOrder);
    if (result.error) {
      return Response.json({ error: result.error }, { status: 400 });
    }

    // Check if draft is now complete
    if (currentPick === TOTAL_PICKS) {
      await generateFinalRosters();
    }

    return Response.json(result);
  } catch (error) {
    console.error("[admin/autopick] Error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// Export for use by draft state route (deadline auto-fill)
export { autoFillRemaining, generateFinalRosters };
