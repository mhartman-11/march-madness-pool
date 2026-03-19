import { redis } from "@/lib/redis";
import { owners } from "@/lib/draftData";

export const dynamic = "force-dynamic";

export async function POST(req) {
  const secret = req.headers.get("x-admin-secret");
  if (secret !== process.env.ADMIN_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!redis) {
    return Response.json({ error: "Redis not configured" }, { status: 500 });
  }

  try {
    const pipe = redis.pipeline();

    // Write rosters to Redis
    pipe.set("draft:rosters", JSON.stringify(owners));

    // Mark draft as completed
    pipe.hset("draft:config", {
      status: "completed",
      totalTeams: "12",
      totalRounds: "10",
      totalPicks: "120",
      currentPick: "121",
    });

    await pipe.exec();

    const totalPlayers = owners.reduce((sum, o) => sum + o.players.length, 0);

    return Response.json({
      success: true,
      owners: owners.length,
      totalPlayers,
      message: `Imported ${owners.length} teams with ${totalPlayers} total players.`,
    });
  } catch (e) {
    console.error("[import-rosters] Error:", e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
