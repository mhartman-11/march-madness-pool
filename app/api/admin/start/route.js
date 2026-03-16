import { redis } from "@/lib/redis";
import { shuffleArray, getTeamIndexForPick, getRoundForPick, TOTAL_PICKS } from "@/lib/draftLogic";

function validateAdmin(request) {
  const secret = request.headers.get("x-admin-secret");
  return secret && secret === process.env.ADMIN_SECRET;
}

export async function POST(request) {
  if (!validateAdmin(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const config = await redis.hgetall("draft:config");
    if (!config || !config.status) {
      return Response.json({ error: "Draft not set up yet. Run setup first." }, { status: 400 });
    }

    if (config.status === "active") {
      return Response.json({ error: "Draft is already active." }, { status: 400 });
    }

    // Load team tokens
    const tokensRaw = await redis.get("draft:tokens");
    if (!tokensRaw) {
      return Response.json({ error: "No teams found. Run setup first." }, { status: 400 });
    }
    const teams = typeof tokensRaw === "string" ? JSON.parse(tokensRaw) : tokensRaw;

    // Check players are loaded
    const playerCount = await redis.zcard("draft:players");
    if (playerCount === 0) {
      return Response.json({ error: "No players loaded. Load players first." }, { status: 400 });
    }

    // Use fixed draft order (as provided during setup)
    const shuffledTeams = teams;

    // Write draft order and update team positions
    const pipe = redis.pipeline();

    // Store ordered token list
    pipe.del("draft:order");
    for (const team of shuffledTeams) {
      pipe.rpush("draft:order", team.token);
    }

    // Update each team's draft position
    for (let i = 0; i < shuffledTeams.length; i++) {
      pipe.hset(`draft:team:${shuffledTeams[i].token}`, {
        draftPosition: String(i + 1),
      });
    }

    // Pre-populate all pick slots with team assignments
    for (let pick = 1; pick <= TOTAL_PICKS; pick++) {
      const teamIndex = getTeamIndexForPick(pick);
      const team = shuffledTeams[teamIndex];
      pipe.hset(`draft:pick:${pick}`, {
        pickNumber: String(pick),
        round: String(getRoundForPick(pick)),
        teamToken: team.token,
        teamName: team.name,
        playerId: "",
        playerName: "",
        playerTeam: "",
        playerPosition: "",
        timestamp: "",
        isAutoPick: "false",
      });
    }

    // Activate draft
    pipe.hset("draft:config", {
      status: "active",
      currentPick: "1",
    });

    await pipe.exec();

    // Build the order display
    const draftOrder = shuffledTeams.map((t, i) => ({
      position: i + 1,
      name: t.name,
      token: t.token,
    }));

    return Response.json({
      success: true,
      message: "Draft started! Order randomized.",
      draftOrder,
      playerCount,
    });
  } catch (error) {
    console.error("[admin/start] Error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
