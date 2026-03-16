"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import RetroBackground from "@/app/RetroBackground";
import DraftBoard from "../components/DraftBoard";
import DraftHeader from "../components/DraftHeader";
import PickTimer from "../components/PickTimer";
import TeamBanner from "../components/TeamBanner";
import PlayerPool from "../components/PlayerPool";

export default function TeamDraftPage() {
  const params = useParams();
  const token = params.token;

  const [draftState, setDraftState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [invalidToken, setInvalidToken] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const retryCountRef = useRef(0);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch("/api/draft/state");
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Check if token is valid
      const myTeam = data.order?.find((t) => t.token === token);
      if (!myTeam && data.order?.length > 0) {
        setInvalidToken(true);
      }

      setDraftState(data);
      setLastUpdated(new Date());
      setError("");
      retryCountRef.current = 0;
    } catch (e) {
      setError(e.message);
      // Retry on initial load failure (up to 3 times)
      if (retryCountRef.current < 3 && !draftState) {
        retryCountRef.current++;
        const delay = Math.pow(2, retryCountRef.current) * 1000;
        setTimeout(fetchState, delay);
      }
    } finally {
      setLoading(false);
    }
  }, [token, draftState]);

  // Initial load
  useEffect(() => {
    fetchState();
  }, []);

  // Adaptive polling: 3s your turn, 5s active, 30s inactive
  useEffect(() => {
    if (!draftState) return;
    const status = draftState.config?.status;
    const currentTeam = draftState.currentTeam;
    const isMyTurn = currentTeam && currentTeam.token === token;
    const isActive = status === "active";

    let interval;
    if (isActive && isMyTurn) {
      interval = 3000;
    } else if (isActive) {
      interval = 5000;
    } else {
      interval = 30000;
    }

    const timer = setInterval(fetchState, interval);
    return () => clearInterval(timer);
  }, [draftState?.config?.status, draftState?.currentTeam?.token, token, fetchState]);

  // Visibility API: immediate fetch when tab becomes visible
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchState();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [fetchState]);

  // Online/offline detection
  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => {
      setIsOffline(false);
      fetchState();
    };
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, [fetchState]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a2a] flex items-center justify-center font-['Press_Start_2P']">
        <RetroBackground />
        <p className="text-[#f5c542] text-sm animate-pulse relative z-10">
          LOADING DRAFT...
        </p>
      </div>
    );
  }

  // Invalid token screen
  if (invalidToken) {
    return (
      <div className="min-h-screen bg-[#0a0a2a] flex items-center justify-center font-['Press_Start_2P']">
        <RetroBackground />
        <div className="retro-panel p-6 text-center relative z-10 max-w-md">
          <p className="text-base text-red-400 mb-3">ACCESS DENIED</p>
          <p className="text-xs text-gray-400 mb-4">
            INVALID DRAFT TOKEN. CHECK YOUR LINK.
          </p>
          <a
            href="/draft"
            className="text-xs text-[#f5c542] hover:underline"
          >
            VIEW PUBLIC DRAFT BOARD &gt;&gt;
          </a>
        </div>
      </div>
    );
  }

  const config = draftState?.config || {};
  const order = draftState?.order || [];
  const picks = draftState?.picks || [];
  const currentTeam = draftState?.currentTeam;
  const currentRound = draftState?.currentRound || 0;
  const myTeam = order.find((t) => t.token === token) || null;
  const isMyTurn = myTeam && currentTeam && currentTeam.token === token;
  const canPick = isMyTurn && config.status === "active";

  return (
    <div className="min-h-screen bg-[#0a0a2a] text-[#e8d5a3] font-['Press_Start_2P'] relative">
      <RetroBackground />
      <div className="scanlines" />

      <div className="relative z-10 max-w-6xl mx-auto p-2 sm:p-4">
        {/* Title */}
        <div className="text-center mb-4 pt-4">
          <h1 className="text-base sm:text-lg text-[#f5c542] mb-1 glow-text">
            MARCH MADNESS DRAFT
          </h1>
          <p className="text-xs text-gray-400">
            SNAKE DRAFT &bull; 12 TEAMS &bull; 10 ROUNDS
          </p>
          {lastUpdated && (
            <p className="text-[10px] text-gray-500 mt-1">
              LAST UPDATE: {lastUpdated.toLocaleTimeString()}
              <span className="blink ml-1">_</span>
            </p>
          )}
        </div>

        {isOffline && (
          <div className="retro-panel p-3 mb-4 border-orange-500 border text-center animate-pulse">
            <p className="text-xs text-orange-400">CONNECTION LOST — WAITING TO RECONNECT...</p>
          </div>
        )}

        {error && !isOffline && (
          <div className="retro-panel p-3 mb-4 border-red-500 border text-center">
            <p className="text-xs text-red-400">ERROR: {error}</p>
          </div>
        )}

        {/* Not Setup */}
        {config.status === "not_setup" && (
          <div className="retro-panel p-6 text-center">
            <p className="text-sm text-gray-400 mb-2">
              DRAFT NOT YET CONFIGURED
            </p>
            <p className="text-xs text-gray-500">
              CHECK BACK WHEN THE ADMIN SETS UP THE DRAFT
            </p>
          </div>
        )}

        {/* Draft Content */}
        {config.status && config.status !== "not_setup" && (
          <>
            <PickTimer deadline={config.draftDeadline} status={config.status} />

            {/* Team Banner (your identity + turn status) */}
            <TeamBanner
              myTeam={myTeam}
              currentTeam={currentTeam}
              picks={picks}
              config={config}
            />

            <DraftHeader
              config={config}
              currentTeam={currentTeam}
              currentRound={currentRound}
              myTeam={myTeam}
            />

            {/* Player Pool (only shown when draft is active) */}
            {config.status === "active" && (
              <PlayerPool
                canPick={canPick}
                token={token}
                onPickMade={() => fetchState()}
              />
            )}

            <DraftBoard
              order={order}
              picks={picks}
              config={config}
              myTeam={myTeam}
            />

            {/* Recent Picks */}
            {picks.length > 0 && (
              <div className="retro-panel p-3 sm:p-4 mb-4">
                <h2 className="text-xs sm:text-sm text-[#00bcd4] mb-3">
                  RECENT PICKS
                </h2>
                <div className="space-y-1 max-h-[200px] overflow-y-auto custom-scrollbar">
                  {[...picks]
                    .reverse()
                    .slice(0, 20)
                    .map((p) => (
                      <div
                        key={p.pickNumber}
                        className={`flex items-center gap-2 text-[10px] sm:text-xs p-1 rounded ${
                          p.teamToken === token
                            ? "bg-[#f5c542]/10 border border-[#f5c542]/20"
                            : "bg-[#0a0a2a]"
                        }`}
                      >
                        <span className="text-gray-500 w-8">#{p.pickNumber}</span>
                        <span className="text-gray-400 w-10">R{p.round}</span>
                        <span
                          className={`w-20 truncate ${
                            p.teamToken === token ? "text-[#f5c542]" : "text-gray-400"
                          }`}
                        >
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
        <div className="text-center mt-6 pb-8 space-y-2">
          <a
            href="/draft"
            className="text-xs text-gray-400 hover:text-[#f5c542] transition-colors block"
          >
            VIEW PUBLIC DRAFT BOARD &gt;&gt;
          </a>
          <a
            href="/"
            className="text-xs text-gray-400 hover:text-[#f5c542] transition-colors block"
          >
            &lt;&lt; BACK TO STANDINGS
          </a>
        </div>
      </div>
    </div>
  );
}
