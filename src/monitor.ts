import { Logger } from 'airdcpp-apisocket';
import { MonitoringMode, ShareRootEntryBase } from './types';
import { API } from './api';
import { ChangeManager } from './change-manager';

import { watch, WatchOptions } from 'chokidar';

// import { Stats } from 'fs';


const useMonitoring = (root: ShareRootEntryBase, mode: MonitoringMode) => {
  return mode === MonitoringMode.ALL || root.incoming;
};

const watchOptions: WatchOptions = {
  ignoreInitial: true,
};

const initWatcher = async (logger: Logger, settings: any, api: ReturnType<typeof API>) => {
  const roots = await api.getShareRoots();

  const mode: MonitoringMode = settings.getValue('monitoring_mode');
  const paths: string[] = [];
  for (const root of roots) {
    if (useMonitoring(root, mode)) {
      paths.push(root.path);
    }
  }

  logger.verbose(`Monitoring started`, paths);
  return watch(paths, watchOptions);
};

export const Monitor = async (logger: Logger, settings: any, api: ReturnType<typeof API>) => {
  const watcher = await initWatcher(logger, settings, api);
  const changeManager = ChangeManager(logger, settings, api);

  const onError = (error: Error) => {
    logger.error('ERROR: ' + error.message);
  };

  watcher.on('all', changeManager.onChange);
  watcher.on('error', onError);


  const onRootAdded = (root: ShareRootEntryBase) => {
    if (useMonitoring(root, settings.getValue('monitoring_mode'))) {
      logger.verbose(`Adding new root ${root.path} for monitoring`);
      watcher.add(root.path);
    }
  };

  const onRootRemoved = (root: ShareRootEntryBase) => {
    if (useMonitoring(root, settings.getValue('monitoring_mode'))) {
      logger.verbose(`Removing root ${root.path} from monitoring`);
      watcher.unwatch(root.path);
    }
  };

  const onRootUpdated = (root: ShareRootEntryBase) => {
    if (useMonitoring(root, settings.getValue('monitoring_mode'))) {
      logger.verbose(`Adding an updated root ${root.path} for monitoring`);
      watcher.add(root.path);
    } else {
      logger.verbose(`Removing an updated root ${root.path} from monitoring`);
      watcher.unwatch(root.path);
    }
  };

  const stop = () => {
    return watcher.close();
  };

  const getWatchPaths = () => {
    const ret = Object.keys(watcher.getWatched());
    return ret;
  };

  return {
    onRootAdded,
    onRootRemoved,
    onRootUpdated,
    getWatchPaths,
    stop,
  };
};