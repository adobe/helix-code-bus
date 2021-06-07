/*
 * Copyright 2021 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

/* eslint-env mocha */

const assert = require('assert');
const path = require('path');
const fs = require('fs').promises;
const { aggregate } = require('../src/config.js');

async function loadConfig(obj, name) {
  // eslint-disable-next-line no-param-reassign
  obj[name] = await fs.readFile(path.resolve(__dirname, 'fixtures', 'config', name));
}

describe('Config test', () => {
  const testConfigs = {};

  before(async () => {
    await loadConfig(testConfigs, 'fstab.yaml');
    await loadConfig(testConfigs, 'fstab-invalid.yaml');
    await loadConfig(testConfigs, 'head.html');
    await loadConfig(testConfigs, 'helix-query.yaml');
    await loadConfig(testConfigs, 'helix-redirects.yaml');
  });

  it('creates an aggregate config', async () => {
    const configChanges = {
      'fstab.yaml': {
        data: testConfigs['fstab.yaml'],
      },
      'head.html': {
        data: testConfigs['head.html'],
      },
      'helix-query.yaml': {
        data: testConfigs['helix-query.yaml'],
      },
      'helix-redirects.yaml': {
        data: testConfigs['helix-redirects.yaml'],
      },
    };
    const expected = JSON.parse(await fs.readFile(path.resolve(__dirname, 'fixtures', 'config', 'aggregate-all.json'), 'utf-8'));
    const combined = await aggregate(console, configChanges);
    assert.deepStrictEqual(combined, expected);
  });

  it('creates an aggregate config of partial config', async () => {
    const configChanges = {
      'fstab.yaml': {
        data: testConfigs['fstab.yaml'],
      },
      'head.html': {
        data: testConfigs['head.html'],
      },
      'helix-query.yaml': {
      },
      'helix-redirects.yaml': {
      },
    };
    const expected = JSON.parse(await fs.readFile(path.resolve(__dirname, 'fixtures', 'config', 'aggregate-partial.json'), 'utf-8'));
    const combined = await aggregate(console, configChanges);
    assert.deepStrictEqual(combined, expected);
  });

  it('rejects aggregate config with invalid config', async () => {
    const configChanges = {
      'fstab.yaml': {
        data: testConfigs['fstab-invalid.yaml'],
      },
      'head.html': {
        data: testConfigs['head.html'],
      },
      'helix-query.yaml': {
      },
      'helix-redirects.yaml': {
      },
    };
    await assert.rejects(aggregate(console, configChanges), new Error('Unable to create fstab config from fstab.yaml: data must NOT have additional properties'));
  });
});
