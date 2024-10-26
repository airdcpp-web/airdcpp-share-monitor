import { AsyncReturnType, MonitoringMode, SeverityEnum, ShareRootEntryBase } from '../types';
import { ChangeManager } from './change-manager';

import { Stats } from 'fs';
import { stat } from 'fs/promises';
import { sleep } from '../utils';
import { extname } from 'path';

import { Context } from '../context';
import { getDeletedFileInfo, getModifiedPathInfo } from './change-type-parser';
import { normalizeChangePath, USE_THIRD_PARTY_WATCH, watch } from './watch';


// Check whether monitoring should be enabled for the root
const useMonitoring = (root: ShareRootEntryBase, mode: MonitoringMode) => {
  switch (mode) {
    case MonitoringMode.ALL: return true;
    case MonitoringMode.INCOMING: return root.incoming;
    default: throw new Error(`Unknown monitoring mode ${mode}`);
  }
};

export const WATCH_DELAY_MS = 0;
const FAILED_ROOT_CHECK_INTERVAL_SECONDS = 60;

const watchOptions = {
  delay: WATCH_DELAY_MS,
  recursive: true,
  persistent: false,
};

type WatchPaths = { [key in string]: ReturnType<typeof watch> }

type CreateWatcherHandler = (path: string, reportErrors: boolean) => Promise<ReturnType<typeof watch> | null>;

const alwaysIgnoreFile = (pathRaw: string) => {
  if (extname(pathRaw) === '.dctmp') {
    return true;
  }

  return false;
}

export const Monitor = async (context: Context) => {
  const { logger, api, getExtSetting } = context;
  const changeManager = ChangeManager(context);
  let watchPaths: WatchPaths = {};
  let failedRoots: string[] = [];
  let failedRootCheckInterval: any;

  // Watcher error handler
  const onWatcherError = (path: string, error: Error) => {
    logger.error(`ERROR: path ${path} (${error.message})`, error);
    api.postEvent(`Error occurred for path ${path}: ${error.message} (removing from monitoring)`, SeverityEnum.ERROR);

    if (watchPaths[path]) { // It may fail on init
      watchPaths[path].close();
    }
  
    failedRoots = [
      ...failedRoots,
      path,
    ];
  };

  // Watcher close handler
  const onWatcherClose = (path: string) => {
    logger.verbose(`Monitoring stopped for path ${path}`);

    const { [path]: deleted, ...newWatchPaths } = watchPaths;
    watchPaths = newWatchPaths;
  };

  // Watcher change handler
  const onWatcherChange = async (rootPath: string, eventName: 'update' | 'remove', pathRaw: string | null) => {
    const path = normalizeChangePath(rootPath, pathRaw);
    if (alwaysIgnoreFile(path)) {
      return;
    }

    try {
      const stats = await stat(path);
      await onChanged(stats, rootPath, path);
    } catch (e: unknown) {
      // Report unknown errors
      if (e instanceof Error) {
        const error: NodeJS.ErrnoException = e;
        if (error.code !== 'ENOENT') {
          logger.error(`${eventName.toLocaleUpperCase()}, ERROR: stats failed for ${path} (${error.code}, ${error.message})`);
        }
      }

      // Doesn't exist on disk
      await onRemoved(rootPath, path);
    }
  };

  const onChanged = async (stats: Stats, rootPath: string, pathRaw: string) => {
    const pathInfo = await getModifiedPathInfo(stats, pathRaw, context);
    if (!pathInfo) {
      return;
    }

    changeManager.onPathChanged(pathInfo.path, pathInfo.isDirectory, rootPath);
  };

  const onRemoved = async (rootPath: string, pathRaw: string) => {
    const pathInfo = await getDeletedFileInfo(pathRaw, context);
    if (!pathInfo) {
      return;
    }

    changeManager.onPathRemoved(pathInfo.path, pathInfo.isDirectory, rootPath);
  };

  // Create watcher for a share root path
  const createWatcher: CreateWatcherHandler = async (path, reportErrors) => {
    return new Promise((resolve, reject) => {
      try {
        logger.verbose(`Adding path ${path} for monitoring...`);

        const watcher = watch(path, watchOptions);
        watcher
          .on('ready', () => {
            logger.verbose(`Path ${path} was added for monitoring`);
            resolve(watcher);
          })
          .on('change', onWatcherChange.bind(this, path))
          .on('error', onWatcherError.bind(this, path))
          .on('close', onWatcherClose.bind(this, path));

        // No 'ready' event in node
        if (!USE_THIRD_PARTY_WATCH) {
          resolve(watcher);
        }
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


  // Add initial watchers for the share roots
  const initWatchers = async (
    { api, getExtSetting, logger }: Context
  ) => {
    // Get roots
    const mode: MonitoringMode = getExtSetting('monitoring_mode');
    const validRoots = (await api.getShareRoots()).filter(root => useMonitoring(root, mode));
    if (!validRoots.length) {
      logger.verbose(`No roots were added for monitoring`);
    }
  
    // Add watchers
    api.postEvent(`Adding ${validRoots.length} paths for monitoring...`, SeverityEnum.INFO);
  
    for (const root of validRoots) {
      const watcher = await createWatcher(root.path, true);
      if (watcher) {
        // Add in watch paths immediately so that the change events can be processed
        watchPaths = {
          ...watchPaths,
          [root.path]: watcher,
        };
      }
    }
    
    api.postEvent(`${Object.keys(watchPaths).length} paths were added for monitoring`, SeverityEnum.INFO);
    logger.verbose(`Monitoring started`, Object.keys(watchPaths));
  };

  // Init
  await initWatchers(context);
  return {
    onRootAdded,
    onRootRemoved,
    onRootUpdated,

    onError: onWatcherError,
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
