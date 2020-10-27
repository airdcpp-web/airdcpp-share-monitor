import { Logger } from 'airdcpp-apisocket';
import { API } from './api';

import { Stats } from 'fs';

export const ChangeManager = (logger: Logger, settings: any, api: ReturnType<typeof API>) => {
  const onChange = (eventName: 'add'|'addDir'|'change'|'unlink'|'unlinkDir', path: string, stats?: Stats) => {
    logger.verbose(`Path ${path}: ${eventName}`);
  };

  return {
    onChange,
  };
};