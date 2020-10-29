import { Logger } from 'airdcpp-apisocket';
import { APIType } from './api';


export interface SessionInfo {
  system_info: {
    // path_separator: string;
    api_feature_level: number;
  }
}

export interface Context {
  api: APIType;
  logger: Logger;
  now: () => number;
  getExtSetting: (key: string) => any;
  sessionInfo: SessionInfo;
}
