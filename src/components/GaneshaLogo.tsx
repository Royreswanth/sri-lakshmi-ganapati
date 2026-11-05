import React from "react";

interface GaneshaLogoProps {
  className?: string;
  size?: number;
  color?: string;
}

export const GaneshaLogo: React.FC<GaneshaLogoProps> = ({
  className = "",
  size = 48,
  color = "#C29013",
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="ganeshaGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#DFB03E" />
          <stop offset="50%" stopColor="#C29013" />
          <stop offset="100%" stopColor="#966C05" />
        </linearGradient>
        <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#C29013" floodOpacity="0.3" />
        </filter>
      </defs>

      <g stroke="url(#ganeshaGold)" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" filter="url(#softGlow)">
        {/* Mukut / Crown */}
        <path d="M50 10 L50 20" />
        <path d="M43 18 L50 10 L57 18" />
        <path d="M38 23 C42 20, 58 20, 62 23" />
        <path d="M41 27 C45 25, 55 25, 59 27" />

        {/* Forehead Tilak */}
        <path d="M50 24 L50 34" strokeWidth="2" />
        <circle cx="50" cy="27" r="1.5" fill="url(#ganeshaGold)" />
        <path d="M45 29 C48 31, 52 31, 55 29" strokeWidth="1.8" />

        {/* Head Outline & Ears */}
        {/* Left Ear */}
        <path d="M38 28 C26 26, 20 38, 25 48 C28 53, 35 52, 38 46" />
        {/* Right Ear */}
        <path d="M62 28 C74 26, 80 38, 75 48 C72 53, 65 52, 62 46" />

        {/* Eyes & Brow */}
        <path d="M40 37 C42 36, 44 38, 43 40" strokeWidth="2" />
        <path d="M60 37 C58 36, 56 38, 57 40" strokeWidth="2" />

        {/* Trunk & Modak */}
        {/* Left Cheek to Trunk */}
        <path d="M38 46 C40 54, 42 66, 46 75 C49 81, 56 84, 62 80 C67 76, 67 69, 61 67 C55 65, 50 67, 49 71" />
        {/* Right Cheek / Tusk */}
        <path d="M62 46 C60 50, 58 54, 56 58" />
        {/* Broken Tusk on Right */}
        <path d="M58 50 L64 52" strokeWidth="2.2" />

        {/* Modak (Sweet) in Trunk tip */}
        <ellipse cx="61" cy="73" rx="3.5" ry="3.5" fill="url(#ganeshaGold)" fillOpacity="0.4" strokeWidth="2" />

        {/* Om / Sacred symbol gesture accents */}
        <path d="M32 40 C34 42, 35 44, 34 46" strokeWidth="1.5" />
        <path d="M68 40 C66 42, 65 44, 66 46" strokeWidth="1.5" />
      </g>
    </svg>
  );
};
