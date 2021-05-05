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
const wrap = require('@adobe/helix-shared-wrap');
const { cleanupHeaderValue } = require('@adobe/helix-shared-utils');
const { logger } = require('@adobe/helix-universal-logger');
const { wrap: status } = require('@adobe/helix-status');
const { Response } = require('@adobe/helix-universal');
const sync = require('./sync.js');

/**
 * This is the main function
 * @param {Request} req the request object (see fetch api)
 * @param {UniversalContext} ctx the context of the universal serverless function
 * @returns {Response} a response
 */
async function main(req, ctx) {
  const { log } = ctx;
  if (req.method !== 'POST') {
    return new Response('', {
      status: 405,
    });
  }
  try {
    // create response in order to retrieve the json body
    const tmp = new Response(req.body, {
      headers: {
        'content-type': req.headers.get('content-type'),
      },
    });
    let payload;
    try {
      payload = await tmp.json();
    } catch (e) {
      log.warn('error while parsing json', e);
      return new Response('', {
        status: 400,
        headers: {
          'x-error': 'reject no json body',
        },
      });
    }
    console.log(payload);

    ctx.env.GH_TOKEN = req.headers.get('x-github-token');
    await sync(payload, ctx);

    return new Response('', {
      status: 204,
    });
  } catch (e) {
    log.error('error while processing event', e);
    return new Response('', {
      status: 500,
      headers: {
        'x-error': cleanupHeaderValue(e.message),
      },
    });
  }
}

module.exports.main = wrap(main)
  .with(status)
  .with(logger);
