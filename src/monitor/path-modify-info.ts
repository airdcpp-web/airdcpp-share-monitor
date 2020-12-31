import { ErrorResponse } from 'airdcpp-apisocket';
import { Context } from '../context';
import { ModificationCountMode, SeverityEnum } from '../types';

import { getFilePath, getParentPath, isSub } from '../utils';


export enum ChangeType {
  DELETED = 'deleted',
  MODIFIED = 'modified',
};
export interface ModifyInfo {
  path: string;
  shareRootPath: string;
  lastModification: number;
  changedPaths: Record<string, ChangeType>;
  timeAdded: number;
  validated: boolean;
}


// Parse directory path for ModifyInfo
export const parseModificationInfoDirectoryPath = (path: string, isDirectory: boolean, changeType: ChangeType) => {
  if (!isDirectory) {
    // File
    return getFilePath(path);
  }

  // Directory
  return changeType === ChangeType.DELETED ? getParentPath(path) : path;
};

// New change was made to an existing modify info directory
export const onModified = (mi: ModifyInfo, directoryPath: string, path: string, changeType: ChangeType, { now }: Context) => {
  if (isSub(mi.path, directoryPath)) {
    mi.path = directoryPath;
  }

  mi.lastModification = now();

  // Add this path
  mi.changedPaths = {
    ...mi.changedPaths,
    [path]: changeType,
  };

  return true;
};

// Check if enough time has ellapsed since the last modification
const checkModificationDelay = (delaySeconds: number, now: number) => {
  return (mi: ModifyInfo) => {
    const allowProcessTime = mi.lastModification + (delaySeconds * 1000);
    const ret = now >= allowProcessTime;
    return ret;
  };
};

// Check whether the supplied modify info can be processed
export const allowProcess = (mi: ModifyInfo, allModifyInfos: ModifyInfo[], { now, getExtSetting }: Context) => {
  const curTime = now();
  const countMode: ModificationCountMode = getExtSetting('modification_count_mode');
  const delaySeconds: number = getExtSetting('delay_seconds');

  if (countMode === ModificationCountMode.ROOT) {
    const ok = allModifyInfos
      .filter(other => other.shareRootPath === mi.shareRootPath)
      .every(checkModificationDelay(delaySeconds, curTime));

    if (!ok) {
      return false;
    }
  } else if (countMode === ModificationCountMode.DIRECTORY) {
    if (!checkModificationDelay(delaySeconds, curTime)(mi)) {
      return false;
    }
  } else if (countMode === ModificationCountMode.ANY) {
    const ok = allModifyInfos.every(checkModificationDelay(delaySeconds, curTime));
    if (!ok) {
      return false;
    }
  } else {
    throw new Error(`Unknown modification count mode ${countMode}`);
  }

  return true;
}

// Process a modify info
export const process = async (mi: ModifyInfo, reportIgnored: boolean, { api, logger }: Context) => {
  try {
    await api.refreshSharePaths([ mi.path ]);
  } catch (e) {
    const error: ErrorResponse = e;
    logger.warn(`Could not refresh the path ${mi.path}: ${error.message}`);

    if (reportIgnored && error.code === 403) {
      api.postEvent(`Could not refresh the path ${mi.path}: ${error.message}`, SeverityEnum.WARNING);
    }
  }
};