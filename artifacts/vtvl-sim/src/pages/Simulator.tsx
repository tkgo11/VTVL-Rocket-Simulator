import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSimulation } from '../hooks/useSimulation';
import { useIsMobile } from '../hooks/useIsMobile';
import { useKeyboardControls } from '../hooks/useKeyboardControls';
import { Sim2D } from '../components/Sim2D';
import { Sim3D } from '../components/Sim3D';
import { HUD } from '../components/HUD';
import { ControlPanel } from '../components/ControlPanel';
import { TouchControls } from '../components/TouchControls';
import { ModeToggle } from '../components/ModeToggle';
import { ScorePanel } from '../components/ScorePanel';
import { WindPanel } from '../components/WindPanel';
import { Timeline } from '../components/Timeline';
import { SavedFlights } from '../components/SavedFlights';
import { SettingsPanel } from '../components/SettingsPanel';
import { TelemetryCharts } from '../components/TelemetryCharts';
import { Button } from '../components/ui/button';
import { MissionConfig, VehicleConfig, DEFAULT_VEHICLE } from '../lib/physics';
import {
  FlightRecording,
  getSavedRecordings,
  saveRecording,
} from '../lib/recording';

function detectWebGL(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl2') || canvas.getContext('webgl'))
    );
  } catch {
    return false;
  }
}

const HAS_WEBGL = detectWebGL();

interface SimulatorProps {
  mission: MissionConfig;
  onBackToMissions: () => void;
}

export default function Simulator({ mission, onBackToMissions }: SimulatorProps) {
  const isMobile = useIsMobile();
  const [vehicle, setVehicle] = useState<VehicleConfig>(DEFAULT_VEHICLE);
  const [gravity, setGravity] = useState<number>(mission.gravity);

  // When the mission changes, reset the gravity override so each mission
  // starts from its own physical defaults. The vehicle preset persists
  // across missions — users tend to want to compare hardware on the same
  // flight profile.
  useEffect(() => {
    setGravity(mission.gravity);
  }, [mission.id, mission.gravity]);

  const missionWithGravity = useMemo<MissionConfig>(
    () => ({ ...mission, gravity }),
    [mission, gravity],
  );

  const {
    state,
    controls,
    setControls,
    launch,
    reset,
    autopilotEnabled,
    setAutopilotEnabled,
    fps,
    runResult,
    mission: effectiveMission,
    telemetry,
    windOverride,
    setWindOverride,
    latestRecording,
    replay,
    enterReplay,
    exitReplay,
    seekReplay,
    setReplayPlaying,
    setReplaySpeed,
  } = useSimulation(missionWithGravity, vehicle);

  const [mode, setMode] = useState<'2d' | '3d'>(HAS_WEBGL ? '3d' : '2d');
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveRefresh, setArchiveRefresh] = useState(0);
  const [scoreDismissed, setScoreDismissed] = useState(false);
  // Seed from localStorage so the timeline correctly shows "Saved ✓" for
  // recordings the user persisted in a previous session.
  const [savedRecordingIds, setSavedRecordingIds] = useState<Set<string>>(
    () => new Set(getSavedRecordings().map((r) => r.id)),
  );
  const lastRunIdRef = useRef<string | null>(null);

  const launchLabel =
    effectiveMission.startMode === 'launch' ? 'Launch' : 'Begin Descent';
  const inReplay = !!replay.recording;

  // Keyboard bindings live in a hook so they keep working regardless of which
  // control surface (sliders vs. touch pads) is rendered. Suppressed during
  // replay so playback hotkeys (in Timeline) take precedence.
  useKeyboardControls({
    controls,
    setControls,
    reset,
    autopilotEnabled,
    setAutopilotEnabled,
    status: state.status,
    onBackToMissions,
    enabled: !inReplay,
  });

  // Whenever a brand-new run finishes, un-dismiss the score panel.
  useEffect(() => {
    const id = latestRecording?.id ?? null;
    if (id && id !== lastRunIdRef.current) {
      lastRunIdRef.current = id;
      setScoreDismissed(false);
    } else if (!id) {
      lastRunIdRef.current = null;
      setScoreDismissed(false);
    }
  }, [latestRecording]);

  const handleReviewFlight = useCallback(() => {
    if (!latestRecording) return;
    setScoreDismissed(true);
    enterReplay(latestRecording);
  }, [latestRecording, enterReplay]);

  const handleLoadArchived = useCallback(
    (rec: FlightRecording) => {
      setArchiveOpen(false);
      setScoreDismissed(true);
      enterReplay(rec);
      // Loaded recordings have already been persisted at least once.
      setSavedRecordingIds((prev) => new Set(prev).add(rec.id));
    },
    [enterReplay],
  );

  const handleSaveCurrent = useCallback(() => {
    const rec = replay.recording;
    if (!rec) return;
    saveRecording(rec);
    setSavedRecordingIds((prev) => new Set(prev).add(rec.id));
    setArchiveRefresh((n) => n + 1);
  }, [replay.recording]);

  const handleExitReplay = useCallback(() => {
    exitReplay();
    // If there's a still-relevant runResult, show the score panel again so
    // the user can retry from the same end-of-run summary.
    if (runResult) setScoreDismissed(false);
  }, [exitReplay, runResult]);

  // Hotkey: V = view replay of latest flight.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }
      if (e.key.toLowerCase() === 'v' && latestRecording && !inReplay) {
        e.preventDefault();
        handleReviewFlight();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [latestRecording, inReplay, handleReviewFlight]);

  const showScorePanel = runResult && !scoreDismissed && !inReplay;
  const showControlPanel = !inReplay;

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black selection:bg-amber-500/30">
      {/* Viewport — driven by the *effective* mission so wind- and gravity-
          dependent UI (HUD wind row, 2D wind indicator) reflects live
          overrides. */}
      {mode === '2d' ? (
        <Sim2D state={state} mission={effectiveMission} vehicle={vehicle} />
      ) : (
        <Sim3D state={state} mission={effectiveMission} vehicle={vehicle} />
      )}

      {/* Telemetry HUD (compact bar on mobile, full panel on desktop) */}
      <HUD
        state={state}
        mission={effectiveMission}
        vehicle={vehicle}
        compact={isMobile}
      />

      {/* Right-side controls column. On desktop the panels keep their
          original absolute positions; on mobile they collapse into a
          single stacked column hugging the right edge so they no longer
          collide with each other or with the touch pad below. */}
      {isMobile ? (
        <div className="absolute top-12 right-2 z-30 flex flex-col items-end gap-2 max-w-[calc(100vw-1rem)] pointer-events-none">
          <div className="pointer-events-auto">
            <ModeToggle mode={mode} setMode={setMode} />
          </div>
          <div className="pointer-events-auto">
            <Button
              type="button"
              onClick={() => setArchiveOpen(true)}
              variant="outline"
              size="sm"
              className="h-8 px-3 bg-black/60 border-slate-800 hover:border-amber-500/40 hover:bg-black/80 text-slate-300 hover:text-amber-300 font-mono text-[10px] uppercase tracking-wider"
            >
              Flight Log
            </Button>
          </div>
          <div className="pointer-events-auto w-60 max-w-[calc(100vw-1rem)]">
            <WindPanel
              windOverride={windOverride}
              setWindOverride={setWindOverride}
              windNow={state.windNow}
              disabled={inReplay}
            />
          </div>
          <div className="pointer-events-auto">
            <SettingsPanel
              vehicle={vehicle}
              setVehicle={setVehicle}
              mission={mission}
              gravity={gravity}
              setGravity={setGravity}
              defaultGravity={mission.gravity}
            />
          </div>
        </div>
      ) : (
        <>
          <div className="absolute top-4 right-4 z-20">
            <ModeToggle mode={mode} setMode={setMode} />
          </div>

          <div className="absolute top-16 right-4 z-20">
            <WindPanel
              windOverride={windOverride}
              setWindOverride={setWindOverride}
              windNow={state.windNow}
              disabled={inReplay}
            />
          </div>

          <div className="absolute top-4 right-4 z-30">
            <SettingsPanel
              vehicle={vehicle}
              setVehicle={setVehicle}
              mission={mission}
              gravity={gravity}
              setGravity={setGravity}
              defaultGravity={mission.gravity}
            />
          </div>

          {/* Archive button (top-right, between mode toggle and settings) */}
          <div className="absolute top-4 right-44 z-20">
            <Button
              type="button"
              onClick={() => setArchiveOpen(true)}
              variant="outline"
              size="sm"
              className="h-8 px-3 bg-black/60 border-slate-800 hover:border-amber-500/40 hover:bg-black/80 text-slate-300 hover:text-amber-300 font-mono text-[10px] uppercase tracking-wider"
            >
              Flight Log
            </Button>
          </div>
        </>
      )}

      <TelemetryCharts
        telemetry={telemetry}
        vehicle={vehicle}
        missionFuel={mission.fuel}
      />

      {/* Control surface — touch pad on mobile, slider panel on desktop */}
      {showControlPanel && (
        isMobile ? (
          <TouchControls
            controls={controls}
            setControls={setControls}
            launch={launch}
            reset={reset}
            autopilotEnabled={autopilotEnabled}
            setAutopilotEnabled={setAutopilotEnabled}
            status={state.status}
            launchLabel={launchLabel}
            onBackToMissions={onBackToMissions}
          />
        ) : (
          <ControlPanel
            controls={controls}
            setControls={setControls}
            launch={launch}
            reset={reset}
            autopilotEnabled={autopilotEnabled}
            setAutopilotEnabled={setAutopilotEnabled}
            status={state.status}
            launchLabel={launchLabel}
            onBackToMissions={onBackToMissions}
            maxGimbalDeg={vehicle.maxGimbalDeg}
          />
        )
      )}

      {/* Status Bar — desktop only; the compact mobile HUD already shows
          status, and the touch overlay leaves no room here. */}
      {!isMobile && (
        <div className="absolute bottom-2 right-4 flex items-center gap-4 text-[10px] font-mono text-slate-500 z-10">
          <div>FPS: <span className="text-slate-300">{fps}</span></div>
          <div>SYS: <span className="text-slate-300">{state.status.toUpperCase()}</span></div>
          <div>AP: <span className={autopilotEnabled ? "text-amber-400" : "text-slate-300"}>{autopilotEnabled ? 'ENGAGED' : 'STBY'}</span></div>
          {inReplay && (
            <div>
              MODE: <span className="text-amber-400">REPLAY</span>
            </div>
          )}
        </div>
      )}

      {/* Replay Timeline (overrides ControlPanel while active) */}
      {inReplay && replay.recording && (
        <Timeline
          recording={replay.recording}
          time={replay.time}
          playing={replay.playing}
          speed={replay.speed}
          onSeek={seekReplay}
          onTogglePlay={() => setReplayPlaying(!replay.playing)}
          onSetSpeed={setReplaySpeed}
          onExit={handleExitReplay}
          onSave={handleSaveCurrent}
          isSaved={savedRecordingIds.has(replay.recording.id)}
        />
      )}

      {/* End-of-run scoring overlay */}
      {showScorePanel && (
        <ScorePanel
          result={runResult}
          mission={effectiveMission}
          onReset={reset}
          onBackToMissions={onBackToMissions}
          onReplay={handleReviewFlight}
          canReplay={!!latestRecording}
        />
      )}

      {/* Saved flights browser */}
      <SavedFlights
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        onLoad={handleLoadArchived}
        missionId={mission.id}
        refreshKey={archiveRefresh}
      />
    </div>
  );
}
