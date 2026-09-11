export function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hh = Math.floor(total / 3600);
  const mm = Math.floor((total % 3600) / 60);
  const ss = total % 60;
  if (hh > 0) {
    return `${hh}:${pad2(mm)}:${pad2(ss)}`;
  }
  return `${mm}:${pad2(ss)}`;
}

export function formatClock(ts: number): string {
  const d = new Date(ts);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

export function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export function formatDateTime(ts: number): string {
  const d = new Date(ts);
  return `${formatDate(ts)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
