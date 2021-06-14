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
const { aggregate, CONFIG_FILES, CONFIG_PATH } = require('./config.js');

/**
 * Processes the helix bot changes and sync the content with the code-bus
 * @param {HelixBotEvent} data helix bot event data
 * @param {UniversalContext} ctx context
 * @returns {Promise<void>}
 */
async function sync(data, ctx) {
  const { log, env, storage } = ctx;
  const { GH_TOKEN } = env;

  const octokit = new Octokit({
    auth: `token ${GH_TOKEN}`,
    log,
  });

  // check for branch delete or create and config changes
  let branchOp;
  let configChanges;
  let configSha = '';
  const changes = data.changes.filter((change) => {
    if (change.path === '*') {
      branchOp = change;
      return false;
    }
    if (CONFIG_FILES[change.path]) {
      if (!configChanges) {
        configChanges = {};
      }
      configChanges[change.path] = change;
      if (!configSha) {
        configSha = change.commit;
      }
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

  // add missing config change if needed
  if (configChanges) {
    Object.keys(CONFIG_FILES).forEach((path) => {
      if (!configChanges[path]) {
        const change = {
          path,
          type: 'nop',
        };
        configChanges[path] = change;
        changes.push(change);
      }
      configChanges[path].retainData = true;
    });
  }

  await processQueue(changes,
    /**
     * Processes the change
     * @param {Change} change
     * @returns {Promise<void>}
     */
    async (change) => {
      const path = `${prefix}${change.path}`;
      if (change.type === 'deleted') {
        try {
          log.info(`removing ${path} from storage`);
          await storage.remove(path);
        } catch (e) {
          log.error(`removing ${path} from storage failed: ${e.message}`);
        }
      } else {
        let body;
        try {
          log.info(`fetching ${path} from github`);
          const res = await octokit.repos.getContent({
            owner: data.owner,
            repo: data.repo,
            ref: data.ref,
            path: change.path,
          });
          body = Buffer.from(res.data.content, res.data.encoding);
        } catch (e) {
          if (change.type === 'nop') {
            log.info(`fetching ${path} from github failed: ${e.message}`);
            return;
          }
          log.error(`fetching ${path} from github error: ${e.message}`);
          return;
        }
        // retain data for config
        if (change.retainData) {
          // eslint-disable-next-line no-param-reassign
          change.data = body;
        }
        if (change.type !== 'nop') {
          try {
            log.info(`uploading ${path} to storage`);
            await storage.put(path, body, change.contentType, {
              'x-commit-id': change.commit,
            });
          } catch (e) {
            log.error(`uploading ${path} to storage failed: ${e.message}`);
          }
        }
      }
    });

  // process and upload config
  if (configChanges) {
    try {
      const body = JSON.stringify(await aggregate(log, configChanges), null, 2);
      const path = `${prefix}${CONFIG_PATH}`;
      log.info('uploading', path);
      await storage.put(path, body, 'application/json', {
        'x-commit-id': configSha,
      }, false);
    } catch (e) {
      log.error(`Unable to process combined config: ${e.message}`);
    }
  }
}

module.exports = sync;
