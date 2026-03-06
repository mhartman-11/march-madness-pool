"use client";

import { useState, useEffect, useCallback } from "react";
import RetroBackground from "./RetroBackground";
import { sfxSelect, sfxConfirm, sfxToggle } from "./retroSfx";

const TABS = [
  { id: "standings", label: "STANDINGS" },
  { id: "rosters", label: "ROSTERS" },
  { id: "gamelog", label: "GAME LOG" },
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

  // Keyboard navigation
  useEffect(() => {
    function handleKey(e) {
      const idx = TABS.findIndex((t) => t.id === activeTab);
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        const next = (idx + 1) % TABS.length;
        setActiveTab(TABS[next].id);
        sfxSelect();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        const prev = (idx - 1 + TABS.length) % TABS.length;
        setActiveTab(TABS[prev].id);
        sfxSelect();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [activeTab]);

  function switchTab(id) {
    setActiveTab(id);
    sfxConfirm();
  }

  return (
    <>
      <RetroBackground />
      <div className="scanlines" />

      <main className="relative z-10 min-h-screen">
        {/* Header */}
        <div className="border-b-4 border-[var(--retro-red)] bg-[var(--retro-bg)]/90 backdrop-blur-sm px-4 py-5">
          <div className="max-w-5xl mx-auto">
            <h1 className="text-base sm:text-xl text-[var(--retro-gold)] text-glow tracking-wider">
              &#127936; MARCH MADNESS POOL 2026
            </h1>
            <div className="flex items-center gap-3 mt-2 text-[8px] sm:text-[10px] text-[var(--retro-gray)]">
              {lastUpdated && (
                <span>
                  LAST UPDATE: {lastUpdated}{" "}
                  <span className="blink text-[var(--retro-green)]">_</span>
                </span>
              )}
              {data?.stale && (
                <span className="text-[var(--retro-gold)]">[STALE DATA]</span>
              )}
              {data?.gamesProcessed !== undefined && (
                <span className="hidden sm:inline">
                  | {data.gamesProcessed} GAMES LOADED
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="bg-[var(--retro-bg2)]/90 backdrop-blur-sm border-b-2 border-[var(--retro-border)] sticky top-0 z-20">
          <div className="max-w-5xl mx-auto flex">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => switchTab(tab.id)}
                onMouseEnter={sfxSelect}
                className={`px-4 sm:px-6 py-3 text-[9px] sm:text-xs tracking-widest transition-none pixel-btn ${
                  activeTab === tab.id
                    ? "text-[var(--retro-gold)] bg-[var(--retro-panel)] border-b-3 border-[var(--retro-gold)] tab-arrow text-glow"
                    : "text-[var(--retro-gray)] hover:text-[var(--retro-white)]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="max-w-5xl mx-auto px-3 py-4">
          {loading && !data && (
            <div className="text-center py-16">
              <div className="text-[var(--retro-gold)] text-sm blink mb-4">
                LOADING...
              </div>
              <div className="text-xs text-[var(--retro-gray)]">
                FETCHING TOURNAMENT DATA
              </div>
            </div>
          )}

          {error && !data && (
            <div className="text-center py-16">
              <div className="text-[var(--retro-red)] text-sm mb-3">
                !! GAME OVER !!
              </div>
              <p className="text-[var(--retro-gray)] text-xs mb-4">
                {error}
              </p>
              <button
                onClick={() => { sfxConfirm(); fetchData(); }}
                className="pixel-border text-xs px-4 py-2 bg-[var(--retro-panel)] text-[var(--retro-gold)] hover:text-[var(--retro-white)]"
              >
                &#9654; CONTINUE?
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

        {/* Footer */}
        <div className="text-center text-[8px] sm:text-[10px] text-[var(--retro-gray)] py-6 px-4">
          USE &#9664;&#9654; ARROW KEYS TO NAVIGATE TABS
        </div>
      </main>
    </>
  );
}

// ─── RANK BADGE ────────────────────────────────────────────────

function RankBadge({ rank }) {
  if (rank === 1)
    return (
      <span className="text-[var(--retro-gold)] text-glow float-anim inline-block">
        &#9733;1
      </span>
    );
  if (rank === 2)
    return <span className="text-[var(--retro-silver)]">&#9733;2</span>;
  if (rank === 3)
    return <span className="text-[var(--retro-bronze)]">&#9733;3</span>;
  return <span className="text-[var(--retro-gray)]">{rank}</span>;
}

// ─── Tab 1: Standings ──────────────────────────────────────────

function Standings({ owners }) {
  return (
    <div className="retro-panel p-1 sm:p-2">
      <div className="text-xs sm:text-sm text-[var(--retro-gold)] px-3 py-2 border-b-2 border-[var(--retro-border)]">
        &#9632; LEADERBOARD
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[10px] sm:text-xs">
          <thead>
            <tr className="text-[var(--retro-cyan)] border-b-2 border-[var(--retro-border)]/50">
              <th className="py-2 px-2 text-left w-10">RNK</th>
              <th className="py-2 px-2 text-left">PLAYER</th>
              <th className="py-2 px-2 text-right">PTS</th>
              <th className="py-2 px-2 text-right hidden sm:table-cell">
                ALIVE
              </th>
              <th className="py-2 px-2 text-right hidden sm:table-cell">
                PPG
              </th>
            </tr>
          </thead>
          <tbody>
            {owners.map((owner, idx) => (
              <tr
                key={owner.name}
                className={`retro-row ${
                  idx === 0
                    ? "bg-[var(--retro-gold)]/10"
                    : idx === 1
                    ? "bg-[var(--retro-silver)]/5"
                    : idx === 2
                    ? "bg-[var(--retro-bronze)]/5"
                    : ""
                }`}
              >
                <td className="py-2.5 px-2">
                  <RankBadge rank={owner.rank} />
                </td>
                <td className="py-2.5 px-2">
                  <div className="text-[var(--retro-white)]">{owner.name}</div>
                  <div className="text-[8px] text-[var(--retro-gray)] sm:hidden mt-0.5">
                    {owner.playersRemaining} alive | {owner.avgPPG} ppg
                  </div>
                </td>
                <td className="py-2.5 px-2 text-right text-[var(--retro-green)] text-glow tabular-nums text-sm sm:text-base">
                  {owner.totalPoints}
                </td>
                <td className="py-2.5 px-2 text-right hidden sm:table-cell">
                  <span
                    className={
                      owner.playersRemaining > 0
                        ? "text-[var(--retro-green)]"
                        : "text-[var(--retro-red)]"
                    }
                  >
                    {owner.playersRemaining}
                  </span>
                </td>
                <td className="py-2.5 px-2 text-right hidden sm:table-cell text-[var(--retro-cyan)] tabular-nums">
                  {owner.avgPPG}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Tab 2: Team Rosters ───────────────────────────────────────

function Rosters({ owners }) {
  const [expanded, setExpanded] = useState({});

  const toggle = (name) => {
    sfxToggle();
    setExpanded((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  return (
    <div className="space-y-3">
      {owners.map((owner) => {
        const isOpen = expanded[owner.name] !== false;
        return (
          <div key={owner.name} className="retro-panel overflow-hidden">
            <button
              onClick={() => toggle(owner.name)}
              className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-[var(--retro-border)]/10 transition-none"
            >
              <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs">
                <span className="text-[var(--retro-gray)] w-5">
                  <RankBadge rank={owner.rank} />
                </span>
                <span className="text-[var(--retro-white)]">{owner.name}</span>
                <span className="text-[var(--retro-gold)] text-glow">
                  {owner.totalPoints} PTS
                </span>
              </div>
              <span
                className={`text-[var(--retro-cyan)] text-xs transition-transform ${
                  isOpen ? "rotate-90" : ""
                }`}
              >
                &#9654;
              </span>
            </button>

            {isOpen && (
              <div className="border-t-2 border-[var(--retro-border)]/50">
                <table className="w-full text-[9px] sm:text-[10px]">
                  <thead>
                    <tr className="text-[var(--retro-cyan)] border-b border-[var(--retro-border)]/30">
                      <th className="py-1.5 px-3 text-left">NAME</th>
                      <th className="py-1.5 px-2 text-left hidden sm:table-cell">
                        TEAM
                      </th>
                      <th className="py-1.5 px-2 text-right">PTS</th>
                      <th className="py-1.5 px-2 text-right">GP</th>
                      <th className="py-1.5 px-2 text-right">STS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {owner.players.map((p) => (
                      <tr
                        key={p.name}
                        className="retro-row border-b border-[var(--retro-border)]/20 last:border-0"
                      >
                        <td className="py-1.5 px-3">
                          <div className="flex items-center gap-1">
                            {p.unmatched && (
                              <span
                                className="text-[var(--retro-gold)]"
                                title="Not matched in ESPN data"
                              >
                                &#9888;
                              </span>
                            )}
                            <span>{p.name}</span>
                            <span className="text-[var(--retro-gray)] text-[7px]">
                              #{p.pick}
                            </span>
                          </div>
                          <div className="text-[7px] text-[var(--retro-gray)] sm:hidden">
                            {p.team}
                          </div>
                        </td>
                        <td className="py-1.5 px-2 text-[var(--retro-gray)] hidden sm:table-cell">
                          {p.team}
                        </td>
                        <td className="py-1.5 px-2 text-right text-[var(--retro-green)] tabular-nums">
                          {p.totalPoints}
                        </td>
                        <td className="py-1.5 px-2 text-right text-[var(--retro-gray)] tabular-nums">
                          {p.gamesPlayed}
                        </td>
                        <td className="py-1.5 px-2 text-right">
                          {p.eliminated ? (
                            <span className="text-[var(--retro-red)] text-[8px] sm:text-[9px]">
                              [DEAD]
                            </span>
                          ) : (
                            <span className="text-[var(--retro-green)] text-[8px] sm:text-[9px]">
                              [LIVE]
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

// ─── Tab 3: Game Log ───────────────────────────────────────────

function GameLog({ owners }) {
  const [filter, setFilter] = useState("all");

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

  const filtered =
    filter === "all" ? allGames : allGames.filter((g) => g.owner === filter);

  filtered.sort((a, b) => {
    const dateComp = new Date(b.date) - new Date(a.date);
    if (dateComp !== 0) return dateComp;
    return b.points - a.points;
  });

  return (
    <div>
      <div className="mb-4">
        <select
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            sfxSelect();
          }}
          className="bg-[var(--retro-panel)] border-2 border-[var(--retro-border)] text-[var(--retro-white)] text-[10px] sm:text-xs px-3 py-2 focus:outline-none focus:border-[var(--retro-gold)]"
          style={{ fontFamily: "'Press Start 2P', monospace" }}
        >
          <option value="all">&#9654; ALL OWNERS</option>
          {owners.map((o) => (
            <option key={o.name} value={o.name}>
              {o.name.toUpperCase()}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-[var(--retro-gray)] text-xs">
            NO GAME DATA YET
          </p>
          <p className="text-[var(--retro-gold)] text-[10px] mt-2 blink">
            WAITING FOR TIP-OFF...
          </p>
        </div>
      ) : (
        <div className="retro-panel p-1 sm:p-2">
          <div className="text-xs sm:text-sm text-[var(--retro-gold)] px-3 py-2 border-b-2 border-[var(--retro-border)]">
            &#9632; GAME LOG
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[9px] sm:text-[10px]">
              <thead>
                <tr className="text-[var(--retro-cyan)] border-b-2 border-[var(--retro-border)]/50">
                  <th className="py-2 px-2 text-left">PLAYER</th>
                  <th className="py-2 px-2 text-left hidden sm:table-cell">
                    OWNER
                  </th>
                  <th className="py-2 px-2 text-left">RND</th>
                  <th className="py-2 px-2 text-left hidden sm:table-cell">
                    VS
                  </th>
                  <th className="py-2 px-2 text-right">PTS</th>
                  <th className="py-2 px-2 text-right">DATE</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 200).map((g, i) => (
                  <tr
                    key={`${g.gameId}-${g.player}-${i}`}
                    className="retro-row border-b border-[var(--retro-border)]/20"
                  >
                    <td className="py-1.5 px-2">
                      <div>{g.player}</div>
                      <div className="text-[7px] text-[var(--retro-gray)] sm:hidden">
                        {g.owner}
                      </div>
                    </td>
                    <td className="py-1.5 px-2 text-[var(--retro-gray)] hidden sm:table-cell">
                      {g.owner}
                    </td>
                    <td className="py-1.5 px-2 text-[var(--retro-purple)]">
                      {g.round}
                    </td>
                    <td className="py-1.5 px-2 text-[var(--retro-gray)] hidden sm:table-cell">
                      vs {g.opponent}
                    </td>
                    <td className="py-1.5 px-2 text-right text-[var(--retro-green)] tabular-nums">
                      {g.points}
                    </td>
                    <td className="py-1.5 px-2 text-right text-[var(--retro-gray)]">
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
              <p className="text-[var(--retro-gray)] text-center text-[8px] py-2">
                SHOWING 200 OF {filtered.length} ENTRIES
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
