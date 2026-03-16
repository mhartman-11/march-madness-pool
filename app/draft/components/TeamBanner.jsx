"use client";

import { useEffect, useRef } from "react";

export default function TeamBanner({ myTeam, currentTeam, picks, config }) {
  const prevTurnRef = useRef(false);
  const isMyTurn = myTeam && currentTeam && currentTeam.token === myTeam.token;
  const status = config?.status || "";

  // Play sound when it becomes user's turn
  useEffect(() => {
    if (isMyTurn && !prevTurnRef.current && status === "active") {
      try {
        // Ascending arpeggio alert
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
        notes.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "square";
          osc.frequency.value = freq;
          gain.gain.value = 0.08;
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15 + i * 0.12);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + i * 0.12);
          osc.stop(ctx.currentTime + 0.2 + i * 0.12);
        });
      } catch (e) {
        // Audio not available
      }
    }
    prevTurnRef.current = isMyTurn;
  }, [isMyTurn, status]);

  if (!myTeam) return null;

  // Get my picks
  const myPicks = picks?.filter((p) => p.teamToken === myTeam.token) || [];

  return (
    <div className="retro-panel p-3 sm:p-4 mb-4">
      {/* Identity */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs text-gray-400">YOU ARE</p>
          <p className="text-sm sm:text-base text-[#f5c542]">
            {myTeam.name?.toUpperCase()}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">DRAFT POS</p>
          <p className="text-sm text-[#00bcd4]">#{myTeam.draftPosition}</p>
        </div>
      </div>

      {/* Turn Indicator */}
      {status === "active" && (
        <div
          className={`p-2 rounded text-center mb-3 ${
            isMyTurn
              ? "bg-[#f5c542]/20 border-2 border-[#f5c542] your-turn"
              : "bg-[#0a0a2a]"
          }`}
        >
          {isMyTurn ? (
            <>
              <p className="text-sm sm:text-base text-[#f5c542] font-bold animate-pulse">
                YOUR TURN! MAKE YOUR PICK!
              </p>
              <p className="text-xs text-[#f5c542]/70 mt-1">
                SELECT A PLAYER BELOW
              </p>
            </>
          ) : (
            <p className="text-xs text-gray-400">
              WAITING FOR {currentTeam?.name?.toUpperCase() || "..."}
            </p>
          )}
        </div>
      )}

      {/* My Drafted Players */}
      {myPicks.length > 0 && (
        <div>
          <p className="text-xs text-[#00bcd4] mb-2">
            YOUR ROSTER ({myPicks.length}/10)
          </p>
          <div className="space-y-1">
            {myPicks.map((p) => (
              <div
                key={p.pickNumber}
                className="flex items-center justify-between text-xs p-1 bg-[#0a0a2a] rounded"
              >
                <span className="text-gray-400 w-8">R{p.round}</span>
                <span className="text-[#e8d5a3] flex-1">{p.playerName}</span>
                <span className="text-gray-400">{p.playerTeam}</span>
                {p.isAutoPick && (
                  <span className="text-orange-400 ml-1">[A]</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
