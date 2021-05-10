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

  // check for branch delete or create
  let branchOp;
  const changes = data.changes.filter((change) => {
    if (change.path === '*') {
      branchOp = change;
      return false;
    }
    return true;
  });

  const prefix = `/${data.owner}/${data.repo}/${data.ref}/`;

  // handle branch delete
  if (branchOp && branchOp.type === 'deleted') {
    if (data.ref === 'main' || data.ref === 'master') {
      log.error(`cowardly refusing to delete potential default branch: ${prefix}`);
      return;
    }
    await storage.rmdir(prefix);
    return;
  }

  // handle branch create
  if (branchOp) {
    if (!data.baseRef) {
      log.error(`not base ref for new branch: ${prefix}`);
      return;
    }
    await storage.copy(`/${data.owner}/${data.repo}/${data.baseRef}/`, prefix);
  }

  await processQueue(changes, async (change) => {
    const path = `${prefix}${change.path}`;

    if (change.type === 'deleted') {
      log.info('deleting', path);
      await storage.remove(path);
    } else {
      let body;
      try {
        log.info('fetching from github', path);
        const res = await octokit.repos.getContent({
          owner: data.owner,
          repo: data.repo,
          ref: data.ref,
          path: change.path,
        });
        body = Buffer.from(res.data.content, res.data.encoding);
      } catch (e) {
        log.error(`fetching from github error: ${e.message}`);
        return;
      }
      log.info('uploading', path);
      await storage.put(path, body, change.contentType, {
        'x-commit-id': change.commit,
      });
    }
  });
}

module.exports = sync;
