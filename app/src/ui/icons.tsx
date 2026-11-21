type P = { className?: string };
const S = (d: string) => (p: P) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
       strokeLinecap="round" strokeLinejoin="round" className={p.className}
       dangerouslySetInnerHTML={{ __html: d }} />
);
export const IcDash    = S('<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>');
export const IcCal     = S('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>');
export const IcCash    = S('<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>');
export const IcTicket  = S('<path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z"/><path d="M12 7v10"/>');
export const IcUsers   = S('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/>');
export const IcScissor = S('<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.12 15.88M14.47 14.48 20 20M8.12 8.12 12 12"/>');
export const IcMoney   = S('<path d="M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>');
export const IcDebt    = S('<path d="M3 6h18v12H3z"/><path d="M3 10h18M7 15h4"/>');
export const IcPack    = S('<path d="M12 2 3 7v10l9 5 9-5V7z"/><path d="m3 7 9 5 9-5M12 12v10"/>');
export const IcBox     = S('<path d="M21 8v8a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.73l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>');
export const IcTruck   = S('<rect x="1" y="6" width="13" height="11" rx="1"/><path d="M14 9h4l3 3v5h-7z"/><circle cx="5.5" cy="18.5" r="1.8"/><circle cx="17.5" cy="18.5" r="1.8"/>');
export const IcChart   = S('<path d="M3 3v18h18"/><path d="m7 14 3-4 3 3 5-7"/>');
export const IcGear    = S('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>');
export const IcOut     = S('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>');
export const IcPlus    = S('<path d="M12 5v14M5 12h14"/>');
export const IcX       = S('<path d="M18 6 6 18M6 6l12 12"/>');
export const IcMenu    = S('<path d="M3 6h18M3 12h18M3 18h18"/>');
export const IcLeft    = S('<path d="M15 18 9 12l6-6"/>');
export const IcRight   = S('<path d="m9 18 6-6-6-6"/>');
export const IcCheck   = S('<path d="M20 6 9 17l-5-5"/>');
export const IcAlert   = S('<path d="M12 9v4m0 4h.01M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>');
export const IcInfo    = S('<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>');
export const IcClock   = S('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>');
export const IcSearch  = S('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>');
export const IcTrash   = S('<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>');
export const IcEdit    = S('<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/>');
export const IcUser    = S('<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>');
export const IcDiamond = S('<path d="M12 3 3 9l9 12 9-12z"/><path d="M3 9h18M8 9l4 12M16 9l-4 12M8 9l4-6M16 9l-4-6"/>');
