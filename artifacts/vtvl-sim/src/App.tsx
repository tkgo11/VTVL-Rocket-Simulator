import { useEffect, useState } from 'react';
import Simulator from '@/pages/Simulator';
import { MissionSelect } from '@/components/MissionSelect';
import MultiplayerHub from '@/pages/MultiplayerHub';
import Lobby from '@/pages/Lobby';
import Leaderboard from '@/pages/Leaderboard';
import PlayerStats from '@/pages/PlayerStats';
import { SignInModal } from '@/components/SignInModal';
import { PlayerProvider, usePlayer } from '@/contexts/PlayerContext';
import { MissionConfig } from '@/lib/physics';
import { RoomInfo } from '@/lib/api';

type Screen =
  | { name: 'mission-select' }
  | { name: 'simulator'; mission: MissionConfig }
  | { name: 'multiplayer-hub'; initialView?: 'landing' | 'create' | 'join' | 'spectate' }
  | { name: 'lobby'; room: RoomInfo; role: 'player' | 'spectator'; myPlayerId?: string; hostSecret?: string }
  | { name: 'leaderboard' }
  | { name: 'player-stats' };

function AppInner() {
  const { player, setGuestName } = usePlayer();
  const [screen, setScreen] = useState<Screen>({ name: 'mission-select' });
  const [signInOpen, setSignInOpen] = useState(false);

  // Check for ?room=CODE in URL on initial load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomCode = params.get('room');
    if (roomCode) {
      // Clear the query param from URL
      const url = new URL(window.location.href);
      url.searchParams.delete('room');
      window.history.replaceState({}, '', url.toString());

      // Navigate to multiplayer hub with pre-filled code — we'll auto-join via lobby
      // First we need the room info; hub will handle the join
      import('@/lib/api').then(({ api }) => {
        api.rooms.get(roomCode.toUpperCase()).then((room) => {
          setScreen({ name: 'lobby', room, role: 'player' });
        }).catch(() => {
          // Room not found or expired; go to hub
          setScreen({ name: 'multiplayer-hub' });
        });
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Also handle spectate links (?spectate=CODE)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const spectateCode = params.get('spectate');
    if (spectateCode) {
      const url = new URL(window.location.href);
      url.searchParams.delete('spectate');
      window.history.replaceState({}, '', url.toString());

      import('@/lib/api').then(({ api }) => {
        api.rooms.get(spectateCode.toUpperCase()).then((room) => {
          setScreen({ name: 'lobby', room, role: 'spectator' });
        }).catch(() => {
          setScreen({ name: 'multiplayer-hub' });
        });
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Prompt for guest name if none set
  useEffect(() => {
    if (!player) {
      const name = localStorage.getItem('vtvl_guest_name');
      if (!name) {
        // Auto-assign a guest name so multiplayer works out of the box
        setGuestName(`Pilot-${Math.random().toString(36).slice(-4).toUpperCase()}`);
      }
    }
  }, [player, setGuestName]);

  switch (screen.name) {
    case 'simulator':
      return (
        <Simulator
          mission={screen.mission}
          onBackToMissions={() => setScreen({ name: 'mission-select' })}
        />
      );

    case 'multiplayer-hub':
      return (
        <>
          <MultiplayerHub
            onBack={() => setScreen({ name: 'mission-select' })}
            onJoinRoom={(room, role, myPlayerId, hostSecret) => setScreen({ name: 'lobby', room, role, myPlayerId, hostSecret })}
            initialView={screen.initialView}
          />
          <SignInModal open={signInOpen} onClose={() => setSignInOpen(false)} />
        </>
      );

    case 'lobby':
      return (
        <Lobby
          room={screen.room}
          role={screen.role}
          myPlayerId={screen.myPlayerId}
          hostSecret={screen.hostSecret}
          onLeave={() => setScreen({ name: 'mission-select' })}
        />
      );

    case 'leaderboard':
      return <Leaderboard onBack={() => setScreen({ name: 'mission-select' })} />;

    case 'player-stats':
      return <PlayerStats onBack={() => setScreen({ name: 'mission-select' })} />;

    default:
      return (
        <>
          <MissionSelect
            onSelect={(mission) => setScreen({ name: 'simulator', mission })}
            onMultiplayer={() => setScreen({ name: 'multiplayer-hub', initialView: 'landing' })}
            onSpectate={() => setScreen({ name: 'multiplayer-hub', initialView: 'spectate' })}
            onLeaderboard={() => setScreen({ name: 'leaderboard' })}
            onPlayerStats={player?.type === 'account' ? () => setScreen({ name: 'player-stats' }) : undefined}
            onSignIn={() => setSignInOpen(true)}
            player={player}
          />
          <SignInModal open={signInOpen} onClose={() => setSignInOpen(false)} />
        </>
      );
  }
}

function App() {
  return (
    <PlayerProvider>
      <AppInner />
    </PlayerProvider>
  );
}

export default App;
