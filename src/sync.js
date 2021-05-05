/*
 * Copyright 2018 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */
const processQueue = require('@adobe/helix-shared-process-queue');
const { Octokit } = require('@octokit/rest');
// const { createAppAuth } = require('@octokit/auth-app');
const SyncS3 = require('./storage-s3.js');

async function sync(data, ctx) {
  const { log, env } = ctx;
  const {
    AWS_S3_REGION, AWS_S3_ACCESS_KEY_ID, AWS_S3_SECRET_ACCESS_KEY,
    // GH_APP_ID, GH_APP_PRIVATE_KEY, // , GH_CLIENT_ID, GH_CLIENT_SECRET,
    GH_TOKEN,
  } = env;
  const storage = new SyncS3({
    AWS_S3_REGION,
    AWS_S3_ACCESS_KEY_ID,
    AWS_S3_SECRET_ACCESS_KEY,
    log,
  });

  const octokit = new Octokit({
    auth: `token ${GH_TOKEN}`,
    log,
  });

  // const octokit = new Octokit({
  //   authStrategy: createAppAuth,
  //   auth: {
  //     appId: GH_APP_ID,
  //     privateKey: GH_APP_PRIVATE_KEY,
  //     // clientId: GH_CLIENT_ID,
  //     // clientSecret: GH_CLIENT_SECRET,
  //     installationId: data.installationId,
  //     // optional: this will make appOctokit authenticate as app (JWT)
  //     //           or installation (access token), depending on the request URL
  //     // installationId: 123,
  //   },
  // });
  //
  const { changes } = data;
  if (changes.length === 1 && changes[0].path === '*') {
    log.warn('create/delete branch not supported yet');
    return;
  }

  const prefix = `/${data.owner}/${data.repo}/${data.ref}/`;

  await processQueue(changes, async (change) => {
    log.info('fetching from github');
    const res = await octokit.repos.getContent({
      owner: data.owner,
      repo: data.repo,
      ref: data.ref,
      path: change.path,
    });
    const body = Buffer.from(res.data.content, 'base64');
    const path = `${prefix}${change.path}`;
    log.info('uploading ', path);
    await storage.put(path, body, change.contentType, {
      'x-commit-id': change.commit,
    });
  });
}

module.exports = sync;
