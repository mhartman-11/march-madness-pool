"use client";

import { useState, useEffect, useCallback } from "react";

const TABS = [
  { id: "standings", label: "Standings" },
  { id: "rosters", label: "Team Rosters" },
  { id: "gamelog", label: "Game Log" },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState("standings");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/scores");
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const json = await res.json();
      setData(json);
      setLastUpdated(new Date().toLocaleString());
      setError(null);
    } catch (err) {
      console.error("Fetch error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-4">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-xl sm:text-2xl font-bold text-orange-400">
            2025 March Madness Player Pool
          </h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-gray-400">
            {lastUpdated && <span>Last updated: {lastUpdated}</span>}
            {data?.stale && (
              <span className="text-yellow-500 text-xs">(stale data)</span>
            )}
            {data?.gamesProcessed !== undefined && (
              <span className="hidden sm:inline">
                | {data.gamesProcessed} games processed
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-gray-900 border-b border-gray-800 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto flex">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "text-orange-400 border-b-2 border-orange-400"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-4">
        {loading && !data && (
          <div className="text-center py-12 text-gray-400">
            <div className="animate-spin inline-block w-8 h-8 border-2 border-gray-600 border-t-orange-400 rounded-full mb-3" />
            <p>Loading tournament data...</p>
          </div>
        )}

        {error && !data && (
          <div className="text-center py-12">
            <p className="text-red-400 mb-2">Failed to load data</p>
            <p className="text-gray-500 text-sm">{error}</p>
            <button
              onClick={fetchData}
              className="mt-4 px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-500 text-sm"
            >
              Retry
            </button>
          </div>
        )}

        {data?.owners && (
          <>
            {activeTab === "standings" && <Standings owners={data.owners} />}
            {activeTab === "rosters" && <Rosters owners={data.owners} />}
            {activeTab === "gamelog" && <GameLog owners={data.owners} />}
          </>
        )}
      </div>
    </main>
  );
}

// ─── Tab 1: Standings ────────────────────────────────────────────

function Standings({ owners }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-400 border-b border-gray-800">
            <th className="py-2 pr-2 w-10">#</th>
            <th className="py-2 pr-4">Owner</th>
            <th className="py-2 pr-4 text-right">Points</th>
            <th className="py-2 pr-4 text-right hidden sm:table-cell">
              Remaining
            </th>
            <th className="py-2 text-right hidden sm:table-cell">Avg PPG</th>
          </tr>
        </thead>
        <tbody>
          {owners.map((owner, idx) => (
            <tr
              key={owner.name}
              className={`border-b border-gray-800/50 ${
                idx === 0
                  ? "bg-yellow-900/20"
                  : idx === 1
                  ? "bg-gray-800/30"
                  : idx === 2
                  ? "bg-amber-900/10"
                  : ""
              }`}
            >
              <td className="py-3 pr-2 font-mono text-gray-500">
                {owner.rank}
              </td>
              <td className="py-3 pr-4">
                <div className="font-semibold">{owner.name}</div>
                <div className="text-xs text-gray-500 sm:hidden">
                  {owner.playersRemaining} remaining | {owner.avgPPG} ppg
                </div>
              </td>
              <td className="py-3 pr-4 text-right font-bold text-lg tabular-nums">
                {owner.totalPoints}
              </td>
              <td className="py-3 pr-4 text-right hidden sm:table-cell">
                <span
                  className={
                    owner.playersRemaining > 0
                      ? "text-green-400"
                      : "text-gray-500"
                  }
                >
                  {owner.playersRemaining}
                </span>
              </td>
              <td className="py-3 text-right hidden sm:table-cell tabular-nums text-gray-300">
                {owner.avgPPG}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Tab 2: Team Rosters ─────────────────────────────────────────

function Rosters({ owners }) {
  const [expanded, setExpanded] = useState({});

  const toggle = (name) =>
    setExpanded((prev) => ({ ...prev, [name]: !prev[name] }));

  return (
    <div className="space-y-3">
      {owners.map((owner) => {
        const isOpen = expanded[owner.name] !== false; // default open
        return (
          <div
            key={owner.name}
            className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden"
          >
            <button
              onClick={() => toggle(owner.name)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-gray-500 w-5">
                  #{owner.rank}
                </span>
                <span className="font-semibold">{owner.name}</span>
                <span className="text-orange-400 font-bold">
                  {owner.totalPoints} pts
                </span>
              </div>
              <svg
                className={`w-4 h-4 text-gray-500 transition-transform ${
                  isOpen ? "rotate-180" : ""
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {isOpen && (
              <div className="border-t border-gray-800">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 border-b border-gray-800/50">
                      <th className="py-1.5 px-4 text-left">Player</th>
                      <th className="py-1.5 px-2 text-left hidden sm:table-cell">
                        Team
                      </th>
                      <th className="py-1.5 px-2 text-right">Pts</th>
                      <th className="py-1.5 px-2 text-right">GP</th>
                      <th className="py-1.5 px-2 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {owner.players.map((p) => (
                      <tr
                        key={p.name}
                        className="border-b border-gray-800/30 last:border-0"
                      >
                        <td className="py-2 px-4">
                          <div className="flex items-center gap-1.5">
                            {p.unmatched && (
                              <span title="Not matched in ESPN data">
                                &#9888;&#65039;
                              </span>
                            )}
                            <span>{p.name}</span>
                            <span className="text-xs text-gray-600">
                              #{p.pick}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 sm:hidden">
                            {p.team}
                          </div>
                        </td>
                        <td className="py-2 px-2 text-gray-400 text-xs hidden sm:table-cell">
                          {p.team}
                        </td>
                        <td className="py-2 px-2 text-right font-medium tabular-nums">
                          {p.totalPoints}
                        </td>
                        <td className="py-2 px-2 text-right text-gray-400 tabular-nums">
                          {p.gamesPlayed}
                        </td>
                        <td className="py-2 px-2 text-right">
                          {p.eliminated ? (
                            <span className="text-xs text-red-400/80 bg-red-900/20 px-1.5 py-0.5 rounded">
                              Out
                            </span>
                          ) : (
                            <span className="text-xs text-green-400/80 bg-green-900/20 px-1.5 py-0.5 rounded">
                              Active
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Tab 3: Game Log ─────────────────────────────────────────────

function GameLog({ owners }) {
  const [filter, setFilter] = useState("all");

  // Flatten all games from all players
  const allGames = owners.flatMap((owner) =>
    owner.players.flatMap((player) =>
      player.games.map((g) => ({
        player: player.name,
        owner: owner.name,
        team: player.team,
        ...g,
      }))
    )
  );

  // Filter by owner
  const filtered =
    filter === "all" ? allGames : allGames.filter((g) => g.owner === filter);

  // Sort by date descending, then points descending
  filtered.sort((a, b) => {
    const dateComp = new Date(b.date) - new Date(a.date);
    if (dateComp !== 0) return dateComp;
    return b.points - a.points;
  });

  return (
    <div>
      {/* Filter */}
      <div className="mb-4">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded px-3 py-2 focus:outline-none focus:border-orange-500"
        >
          <option value="all">All Owners</option>
          {owners.map((o) => (
            <option key={o.name} value={o.name}>
              {o.name}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No game data yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-800">
                <th className="py-2 pr-3">Player</th>
                <th className="py-2 pr-3 hidden sm:table-cell">Owner</th>
                <th className="py-2 pr-3">Round</th>
                <th className="py-2 pr-3 hidden sm:table-cell">Opponent</th>
                <th className="py-2 pr-3 text-right">Pts</th>
                <th className="py-2 text-right">Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 200).map((g, i) => (
                <tr
                  key={`${g.gameId}-${g.player}-${i}`}
                  className="border-b border-gray-800/30"
                >
                  <td className="py-2 pr-3">
                    <div>{g.player}</div>
                    <div className="text-xs text-gray-500 sm:hidden">
                      {g.owner}
                    </div>
                  </td>
                  <td className="py-2 pr-3 text-gray-400 hidden sm:table-cell">
                    {g.owner}
                  </td>
                  <td className="py-2 pr-3 text-xs text-gray-300">
                    {g.round}
                  </td>
                  <td className="py-2 pr-3 text-gray-400 text-xs hidden sm:table-cell">
                    vs {g.opponent}
                  </td>
                  <td className="py-2 pr-3 text-right font-medium tabular-nums">
                    {g.points}
                  </td>
                  <td className="py-2 text-right text-xs text-gray-500">
                    {new Date(g.date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > 200 && (
            <p className="text-gray-500 text-center text-xs py-2">
              Showing first 200 of {filtered.length} entries
            </p>
          )}
        </div>
      )}
    </div>
  );
}
