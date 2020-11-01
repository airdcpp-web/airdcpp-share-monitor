import waitForExpect from 'wait-for-expect';

import { MonitorType } from 'src/monitor/monitor';
import { MonitoringMode } from 'src/types';

import { DEFAULT_EXPECT_TIMEOUT, getMockMonitor, getReadyMockMonitor, toWatchPaths } from './helpers';
import { MOCK_DUMMY_DIR_PATH, MOCK_INCOMING_ROOT, MOCK_NORMAL_ROOT, MOCK_SHARE_ROOTS } from './mocks/mock-data';
import { MOCK_EXTENSION_SETTINGS } from './mocks/mock-context-defaults';


const DUMMY_SHARE_ROOT = {
  id: 'dummy',
  path: MOCK_DUMMY_DIR_PATH,
  virtual_name: 'Dummy',
  incoming: false,
};

describe('Monitor', () => {
  let monitor: MonitorType;

  afterEach(async () => {
    if (monitor) {
      await monitor.stop();
    }
  });

  test('should watch all root paths', async () => {
    monitor = await getMockMonitor({
      settings: {
        ...MOCK_EXTENSION_SETTINGS,
        monitoring_mode: MonitoringMode.ALL,
      }
    });

    await waitForExpect(() => {
      expect(monitor.getWatchPaths()).toEqual(toWatchPaths(MOCK_SHARE_ROOTS));
    }, DEFAULT_EXPECT_TIMEOUT);
  });

  test('should only watch incoming root paths', async () => {
    monitor = await getMockMonitor({
      settings: {
        ...MOCK_EXTENSION_SETTINGS,
        monitoring_mode: MonitoringMode.INCOMING,
      }
    });

    await waitForExpect(() => {
      expect(monitor.getWatchPaths()).toEqual(toWatchPaths([ MOCK_INCOMING_ROOT ]));
    }, DEFAULT_EXPECT_TIMEOUT);
  });

  
  test('should start monitoring added roots', async () => {
    monitor = await getReadyMockMonitor();

    monitor.onRootAdded(DUMMY_SHARE_ROOT);

    await waitForExpect(() => {
      expect(monitor.getWatchPaths()).toEqual(toWatchPaths([ 
        ...MOCK_SHARE_ROOTS, 
        DUMMY_SHARE_ROOT 
      ]));
    }, DEFAULT_EXPECT_TIMEOUT);
  });

  test('should remove roots from monitoring', async () => {
    monitor = await getReadyMockMonitor();

    monitor.onRootRemoved(MOCK_NORMAL_ROOT);

    await waitForExpect(() => {
      expect(monitor.getWatchPaths()).toEqual(toWatchPaths([ MOCK_INCOMING_ROOT ]));
    }, DEFAULT_EXPECT_TIMEOUT);
  });
  
  test('should add updated incoming roots for monitoring', async () => {
    monitor = await getMockMonitor({
      settings: {
        ...MOCK_EXTENSION_SETTINGS,
        monitoring_mode: MonitoringMode.INCOMING,
      }
    });

    await waitForExpect(() => {
      expect(monitor.getWatchPaths()).toEqual(toWatchPaths([ MOCK_INCOMING_ROOT ]));
    }, DEFAULT_EXPECT_TIMEOUT);

    monitor.onRootUpdated({
      ...MOCK_NORMAL_ROOT,
      incoming: true,
    });

    await waitForExpect(() => {
      expect(monitor.getWatchPaths()).toEqual(toWatchPaths(MOCK_SHARE_ROOTS));
    }, DEFAULT_EXPECT_TIMEOUT);
  });

  test('should re-add failed roots for monitoring', async () => {
    monitor = await getReadyMockMonitor({
      logger: {
        error: () => {
          // Ignore
        }
      },
    });

    // Simulate error
    monitor.onError(MOCK_NORMAL_ROOT.path, new Error('Mock error'));

    await waitForExpect(() => {
      expect(monitor.getWatchPaths()).toEqual(toWatchPaths([ MOCK_INCOMING_ROOT ]));
    }, DEFAULT_EXPECT_TIMEOUT);
    expect(monitor.getFailedRoots()).toEqual([ MOCK_NORMAL_ROOT.path ]);

    // Re-add for monitoring
    await monitor.checkFailedRoots();

    await waitForExpect(() => {
      expect(monitor.getWatchPaths()).toEqual(toWatchPaths(MOCK_SHARE_ROOTS));
    }, DEFAULT_EXPECT_TIMEOUT);
    expect(monitor.getFailedRoots()).toEqual([]);
  });
});