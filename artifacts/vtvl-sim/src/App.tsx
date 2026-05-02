import { useState } from 'react';
import Simulator from '@/pages/Simulator';
import { MissionSelect } from '@/components/MissionSelect';
import { MissionConfig } from '@/lib/physics';

function App() {
  const [mission, setMission] = useState<MissionConfig | null>(null);

  if (!mission) {
    return <MissionSelect onSelect={setMission} />;
  }

  return <Simulator mission={mission} onBackToMissions={() => setMission(null)} />;
}

export default App;
