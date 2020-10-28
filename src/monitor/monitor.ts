import { MonitoringMode, SeverityEnum, ShareRootEntryBase } from '../types';
import { ChangeManager } from './change-manager';

import { watch, WatchOptions } from 'chokidar';
import { ensureEndSeparator, isParentOrExact } from '../utils';

import { Stats } from 'fs';
import { Context } from '../context';


const useMonitoring = (root: ShareRootEntryBase, mode: MonitoringMode) => {
  return mode === MonitoringMode.ALL || root.incoming;
};

const watchOptions: WatchOptions = {
  ignoreInitial: true,
  alwaysStat: true,
};

const initWatcher = async ({ api, getExtSetting, logger }: Context) => {
  const roots = await api.getShareRoots();

  const mode: MonitoringMode = getExtSetting('monitoring_mode');
  const rootPaths: string[] = [];
  for (const root of roots) {
    if (useMonitoring(root, mode)) {
      rootPaths.push(root.path);
    }
  }

  logger.verbose(`Monitoring started`, rootPaths);
  return {
    watcher: watch(rootPaths, watchOptions),
    rootPaths,
  };
};

export const Monitor = async (context: Context) => {
  const { logger, api, getExtSetting } = context;
  const { watcher, rootPaths } = await initWatcher(context);
  const changeManager = ChangeManager(context);

  const onError = (error: Error) => {
    logger.error('ERROR: ' + error.message);
    api.postEvent(`Path error: ${error.message}`, SeverityEnum.ERROR);
  };

  // Find root path for a changed file/directory path
  const parseRootPath = (path: string) => {
    return rootPaths.find(rootPath => isParentOrExact(rootPath, path));
  };

  const onChange = (eventName: 'add'|'addDir'|'change'|'unlink'|'unlinkDir', pathRaw: string, stats?: Stats) => {
    const isDirectory = eventName === 'addDir' || eventName === 'unlinkDir';
    const path = isDirectory ? ensureEndSeparator(pathRaw) : pathRaw;
    const rootPath = parseRootPath(path);
    if (!rootPath) {
      logger.error(`No root found for path ${path}`, rootPaths);
      return;
    }

    logger.verbose(`Path ${path}: ${eventName} (device ${stats?.dev})`);

    if (eventName === 'add' || eventName === 'addDir') {
      changeManager.onPathCreated(path, isDirectory, rootPath);
    } else if (eventName === 'unlink' || eventName === 'unlinkDir') {
      changeManager.onPathRemoved(path, isDirectory, rootPath);
    }
  };

  watcher.on('all', onChange);
  watcher.on('error', onError);

  const addRoot = (root: ShareRootEntryBase) => {
    const index = rootPaths.indexOf(root.path);
    if (index !== -1) {
      return;
    }

    logger.verbose(`Adding root ${root.path} for monitoring`);
    rootPaths.push(root.path);
    watcher.add(root.path);
  };

  const removeRoot = (root: ShareRootEntryBase) => {
    const index = rootPaths.indexOf(root.path);
    if (index === -1) {
      return;
    }

    logger.verbose(`Removing root ${root.path} from monitoring`);
    rootPaths.splice(index, 1);
    watcher.unwatch(root.path);
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

  const stop = () => {
    changeManager.stop();
    return watcher.close();
  };

  const getWatchPaths = () => {
    const ret = Object.keys(watcher.getWatched());
    return ret;
  };

  // changeManager.start();
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
  };
};