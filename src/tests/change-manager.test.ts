// import waitForExpect from 'wait-for-expect';
import { writeFileSync } from 'fs';
import path from 'path';

import { getReadyMockMonitor, maybeRemoveFile, triggerFileChange } from './helpers';
import { MOCK_INCOMING_ROOT, MOCK_NORMAL_ROOT } from './mocks/mock-data';
import { MOCK_EXTENSION_SETTINGS } from './mocks/mock-context-defaults';

import { Monitor } from 'src/monitor/monitor';

import { AsyncReturnType, ModificationCountMode } from 'src/types';
import { ensureEndSeparator } from 'src/utils';



describe('Change manager', () => {
  let monitor: AsyncReturnType<typeof Monitor>;

  const filePathIncoming1 = path.join(MOCK_INCOMING_ROOT.path, 'file_incoming1');
  const filePathIncoming2 = path.join(MOCK_INCOMING_ROOT.path, 'file_incoming2');
  const filePathNormal = path.join(MOCK_NORMAL_ROOT.path, 'file_normal');

  afterEach(async () => {
    await monitor.stop();
    
    maybeRemoveFile(filePathIncoming1);
    maybeRemoveFile(filePathIncoming2);
    maybeRemoveFile(filePathNormal);
  });

  test('process directory changes', async () => {
    let curTime = 0;
    jest.useFakeTimers();

    // Init monitor
    monitor = await getReadyMockMonitor({
      settings: {
        ...MOCK_EXTENSION_SETTINGS,
        modification_count_mode: ModificationCountMode.DIRECTORY,
      },
      now: () => curTime
    });

    // Trigger first change
    await triggerFileChange(() => writeFileSync(filePathIncoming1, 'empty'), monitor);

    curTime += 10000;
    jest.advanceTimersByTime(10000);

    // Trigger second change
    await triggerFileChange(() => writeFileSync(filePathNormal, 'empty'), monitor);

    curTime += 20000;
    jest.advanceTimersByTime(20000);

    // Process the first change
    const processed = await monitor.flush(false);

    expect(processed).toBe(1);
    expect(monitor.getPendingChanges().length).toBe(1);
    expect(monitor.getPendingChanges()[0].path).toBe(ensureEndSeparator(MOCK_NORMAL_ROOT.path));
  });
  
  test('process root changes', async () => {
    let curTime = 0;
    jest.useFakeTimers();

    // Init monitor
    monitor = await getReadyMockMonitor({
      settings: {
        ...MOCK_EXTENSION_SETTINGS,
        modification_count_mode: ModificationCountMode.ROOT,
      },
      now: () => curTime
    });

    // Trigger first change
    await triggerFileChange(() => writeFileSync(filePathIncoming1, 'empty'), monitor);

    curTime += 10000;
    jest.advanceTimersByTime(10000);

    // Trigger second change (it will merged with the same path)
    await triggerFileChange(() => writeFileSync(filePathIncoming2, 'empty'), monitor);

    curTime += 20000;
    jest.advanceTimersByTime(20000);

    {
      // Should not get processed yet (not enough time has ellapsed from the second one)
      const processed = await monitor.flush(false);
      expect(processed).toBe(0);
    }

    // This should not get processed
    await triggerFileChange(() => writeFileSync(filePathNormal, 'empty'), monitor);

    curTime += 10000;
    jest.advanceTimersByTime(10000);

    // The merged change should now be processed
    const processed = await monitor.flush(false);

    expect(processed).toBe(1);
    expect(monitor.getPendingChanges().length).toBe(1);
    expect(monitor.getPendingChanges()[0].path).toBe(ensureEndSeparator(MOCK_NORMAL_ROOT.path));
  });
});