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

/**
 * change type
 */
declare enum ChangeType {
  added = 'added',
  deleted = 'deleted',
  modified = 'modified',
}

/**
 * A change event sent from helix-bot
 */
declare interface Change {
  /**
   * type of change
   */
  type: ChangeType,

  /**
   * Relative path of changed resource or `*` if this as a branch event.
   */
  path: string,

  /**
   * timestamp of change
   */
  time: number,

  /**
   * commit sha of change
   */
  commit?: string,
}

declare interface ProcessedChange extends Change {
  /**
   * Data of file.
   */
  data?: Buffer,
}

declare interface HelixBotEvent {
  /**
   * event type source
   * @default 'github'
   */
  type: string,

  /**
   * github app installation id
   */
  installationId: string,

  /**
   * repository owner
   */
  owner: string,

  /**
   * repository name
   */
  repo: string,

  /**
   * repository ref
   */
  ref: string,

  /**
   * base ref for branch operations
   */
  baseRef?: string,

  /**
   * array of changes
   */
  changes: Change[],
}
