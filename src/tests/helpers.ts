import { Monitor, } from '../monitor/monitor';
import { APIType } from 'src/api';
import { AsyncReturnType, ExtensionSettings, ShareRootEntryBase } from 'src/types';
import { unlinkSync, rmdirSync } from 'fs';
import { Context } from 'src/context';
import { MOCK_API, MOCK_EXTENSION_SETTINGS, MOCK_LOGGER } from './mocks/mock-context-defaults';
import waitForExpect from 'wait-for-expect';
import { MOCK_SHARE_ROOTS } from './mocks/mock-data';
import { sleep } from 'src/utils';


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
  sessionInfo: {
    system_info: {
      api_feature_level: 6,
    }
  }
});

export const getMockMonitor = async (options: MockContextOptions) => {
  const monitor = await Monitor(getMockContext(options));
  return monitor;
};

export const getReadyMockMonitor = async (options: MockContextOptions = {}) => {
  const monitor = await Monitor(getMockContext(options));

  await waitForExpect(() => {
    expect(monitor.getWatchPaths()).toEqual(toWatchPaths(MOCK_SHARE_ROOTS));
  }, DEFAULT_EXPECT_TIMEOUT);

  return monitor;
};

export const toWatchPaths = (roots: ShareRootEntryBase[]) => {
  return [
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

export const maybeRemoveDirectory = (path: string) => {
  try {
    rmdirSync(path);
  } catch (e) {
    // ...
  }
};

type TriggerChange = <ArgsT extends unknown[]>(
  path: string, 
  monitor: AsyncReturnType<typeof Monitor>, 
  func: (path: string, ...args: ArgsT) => void, 
  ...args: ArgsT
) => Promise<void>;

export const triggerFsChange: TriggerChange = async (path, monitor, func, ...args) => {
  func(path, ...args);

  // Wait for the change events to arrive
  await sleep(100);

  await waitForExpect(() => {
    // Directory deletions will be fired without the end separator
    const checkPath = (func as any) === rmdirSync ? path.substr(0, path.length - 1) : path;
    expect(monitor.hasPendingPathChange(checkPath)).toBe(true);
  }, DEFAULT_EXPECT_TIMEOUT);
};
