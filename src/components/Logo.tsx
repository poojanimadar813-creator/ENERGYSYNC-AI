import React from 'react';

interface LogoProps {
  compact?: boolean;
}

export const EnergySyncLogo: React.FC<LogoProps> = ({ compact = false }) => {
  return (
    <div className="flex items-center gap-3 select-none">
      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-violet-500/35 bg-[#121C33]">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          {/* Outer energy sync ring */}
          <path
            d="M12 2.5C6.75 2.5 2.5 6.75 2.5 12C2.5 15.1 3.98 17.85 6.28 19.58"
            stroke="#8B5CF6"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
          <path
            d="M12 21.5C17.25 21.5 21.5 17.25 21.5 12C21.5 8.9 20.02 6.15 17.72 4.42"
            stroke="#10B981"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
          {/* Lightning bolt */}
          <path
            d="M13 5.5L8.5 12.5H12L11 18.5L15.5 11.5H12L13 5.5Z"
            fill="#10B981"
            stroke="#34D399"
            strokeWidth="0.6"
            strokeLinejoin="round"
          />
          {/* AI neural nodes */}
          <circle cx="17.8" cy="4.4" r="1.4" fill="#A78BFA" />
          <circle cx="6.2" cy="19.6" r="1.4" fill="#34D399" />
        </svg>
      </div>
      {!compact && (
        <div className="min-w-0">
          <div className="font-display text-[15px] font-bold tracking-tight text-white whitespace-nowrap">
            ENERGYSYNC <span className="text-violet-400">AI</span>
          </div>
          <div className="text-[11px] text-slate-400 whitespace-nowrap truncate">
            Predict. Monitor. Optimize. Save Energy.
          </div>
        </div>
      )}
    </div>
  );
};
