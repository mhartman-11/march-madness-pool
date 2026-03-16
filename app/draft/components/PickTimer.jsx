"use client";

import { useState, useEffect } from "react";

export default function PickTimer({ deadline, status }) {
  const [timeLeft, setTimeLeft] = useState("");
  const [urgent, setUrgent] = useState(false);

  useEffect(() => {
    if (!deadline || status !== "active") {
      setTimeLeft("");
      return;
    }

    function update() {
      const now = new Date();
      const end = new Date(deadline);
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeft("DEADLINE PASSED");
        setUrgent(true);
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);

      let str = "";
      if (days > 0) str += `${days}D `;
      if (hours > 0 || days > 0) str += `${hours}H `;
      str += `${mins}M ${secs}S`;

      setTimeLeft(str);
      setUrgent(diff < 60 * 60 * 1000); // Under 1 hour
    }

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [deadline, status]);

  if (!timeLeft) return null;

  return (
    <div className="retro-panel p-2 sm:p-3 mb-4 text-center">
      <p className="text-[7px] sm:text-[8px] text-gray-400 mb-1">
        {status === "completed" ? "DRAFT CLOSED" : "DRAFT CLOSES IN"}
      </p>
      <p
        className={`text-[10px] sm:text-xs font-bold ${
          urgent ? "text-red-400 animate-pulse" : "text-[#00bcd4]"
        }`}
      >
        {status === "completed" ? "COMPLETE" : timeLeft}
      </p>
    </div>
  );
}
