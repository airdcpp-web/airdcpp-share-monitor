import path from 'path';


export const MOCK_INCOMING_ROOT = {
  id: 'incoming',
  virtual_name: 'Incoming',
  path: path.join(__dirname, 'data', 'incoming'),
  incoming: true,
};

export const MOCK_NORMAL_ROOT = {
  id: 'normal',
  virtual_name: 'Normal',
  path: path.join(__dirname, 'data', 'normal'),
  incoming: false,
};

export const MOCK_DUMMY_DIR_PATH = path.join(__dirname, 'data', 'dummy');

export const MOCK_SHARE_ROOTS = [
  MOCK_INCOMING_ROOT,
  MOCK_NORMAL_ROOT,
];