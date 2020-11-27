import { APISocket } from 'airdcpp-apisocket';

import { SeverityEnum, ShareRootEntryBase } from './types';


export const API = (socket: APISocket) => {
  const getSettingValue = async (settingKey: string) => {
    const ret = await socket.post<{ [key in typeof settingKey]: any; }>(
      'settings/get', { 
        keys: [ settingKey ]
      }
    );

    return ret[settingKey];
  };

  const getShareRoots = async (): Promise<ShareRootEntryBase[]> => {
    return socket.get(
      'share_roots'
    );
  };

  const validateSharePath = async (path: string) => {
    return socket.post(
      'share/validate_path',
      {
        path
      }
    );
  };

  const refreshSharePaths = async (paths: string[]) => {
    return socket.post(
      'share/refresh/paths',
      {
        paths
      }
    );
  };

  const isPathShared = async (path: string) => {
    const result = await socket.post<{ is_shared: boolean }>(
      'share/check_path_shared',
      {
        path
      }
    );

    return result.is_shared;
  };

  const postEvent = async (text: string, severity: SeverityEnum) => {
    return socket.post(
      'events',
      {
        text,
        severity,
      }
    );
  };

  return {
    getSettingValue,
    getShareRoots,
    validateSharePath,
    isPathShared,
    refreshSharePaths,
    postEvent,
  };
};

export type APIType = ReturnType<typeof API>;
