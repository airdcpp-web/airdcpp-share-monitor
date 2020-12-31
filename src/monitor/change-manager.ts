import { Context } from '../context';

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
  const queueChange = (path: string, isDirectory: boolean, shareRootPath: string, changeType: PathModifyInfo.ChangeType) => {
    totalChanges++;

    const directoryPath = PathModifyInfo.parseModificationInfoDirectoryPath(path, isDirectory, changeType);

    const existingModifyInfo = findModifyInfo(path);
    if (existingModifyInfo) {
      PathModifyInfo.onModified(existingModifyInfo, directoryPath, path, changeType, context);
      // logger.verbose(`Path ${path}: merged into an existing modification info ${existingModifyInfo.path} (${JSON.stringify(existingModifyInfo.changedPaths, null, 2)})`);
    } else {
      const newModifyInfo: PathModifyInfo.ModifyInfo = {
        path: directoryPath,
        shareRootPath,
        lastModification: now(),
        changedPaths: {
          [path]: changeType,
        },
        timeAdded: now(),
        validated: false,
      };

      modifyInfos.push(newModifyInfo);
      // logger.verbose(`Path ${path}: created new modification info ${newModifyInfo.path} (${JSON.stringify(newModifyInfo.changedPaths, null, 2)})`);
    };
  }

  // New file/directory was created
  const onPathChanged = (path: string, isDirectory: boolean, shareRootPath: string) => {
    queueChange(path, isDirectory, shareRootPath, PathModifyInfo.ChangeType.MODIFIED);
  };

  // File/directory was deleted
  const onPathRemoved = async (path: string, isDirectory: boolean, shareRootPath: string) => {
    queueChange(path, isDirectory, shareRootPath, PathModifyInfo.ChangeType.DELETED);
  };

  // Process queued modify infos (if they are ready for it)
  const handlePendingChanges = async (forced = false) => {
    if (!modifyInfos.length) {
      return 0;
    }

    const toProcess = modifyInfos
      .filter(mi => {
        if (forced) {
          return true;
        }

        if (PathModifyInfo.allowProcess(mi, modifyInfos, context)) {
          return true;
        }

        return false;
      });

    if (!!toProcess.length) {
      const reportIgnored = await api.getSettingValue('report_blocked_share');
      for (const mi of toProcess) {
        logger.verbose(`Processing path ${mi.path} (last modification ${context.now() - mi.lastModification} ms ago)`);
        await PathModifyInfo.process(mi, reportIgnored, context);
      }

      modifyInfos = modifyInfos.filter(mi => toProcess.indexOf(mi) === -1);
    }
    
    logger.verbose(`Flush completed: processed ${toProcess.length} path infos, skipped ${modifyInfos.length} path infos`);
    return toProcess.length;
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

  // Check whether changes have been received for a path
  const hasPendingPathChange = (path: string) => {
    const found = modifyInfos.find(mi => mi.path === path || mi.changedPaths[path]);
    return !!found;
  };

  return {
    getPendingChanges,
    hasPendingPathChange,
    getStats,

    onPathChanged,
    onPathRemoved,

    flush,
    start,
    stop,
  };
};