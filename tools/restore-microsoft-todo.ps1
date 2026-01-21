# Restores (and optionally launches) the Microsoft To Do window.
# Usage examples:
#   .\tools\restore-microsoft-todo.ps1
#   .\tools\restore-microsoft-todo.ps1 -Title "Microsoft To Do" -LaunchIfMissing:$true

param(
    [string]$Title = "Microsoft To Do",
    [switch]$LaunchIfMissing = $true
)

$ErrorActionPreference = "Stop"

Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class Win32 {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
    [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int maxLength);
    [DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
}
"@

function Get-WindowByTitleLike {
    param([string]$TitleLike)

    $script:match = $null
    $titleLower = $TitleLike.ToLowerInvariant()

    [Win32]::EnumWindows({
        param($hWnd, $lParam)

        if (-not [Win32]::IsWindowVisible($hWnd)) { return $true }
        $len = [Win32]::GetWindowTextLength($hWnd)
        if ($len -le 0) { return $true }

        $sb = New-Object System.Text.StringBuilder ($len + 1)
        [void][Win32]::GetWindowText($hWnd, $sb, $sb.Capacity)
        $title = $sb.ToString()

        if ($title -and $title.ToLowerInvariant().Contains($titleLower)) {
            $script:match = $hWnd
            return $false
        }
        return $true
    }, [IntPtr]::Zero) | Out-Null

    return $script:match
}

function Restore-Window {
    param([IntPtr]$Handle)

    # 9 = SW_RESTORE
    [void][Win32]::ShowWindowAsync($Handle, 9)
    Start-Sleep -Milliseconds 50
    [void][Win32]::SetForegroundWindow($Handle)
}

try {
    $handle = Get-WindowByTitleLike -TitleLike $Title
    if ($handle) {
        Restore-Window -Handle $handle
        Write-Output "Restored window: $Title"
        exit 0
    }

    if ($LaunchIfMissing) {
        try {
            Start-Process "explorer.exe" "shell:AppsFolder\Microsoft.Todos_8wekyb3d8bbwe!App" | Out-Null
        } catch {
            try {
                Start-Process "ms-todo:" | Out-Null
            } catch {
                # Ignore and fall through to re-check.
            }
        }

        Start-Sleep -Seconds 2
        $handle = Get-WindowByTitleLike -TitleLike $Title
        if ($handle) {
            Restore-Window -Handle $handle
            Write-Output "Launched and restored window: $Title"
            exit 0
        }
    }

    Write-Output "Microsoft To Do window not found."
    exit 1
}
catch {
    Write-Output "Failed to restore Microsoft To Do window: $($_.Exception.Message)"
    exit 2
}
