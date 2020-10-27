import waitForExpect from 'wait-for-expect';

import { getMockMonitor, MOCK_SHARE_ROOTS, MOCK_EXTENSION_SETTINGS, MOCK_INCOMING_ROOT, toWatchPaths } from './helpers';
import { Monitor } from 'src/monitor';
import { MonitoringMode } from 'src/types';


type AsyncReturnType<T extends (...args: any) => any> =
	T extends (...args: any) => Promise<infer U> ? U :
	T extends (...args: any) => infer U ? U :
	any

describe('Monitor', () => {
  let monitor: AsyncReturnType<typeof Monitor>;

  afterEach(async () => {
    await monitor.stop();
  });

  test('should watch all root paths', async () => {
    monitor = await getMockMonitor({
      ...MOCK_EXTENSION_SETTINGS,
      monitoring_mode: MonitoringMode.ALL
    });

    await waitForExpect(() => {
      expect(monitor.getWatchPaths()).toEqual(toWatchPaths(MOCK_SHARE_ROOTS));
    }, 1000);
  });

  test('should only watch incoming root paths', async () => {
    monitor = await getMockMonitor({
      ...MOCK_EXTENSION_SETTINGS,
      monitoring_mode: MonitoringMode.INCOMING
    });

    await waitForExpect(() => {
      expect(monitor.getWatchPaths()).toEqual(toWatchPaths([ MOCK_INCOMING_ROOT ]));
    }, 1000);
  });
});