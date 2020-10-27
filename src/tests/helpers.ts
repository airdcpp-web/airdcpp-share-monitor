import { Monitor, } from '../monitor';
import path from 'path';
import { API } from 'src/api';
import { ExtensionSettings, ModificationCountMode, MonitoringMode, ShareRootEntryBase } from 'src/types';


const MOCK_LOGGER = {
  verbose: (...args: any) => {
    // console.log(...args);
  },
  info: (...args: any) => {
    // console.info(...args);
  },
  warn: (...args: any) => {
    console.warn(...args);
  },
  error: (...args: any) => {
    console.error(...args);
  },
};

export const MOCK_INCOMING_ROOT = {
  id: 'incoming',
  virtual_name: 'Incoming',
  path: path.join(__dirname, 'data', 'incoming'),
  incoming: true,
};

export const MOCK_NORMAL_ROOT = {
  id: 'normal',
  virtual_name: 'Normal',
  path: path.join(__dirname, 'data', 'normal'),
  incoming: false,
};

export const MOCK_SHARE_ROOTS = [
  MOCK_INCOMING_ROOT,
  MOCK_NORMAL_ROOT,
];

const getMockSettingsHandler = (settings: ExtensionSettings) => ({
  getValue: (key: string) => {
    return settings[key];
  },
});

export const MOCK_EXTENSION_SETTINGS: ExtensionSettings = {
  modification_count_mode: ModificationCountMode.DEVICE,
  monitoring_mode: MonitoringMode.INCOMING,
  delay_seconds: 30,
};

export const getMockMonitor = async (settings: ExtensionSettings = MOCK_EXTENSION_SETTINGS) => {
  const api: ReturnType<typeof API> = {
    getSettingValue: (key) => {
      if (key === 'report_blocked_share') {
        return Promise.resolve(true);
      }

      return Promise.reject('Setting key not supported');
    },
    getShareRoots: () => {
      return Promise.resolve(MOCK_SHARE_ROOTS);
    },
    refreshSharePaths: () => {
      return Promise.resolve();
    },
    validateSharePath: () => {
      return Promise.resolve();
    }
  }

  const monitor = await Monitor(MOCK_LOGGER, getMockSettingsHandler(settings), api);
  return monitor;
};

// Chokidar will also watch the root dir
export const toWatchPaths = (roots: ShareRootEntryBase[]) => {
  return [
    path.join(__dirname, 'data'),
    ...roots.map(r => r.path),
  ]
};
