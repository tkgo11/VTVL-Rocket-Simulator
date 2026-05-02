import { useEffect, useRef } from 'react';
import { MissionConfig, PhysicsState, VehicleConfig, DEFAULT_VEHICLE, CONSTANTS } from '../lib/physics';

interface Sim2DProps {
  state: PhysicsState;
  mission: MissionConfig;
  vehicle?: VehicleConfig;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
}

interface Star {
  x: number;
  y: number;
  size: number;
  twinkle: number;
}

export function Sim2D({ state, mission, vehicle = DEFAULT_VEHICLE }: Sim2DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(state);
  const missionRef = useRef(mission);
  const vehicleRef = useRef(vehicle);
  const particlesRef = useRef<Particle[]>([]);
  const starsRef = useRef<Star[]>([]);

  // Keep latest state for the rAF loop without re-running setup.
  stateRef.current = state;
  missionRef.current = mission;
  vehicleRef.current = vehicle;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Generate stars (in screen space)
      if (starsRef.current.length === 0 || starsRef.current.length < 200) {
        const stars: Star[] = [];
        for (let i = 0; i < 220; i++) {
          stars.push({
            x: Math.random() * w,
            y: Math.random() * h * 0.7,
            size: Math.random() * 1.5 + 0.3,
            twinkle: Math.random() * Math.PI * 2,
          });
        }
        starsRef.current = stars;
      }
    };

    resize();
    const onResize = () => resize();
    window.addEventListener('resize', onResize);

    let raf = 0;
    let last = performance.now();

    const render = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const s = stateRef.current;
      const m = missionRef.current;
      const v = vehicleRef.current;
      const maxGimbalRad = v.maxGimbalDeg * (Math.PI / 180);

      const w = canvas.clientWidth;
      const h = canvas.clientHeight;

      // World -> screen scale (pixels per meter). Scale down when high or
      // when the pad is far from origin so both rocket and pad stay framed.
      const baseScale = 4;
      const padDistance = Math.max(Math.abs(s.x), Math.abs(m.targetPadX - s.x));
      const altZoom = Math.max(0.35, Math.min(1.4, 1 - s.y / 800));
      const padZoom = Math.max(0.4, Math.min(1, 220 / Math.max(220, padDistance + 60)));
      const scale = baseScale * Math.min(altZoom, padZoom);

      // Camera Y: keep rocket around 55% from the top, but clamp so the
      // ground is always anchored near the bottom 15% when we land.
      const groundScreenY = h - 80;
      const followCamY = h * 0.55 + s.y * scale;
      const camY = Math.max(groundScreenY, followCamY);
      // Horizontally bias the camera toward the midpoint of rocket and pad.
      const focusX = (s.x + m.targetPadX) / 2;
      const xOffset = w / 2 - focusX * scale;

      // Sky gradient (lighter / dustier on Mars, dark on the moon, blueish on Earth)
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      if (m.id === 'martian_touchdown') {
        sky.addColorStop(0, '#1a0f08');
        sky.addColorStop(0.5, '#3b1f0f');
        sky.addColorStop(1, '#5a2c14');
      } else if (m.id === 'lunar_whisper') {
        sky.addColorStop(0, '#000000');
        sky.addColorStop(1, '#020207');
      } else {
        sky.addColorStop(0, '#020617');
        sky.addColorStop(0.5, '#0b1220');
        sky.addColorStop(1, '#0f172a');
      }
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      // Stars (no atmosphere on the moon -> brighter; daytime mars hides them).
      const starAlpha = m.id === 'martian_touchdown' ? 0 : m.id === 'lunar_whisper' ? 1.0 : 0.85;
      if (starAlpha > 0) {
        ctx.fillStyle = '#e2e8f0';
        for (const star of starsRef.current) {
          star.twinkle += dt * 2;
          const a = 0.5 + 0.5 * Math.sin(star.twinkle);
          ctx.globalAlpha = (0.35 + 0.5 * a) * starAlpha;
          ctx.beginPath();
          ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      // Distant horizon glow
      const glow = ctx.createLinearGradient(0, camY - 200, 0, camY + 50);
      glow.addColorStop(0, 'rgba(245,158,11,0)');
      glow.addColorStop(1, 'rgba(245,158,11,0.10)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, camY - 200, w, 250);

      // Mountains silhouette
      ctx.fillStyle = m.id === 'martian_touchdown' ? '#2a160a' : m.id === 'lunar_whisper' ? '#0a0a14' : '#0a0f1c';
      ctx.beginPath();
      ctx.moveTo(0, camY);
      const mountainSeed = [0.1, 0.18, 0.28, 0.4, 0.55, 0.62, 0.7, 0.82, 0.92, 1];
      const mountainH = [40, 70, 50, 90, 120, 80, 60, 100, 70, 50];
      for (let i = 0; i < mountainSeed.length; i++) {
        ctx.lineTo(mountainSeed[i] * w, camY - mountainH[i]);
      }
      ctx.lineTo(w, camY);
      ctx.closePath();
      ctx.fill();

      // Ground
      const groundGrad = ctx.createLinearGradient(0, camY, 0, h);
      if (m.id === 'martian_touchdown') {
        groundGrad.addColorStop(0, '#5a2c14');
        groundGrad.addColorStop(1, '#2a120a');
      } else if (m.id === 'lunar_whisper') {
        groundGrad.addColorStop(0, '#2a2a35');
        groundGrad.addColorStop(1, '#101018');
      } else {
        groundGrad.addColorStop(0, '#1e293b');
        groundGrad.addColorStop(1, '#0f172a');
      }
      ctx.fillStyle = groundGrad;
      ctx.fillRect(0, camY, w, h - camY);

      // Origin marker (where the rocket spawned at x=0)
      if (Math.abs(m.targetPadX) > 1) {
        const originScreenX = xOffset;
        ctx.strokeStyle = '#334155';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(originScreenX, camY - 6);
        ctx.lineTo(originScreenX, camY + 6);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Pad (positioned at mission.targetPadX)
      const padCenterX = xOffset + m.targetPadX * scale;
      const padW = m.padRadius * 2 * scale;
      const padX = padCenterX - padW / 2;
      ctx.fillStyle = '#475569';
      ctx.fillRect(padX, camY - 4, padW, 8);
      // Pad markings
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(padX + 6, camY - 1);
      ctx.lineTo(padX + padW - 6, camY - 1);
      ctx.stroke();
      // Pad center crosshair
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(padCenterX - padW * 0.18, camY - 1);
      ctx.lineTo(padCenterX + padW * 0.18, camY - 1);
      ctx.moveTo(padCenterX, camY - 6);
      ctx.lineTo(padCenterX, camY + 4);
      ctx.stroke();

      // Pad label
      ctx.font = '10px ui-monospace, Menlo, monospace';
      ctx.fillStyle = '#fbbf24';
      ctx.textAlign = 'center';
      ctx.fillText('TARGET', padCenterX, camY - 12);
      ctx.textAlign = 'start';

      // Wind indicator (top-center)
      if (m.wind !== 0 || m.windGust !== 0) {
        const wx = w / 2;
        const wy = 28;
        const arrowLen = Math.min(80, Math.abs(s.windNow) * 6 + 10);
        const dir = s.windNow >= 0 ? 1 : -1;
        ctx.strokeStyle = 'rgba(148,163,184,0.7)';
        ctx.fillStyle = 'rgba(148,163,184,0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(wx - (arrowLen / 2) * dir, wy);
        ctx.lineTo(wx + (arrowLen / 2) * dir, wy);
        ctx.stroke();
        // Arrowhead
        ctx.beginPath();
        ctx.moveTo(wx + (arrowLen / 2) * dir, wy);
        ctx.lineTo(wx + (arrowLen / 2 - 6) * dir, wy - 4);
        ctx.lineTo(wx + (arrowLen / 2 - 6) * dir, wy + 4);
        ctx.closePath();
        ctx.fill();
        ctx.font = '10px ui-monospace, Menlo, monospace';
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'center';
        ctx.fillText(`WIND ${s.windNow.toFixed(1)} m/s`, wx, wy + 16);
        ctx.textAlign = 'start';
      }

      // Altitude ladder on right side
      ctx.font = '10px ui-monospace, Menlo, monospace';
      ctx.fillStyle = '#475569';
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      const ladderX = w - 60;
      ctx.beginPath();
      ctx.moveTo(ladderX, 60);
      ctx.lineTo(ladderX, h - 60);
      ctx.stroke();
      const tickSpacing = m.startAltitude > 800 ? 200 : m.startAltitude > 300 ? 100 : 50;
      const startAlt = Math.floor((s.y - h / (2 * scale)) / tickSpacing) * tickSpacing;
      for (let alt = startAlt; alt < startAlt + h / scale + tickSpacing; alt += tickSpacing) {
        if (alt < 0) continue;
        const y = camY - alt * scale;
        if (y < 30 || y > h - 30) continue;
        ctx.beginPath();
        ctx.moveTo(ladderX - 4, y);
        ctx.lineTo(ladderX + 4, y);
        ctx.stroke();
        ctx.fillText(`${alt}m`, ladderX + 8, y + 3);
      }
      // Current altitude pointer
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.moveTo(ladderX - 8, camY - s.y * scale);
      ctx.lineTo(ladderX, camY - s.y * scale - 5);
      ctx.lineTo(ladderX, camY - s.y * scale + 5);
      ctx.closePath();
      ctx.fill();

      // Spawn engine particles
      const throttling =
        s.throttle > 0 && s.status !== 'landed' && s.status !== 'crashed' && s.fuel > 0;
      if (throttling) {
        const spawn = Math.floor(s.throttle * 8) + 2;
        const rocketScreenX = xOffset + s.x * scale;
        const rocketScreenY = camY - s.y * scale;
        // Nozzle position in screen space (rotated by angle)
        const angle = s.angle;
        const nozzleOffset = (CONSTANTS.LENGTH * 0.5) * scale;
        const nx = rocketScreenX + Math.sin(angle) * nozzleOffset;
        const ny = rocketScreenY + Math.cos(angle) * nozzleOffset;
        // Thrust direction (down body axis + gimbal)
        const thrustAngle = angle + s.gimbal * maxGimbalRad;
        const dirX = Math.sin(thrustAngle);
        const dirY = Math.cos(thrustAngle);
        for (let i = 0; i < spawn; i++) {
          const speed = 80 + Math.random() * 120 * s.throttle;
          const spread = (Math.random() - 0.5) * 0.4;
          const cs = Math.cos(spread);
          const sn = Math.sin(spread);
          particlesRef.current.push({
            x: nx + (Math.random() - 0.5) * 8,
            y: ny,
            vx: (dirX * cs - dirY * sn) * speed,
            vy: (dirX * sn + dirY * cs) * speed,
            life: 0,
            maxLife: 0.4 + Math.random() * 0.4,
            size: 2 + Math.random() * 4 * s.throttle,
          });
        }
      }

      // Update + draw particles
      const alive: Particle[] = [];
      for (const p of particlesRef.current) {
        p.life += dt;
        if (p.life >= p.maxLife) continue;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 60 * dt; // slight gravity on smoke
        p.vx *= 0.98;
        p.vy *= 0.98;
        const t = p.life / p.maxLife;
        // Color: white -> amber -> dark red
        let r = 255, g = 255, b = 255;
        if (t < 0.3) {
          r = 255; g = 255; b = 220;
        } else if (t < 0.7) {
          r = 251; g = 146; b = 60;
        } else {
          r = 120; g = 50; b = 30;
        }
        ctx.globalAlpha = (1 - t) * 0.85;
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 + t * 0.5), 0, Math.PI * 2);
        ctx.fill();
        alive.push(p);
      }
      ctx.globalAlpha = 1;
      particlesRef.current = alive;

      // Rocket
      ctx.save();
      ctx.translate(xOffset + s.x * scale, camY - s.y * scale);
      ctx.rotate(s.angle);

      const rW = Math.max(8, CONSTANTS.DIAMETER * scale);
      const rH = Math.max(40, CONSTANTS.LENGTH * scale);

      // Body
      const bodyGrad = ctx.createLinearGradient(-rW / 2, 0, rW / 2, 0);
      bodyGrad.addColorStop(0, '#cbd5e1');
      bodyGrad.addColorStop(0.5, '#f8fafc');
      bodyGrad.addColorStop(1, '#94a3b8');
      ctx.fillStyle = bodyGrad;
      ctx.fillRect(-rW / 2, -rH, rW, rH);

      // Black stripes
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(-rW / 2, -rH * 0.85, rW, rH * 0.04);
      ctx.fillRect(-rW / 2, -rH * 0.5, rW, rH * 0.04);
      ctx.fillRect(-rW / 2, -rH * 0.2, rW, rH * 0.04);

      // Nose cone
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.moveTo(-rW / 2, -rH);
      ctx.lineTo(0, -rH - rW * 1.4);
      ctx.lineTo(rW / 2, -rH);
      ctx.closePath();
      ctx.fill();

      // Fins
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.moveTo(-rW / 2, -rW);
      ctx.lineTo(-rW / 2 - rW * 0.7, 0);
      ctx.lineTo(-rW / 2, 0);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(rW / 2, -rW);
      ctx.lineTo(rW / 2 + rW * 0.7, 0);
      ctx.lineTo(rW / 2, 0);
      ctx.closePath();
      ctx.fill();

      // Nozzle (gimbaled)
      ctx.save();
      ctx.rotate(s.gimbal * maxGimbalRad);
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.moveTo(-rW * 0.3, 0);
      ctx.lineTo(-rW * 0.45, rW * 0.55);
      ctx.lineTo(rW * 0.45, rW * 0.55);
      ctx.lineTo(rW * 0.3, 0);
      ctx.closePath();
      ctx.fill();
      // Nozzle glow when throttling
      if (throttling) {
        ctx.fillStyle = `rgba(251,146,60,${0.4 + s.throttle * 0.4})`;
        ctx.beginPath();
        ctx.ellipse(0, rW * 0.5, rW * 0.4, rW * 0.15, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      ctx.restore();

      raf = requestAnimationFrame(render);
    };

    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full block"
    />
  );
}
