export function parsePublicOrigins(value) {
  return new Set(value.split(',').map(value => value.trim()).filter(Boolean).map(value => {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash)
      throw new Error('PUBLIC_ORIGINS must contain comma-separated HTTP or HTTPS origins without paths.');
    return url.origin;
  }));
}

export function allowedOrigin(origin, host, publicOrigins) {
  if (!origin) return true;
  return origin === 'http://' + host || origin === 'https://' + host || publicOrigins.has(origin);
}
