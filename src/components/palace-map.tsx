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
              stroke="#b2bbc6"
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
              stroke="#c1c6cb"
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
              floodColor="#666e78"
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
          fill="#dceaf4"
          opacity=".7"
        />
        <g filter="url(#house-shadow)">
          <rect
            x="50"
            y="30"
            width="600"
            height="400"
            rx="3"
            fill="#f5f6f9"
            stroke="#a0a6ae"
            strokeWidth="6"
          />
          <path d="M50 30H300V215H50Z" fill="#e3eef7" />
          <path d="M400 30H650V215H400Z" fill="#e5e9ef" />
          <path d="M400 215H650V430H400Z" fill="#daeaf6" />
          <path d="M50 215H300V430H50Z" fill="#e4f0fa" />
          <rect x="300" y="30" width="100" height="400" fill="#e9edf1" />
          <path
            d="M50 30H300V215H50Z M400 215H650V430H400Z M300 30H400V430H300Z"
            fill="url(#palace-wood)"
          />
          <path d="M400 30H650V215H400Z" fill="url(#palace-tile)" />
          <g stroke="#9198a1" strokeWidth="5" fill="none">
            <path d="M300 30V90M300 157V430M400 30V90M400 157V270M400 340V430M50 215H300M400 215H480M555 215H650" />
          </g>
          <g stroke="#b1b6bd" strokeWidth="1.5" fill="none">
            <path d="M300 90A67 67 0 0 0 233 157H300M400 90A67 67 0 0 1 467 157H400M400 270A70 70 0 0 1 470 340H400M480 215A75 75 0 0 1 555 140V215" />
          </g>
          <g stroke="#a0a6ae" strokeWidth="7">
            <path d="M90 30H230M475 30H590M650 278V370M50 90V155" />
          </g>
          <g fill="#9ebfd6">
            <circle cx="100" cy="265" r="22" />
            <circle cx="250" cy="375" r="28" />
            <circle cx="90" cy="375" r="31" />
          </g>
          <g fill="#74a2c3" opacity=".75">
            <circle cx="93" cy="256" r="15" />
            <circle cx="241" cy="365" r="20" />
            <circle cx="80" cy="365" r="23" />
          </g>
          <path
            d="M173 248C132 300 238 323 181 401"
            stroke="#d2d5da"
            strokeWidth="18"
            fill="none"
          />
          <g fill="#a1a7af" fontSize="12" fontFamily="sans-serif">
            <text x="176" y="327" textAnchor="middle">
              فناء داخلي
            </text>
          </g>
          <g fill="#c4c8cd">
            <rect x="63" y="43" width="220" height="18" rx="2" />
            <rect x="63" y="64" width="18" height="121" rx="2" />
          </g>
          <g fill="#bcc6d3">
            <rect x="418" y="46" width="210" height="24" rx="2" />
            <rect x="603" y="70" width="25" height="112" rx="2" />
          </g>
          <g fill="#abc7db">
            <rect x="443" y="379" width="153" height="31" rx="8" />
            <rect x="443" y="355" width="31" height="55" rx="7" />
            <rect x="565" y="355" width="31" height="55" rx="7" />
          </g>
          <ellipse cx="524" cy="354" rx="41" ry="14" fill="#b8c2ce" />
          <path d="M321 430H379" stroke="#8b9baf" strokeWidth="9" />
          <path
            d="M337 447H363"
            stroke="#8b9baf"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </g>
        <path
          d="M350 398V270H525V122H175"
          stroke="#8d949e"
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
          <stop stopColor="#f3f5f8" />
          <stop offset="1" stopColor="#e2e5ea" />
        </linearGradient>
        <linearGradient id={`scene-floor-${locus.id}`} x1="0" x2="1">
          <stop stopColor="#d9dee6" />
          <stop offset="1" stopColor="#e5e9ee" />
        </linearGradient>
      </defs>
      <rect width="600" height="330" fill={`url(#scene-wall-${locus.id})`} />
      <rect
        y="248"
        width="600"
        height="82"
        fill={`url(#scene-floor-${locus.id})`}
      />
      <path d="M0 248H600" stroke="#c5cad0" strokeWidth="3" />
      <path
        d="M0 290H600M100 248L60 330M250 248L230 330M400 248L420 330M550 248L590 330"
        stroke="#c6cdd5"
        strokeWidth="1"
      />
      {locus.id === "entrance" && (
        <g>
          <path
            d="M222 248V100A78 78 0 0 1 378 100V248Z"
            fill="#a4b1c2"
            stroke="#818ea1"
            strokeWidth="8"
          />
          <path d="M237 248V106A63 63 0 0 1 363 106V248Z" fill="#bbc7d6" />
          <path
            d="M300 49V247M250 106H350M250 165H350"
            stroke="#8f9eb1"
            strokeWidth="3"
          />
          <circle cx="346" cy="172" r="5" fill="#6f7d8f" />
          <ellipse
            cx="300"
            cy="275"
            rx="96"
            ry="18"
            fill="#acb5c1"
            opacity=".6"
          />
          <path d="M100 247H162L153 290H110Z" fill="#94a4b9" />
          <path d="M131 247V151" stroke="#4b86af" strokeWidth="4" />
          <g fill="#70a0c2">
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
          <rect x="430" y="181" width="91" height="12" rx="3" fill="#929fb0" />
          <path d="M442 194V252M510 194V252" stroke="#929fb0" strokeWidth="5" />
          <ellipse cx="475" cy="173" rx="16" ry="7" fill="#d3dbe4" />
          <path d="M475 168V147" stroke="#6c9dc0" strokeWidth="3" />
          <circle cx="475" cy="140" r="12" fill="#a6c4d9" />
        </g>
      )}
      {locus.id === "hallway" && (
        <g>
          <path
            d="M120 0L232 71V247L120 330M480 0L368 71V247L480 330"
            fill="#dadee3"
            opacity=".5"
          />
          <path d="M232 71H368V247H232Z" fill="#eef1f4" />
          <path
            d="M255 247V126A45 45 0 0 1 345 126V247"
            fill="#d1e1ed"
            stroke="#b9bdc3"
            strokeWidth="4"
          />
          <rect
            x="130"
            y="56"
            width="50"
            height="148"
            rx="24"
            fill="#c4d8e6"
            stroke="#a0acba"
            strokeWidth="7"
          />
          <path
            d="M141 77L170 169"
            stroke="#ecf5fc"
            strokeWidth="7"
            opacity=".6"
          />
          <rect
            x="414"
            y="90"
            width="40"
            height="59"
            fill="#f4f6f8"
            stroke="#a7afb9"
            strokeWidth="4"
          />
          <path
            d="M421 132L432 113L448 130"
            stroke="#7da8c7"
            strokeWidth="3"
            fill="none"
          />
          <path d="M282 246H318L356 330H245Z" fill="#a9b3c0" opacity=".75" />
          <ellipse cx="300" cy="53" rx="23" ry="7" fill="#a3afbd" />
          <path d="M300 0V46" stroke="#a5adb7" strokeWidth="2" />
          <circle cx="300" cy="58" r="5" fill="#ebf5fd" />
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
            fill="#cfe3f2"
            stroke="#c2c6cb"
            strokeWidth="6"
          />
          <path d="M131 49V177M70 111H192" stroke="#f2f4f7" strokeWidth="6" />
          <ellipse
            cx="325"
            cy="290"
            rx="180"
            ry="27"
            fill="#bfc7d3"
            opacity=".55"
          />
          <rect
            x="217"
            y="158"
            width="260"
            height="88"
            rx="24"
            fill="#6c9dc0"
          />
          <rect x="200" y="194" width="36" height="69" rx="14" fill="#838b96" />
          <rect x="458" y="194" width="36" height="69" rx="14" fill="#838b96" />
          <path d="M236 225H458" stroke="#79818d" strokeWidth="3" />
          <rect
            x="251"
            y="172"
            width="53"
            height="43"
            rx="8"
            fill="#c1c7d0"
            transform="rotate(-8 251 172)"
          />
          <rect
            x="396"
            y="172"
            width="48"
            height="43"
            rx="8"
            fill="#b6c2d2"
            transform="rotate(8 396 172)"
          />
          <ellipse cx="321" cy="267" rx="69" ry="19" fill="#99a6b7" />
          <path d="M278 276V304M364 276V304" stroke="#8592a4" strokeWidth="5" />
          <ellipse cx="321" cy="261" rx="14" ry="5" fill="#d8dde3" />
          <path d="M525 124V260M507 260H543" stroke="#8e959f" strokeWidth="4" />
          <path d="M499 127H551L539 87H511Z" fill="#add0e7" />
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
            fill="#d1e4f3"
            stroke="#e2e5ea"
            strokeWidth="8"
          />
          <path d="M120 65V155M70 110H170" stroke="#f2f4f7" strokeWidth="5" />
          <rect x="215" y="65" width="270" height="63" rx="4" fill="#afcadd" />
          <path d="M305 65V128M395 65V128" stroke="#8db3ce" strokeWidth="2" />
          <g fill="#9299a2">
            <circle cx="290" cy="101" r="3" />
            <circle cx="380" cy="101" r="3" />
            <circle cx="470" cy="101" r="3" />
          </g>
          <rect x="76" y="190" width="431" height="64" fill="#a7c4d9" />
          <path d="M76 188H507" stroke="#cbd2db" strokeWidth="12" />
          <path
            d="M180 197V254M290 197V254M400 197V254"
            stroke="#82acc9"
            strokeWidth="2"
          />
          <ellipse cx="155" cy="181" rx="34" ry="9" fill="#a5aab2" />
          <path
            d="M160 177V153Q160 140 174 140"
            fill="none"
            stroke="#949ba4"
            strokeWidth="4"
          />
          <path
            d="M337 173Q332 149 347 144H376Q390 154 385 177H337Z"
            fill="#87b9da"
          />
          <path
            d="M383 149Q412 149 401 168H387"
            fill="none"
            stroke="#8b9fb8"
            strokeWidth="6"
          />
          <path
            d="M350 141Q362 123 374 141"
            fill="none"
            stroke="#8292a6"
            strokeWidth="3"
          />
          <ellipse cx="301" cy="280" rx="116" ry="22" fill="#b8c4d2" />
          <path d="M222 291V330M380 291V330" stroke="#9aa7b7" strokeWidth="7" />
        </g>
      )}
      {locus.id === "library" && (
        <g>
          <rect x="58" y="44" width="250" height="208" fill="#9fa9b7" />
          <rect x="69" y="55" width="228" height="185" fill="#c0c8d1" />
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
                    ["#7ea9c8", "#95a4b7", "#73a2c3", "#abb6c6"][(i + row) % 4]
                  }
                />
              ))}
              <path d={`M69 ${y + 46}H297`} stroke="#8f9baa" strokeWidth="6" />
            </g>
          ))}
          <path
            d="M393 163V79A49 49 0 0 1 491 79V163Z"
            fill="#cee1ef"
            stroke="#e0e3e9"
            strokeWidth="7"
          />
          <path d="M442 31V163M393 104H491" stroke="#eef1f4" strokeWidth="5" />
          <ellipse
            cx="430"
            cy="283"
            rx="95"
            ry="17"
            fill="#bec7d3"
            opacity=".6"
          />
          <rect x="388" y="185" width="91" height="72" rx="26" fill="#77a4c5" />
          <path
            d="M381 218V262H487V218"
            fill="none"
            stroke="#6196bb"
            strokeWidth="16"
            strokeLinecap="round"
          />
          <path
            d="M395 267L390 286M472 267L477 286"
            stroke="#8290a1"
            strokeWidth="5"
          />
          <path d="M500 245H549M524 246V285" stroke="#919eb0" strokeWidth="6" />
          <path
            d="M505 237L523 229L542 237L523 246Z"
            fill="#eaedf2"
            stroke="#9faab8"
            strokeWidth="1.5"
          />
        </g>
      )}
    </svg>
  );
}
