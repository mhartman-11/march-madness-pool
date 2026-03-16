"use client";

import { useState, useEffect, useCallback } from "react";

export default function PlayerPool({ canPick, token, onPickMade }) {
  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [search, setSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [posFilter, setPosFilter] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [picking, setPicking] = useState(false);
  const [confirmPlayer, setConfirmPlayer] = useState(null);
  const [error, setError] = useState("");

  const fetchPlayers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (teamFilter) params.set("team", teamFilter);
      if (posFilter) params.set("position", posFilter);
      params.set("page", String(page));

      const res = await fetch(`/api/draft/players?${params}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setPlayers(data.players || []);
      setTeams(data.teams || []);
      setHasMore(data.hasMore || false);
      setTotal(data.total || 0);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [search, teamFilter, posFilter, page]);

  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, teamFilter, posFilter]);

  async function handleDraft(player) {
    setPicking(true);
    setError("");
    try {
      const res = await fetch("/api/draft/pick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, playerId: player.id }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Play pick sound
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.value = 880;
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15);
        gain.gain.value = 0.1;
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      } catch (e) {}

      setConfirmPlayer(null);
      if (onPickMade) onPickMade(data.pick);
      fetchPlayers(); // Refresh available players
    } catch (e) {
      setError(e.message);
    } finally {
      setPicking(false);
    }
  }

  return (
    <div className="retro-panel p-2 sm:p-4 mb-4">
      <h2 className="text-xs sm:text-sm text-[#00bcd4] mb-3">
        AVAILABLE PLAYERS
        <span className="text-gray-400 ml-2">({total})</span>
      </h2>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="SEARCH NAME/TEAM..."
          className="retro-input flex-1 p-2 text-xs bg-[#0a0a2a] border-2 border-[#1a1a4a] text-[#e8d5a3] rounded focus:border-[#f5c542] outline-none font-['Press_Start_2P']"
        />
        <select
          value={teamFilter}
          onChange={(e) => setTeamFilter(e.target.value)}
          className="retro-input p-2 text-[10px] sm:text-xs bg-[#0a0a2a] border-2 border-[#1a1a4a] text-[#e8d5a3] rounded focus:border-[#f5c542] outline-none font-['Press_Start_2P']"
        >
          <option value="">ALL TEAMS</option>
          {teams.map((t) => (
            <option key={t} value={t}>
              {t.toUpperCase()}
            </option>
          ))}
        </select>
      </div>

      {/* Position Filters */}
      <div className="flex gap-2 mb-3">
        {[
          { label: "ALL", value: "" },
          { label: "G", value: "g" },
          { label: "F", value: "f" },
          { label: "C", value: "c" },
        ].map((pos) => (
          <button
            key={pos.value}
            onClick={() => setPosFilter(pos.value)}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              posFilter === pos.value
                ? "bg-[#f5c542] text-[#0a0a2a]"
                : "bg-[#0a0a2a] text-gray-400 hover:text-[#e8d5a3]"
            }`}
          >
            {pos.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="text-xs text-red-400 mb-2">ERROR: {error}</p>
      )}

      {/* Player List */}
      <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
        {/* Table Header */}
        <div className="grid grid-cols-[1fr_80px_35px_40px_65px] sm:grid-cols-[1fr_130px_60px_40px_50px_60px_70px] gap-1 p-2 text-[10px] sm:text-xs text-[#00bcd4] border-b border-[#1a1a4a] sticky top-0 bg-[#12123a]">
          <span>NAME</span>
          <span>TEAM</span>
          <span className="hidden sm:block">POS</span>
          <span>SEED</span>
          <span>PPG</span>
          <span className="hidden sm:block">STATUS</span>
          <span className="text-center">
            {canPick ? "DRAFT" : ""}
          </span>
        </div>

        {loading ? (
          <div className="text-center p-4">
            <span className="text-xs text-gray-400 animate-pulse">
              LOADING...
            </span>
          </div>
        ) : players.length === 0 ? (
          <div className="text-center p-4">
            <span className="text-xs text-gray-400">NO PLAYERS FOUND</span>
          </div>
        ) : (
          players.map((player) => (
            <div
              key={player.id}
              className={`grid grid-cols-[1fr_80px_35px_40px_65px] sm:grid-cols-[1fr_130px_60px_40px_50px_60px_70px] gap-1 p-2 text-[10px] sm:text-xs border-b border-[#0a0a2a] hover:bg-[#1a1a3a] transition-colors items-center ${
                player.injuryStatus ? "opacity-80" : ""
              }`}
            >
              <span className="text-[#e8d5a3] truncate">
                {player.name}
                {player.injuryStatus && (
                  <span className="sm:hidden text-red-400 ml-1 text-[8px]">
                    [{player.injuryStatus}]
                  </span>
                )}
              </span>
              <span className="text-gray-400 truncate">{player.team}</span>
              <span className="text-gray-400 hidden sm:block">
                {player.position?.slice(0, 5)}
              </span>
              <span className="text-[#00bcd4]">#{player.seed}</span>
              <span className="text-[#f5c542]">
                {player.ppg != null ? player.ppg.toFixed(1) : "—"}
              </span>
              <span
                className={`hidden sm:block text-[10px] truncate ${
                  player.injuryStatus ? "text-red-400" : "text-green-400"
                }`}
              >
                {player.injuryStatus || "ACTIVE"}
              </span>
              <div className="text-center">
                {canPick && (
                  <button
                    onClick={() => setConfirmPlayer(player)}
                    disabled={picking}
                    className="px-2 py-1 text-[10px] sm:text-xs bg-green-700 text-white rounded hover:bg-green-500 transition-colors disabled:opacity-50"
                  >
                    DRAFT
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {(hasMore || page > 1) && (
        <div className="flex items-center justify-center gap-3 mt-3">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="text-xs text-gray-400 hover:text-[#f5c542] disabled:opacity-30"
          >
            &lt;&lt; PREV
          </button>
          <span className="text-xs text-gray-400">PAGE {page}</span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={!hasMore}
            className="text-xs text-gray-400 hover:text-[#f5c542] disabled:opacity-30"
          >
            NEXT &gt;&gt;
          </button>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmPlayer && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="retro-panel p-4 sm:p-6 max-w-sm w-full text-center">
            <p className="text-xs text-gray-400 mb-3">CONFIRM SELECTION</p>
            <p className="text-sm sm:text-base text-[#f5c542] mb-1">
              {confirmPlayer.name}
            </p>
            <p className="text-xs text-gray-400 mb-1">
              {confirmPlayer.team} &bull; {confirmPlayer.position}
            </p>
            <p className="text-xs text-gray-400 mb-1">
              #{confirmPlayer.seed} SEED &bull;{" "}
              {confirmPlayer.ppg != null ? `${confirmPlayer.ppg.toFixed(1)} PPG` : "— PPG"}
            </p>
            {confirmPlayer.injuryStatus && (
              <p className="text-xs text-red-400 mb-1">
                {confirmPlayer.injuryStatus}
                {confirmPlayer.injuryDesc ? ` — ${confirmPlayer.injuryDesc}` : ""}
              </p>
            )}
            <div className="mb-4" />

            <div className="flex gap-3 justify-center">
              <button
                onClick={() => handleDraft(confirmPlayer)}
                disabled={picking}
                className="pixel-btn px-4 py-2 text-xs bg-green-700 hover:bg-green-500 text-white transition-colors disabled:opacity-50"
              >
                {picking ? "DRAFTING..." : "CONFIRM"}
              </button>
              <button
                onClick={() => setConfirmPlayer(null)}
                disabled={picking}
                className="pixel-btn px-4 py-2 text-xs hover:bg-red-500 hover:text-white transition-colors"
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
