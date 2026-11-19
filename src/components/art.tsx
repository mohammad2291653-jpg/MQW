export function LearningArt({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 440 320"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="artBg" x1="50" y1="0" x2="400" y2="350">
          <stop stopColor="#d5e7f6" />
          <stop offset="1" stopColor="#c1d5e4" />
        </linearGradient>
        <linearGradient id="bookSapphire" x1="100" y1="100" x2="200" y2="300">
          <stop stopColor="#68aad9" />
          <stop offset="1" stopColor="#2d7bb2" />
        </linearGradient>
      </defs>
      <ellipse
        cx="230"
        cy="274"
        rx="161"
        ry="18"
        fill="#155794"
        opacity=".08"
      />
      <circle cx="247" cy="151" r="110" fill="url(#artBg)" />
      <ellipse
        cx="247"
        cy="151"
        rx="150"
        ry="61"
        transform="rotate(-25 247 151)"
        stroke="#8fb4cf"
        strokeWidth="1.2"
        strokeDasharray="4 7"
      />
      <ellipse
        cx="247"
        cy="151"
        rx="135"
        ry="82"
        transform="rotate(31 247 151)"
        stroke="#b5bac0"
        strokeWidth="1.2"
      />
      <path d="M117 226 228 167 325 213 215 274Z" fill="#bec2c7" />
      <path d="m117 226 98 48v-16l-98-48Z" fill="#737b86" />
      <path d="m215 274 110-61v-16l-110 61Z" fill="#dfebf4" />
      <path d="m111 199 111-59 97 46-110 61Z" fill="url(#bookSapphire)" />
      <path d="m111 199 98 48v-19l-98-48Z" fill="#2d7bb2" />
      <path d="m209 247 110-61v-19l-110 61Z" fill="#ebedf0" />
      <path d="m135 168 106-57 75 36-106 59Z" fill="#a7cee8" />
      <path d="m135 168 75 38v-14l-75-38Z" fill="#8e9eb3" />
      <path d="m210 206 106-59v-14l-106 59Z" fill="#e5f3fd" />
      <path d="m201 116 38-20 45 22-38 21Z" fill="#f6f8fa" />
      <path d="m239 96 1-28 46 23-2 27Z" fill="#fbfdff" />
      <path d="m240 68-39 21v27l38-20Z" fill="#d8ecfc" />
      <path d="m240 68 1 30 44 21" stroke="#a7b2c1" strokeWidth="2" />
      <path d="m255 161 7-27 11-5-5 28Z" fill="#7a8390" />
      <circle cx="340" cy="89" r="24" fill="#d6ebfc" />
      <path
        d="M331 89h18m-9-9v18"
        stroke="#8291a4"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="121" cy="108" r="15" fill="#c3daee" />
      <path
        d="m115 108 4 4 8-8"
        stroke="#2e7fb8"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="352" cy="201" r="6" fill="#689abe" />
      <circle cx="165" cy="52" r="5" fill="#7db6df" />
      <path d="M163 242c-15-19-27-20-29-38 13 0 25 15 29 38Z" fill="#2d7ac1" />
      <path d="M162 241c-2-24 10-37 19-41 8 12 0 32-19 41Z" fill="#83acca" />
      <path d="m156 240 16 1-3 21h-10Z" fill="#ccd3dc" />
      <path d="m97 163 4-7 4 7 8 2-8 3-4 7-4-7-8-3Z" fill="#4898d1" />
      <path
        d="M312 49v12m-6-6h12"
        stroke="#a3a9b1"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
export function PalaceArt() {
  return (
    <svg viewBox="0 0 260 180" fill="none" aria-hidden="true">
      <ellipse cx="131" cy="159" rx="91" ry="11" fill="#868e98" opacity=".1" />
      <path d="m56 85 75-44 75 44v57l-75 28-75-28Z" fill="#dadde2" />
      <path d="m131 113 75-28v57l-75 28Z" fill="#c6cacf" />
      <path d="m56 85 75-44 75 44-75 43Z" fill="#d8dee7" />
      <path
        d="m131 41 0 87M56 85l75 43 75-43"
        stroke="#a2a9b3"
        strokeWidth="2"
      />
      <path d="m85 69 49 27 41-23M106 57v56" stroke="#b0bac7" strokeWidth="2" />
      <path d="m148 113 24-13v26l-24 13Z" fill="#808893" />
      <path d="m76 106 16 9v17l-16-7Z" fill="#8db3ce" />
      <circle cx="83" cy="58" r="11" fill="#69aad9" />
      <path d="m79 58 3 3 5-6" stroke="white" strokeWidth="2" />
      <circle cx="185" cy="59" r="7" fill="#9fceee" />
      <path d="M47 132c-5-15-1-28 7-31 8 11 3 24-7 31Z" fill="#76a4c4" />
      <path d="M46 132c-12-9-13-19-10-26 11 4 14 16 10 26Z" fill="#2d7ac1" />
    </svg>
  );
}
