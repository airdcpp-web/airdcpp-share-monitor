import { ensureEndSeparator } from '../utils';

import { Stats } from 'fs';

import { Context } from '../context';


export const MIN_PATH_MODIFICATION_AGE_MS = 1000;


// Find the latest modification time (mtime may not be updated when copying)
const parseModifiedMsAgo = (stats: Stats, now: number) => {
  const dates = [stats.mtime.getTime(), stats.ctime.getTime()]

  // Birth time may not be available on all systems
  if (stats.birthtime.getTime() > 0) {
    dates.push(stats.birthtime.getTime());
  }

  const modificationTime = Math.max(...dates);
  return now - modificationTime;
}

export const getModifiedPathInfo = async (stats: Stats, pathRaw: string, { logger, now, api, sessionInfo }: Context) => {
  // Change event is fired even when the file/folder is being accessed
  // Check whether the content has actually been changed (ignore this change otherwise)
  // https://github.com/nodejs/node/issues/21643#issuecomment-403716321
  const modifiedMsAgo = parseModifiedMsAgo(stats, now());
  if (modifiedMsAgo > MIN_PATH_MODIFICATION_AGE_MS) {
    logger.verbose(`CHANGE, SKIP: path ${pathRaw}, modified ${modifiedMsAgo} ms ago`);
    return null;
  }

  const isDirectory = stats.isDirectory();
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
