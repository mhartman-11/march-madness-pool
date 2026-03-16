import { redis } from "@/lib/redis";
import { getTeamIndexForPick, getRoundForPick, TOTAL_PICKS, isDraftDeadlinePassed } from "@/lib/draftLogic";
import { generateFinalRosters } from "@/app/api/admin/autopick/route";

export async function POST(request) {
  try {
    const body = await request.json();
    const { token, playerId } = body;

    if (!token || !playerId) {
      return Response.json({ error: "Missing token or playerId" }, { status: 400 });
    }

    // Validate draft is active
    const config = await redis.hgetall("draft:config");
    if (!config || config.status !== "active") {
      return Response.json({ error: "Draft is not active." }, { status: 400 });
    }

    if (isDraftDeadlinePassed()) {
      return Response.json({ error: "Draft deadline has passed." }, { status: 400 });
    }

    const currentPick = parseInt(config.currentPick, 10);
    if (currentPick > TOTAL_PICKS) {
      return Response.json({ error: "Draft is complete." }, { status: 400 });
    }

    // Validate it's this team's turn
    const draftOrder = await redis.lrange("draft:order", 0, -1);
    const teamIndex = getTeamIndexForPick(currentPick);
    const expectedToken = draftOrder[teamIndex];

    if (token !== expectedToken) {
      return Response.json({ error: "It's not your turn to pick." }, { status: 403 });
    }

    // Validate player isn't already picked
    const alreadyPicked = await redis.sismember("draft:players:picked", playerId);
    if (alreadyPicked) {
      return Response.json({ error: "This player has already been drafted." }, { status: 409 });
    }

    // Find the player by direct hash lookup (O(1) instead of scanning all players)
    const playerRaw = await redis.hget("draft:players:byid", playerId);
    if (!playerRaw) {
      return Response.json({ error: "Player not found in the draft pool." }, { status: 404 });
    }
    const selectedPlayer = typeof playerRaw === "string" ? JSON.parse(playerRaw) : playerRaw;

    // Optimistic concurrency check: re-read currentPick to avoid race
    const freshConfig = await redis.hgetall("draft:config");
    const freshPick = parseInt(freshConfig.currentPick, 10);
    if (freshPick !== currentPick) {
      return Response.json({ error: "Pick conflict. Please try again." }, { status: 409 });
    }

    // Make the pick
    const teamData = await redis.hgetall(`draft:team:${token}`);
    const now = new Date().toISOString();
    const pipe = redis.pipeline();

    // Mark player as picked
    pipe.sadd("draft:players:picked", playerId);

    // Update pick slot
    pipe.hset(`draft:pick:${currentPick}`, {
      pickNumber: String(currentPick),
      round: String(getRoundForPick(currentPick)),
      teamToken: token,
      teamName: teamData?.name || "Unknown",
      playerId: selectedPlayer.id,
      playerName: selectedPlayer.name,
      playerTeam: selectedPlayer.team,
      playerPosition: selectedPlayer.position,
      timestamp: now,
      isAutoPick: "false",
    });

    // Update team's picks array (Upstash may auto-parse JSON, so handle both)
    const rawPicks = teamData?.picks;
    const existingPicks = Array.isArray(rawPicks) ? rawPicks : rawPicks ? JSON.parse(rawPicks) : [];
    existingPicks.push(currentPick);
    pipe.hset(`draft:team:${token}`, { picks: JSON.stringify(existingPicks) });

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

    // Generate final rosters if draft is now complete
    if (nextPick > TOTAL_PICKS) {
      await generateFinalRosters();
    }

    return Response.json({
      success: true,
      pick: {
        pickNumber: currentPick,
        round: getRoundForPick(currentPick),
        teamName: teamData?.name || "Unknown",
        playerName: selectedPlayer.name,
        playerTeam: selectedPlayer.team,
        playerPosition: selectedPlayer.position,
        isAutoPick: false,
      },
      nextPick: nextPick <= TOTAL_PICKS ? nextPick : null,
    });
  } catch (error) {
    console.error("[draft/pick] Error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
