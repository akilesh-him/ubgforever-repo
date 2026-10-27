import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export function createAzionConfig(origin) {
  const url = new URL(origin);
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash)
    throw new Error('Use an HTTPS origin hostname without a port, path, credentials or query string.');
  return {
    version: 4,
    connectors: [{
      name: 'slipstream-origin', active: true, type: 'http',
      attributes: {
        addresses: [{ address: url.hostname }],
        connectionOptions: { transportPolicy: 'force_https', httpVersionPolicy: 'http1_1', host: url.hostname },
        modules: { loadBalancer: { enabled: false, config: null }, originShield: { enabled: false, config: null } },
      },
    }],
    applications: [{
      name: 'slipstream', active: true, edgeCacheEnabled: false,
      functionsEnabled: false, applicationAcceleratorEnabled: true,
      rules: { request: [{
        name: 'Slipstream origin', active: true,
        criteria: [[{ variable: '${uri}', conditional: 'if', operator: 'starts_with', argument: '/' }]],
        behaviors: [{ type: 'set_connector', attributes: { value: 'slipstream-origin' } }],
      }] },
    }],
    workloads: [{
      name: 'slipstream', active: true, infrastructure: 1,
      deployments: [{ name: 'slipstream', active: true, current: true,
        strategy: { type: 'default', attributes: { application: 'slipstream' } } }],
    }],
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const config = createAzionConfig(process.argv[2]);
    await writeFile('azion.config.json', JSON.stringify(config, null, 2) + '\n');
    console.log('Created azion.config.json. Follow docs/AZION.md before applying it.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
