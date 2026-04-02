'use client';

import { type MidiPort } from '@/hooks/use-midi-clock';

interface MidiClockPanelProps {
  isSupported: boolean;
  ports: MidiPort[];
  selectedPortId: string | null;
  onSelectPort: (id: string | null) => void;
  isReceiving: boolean;
  syncedBpm: number | null;
  onClose: () => void;
}

export default function MidiClockPanel({
  isSupported,
  ports,
  selectedPortId,
  onSelectPort,
  isReceiving,
  syncedBpm,
  onClose,
}: MidiClockPanelProps) {
  return (
    <div className='absolute bottom-full right-0 mb-1 z-50 bg-silver border-2 border-t-white border-l-white border-r-neutral-500 border-b-neutral-500 w-64 font-sans text-black select-none shadow-md'>
      {/* Title bar */}
      <div className='bg-blue-800 text-white flex items-center justify-between px-2 py-0.5'>
        <span className='font-bold text-xs'>MIDI Clock Slave</span>
        <button
          className='w-4 h-4 bg-silver text-black text-[10px] font-bold flex items-center justify-center border border-t-white border-l-white border-r-neutral-600 border-b-neutral-600 leading-none'
          onClick={onClose}
        >✕</button>
      </div>

      <div className='px-3 py-2 flex flex-col gap-2 text-xs'>
        {!isSupported ? (
          <p className='text-neutral-600 italic'>
            Web MIDI API is not supported in this browser. Try Chrome or Edge.
          </p>
        ) : (
          <>
            {/* Port selector */}
            <div>
              <p className='mb-1'>MIDI Input Port:</p>
              <div className='border-2 border-t-neutral-500 border-l-neutral-500 border-r-white border-b-white bg-white'>
                <select
                  className='w-full text-xs px-1.5 py-0.5 bg-transparent outline-none text-black'
                  value={selectedPortId ?? ''}
                  onChange={(e) => onSelectPort(e.target.value || null)}
                >
                  <option value=''>— None —</option>
                  {ports.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              {ports.length === 0 && (
                <p className='text-neutral-500 italic mt-0.5 pl-1'>No MIDI devices found.</p>
              )}
            </div>

            <div className='border-t border-t-neutral-400 border-b border-b-white' />

            {/* Status */}
            <div>
              <p>Status:</p>
              <p className='pl-4'>
                {selectedPortId
                  ? isReceiving
                    ? 'Receiving clock signal'
                    : 'Waiting for clock signal…'
                  : 'No port selected'}
              </p>
            </div>

            {syncedBpm !== null && (
              <div>
                <p>Synced BPM:</p>
                <p className='pl-4 font-bold'>{syncedBpm.toFixed(1)}</p>
              </div>
            )}

            <div className='border-t border-t-neutral-400 border-b border-b-white' />

            <p className='text-neutral-500 italic leading-tight'>
              Concrete 95 will follow the incoming MIDI clock tempo. Transport BPM is overridden while sync is active.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
