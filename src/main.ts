'use strict';

// Entry point for extension-specific code

// Helper method for adding context menu items, docs: https://github.com/airdcpp-web/airdcpp-apisocket-js/blob/master/GUIDE.md#addContextMenuItems
import { addContextMenuItems, APISocket } from 'airdcpp-apisocket';

// Settings manager docs: https://github.com/airdcpp-web/airdcpp-extension-settings-js
//@ts-ignore
import SettingsManager from 'airdcpp-extension-settings';
import { ExtensionEntryData } from 'airdcpp-extension';
import { CONFIG_VERSION, SettingDefinitions } from './settings';

import { Monitor } from './monitor/monitor';
import { API } from './api';


interface SessionInfo {
  system_info: {
    path_separator: string;
  }
}

// Entry point docs: https://github.com/airdcpp-web/airdcpp-extension-js#extension-entry-structure
// Socket reference: https://github.com/airdcpp-web/airdcpp-apisocket-js/blob/master/GUIDE.md
const Extension = function (socket: APISocket, extension: ExtensionEntryData) {
  const settings = SettingsManager(socket, {
    extensionName: extension.name, 
    configFile: extension.configPath + 'config.json',
    configVersion: CONFIG_VERSION,
    definitions: SettingDefinitions,
  });

  extension.onStart = async (sessionInfo: SessionInfo) => {
    await settings.load();

    const api = API(socket);
    const monitor = await Monitor({
      logger: socket.logger, 
      getExtSetting: settings.getValue,
      api,
      now: Date.now
    });

    monitor.start();

    socket.addListener('share_roots', 'share_root_created', monitor.onRootAdded);
    socket.addListener('share_roots', 'share_root_removed', monitor.onRootRemoved);
    socket.addListener('share_roots', 'share_root_updated', monitor.onRootUpdated);

    const subscriberInfo = {
      id: extension.name,
      name: 'Share monitor',
    };
    
    addContextMenuItems(
      socket,
      [
        {
          id: 'scan_missing_extra',
          title: `Process pending changes`,
          icon: {
            semantic: 'green checkmark'
          },
          filter: () => !!monitor.getPendingChanges().length,
          onClick: () => monitor.flush(true),
        }
      ],
      'extension',
      subscriberInfo,
    );
  };
};

export default Extension;
