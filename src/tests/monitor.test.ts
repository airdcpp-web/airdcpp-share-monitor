import waitForExpect from 'wait-for-expect';

import { Monitor } from 'src/monitor/monitor';
import { AsyncReturnType, MonitoringMode } from 'src/types';

import { DEFAULT_EXPECT_TIMEOUT, getMockMonitor, toWatchPaths } from './helpers';
import { MOCK_INCOMING_ROOT, MOCK_SHARE_ROOTS } from './mocks/mock-data';
import { MOCK_EXTENSION_SETTINGS } from './mocks/mock-context-defaults';


describe('Monitor', () => {
  let monitor: AsyncReturnType<typeof Monitor>;

  afterEach(async () => {
    await monitor.stop();
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
});