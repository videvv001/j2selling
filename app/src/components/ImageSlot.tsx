import { useState } from 'react';
import { DEMO_MODE } from '../config';
import { readImageFile } from '../lib/images';

const KEY = (id: string) => 'j2-image-slot:' + id;

function stored(id: string): string | null {
  try { return localStorage.getItem(KEY(id)); } catch { return null; }
}

/**
 * Fills its positioned parent with an image, or a labelled placeholder when there is none.
 * In demo mode a presenter can click or drop a photo onto the slot; it is kept in this browser.
 */
export function ImageSlot({ id, placeholder, src }: { id: string; placeholder: string; src?: string | null }) {
  const [url, setUrl] = useState<string | null>(() => stored(id));
  const [over, setOver] = useState(false);
  const shown = url || src || null;

  const accept = (file: File | undefined) => {
    if (!file || !/^image\//.test(file.type)) return;
    readImageFile(file, 1200).then(data => {
      if (!data) return;
      try { localStorage.setItem(KEY(id), data); } catch { /* quota: keep for this session only */ }
      setUrl(data);
    });
  };
  const pick = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = () => accept(input.files?.[0]);
    input.click();
  };

  return (
    <div
      className="image-slot"
      data-editable={DEMO_MODE ? '' : undefined}
      data-over={over ? '' : undefined}
      onDragOver={DEMO_MODE ? e => { e.preventDefault(); setOver(true); } : undefined}
      onDragLeave={DEMO_MODE ? () => setOver(false) : undefined}
      onDrop={DEMO_MODE ? e => { e.preventDefault(); e.stopPropagation(); setOver(false); accept(e.dataTransfer.files[0]); } : undefined}
    >
      {shown ? (
        <img src={shown} alt={placeholder} />
      ) : (
        <>
          <div className="image-slot-ring" />
          <div className="image-slot-empty" onClick={DEMO_MODE ? e => { e.stopPropagation(); pick(); } : undefined}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="0" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
            </svg>
            <div className="cap">{placeholder}</div>
            {DEMO_MODE && <div className="sub">Drop an image or <u>browse</u></div>}
          </div>
        </>
      )}
    </div>
  );
}
