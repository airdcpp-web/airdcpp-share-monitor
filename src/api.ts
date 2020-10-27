import { APISocket } from 'airdcpp-apisocket';

import { ShareRootEntryBase } from './types';


export const API = (socket: APISocket) => {
  const getSettingValue = async (key: string) => {
    const ret = await socket.post(
      'settings/get', { 
        keys: [ key ]
      }
    );

    return ret[0];
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

  return {
    getSettingValue,
    getShareRoots,
    validateSharePath,
    refreshSharePaths,
  };
};

export type APIType = ReturnType<typeof API>;
