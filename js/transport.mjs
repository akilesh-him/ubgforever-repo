import EpoxyTransport from "/epoxy/index.mjs";
const pairs = (headers) =>
  headers?.[Symbol.iterator] ? headers : Object.entries(headers || {});
// scramjet v1 sends header objects but epoxy expects ordered pairs.
export default class SlipstreamTransport extends EpoxyTransport {
  async request(url, method, body, headers, signal) {
    const response = await super.request(
      url,
      method,
      body,
      pairs(headers),
      signal,
    );
    const normalized = {};
    for (const [name, value] of pairs(response.headers)) {
      const key = name.toLowerCase();
      normalized[key] =
        normalized[key] === undefined
          ? value
          : [].concat(normalized[key], value);
    }
    return { ...response, headers: normalized };
  }
  connect(url, protocols, headers, ...callbacks) {
    return super.connect(url, protocols, pairs(headers), ...callbacks);
  }
}
