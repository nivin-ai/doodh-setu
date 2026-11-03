// Doodh Setu mark: a friendly cow face on a milk-white tile.
export const COW_FACE = (
  <>
    <path d="M17 15.5 q-2.6 -4.6 -6.4 -4.4" fill="none" stroke="#F2BE2C" strokeWidth="2.4" strokeLinecap="round" />
    <path d="M31 15.5 q2.6 -4.6 6.4 -4.4" fill="none" stroke="#F2BE2C" strokeWidth="2.4" strokeLinecap="round" />
    <ellipse cx="10.5" cy="20.5" rx="5" ry="2.8" fill="#FFFFFF" stroke="#122030" strokeWidth="1.8" transform="rotate(-18 10.5 20.5)" />
    <ellipse cx="37.5" cy="20.5" rx="5" ry="2.8" fill="#FFFFFF" stroke="#122030" strokeWidth="1.8" transform="rotate(18 37.5 20.5)" />
    <rect x="14" y="13" width="20" height="25" rx="9.5" fill="#FFFFFF" stroke="#122030" strokeWidth="2" />
    <path d="M14.6 21 c2.2 -1.4 4.8 -5.4 3.6 -7.6 c-2.4 0.6 -4 3.2 -3.6 7.6z" fill="#122030" />
    <path d="M27.2 13.3 c1.8 1.2 4.6 2.4 6.2 5.2 c0.2 -3.4 -2.4 -5.6 -6.2 -5.2z" fill="#122030" />
    <circle cx="19.5" cy="22.5" r="1.7" fill="#122030" />
    <circle cx="28.5" cy="22.5" r="1.7" fill="#122030" />
    <rect x="15" y="28" width="18" height="11.5" rx="5.75" fill="#F6C9C4" stroke="#122030" strokeWidth="1.8" />
    <circle cx="20.5" cy="33.6" r="1.3" fill="#122030" />
    <circle cx="27.5" cy="33.6" r="1.3" fill="#122030" />
  </>
);

export default function CowLogo({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-white ${className}`} style={{ width: size, height: size }}>
      <svg viewBox="4 6 40 38" width={size - 4} height={size - 4} aria-hidden>{COW_FACE}</svg>
    </span>
  );
}
