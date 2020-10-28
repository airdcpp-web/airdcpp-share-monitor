import { Monitor, } from '../monitor/monitor';
import path from 'path';
import { APIType } from 'src/api';
import { AsyncReturnType, ExtensionSettings, ShareRootEntryBase } from 'src/types';
import { unlinkSync } from 'fs';
import { Context } from 'src/context';
import { MOCK_API, MOCK_EXTENSION_SETTINGS, MOCK_LOGGER } from './mocks/mock-context-defaults';
import waitForExpect from 'wait-for-expect';
import { MOCK_SHARE_ROOTS } from './mocks/mock-data';


export const DEFAULT_EXPECT_TIMEOUT = 1500;

const getMockExtSettingGetter = (settings: ExtensionSettings = MOCK_EXTENSION_SETTINGS) => {
  return (key: string) => {
    return settings[key];
  };
};

interface MockContextOptions {
  settings?: ExtensionSettings;
  api?: Partial<APIType>;
  now?: () => number;
}

export const getMockContext = (options: MockContextOptions): Context => ({
  logger: MOCK_LOGGER,
  getExtSetting: getMockExtSettingGetter(options.settings),
  api: {
    ...MOCK_API,
    ...options.api,
  },
  now: options.now || (() => Date.now()),
});

export const getMockMonitor = async (options: MockContextOptions) => {
  const monitor = await Monitor(getMockContext(options));
  return monitor;
};

export const getReadyMockMonitor = async (options: MockContextOptions) => {
  const monitor = await Monitor(getMockContext(options));
  
  await waitForExpect(() => {
    expect(monitor.getWatchPaths()).toEqual(toWatchPaths(MOCK_SHARE_ROOTS));
  }, DEFAULT_EXPECT_TIMEOUT);

  return monitor;
};


// Chokidar will also watch the root dir
export const toWatchPaths = (roots: ShareRootEntryBase[]) => {
  return [
    path.join(__dirname, 'mocks', 'data'),
    ...roots.map(r => r.path),
  ]
};

export const maybeRemoveFile = (path: string) => {
  try {
    unlinkSync(path);
  } catch (e) {
    // ...
  }
};

export const triggerFileChange = async (change: () => void, monitor: AsyncReturnType<typeof Monitor>) => {
  const initialChangeCount = monitor.getStats().totalChanges;
  change();

  await waitForExpect(() => {
    expect(monitor.getStats().totalChanges).toBe(initialChangeCount + 1);
  }, DEFAULT_EXPECT_TIMEOUT);
};
