# Accessibility Guidelines for Claude

These rules apply whenever you are adding or modifying UI in this repository.

---

## Color and contrast

### Never use red/green as a semantic pair

Red-green colorblindness (deuteranopia/protanopia) affects ~8% of males. Do not use green to mean "good" and red to mean "bad" — they look identical to many users.

**Forbidden pattern:**
```tsx
// ❌ red vs green — invisible to colorblind users
if (good) return 'text-green-700';
return 'text-red-600';
```

**Approved status palette — use these instead:**

| Meaning | Text class | Badge (bg + text) |
|---------|-----------|-------------------|
| Good / on-target | `text-teal-700` | `bg-teal-100 text-teal-800` |
| Warning / at-risk | `text-amber-600` | `bg-amber-100 text-amber-800` |
| Bad / over-limit | `text-red-600` | `bg-red-100 text-red-800` |
| Neutral / info | `text-blue-700` | `bg-blue-100 text-blue-800` |

Teal is chosen because it is perceptually distinct from red for all major colorblindness types, while still reading as "positive."

### Capacity screen color scheme (established in issue #143)

| Load % | Meaning | Cell class |
|--------|---------|-----------|
| < 70% | Under-loaded | `bg-amber-50 hover:bg-amber-100` |
| 70–100% | Suitably planned | `bg-blue-50 hover:bg-blue-100` |
| > 100% | Over capacity | `bg-red-50 hover:bg-red-100` |

### Text contrast

- Body text on white backgrounds: use `text-slate-700` or darker.
- Muted/secondary text: `text-slate-500` minimum — do not use `text-slate-300` for anything a user must read.
- Colored text on colored backgrounds (badges): ensure Tailwind's paired classes (e.g. `bg-teal-100 text-teal-800`) are always kept together — do not mix hues.

---

## ARIA patterns

Before writing any interactive UI component — button with state, dialog, combobox, tabs, menu, disclosure, tooltip, switch, alert/status, listbox, radio group — call the `check_pattern` MCP tool to get the full ARIA spec. Do this before writing any markup.

```
check_pattern({ component_type: "dialog" })   // before building a modal
check_pattern({ component_type: "combobox" }) // before building a select with search
```

---

## Decorative vs informative color

Whenever color alone conveys meaning (e.g. a colored cell with no label), pair it with a visible text alternative or a legend. Examples:

- Capacity cells: show "% load" inline so the number conveys the same information as the color.
- Status badges: include a text label inside the badge (e.g. "80%"), never color-only dots.
- If you add a purely decorative color swatch (e.g. a legend dot), add `aria-hidden="true"`.

---

## Focus and keyboard

- All interactive elements must be reachable and operable via keyboard.
- Do not use `outline-none` without a replacement focus style. Use `focus:ring-2 focus:ring-<color>-500` to maintain visible focus indicators.
- Modal dialogs must trap focus inside the dialog while open. Use the `Modal` component from `../components/Modal` — it already handles this.

---

## What to do if uncertain

If you are unsure whether a color pair or ARIA pattern is accessible, call `check_pattern` or ask. Accessibility regressions are harder to catch in CI than functional bugs.
