interface Props {
  variant?: 'hero' | 'compact'
  className?: string
}

export default function UdaanUniverseIllustration({ variant = 'hero', className = '' }: Props) {
  const isCompact = variant === 'compact'

  return (
    <div
      className={`relative w-full select-none ${className}`}
      aria-label="Illustration of The Udaan Universe with a guide traveler and floating islands of opportunity"
      role="img"
    >
      <svg
        viewBox={isCompact ? '0 0 600 400' : '0 0 680 540'}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto overflow-visible filter drop-shadow-[0_12px_36px_rgba(7,26,53,0.08)]"
      >
        <defs>
          {/* Gradients */}
          <linearGradient id="skyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFDF9" />
            <stop offset="50%" stopColor="#F9F4EB" />
            <stop offset="100%" stopColor="#F3ECE0" />
          </linearGradient>

          <linearGradient id="goldPathGrad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#B77A22" />
            <stop offset="40%" stopColor="#E5A638" />
            <stop offset="70%" stopColor="#F9CF6E" />
            <stop offset="100%" stopColor="#B77A22" />
          </linearGradient>

          <linearGradient id="goldGlowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#B77A22" stopOpacity="0" />
          </linearGradient>

          <linearGradient id="navyIsland" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0E2A4D" />
            <stop offset="100%" stopColor="#071A35" />
          </linearGradient>

          <linearGradient id="islandTopGreen" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#2E6F56" />
            <stop offset="100%" stopColor="#3F8D71" />
          </linearGradient>

          <linearGradient id="islandTopBlue" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#1E3A8A" />
            <stop offset="100%" stopColor="#2563EB" />
          </linearGradient>

          <linearGradient id="islandTopGold" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#B77A22" />
            <stop offset="100%" stopColor="#D98E28" />
          </linearGradient>

          <linearGradient id="islandTopPurple" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6D28D9" />
            <stop offset="100%" stopColor="#8B5CF6" />
          </linearGradient>

          <linearGradient id="islandTopWarm" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#9A3412" />
            <stop offset="100%" stopColor="#C2410C" />
          </linearGradient>

          <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FDE68A" stopOpacity="0.8" />
            <stop offset="60%" stopColor="#F59E0B" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
          </radialGradient>

          <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          <filter id="badgeShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#071A35" floodOpacity="0.12" />
          </filter>

          <style>
            {`
              @keyframes udaanFloat {
                0%, 100% { transform: translateY(0px); }
                50% { transform: translateY(-7px); }
              }
              @keyframes udaanFloatReverse {
                0%, 100% { transform: translateY(0px); }
                50% { transform: translateY(6px); }
              }
              @keyframes udaanPulseGlow {
                0%, 100% { opacity: 0.6; }
                50% { opacity: 0.95; }
              }
              @keyframes udaanPathDash {
                to { stroke-dashoffset: -120; }
              }
              @keyframes udaanTwinkle {
                0%, 100% { opacity: 0.3; transform: scale(0.9); }
                50% { opacity: 1; transform: scale(1.15); }
              }

              @media (prefers-reduced-motion: no-preference) {
                .udaan-island-1 { animation: udaanFloat 6s ease-in-out infinite; transform-origin: center; }
                .udaan-island-2 { animation: udaanFloatReverse 7s ease-in-out infinite; transform-origin: center; }
                .udaan-island-3 { animation: udaanFloat 8s ease-in-out infinite; transform-origin: center; }
                .udaan-island-4 { animation: udaanFloatReverse 6.5s ease-in-out infinite; transform-origin: center; }
                .udaan-sun { animation: udaanPulseGlow 4s ease-in-out infinite; }
                .udaan-path-line { animation: udaanPathDash 25s linear infinite; }
                .udaan-twinkle-1 { animation: udaanTwinkle 3s ease-in-out infinite; }
                .udaan-twinkle-2 { animation: udaanTwinkle 4s ease-in-out 1.5s infinite; }
              }
            `}
          </style>
        </defs>

        {/* ─── Background Ambient Atmosphere ─── */}
        <circle cx={isCompact ? 460 : 510} cy={isCompact ? 100 : 120} r="160" fill="url(#sunGlow)" className="udaan-sun" />
        <circle cx={isCompact ? 140 : 170} cy={isCompact ? 280 : 340} r="180" fill="#EAE0D0" opacity="0.4" />

        {/* Constellation Stars (Gold & Ivory) */}
        <g opacity="0.75">
          <path d="M120 70 L122 75 L127 77 L122 79 L120 84 L118 79 L113 77 L118 75 Z" fill="#D98E28" className="udaan-twinkle-1" />
          <path d="M300 45 L301.5 49 L306 50.5 L301.5 52 L300 56 L298.5 52 L294 50.5 L298.5 49 Z" fill="#B77A22" className="udaan-twinkle-2" />
          <path d="M540 85 L541.5 89 L546 90.5 L541.5 92 L540 96 L538.5 92 L534 90.5 L538.5 89 Z" fill="#D98E28" className="udaan-twinkle-1" />
          <path d="M230 150 L231 153 L234 154 L231 155 L230 158 L229 155 L226 154 L229 153 Z" fill="#C88A2D" />
          <path d="M610 220 L611.5 224 L616 225.5 L611.5 227 L610 231 L608.5 227 L604 225.5 L608.5 224 Z" fill="#B77A22" className="udaan-twinkle-2" />
          <path d="M410 40 L411 43 L414 44 L411 45 L410 48 L409 45 L406 44 L409 43 Z" fill="#E5A638" />
        </g>

        {/* Subtle Constellation Lines */}
        <path d="M120 77 Q210 110 300 50 T540 90" stroke="#B77A22" strokeWidth="1" strokeDasharray="3 4" opacity="0.3" />

        {/* ─── The Winding Golden Journey Path (Back Glow & Main Ribbon) ─── */}
        <path
          d={
            isCompact
              ? 'M 110 330 C 190 270, 240 320, 310 230 C 370 150, 430 190, 520 110'
              : 'M 130 460 C 220 380, 270 420, 350 310 C 420 200, 480 250, 580 130'
          }
          stroke="url(#goldGlowGrad)"
          strokeWidth="18"
          strokeLinecap="round"
          filter="url(#softGlow)"
        />
        <path
          d={
            isCompact
              ? 'M 110 330 C 190 270, 240 320, 310 230 C 370 150, 430 190, 520 110'
              : 'M 130 460 C 220 380, 270 420, 350 310 C 420 200, 480 250, 580 130'
          }
          stroke="url(#goldPathGrad)"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path
          d={
            isCompact
              ? 'M 110 330 C 190 270, 240 320, 310 230 C 370 150, 430 190, 520 110'
              : 'M 130 460 C 220 380, 270 420, 350 310 C 420 200, 480 250, 580 130'
          }
          stroke="#FFFFFF"
          strokeWidth="2"
          strokeDasharray="6 14"
          strokeLinecap="round"
          opacity="0.85"
          className="udaan-path-line"
        />

        {/* ─── FLOATING ISLAND 1: TECH & ENGINEERING (Top Left) ─── */}
        <g className="udaan-island-1" transform={isCompact ? 'translate(40, 70) scale(0.8)' : 'translate(60, 90)'}>
          {/* Island shadow */}
          <ellipse cx="80" cy="90" rx="60" ry="14" fill="#071A35" opacity="0.08" />
          {/* Rock body */}
          <path d="M20 50 Q80 100 140 50 L115 85 Q80 100 45 85 Z" fill="url(#navyIsland)" />
          {/* Island top turf */}
          <ellipse cx="80" cy="50" rx="60" ry="16" fill="url(#islandTopBlue)" />
          <ellipse cx="80" cy="48" rx="54" ry="13" fill="#3B82F6" opacity="0.25" />

          {/* Stylized Tech Architecture: Terminal, Grid & Antenna */}
          {/* Spire */}
          <line x1="80" y1="45" x2="80" y2="15" stroke="#93C5FD" strokeWidth="2" />
          <circle cx="80" cy="14" r="3" fill="#60A5FA" />
          <circle cx="80" cy="14" r="6" stroke="#60A5FA" strokeWidth="1" opacity="0.6" />
          {/* Code portal screen */}
          <rect x="52" y="24" width="34" height="24" rx="4" fill="#071A35" stroke="#60A5FA" strokeWidth="1.5" />
          <path d="M58 32 L63 36 L58 40" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <line x1="67" y1="40" x2="78" y2="40" stroke="#93C5FD" strokeWidth="1.5" strokeLinecap="round" />
          {/* Small crystal pylons */}
          <polygon points="110,48 116,34 122,48" fill="#60A5FA" opacity="0.8" />
          <polygon points="40,51 44,40 48,51" fill="#93C5FD" opacity="0.7" />

          {/* Floating Pill Label */}
          <g filter="url(#badgeShadow)">
            <rect x="25" y="98" width="110" height="24" rx="12" fill="#FFFFFF" stroke="#DBEAFE" strokeWidth="1" />
            <circle cx="39" cy="110" r="4" fill="#2563EB" />
            <text x="50" y="114" fill="#071A35" fontSize="10.5" fontFamily="Plus Jakarta Sans, sans-serif" fontWeight="700">
              Tech & AI
            </text>
          </g>
        </g>

        {/* ─── FLOATING ISLAND 2: EXAM & ACADEMIC SANCTUARY (JEE / NEET - Center Top) ─── */}
        <g className="udaan-island-2" transform={isCompact ? 'translate(220, 20) scale(0.82)' : 'translate(260, 30)'}>
          {/* Island shadow */}
          <ellipse cx="85" cy="85" rx="65" ry="14" fill="#071A35" opacity="0.08" />
          {/* Rock body */}
          <path d="M20 48 Q85 96 150 48 L125 80 Q85 96 45 80 Z" fill="url(#navyIsland)" />
          {/* Island top turf */}
          <ellipse cx="85" cy="48" rx="65" ry="16" fill="url(#islandTopGreen)" />
          <ellipse cx="85" cy="46" rx="58" ry="13" fill="#10B981" opacity="0.25" />

          {/* Academy Pillars & Scholarly Dome */}
          <rect x="55" y="26" width="6" height="20" rx="1" fill="#FFFFFF" />
          <rect x="70" y="26" width="6" height="20" rx="1" fill="#FFFFFF" />
          <rect x="98" y="26" width="6" height="20" rx="1" fill="#FFFFFF" />
          <rect x="113" y="26" width="6" height="20" rx="1" fill="#FFFFFF" />
          {/* Pediment / Roof */}
          <polygon points="50,26 87,8 124,26" fill="#F8FAFC" />
          <polygon points="52,26 87,11 122,26" fill="#D98E28" opacity="0.8" />
          {/* Open Book symbol in center */}
          <path d="M78 36 Q87 34 96 36 L96 44 Q87 42 78 44 Z" fill="#FBF8F1" stroke="#071A35" strokeWidth="1" />
          <line x1="87" y1="34" x2="87" y2="43" stroke="#B77A22" strokeWidth="1" />
          {/* Mini orbit atom */}
          <ellipse cx="87" cy="8" rx="12" ry="5" stroke="#F59E0B" strokeWidth="1" fill="none" transform="rotate(-20 87 8)" />

          {/* Floating Pill Label */}
          <g filter="url(#badgeShadow)">
            <rect x="25" y="94" width="120" height="24" rx="12" fill="#FFFFFF" stroke="#D1FAE5" strokeWidth="1" />
            <circle cx="40" cy="106" r="4" fill="#059669" />
            <text x="50" y="110" fill="#071A35" fontSize="10.5" fontFamily="Plus Jakarta Sans, sans-serif" fontWeight="700">
              JEE & NEET Prep
            </text>
          </g>
        </g>

        {/* ─── FLOATING ISLAND 3: STARTUPS & VENTURES (Top Right) ─── */}
        <g className="udaan-island-3" transform={isCompact ? 'translate(410, 50) scale(0.85)' : 'translate(470, 60)'}>
          {/* Island shadow */}
          <ellipse cx="80" cy="90" rx="60" ry="14" fill="#071A35" opacity="0.08" />
          {/* Rock body */}
          <path d="M20 50 Q80 98 140 50 L115 82 Q80 98 45 82 Z" fill="url(#navyIsland)" />
          {/* Island top turf */}
          <ellipse cx="80" cy="50" rx="60" ry="16" fill="url(#islandTopWarm)" />
          <ellipse cx="80" cy="48" rx="52" ry="13" fill="#EA580C" opacity="0.25" />

          {/* Ascending Rocket with Vapor plume */}
          {/* Vapor exhaust */}
          <ellipse cx="80" cy="46" rx="8" ry="4" fill="#FDE047" opacity="0.8" />
          <path d="M76 46 Q80 54 84 46" fill="#F97316" />
          {/* Rocket fuselage */}
          <path d="M80 12 C74 24 74 36 74 40 L86 40 C86 36 86 24 80 12 Z" fill="#FFFFFF" />
          {/* Rocket tip */}
          <path d="M80 12 C77 18 77 22 77 24 L83 24 C83 22 83 18 80 12 Z" fill="#DC2626" />
          {/* Rocket fin */}
          <polygon points="74,34 68,42 74,40" fill="#B77A22" />
          <polygon points="86,34 92,42 86,40" fill="#B77A22" />
          {/* Port window */}
          <circle cx="80" cy="28" r="3" fill="#0284C7" stroke="#FFFFFF" strokeWidth="1" />

          {/* Floating Pill Label */}
          <g filter="url(#badgeShadow)">
            <rect x="22" y="96" width="116" height="24" rx="12" fill="#FFFFFF" stroke="#FED7AA" strokeWidth="1" />
            <circle cx="36" cy="108" r="4" fill="#EA580C" />
            <text x="47" y="112" fill="#071A35" fontSize="10.5" fontFamily="Plus Jakarta Sans, sans-serif" fontWeight="700">
              Startups & 0→1
            </text>
          </g>
        </g>

        {/* ─── FLOATING ISLAND 4: CREATIVE, CRAFT & SKILLS (Mid Right) ─── */}
        <g className="udaan-island-4" transform={isCompact ? 'translate(360, 210) scale(0.78)' : 'translate(440, 260)'}>
          {/* Island shadow */}
          <ellipse cx="75" cy="80" rx="55" ry="13" fill="#071A35" opacity="0.08" />
          {/* Rock body */}
          <path d="M20 45 Q75 90 130 45 L110 75 Q75 90 40 75 Z" fill="url(#navyIsland)" />
          {/* Island top turf */}
          <ellipse cx="75" cy="45" rx="55" ry="15" fill="url(#islandTopPurple)" />
          <ellipse cx="75" cy="43" rx="48" ry="12" fill="#A855F7" opacity="0.25" />

          {/* Palette, easel & geometric crystal gems */}
          <polygon points="75,18 86,34 64,34" fill="#FBBF24" />
          <polygon points="56,26 64,38 48,38" fill="#EC4899" />
          <polygon points="94,24 102,38 86,38" fill="#38BDF8" />
          <circle cx="75" cy="24" r="2.5" fill="#FFFFFF" />

          {/* Floating Pill Label */}
          <g filter="url(#badgeShadow)">
            <rect x="15" y="88" width="120" height="24" rx="12" fill="#FFFFFF" stroke="#E9D5FF" strokeWidth="1" />
            <circle cx="30" cy="100" r="4" fill="#7C3AED" />
            <text x="40" y="104" fill="#071A35" fontSize="10.5" fontFamily="Plus Jakarta Sans, sans-serif" fontWeight="700">
              Skills & Design
            </text>
          </g>
        </g>

        {/* ─── BASE CAMP / LAUNCH HILL (Left Bottom) & THE GUIDE CHARACTER ─── */}
        <g transform={isCompact ? 'translate(30, 240) scale(0.82)' : 'translate(40, 310)'}>
          {/* Launch hill base */}
          <ellipse cx="140" cy="180" rx="110" ry="24" fill="#071A35" opacity="0.12" />
          <path d="M20 120 Q140 70 260 120 L240 180 Q140 210 40 180 Z" fill="url(#navyIsland)" />
          <ellipse cx="140" cy="115" rx="115" ry="30" fill="url(#islandTopGold)" />
          <ellipse cx="140" cy="110" rx="105" ry="25" fill="#F59E0B" opacity="0.3" />

          {/* Stepping stones on the hill */}
          <ellipse cx="100" cy="116" rx="16" ry="6" fill="#FDFBF7" opacity="0.8" />
          <ellipse cx="150" cy="112" rx="18" ry="7" fill="#FDFBF7" opacity="0.9" />
          <ellipse cx="195" cy="118" rx="14" ry="5" fill="#FDFBF7" opacity="0.75" />

          {/* Signpost pointing forward */}
          <rect x="75" y="65" width="4" height="48" rx="2" fill="#78350F" />
          <path d="M76 65 L115 65 L124 73 L115 81 L76 81 Z" fill="#071A35" stroke="#F59E0B" strokeWidth="1" />
          <text x="82" y="75" fill="#FDFBF7" fontSize="7.5" fontFamily="Plus Jakarta Sans, sans-serif" fontWeight="700">
            UDAAN 30
          </text>

          {/* ─── THE GUIDE CHARACTER ─── */}
          {/* Friendly stylized traveler guide looking up at the sky */}
          <g transform="translate(135, 18)">
            {/* Guide shadow */}
            <ellipse cx="15" cy="94" rx="14" ry="4" fill="#071A35" opacity="0.3" />

            {/* Legs & boots */}
            <rect x="7" y="70" width="6" height="22" rx="3" fill="#071A35" />
            <rect x="17" y="70" width="6" height="22" rx="3" fill="#071A35" />
            <path d="M5 88 L14 88 L14 93 L4 93 Z" fill="#78350F" />
            <path d="M16 88 L25 88 L25 93 L15 93 Z" fill="#78350F" />

            {/* Explorer Coat / Tunic (Helpamart Cream & Navy trim) */}
            <path d="M4 42 Q15 38 26 42 L29 72 Q15 76 1 72 Z" fill="#FBF8F1" stroke="#071A35" strokeWidth="1.5" />
            {/* Gold Explorer Belt & Buckle */}
            <rect x="2" y="55" width="26" height="5" rx="1" fill="#B77A22" />
            <rect x="12" y="54" width="6" height="7" rx="1" fill="#FDE047" stroke="#071A35" strokeWidth="1" />

            {/* Wind-blown golden scarf / cape */}
            <path d="M22 40 C34 38 42 46 48 42 C40 50 32 54 22 48 Z" fill="#D98E28" />

            {/* Arms holding brass telescope pointing to the stars */}
            {/* Left arm */}
            <path d="M7 44 L-4 56 L0 60 L11 48 Z" fill="#071A35" />
            {/* Right arm extending telescope upwards */}
            <path d="M23 44 L34 32 L38 35 L26 50 Z" fill="#071A35" />

            {/* Brass Telescope */}
            <g transform="rotate(-38 28 32)">
              <rect x="20" y="24" width="28" height="6" rx="2" fill="#B77A22" stroke="#071A35" strokeWidth="1" />
              <rect x="44" y="22" width="10" height="10" rx="2" fill="#D98E28" stroke="#071A35" strokeWidth="1" />
              <rect x="14" y="25" width="8" height="4" rx="1" fill="#78350F" />
              {/* Light beam from lens */}
              <polygon points="54,23 90,14 90,40 54,31" fill="#FEF08A" opacity="0.35" />
            </g>

            {/* Head & Expression */}
            <circle cx="15" cy="30" r="10" fill="#FDDCB5" stroke="#071A35" strokeWidth="1.2" />
            {/* Friendly ear */}
            <circle cx="5" cy="31" r="2.5" fill="#FDDCB5" />
            {/* Explorer Beret / Cap */}
            <path d="M4 27 Q15 16 27 25 Q30 20 20 18 Q8 18 4 27 Z" fill="#071A35" />
            <circle cx="16" cy="18" r="2" fill="#B77A22" />
            {/* Cheerful eye looking up */}
            <circle cx="18" cy="28" r="1.5" fill="#071A35" />
            {/* Friendly smile */}
            <path d="M15 34 Q18 37 21 34" stroke="#071A35" strokeWidth="1.2" strokeLinecap="round" fill="none" />

            {/* Golden lantern on backpack with warm glow */}
            <rect x="-2" y="44" width="7" height="14" rx="2" fill="#78350F" />
            <circle cx="-5" cy="62" r="5" fill="#FDE047" opacity="0.9" />
            <circle cx="-5" cy="62" r="12" fill="#F59E0B" opacity="0.3" filter="url(#softGlow)" />
          </g>

          {/* Launch Flag */}
          <g transform="translate(210, 58)">
            <line x1="0" y1="0" x2="0" y2="55" stroke="#B77A22" strokeWidth="2" strokeLinecap="round" />
            <polygon points="0,0 28,10 0,20" fill="#C2410C" stroke="#7C2D12" strokeWidth="0.8" />
            <circle cx="0" cy="0" r="3" fill="#D98E28" />
          </g>

          {/* Floating Pill Label */}
          <g filter="url(#badgeShadow)">
            <rect x="85" y="148" width="110" height="24" rx="12" fill="#071A35" stroke="#B77A22" strokeWidth="1" />
            <circle cx="99" cy="160" r="4" fill="#F59E0B" />
            <text x="110" y="164" fill="#FFFFFF" fontSize="10.5" fontFamily="Plus Jakarta Sans, sans-serif" fontWeight="700">
              Start: Day 1
            </text>
          </g>
        </g>

        {/* ─── MILESTONE CHECKPOINT MARKERS ALONG THE GOLDEN PATH ─── */}
        {!isCompact && (
          <>
            {/* Milestone 1 Marker */}
            <g transform="translate(245, 345)" filter="url(#badgeShadow)">
              <circle cx="0" cy="0" r="12" fill="#FFFFFF" stroke="#B77A22" strokeWidth="2.5" />
              <text x="0" y="4" textAnchor="middle" fill="#071A35" fontSize="9" fontFamily="Plus Jakarta Sans, sans-serif" fontWeight="800">
                W1
              </text>
              <rect x="18" y="-10" width="82" height="20" rx="10" fill="#FFFFFF" stroke="#E5E7EB" strokeWidth="0.8" />
              <text x="27" y="4" fill="#071A35" fontSize="9" fontFamily="Plus Jakarta Sans, sans-serif" fontWeight="600">
                Discover & Plan
              </text>
            </g>

            {/* Milestone 2 Marker */}
            <g transform="translate(370, 240)" filter="url(#badgeShadow)">
              <circle cx="0" cy="0" r="12" fill="#FFFFFF" stroke="#B77A22" strokeWidth="2.5" />
              <text x="0" y="4" textAnchor="middle" fill="#071A35" fontSize="9" fontFamily="Plus Jakarta Sans, sans-serif" fontWeight="800">
                W2
              </text>
              <rect x="18" y="-10" width="82" height="20" rx="10" fill="#FFFFFF" stroke="#E5E7EB" strokeWidth="0.8" />
              <text x="27" y="4" fill="#071A35" fontSize="9" fontFamily="Plus Jakarta Sans, sans-serif" fontWeight="600">
                Build & Practice
              </text>
            </g>

            {/* Milestone 3 Marker */}
            <g transform="translate(470, 190)" filter="url(#badgeShadow)">
              <circle cx="0" cy="0" r="12" fill="#FFFFFF" stroke="#B77A22" strokeWidth="2.5" />
              <text x="0" y="4" textAnchor="middle" fill="#071A35" fontSize="9" fontFamily="Plus Jakarta Sans, sans-serif" fontWeight="800">
                W3
              </text>
              <rect x="18" y="-10" width="84" height="20" rx="10" fill="#FFFFFF" stroke="#E5E7EB" strokeWidth="0.8" />
              <text x="27" y="4" fill="#071A35" fontSize="9" fontFamily="Plus Jakarta Sans, sans-serif" fontWeight="600">
                Review & Refine
              </text>
            </g>

            {/* Day 30 Launch Goal Marker */}
            <g transform="translate(580, 115)" filter="url(#badgeShadow)">
              <circle cx="0" cy="0" r="14" fill="#B77A22" stroke="#FFFFFF" strokeWidth="2" />
              <text x="0" y="4" textAnchor="middle" fill="#FFFFFF" fontSize="9" fontFamily="Plus Jakarta Sans, sans-serif" fontWeight="800">
                ★
              </text>
              <rect x="-50" y="-36" width="100" height="22" rx="11" fill="#071A35" stroke="#B77A22" strokeWidth="1" />
              <text x="0" y="-22" textAnchor="middle" fill="#FFFFFF" fontSize="9.5" fontFamily="Plus Jakarta Sans, sans-serif" fontWeight="700">
                Day 30: Launch!
              </text>
            </g>
          </>
        )}
      </svg>
    </div>
  )
}
