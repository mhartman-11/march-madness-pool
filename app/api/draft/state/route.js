import { redis } from "@/lib/redis";
import { getTeamIndexForPick, getRoundForPick, TOTAL_PICKS, isDraftDeadlinePassed } from "@/lib/draftLogic";

export const dynamic = "force-dynamic";

/**
 * Auto-fill remaining picks when deadline has passed.
 * Idempotent: calling multiple times produces the same result.
 */
async function handleDeadlineAutofill(config, draftOrder) {
  const currentPick = parseInt(config.currentPick, 10);
  if (currentPick > TOTAL_PICKS) return; // Already complete

  // Dynamically import to avoid circular deps
  const { autoFillRemaining, generateFinalRosters } = await import("@/app/api/admin/autopick/route");

  // Use a Redis lock to prevent concurrent auto-fill
  const lockKey = "draft:autofill:lock";
  const locked = await redis.set(lockKey, "1", { nx: true, ex: 60 });
  if (!locked) return; // Another request is already handling it

  try {
    await autoFillRemaining();
    await generateFinalRosters();
  } finally {
    await redis.del(lockKey);
  }
}

const NOT_SETUP_RESPONSE = {
  config: { status: "not_setup" },
  order: [],
  picks: [],
  currentTeam: null,
  currentRound: 0,
};

export async function GET() {
  try {
    if (!redis) {
      return Response.json(NOT_SETUP_RESPONSE);
    }

    const config = await redis.hgetall("draft:config");

    if (!config || !config.status) {
      return Response.json(NOT_SETUP_RESPONSE);
    }

    const currentPick = parseInt(config.currentPick, 10) || 0;
    const totalPicks = parseInt(config.totalPicks, 10) || TOTAL_PICKS;

    // Check if deadline passed and draft is still active
    if (config.status === "active" && isDraftDeadlinePassed()) {
      const draftOrder = await redis.lrange("draft:order", 0, -1);
      await handleDeadlineAutofill(config, draftOrder);
      // Re-read config after auto-fill
      const updatedConfig = await redis.hgetall("draft:config");
      if (updatedConfig) Object.assign(config, updatedConfig);
    }

    // Read draft order
    const draftOrder = await redis.lrange("draft:order", 0, -1);

    // Read team info for each token
    const teamPipe = redis.pipeline();
    for (const token of draftOrder) {
      teamPipe.hgetall(`draft:team:${token}`);
    }
    const teamResults = await teamPipe.exec();

    const order = teamResults.map((t, i) => ({
      name: t?.name || "Unknown",
      draftPosition: i + 1,
      token: draftOrder[i],
    }));

    // Read all picks that have been made
    const pickPipe = redis.pipeline();
    const pickCount = Math.min(currentPick > totalPicks ? totalPicks : currentPick - 1, totalPicks);
    for (let i = 1; i <= pickCount; i++) {
      pickPipe.hgetall(`draft:pick:${i}`);
    }
    const pickResults = pickCount > 0 ? await pickPipe.exec() : [];

    const picks = pickResults
      .filter((p) => p && p.playerName)
      .map((p) => ({
        pickNumber: parseInt(p.pickNumber, 10),
        round: parseInt(p.round, 10),
        teamToken: p.teamToken,
        teamName: p.teamName,
        playerName: p.playerName,
        playerTeam: p.playerTeam,
        playerPosition: p.playerPosition,
        isAutoPick: p.isAutoPick === "true",
        timestamp: p.timestamp,
      }));

    // Determine current team on the clock
    let currentTeam = null;
    let currentRound = 0;
    const updatedCurrentPick = parseInt(config.currentPick, 10) || 0;

    if (config.status === "active" && updatedCurrentPick <= totalPicks && draftOrder.length > 0) {
      const teamIndex = getTeamIndexForPick(updatedCurrentPick);
      const team = order[teamIndex];
      currentTeam = team || null;
      currentRound = getRoundForPick(updatedCurrentPick);
    }

    return Response.json({
      config: {
        status: config.status,
        currentPick: updatedCurrentPick,
        totalPicks,
        draftStartTime: config.draftStartTime,
        draftDeadline: config.draftDeadline,
        lastPickAt: config.lastPickAt,
      },
      order,
      picks,
      currentTeam,
      currentRound,
    });
  } catch (error) {
    console.error("[draft/state] Error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
