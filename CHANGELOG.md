### Version 1.0.2 (2020-12-xx)

- Avoid timeouts when the system is unresponsive ([#2](https://github.com/airdcpp-web/airdcpp-share-monitor/issues/2))
- Trigger refresh for the parent directory when deleting directories
- Ignore changes for queued files/directories (avoids cases where bundle directories could get refreshed by the extension after they have finished downloading)

### Version 1.0.1 (2020-12-18)

- Avoid timeouts when disk response times are long ([#2](https://github.com/airdcpp-web/airdcpp-share-monitor/issues/2))

### Version 1.0.0 (2020-12-06)

- Don't show a log message about added paths if there are no roots to watch
- Update dependencies

### Version 0.0.7 (2020-11-27)

- Correct an API path for checking deleted file/directory information

### Version 0.0.6 (2020-11-21)

- Ignore change events for non-shared paths
- Improve event logging

### Version 0.0.5 (2020-11-21)

- Ignore events for file permission changes
- Add restart note for the monitoring mode setting
- Fix source maps