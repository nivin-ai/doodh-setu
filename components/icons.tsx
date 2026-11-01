// Small outline icon set (stroke = currentColor). Decorative unless given a label.
type P = { size?: number; className?: string };
const base = (size: number) => ({ width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true });

export const IconHome = ({ size = 22, className }: P) => (<svg {...base(size)} className={className}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h5v-6h4v6h5V9.5" /></svg>);
export const IconRupee = ({ size = 22, className }: P) => (<svg {...base(size)} className={className}><path d="M6 4h12M6 9h12M14 4c3 0 3 10-6 10l8 6" /></svg>);
export const IconNotice = ({ size = 22, className }: P) => (<svg {...base(size)} className={className}><path d="M4 10v4l3 .5 9 4.5V5L7 9.5 4 10Z" /><path d="M7 14.5 8.5 20H11l-1-5" /><path d="M19 9.5c1 .8 1 4.2 0 5" /></svg>);
export const IconBank = ({ size = 22, className }: P) => (<svg {...base(size)} className={className}><path d="M3 9.5 12 4l9 5.5" /><path d="M5 10v7M9.5 10v7M14.5 10v7M19 10v7M3.5 20h17" /></svg>);
export const IconMic = ({ size = 22, className }: P) => (<svg {...base(size)} className={className}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" /></svg>);
export const IconUser = ({ size = 20, className }: P) => (<svg {...base(size)} className={className}><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>);
export const IconBack = ({ size = 22, className }: P) => (<svg {...base(size)} className={className}><path d="M15 5 8 12l7 7" /></svg>);
export const IconChevron = ({ size = 18, className }: P) => (<svg {...base(size)} className={className}><path d="m9 5 7 7-7 7" /></svg>);
export const IconPhone = ({ size = 18, className }: P) => (<svg {...base(size)} className={className}><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" /></svg>);
export const IconCheck = ({ size = 22, className, animate }: P & { animate?: boolean }) => (
  <svg {...base(size)} className={className} strokeWidth={2.4}>
    <path d="m5 12.5 4.5 4.5L19 7.5" style={animate ? { strokeDasharray: 24, strokeDashoffset: 24, animation: 'draw 420ms ease-out 80ms forwards' } : undefined} />
  </svg>
);
export const IconDrop = ({ size = 22, className }: P) => (<svg {...base(size)} className={className}><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z" /></svg>);
export const IconSend = ({ size = 18, className }: P) => (<svg {...base(size)} className={className}><path d="M4 12 20 4l-6 16-3-7-7-1Z" /></svg>);
