import { ensureEndSeparator } from '../utils';

import { stat as statCallback } from 'fs';
import { promisify } from 'util';

import { Context } from '../context';


export const MIN_PATH_MODIFICATION_AGE_MS = 1000;


const statAsync = promisify(statCallback);


export const getModifiedPathInfo = async (pathRaw: string, { logger, now, api, sessionInfo }: Context) => {
  try {
    const statRes = await statAsync(pathRaw);
    const curTime = now();

    // Change event is fired even when the file/folder is being accessed
    // Check whether the content has actually been changed (ignore this change otherwise)
    // https://github.com/nodejs/node/issues/21643#issuecomment-403716321
    const modifiedMsAgo = curTime - statRes.mtimeMs;
    if (modifiedMsAgo > MIN_PATH_MODIFICATION_AGE_MS) {
      logger.verbose(`CHANGE, SKIP: path ${pathRaw}, modified ${modifiedMsAgo} ms ago`);
      return null;
    }

    const isDirectory = statRes.isDirectory();
    const path = isDirectory ? ensureEndSeparator(pathRaw) : pathRaw;
    if (sessionInfo.system_info.api_feature_level >= 7) {
      const { bundle } = await api.isPathQueued(path);
      if (bundle && !bundle.completed) {
        logger.verbose(`CHANGE, SKIP: path ${pathRaw}, exists in queue`);
        return null;
      }
    }

    logger.verbose(`CHANGE, ACCEPT: ${isDirectory ? 'directory' : 'file'} ${path}, modified ${modifiedMsAgo} ms ago`);
    return {
      path,
      isDirectory,
    };
  } catch (e) {
    logger.verbose(`CHANGE, ERROR: failed to parse path information ${pathRaw}: ${e.message}`);
    return null;
  }
};

export const getDeletedFileInfo = async (pathRaw: string, { logger, api, sessionInfo }: Context) => {
  // Path notifications have no end separator and we don't know whether if it's a file or a directory
  // Try to check it through the API

  // The watcher library may also trigger weird updates for imaginary paths
  // e.g. running chmod for a path /home/directory will trigger a removal event for /home/directory/directory

  try {
    // It's a file?
    if (await api.isPathShared(pathRaw)) {
      logger.verbose(`DELETE, ACCEPT: file ${pathRaw}`);
      return {
        path: pathRaw,
        isDirectory: false,
      }
    }

    // Maybe it's a directory?
    if (await api.isPathShared(ensureEndSeparator(pathRaw))) {
      logger.verbose(`DELETE, ACCEPT: directory ${pathRaw}`);
      return {
        path: ensureEndSeparator(pathRaw),
        isDirectory: true,
      }
    }
  } catch (e) {
    logger.verbose(`DELETE, ERROR: path ${pathRaw} (API, ${e})`);
    return null;
  }

  // Not shared, ignore
  logger.verbose(`DELETE, IGNORE: path ${pathRaw} (not shared)`);
  return null;
};
