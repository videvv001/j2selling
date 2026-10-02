/** Reads an image file and downsizes it to a JPEG data URL so it fits in local storage. */
export function readImageFile(file: File, width = 480): Promise<string | null> {
  return new Promise(resolve => {
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const w = Math.min(width, img.width), h = Math.round(img.height * w / img.width);
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        cv.getContext('2d')!.drawImage(img, 0, 0, w, h);
        resolve(cv.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = () => resolve(null);
      img.src = r.result as string;
    };
    r.onerror = () => resolve(null);
    r.readAsDataURL(file);
  });
}
