
export const SettingDefinitions = [
  {
    key: 'modification_count_mode',
    title: 'Count the last modification time',
    default_value: 'device',
    type: 'string',
    options: [
      {
        id: 'directory',
        name: 'On per-directory basis'
      }, {
        id: 'device',
        name: 'On per-device basis'
      }, {
        id: 'all',
        name: 'From any modification'
      }, 
    ]
  }, {
    key: 'monitoring_mode',
    title: 'Monitoring mode',
    default_value: 'all',
    type: 'string',
    options: [
      {
        id: 'all',
        name: 'All directories'
      }, {
        id: 'incoming',
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