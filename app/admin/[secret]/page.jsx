"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

export default function AdminDashboard() {
  const params = useParams();
  const secret = params.secret;

  const [status, setStatus] = useState(null);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [playerCount, setPlayerCount] = useState(0);
  const [draftOrder, setDraftOrder] = useState([]);
  const [copied, setCopied] = useState("");

  const headers = { "x-admin-secret": secret, "Content-Type": "application/json" };

  // Load current state on mount
  useEffect(() => {
    fetchState();
  }, []);

  async function fetchState() {
    try {
      const res = await fetch("/api/draft/state");
      const data = await res.json();
      setStatus(data.config?.status || "not_setup");
      if (data.order?.length > 0) {
        setDraftOrder(data.order);
        // Build team links from order data so they persist across page loads
        const host = window.location.host;
        const protocol = window.location.protocol;
        setTeams(data.order.map(t => ({
          name: t.name,
          token: t.token,
          link: `${protocol}//${host}/draft/${t.token}`,
        })));
      }
      if (data.config?.currentPick) {
        setPlayerCount(data.picks?.length || 0);
      }
    } catch (e) {
      console.error("Failed to fetch state:", e);
    }
  }

  async function handleSetup() {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/setup", {
        method: "POST",
        headers,
        body: JSON.stringify({
          teams: [
            "Lee", "Wojo", "Koehler", "Webb", "Sam", "Kevin",
            "McPeppers", "Jeremy", "Blake", "Hartman", "Zach", "Schutt",
          ],
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setTeams(data.teams);
      setDraftOrder([]);
      setMessage("Draft setup complete! Team links generated.");
      setStatus("setup");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLoadPlayers() {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/load-players", {
        method: "POST",
        headers,
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPlayerCount(data.playerCount);
      setMessage(`Loaded ${data.playerCount} players from ${data.teamCount} teams.`);
      setStatus("ready");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleStartDraft() {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/start", {
        method: "POST",
        headers,
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setDraftOrder(data.draftOrder);
      setMessage("Draft is LIVE! Fixed order set.");
      setStatus("active");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAutoPick() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/autopick", {
        method: "POST",
        headers,
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMessage(`Auto-picked: ${data.pick.playerName} (${data.pick.playerTeam}) for ${data.pick.teamName}`);
      fetchState();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAutoFillAll() {
    if (!confirm("This will auto-fill ALL remaining picks. Are you sure?")) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/autopick", {
        method: "POST",
        headers,
        body: JSON.stringify({ fillAll: true }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMessage(data.message);
      setStatus("completed");
      fetchState();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function copyLink(link) {
    navigator.clipboard.writeText(link);
    setCopied(link);
    setTimeout(() => setCopied(""), 2000);
  }

  const statusColors = {
    not_setup: "text-gray-400",
    setup: "text-yellow-400",
    ready: "text-cyan-400",
    active: "text-green-400",
    completed: "text-purple-400",
  };

  return (
    <div className="min-h-screen bg-[#0a0a2a] text-[#e8d5a3] font-['Press_Start_2P'] p-4 sm:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="retro-panel p-5 mb-6 text-center">
          <h1 className="text-base sm:text-lg text-[#f5c542] mb-2">
            ADMIN CONSOLE
          </h1>
          <p className="text-xs text-gray-400">MARCH MADNESS DRAFT CONTROL</p>
        </div>

        {/* Status */}
        <div className="retro-panel p-4 mb-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs sm:text-sm">STATUS:</span>
            <span className={`text-xs sm:text-sm ${statusColors[status] || "text-gray-400"}`}>
              {(status || "LOADING...").toUpperCase()}
            </span>
          </div>
          {playerCount > 0 && (
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs">PLAYERS LOADED:</span>
              <span className="text-xs text-green-400">{playerCount}</span>
            </div>
          )}
        </div>

        {/* Messages */}
        {message && (
          <div className="retro-panel p-3 mb-4 border-green-500 border">
            <p className="text-xs text-green-400">{message}</p>
          </div>
        )}
        {error && (
          <div className="retro-panel p-3 mb-4 border-red-500 border">
            <p className="text-xs text-red-400">ERROR: {error}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          <button
            onClick={handleSetup}
            disabled={loading}
            className="pixel-btn p-4 text-xs sm:text-sm hover:bg-[#f5c542] hover:text-[#0a0a2a] transition-colors disabled:opacity-50"
          >
            {loading ? "..." : "1. SETUP DRAFT"}
          </button>
          <button
            onClick={handleLoadPlayers}
            disabled={loading || status === "not_setup"}
            className="pixel-btn p-4 text-xs sm:text-sm hover:bg-[#00bcd4] hover:text-[#0a0a2a] transition-colors disabled:opacity-50"
          >
            {loading ? "..." : "2. LOAD PLAYERS"}
          </button>
          <button
            onClick={handleStartDraft}
            disabled={loading || (status !== "ready" && status !== "setup")}
            className="pixel-btn p-4 text-xs sm:text-sm hover:bg-green-400 hover:text-[#0a0a2a] transition-colors disabled:opacity-50"
          >
            {loading ? "..." : "3. START DRAFT"}
          </button>
          <button
            onClick={handleAutoPick}
            disabled={loading || status !== "active"}
            className="pixel-btn p-4 text-xs sm:text-sm hover:bg-orange-400 hover:text-[#0a0a2a] transition-colors disabled:opacity-50"
          >
            {loading ? "..." : "AUTO-PICK CURRENT"}
          </button>
          <button
            onClick={handleAutoFillAll}
            disabled={loading || status !== "active"}
            className="pixel-btn p-4 text-xs sm:text-sm col-span-1 sm:col-span-2 hover:bg-red-400 hover:text-[#0a0a2a] transition-colors disabled:opacity-50"
          >
            {loading ? "..." : "AUTO-FILL ALL REMAINING"}
          </button>
        </div>

        {/* Team Links */}
        {teams.length > 0 && (
          <div className="retro-panel p-4 mb-6">
            <h2 className="text-sm text-[#00bcd4] mb-3">TEAM DRAFT LINKS</h2>
            <p className="text-xs text-gray-400 mb-3">
              Share each link with the corresponding owner
            </p>
            <div className="space-y-2">
              {teams.map((t) => (
                <div
                  key={t.token}
                  className="flex items-center justify-between gap-2 p-2 bg-[#0a0a2a] rounded"
                >
                  <span className="text-xs text-[#f5c542] min-w-[100px]">
                    {t.name}
                  </span>
                  <span className="text-[10px] text-gray-400 truncate flex-1 hidden sm:block">
                    {t.link}
                  </span>
                  <button
                    onClick={() => copyLink(t.link)}
                    className="pixel-btn px-3 py-1 text-xs whitespace-nowrap"
                  >
                    {copied === t.link ? "COPIED!" : "COPY"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Draft Order */}
        {draftOrder.length > 0 && (
          <div className="retro-panel p-4 mb-6">
            <h2 className="text-sm text-[#00bcd4] mb-3">DRAFT ORDER</h2>
            <div className="space-y-1">
              {draftOrder.map((t, i) => (
                <div
                  key={t.token || i}
                  className="flex items-center gap-3 p-1"
                >
                  <span className="text-xs text-gray-400 w-8">
                    {i + 1}.
                  </span>
                  <span className="text-xs text-[#e8d5a3]">
                    {t.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="text-center space-y-2">
          <a
            href="/draft"
            className="pixel-btn inline-block px-4 py-2 text-xs hover:bg-[#f5c542] hover:text-[#0a0a2a] transition-colors"
          >
            VIEW DRAFT BOARD &gt;&gt;
          </a>
          <br />
          <a
            href="/"
            className="text-xs text-gray-400 hover:text-[#f5c542] transition-colors"
          >
            &lt;&lt; BACK TO STANDINGS
          </a>
        </div>
      </div>
    </div>
  );
}
