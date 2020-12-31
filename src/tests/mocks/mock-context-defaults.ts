import { APIType } from 'src/api';
import { ExtensionSettings, ModificationCountMode, MonitoringMode } from 'src/types';
import { MOCK_SHARE_ROOTS } from './mock-data';

export const MOCK_LOGGER = {
  verbose: (...args: any) => {
    if (process.env.DEBUG) {
      console.log(...args);
    }
  },
  info: (...args: any) => {
    if (process.env.DEBUG) {
      console.info(...args);
    }
  },
  warn: (...args: any) => {
    console.warn(...args);
  },
  error: (...args: any) => {
    console.error(...args);
  },
};

export const MOCK_EXTENSION_SETTINGS: ExtensionSettings = {
  modification_count_mode: ModificationCountMode.ROOT,
  monitoring_mode: MonitoringMode.ALL,
  delay_seconds: 30,
};

export const MOCK_API: APIType = {
  getSettingValue: (key) => {
    if (key === 'report_blocked_share') {
      return Promise.resolve(true);
    }

    return Promise.reject('Setting key not supported');
  },
  getShareRoots: () => {
    return Promise.resolve(MOCK_SHARE_ROOTS);
  },
  refreshSharePaths: (paths) => {
    return Promise.resolve();
  },
  validateSharePath: (path) => {
    return Promise.resolve();
  },
  isPathShared: (path) => {
    return Promise.resolve(true);
  },
  isPathQueued: (path) => {
    return Promise.resolve({
      bundle: undefined,
    });
  },
  postEvent: (text, severity) => {
    return Promise.resolve();
  },
}
