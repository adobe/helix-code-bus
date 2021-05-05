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
const proxyquire = require('proxyquire');
const { Request } = require('@adobe/helix-universal');

function createTestRequest(body) {
  const payload = JSON.stringify(body);
  return new Request('https://content-bus.com/', {
    method: 'POST',
    body: Buffer.from(payload),
    headers: {
      'content-type': 'application/json',
    },
  });
}

describe('Index test', () => {
  it('sends 405 for GET', async () => {
    // eslint-disable-next-line global-require
    const { main } = require('../src/index.js');
    const resp = await main(new Request('https://content-bus.com'), {
      log: console,
      env: {},
    });
    assert.equal(resp.status, 405);
  });

  it('handles errors for invalid json', async () => {
    // eslint-disable-next-line global-require
    const { main } = require('../src/index.js');
    const req = new Request('https://content-bus.com', {
      method: 'POST',
      body: 'foo',
      headers: {
        'content-type': 'application/json',
      },
    });
    const resp = await main(req, {
      log: console,
      env: {},
    });
    assert.equal(resp.status, 400);
    assert.equal(resp.headers.get('x-error'), 'reject no json body');
  });

  it('call sync with payload', async () => {
    let actual = {};
    const { main } = proxyquire('../src/index.js', {
      './sync.js': (events) => {
        actual = events;
      },
    });

    const testEvents = {
      repo: 'test',
    };
    const req = createTestRequest(testEvents);
    const resp = await main(req, {
      log: console,
      env: { },
    });
    assert.equal(resp.status, 204);
    assert.deepEqual(actual, testEvents);
  });

  it('handles error in sync', async () => {
    const { main } = proxyquire('../src/index.js', {
      './sync.js': () => {
        throw new Error('something went wrong');
      },
    });

    const testEvents = {
      repo: 'test',
    };
    const req = createTestRequest(testEvents);
    const resp = await main(req, {
      log: console,
      env: { },
    });
    assert.equal(resp.status, 500);
    assert.equal(resp.headers.get('x-error'), 'something went wrong');
  });
});
