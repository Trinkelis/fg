export async function processImageOnServer(file, args, outputExt) {
  // 1. Upload
  const fd = new FormData();
  fd.append('file', file);
  const upRes = await fetch('/api/image/upload', { method: 'POST', body: fd });
  if (!upRes.ok) {
    const e = await upRes.json().catch(() => ({}));
    throw new Error(e.error || `Upload failed (${upRes.status})`);
  }
  const { id } = await upRes.json();

  // 2. Process
  const procRes = await fetch('/api/image/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inputId: id, args, outputExt }),
  });
  if (!procRes.ok) {
    const e = await procRes.json().catch(() => ({}));
    throw new Error(e.error || `Processing failed (${procRes.status})`);
  }
  const { downloadUrl } = await procRes.json();
  return downloadUrl; // e.g. /outputs/uuid.jpg
}