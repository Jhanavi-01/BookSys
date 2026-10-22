'use client';

import { MusicalNoteIcon } from '@heroicons/react/24/solid';

export default function RotatingBadge() {
  const text = 'HEAR IT. SEE IT. FEEL IT. LIVE IT. ';

  return (
    <div className="relative h-32 w-32 cursor-pointer group">
      {/* Rotating text */}
      <svg
        className="h-full w-full animate-spin-slow"
        viewBox="0 0 200 200"
      >
        <defs>
          <path
            id="circlePath"
            d="M 100, 100 m -75, 0 a 75,75 0 1,1 150,0 a 75,75 0 1,1 -150,0"
          />
        </defs>
        <text className="fill-gray-300 text-[15px] font-bold uppercase tracking-[6px]">
          <textPath href="#circlePath">
            {text}
          </textPath>
        </text>
      </svg>

      {/* Center circle with icon */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-orange-500/30 transition-transform duration-300 group-hover:scale-110">
          <MusicalNoteIcon className="h-7 w-7 text-white" />
        </div>
      </div>
    </div>
  );
}
