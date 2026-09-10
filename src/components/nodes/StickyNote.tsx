import { useState } from 'react';
import { NodeProps, useReactFlow } from '@xyflow/react';
import { BaseNodeData } from '../../types';

export interface StickyNoteData extends BaseNodeData {
  text?: string;
  tone?: StickyTone;
}

export type StickyTone = 'yellow' | 'blue' | 'green' | 'pink' | 'grey';

/**
 * Sticky tones are mixed against the theme's own surface rather than being
 * fixed pastels, so a note stays readable on the eggshell canvas and on the
 * dark one without a second palette.
 */
const TONES: Record<StickyTone, { label: string; tint: string; ink: string }> = {
  yellow: { label: 'Yellow', tint: '#e3b341', ink: '#7a5b04' },
  blue: { label: 'Blue', tint: '#268bd2', ink: '#10496f' },
  green: { label: 'Green', tint: '#859900', ink: '#4a5600' },
  pink: { label: 'Pink', tint: '#d33682', ink: '#7a1f4c' },
  grey: { label: 'Grey', tint: '#93a1a1', ink: '#3f4b4b' },
};

/**
 * A note on the canvas. It has no handles and no run behaviour on purpose:
 * it is annotation, so it must never join the graph or appear in the
 * generated code.
 */
export function StickyNote({ data, id }: NodeProps & { data: StickyNoteData }) {
  const { updateNodeData } = useReactFlow();
  const [text, setText] = useState(data.text ?? '');
  const [picking, setPicking] = useState(false);

  const tone = TONES[data.tone ?? 'yellow'] ?? TONES.yellow;

  const edit = (value: string) => {
    setText(value);
    updateNodeData(id, { text: value });
  };

  return (
    <div
      className="min-w-[220px] max-w-[320px] font-sans rounded-[var(--theme-radius-inner)] overflow-hidden"
      style={{
        background: `color-mix(in srgb, ${tone.tint} 22%, var(--color-card))`,
        border: `1px solid color-mix(in srgb, ${tone.tint} 45%, transparent)`,
      }}
    >
      <div
        className="flex items-center justify-between px-2.5 py-1.5"
        style={{ background: `color-mix(in srgb, ${tone.tint} 16%, transparent)` }}
      >
        <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: tone.ink }}>
          Note
        </span>
        <div className="flex items-center gap-1">
          {picking &&
            (Object.keys(TONES) as StickyTone[]).map((key) => (
              <button
                key={key}
                title={TONES[key].label}
                onClick={() => {
                  updateNodeData(id, { tone: key });
                  setPicking(false);
                }}
                className="w-3.5 h-3.5 rounded-full border border-black/10"
                style={{ background: TONES[key].tint }}
              />
            ))}
          <button
            onClick={() => setPicking((open) => !open)}
            title="Change colour"
            className="w-3.5 h-3.5 rounded-full border border-black/20"
            style={{ background: tone.tint }}
          />
        </div>
      </div>

      <textarea
        value={text}
        onChange={(event) => edit(event.target.value)}
        placeholder="Write a note…"
        // nodrag keeps a click-and-drag inside the textarea selecting text
        // rather than towing the note around the canvas.
        className="nodrag w-full bg-transparent border-0 outline-none resize-none px-3 py-2.5 text-[13px] leading-relaxed min-h-[96px]"
        style={{ color: 'var(--color-text-main)' }}
      />
    </div>
  );
}

export const STICKY_TONES = TONES;
