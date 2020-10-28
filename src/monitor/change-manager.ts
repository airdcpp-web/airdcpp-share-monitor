import { Context } from '../context';

import { getFilePath } from '../utils';

import * as PathModifyInfo from './path-modify-info';


const CHANGE_PROCESS_INTERVAL_SECONDS = 30;

export const ChangeManager = (context: Context) => {
  const { api, logger, now } = context;

  let totalChanges = 0;

  let modifyInfos: PathModifyInfo.ModifyInfo[] = [];
  let interval: any;

  // Find an existing modify info for the supplied path
  const findModifyInfo = (path: string) => {
    return modifyInfos.find(mi => {
      return path.startsWith(mi.path) || mi.path.startsWith(path);
    });
  };

  // Queue a new change for processing
  const queueChange = (path: string, isDirectory: boolean, rootPath: string) => {
    totalChanges++;

    const directoryPath = isDirectory ? path : getFilePath(path);

    const existingModifyInfo = findModifyInfo(path);
    if (existingModifyInfo) {
      PathModifyInfo.onModified(existingModifyInfo, directoryPath, context);
    } else {
      const newModifyInfo = {
        path: directoryPath,
        rootPath,
        lastModification: now(),
      };

      modifyInfos.push(newModifyInfo);
    };
  }

  // New file/directory was created
  const onPathCreated = (path: string, isDirectory: boolean, rootPath: string) => {
    queueChange(path, isDirectory, rootPath);
  };

  // File/directory was deleted
  const onPathRemoved = async (path: string, isDirectory: boolean, rootPath: string) => {
    if (!await api.isPathShared(path)) {
      logger.verbose(`Skipping removal event for path ${path}, not shared`);
      return;
    }

    queueChange(path, isDirectory, rootPath);
  };

  // Process queued modify infos (if they are ready for it)
  const handlePendingChanges = async (forced = false) => {
    if (!modifyInfos.length) {
      return 0;
    }

    const toHandle = modifyInfos
      .filter(mi => {
        if (forced) {
          return true;
        }

        if (PathModifyInfo.allowProcess(mi, modifyInfos, context)) {
          return true;
        }

        return false;
      });

    if (!!toHandle.length) {
      const reportIgnored = await api.getSettingValue('report_blocked_share');
      for (const mi of toHandle) {
        await PathModifyInfo.process(mi, reportIgnored, context);
      }

      modifyInfos = modifyInfos.filter(mi => toHandle.indexOf(mi) === -1);
    }
    
    logger.verbose(`Flush completed: processed ${toHandle.length} path infos, skipped ${modifyInfos.length} path infos`);
    return toHandle.length;
  };

  // Process queued modify infos
  const flush = (forced: boolean) => {
    return handlePendingChanges(forced);
  };

  // Set the scheduled processing interval
  const start = () => {
    interval = setInterval(handlePendingChanges, CHANGE_PROCESS_INTERVAL_SECONDS * 1000);
  };

  // Stop the scheduled processing interval
  const stop = () => {
    if (interval) {
      clearInterval(interval);
      interval = undefined;
    }
  };

  // Get queued modify infos
  const getPendingChanges = () => {
    return modifyInfos;
  };

  const getStats = () => {
    return {
      totalChanges,
    };
  };

  return {
    getPendingChanges,
    getStats,

    onPathCreated,
    onPathRemoved,

    flush,
    start,
    stop,
  };
};