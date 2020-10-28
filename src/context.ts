import { Logger } from 'airdcpp-apisocket';
import { APIType } from './api';

export interface Context {
  api: APIType;
  logger: Logger;
  now: () => number;
  getExtSetting: (key: string) => any;
}
