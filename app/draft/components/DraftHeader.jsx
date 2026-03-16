"use client";

export default function DraftHeader({ config, currentTeam, currentRound, myTeam }) {
  const status = config?.status || "not_setup";
  const currentPick = config?.currentPick || 0;
  const totalPicks = config?.totalPicks || 110;

  const isMyTurn = myTeam && currentTeam && currentTeam.token === myTeam.token;

  return (
    <div className="retro-panel p-3 sm:p-4 mb-4">
      {/* Status Bar */}
      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              status === "active"
                ? "bg-green-400 animate-pulse"
                : status === "completed"
                ? "bg-purple-400"
                : "bg-gray-500"
            }`}
          />
          <span className="text-[9px] sm:text-[10px] text-[#00bcd4]">
            {status === "active"
              ? "DRAFT LIVE"
              : status === "completed"
              ? "DRAFT COMPLETE"
              : status === "ready"
              ? "DRAFT READY"
              : "DRAFT SETUP"}
          </span>
        </div>
        {status === "active" && (
          <span className="text-[8px] sm:text-[9px] text-gray-400">
            PICK {currentPick} OF {totalPicks}
          </span>
        )}
      </div>

      {/* Round / Pick Info */}
      {status === "active" && currentTeam && (
        <div className="space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-[8px] sm:text-[9px] text-gray-400">
              ROUND {currentRound} &bull; PICK {((currentPick - 1) % 11) + 1} OF 11
            </span>
          </div>

          {/* On The Clock */}
          <div
            className={`p-2 sm:p-3 text-center rounded ${
              isMyTurn
                ? "bg-[#f5c542]/20 border border-[#f5c542] on-the-clock"
                : "bg-[#0a0a2a]"
            }`}
          >
            <p className="text-[8px] text-gray-400 mb-1">ON THE CLOCK</p>
            <p
              className={`text-[10px] sm:text-xs ${
                isMyTurn ? "text-[#f5c542] font-bold" : "text-[#e8d5a3]"
              }`}
            >
              {currentTeam.name?.toUpperCase()}
            </p>
            {isMyTurn && (
              <p className="text-[8px] text-[#f5c542] mt-1 animate-pulse">
                &#9660; YOUR PICK &#9660;
              </p>
            )}
          </div>
        </div>
      )}

      {status === "completed" && (
        <div className="text-center p-2">
          <p className="text-[10px] text-[#f5c542] glow-text">
            ALL {totalPicks} PICKS COMPLETE
          </p>
          <p className="text-[8px] text-gray-400 mt-1">
            <a href="/" className="hover:text-[#f5c542] transition-colors">
              VIEW STANDINGS &gt;&gt;
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
