"""Safe process-discovery and shutdown regressions; never terminate real processes."""
import argparse
import importlib.util
import os
from pathlib import Path
import re
import signal
import subprocess
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('goose_build', Path(__file__).resolve().parents[2] / 'build.py')
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)


class BuildProcessTests(unittest.TestCase):
    def platform(self, name):
        return patch.multiple(build, IS_MAC=name == 'mac', IS_WIN=name == 'win', IS_LINUX=name == 'linux')

    def test_windows_shutdown_executes_taskkill_once_per_pid(self):
        with self.platform('win'), patch.object(build, 'find_installed_pids', return_value=[424242]), \
                patch.object(build, 'find_dev_pids', return_value=[424242, 424243]), \
                patch.object(build.subprocess, 'run') as run:
            build.cmd_kill(argparse.Namespace())
            self.assertEqual(run.call_count, 2)
            run.assert_any_call(['taskkill', '/F', '/PID', '424242', '/T'], capture_output=True, check=True)
            run.assert_any_call(['taskkill', '/F', '/PID', '424243', '/T'], capture_output=True, check=True)

    def test_windows_failure_stops_packaging(self):
        failure = subprocess.CalledProcessError(5, 'taskkill')
        with self.platform('win'), patch.object(build, 'find_installed_pids', return_value=[424242]), \
                patch.object(build, 'find_dev_pids', return_value=[]), \
                patch.object(build.subprocess, 'run', side_effect=failure), \
                patch.object(build, 'package_with_builder') as package:
            with self.assertRaises(SystemExit):
                build.cmd_package(argparse.Namespace(linux_targets=None))
            package.assert_not_called()

    def test_mac_uses_ps_and_retains_main_process_without_proc(self):
        marker = str(build.ROOT / 'node_modules' / 'electron')
        def output(cmd, **_):
            if cmd[0] == 'pgrep':
                self.assertEqual(cmd, ['pgrep', '-f', re.escape(marker)])
                return subprocess.CompletedProcess(cmd, 0, stdout=f'{os.getpid()} 424242 424243')
            return subprocess.CompletedProcess(cmd, 0, stdout=f'{marker}/dist/Electron.app/Contents/MacOS/Electron .' + (' --type=renderer' if cmd[2] == '424243' else ''))
        with self.platform('mac'), patch.object(build.subprocess, 'run', side_effect=output), \
                patch.object(Path, 'read_bytes', side_effect=AssertionError('macOS must not read /proc')), \
                patch.object(Path, 'resolve', side_effect=AssertionError('macOS must not resolve /proc')):
            self.assertEqual(build.find_dev_pids(), [424242])

    def test_mac_ignores_vanished_process(self):
        with self.platform('mac'), patch.object(build.subprocess, 'run', side_effect=[
            subprocess.CompletedProcess([], 0, stdout='424242'),
            subprocess.CompletedProcess([], 1, stdout=''),
        ]):
            self.assertEqual(build.find_dev_pids(), [])

    def test_linux_requires_main_process_and_matching_cwd(self):
        def command(path):
            return b'electron\0--type=renderer' if str(path).endswith('/424243/cmdline') else b'electron\0.'
        def cwd(path, **kwargs):
            self.assertEqual(kwargs, {'strict': True})
            return Path('/other/repository') if str(path).endswith('/424244/cwd') else build.ROOT
        with self.platform('linux'), patch.object(build.subprocess, 'run', return_value=subprocess.CompletedProcess([], 0, stdout='424242 424243 424244')), \
                patch.object(Path, 'read_bytes', autospec=True, side_effect=command), \
                patch.object(Path, 'resolve', autospec=True, side_effect=cwd):
            self.assertEqual(build.find_dev_pids(), [424242])

    def test_linux_unreadable_process_is_not_terminated(self):
        with self.platform('linux'), patch.object(build.subprocess, 'run', return_value=subprocess.CompletedProcess([], 0, stdout='424242')), \
                patch.object(Path, 'read_bytes', side_effect=FileNotFoundError):
            self.assertEqual(build.find_dev_pids(), [])

    def test_unix_escalates_and_requires_old_process_to_exit(self):
        with self.platform('linux'), patch.object(build, 'find_installed_pids', return_value=[424242]), \
                patch.object(build, 'find_dev_pids', return_value=[]), \
                patch.object(build, 'signal_pids') as terminate, \
                patch.object(build.time, 'monotonic', side_effect=[0, build.KILL_GRACE_SECONDS]), \
                patch.object(build.time, 'sleep'), patch.object(build, 'alive_pids', return_value=[]):
            build.cmd_kill(argparse.Namespace())
            self.assertEqual(terminate.call_args_list[0].args, ([424242], signal.SIGTERM))
            self.assertEqual(terminate.call_args_list[1].args, ([424242], signal.SIGKILL))

    def test_unix_surviving_process_stops_install_or_packaging(self):
        with self.platform('linux'), patch.object(build, 'find_installed_pids', return_value=[424242]), \
                patch.object(build, 'find_dev_pids', return_value=[]), patch.object(build, 'signal_pids'), \
                patch.object(build.time, 'monotonic', side_effect=[0, build.KILL_GRACE_SECONDS]), \
                patch.object(build.time, 'sleep'), patch.object(build, 'alive_pids', return_value=[424242]):
            with self.assertRaises(SystemExit):
                build.cmd_kill(argparse.Namespace())


if __name__ == '__main__':
    unittest.main()
