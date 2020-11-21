import { AsyncReturnType, MonitoringMode, SeverityEnum, ShareRootEntryBase } from '../types';
import { ChangeManager } from './change-manager';

import watch from 'node-watch';
import { ensureEndSeparator, isParentOrExact, sleep } from '../utils';

import { statSync } from 'fs';
import { Context } from '../context';


// Check whether monitoring should be enabled for the root
const useMonitoring = (root: ShareRootEntryBase, mode: MonitoringMode) => {
  switch (mode) {
    case MonitoringMode.ALL: return true;
    case MonitoringMode.INCOMING: return root.incoming;
    default: throw new Error(`Unknown monitoring mode ${mode}`);
  }
};

export const WATCH_DELAY_MS = 0;
export const MIN_PATH_MODIFICATION_AGE_MS = 1000;
const FAILED_ROOT_CHECK_INTERVAL_SECONDS = 60;

const watchOptions = {
  delay: WATCH_DELAY_MS,
  recursive: true,
  persistent: false,
};

type WatchPaths = { [key in string]: ReturnType<typeof watch> }

const initWatchers = async (
  { api, getExtSetting, logger }: Context, 
  createWatcher: (path: string, reportErrors: boolean) => Promise<ReturnType<typeof watch> | null>
) => {
  const mode: MonitoringMode = getExtSetting('monitoring_mode');
  const validRoots = (await api.getShareRoots()).filter(root => useMonitoring(root, mode));

  api.postEvent(`Adding ${validRoots.length} paths for monitoring...`, SeverityEnum.INFO);

  const watchPaths: WatchPaths = {};
  for (const root of validRoots) {
    const watcher = await createWatcher(root.path, true);
    if (watcher) {
      watchPaths[root.path] = watcher;
    }
  }

  logger.verbose(`Monitoring started`, Object.keys(watchPaths));
  
  api.postEvent(`${Object.keys(watchPaths).length} paths were added for monitoring`, SeverityEnum.INFO);
  return watchPaths;
};

const getModifiedPathInfo = (path: string, { logger, now }: Context) => {
  try {
    const stat = statSync(path);
    const curTime = now();

    // Change event is fired even when the file/folder is being accessed
    // Check whether the content has actually been changed (ignore this change otherwise)
    // https://github.com/nodejs/node/issues/21643#issuecomment-403716321
    const modifiedMsAgo = curTime - stat.mtimeMs;
    if (modifiedMsAgo > MIN_PATH_MODIFICATION_AGE_MS) {
      return null;
    }

    return {
      isDirectory: stat.isDirectory(),
    };
  } catch (e) {
    logger.verbose(`Skipping change event for path ${path}: ${e.message}`);
    return null;
  }
};

const getDeletedFileInfo = async (path: string, { api, sessionInfo }: Context) => {
  return {
    isDirectory: false,
  };

  // Path notifications have no end separator and we don't know whether if it's a file or a directory
  // Try to check it through the API

  /*if (sessionInfo.system_info.api_feature_level < 6) {
    // There's no shared path check in older API versions
    // Let it through without the end separator even if it's a directory, so that the parent directory will be used for refreshing
    return {
      isDirectory: false,
    }
  }

  // It's a file?
  if (await api.isPathShared(path)) {
    return {
      isDirectory: false,
    }
  }

  // Maybe it's a directory?
  if (await api.isPathShared(ensureEndSeparator(path))) {
    return {
      isDirectory: true,
    }
  }

  // Not shared, ignore
  return null;*/
};

export const Monitor = async (context: Context) => {
  const { logger, api, getExtSetting } = context;
  const changeManager = ChangeManager(context);
  let watchPaths: WatchPaths;
  let failedRoots: string[] = [];
  let failedRootCheckInterval: any;

  // Find root path for a changed file/directory path
  const parseRootPath = (path: string) => {
    return Object.keys(watchPaths).find(rootPath => isParentOrExact(rootPath, path));
  };

  // Watcher error handler
  const onError = (path: string, error: Error) => {
    logger.error(`ERROR ${path}: ${error.message}`, (error as any).code, error);
    api.postEvent(`Error occurred for path ${path}: ${error.message} (removing from monitoring)`, SeverityEnum.ERROR);

    watchPaths[path].close();
    failedRoots = [
      ...failedRoots,
      path,
    ];
  };

  // Watcher close handler
  const onClose = (path: string) => {
    logger.verbose(`Monitoring stopped for path ${path}`);

    const { [path]: deleted, ...newWatchPaths } = watchPaths;
    watchPaths = newWatchPaths;
  };

  // Watcher change handler
  const onChange = async (eventName: 'update' | 'remove', pathRaw: string) => {
    const rootPath = parseRootPath(pathRaw);
    if (!rootPath) {
      logger.error(`No root found for path ${pathRaw}`, Object.keys(watchPaths));
      return;
    }

    logger.verbose(`Path ${pathRaw}: ${eventName} (root ${rootPath})`);

    if (eventName === 'update') {
      const pathInfo = getModifiedPathInfo(pathRaw, context);
      if (!pathInfo) {
        logger.verbose(`Skipping removal event for path ${pathRaw}, not found`);
        return;
      }

      const path = pathInfo.isDirectory ? ensureEndSeparator(pathRaw) : pathRaw;
      changeManager.onPathChanged(path, pathInfo.isDirectory, rootPath);
    } else if (eventName === 'remove') {
      const pathInfo = await getDeletedFileInfo(pathRaw, context);
      if (!pathInfo) {
        return;
      }

      const path = pathInfo.isDirectory ? ensureEndSeparator(pathRaw) : pathRaw;
      changeManager.onPathRemoved(path, pathInfo.isDirectory, rootPath);
    }
  };

  
  const createWatcher = async (path: string, reportErrors: boolean): Promise<ReturnType<typeof watch> | null> => {
    return new Promise((resolve, reject) => {
      try {
        logger.verbose(`Adding path ${path} for monitoring...`);

        const watcher = watch(path, watchOptions);
        watcher
          .on('ready', () => {
            logger.verbose(`Path ${path} was added for monitoring`);
            resolve(watcher);
          })
          .on('change', onChange)
          .on('error', onError.bind(this, path))
          .on('close', onClose.bind(this, path));
      } catch (e) {
        if (reportErrors) {
          api.postEvent(`Failed to add path ${path} for monitoring: ${e.message}`, SeverityEnum.ERROR);
        }

        logger.error(`ERROR ${path}: ${e.message}`);
        resolve(null);
      }
    });
  };

  // Root change event handlers
  const addRoot = async (path: string, reportErrors: boolean) => {
    if (watchPaths[path]) {
      return;
    }

    logger.verbose(`Adding root ${path} for monitoring`);

    const watcher = await createWatcher(path, reportErrors);
    if (watcher) {
      watchPaths = {
        ...watchPaths,
        [path]: watcher,
      };

      return true;
    }

    return false;
  };

  const removeRoot = (path: string) => {
    const watcher = watchPaths[path];
    if (!watcher) {
      return;
    }

    const { [path]: deleted, ...newWatchPaths } = watchPaths;
    watchPaths = newWatchPaths;

    logger.verbose(`Removing root ${path} from monitoring`);
    watcher.close();
  };

  const onRootAdded = (root: ShareRootEntryBase) => {
    if (useMonitoring(root, getExtSetting('monitoring_mode'))) {
      addRoot(root.path, true);
    }
  };

  const onRootRemoved = (root: ShareRootEntryBase) => {
    if (useMonitoring(root, getExtSetting('monitoring_mode'))) {
      removeRoot(root.path);
    }
  };

  const onRootUpdated = (root: ShareRootEntryBase) => {
    if (useMonitoring(root, getExtSetting('monitoring_mode'))) {
      addRoot(root.path, true);
    } else {
      removeRoot(root.path);
    }
  };
  
  // Failed root checker
  const checkFailedRoots = async () => {
    if (!failedRoots.length) {
      return;
    }
    
    for (const p of failedRoots) {
      const added = await addRoot(p, false);
      if (added) {
        failedRoots = failedRoots.filter(r => r !== p);
        api.postEvent(`Path ${p} was re-added for monitoring`, SeverityEnum.INFO);
      }
    }
  };

  // Exports
  const start = () => {
    changeManager.start();
    failedRootCheckInterval = setInterval(checkFailedRoots, FAILED_ROOT_CHECK_INTERVAL_SECONDS * 1000);
  };

  const waitStopped = () => {
    return new Promise<void>(async (resolve, reject) => {
      for (;;) {
        if (!getWatchPaths().length) {
          resolve();
          break;
        }

        await sleep(10);
      }
    })
  };

  const stop = () => {
    changeManager.stop();

    clearInterval(failedRootCheckInterval);
    failedRootCheckInterval = undefined;

    Object.values(watchPaths).forEach(w => w.close());
    return waitStopped();
  };

  const getWatchPaths = () => {
    return Object.keys(watchPaths);
  };

  const getFailedRoots = () => {
    return failedRoots;
  };

  // Init
  watchPaths = await initWatchers(context, createWatcher);
  return {
    onRootAdded,
    onRootRemoved,
    onRootUpdated,

    onError,
    checkFailedRoots,
    getFailedRoots,
    getWatchPaths,

    start,
    stop,

    getStats: changeManager.getStats,
    getPendingChanges: changeManager.getPendingChanges,
    flush: changeManager.flush,
    hasPendingPathChange: changeManager.hasPendingPathChange,
  };
};

export type MonitorType = AsyncReturnType<typeof Monitor>;
