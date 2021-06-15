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

const { promisify } = require('util');
const zlib = require('zlib');
const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
  ListObjectsV2Command,
} = require('@aws-sdk/client-s3');
const processQueue = require('@adobe/helix-shared-process-queue');

const gzip = promisify(zlib.gzip);

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
    const zipped = await gzip(body);
    const input = {
      Body: zipped,
      Bucket: this._bucket,
      ContentType: contentType,
      ContentEncoding: 'gzip',
      Metadata: meta,
      Key: path.substring(1),
    };
    const result = await this._s3.send(new PutObjectCommand(input));
    this._log.info(`object uploaded: ${input.Bucket}/${input.Key}`);
    return result;
  }

  async remove(path) {
    const input = {
      Bucket: this._bucket,
      Key: path.substring(1),
    };
    const result = await this._s3.send(new DeleteObjectCommand(input));
    this._log.info(`object deleted: ${input.Bucket}/${input.Key}`);
    return result;
  }

  async list(prefix) {
    let ContinuationToken;
    const keys = [];
    do {
      // eslint-disable-next-line no-await-in-loop
      const result = await this._s3.send(new ListObjectsV2Command({
        Bucket: this._bucket,
        ContinuationToken,
        Prefix: prefix,
      }));
      ContinuationToken = result.IsTruncated ? result.NextContinuationToken : '';
      (result.Contents || []).forEach((content) => {
        keys.push(content.Key);
      });
    } while (ContinuationToken);
    return keys;
  }

  async copy(src, dst) {
    const tasks = [];
    const Prefix = src.substring(1);
    const dstPrefix = dst.substring(1);
    this._log.info(`fetching list of files to copy ${src} => ${dst}`);
    (await this.list(Prefix)).forEach((key) => {
      tasks.push({
        src: key,
        dst: `${dstPrefix}${key.substring(Prefix.length)}`,
      });
    });

    let oks = 0;
    let errors = 0;
    await processQueue(tasks, async (task) => {
      this._log.info(`copy to ${task.dst}`);
      try {
        await this._s3.send(new CopyObjectCommand({
          Bucket: this._bucket,
          CopySource: `${this._bucket}/${task.src}`,
          Key: task.dst,
        }));
        oks += 1;
      } catch (e) {
        this._log.warn(`error while copying ${task.dst}: ${e}`);
        errors += 1;
      }
    }, 64);
    this._log.info(`copied ${oks} files to ${dst} (${errors} errors)`);
  }

  async rmdir(src) {
    this._log.info(`fetching list of files to delete from ${src}`);
    const keys = await this.list(src.substring(1));

    let oks = 0;
    let errors = 0;
    await processQueue(keys, async (Key) => {
      this._log.info(`deleting ${Key}`);
      try {
        await this._s3.send(new DeleteObjectCommand({
          Bucket: this._bucket,
          Key,
        }));
        oks += 1;
      } catch (e) {
        this._log.warn(`error while deleting ${Key}: ${e.$metadata.httpStatusCode}`);
        errors += 1;
      }
    }, 64);
    this._log.info(`deleted ${oks} files (${errors} errors)`);
  }
}

module.exports = StorageS3;
