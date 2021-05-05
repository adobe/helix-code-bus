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

const {
  S3Client,
  PutObjectCommand,
} = require('@aws-sdk/client-s3');

class StorageS3 {
  constructor(opts) {
    const {
      AWS_S3_REGION: region,
      AWS_S3_ACCESS_KEY_ID: accessKeyId,
      AWS_S3_SECRET_ACCESS_KEY: secretAccessKey,
      log = console,
    } = opts;
    if (region && accessKeyId && secretAccessKey) {
      log.info('Creating S3Client with credentials');
      this._s3 = new S3Client({
        region,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
    } else {
      log.info('Creating S3Client without credentials');
      this._s3 = new S3Client();
    }

    this._bucket = opts.bucketId || 'helix-code-bus';
    this._log = log;
  }

  async put(path, body, contentType, meta) {
    const input = {
      Body: body,
      Bucket: this._bucket,
      ContentType: contentType,
      Metadata: meta,
      Key: path.substring(1),
    };
    const result = await this._s3.send(new PutObjectCommand(input));
    this._log.info(`Object uploaded to: ${input.Bucket}/${input.Key}`);
    return result;
  }
}

module.exports = StorageS3;
