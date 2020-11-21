import { ensureEndSeparator } from '../utils';

import { statSync } from 'fs';
import { Context } from '../context';


export const MIN_PATH_MODIFICATION_AGE_MS = 1000;

// const formatType = (isDirectory: boolean) => isDirectory ? 'directory' : 'file';

/*enum ChangeType {
  CHANGE = 'CHANGE',
  REMOVE = 'REMOVE',
};

enum ActionType {
  ACCEPT,
  IGNORE,
  ERROR,
};

const formatLabel = (changeType: ChangeType, actionType: ActionType) => {

};*/

export const getModifiedPathInfo = (path: string, { logger, now }: Context) => {
  try {
    const stat = statSync(path);
    const curTime = now();

    // Change event is fired even when the file/folder is being accessed
    // Check whether the content has actually been changed (ignore this change otherwise)
    // https://github.com/nodejs/node/issues/21643#issuecomment-403716321
    const modifiedMsAgo = curTime - stat.mtimeMs;
    if (modifiedMsAgo > MIN_PATH_MODIFICATION_AGE_MS) {
      logger.verbose(`CHANGE, SKIP: path ${path}, modified ${modifiedMsAgo} ago`);
      return null;
    }

    const isDirectory = stat.isDirectory();
    logger.verbose(`CHANGE, ACCEPT: ${isDirectory ? 'directory' : 'file'} ${path}, modified ${modifiedMsAgo} ms ago`);
    return {
      isDirectory,
    };
  } catch (e) {
    logger.verbose(`CHANGE, ERROR: failed to stat the path ${path}: ${e.message}`);
    return null;
  }
};

export const getDeletedFileInfo = async (path: string, { logger, api, sessionInfo }: Context) => {
  // Path notifications have no end separator and we don't know whether if it's a file or a directory
  // Try to check it through the API

  // The watcher library may also trigger weird updates for imaginary paths
  // e.g. running chmod for a path /home/directory will trigger a removal event for /home/directory/directory

  if (sessionInfo.system_info.api_feature_level < 6) {
    // There's no shared path check in older API versions
    // Let it through without the end separator even if it's a directory, so that the parent directory will be used for refreshing
    logger.verbose(`DELETE, ACCEPT: legacy path ${path} (type unknown)`);
    return {
      isDirectory: false,
    }
  }

  try {
    // It's a file?
    if (await api.isPathShared(path)) {
      logger.verbose(`DELETE, ACCEPT: file ${path}`);
      return {
        isDirectory: false,
      }
    }

    // Maybe it's a directory?
    if (await api.isPathShared(ensureEndSeparator(path))) {
      logger.verbose(`DELETE, ACCEPT: directory ${path}`);
      return {
        isDirectory: true,
      }
    }
  } catch (e) {
    logger.verbose(`DELETE, ERROR: path ${path} (API, ${e})`);
    return null;
  }

  // Not shared, ignore
  logger.verbose(`DELETE, IGNORE: path ${path} (not shared)`);
  return null;
};
