// SETTINGS
export enum MonitoringMode {
  ALL = 'all',
  INCOMING = 'incoming',
};

export enum ModificationCountMode {
  ANY = 'any',
  DIRECTORY = 'directory',
  DEVICE = 'device',
};

export interface ExtensionSettings {
  modification_count_mode: ModificationCountMode;
  monitoring_mode: MonitoringMode;
  delay_seconds: number;
}

// API
export interface ShareRootEntryBase {
  id: string;
  virtual_name: string;
  path: string;
  incoming: boolean;
}
