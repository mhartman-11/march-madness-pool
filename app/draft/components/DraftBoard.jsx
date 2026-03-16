"use client";

import { TOTAL_ROUNDS, TOTAL_TEAMS } from "@/lib/draftLogic";

export default function DraftBoard({ order, picks, config, myTeam }) {
  const currentPick = config?.currentPick || 0;
  const status = config?.status || "";

  // Build a grid: picks organized by round and draft position
  // Create a map for quick lookup: `round-teamToken` -> pick data
  const pickMap = new Map();
  for (const p of picks) {
    pickMap.set(`${p.round}-${p.teamToken}`, p);
  }

  // Determine which pick slot is "on the clock"
  // We need to find the next empty slot
  const getPickForCell = (round, teamIndex) => {
    if (!order[teamIndex]) return null;
    const token = order[teamIndex].token;
    return pickMap.get(`${round}-${token}`) || null;
  };

  return (
    <div className="retro-panel p-2 sm:p-4 mb-4 overflow-x-auto">
      <h2 className="text-xs sm:text-sm text-[#00bcd4] mb-3 text-center">
        DRAFT BOARD
      </h2>

      <div className="min-w-[700px]">
        {/* Header row: team names */}
        <div className="grid gap-[2px]" style={{ gridTemplateColumns: `40px repeat(${TOTAL_TEAMS}, 1fr)` }}>
          <div className="text-[8px] text-gray-500 p-1" />
          {order.map((team, i) => (
            <div
              key={team.token || i}
              className={`text-[8px] sm:text-[10px] p-1 text-center truncate rounded-t ${
                myTeam && team.token === myTeam.token
                  ? "bg-[#f5c542]/20 text-[#f5c542]"
                  : "bg-[#12123a] text-[#00bcd4]"
              }`}
              title={team.name}
            >
              {team.name?.slice(0, 6).toUpperCase()}
            </div>
          ))}
        </div>

        {/* Draft grid: rows = rounds */}
        {Array.from({ length: TOTAL_ROUNDS }, (_, roundIdx) => {
          const round = roundIdx + 1;
          const isReversed = round % 2 === 0;

          return (
            <div
              key={round}
              className="grid gap-[2px]"
              style={{ gridTemplateColumns: `40px repeat(${TOTAL_TEAMS}, 1fr)` }}
            >
              {/* Round label */}
              <div className="flex items-center justify-center text-[10px] text-gray-500 p-1">
                <span>R{round}</span>
                <span className="ml-1 text-[8px]">
                  {isReversed ? "◄" : "►"}
                </span>
              </div>

              {/* Cells for each team in this round */}
              {Array.from({ length: TOTAL_TEAMS }, (_, colIdx) => {
                // Snake order: even rounds are reversed
                const teamIndex = isReversed
                  ? TOTAL_TEAMS - 1 - colIdx
                  : colIdx;
                const pick = getPickForCell(round, teamIndex);
                const pickNum = (round - 1) * TOTAL_TEAMS + colIdx + 1;
                const isCurrentPick = status === "active" && pickNum === currentPick;
                const isMyCell =
                  myTeam && order[teamIndex]?.token === myTeam.token;

                return (
                  <div
                    key={colIdx}
                    className={`draft-cell p-1 rounded text-center min-h-[40px] sm:min-h-[46px] flex flex-col items-center justify-center transition-all ${
                      isCurrentPick
                        ? "on-the-clock border border-[#f5c542]"
                        : pick
                        ? isMyCell
                          ? "bg-[#f5c542]/10 border border-[#f5c542]/30"
                          : pick.isAutoPick
                          ? "bg-[#2a1a3a] border border-purple-500/30"
                          : "bg-[#1a2a1a] border border-green-500/30"
                        : "bg-[#0a0a2a] border border-[#1a1a4a]"
                    }`}
                  >
                    {pick ? (
                      <>
                        <span className="text-[8px] sm:text-[10px] text-[#e8d5a3] leading-tight truncate w-full">
                          {pick.playerName?.split(" ").pop()}
                        </span>
                        <span className="text-[7px] sm:text-[8px] text-gray-400 truncate w-full">
                          {pick.playerTeam?.slice(0, 10)}
                        </span>
                        {pick.isAutoPick && (
                          <span className="text-[7px] text-purple-400">AUTO</span>
                        )}
                      </>
                    ) : (
                      <span className="text-[8px] text-gray-600">
                        {pickNum}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-3 flex-wrap">
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 bg-[#1a2a1a] border border-green-500/30 rounded" />
          <span className="text-[10px] text-gray-400">PICKED</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 bg-[#2a1a3a] border border-purple-500/30 rounded" />
          <span className="text-[10px] text-gray-400">AUTO-PICK</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 border border-[#f5c542] rounded on-the-clock" />
          <span className="text-[10px] text-gray-400">ON CLOCK</span>
        </div>
      </div>
    </div>
  );
}
