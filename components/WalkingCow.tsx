// A cow that walks back and forth along a strip of grass. Decorative only.
export default function WalkingCow() {
  return (
    <div className="cow-strip relative h-[76px] overflow-hidden" aria-hidden>
      <div className="absolute inset-x-0 bottom-[10px] h-px bg-[#BFD8B0]" />
      <svg className="absolute inset-x-0 bottom-[10px] h-[8px] w-full" preserveAspectRatio="none" viewBox="0 0 400 8">
        <path d="M0 8 Q4 0 8 8 T16 8 T24 8 T32 8 T40 8 T48 8 T56 8 T64 8 T72 8 T80 8 T88 8 T96 8 T104 8 T112 8 T120 8 T128 8 T136 8 T144 8 T152 8 T160 8 T168 8 T176 8 T184 8 T192 8 T200 8 T208 8 T216 8 T224 8 T232 8 T240 8 T248 8 T256 8 T264 8 T272 8 T280 8 T288 8 T296 8 T304 8 T312 8 T320 8 T328 8 T336 8 T344 8 T352 8 T360 8 T368 8 T376 8 T384 8 T392 8 T400 8" fill="none" stroke="#9CC78A" strokeWidth="1" />
      </svg>
      <div className="cow-walk absolute bottom-[10px] left-0 w-[92px]">
        <div className="cow-face">
          <svg viewBox="0 0 120 80" className="w-full">
            {/* tail */}
            <g className="cow-tail" style={{ transformOrigin: '16px 30px' }}>
              <path d="M16 30 C 8 34, 6 44, 8 52" fill="none" stroke="#122030" strokeWidth="2" strokeLinecap="round" />
              <path d="M8 52 l-3 5 l6 -1 z" fill="#122030" />
            </g>
            {/* far legs */}
            <g className="cow-leg-b" style={{ transformOrigin: '30px 50px' }}><rect x="27" y="48" width="6" height="26" rx="2" fill="#D9E3EE" /><rect x="27" y="71" width="6" height="4" rx="1" fill="#55657A" /></g>
            <g className="cow-leg-a" style={{ transformOrigin: '82px 50px' }}><rect x="79" y="48" width="6" height="26" rx="2" fill="#D9E3EE" /><rect x="79" y="71" width="6" height="4" rx="1" fill="#55657A" /></g>
            {/* body */}
            <rect x="16" y="24" width="76" height="32" rx="15" fill="#FFFFFF" stroke="#122030" strokeWidth="2" />
            <path d="M34 25 c6 2 10 8 6 14 c-4 5 -12 3 -14 -3 c-1 -4 2 -9 8 -11z" fill="#122030" />
            <path d="M62 38 c5 -2 11 1 11 6 c0 5 -6 8 -11 6 c-4 -2 -5 -9 0 -12z" fill="#122030" />
            <path d="M80 25 c3 0 7 2 7 5 c-2 3 -7 3 -9 0 z" fill="#122030" />
            {/* udder */}
            <path d="M44 55 q6 7 12 0" fill="#F6C9C4" stroke="#122030" strokeWidth="1.5" />
            {/* near legs */}
            <g className="cow-leg-a" style={{ transformOrigin: '24px 50px' }}><rect x="20" y="48" width="7" height="27" rx="2" fill="#FFFFFF" stroke="#122030" strokeWidth="1.6" /><rect x="20" y="71" width="7" height="4.5" rx="1" fill="#122030" /></g>
            <g className="cow-leg-b" style={{ transformOrigin: '76px 50px' }}><rect x="72" y="48" width="7" height="27" rx="2" fill="#FFFFFF" stroke="#122030" strokeWidth="1.6" /><rect x="72" y="71" width="7" height="4.5" rx="1" fill="#122030" /></g>
            {/* head */}
            <g className="cow-head" style={{ transformOrigin: '92px 30px' }}>
              <path d="M95 14 q-3 -6 -8 -6" fill="none" stroke="#F2BE2C" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M107 14 q3 -6 8 -6" fill="none" stroke="#F2BE2C" strokeWidth="2.5" strokeLinecap="round" />
              <ellipse cx="91" cy="18" rx="6" ry="3" fill="#FFFFFF" stroke="#122030" strokeWidth="1.6" transform="rotate(-20 91 18)" />
              <rect x="92" y="12" width="20" height="24" rx="9" fill="#FFFFFF" stroke="#122030" strokeWidth="2" />
              <rect x="93" y="28" width="18" height="12" rx="6" fill="#F6C9C4" stroke="#122030" strokeWidth="1.8" />
              <circle cx="98" cy="34" r="1.3" fill="#122030" /><circle cx="106" cy="34" r="1.3" fill="#122030" />
              <circle cx="97" cy="21" r="1.8" fill="#122030" /><circle cx="107" cy="21" r="1.8" fill="#122030" />
              <path d="M99 12 q3 -3 6 0" fill="#122030" />
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}
