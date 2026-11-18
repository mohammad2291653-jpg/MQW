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
          <stop stopColor="#DDE8D9" />
          <stop offset="1" stopColor="#C3D7CE" />
        </linearGradient>
        <linearGradient id="bookPurple" x1="100" y1="100" x2="200" y2="300">
          <stop stopColor="#A69EC7" />
          <stop offset="1" stopColor="#777194" />
        </linearGradient>
      </defs>
      <ellipse
        cx="230"
        cy="274"
        rx="161"
        ry="18"
        fill="#355C56"
        opacity=".08"
      />
      <circle cx="247" cy="151" r="110" fill="url(#artBg)" />
      <ellipse
        cx="247"
        cy="151"
        rx="150"
        ry="61"
        transform="rotate(-25 247 151)"
        stroke="#9DB5A9"
        strokeWidth="1.2"
        strokeDasharray="4 7"
      />
      <ellipse
        cx="247"
        cy="151"
        rx="135"
        ry="82"
        transform="rotate(31 247 151)"
        stroke="#AFBDB3"
        strokeWidth="1.2"
      />
      <path d="M117 226 228 167 325 213 215 274Z" fill="#B8C4C3" />
      <path d="m117 226 98 48v-16l-98-48Z" fill="#687F7B" />
      <path d="m215 274 110-61v-16l-110 61Z" fill="#E7EAE2" />
      <path d="m111 199 111-59 97 46-110 61Z" fill="url(#bookPurple)" />
      <path d="m111 199 98 48v-19l-98-48Z" fill="#777194" />
      <path d="m209 247 110-61v-19l-110 61Z" fill="#F1ECE6" />
      <path d="m135 168 106-57 75 36-106 59Z" fill="#E1C58E" />
      <path d="m135 168 75 38v-14l-75-38Z" fill="#B79866" />
      <path d="m210 206 106-59v-14l-106 59Z" fill="#FAF0D9" />
      <path d="m201 116 38-20 45 22-38 21Z" fill="#FAF8ED" />
      <path d="m239 96 1-28 46 23-2 27Z" fill="#FFFDF5" />
      <path d="m240 68-39 21v27l38-20Z" fill="#F4E8D2" />
      <path d="m240 68 1 30 44 21" stroke="#C2AF8C" strokeWidth="2" />
      <path d="m255 161 7-27 11-5-5 28Z" fill="#8E8166" />
      <circle cx="340" cy="89" r="24" fill="#F5E7C9" />
      <path
        d="M331 89h18m-9-9v18"
        stroke="#A58C5D"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="121" cy="108" r="15" fill="#D9D4E8" />
      <path
        d="m115 108 4 4 8-8"
        stroke="#7E739D"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="352" cy="201" r="6" fill="#7B9C8A" />
      <circle cx="165" cy="52" r="5" fill="#B8A9CF" />
      <path d="M163 242c-15-19-27-20-29-38 13 0 25 15 29 38Z" fill="#567F6B" />
      <path d="M162 241c-2-24 10-37 19-41 8 12 0 32-19 41Z" fill="#8FAF97" />
      <path d="m156 240 16 1-3 21h-10Z" fill="#DDD1B8" />
      <path d="m97 163 4-7 4 7 8 2-8 3-4 7-4-7-8-3Z" fill="#9A8AB7" />
      <path
        d="M312 49v12m-6-6h12"
        stroke="#9DAD9D"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
export function PalaceArt() {
  return (
    <svg viewBox="0 0 260 180" fill="none" aria-hidden="true">
      <ellipse cx="131" cy="159" rx="91" ry="11" fill="#8E8B9D" opacity=".1" />
      <path d="m56 85 75-44 75 44v57l-75 28-75-28Z" fill="#E1DDD0" />
      <path d="m131 113 75-28v57l-75 28Z" fill="#CEC9BF" />
      <path d="m56 85 75-44 75 44-75 43Z" fill="#E9DDBB" />
      <path
        d="m131 41 0 87M56 85l75 43 75-43"
        stroke="#B4A791"
        strokeWidth="2"
      />
      <path d="m85 69 49 27 41-23M106 57v56" stroke="#C6B895" strokeWidth="2" />
      <path d="m148 113 24-13v26l-24 13Z" fill="#7C8995" />
      <path d="m76 106 16 9v17l-16-7Z" fill="#A5B29C" />
      <circle cx="83" cy="58" r="11" fill="#A99FBD" />
      <path d="m79 58 3 3 5-6" stroke="white" strokeWidth="2" />
      <circle cx="185" cy="59" r="7" fill="#E7C478" />
      <path d="M47 132c-5-15-1-28 7-31 8 11 3 24-7 31Z" fill="#8DA58B" />
      <path d="M46 132c-12-9-13-19-10-26 11 4 14 16 10 26Z" fill="#617D6A" />
    </svg>
  );
}
