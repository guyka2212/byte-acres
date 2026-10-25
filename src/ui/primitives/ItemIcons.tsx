// A small drawn icon for every material, in the item colours from the design
// tokens. 16×16 grid, chunky shapes so they read at HUD size.

import type { ReactElement } from 'react'

const c = (item: string) => `var(--tk-color-item-${item})`
const DARK = 'rgb(0 0 0 / 0.28)'
const LIGHT = 'rgb(255 255 255 / 0.45)'

export const ITEM_SVG: Record<string, ReactElement> = {
  hay: (
    <>
      {/* a tied bundle of stalks */}
      <path d="M4 14 L6.5 2.5 L8 14 Z M8 14 L9.5 2 L12 14 Z M6 14 L8 1.5 L10 14 Z" fill={c('hay')} />
      <rect x="4.5" y="8.2" width="7" height="1.8" rx="0.6" fill={DARK} />
      <path d="M8 2.5 L8.4 7" stroke={LIGHT} strokeWidth="0.8" strokeLinecap="round" />
    </>
  ),
  wood: (
    <>
      {/* a log, end on */}
      <rect x="1.5" y="5" width="11" height="7" rx="1.5" fill={c('wood')} />
      <ellipse cx="12.5" cy="8.5" rx="2.5" ry="3.5" fill={c('wood')} stroke={DARK} strokeWidth="0.8" />
      <ellipse cx="12.5" cy="8.5" rx="1.2" ry="1.8" fill="none" stroke={DARK} strokeWidth="0.7" />
      <path d="M3 7 H9 M4 10 H10" stroke={DARK} strokeWidth="0.8" strokeLinecap="round" />
    </>
  ),
  carrot: (
    <>
      <path d="M9.5 5.5 L12.5 2 M10 6 L14 4.5 M9 5 L9.5 1.5" stroke="var(--tk-color-success)" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M2.5 13.5 C3 10 6 6 9 5.5 C10.5 5.5 10.8 7.2 10 8.5 C8 11 5 13 2.5 13.5 Z" fill={c('carrot')} />
      <path d="M5 11 L6.3 11.6 M6.8 8.6 L8 9.3" stroke={DARK} strokeWidth="0.8" strokeLinecap="round" />
    </>
  ),
  water: (
    <>
      <path d="M8 1.5 C10 5 12.5 7.5 12.5 10 A4.5 4.5 0 0 1 3.5 10 C3.5 7.5 6 5 8 1.5 Z" fill={c('water')} />
      <path d="M6 9.5 A2 2 0 0 0 7.5 12" stroke={LIGHT} strokeWidth="1.2" fill="none" strokeLinecap="round" />
    </>
  ),
  pumpkin: (
    <>
      <path d="M8 4 L8.6 1.8" stroke="var(--tk-color-success)" strokeWidth="1.5" strokeLinecap="round" />
      <ellipse cx="8" cy="9.5" rx="6.5" ry="5" fill={c('pumpkin')} />
      <path d="M8 4.6 V14.4 M5 5.2 C3.5 8 3.5 11 5 13.8 M11 5.2 C12.5 8 12.5 11 11 13.8" stroke={DARK} strokeWidth="0.8" fill="none" />
    </>
  ),
  power: (
    <>
      {/* a sunflower's spark */}
      <path d="M9.5 1 L3.5 9 H7.5 L6 15 L12.5 6.5 H8.5 Z" fill={c('power')} stroke={DARK} strokeWidth="0.6" strokeLinejoin="round" />
    </>
  ),
  cactus: (
    <>
      <rect x="6" y="2" width="4" height="12.5" rx="2" fill={c('cactus')} />
      <path d="M6 9 H4 A1.5 1.5 0 0 1 2.5 7.5 V5.5" stroke={c('cactus')} strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <path d="M10 7 H12 A1.5 1.5 0 0 0 13.5 5.5 V4" stroke={c('cactus')} strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <path d="M8 4 V13" stroke={DARK} strokeWidth="0.7" strokeLinecap="round" />
    </>
  ),
  gold: (
    <>
      {/* a coin */}
      <circle cx="8" cy="8" r="6.5" fill={c('gold')} />
      <circle cx="8" cy="8" r="4.6" fill="none" stroke={DARK} strokeWidth="0.8" />
      <path d="M6 6.5 L8 4.8 L10 6.5 L8 11.5 Z" fill={LIGHT} />
    </>
  ),
  goo: (
    <>
      <path d="M2.5 12 C2.5 7 5 3 8 3 C11 3 13.5 7 13.5 12 C13.5 14 11 14.5 8 14.5 C5 14.5 2.5 14 2.5 12 Z" fill={c('goo')} />
      <circle cx="6" cy="8.5" r="1" fill={DARK} />
      <circle cx="10" cy="8.5" r="1" fill={DARK} />
      <path d="M5.5 5.5 A3 3 0 0 1 7.5 4.3" stroke={LIGHT} strokeWidth="1" fill="none" strokeLinecap="round" />
    </>
  ),
  bone: (
    <>
      <path d="M4 12 L12 4" stroke={c('bone')} strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="3.2" cy="11" r="1.6" fill={c('bone')} /><circle cx="5" cy="12.8" r="1.6" fill={c('bone')} />
      <circle cx="11" cy="3.2" r="1.6" fill={c('bone')} /><circle cx="12.8" cy="5" r="1.6" fill={c('bone')} />
    </>
  ),
}
