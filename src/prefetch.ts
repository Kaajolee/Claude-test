// Browser-native low-priority fetch. Fire-and-forget; 404s fail silently
// which suits the "Unity build might not exist yet" workflow.
const scheduled = new Set<string>();

export function prefetch(url: string, as?: string): void {
  if (scheduled.has(url)) return;
  scheduled.add(url);

  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = url;
  if (as) link.as = as;
  document.head.appendChild(link);
}

export function prefetchMany(urls: Array<string | [string, string]>): void {
  for (const entry of urls) {
    if (typeof entry === 'string') prefetch(entry);
    else prefetch(entry[0], entry[1]);
  }
}
