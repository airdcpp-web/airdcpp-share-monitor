import { MonitoringMode, SeverityEnum, ShareRootEntryBase } from '../types';
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

const watchOptions = {
  delay: WATCH_DELAY_MS,
  recursive: true,
  persistent: false,
};

type WatchPaths = { [key in string]: ReturnType<typeof watch> }

const initWatchers = async ({ api, getExtSetting, logger }: Context, createWatcher: (path: string) => ReturnType<typeof watch> | null) => {
  const roots = await api.getShareRoots();

  const mode: MonitoringMode = getExtSetting('monitoring_mode');
  const watchPaths: WatchPaths = {};
  for (const root of roots) {
    if (useMonitoring(root, mode)) {
      const watcher = createWatcher(root.path);
      if (watcher) {
        watchPaths[root.path] = watcher;
      }
    }
  }

  logger.verbose(`Monitoring started`, Object.keys(watchPaths));
  
  logger.info(`${Object.keys(watchPaths).length} paths have been added for monitoring`);
  return watchPaths;
};

const getModifiedPathInfo = (path: string, now: number) => {
  try {
    const stat = statSync(path);

    // Change event is fired even when the file/folder is being accessed
    // Check whether the content has actually been changed (ignore this change otherwise)
    // https://github.com/nodejs/node/issues/21643#issuecomment-403716321
    const modifiedMsAgo = now - stat.mtimeMs;
    const statusChangedMsAgo = now - stat.ctimeMs;
    if (modifiedMsAgo > MIN_PATH_MODIFICATION_AGE_MS && statusChangedMsAgo > MIN_PATH_MODIFICATION_AGE_MS) {
      return null;
    }

    return {
      isDirectory: stat.isDirectory(),
    };
  } catch (e) {
    return null;
  }
};

export const Monitor = async (context: Context) => {
  const { logger, api, getExtSetting } = context;
  const changeManager = ChangeManager(context);

  // Find root path for a changed file/directory path
  const parseRootPath = (path: string) => {
    return Object.keys(watchPaths).find(rootPath => isParentOrExact(rootPath, path));
  };

  // Watcher error handler
  const onError = (error: Error) => {
    logger.error('ERROR: ' + error.message);
    api.postEvent(`Path error: ${error.message}`, SeverityEnum.ERROR);
  };

  // Watcher change handler
  const onChange = (eventName: 'update' | 'remove', pathRaw: string) => {
    const rootPath = parseRootPath(pathRaw);
    if (!rootPath) {
      logger.error(`No root found for path ${pathRaw}`, Object.keys(watchPaths));
      return;
    }

    logger.verbose(`Path ${pathRaw}: ${eventName} (root ${rootPath})`);

    if (eventName === 'update') {
      const pathInfo = getModifiedPathInfo(pathRaw, context.now());
      if (!pathInfo) {
        return;
      }

      const path = pathInfo.isDirectory ? ensureEndSeparator(pathRaw) : pathRaw;
      changeManager.onPathChanged(path, pathInfo.isDirectory, rootPath);
    } else if (eventName === 'remove') {
      // Paths have no end separator, we don't know whether if it's a file or a directory
      // Let it through without the end separator even if it's a directory, so that the parent directory will be used for refreshing
      // TODO: possibly share API could handle existence checks without the end separator so that we could get the type from there
      changeManager.onPathRemoved(pathRaw, true, rootPath);
    }
  };

  
  const createWatcher = (path: string) => {
    try {
      const watcher = watch(path, watchOptions)
        .on('change', onChange)
        .on('error', onError);
      return watcher;
    } catch (e) {
      onError(e);
      return null;
    }
  };

  let watchPaths = await initWatchers(context, createWatcher);

  const addRoot = (root: ShareRootEntryBase) => {
    if (watchPaths[root.path]) {
      return;
    }

    logger.verbose(`Adding root ${root.path} for monitoring`);

    const watcher = createWatcher(root.path);
    if (watcher) {
      watchPaths = {
        ...watchPaths,
        [root.path]: watcher,
      };
    }
  };

  const removeRoot = (root: ShareRootEntryBase) => {
    const watcher = watchPaths[root.path];
    if (!watcher) {
      return;
    }

    const { [root.path]: deleted, ...newWatchPaths } = watchPaths;
    watchPaths = newWatchPaths;

    logger.verbose(`Removing root ${root.path} from monitoring`);
    watcher.close();
  };

  const onRootAdded = (root: ShareRootEntryBase) => {
    if (useMonitoring(root, getExtSetting('monitoring_mode'))) {
      addRoot(root);
    }
  };

  const onRootRemoved = (root: ShareRootEntryBase) => {
    if (useMonitoring(root, getExtSetting('monitoring_mode'))) {
      removeRoot(root);
    }
  };

  const onRootUpdated = (root: ShareRootEntryBase) => {
    if (useMonitoring(root, getExtSetting('monitoring_mode'))) {
      addRoot(root);
    } else {
      removeRoot(root);
    }
  };

  const start = () => {
    changeManager.start();
  };

  const waitStopped = () => {
    return new Promise(async (resolve, reject) => {
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
    Object.values(watchPaths).forEach(w => w.close());
    return waitStopped();
  };

  const getWatchPaths = () => {
    const ret = Object.keys(watchPaths)
      .filter(k => !watchPaths[k].isClosed() && (watchPaths[k] as any)._isReady);

    return ret;
  };

  return {
    onRootAdded,
    onRootRemoved,
    onRootUpdated,
    getWatchPaths,
    start,
    stop,

    getStats: changeManager.getStats,
    getPendingChanges: changeManager.getPendingChanges,
    flush: changeManager.flush,
    hasPendingPathChange: changeManager.hasPendingPathChange,
  };
};