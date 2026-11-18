"use client";

import { LOCI, getLocus, type LocusId } from "@/lib/palace";

type PalaceMapProps = {
  selected: string;
  onSelect: (id: LocusId) => void;
  linked?: string[];
  visited?: string[];
  testing?: boolean;
};

export function PalaceMap({
  selected,
  onSelect,
  linked = [],
  visited = [],
  testing = false,
}: PalaceMapProps) {
  return (
    <div
      className="palace-map"
      aria-label="خريطة البيت: خمسة أماكن في مسار ثابت"
    >
      <svg
        className="palace-floorplan"
        viewBox="0 0 700 480"
        aria-hidden="true"
      >
        <defs>
          <pattern
            id="palace-wood"
            width="20"
            height="20"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M0 20H20M0 0V20"
              fill="none"
              stroke="#c8b89e"
              strokeWidth=".5"
              opacity=".32"
            />
          </pattern>
          <pattern
            id="palace-tile"
            width="22"
            height="22"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M0 0H22V22H0Z"
              fill="none"
              stroke="#c5c7b2"
              strokeWidth=".6"
              opacity=".6"
            />
          </pattern>
          <filter
            id="house-shadow"
            x="-20%"
            y="-20%"
            width="140%"
            height="150%"
          >
            <feDropShadow
              dx="0"
              dy="10"
              stdDeviation="14"
              floodColor="#657067"
              floodOpacity=".09"
            />
          </filter>
        </defs>
        <rect
          x="27"
          y="12"
          width="646"
          height="447"
          rx="24"
          fill="#e6e9df"
          opacity=".7"
        />
        <g filter="url(#house-shadow)">
          <rect
            x="50"
            y="30"
            width="600"
            height="400"
            rx="3"
            fill="#faf6ed"
            stroke="#a2a89a"
            strokeWidth="6"
          />
          <path d="M50 30H300V215H50Z" fill="#e9edf0" />
          <path d="M400 30H650V215H400Z" fill="#eee9d5" />
          <path d="M400 215H650V430H400Z" fill="#e3eade" />
          <path d="M50 215H300V430H50Z" fill="#edf0e5" />
          <rect x="300" y="30" width="100" height="400" fill="#f1ece0" />
          <path
            d="M50 30H300V215H50Z M400 215H650V430H400Z M300 30H400V430H300Z"
            fill="url(#palace-wood)"
          />
          <path d="M400 30H650V215H400Z" fill="url(#palace-tile)" />
          <g stroke="#8e9a91" strokeWidth="5" fill="none">
            <path d="M300 30V90M300 157V430M400 30V90M400 157V270M400 340V430M50 215H300M400 215H480M555 215H650" />
          </g>
          <g stroke="#b1b8ac" strokeWidth="1.5" fill="none">
            <path d="M300 90A67 67 0 0 0 233 157H300M400 90A67 67 0 0 1 467 157H400M400 270A70 70 0 0 1 470 340H400M480 215A75 75 0 0 1 555 140V215" />
          </g>
          <g stroke="#93aaa9" strokeWidth="7">
            <path d="M90 30H230M475 30H590M650 278V370M50 90V155" />
          </g>
          <g fill="#b1bfa3">
            <circle cx="100" cy="265" r="22" />
            <circle cx="250" cy="375" r="28" />
            <circle cx="90" cy="375" r="31" />
          </g>
          <g fill="#91a284" opacity=".75">
            <circle cx="93" cy="256" r="15" />
            <circle cx="241" cy="365" r="20" />
            <circle cx="80" cy="365" r="23" />
          </g>
          <path
            d="M173 248C132 300 238 323 181 401"
            stroke="#d3d7c5"
            strokeWidth="18"
            fill="none"
          />
          <g fill="#9caa9d" fontSize="12" fontFamily="sans-serif">
            <text x="176" y="327" textAnchor="middle">
              فناء داخلي
            </text>
          </g>
          <g fill="#c5c9bc">
            <rect x="63" y="43" width="220" height="18" rx="2" />
            <rect x="63" y="64" width="18" height="121" rx="2" />
          </g>
          <g fill="#d3c4a0">
            <rect x="418" y="46" width="210" height="24" rx="2" />
            <rect x="603" y="70" width="25" height="112" rx="2" />
          </g>
          <g fill="#b9c8ae">
            <rect x="443" y="379" width="153" height="31" rx="8" />
            <rect x="443" y="355" width="31" height="55" rx="7" />
            <rect x="565" y="355" width="31" height="55" rx="7" />
          </g>
          <ellipse cx="524" cy="354" rx="41" ry="14" fill="#cfbf9e" />
          <path d="M321 430H379" stroke="#b6936f" strokeWidth="9" />
          <path
            d="M337 447H363"
            stroke="#b6936f"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </g>
        <path
          d="M350 398V270H525V122H175"
          stroke="#7f9992"
          strokeWidth="2"
          strokeDasharray="5 7"
          fill="none"
          opacity=".55"
        />
      </svg>
      {LOCI.map((locus) => (
        <button
          key={locus.id}
          type="button"
          className={`palace-map-pin ${selected === locus.id ? "is-selected" : ""} ${visited.includes(locus.id) ? "is-visited" : ""}`}
          style={
            {
              left: `${locus.x / 7}%`,
              top: `${locus.y / 4.8}%`,
              "--locus-color": locus.color,
            } as React.CSSProperties
          }
          onClick={() => onSelect(locus.id)}
          aria-pressed={selected === locus.id}
          aria-label={`${locus.number}. ${locus.name}${!testing && linked.includes(locus.id) ? "، مرتبط بمعلومة" : ""}`}
        >
          <span className="palace-pin-number">{locus.number}</span>
          <span>{locus.name}</span>
          {!testing && linked.includes(locus.id) && (
            <span className="palace-linked-dot" aria-hidden="true" />
          )}
        </button>
      ))}
    </div>
  );
}

export function PalaceScene({ locusId }: { locusId: string }) {
  const locus = getLocus(locusId) ?? LOCI[0];
  return (
    <svg
      className={`palace-scene palace-scene-${locus.id}`}
      viewBox="0 0 600 330"
      role="img"
      aria-label={`رسم توضيحي: ${locus.name}، ${locus.cue}`}
    >
      <defs>
        <linearGradient
          id={`scene-wall-${locus.id}`}
          x1="0"
          x2="0"
          y1="0"
          y2="1"
        >
          <stop stopColor="#f8f5ec" />
          <stop offset="1" stopColor="#e9e5d9" />
        </linearGradient>
        <linearGradient id={`scene-floor-${locus.id}`} x1="0" x2="1">
          <stop stopColor="#e6ddc9" />
          <stop offset="1" stopColor="#eee8d9" />
        </linearGradient>
      </defs>
      <rect width="600" height="330" fill={`url(#scene-wall-${locus.id})`} />
      <rect
        y="248"
        width="600"
        height="82"
        fill={`url(#scene-floor-${locus.id})`}
      />
      <path d="M0 248H600" stroke="#d0c9b9" strokeWidth="3" />
      <path
        d="M0 290H600M100 248L60 330M250 248L230 330M400 248L420 330M550 248L590 330"
        stroke="#d5cbb7"
        strokeWidth="1"
      />
      {locus.id === "entrance" && (
        <g>
          <path
            d="M222 248V100A78 78 0 0 1 378 100V248Z"
            fill="#c8ab89"
            stroke="#a68866"
            strokeWidth="8"
          />
          <path d="M237 248V106A63 63 0 0 1 363 106V248Z" fill="#dbc2a1" />
          <path
            d="M300 49V247M250 106H350M250 165H350"
            stroke="#b79772"
            strokeWidth="3"
          />
          <circle cx="346" cy="172" r="5" fill="#8f7859" />
          <ellipse
            cx="300"
            cy="275"
            rx="96"
            ry="18"
            fill="#c0b393"
            opacity=".6"
          />
          <path d="M100 247H162L153 290H110Z" fill="#c39b7b" />
          <path d="M131 247V151" stroke="#718669" strokeWidth="4" />
          <g fill="#8da080">
            <ellipse
              cx="107"
              cy="182"
              rx="16"
              ry="34"
              transform="rotate(-40 107 182)"
            />
            <ellipse
              cx="152"
              cy="160"
              rx="14"
              ry="31"
              transform="rotate(35 152 160)"
            />
            <ellipse
              cx="111"
              cy="220"
              rx="13"
              ry="28"
              transform="rotate(-55 111 220)"
            />
          </g>
          <rect x="430" y="181" width="91" height="12" rx="3" fill="#b49a77" />
          <path d="M442 194V252M510 194V252" stroke="#b49a77" strokeWidth="5" />
          <ellipse cx="475" cy="173" rx="16" ry="7" fill="#e5d9bd" />
          <path d="M475 168V147" stroke="#8b9d80" strokeWidth="3" />
          <circle cx="475" cy="140" r="12" fill="#bac4a1" />
        </g>
      )}
      {locus.id === "hallway" && (
        <g>
          <path
            d="M120 0L232 71V247L120 330M480 0L368 71V247L480 330"
            fill="#e1decf"
            opacity=".5"
          />
          <path d="M232 71H368V247H232Z" fill="#f5f0e3" />
          <path
            d="M255 247V126A45 45 0 0 1 345 126V247"
            fill="#d8e1d9"
            stroke="#b4c0b3"
            strokeWidth="4"
          />
          <rect
            x="130"
            y="56"
            width="50"
            height="148"
            rx="24"
            fill="#cbd8d2"
            stroke="#bca886"
            strokeWidth="7"
          />
          <path
            d="M141 77L170 169"
            stroke="#f0f5ed"
            strokeWidth="7"
            opacity=".6"
          />
          <rect
            x="414"
            y="90"
            width="40"
            height="59"
            fill="#f8f6ed"
            stroke="#b8ad93"
            strokeWidth="4"
          />
          <path
            d="M421 132L432 113L448 130"
            stroke="#9aa88a"
            strokeWidth="3"
            fill="none"
          />
          <path d="M282 246H318L356 330H245Z" fill="#c0b18e" opacity=".75" />
          <ellipse cx="300" cy="53" rx="23" ry="7" fill="#bdac85" />
          <path d="M300 0V46" stroke="#b7ab93" strokeWidth="2" />
          <circle cx="300" cy="58" r="5" fill="#fff4cc" />
        </g>
      )}
      {locus.id === "living-room" && (
        <g>
          <rect
            x="70"
            y="49"
            width="122"
            height="128"
            rx="53"
            fill="#d5e3df"
            stroke="#c5c7b5"
            strokeWidth="6"
          />
          <path d="M131 49V177M70 111H192" stroke="#f7f4e9" strokeWidth="6" />
          <ellipse
            cx="325"
            cy="290"
            rx="180"
            ry="27"
            fill="#d2c6a5"
            opacity=".55"
          />
          <rect
            x="217"
            y="158"
            width="260"
            height="88"
            rx="24"
            fill="#839e87"
          />
          <rect x="200" y="194" width="36" height="69" rx="14" fill="#78917a" />
          <rect x="458" y="194" width="36" height="69" rx="14" fill="#78917a" />
          <path d="M236 225H458" stroke="#6d8770" strokeWidth="3" />
          <rect
            x="251"
            y="172"
            width="53"
            height="43"
            rx="8"
            fill="#c8c9a6"
            transform="rotate(-8 251 172)"
          />
          <rect
            x="396"
            y="172"
            width="48"
            height="43"
            rx="8"
            fill="#d7bd98"
            transform="rotate(8 396 172)"
          />
          <ellipse cx="321" cy="267" rx="69" ry="19" fill="#bba17b" />
          <path d="M278 276V304M364 276V304" stroke="#a88d68" strokeWidth="5" />
          <ellipse cx="321" cy="261" rx="14" ry="5" fill="#e3dcca" />
          <path d="M525 124V260M507 260H543" stroke="#9d947b" strokeWidth="4" />
          <path d="M499 127H551L539 87H511Z" fill="#e0c995" />
        </g>
      )}
      {locus.id === "kitchen" && (
        <g>
          <rect
            x="70"
            y="65"
            width="100"
            height="90"
            rx="3"
            fill="#d7e5dd"
            stroke="#e9e5d6"
            strokeWidth="8"
          />
          <path d="M120 65V155M70 110H170" stroke="#f7f4e9" strokeWidth="5" />
          <rect x="215" y="65" width="270" height="63" rx="4" fill="#c2c9b5" />
          <path d="M305 65V128M395 65V128" stroke="#a5b29b" strokeWidth="2" />
          <g fill="#929c85">
            <circle cx="290" cy="101" r="3" />
            <circle cx="380" cy="101" r="3" />
            <circle cx="470" cy="101" r="3" />
          </g>
          <rect x="76" y="190" width="431" height="64" fill="#b8c4ad" />
          <path d="M76 188H507" stroke="#dad1b8" strokeWidth="12" />
          <path
            d="M180 197V254M290 197V254M400 197V254"
            stroke="#98ac93"
            strokeWidth="2"
          />
          <ellipse cx="155" cy="181" rx="34" ry="9" fill="#9fae9d" />
          <path
            d="M160 177V153Q160 140 174 140"
            fill="none"
            stroke="#8c9f92"
            strokeWidth="4"
          />
          <path
            d="M337 173Q332 149 347 144H376Q390 154 385 177H337Z"
            fill="#cfaf62"
          />
          <path
            d="M383 149Q412 149 401 168H387"
            fill="none"
            stroke="#b9994d"
            strokeWidth="6"
          />
          <path
            d="M350 141Q362 123 374 141"
            fill="none"
            stroke="#a48e58"
            strokeWidth="3"
          />
          <ellipse cx="301" cy="280" rx="116" ry="22" fill="#d5c09b" />
          <path d="M222 291V330M380 291V330" stroke="#baa27c" strokeWidth="7" />
        </g>
      )}
      {locus.id === "library" && (
        <g>
          <rect x="58" y="44" width="250" height="208" fill="#baa58a" />
          <rect x="69" y="55" width="228" height="185" fill="#d1c6ad" />
          {[70, 132, 194].map((y, row) => (
            <g key={y}>
              {[82, 106, 132, 157, 182, 209, 233, 259].map((x, i) => (
                <rect
                  key={x}
                  x={x}
                  y={y + (i % 3) * 3}
                  width={i % 2 ? 16 : 19}
                  height={42 - (i % 3) * 3}
                  rx="1"
                  fill={
                    ["#8eaa9b", "#bd9d76", "#8f9eae", "#c3b583"][(i + row) % 4]
                  }
                />
              ))}
              <path d={`M69 ${y + 46}H297`} stroke="#ae9677" strokeWidth="6" />
            </g>
          ))}
          <path
            d="M393 163V79A49 49 0 0 1 491 79V163Z"
            fill="#d4e1dd"
            stroke="#e8e3d4"
            strokeWidth="7"
          />
          <path d="M442 31V163M393 104H491" stroke="#f5f0e3" strokeWidth="5" />
          <ellipse
            cx="430"
            cy="283"
            rx="95"
            ry="17"
            fill="#d4c5a6"
            opacity=".6"
          />
          <rect x="388" y="185" width="91" height="72" rx="26" fill="#8ea2ad" />
          <path
            d="M381 218V262H487V218"
            fill="none"
            stroke="#7e939f"
            strokeWidth="16"
            strokeLinecap="round"
          />
          <path
            d="M395 267L390 286M472 267L477 286"
            stroke="#a58a67"
            strokeWidth="5"
          />
          <path d="M500 245H549M524 246V285" stroke="#b49974" strokeWidth="6" />
          <path
            d="M505 237L523 229L542 237L523 246Z"
            fill="#f3eddb"
            stroke="#b9a783"
            strokeWidth="1.5"
          />
        </g>
      )}
    </svg>
  );
}
