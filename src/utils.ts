import path from 'path';


/*export const getLastDirectory = (fullPath: string): string => {
  const path = isDirectory(fullPath) ? fullPath : getParentPath(fullPath);
  const result = path.match(/([^\\\/]+)[\\\/]$/);
  return result ? result[1] : fullPath;
};*/

export const isDirectory = (fullPath: string): boolean => {
  return fullPath ? !!fullPath.match(/[\\\/]$/) : false;
};

export const getParentPath = (fullPath: string): string => {
  if (isDirectory(fullPath)) {
    return fullPath.replace(/[^\\\/]+[\\\/]$/, '');
  }

  return getFilePath(fullPath);
};

export const getFilePath = (fullPath: string): string => {
  return fullPath.replace(/[^\\\/]*$/, '');
};

export const ensureEndSeparator = (fullPath: string) => {
  if (!fullPath.endsWith(path.sep)) {
    return fullPath + path.sep;
  }

  return fullPath;
};


/* returns true if aDir is a subdir of aParent */
export const isSub = (testSub: string, parent: string) => {
	if (testSub.length <= parent.length) {
    return false;
  }

  return testSub.startsWith(parent);
}

/* returns true if aSub is a subdir of aDir OR both are the same dir */
export const isParentOrExact = (testParent: string, sub: string) => {
	if (sub.length < testParent.length) {
    return false;
  }

  return sub.startsWith(testParent);
}

export const sleep = (ms: number) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};
