import { redis } from "@/lib/redis";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = (searchParams.get("search") || "").toLowerCase().trim();
    const teamFilter = (searchParams.get("team") || "").toLowerCase().trim();
    const posFilter = (searchParams.get("position") || "").toLowerCase().trim();
    const page = parseInt(searchParams.get("page") || "1", 10);
    const perPage = 50;

    // Get all players from sorted set
    const allPlayersRaw = await redis.zrange("draft:players", 0, -1);

    // Get picked player IDs
    const pickedIds = await redis.smembers("draft:players:picked");
    const pickedSet = new Set(pickedIds);

    // Parse, filter out picked, and apply search/filters
    let available = [];
    for (const memberRaw of allPlayersRaw) {
      const player = typeof memberRaw === "string" ? JSON.parse(memberRaw) : memberRaw;

      // Skip already drafted
      if (pickedSet.has(player.id)) continue;

      // Search filter (name or team)
      if (search) {
        const nameMatch = player.name.toLowerCase().includes(search);
        const teamMatch = player.team.toLowerCase().includes(search);
        if (!nameMatch && !teamMatch) continue;
      }

      // Team filter
      if (teamFilter && !player.team.toLowerCase().includes(teamFilter)) continue;

      // Position filter
      if (posFilter) {
        const pos = player.position.toLowerCase();
        if (posFilter === "g" && !pos.includes("guard")) continue;
        if (posFilter === "f" && !pos.includes("forward")) continue;
        if (posFilter === "c" && !pos.includes("center")) continue;
      }

      available.push(player);
    }

    const total = available.length;
    const startIdx = (page - 1) * perPage;
    const paged = available.slice(startIdx, startIdx + perPage);

    // Get unique teams for filter dropdown
    const allTeams = new Set();
    for (const memberRaw of allPlayersRaw) {
      const player = typeof memberRaw === "string" ? JSON.parse(memberRaw) : memberRaw;
      if (!pickedSet.has(player.id)) {
        allTeams.add(player.team);
      }
    }

    return Response.json({
      players: paged,
      total,
      page,
      perPage,
      hasMore: startIdx + perPage < total,
      teams: Array.from(allTeams).sort(),
    });
  } catch (error) {
    console.error("[draft/players] Error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
