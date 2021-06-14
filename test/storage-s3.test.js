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
const fs = require('fs').promises;
const path = require('path');
const nock = require('nock');
const { promisify } = require('util');
const zlib = require('zlib');

const StorageS3 = require('../src/storage-s3.js');

const gzip = promisify(zlib.gzip);

const AWS_S3_REGION = 'fake';
const AWS_S3_ACCESS_KEY_ID = 'fake';
const AWS_S3_SECRET_ACCESS_KEY = 'fake';

const TEST_HEADERS = [
  'content-type',
  'x-amz-meta-myid',
];

describe('Storage S3 test', () => {
  it('can put object', async () => {
    const reqs = {};
    const scope = nock('https://helix-code-bus.s3.fake.amazonaws.com')
      .put('/foo?x-id=PutObject')
      .reply(function cb(uri) {
        reqs[uri] = {
          body: Buffer.concat(this.req.requestBodyBuffers),
          headers: Object.fromEntries(Object.entries(this.req.headers)
            .filter((key) => TEST_HEADERS.indexOf(key) >= 0)),
        };
        return [201];
      });

    const storage = new StorageS3({
      AWS_S3_REGION,
      AWS_S3_ACCESS_KEY_ID,
      AWS_S3_SECRET_ACCESS_KEY,
    });
    await storage.put('/foo', 'hello, world.', 'text/plain', {
      myid: '1234',
    });
    await scope.done();

    assert.deepEqual(reqs, {
      '/foo?x-id=PutObject': {
        body: await gzip(Buffer.from('hello, world.', 'utf-8')),
        headers: {},
      },
    });
  });

  it('can put object uncompressed', async () => {
    const reqs = {};
    const scope = nock('https://helix-code-bus.s3.fake.amazonaws.com')
      .put('/foo?x-id=PutObject')
      .reply(function cb(uri) {
        reqs[uri] = {
          body: Buffer.concat(this.req.requestBodyBuffers),
          headers: Object.fromEntries(Object.entries(this.req.headers)
            .filter((key) => TEST_HEADERS.indexOf(key) >= 0)),
        };
        return [201];
      });

    const storage = new StorageS3({
      AWS_S3_REGION,
      AWS_S3_ACCESS_KEY_ID,
      AWS_S3_SECRET_ACCESS_KEY,
    });
    await storage.put('/foo', 'hello, world.', 'text/plain', {
      myid: '1234',
    }, false);
    await scope.done();

    assert.deepEqual(reqs, {
      '/foo?x-id=PutObject': {
        body: Buffer.from('hello, world.', 'utf-8'),
        headers: {},
      },
    });
  });

  it('can remove object', async () => {
    const reqs = {};
    const scope = nock('https://helix-code-bus.s3.fake.amazonaws.com')
      .delete('/foo?x-id=DeleteObject')
      .reply(function cb(uri, body) {
        reqs[uri] = {
          body,
          headers: Object.fromEntries(Object.entries(this.req.headers)
            .filter((key) => TEST_HEADERS.indexOf(key) >= 0)),
        };
        return [204];
      });

    const storage = new StorageS3({
      AWS_S3_REGION,
      AWS_S3_ACCESS_KEY_ID,
      AWS_S3_SECRET_ACCESS_KEY,
    });
    await storage.remove('/foo');
    await scope.done();

    assert.deepEqual(reqs, {
      '/foo?x-id=DeleteObject': {
        body: '',
        headers: {},
      },
    });
  });

  it('can copy objects', async () => {
    const listReply = JSON.parse(await fs.readFile(path.resolve(__dirname, 'fixtures', 'list-reply-copy.json'), 'utf-8'));
    const puts = [];
    const scope = nock('https://helix-code-bus.s3.fake.amazonaws.com')
      .get('/?list-type=2&prefix=tripodsan%2Fhelix-test-private%2Fmaster%2F')
      .reply(200, listReply[0])
      .get('/?continuation-token=1%2Fs4dr7BSKNScrN4njX9%2BCpBNimYkuEzMWg3niTSAPMdculBmycyUPM6kv0xi46j4hdc1lFPkE%2FICI8TxG%2BVNV9Hh91Ou0hqeBYzqTRzSBSs%3D&list-type=2&prefix=tripodsan%2Fhelix-test-private%2Fmaster%2F')
      .reply(200, listReply[1])
      .put(/.*/)
      .times(10)
      .reply((uri) => {
        puts.push(uri);
        // reject first uri
        if (puts.length === 1) {
          return [404];
        }
        return [200, '<?xml version=\\"1.0\\" encoding=\\"UTF-8\\"?>\\n<CopyObjectResult xmlns=\\"http://s3.amazonaws.com/doc/2006-03-01/\\"><LastModified>2021-05-05T08:37:23.000Z</LastModified><ETag>&quot;f278c0035a9b4398629613a33abe6451&quot;</ETag></CopyObjectResult>'];
      });

    const storage = new StorageS3({
      AWS_S3_REGION,
      AWS_S3_ACCESS_KEY_ID,
      AWS_S3_SECRET_ACCESS_KEY,
    });
    await storage.copy('/tripodsan/helix-test-private/master/', '/bar/');
    await scope.done();

    puts.sort();
    assert.deepEqual(puts, [
      '/bar/.circleci/config.yml?x-id=CopyObject',
      '/bar/.gitignore?x-id=CopyObject',
      '/bar/.vscode/launch.json?x-id=CopyObject',
      '/bar/.vscode/settings.json?x-id=CopyObject',
      '/bar/README.md?x-id=CopyObject',
      '/bar/helix_logo.png?x-id=CopyObject',
      '/bar/htdocs/favicon.ico?x-id=CopyObject',
      '/bar/htdocs/style.css?x-id=CopyObject',
      '/bar/index.md?x-id=CopyObject',
      '/bar/src/html.pre.js?x-id=CopyObject',
    ]);
  });

  it('can delete objects', async () => {
    const listReply = JSON.parse(await fs.readFile(path.resolve(__dirname, 'fixtures', 'list-reply.json'), 'utf-8'));
    const deletes = [];
    const scope = nock('https://helix-code-bus.s3.fake.amazonaws.com')
      .get('/?list-type=2&prefix=tripodsan%2Fhelix-test-private%2Fnew-branch%2F')
      .reply(200, listReply.response)
      .delete(/.*/)
      .times(10)
      .reply((uri) => {
        deletes.push(uri);
        // reject first uri
        if (deletes.length === 1) {
          return [404];
        }
        return [204];
      });

    const storage = new StorageS3({
      AWS_S3_REGION,
      AWS_S3_ACCESS_KEY_ID,
      AWS_S3_SECRET_ACCESS_KEY,
    });
    await storage.rmdir('/tripodsan/helix-test-private/new-branch/');
    await scope.done();

    deletes.sort();
    assert.deepEqual(deletes, [
      '/tripodsan/helix-test-private/master/.circleci/config.yml?x-id=DeleteObject',
      '/tripodsan/helix-test-private/master/.gitignore?x-id=DeleteObject',
      '/tripodsan/helix-test-private/master/.vscode/launch.json?x-id=DeleteObject',
      '/tripodsan/helix-test-private/master/.vscode/settings.json?x-id=DeleteObject',
      '/tripodsan/helix-test-private/master/README.md?x-id=DeleteObject',
      '/tripodsan/helix-test-private/master/helix_logo.png?x-id=DeleteObject',
      '/tripodsan/helix-test-private/master/htdocs/favicon.ico?x-id=DeleteObject',
      '/tripodsan/helix-test-private/master/htdocs/style.css?x-id=DeleteObject',
      '/tripodsan/helix-test-private/master/index.md?x-id=DeleteObject',
      '/tripodsan/helix-test-private/master/src/html.pre.js?x-id=DeleteObject',
    ]);
  });

  it('rmdir works for empty dir', async () => {
    const scope = nock('https://helix-code-bus.s3.fake.amazonaws.com')
      .get('/?list-type=2&prefix=tripodsan%2Fhelix-test-private%2Fnew-branch%2F')
      .reply(200, '<?xml version=\\"1.0\\" encoding=\\"UTF-8\\"?>\\n<ListBucketResult xmlns=\\"http://s3.amazonaws.com/doc/2006-03-01/\\"><Name>helix-code-bus</Name><Prefix>tripodsan/helix-test-private/new-branch/</Prefix><KeyCount>0</KeyCount><MaxKeys>1000</MaxKeys><IsTruncated>false</IsTruncated></ListBucketResult>');

    const storage = new StorageS3({
      AWS_S3_REGION,
      AWS_S3_ACCESS_KEY_ID,
      AWS_S3_SECRET_ACCESS_KEY,
    });
    await storage.rmdir('/tripodsan/helix-test-private/new-branch/');
    await scope.done();
  });
});
