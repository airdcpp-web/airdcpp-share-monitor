import path from 'path';

import { writeFileSync, unlinkSync, mkdirSync, rmdirSync } from 'fs';
import { getReadyMockMonitor, maybeRemoveFile, maybeRemoveDirectory, triggerFsChange } from './helpers';
import { MOCK_INCOMING_ROOT, MOCK_NORMAL_ROOT } from './mocks/mock-data';
import { MOCK_EXTENSION_SETTINGS } from './mocks/mock-context-defaults';

import { MonitorType } from 'src/monitor/monitor';

import { ModificationCountMode } from 'src/types';
import { ensureEndSeparator, getFilePath, getParentPath } from 'src/utils';


describe('Change manager', () => {
  let monitor: MonitorType;

  const filePathIncoming1 = path.join(MOCK_INCOMING_ROOT.path, 'file_incoming1');
  const filePathIncoming2 = path.join(MOCK_INCOMING_ROOT.path, 'file_incoming2');
  const filePathNormal = path.join(MOCK_NORMAL_ROOT.path, 'file_normal');

  afterEach(async () => {
    if (monitor) {
      await monitor.stop();
    }
    
    maybeRemoveFile(filePathIncoming1);
    maybeRemoveFile(filePathIncoming2);
    maybeRemoveFile(filePathNormal);
  });

  describe('Change count modes', () => {
    test('process directory changes', async () => {
      let curTime = 0;

      // Init monitor
      monitor = await getReadyMockMonitor({
        settings: {
          ...MOCK_EXTENSION_SETTINGS,
          modification_count_mode: ModificationCountMode.DIRECTORY,
        },
        now: () => curTime
      });

      // Trigger first change
      await triggerFsChange(filePathIncoming1, monitor, writeFileSync, 'empty');

      curTime += 10000;

      // Trigger second change
      await triggerFsChange(filePathNormal, monitor, writeFileSync, 'empty');

      curTime += 20000;

      // Process the first change
      const processed = await monitor.flush(false);

      expect(processed).toBe(1);
      expect(monitor.getPendingChanges().length).toBe(1);
      expect(monitor.getPendingChanges()[0].path).toBe(ensureEndSeparator(MOCK_NORMAL_ROOT.path));
    });
    
    test('process root changes', async () => {
      let curTime = 0;

      // Init monitor
      monitor = await getReadyMockMonitor({
        settings: {
          ...MOCK_EXTENSION_SETTINGS,
          modification_count_mode: ModificationCountMode.ROOT,
        },
        now: () => curTime
      });

      // Trigger first change
      await triggerFsChange(filePathIncoming1, monitor, writeFileSync, 'empty');

      curTime += 10000;

      // Trigger second change (it will merged with the same path)
      await triggerFsChange(filePathIncoming2, monitor, writeFileSync, 'empty');

      curTime += 20000;

      {
        // Should not get processed yet (not enough time has ellapsed from the second one)
        const processed = await monitor.flush(false);
        expect(processed).toBe(0);
      }

      // This should not get processed
      await triggerFsChange(filePathNormal, monitor, writeFileSync, 'empty');

      curTime += 10000;

      // The merged change should now be processed
      const processed = await monitor.flush(false);
      
      expect(processed).toBe(1);
      expect(monitor.getPendingChanges().length).toBe(1);
      expect(monitor.getPendingChanges()[0].path).toBe(ensureEndSeparator(MOCK_NORMAL_ROOT.path));
    });
  });
  
  describe('Change events', () => {
    const newDirPath = path.join(MOCK_INCOMING_ROOT.path, 'newDir', path.sep);
    const newFilePath = path.join(MOCK_INCOMING_ROOT.path, 'newFile');

    afterEach(async () => {
      maybeRemoveFile(newFilePath);
      maybeRemoveDirectory(newDirPath);
    });

    const createMockRefreshMonitor = async () => {
      const mockApiRefresh = jest.fn();
      monitor = await getReadyMockMonitor({
        api: {
          refreshSharePaths: (paths) => {
            mockApiRefresh(paths);
            return Promise.resolve();
          },
        }
      });

      return mockApiRefresh;
    };

    test('handle file creations', async () => {
      // Init
      const mockApiRefresh = await createMockRefreshMonitor();

      // Fire change
      await triggerFsChange(newFilePath, monitor, writeFileSync, 'empty');

      // Process
      await monitor.flush(true);
      expect(mockApiRefresh).toHaveBeenCalledWith([ getFilePath(newFilePath) ]);
    });

    test('handle directory creations', async () => {
      // Init
      const mockApiRefresh = await createMockRefreshMonitor();

      // Fire change
      await triggerFsChange(newDirPath, monitor, mkdirSync);

      // Process
      await monitor.flush(true);
      expect(mockApiRefresh).toHaveBeenCalledWith([ newDirPath ]);
    });

    test('handle file deletions', async () => {
      // Init
      writeFileSync(newFilePath, 'empty');
      const mockApiRefresh = await createMockRefreshMonitor();

      // Fire change
      await triggerFsChange(newFilePath, monitor, unlinkSync);

      // Process
      await monitor.flush(true);
      expect(mockApiRefresh).toHaveBeenCalledWith([ getFilePath(newFilePath) ]);
    });
    
    test('handle directory deletions', async () => {
      // Init
      mkdirSync(newDirPath);
      const mockApiRefresh = await createMockRefreshMonitor();

      // Fire change
      await triggerFsChange(newDirPath, monitor, rmdirSync);

      // Process
      await monitor.flush(true);
      expect(mockApiRefresh).toHaveBeenCalledWith([ getParentPath(newDirPath) ]);
    });
  });
});