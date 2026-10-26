const isAllowedImage = async (file: File): Promise<boolean> => {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes.slice(0, 8).every((value, index) => value === [137, 80, 78, 71, 13, 10, 26, 10][index]);
  const webp = new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP';
  return jpeg || png || webp;
};

export async function prepareIdPhoto(file: File): Promise<Blob> {
  if (file.size < 1 || file.size > 5 * 1024 * 1024) throw new Error('Choose a JPEG, PNG or WebP photo up to 5 MB.');
  if (!(await isAllowedImage(file))) throw new Error('Choose a valid JPEG, PNG or WebP photo.');
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Photo preview is unavailable in this browser.');
    context.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.88));
    if (!blob) throw new Error('Photo preview could not be prepared. Choose another photo.');
    return blob;
  } finally { bitmap.close(); }
}

