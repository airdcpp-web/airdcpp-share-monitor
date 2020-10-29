import { ModificationCountMode, MonitoringMode } from './types';

export const SettingDefinitions = [
  {
    key: 'modification_count_mode',
    title: 'Count the last modification time',
    default_value: ModificationCountMode.ROOT,
    type: 'string',
    options: [
      {
        id: ModificationCountMode.DIRECTORY,
        name: 'On per-directory basis'
      }, {
        id: ModificationCountMode.ROOT,
        name: 'On per-root basis'
      }, {
        id: ModificationCountMode.ANY,
        name: 'From any modification'
      }, 
    ]
  }, {
    key: 'monitoring_mode',
    title: 'Monitoring mode',
    default_value: MonitoringMode.ALL,
    type: 'string',
    options: [
      {
        id: MonitoringMode.ALL,
        name: 'All directories'
      }, {
        id: MonitoringMode.INCOMING,
        name: 'Incoming directories only'
      }, 
    ]
  }, {
    key: 'delay_seconds',
    title: 'Minimum time since the last modification before processing the changes',
    unit: 'seconds',
    default_value: 30,
    type: 'number'
  }
];

export const CONFIG_VERSION = 1;