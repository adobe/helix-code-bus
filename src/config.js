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
  IndexConfig,
  MountConfig,
  RedirectConfig,
  MarkupConfig,
} = require('@adobe/helix-shared-config');

/**
 * Config class for head.html
 */
class HeadLoader {
  constructor() {
    this._cfg = {};
    this._log = console;
  }

  withLogger(log) {
    this._log = log;
    return this;
  }

  withSource(src) {
    this._cfg = {
      html: src,
    };
    return this;
  }

  // eslint-disable-next-line class-methods-use-this
  async init() {
    return this;
  }

  toJSON() {
    return this._cfg;
  }
}

/**
 * Configuration files information used to load and generate the aggregate.
 */
const CONFIG_FILES = {
  'fstab.yaml': {
    name: 'fstab',
    Loader: MountConfig,
  },
  'head.html': {
    name: 'head',
    Loader: HeadLoader,
  },
  'helix-query.yaml': {
    name: 'index',
    Loader: IndexConfig,
  },
  'helix-redirects.yaml': {
    name: 'redirect',
    Loader: RedirectConfig,
  },
  'helix-markup.yaml': {
    name: 'markup',
    Loader: MarkupConfig,
  },
};

/**
 * Path of the aggregate config
 * @type {string}
 */
const CONFIG_PATH = 'helix-config.json';

/**
 * Creates and aggregate of the configurations in the given changes object.
 *
 * @param {Logger} log
 * @param {object<string, ProcessedChange>} configChanges
 * @returns {Promise<{}>} the combined config
 */
async function aggregate(log, configChanges) {
  const combined = {};

  // for all config change objects
  await Promise.all(Object.entries(configChanges)
    // filter the ones that don't have data (i.e. don't exist in github)
    .filter(([_, change]) => !!change.data)
    // create the config and add it to the aggregate
    .map(async ([path, change]) => {
      const { name, Loader } = CONFIG_FILES[path];
      try {
        const config = await new Loader()
          .withLogger(log)
          .withSource(change.data.toString('utf-8'))
          .init();

        combined[name] = config.toJSON();
      } catch (e) {
        throw Error(`Unable to create ${name} config from ${path}: ${e.message}`);
      }
    }));

  return combined;
}

module.exports = {
  CONFIG_FILES,
  CONFIG_PATH,
  aggregate,
};
