# nile design language — editorial calm

The rebuild's own interface, not Amazon's. Same product, same database, same features; our layout, type and colour.

## The idea

A shop that reads like a well-set catalogue. Big pictures, quiet furniture, one confident accent, and numbers you can trust at a glance. Where Amazon shouts for attention with orange, red badges and stacked chrome, we get out of the way and let the product and the price do the work.

Three rules decide most arguments:

1. **Type carries the hierarchy, not boxes.** A serif display for headings, a plain sans for everything else. Reach for size and weight before borders, fills or shadows.
2. **One accent.** Deep green marks what you can act on (primary buttons, links, selected state). Terracotta marks money leaving or falling (deals, refunds, errors). Nothing else is coloured.
3. **Hairlines and whitespace, not cards everywhere.** A `1px` warm rule separates sections. Surfaces are white on warm paper; shadows only for things that truly float (dialogs, the compare tray).

## Tokens (`app/globals.css`)

| Token | Value | Use |
|---|---|---|
| `--color-paper` | `#faf8f4` | page background |
| `--color-surface` | `#ffffff` | cards, sheets, the header |
| `--color-page` | `#f2eee6` | quiet section bands |
| `--color-ink` | `#191713` | text |
| `--color-muted` | `#6e6a61` | secondary text |
| `--color-line` | `#e4ded3` | hairlines and borders |
| `--color-accent` | `#1f5139` | primary action, links, selection |
| `--color-accent-soft` | `#e9f0ea` | selected rows, quiet accent fills |
| `--color-deal` | `#a8442a` | deals, refunds, destructive |
| `--color-star` | `#b4832a` | rating stars |

Legacy names (`--color-nav*`, `--color-cart`, `--color-buy`, `--color-search`) still exist so nothing breaks mid-redesign, but they now point at the new palette. Don't reach for them in new work.

## Type

- **Display:** Fraunces (variable serif), 600. Page titles, section headings, prices over 20px.
- **Text:** Inter. Body is 15px/22px — larger than the old 14/20, because this layout has room.
- **Numbers:** always `tabular-nums` (`.price`), so columns of money line up and a changing total doesn't jitter.
- Sentence case everywhere. No ALL CAPS, no exclamation marks.

## Components

- **Buttons** are 6px-radius rectangles, 40px tall (48px on phones), never pills. Primary is solid accent on white text; secondary is an ink outline; plain is white with a hairline.
- **Inputs** are 40px tall, 6px radius, hairline border, accent focus ring. Labels sit above in 13px semibold.
- **Cards** are white on paper with a hairline and 10px radius. No drop shadow unless the thing floats.
- **Sections** are separated by a hairline and generous vertical space (48px desktop, 32px phone), not by grey blocks.
- **Container** is 1120px max with 24px gutters (16px on phones).

## Layout

- One header row: brand, a wide search field, then delivery country, account and bag. Browsing lives behind a single "Browse" control that opens a full-width panel, rather than a permanent department strip.
- Product pages are two columns on desktop: gallery left, everything you decide with on the right, in one column that you read top to bottom. No sticky buy box competing with the page.
- The footer is one ink band with four short link columns and the demo-store disclaimer.

## What we keep from the old build

Behaviour, not looks: the delivery promise wording, the demo controls, every accessible name that tests and screen readers rely on, and all ten features. If a rename genuinely improves the interface, change the test in the same commit.
