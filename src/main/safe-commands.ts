import { execFile } from 'child_process';
import { isMac, isWindows } from './platform';
import type { SafeCommandAction } from '../shared/types';

interface OsCommandSpec {
  binary: string;
  args: string[];
}

interface CrossPlatformCommand {
  windows: OsCommandSpec;
  mac: OsCommandSpec;
  linux: OsCommandSpec;
}

const ALLOWED_ACTIONS: Record<string, CrossPlatformCommand> = {
  lock_screen: {
    windows: { binary: 'rundll32.exe', args: ['user32.dll,LockWorkStation'] },
    mac: {
      binary: 'osascript',
      args: [
        '-e',
        'tell application "System Events" to keystroke "q" using {command down, control down}',
      ],
    },
    linux: { binary: 'loginctl', args: ['lock-session'] },
  },
  sleep: {
    windows: {
      binary: 'rundll32.exe',
      args: ['powrprof.dll,SetSuspendState', '0,1,0'],
    },
    mac: { binary: 'pmset', args: ['sleepnow'] },
    linux: { binary: 'systemctl', args: ['suspend'] },
  },
  shutdown: {
    windows: { binary: 'shutdown', args: ['/s', '/t', '0'] },
    mac: {
      binary: 'osascript',
      args: ['-e', 'tell app "System Events" to shut down'],
    },
    linux: { binary: 'systemctl', args: ['poweroff'] },
  },
  restart: {
    windows: { binary: 'shutdown', args: ['/r', '/t', '0'] },
    mac: {
      binary: 'osascript',
      args: ['-e', 'tell app "System Events" to restart'],
    },
    linux: { binary: 'systemctl', args: ['reboot'] },
  },
};

/**
 * Validates and runs a system command. Only commands defined in
 * `ALLOWED_ACTIONS` are accepted; everything else is dropped silently.
 */
export function runSafeCommand(action: unknown): boolean {
  if (
    !action ||
    typeof action !== 'object' ||
    (action as { type?: unknown }).type !== 'syscommand' ||
    typeof (action as { id?: unknown }).id !== 'string'
  ) {
    console.warn('Blocked invalid command payload:', action);
    return false;
  }

  const normalized: SafeCommandAction = {
    type: 'syscommand',
    id: ((action as SafeCommandAction).id ?? '').trim(),
  };

  const spec = ALLOWED_ACTIONS[normalized.id];
  if (!spec) {
    console.warn('Blocked unknown command identifier:', normalized.id);
    return false;
  }

  const osSpec = isWindows ? spec.windows : isMac ? spec.mac : spec.linux;
  if (!osSpec) {
    console.warn(`Blocked command "${normalized.id}" on unsupported OS.`);
    return false;
  }

  execFile(osSpec.binary, osSpec.args, (err) => {
    if (err) {
      console.warn(`Failed to execute command "${normalized.id}":`, err.message);
    }
  });

  return true;
}
