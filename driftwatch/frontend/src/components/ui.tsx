import type { ReactNode } from "react";

export function Segmented<T extends string | number>(props: {
  label: string;
  value: T;
  options: { value: T; label: string; hint?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="field">
      <span className="field-label" id={`seg-${props.label}`}>{props.label}</span>
      <div className="segmented" role="radiogroup" aria-labelledby={`seg-${props.label}`}>
        {props.options.map((o) => (
          <button
            key={String(o.value)}
            role="radio"
            aria-checked={o.value === props.value}
            className={o.value === props.value ? "on" : ""}
            title={o.hint}
            onClick={() => props.onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Slider(props: {
  label: string; value: number; min: number; max: number; step: number;
  format?: (v: number) => string; onChange: (v: number) => void; hint?: string;
}) {
  return (
    <label className="field" title={props.hint}>
      <span className="field-label">
        {props.label} <b className="num">{props.format ? props.format(props.value) : props.value}</b>
      </span>
      <input type="range" min={props.min} max={props.max} step={props.step} value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))} />
    </label>
  );
}

export function Chip(props: { tone?: "alarm" | "ok" | "info" | "muted"; children: ReactNode; title?: string }) {
  return <span className={`chip ${props.tone ?? "muted"}`} title={props.title}>{props.children}</span>;
}

export function Section(props: { title: string; note?: ReactNode; aside?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section className="section" id={props.id}>
      <header className="section-head">
        <div>
          <h2>{props.title}</h2>
          {props.note && <p className="note">{props.note}</p>}
        </div>
        {props.aside}
      </header>
      {props.children}
    </section>
  );
}

export function Empty(props: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <strong>{props.title}</strong>
      {props.children && <p>{props.children}</p>}
    </div>
  );
}
