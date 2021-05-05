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
const nock = require('nock');
const StorageS3 = require('../src/storage-s3.js');

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
      .reply(function cb(uri, body) {
        reqs[uri] = {
          body,
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
        body: 'hello, world.',
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
});
