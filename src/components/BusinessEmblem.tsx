import React from "react";
import { EmblemType } from "../types";

interface BusinessEmblemProps {
  emblem?: EmblemType | string;
  size?: number;
  color?: string;
  className?: string;
}

export const BusinessEmblem: React.FC<BusinessEmblemProps> = ({
  emblem = "ganesha",
  size = 48,
  color = "#D97706", // Default warm rich gold
  className = "",
}) => {
  const gradientId = `emblem-grad-${emblem}-${color.replace(/[^a-zA-Z0-9]/g, "")}`;
  const filterId = `emblem-glow-${emblem}-${color.replace(/[^a-zA-Z0-9]/g, "")}`;

  // Render SVG based on chosen religious or secular emblem
  const renderEmblemPath = () => {
    switch (emblem) {
      case "lakshmi":
        // Goddess Lakshmi - Lotus & Golden Grace
        return (
          <g stroke={`url(#${gradientId})`} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
            {/* Lotus Throne */}
            <path d="M50 78 C35 78, 26 68, 25 58 C32 63, 42 64, 50 64 C58 64, 68 63, 75 58 C74 68, 65 78, 50 78 Z" />
            <path d="M50 64 C42 54, 38 40, 50 28 C62 40, 58 54, 50 64 Z" fill={`url(#${gradientId})`} fillOpacity="0.25" />
            {/* Left Petals */}
            <path d="M38 52 C26 44, 25 32, 33 22 C39 30, 42 42, 44 48" />
            <path d="M28 58 C18 52, 16 40, 22 34 C26 42, 30 48, 32 54" />
            {/* Right Petals */}
            <path d="M62 52 C74 44, 75 32, 67 22 C61 30, 58 42, 56 48" />
            <path d="M72 58 C82 52, 84 40, 78 34 C74 42, 70 48, 68 54" />
            {/* Kalasam / Pot of Gold on top */}
            <path d="M43 24 L57 24 L54 16 L46 16 Z" />
            <circle cx="50" cy="12" r="3.5" fill={`url(#${gradientId})`} />
            {/* Golden Coins falling */}
            <circle cx="50" cy="85" r="2.5" fill={`url(#${gradientId})`} />
            <circle cx="42" cy="87" r="2" fill={`url(#${gradientId})`} />
            <circle cx="58" cy="87" r="2" fill={`url(#${gradientId})`} />
          </g>
        );

      case "venkateswara":
        // Lord Venkateswara / Balaji - Tirupati Namam with Shankha & Chakra
        return (
          <g stroke={`url(#${gradientId})`} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
            {/* Center Sacred Namam U-shape */}
            <path d="M36 20 C36 45, 42 66, 50 68 C58 66, 64 45, 64 20" strokeWidth="3.2" />
            <path d="M40 22 C40 40, 44 58, 50 60 C56 58, 60 40, 60 22" strokeWidth="2" />
            {/* Center Red/Orange Kasturi Tilakam line */}
            <path d="M50 24 L50 78" strokeWidth="3.5" stroke="#DC2626" />
            <circle cx="50" cy="82" r="3" fill="#DC2626" stroke="#DC2626" />
            {/* Left Shankha (Conch) symbol */}
            <path d="M22 32 C16 36, 16 46, 22 50 C26 46, 28 40, 24 34 Z" strokeWidth="2" />
            <path d="M20 40 L25 42" strokeWidth="1.8" />
            {/* Right Sudarshana Chakra symbol */}
            <circle cx="78" cy="41" r="7" strokeWidth="2" />
            <path d="M78 34 L78 48" strokeWidth="1.8" />
            <path d="M71 41 L85 41" strokeWidth="1.8" />
            {/* Decorative Crown Arc */}
            <path d="M30 16 C42 10, 58 10, 70 16" strokeWidth="2" />
            <circle cx="50" cy="10" r="2.5" fill={`url(#${gradientId})`} />
          </g>
        );

      case "shiva":
        // Lord Shiva - Sacred Trishul with Crescent Moon & Damru
        return (
          <g stroke={`url(#${gradientId})`} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
            {/* Center Trishul Blade */}
            <path d="M50 8 L50 88" strokeWidth="3.2" />
            <path d="M46 16 L50 8 L54 16" strokeWidth="2.5" />
            {/* Outer Trishul Prongs */}
            <path d="M28 22 C30 38, 42 46, 50 48 C58 46, 70 38, 72 22" strokeWidth="3" />
            <path d="M25 24 L28 16 L33 24" strokeWidth="2.2" />
            <path d="M67 24 L72 16 L75 24" strokeWidth="2.2" />
            {/* Damru (Hourglass drum) */}
            <path d="M42 58 L58 58 L42 70 L58 70 Z" fill={`url(#${gradientId})`} fillOpacity="0.2" strokeWidth="2" />
            <line x1="42" y1="64" x2="58" y2="64" strokeWidth="1.5" />
            {/* Crescent Moon on Side */}
            <path d="M34 32 C38 26, 38 18, 33 12 C34 16, 36 24, 30 26 Z" fill={`url(#${gradientId})`} />
            {/* Tripundra (3 lines on center) */}
            <line x1="45" y1="36" x2="55" y2="36" strokeWidth="1.8" />
            <line x1="45" y1="40" x2="55" y2="40" strokeWidth="1.8" />
            <line x1="45" y1="44" x2="55" y2="44" strokeWidth="1.8" />
            <circle cx="50" cy="40" r="1.5" fill="#DC2626" stroke="#DC2626" />
          </g>
        );

      case "cross":
        // Christian Cross - Holy Cross with Radiant Grace
        return (
          <g stroke={`url(#${gradientId})`} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" fill="none">
            {/* Vertical Beam */}
            <path d="M50 10 L50 88" strokeWidth="4.5" />
            {/* Horizontal Crossbar */}
            <path d="M22 34 L78 34" strokeWidth="4.5" />
            {/* Decorative End Caps */}
            <path d="M46 10 L54 10" strokeWidth="3.5" />
            <path d="M44 88 L56 88" strokeWidth="3.5" />
            <path d="M22 30 L22 38" strokeWidth="3.5" />
            <path d="M78 30 L78 38" strokeWidth="3.5" />
            {/* Radiant Sunburst behind the center */}
            <circle cx="50" cy="34" r="13" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.6" />
            <line x1="50" y1="16" x2="50" y2="20" strokeWidth="1.8" />
            <line x1="50" y1="48" x2="50" y2="52" strokeWidth="1.8" />
            <line x1="32" y1="34" x2="36" y2="34" strokeWidth="1.8" />
            <line x1="64" y1="34" x2="68" y2="34" strokeWidth="1.8" />
            {/* Heart of Grace in center */}
            <circle cx="50" cy="34" r="3.5" fill={`url(#${gradientId})`} strokeWidth="1.5" />
          </g>
        );

      case "crescent":
        // Islamic Crescent Moon & Star (Hilal & Najm)
        return (
          <g stroke={`url(#${gradientId})`} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
            {/* Deep elegant Crescent Moon */}
            <path
              d="M56 16 C34 18, 20 36, 24 58 C28 76, 48 88, 68 80 C44 82, 32 60, 38 42 C42 30, 50 20, 56 16 Z"
              fill={`url(#${gradientId})`}
              fillOpacity="0.25"
              strokeWidth="2.8"
            />
            {/* Five-Point Star inside the crescent curve */}
            <path
              d="M68 32 L70.5 39.5 L78 40 L72 45 L74 53 L68 48 L62 53 L64 45 L58 40 L65.5 39.5 Z"
              fill={`url(#${gradientId})`}
              strokeWidth="1.8"
            />
            {/* Orbit Glow Dots */}
            <circle cx="76" cy="24" r="1.5" fill={`url(#${gradientId})`} />
            <circle cx="82" cy="34" r="1.2" fill={`url(#${gradientId})`} />
            <circle cx="80" cy="46" r="1.5" fill={`url(#${gradientId})`} />
          </g>
        );

      case "crown":
        // Secular Imperial Crown - Majesty, Trust & Financial Strength
        return (
          <g stroke={`url(#${gradientId})`} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none">
            {/* Crown Base Band */}
            <rect x="20" y="68" width="60" height="10" rx="3" strokeWidth="2.5" fill={`url(#${gradientId})`} fillOpacity="0.2" />
            <circle cx="30" cy="73" r="2" fill={`url(#${gradientId})`} />
            <circle cx="50" cy="73" r="2.5" fill={`url(#${gradientId})`} />
            <circle cx="70" cy="73" r="2" fill={`url(#${gradientId})`} />
            {/* Crown Peaks */}
            <path
              d="M22 68 L20 38 L36 50 L50 26 L64 50 L80 38 L78 68 Z"
              fill={`url(#${gradientId})`}
              fillOpacity="0.15"
              strokeWidth="2.8"
            />
            {/* Jewels on Peaks */}
            <circle cx="20" cy="36" r="3.5" fill={`url(#${gradientId})`} />
            <circle cx="50" cy="24" r="4.5" fill={`url(#${gradientId})`} />
            <circle cx="80" cy="36" r="3.5" fill={`url(#${gradientId})`} />
            <circle cx="36" cy="49" r="2.2" fill={`url(#${gradientId})`} />
            <circle cx="64" cy="49" r="2.2" fill={`url(#${gradientId})`} />
            {/* Cross / Crest on Top Center */}
            <line x1="50" y1="14" x2="50" y2="20" strokeWidth="2" />
            <line x1="47" y1="17" x2="53" y2="17" strokeWidth="2" />
          </g>
        );

      case "tree":
        // Kalpavriksha / Tree of Wealth & Abundance
        return (
          <g stroke={`url(#${gradientId})`} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
            {/* Trunk & Strong Roots */}
            <path d="M48 84 L48 58 C48 50, 42 44, 38 40" strokeWidth="3.2" />
            <path d="M52 84 L52 58 C52 50, 58 44, 62 40" strokeWidth="3.2" />
            <path d="M50 58 L50 36" strokeWidth="3" />
            <path d="M38 84 L62 84" strokeWidth="3" />
            {/* Canopy Arcs */}
            <path d="M30 60 C18 56, 16 38, 28 30 C26 20, 38 14, 50 20 C62 14, 74 20, 72 30 C84 38, 82 56, 70 60" strokeWidth="2.5" />
            {/* Golden Fruit Coins */}
            <circle cx="36" cy="36" r="3.5" fill={`url(#${gradientId})`} />
            <circle cx="50" cy="28" r="4" fill={`url(#${gradientId})`} />
            <circle cx="64" cy="36" r="3.5" fill={`url(#${gradientId})`} />
            <circle cx="44" cy="46" r="3" fill={`url(#${gradientId})`} />
            <circle cx="56" cy="46" r="3" fill={`url(#${gradientId})`} />
          </g>
        );

      case "ganesha":
      default:
        // Traditional Lord Ganesha - Mukut, Ears, Trunk & Modak
        return (
          <g stroke={`url(#${gradientId})`} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" filter={`url(#${filterId})`}>
            {/* Mukut / Crown */}
            <path d="M50 10 L50 20" />
            <path d="M43 18 L50 10 L57 18" />
            <path d="M38 23 C42 20, 58 20, 62 23" />
            <path d="M41 27 C45 25, 55 25, 59 27" />

            {/* Forehead Tilak */}
            <path d="M50 24 L50 34" strokeWidth="2" />
            <circle cx="50" cy="27" r="1.5" fill={`url(#${gradientId})`} />
            <path d="M45 29 C48 31, 52 31, 55 29" strokeWidth="1.8" />

            {/* Head Outline & Ears */}
            <path d="M38 28 C26 26, 20 38, 25 48 C28 53, 35 52, 38 46" />
            <path d="M62 28 C74 26, 80 38, 75 48 C72 53, 65 52, 62 46" />

            {/* Eyes */}
            <path d="M40 37 C42 36, 44 38, 43 40" strokeWidth="2" />
            <path d="M60 37 C58 36, 56 38, 57 40" strokeWidth="2" />

            {/* Trunk */}
            <path d="M38 46 C40 54, 42 66, 46 75 C49 81, 56 84, 62 80 C67 76, 67 69, 61 67 C55 65, 50 67, 49 71" />
            <path d="M62 46 C60 50, 58 54, 56 58" />
            <path d="M58 50 L64 52" strokeWidth="2.2" />

            {/* Modak (Sweet) in Trunk tip */}
            <ellipse cx="61" cy="73" rx="3.5" ry="3.5" fill={`url(#${gradientId})`} fillOpacity="0.5" strokeWidth="2" />

            {/* Sacred Om gestures */}
            <path d="M32 40 C34 42, 35 44, 34 46" strokeWidth="1.5" />
            <path d="M68 40 C66 42, 65 44, 66 46" strokeWidth="1.5" />
          </g>
        );
    }
  };

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
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.85" />
          <stop offset="50%" stopColor={color} />
          <stop offset="100%" stopColor={color} stopOpacity="0.95" />
        </linearGradient>
        <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor={color} floodOpacity="0.3" />
        </filter>
      </defs>

      {renderEmblemPath()}
    </svg>
  );
};
