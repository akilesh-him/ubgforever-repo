export async function readAIResponse(response) {
  if (!(response.headers.get('content-type') || '').includes('application/json')) {
    if (response.status === 413) throw new Error('The host rejected this message as too large. Remove attachments and retry.');
    throw new Error('The AI server returned a webpage instead of an API response. Check the deployment API routing.');
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('The AI server returned an unreadable response. Please retry.');
  }
  if (!response.ok) throw new Error(data?.error || 'Could not connect. Please retry.');
  if (!data || typeof data.content !== 'string') throw new Error('The AI server returned an empty response. Please retry.');
  return data;
}
