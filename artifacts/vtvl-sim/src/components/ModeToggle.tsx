import React from 'react';
import { Button } from './ui/button';

interface ModeToggleProps {
  mode: '2d' | '3d';
  setMode: (mode: '2d' | '3d') => void;
}

export function ModeToggle({ mode, setMode }: ModeToggleProps) {
  return (
    <div className="absolute top-4 right-4 flex bg-black/60 border border-slate-800 rounded backdrop-blur-sm p-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setMode('2d')}
        className={`px-4 py-1 h-auto text-xs font-mono tracking-wider uppercase rounded-sm ${
          mode === '2d' 
            ? 'bg-slate-800 text-white shadow-sm' 
            : 'text-slate-400 hover:text-white hover:bg-transparent'
        }`}
      >
        2D
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setMode('3d')}
        className={`px-4 py-1 h-auto text-xs font-mono tracking-wider uppercase rounded-sm ${
          mode === '3d' 
            ? 'bg-slate-800 text-white shadow-sm' 
            : 'text-slate-400 hover:text-white hover:bg-transparent'
        }`}
      >
        3D
      </Button>
    </div>
  );
}
