"use client";

import { useState, useEffect, useCallback } from "react";
import RetroBackground from "@/app/RetroBackground";
import DraftBoard from "./components/DraftBoard";
import DraftHeader from "./components/DraftHeader";
import PickTimer from "./components/PickTimer";

export default function DraftPage() {
  const [draftState, setDraftState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch("/api/draft/state");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setDraftState(data);
      setLastUpdated(new Date());
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchState();
  }, [fetchState]);

  // Poll every 5 seconds when draft is active
  useEffect(() => {
    if (!draftState) return;
    const isActive = draftState.config?.status === "active";
    const interval = isActive ? 5000 : 30000;

    const timer = setInterval(fetchState, interval);
    return () => clearInterval(timer);
  }, [draftState?.config?.status, fetchState]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a2a] flex items-center justify-center font-['Press_Start_2P']">
        <RetroBackground />
        <p className="text-[#f5c542] text-xs animate-pulse relative z-10">
          LOADING DRAFT...
        </p>
      </div>
    );
  }

  const config = draftState?.config || {};
  const order = draftState?.order || [];
  const picks = draftState?.picks || [];
  const currentTeam = draftState?.currentTeam;
  const currentRound = draftState?.currentRound || 0;

  return (
    <div className="min-h-screen bg-[#0a0a2a] text-[#e8d5a3] font-['Press_Start_2P'] relative">
      <RetroBackground />
      <div className="scanlines" />

      <div className="relative z-10 max-w-6xl mx-auto p-2 sm:p-4">
        {/* Title */}
        <div className="text-center mb-4 pt-4">
          <h1 className="text-sm sm:text-base text-[#f5c542] mb-1 glow-text">
            MARCH MADNESS DRAFT
          </h1>
          <p className="text-[7px] sm:text-[8px] text-gray-400">
            SNAKE DRAFT &bull; 12 TEAMS &bull; 10 ROUNDS
          </p>
          {lastUpdated && (
            <p className="text-[6px] text-gray-500 mt-1">
              LAST UPDATE: {lastUpdated.toLocaleTimeString()}
              <span className="blink ml-1">_</span>
            </p>
          )}
        </div>

        {error && (
          <div className="retro-panel p-3 mb-4 border-red-500 border text-center">
            <p className="text-[8px] text-red-400">ERROR: {error}</p>
          </div>
        )}

        {/* Not Setup */}
        {config.status === "not_setup" && (
          <div className="retro-panel p-6 text-center">
            <p className="text-[10px] text-gray-400 mb-2">
              DRAFT NOT YET CONFIGURED
            </p>
            <p className="text-[8px] text-gray-500">
              CHECK BACK WHEN THE ADMIN SETS UP THE DRAFT
            </p>
          </div>
        )}

        {/* Draft Content */}
        {config.status && config.status !== "not_setup" && (
          <>
            <PickTimer deadline={config.draftDeadline} status={config.status} />
            <DraftHeader
              config={config}
              currentTeam={currentTeam}
              currentRound={currentRound}
            />
            <DraftBoard
              order={order}
              picks={picks}
              config={config}
            />

            {/* Recent Picks */}
            {picks.length > 0 && (
              <div className="retro-panel p-3 sm:p-4 mb-4">
                <h2 className="text-[9px] sm:text-[10px] text-[#00bcd4] mb-3">
                  RECENT PICKS
                </h2>
                <div className="space-y-1 max-h-[200px] overflow-y-auto custom-scrollbar">
                  {[...picks]
                    .reverse()
                    .slice(0, 20)
                    .map((p) => (
                      <div
                        key={p.pickNumber}
                        className="flex items-center gap-2 text-[7px] sm:text-[8px] p-1 bg-[#0a0a2a] rounded"
                      >
                        <span className="text-gray-500 w-8">#{p.pickNumber}</span>
                        <span className="text-gray-400 w-10">R{p.round}</span>
                        <span className="text-[#f5c542] w-20 truncate">
                          {p.teamName}
                        </span>
                        <span className="text-[#e8d5a3] flex-1 truncate">
                          {p.playerName}
                        </span>
                        <span className="text-gray-400 truncate">
                          {p.playerTeam}
                        </span>
                        {p.isAutoPick && (
                          <span className="text-purple-400">[AUTO]</span>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Navigation */}
        <div className="text-center mt-6 pb-8">
          <a
            href="/"
            className="text-[8px] text-gray-400 hover:text-[#f5c542] transition-colors"
          >
            &lt;&lt; BACK TO STANDINGS
          </a>
        </div>
      </div>
    </div>
  );
}
