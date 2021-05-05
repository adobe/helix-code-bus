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
const processQueue = require('@adobe/helix-shared-process-queue');
const { Octokit } = require('@octokit/rest');

async function sync(data, ctx) {
  const { log, env, storage } = ctx;
  const { GH_TOKEN } = env;

  const octokit = new Octokit({
    auth: `token ${GH_TOKEN}`,
    log,
  });

  const { changes } = data;
  if (changes.length === 1 && changes[0].path === '*') {
    log.warn('create/delete branch not supported yet');
    return;
  }

  const prefix = `/${data.owner}/${data.repo}/${data.ref}/`;

  await processQueue(changes, async (change) => {
    const path = `${prefix}${change.path}`;

    if (change.type === 'deleted') {
      log.info('deleting ', path);
      await storage.remove(path);
    } else {
      log.info('fetching from github');
      const res = await octokit.repos.getContent({
        owner: data.owner,
        repo: data.repo,
        ref: data.ref,
        path: change.path,
      });
      const body = Buffer.from(res.data.content, 'base64');
      log.info('uploading ', path);
      await storage.put(path, body, change.contentType, {
        'x-commit-id': change.commit,
      });
    }
  });
}

module.exports = sync;
