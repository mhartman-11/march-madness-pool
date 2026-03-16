import { redis } from "@/lib/redis";
import { TOTAL_TEAMS, TOTAL_ROUNDS, TOTAL_PICKS, DRAFT_OPEN, DRAFT_CLOSE } from "@/lib/draftLogic";

function validateAdmin(request) {
  const secret = request.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return false;
  }
  return true;
}

function generateToken() {
  // Simple UUID-like token
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 24; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

export async function POST(request) {
  if (!validateAdmin(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const teams = body.teams || [
      "Lee", "Wojo", "Koehler", "Webb", "Sam", "Kevin",
      "McPeppers", "Jeremy", "Blake", "Hartman", "Zach", "Schutt",
    ];

    if (teams.length !== TOTAL_TEAMS) {
      return Response.json(
        { error: `Expected ${TOTAL_TEAMS} teams, got ${teams.length}` },
        { status: 400 }
      );
    }

    // Generate tokens for each team
    const teamData = teams.map((name) => ({
      name,
      token: generateToken(),
    }));

    // Write draft config
    const pipe = redis.pipeline();

    pipe.hset("draft:config", {
      status: "setup",
      totalTeams: String(TOTAL_TEAMS),
      totalRounds: String(TOTAL_ROUNDS),
      totalPicks: String(TOTAL_PICKS),
      currentPick: "0",
      draftStartTime: DRAFT_OPEN,
      draftDeadline: DRAFT_CLOSE,
      createdAt: new Date().toISOString(),
      lastPickAt: "",
    });

    // Write each team
    for (const t of teamData) {
      pipe.hset(`draft:team:${t.token}`, {
        name: t.name,
        token: t.token,
        draftPosition: "0", // Set when draft starts
        picks: "[]",
      });
      pipe.set(`draft:team:lookup:${t.name.toLowerCase()}`, t.token);
    }

    // Store token list for admin reference
    pipe.set("draft:tokens", JSON.stringify(teamData));

    await pipe.exec();

    // Build share links
    const host = request.headers.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";
    const links = teamData.map((t) => ({
      name: t.name,
      token: t.token,
      link: `${protocol}://${host}/draft/${t.token}`,
    }));

    return Response.json({ success: true, teams: links });
  } catch (error) {
    console.error("[admin/setup] Error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
