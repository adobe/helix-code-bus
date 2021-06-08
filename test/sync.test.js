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
const nock = require('nock');
const sync = require('../src/sync.js');

class MockStorageS3 {
  constructor() {
    this.added = [];
    this.removed = [];
    this.rmdirs = [];
    this.copys = [];
  }

  async put(filePath, body, contentType, meta) {
    this.added.push({
      filePath, body: body.toString('utf-8'), contentType, meta,
    });
  }

  async remove(filePath) {
    this.removed.push(filePath);
  }

  async rmdir(filePath) {
    this.rmdirs.push(filePath);
  }

  async copy(src, dst) {
    this.copys.push({ src, dst });
  }
}

describe('Sync test', () => {
  it('call storage for events', async () => {
    const scope = nock('https://api.github.com')
      .get('/repos/tripodsan/helix-test-private/contents/new-file.txt?ref=master')
      .reply(200, {
        content: Buffer.from('hello, world').toString('base64'),
        encoding: 'base64',
      })
      .get('/repos/tripodsan/helix-test-private/contents/README.md?ref=master')
      .reply(200, {
        content: Buffer.from('hello, world').toString('base64'),
        encoding: 'base64',
      })
      .get('/repos/tripodsan/helix-test-private/contents/fail.md?ref=master')
      .reply(502, 'timeout');

    const storage = new MockStorageS3();
    const events = JSON.parse(await fs.readFile(path.resolve(__dirname, 'fixtures', 'events.json'), 'utf-8'));
    await sync(events, {
      log: console,
      env: {
        GH_TOKEN: 'fake',
      },
      storage,
    });
    await scope.done();

    assert.deepEqual(storage.added, [
      {
        body: 'hello, world',
        contentType: 'text/plain; charset=utf-8',
        filePath: '/tripodsan/helix-test-private/master/new-file.txt',
        meta: {
          'x-commit-id': '5edf98811d50b5b948f6f890f0c4367095490dbd',
        },
      },
      {
        body: 'hello, world',
        contentType: 'text/markdown; charset=utf-8',
        filePath: '/tripodsan/helix-test-private/master/README.md',
        meta: {
          'x-commit-id': '5edf98811d50b5b948f6f890f0c4367095490dbd',
        },
      },
    ]);
    assert.deepEqual(storage.removed, [
      '/tripodsan/helix-test-private/master/src/html.htl',
    ]);
  });

  it('call storage for events with config', async () => {
    const scope = nock('https://api.github.com')
      .get('/repos/tripodsan/helix-test-private/contents/fstab.yaml?ref=master')
      .reply(200, {
        content: Buffer.from('mountpoints:\n  /: https://adobe.sharepoint.com/sites/TheBlog/Shared%20Documents/theblog\n').toString('base64'),
        encoding: 'base64',
      })
      .get('/repos/tripodsan/helix-test-private/contents/head.html?ref=master')
      .reply(200, {
        content: Buffer.from('<link rel="stylesheet" href="/style/v2/style.css"/>').toString('base64'),
        encoding: 'base64',
      })
      .get('/repos/tripodsan/helix-test-private/contents/helix-redirects.yaml?ref=master')
      .reply(404)
      .get('/repos/tripodsan/helix-test-private/contents/helix-query.yaml?ref=master')
      .reply(404);

    const storage = new MockStorageS3();
    const events = JSON.parse(await fs.readFile(path.resolve(__dirname, 'fixtures', 'events-with-config.json'), 'utf-8'));
    await sync(events, {
      log: console,
      env: {
        GH_TOKEN: 'fake',
      },
      storage,
    });
    await scope.done();

    assert.deepEqual(storage.added, [
      {
        body: 'mountpoints:\n  /: https://adobe.sharepoint.com/sites/TheBlog/Shared%20Documents/theblog\n',
        contentType: 'text/plain; charset=utf-8',
        filePath: '/tripodsan/helix-test-private/master/fstab.yaml',
        meta: {
          'x-commit-id': '5edf98811d50b5b948f6f890f0c4367095490dbd',
        },
      },
      {
        body: '{\n  "head": {\n    "html": "<link rel=\\"stylesheet\\" href=\\"/style/v2/style.css\\"/>"\n  },\n  "fstab": {\n    "mountpoints": {\n      "/": "https://adobe.sharepoint.com/sites/TheBlog/Shared%20Documents/theblog"\n    }\n  }\n}',
        contentType: 'application/json',
        filePath: '/tripodsan/helix-test-private/master/helix-config.json',
        meta: {
          'x-commit-id': '5edf98811d50b5b948f6f890f0c4367095490dbd',
        },
      },
    ]);
    assert.deepEqual(storage.removed, [
      '/tripodsan/helix-test-private/master/helix-markup.yaml',
    ]);
  });

  it('call storage for events with config with errors', async () => {
    const scope = nock('https://api.github.com')
      .get('/repos/tripodsan/helix-test-private/contents/fstab.yaml?ref=master')
      .reply(200, {
        content: Buffer.from('foobar\n').toString('base64'),
        encoding: 'base64',
      })
      .get('/repos/tripodsan/helix-test-private/contents/head.html?ref=master')
      .reply(200, {
        content: Buffer.from('<link rel="stylesheet" href="/style/v2/style.css"/>').toString('base64'),
        encoding: 'base64',
      })
      .get('/repos/tripodsan/helix-test-private/contents/helix-redirects.yaml?ref=master')
      .reply(404)
      .get('/repos/tripodsan/helix-test-private/contents/helix-query.yaml?ref=master')
      .reply(404);

    const storage = new MockStorageS3();
    const events = JSON.parse(await fs.readFile(path.resolve(__dirname, 'fixtures', 'events-with-config.json'), 'utf-8'));
    await sync(events, {
      log: console,
      env: {
        GH_TOKEN: 'fake',
      },
      storage,
    });
    await scope.done();

    assert.deepEqual(storage.added, [
      {
        body: 'foobar\n',
        contentType: 'text/plain; charset=utf-8',
        filePath: '/tripodsan/helix-test-private/master/fstab.yaml',
        meta: {
          'x-commit-id': '5edf98811d50b5b948f6f890f0c4367095490dbd',
        },
      },
    ]);
    assert.deepEqual(storage.removed, [
      '/tripodsan/helix-test-private/master/helix-markup.yaml',
    ]);
  });

  it('handles branch creation', async () => {
    const scope = nock('https://api.github.com')
      .get('/repos/tripodsan/helix-test-private/contents/foo.md?ref=new-branch')
      .reply(200, {
        content: Buffer.from('hello, world').toString('base64'),
        encoding: 'base64',
      });

    const storage = new MockStorageS3();
    const events = JSON.parse(await fs.readFile(path.resolve(__dirname, 'fixtures', 'events-branch-created.json'), 'utf-8'));
    await sync(events, {
      log: console,
      env: {
        GH_TOKEN: 'fake',
      },
      storage,
    });

    assert.deepEqual(storage.added, [{
      body: 'hello, world',
      contentType: 'text/markdown; charset=utf-8',
      filePath: '/tripodsan/helix-test-private/new-branch/foo.md',
      meta: {
        'x-commit-id': '5edf98811d50b5b948f6f890f0c4367095490dbd',
      },
    }]);
    assert.deepEqual(storage.removed, []);
    assert.deepEqual(storage.copys, [{
      dst: '/tripodsan/helix-test-private/new-branch/',
      src: '/tripodsan/helix-test-private/master/',
    }]);

    await scope.done();
  });

  it('handles branch creation with no base ref', async () => {
    const storage = new MockStorageS3();
    const events = JSON.parse(await fs.readFile(path.resolve(__dirname, 'fixtures', 'events-branch-created.json'), 'utf-8'));
    events.baseRef = '';
    await sync(events, {
      log: console,
      env: {
        GH_TOKEN: 'fake',
      },
      storage,
    });

    assert.deepEqual(storage.added, []);
    assert.deepEqual(storage.removed, []);
    assert.deepEqual(storage.copys, []);
  });

  it('handles branch deletion', async () => {
    const storage = new MockStorageS3();
    const events = JSON.parse(await fs.readFile(path.resolve(__dirname, 'fixtures', 'events-branch-deleted.json'), 'utf-8'));
    await sync(events, {
      log: console,
      env: {
        GH_TOKEN: 'fake',
      },
      storage,
    });

    assert.deepEqual(storage.added, []);
    assert.deepEqual(storage.removed, []);
    assert.deepEqual(storage.rmdirs, [
      '/tripodsan/helix-test-private/new-branch/',
    ]);
  });

  it('handles branch deletion on main', async () => {
    const storage = new MockStorageS3();
    const events = JSON.parse(await fs.readFile(path.resolve(__dirname, 'fixtures', 'events-branch-deleted.json'), 'utf-8'));
    events.ref = 'main';
    await sync(events, {
      log: console,
      env: {
        GH_TOKEN: 'fake',
      },
      storage,
    });

    assert.deepEqual(storage.added, []);
    assert.deepEqual(storage.removed, []);
    assert.deepEqual(storage.rmdirs, []);
  });

  it('handles branch deletion on master', async () => {
    const storage = new MockStorageS3();
    const events = JSON.parse(await fs.readFile(path.resolve(__dirname, 'fixtures', 'events-branch-deleted.json'), 'utf-8'));
    events.ref = 'master';
    await sync(events, {
      log: console,
      env: {
        GH_TOKEN: 'fake',
      },
      storage,
    });

    assert.deepEqual(storage.added, []);
    assert.deepEqual(storage.removed, []);
    assert.deepEqual(storage.rmdirs, []);
  });
});
