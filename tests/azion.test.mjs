import test from 'node:test';
import assert from 'node:assert/strict';
import { createAzionConfig } from '../tools/configure-azion.mjs';
import { allowedOrigin, parsePublicOrigins } from '../server-origins.mjs';

test('Azion routes all paths to HTTPS origin without caching API responses', () => {
  const config = createAzionConfig('https://origin.example.com');
  assert.equal(config.connectors[0].attributes.addresses[0].address, 'origin.example.com');
  assert.equal(config.applications[0].edgeCacheEnabled, false);
  assert.equal(config.applications[0].rules.request[0].behaviors[0].attributes.value, config.connectors[0].name);
  assert.equal(config.workloads[0].deployments[0].strategy.attributes.application, config.applications[0].name);
  for (const origin of ['http://origin.example.com', 'https://origin.example.com/path', 'https://origin.example.com:5186', 'https://user:pass@origin.example.com'])
    assert.throws(() => createAzionConfig(origin));
});

test('public origins explicitly allow edge domains without trusting forwarded hosts', () => {
  const origins = parsePublicOrigins('https://slipstream.example.com, https://other.example.com');
  assert.equal(allowedOrigin('https://slipstream.example.com', 'origin.example.com', origins), true);
  assert.equal(allowedOrigin('https://origin.example.com', 'origin.example.com', origins), true);
  assert.equal(allowedOrigin('https://untrusted.example.com', 'origin.example.com', origins), false);
  assert.equal(allowedOrigin('https://slipstream.example.com.attacker.test', 'origin.example.com', origins), false);
  assert.equal(allowedOrigin('null', 'origin.example.com', origins), false);
  assert.throws(() => parsePublicOrigins('https://example.com/path'));
});
