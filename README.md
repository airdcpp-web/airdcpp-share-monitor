# airdcpp-share-monitor [![Travis][build-badge]][build] [![npm package][npm-badge]][npm] [![Coverage][coverage-badge]][coverage]

AirDC++ extension that will monitor the shared directories for changes and apply them in share.

## What's new in each version

[Changelog](https://github.com/airdcpp-web/airdcpp-share-monitor/blob/master/CHANGELOG.md)

## Troubleshooting

Enable extension debug mode from application settings and check the extension error logs (`Settings\extensions\airdcpp-search-sites\logs`) for additional information.

### Common issues

#### The extensions exits with "Error: watch /share/root/ ENOSPC" in the error log (Linux only)

The maximum limit for directory watchers was reached. You may see the current limit on your system by executing the command `cat /proc/sys/fs/inotify/max_user_watches` in terminal.

As Linux doesn't have support for watching directories for changes recursively, the extension needs to go through all roots and their subdirectories and add an individual watcher for each of them. If the total number of directories in your share is larger than the system limit for directory watchers, adding of watchers will fail.

**Solution 1**

If you don't need to watch all shared directories for changes, you may set some of the root as *Incoming* on the *Share* page and configure the extension to monitor incoming roots only.

**Solution 2**

You may increase the maximum watcher limit on your system ([instructions](https://confluence.jetbrains.com/display/IDEADEV/Inotify+Watches+Limit))

#### Extension airdcpp-share-monitor timed out and was restarted

Common reasons that may cause a timeout:

- The extension became unresponsive because of an unusually high system load
- System was hibernated

If such timeouts happen often when the system is under heavy load, you can increase the ping timeout period from the Web UI (*Settings* -> *System* -> *Advanced server settings* -> *Socket ping timeout*).


## Development

>### Help wanted

>Pull requests with new validation modules are welcome. When developing new modules, please write tests as well.

This extension is based on the [airdcpp-create-extension](https://github.com/airdcpp-web/airdcpp-create-extension) example project, that provides instructions for AirDC++ extension development.

You may run the tests with `npm run test`.


[build-badge]: https://img.shields.io/travis/airdcpp-web/airdcpp-share-monitor/master.svg?style=flat-square
[build]: https://travis-ci.org/airdcpp-web/airdcpp-share-monitor

[npm-badge]: https://img.shields.io/npm/v/airdcpp-share-monitor.svg?style=flat-square
[npm]: https://www.npmjs.org/package/airdcpp-share-monitor

[coverage-badge]: https://codecov.io/gh/airdcpp-web/airdcpp-share-monitor/branch/master/graph/badge.svg
[coverage]: https://codecov.io/gh/airdcpp-web/airdcpp-share-monitor
