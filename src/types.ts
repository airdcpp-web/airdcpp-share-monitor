// SETTINGS
export enum MonitoringMode {
  ALL = 'all',
  INCOMING = 'incoming',
};

export enum ModificationCountMode {
  ANY = 'any',
  DIRECTORY = 'directory',
  ROOT = 'root',
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

export const enum SeverityEnum {
  NOTIFY = 'notify',
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
}

// MISC
export type AsyncReturnType<T extends (...args: any) => any> =
  T extends (...args: any) => Promise<infer U> ? U :
  T extends (...args: any) => infer U ? U :
  any;
