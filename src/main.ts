'use strict';

// Entry point for extension-specific code

// Helper method for adding context menu items, docs: https://github.com/airdcpp-web/airdcpp-apisocket-js/blob/master/GUIDE.md#addContextMenuItems
import { APISocket } from 'airdcpp-apisocket';

// Settings manager docs: https://github.com/airdcpp-web/airdcpp-extension-settings-js
//@ts-ignore
import SettingsManager from 'airdcpp-extension-settings';
import { ExtensionEntryData } from 'airdcpp-extension';
import { CONFIG_VERSION, SettingDefinitions } from './settings';

import { Monitor } from './monitor';
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
    const monitor = await Monitor(socket.logger, settings, api);

    socket.addListener('share_roots', 'share_root_created', monitor.onRootAdded);
    socket.addListener('share_roots', 'share_root_removed', monitor.onRootRemoved);
    socket.addListener('share_roots', 'share_root_updated', monitor.onRootUpdated);
  };
};

export default Extension;
