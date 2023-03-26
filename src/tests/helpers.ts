import { Monitor, } from '../monitor/monitor';
import { APIType } from 'src/api';
import { AsyncReturnType, ExtensionSettings, ShareRootEntryBase } from 'src/types';
import { unlinkSync, rmdirSync } from 'fs';
import { Context } from 'src/context';
import { MOCK_API, MOCK_EXTENSION_SETTINGS, MOCK_LOGGER } from './mocks/mock-context-defaults';
import waitForExpect from 'wait-for-expect';
import { MOCK_SHARE_ROOTS } from './mocks/mock-data';
import { sleep } from 'src/utils';
import { Logger } from 'airdcpp-apisocket';


export const DEFAULT_EXPECT_TIMEOUT = 1500;
export const TEST_API_FEATURE_LEVEL = 7;

const getMockExtSettingGetter = (settings: ExtensionSettings = MOCK_EXTENSION_SETTINGS) => {
  return (key: keyof ExtensionSettings) => {
    return settings[key];
  };
};

interface MockContextOptions {
  settings?: ExtensionSettings;
  api?: Partial<APIType>;
  now?: () => number;
  logger?: Partial<Logger>;
}

export const getMockContext = (options: MockContextOptions): Context => ({
  logger: {
    ...MOCK_LOGGER,
    ...options.logger,
  },
  getExtSetting: getMockExtSettingGetter(options.settings),
  api: {
    ...MOCK_API,
    ...options.api,
  },
  now: options.now || (() => Date.now()),
  sessionInfo: {
    system_info: {
      api_feature_level: TEST_API_FEATURE_LEVEL,
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
    const watchPaths = monitor.getWatchPaths();
    expect(watchPaths).toEqual(toWatchPaths(MOCK_SHARE_ROOTS));
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
    // Directory deletions will be fired for the parent
    const hasPathChange = monitor.hasPendingPathChange(path);
    if (!hasPathChange) {
      expect(path).toBe(true);
    }
  }, DEFAULT_EXPECT_TIMEOUT);
};
