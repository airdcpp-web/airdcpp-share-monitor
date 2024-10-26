import thirdPartyWatch from 'node-watch';
import { watch as nativeWatch } from 'fs';
import { join as joinPath } from 'path';


// Node.js 20 adds support for recursive watching even on operating systems without native support
const hasNativeRecursiveWatch = () => {
  if (process.platform === 'win32' || process.platform === 'darwin') {
    return true;
  }

  const [major, minor] = process.versions.node.split('.').map(Number)
  return major > 20 || (major === 20 && minor >= 13); // 20.13 has fix for https://github.com/nodejs/node/pull/52349
}

export const USE_THIRD_PARTY_WATCH = !hasNativeRecursiveWatch();

export const normalizeChangePath = (rootPath: string, rawName: string | null) => {
  if (USE_THIRD_PARTY_WATCH) {
    // node-watch does the conversion
    return rawName as string
  }

  let path = rawName;
  if (!path) {
    path = '';
  }

  path = joinPath(rootPath, path);
  return path;
}

export const watch = USE_THIRD_PARTY_WATCH ? thirdPartyWatch as typeof nativeWatch : nativeWatch;
