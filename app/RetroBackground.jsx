"use client";

import { useEffect, useRef } from "react";

// Pixel art basketball (8x8 grid)
const BALL_PIXELS = [
  "  OOOO  ",
  " OoOOoO ",
  "OoOOOOoO",
  "OOOO-OOO",
  "OOO-OOOO",
  "OoOOOOoO",
  " OoOOoO ",
  "  OOOO  ",
];

const BALL_COLORS = {
  O: "#e8751a",
  o: "#f39c12",
  "-": "#1a1a2e",
  " ": null,
};

// Pixel art hoop + backboard
const HOOP_PIXELS = [
  "  GGGGGGGGGG  ",
  "  GGGGGGGGGG  ",
  "  GGGGGGGGGG  ",
  "  GGGGGGGGGG  ",
  "  GG      GG  ",
  "  GG PPPP GG  ",
  "  GG PPPP GG  ",
  "  GGPPPPPPGG  ",
  "  LLLLLLLLLL  ",
  " LLLLLLLLLLLL ",
  "  LL      LL  ",
  "  LL      LL  ",
  "   TT    TT   ",
  "    TT  TT    ",
  "     TTTT     ",
  "      TT      ",
];

const HOOP_COLORS = {
  G: "#6b6b6b",
  P: "#ffffff",
  L: "#e94560",
  T: "#f5f5f5",
  " ": null,
};

function drawPixelArt(ctx, pixels, colors, x, y, scale) {
  for (let row = 0; row < pixels.length; row++) {
    for (let col = 0; col < pixels[row].length; col++) {
      const c = colors[pixels[row][col]];
      if (c) {
        ctx.fillStyle = c;
        ctx.fillRect(x + col * scale, y + row * scale, scale, scale);
      }
    }
  }
}

export default function RetroBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);

    // Bouncing basketballs
    const balls = Array.from({ length: 6 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 1.5,
      vy: (Math.random() - 0.5) * 1.5,
      scale: Math.random() > 0.5 ? 3 : 2,
      opacity: 0.15 + Math.random() * 0.15,
    }));

    // Hoop and shot ball
    const hoop = { x: 0, y: 0, scale: 5 };
    let shotBall = null;
    let shotTimer = 0;
    const shotInterval = 180;

    // Stars
    const stars = Array.from({ length: 40 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      size: Math.random() > 0.7 ? 2 : 1,
      speed: 0.005 + Math.random() * 0.02,
      phase: Math.random() * Math.PI * 2,
    }));

    let frame = 0;
    let animId;

    function resize() {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      // Position hoop in the bottom-right area
      hoop.x = w * 0.7;
      hoop.y = h * 0.55;
    }
    resize();
    window.addEventListener("resize", resize);

    function update() {
      frame++;
      ctx.clearRect(0, 0, w, h);

      // Draw stars
      for (const s of stars) {
        const opacity = 0.3 + 0.7 * Math.abs(Math.sin(frame * s.speed + s.phase));
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.4})`;
        ctx.fillRect(Math.floor(s.x), Math.floor(s.y), s.size, s.size);
      }

      // Draw bouncing balls
      for (const b of balls) {
        b.x += b.vx;
        b.y += b.vy;
        if (b.x < 0 || b.x > w - 8 * b.scale) b.vx *= -1;
        if (b.y < 0 || b.y > h - 8 * b.scale) b.vy *= -1;
        ctx.globalAlpha = b.opacity;
        drawPixelArt(ctx, BALL_PIXELS, BALL_COLORS, Math.floor(b.x), Math.floor(b.y), b.scale);
        ctx.globalAlpha = 1;
      }

      // Draw hoop + pole
      ctx.globalAlpha = 0.3;
      const poleX = hoop.x + 7 * hoop.scale;
      const poleTop = hoop.y + 16 * hoop.scale;
      ctx.fillStyle = "#6b6b6b";
      ctx.fillRect(Math.floor(poleX), Math.floor(poleTop), hoop.scale * 2, h - poleTop);
      drawPixelArt(ctx, HOOP_PIXELS, HOOP_COLORS, Math.floor(hoop.x), Math.floor(hoop.y), hoop.scale);
      ctx.globalAlpha = 1;

      // Shot ball — arcs in from off-screen left and swishes through the hoop
      shotTimer++;
      if (shotTimer >= shotInterval) {
        shotTimer = 0;
        const startX = hoop.x - w * 0.3;
        const startY = hoop.y - 60;
        const targetX = hoop.x + 7 * hoop.scale;
        const targetY = hoop.y + 9 * hoop.scale;
        const frames = 70;
        const gravity = 0.06;
        const vx = (targetX - startX) / frames;
        const vy = (targetY - startY) / frames - (gravity * frames) / 2;
        shotBall = {
          x: startX,
          y: startY,
          vx,
          vy,
          scale: 3,
          age: 0,
          maxAge: frames + 40,
        };
      }

      if (shotBall) {
        shotBall.age++;
        shotBall.x += shotBall.vx;
        shotBall.vy += 0.06;
        shotBall.y += shotBall.vy;

        // Fade out after passing through hoop
        const hoopRimY = hoop.y + 10 * hoop.scale;
        const pastHoop = shotBall.y > hoopRimY + 20;
        const alpha = pastHoop ? Math.max(0, 0.35 - (shotBall.y - hoopRimY - 20) * 0.004) : 0.35;

        ctx.globalAlpha = alpha;
        drawPixelArt(ctx, BALL_PIXELS, BALL_COLORS, Math.floor(shotBall.x), Math.floor(shotBall.y), shotBall.scale);
        ctx.globalAlpha = 1;

        if (shotBall.age > shotBall.maxAge || shotBall.y > h + 50) {
          shotBall = null;
        }
      }

      animId = requestAnimationFrame(update);
    }

    animId = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0 pointer-events-none"
      style={{ background: "linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)" }}
    />
  );
}
