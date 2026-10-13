import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./ui";

/**
 * Themed deadline picker (Claude spec 2026-10-13).
 * Replaces the native <input type="date">: unambiguous "Fri 16 Oct 2026"
 * format, quick-pick chips, keyboard grid, bottom sheet on phones.
 */

const MAX_DAYS = 365;
const PRESETS: [number, string][] = [
  [3, "3 days"],
  [7, "1 week"],
  [14, "2 weeks"],
  [30, "30 days"],
];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const WD = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const sod = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addD = (d: Date, n: number) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const sameDay = (a: Date | null, b: Date | null) =>
  !!a &&
  !!b &&
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export const formatDateLabel = (d: Date) =>
  d
    .toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    })
    .replace(",", "");

const fullLabel = (d: Date) =>
  d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

const monthIndex = (s: string) =>
  MONTHS.findIndex((x) => x.toLowerCase().startsWith(s.toLowerCase().slice(0, 3)));

type ParseResult = { date: Date } | { err: string };

function parseDate(t: string, min: Date, max: Date): ParseResult {
  t = t.trim().replace(/^(mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?,?\s+/i, "");
  if (!t) return { err: "Choose a deadline." };
  let m: RegExpMatchArray | null;
  let d: number, mo: number, y: number;
  if ((m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/))) {
    y = +m[1];
    mo = +m[2] - 1;
    d = +m[3];
  } else if (
    (m = t.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})$/))
  ) {
    d = +m[1];
    mo = monthIndex(m[2]);
    y = +m[3];
  } else if ((m = t.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})$/))) {
    mo = monthIndex(m[1]);
    d = +m[2];
    y = +m[3];
  } else {
    return { err: "Type the date with a month name, like 16 Oct 2026." };
  }
  if (mo < 0) return { err: "That month name is not recognised." };
  const dt = new Date(y, mo, d);
  if (dt.getMonth() !== mo || dt.getDate() !== d)
    return { err: "That day does not exist in that month." };
  if (dt < min) return { err: "The deadline must be tomorrow or later." };
  if (dt > max) return { err: "The deadline can be at most one year away." };
  return { date: dt };
}

export function DatePicker({
  id = "dp",
  value,
  onChange,
  onTextError,
  error,
  describedBy,
}: {
  id?: string;
  value: Date | null;
  onChange: (d: Date | null) => void;
  /** typing produced an error message (or cleared it) */
  onTextError: (msg: string | null) => void;
  error?: string | null;
  describedBy?: string;
}) {
  const today = useMemo(() => sod(new Date()), []);
  const MIN = useMemo(() => addD(today, 1), [today]);
  const MAX = useMemo(() => addD(today, MAX_DAYS), [today]);

  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value ? formatDateLabel(value) : "");
  const [view, setView] = useState(() => {
    const d = value ?? MIN;
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [mode, setMode] = useState<"days" | "months">("days");
  const [focus, setFocus] = useState<Date>(value ?? MIN);
  const [focusTick, setFocusTick] = useState(0);
  const [isPhone, setIsPhone] = useState(false);

  const anchorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popId = `${id}-pop`;

  const can = (d: Date) => d >= MIN && d <= MAX;

  /* keep the text in sync when the value changes from the calendar */
  const textRef = useRef(text);
  textRef.current = text;
  useEffect(() => {
    const want = value ? formatDateLabel(value) : "";
    if (want !== textRef.current) setText(want);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const close = (focusInput = false) => {
    setOpen(false);
    if (focusInput) inputRef.current?.focus();
  };

  const openPop = (focusGrid: boolean) => {
    setIsPhone(window.matchMedia("(max-width:640px)").matches);
    if (value) {
      setView(new Date(value.getFullYear(), value.getMonth(), 1));
      setFocus(value);
    }
    setMode("days");
    setOpen(true);
    if (focusGrid) setFocusTick((t) => t + 1);
  };

  /* outside click + Escape */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (anchorRef.current && !anchorRef.current.contains(e.target as Node))
        setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open ]);

  /* focus the roving-tabindex day after keyboard moves */
  useEffect(() => {
    if (focusTick === 0 || !open) return;
    const el = anchorRef.current?.querySelector<HTMLElement>(
      '.dp-day[tabindex="0"]'
    );
    el?.focus();
  }, [focusTick, open, view, focus, mode]);

  const commit = (d: Date) => {
    onChange(sod(d));
    onTextError(null);
    setText(formatDateLabel(d));
  };

  const pick = (d: Date) => {
    commit(d);
    setFocus(d);
    setView(new Date(d.getFullYear(), d.getMonth(), 1));
    if (!isPhone) close(true);
  };

  const moveFocus = (d: Date) => {
    const c = d < MIN ? MIN : d > MAX ? MAX : d;
    setFocus(c);
    setView(new Date(c.getFullYear(), c.getMonth(), 1));
    setFocusTick((t) => t + 1);
  };

  const tryParse = (closeAfter: boolean) => {
    const r = parseDate(text, MIN, MAX);
    if ("err" in r) {
      onTextError(r.err);
      return;
    }
    commit(r.date);
    if (closeAfter) close(false);
  };

  const onGridKeyDown = (e: React.KeyboardEvent) => {
    const t = e.target as HTMLElement;
    if (!t.classList.contains("dp-day")) return;
    const k = e.key;
    let d: Date | null = null;
    if (k === "ArrowLeft") d = addD(focus, -1);
    else if (k === "ArrowRight") d = addD(focus, 1);
    else if (k === "ArrowUp") d = addD(focus, -7);
    else if (k === "ArrowDown") d = addD(focus, 7);
    else if (k === "Home") d = addD(focus, -focus.getDay());
    else if (k === "End") d = addD(focus, 6 - focus.getDay());
    else if (k === "PageUp" || k === "PageDown") {
      const n = (k === "PageUp" ? -1 : 1) * (e.shiftKey ? 12 : 1);
      const tmp = new Date(focus.getFullYear(), focus.getMonth() + n, 1);
      d = new Date(
        tmp.getFullYear(),
        tmp.getMonth(),
        Math.min(
          focus.getDate(),
          new Date(tmp.getFullYear(), tmp.getMonth() + 1, 0).getDate()
        )
      );
    } else if (k === "Escape") {
      close(true);
      return;
    }
    if (d) {
      e.preventDefault();
      moveFocus(d);
    }
    /* Enter/Space fall through to the native button click → pick() */
  };

  const y = view.getFullYear();
  const m = view.getMonth();
  const prevOk = new Date(y, m, 0) >= MIN;
  const nextOk = new Date(y, m + 1, 1) <= MAX;

  const renderDays = () => {
    const first = new Date(y, m, 1);
    const start = addD(first, -first.getDay());
    const rows = [];
    for (let r = 0; r < 6; r++) {
      const cells = [];
      for (let c = 0; c < 7; c++) {
        const d = addD(start, r * 7 + c);
        const out = d.getMonth() !== m;
        const dis = !can(d);
        const isSel = sameDay(d, value);
        const isT = sameDay(d, today);
        const isF = sameDay(d, focus);
        const band = !!value && d >= today && d <= value;
        const rs = band && isT;
        const re = band && isSel;
        cells.push(
          <td
            key={c}
            role="gridcell"
            className={`${band ? "rw" : ""} ${rs ? "rs" : ""} ${re ? "re" : ""}`}
          >
            <button
              type="button"
              className={`dp-day${out ? " out" : ""}${isT ? " today" : ""}${
                isSel ? " sel" : ""
              }`}
              tabIndex={isF ? 0 : -1}
              disabled={dis}
              aria-selected={isSel}
              aria-current={isT ? "date" : undefined}
              aria-label={`${fullLabel(d)}${dis ? ", unavailable" : ""}`}
              onClick={() => pick(d)}
            >
              {d.getDate()}
            </button>
          </td>
        );
      }
      rows.push(<tr key={r}>{cells}</tr>);
    }
    return (
      <table className="dp-grid" role="grid" aria-label={`${MONTHS[m]} ${y}`}>
        <thead>
          <tr>
            {WD.map((w) => (
              <th key={w} scope="col">
                {w}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
    );
  };

  const renderMonths = () => (
    <div className="dp-months" role="group" aria-label={`Choose month, ${y}`}>
      {MS.map((n, i) => {
        const dis = new Date(y, i + 1, 0) < MIN || new Date(y, i, 1) > MAX;
        const sel = value && value.getFullYear() === y && value.getMonth() === i;
        const cur = today.getFullYear() === y && today.getMonth() === i;
        return (
          <button
            key={n}
            type="button"
            className={`dp-m${sel ? " sel" : ""}${cur ? " cur" : ""}`}
            disabled={dis}
            onClick={() => {
              const nv = new Date(y, i, 1);
              setView(nv);
              const last = new Date(y, i + 1, 0).getDate();
              const nf = new Date(y, i, Math.min(focus.getDate(), last));
              setFocus(nf < MIN ? MIN : nf > MAX ? MAX : nf);
              setMode("days");
              setFocusTick((t) => t + 1);
            }}
          >
            {n}
          </button>
        );
      })}
    </div>
  );

  const daysFrom = value
    ? Math.round((sod(value).getTime() - today.getTime()) / 864e5)
    : 0;

  return (
    <div className="dp-anchor" ref={anchorRef}>
      <div className="dpf">
        <input
          ref={inputRef}
          id={id}
          className={`inp${error ? " err" : ""}`}
          autoComplete="off"
          placeholder="e.g. 16 Oct 2026"
          value={text}
          role="combobox"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={popId}
          aria-describedby={describedBy}
          onClick={() => !open && openPop(false)}
          onFocus={() => {
            /* keep focus; popover opens on click / ArrowDown */
          }}
          onChange={(e) => {
            setText(e.target.value);
            onTextError(null);
            const r = parseDate(e.target.value, MIN, MAX);
            if ("date" in r) {
              onChange(sod(r.date));
              setView(
                new Date(r.date.getFullYear(), r.date.getMonth(), 1)
              );
              setFocus(sod(r.date));
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              if (!open) openPop(true);
            } else if (e.key === "Escape") {
              setOpen(false);
            } else if (e.key === "Enter") {
              e.preventDefault();
              tryParse(true);
            }
          }}
          onBlur={() => {
            if (text.trim() && !open) tryParse(false);
          }}
        />
        <button
          type="button"
          className="cal-btn"
          aria-label="Choose deadline from calendar"
          aria-expanded={open}
          aria-controls={popId}
          onClick={() => (open ? setOpen(false) : openPop(true))}
        >
          <Icon name="cal" size={20} />
        </button>
      </div>

      {open && (
        <>
          <div
            id={popId}
            className="dp-pop live"
            role="dialog"
            aria-label="Choose deadline"
            onKeyDown={onGridKeyDown}
          >
            <div className="dp-presets" role="group" aria-label="Quick picks">
              {PRESETS.map(([n, label]) => {
                const d = addD(today, n);
                return (
                  <button
                    key={n}
                    type="button"
                    className="dp-chip"
                    aria-pressed={sameDay(value, d)}
                    onClick={() => pick(d)}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <div className="dp-head">
              <button
                type="button"
                className="dp-title"
                aria-expanded={mode === "months"}
                aria-label="Change month or year"
                onClick={() =>
                  setMode((md) => (md === "days" ? "months" : "days"))
                }
              >
                {mode === "days" ? `${MONTHS[m]} ${y}` : y}
                <Icon name="chevD" size={16} />
              </button>
              <div className="dp-nav">
                <button
                  type="button"
                  className="dp-ib"
                  aria-label={
                    mode === "days" ? "Previous month" : "Previous year"
                  }
                  disabled={
                    mode === "days" ? !prevOk : y - 1 < MIN.getFullYear()
                  }
                  onClick={() =>
                    setView(
                      mode === "days"
                        ? new Date(y, m - 1, 1)
                        : new Date(y - 1, m, 1)
                    )
                  }
                >
                  <Icon name="chevL" size={18} />
                </button>
                <button
                  type="button"
                  className="dp-ib"
                  aria-label={mode === "days" ? "Next month" : "Next year"}
                  disabled={
                    mode === "days" ? !nextOk : y + 1 > MAX.getFullYear()
                  }
                  onClick={() =>
                    setView(
                      mode === "days"
                        ? new Date(y, m + 1, 1)
                        : new Date(y + 1, m, 1)
                    )
                  }
                >
                  <Icon name="chevR" size={18} />
                </button>
              </div>
            </div>

            {mode === "days" ? renderDays() : renderMonths()}

            <div className="dp-foot">
              <span className="sum" aria-live="polite">
                {value ? (
                  <>
                    <b>{formatDateLabel(value)}</b> · in {daysFrom} day
                    {daysFrom === 1 ? "" : "s"}
                  </>
                ) : (
                  "Choose a day after today"
                )}
              </span>
              <button
                type="button"
                className="btn btn-primary btn-sm dp-done"
                disabled={!value}
                onClick={() => close(true)}
              >
                Set deadline
              </button>
            </div>
          </div>
          <div className="dp-scrim" onClick={() => setOpen(false)} />
        </>
      )}
    </div>
  );
}
