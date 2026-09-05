<#
.SYNOPSIS
  Makes the Moss Todo stack reachable from other devices on your LAN.

.DESCRIPTION
  WSL2 in NAT mode puts the containers on a private network that only Windows can
  reach. This forwards the published ports from every Windows interface to the WSL
  VM, and opens the firewall for them.

  WSL's IP usually changes when it restarts, so re-run this after `wsl --shutdown`
  or a reboot. It looks the address up each time and replaces any previous rules.

  Run from an ELEVATED PowerShell (Run as administrator):
      powershell -ExecutionPolicy Bypass -File .\wsl-port-forward.ps1

.PARAMETER Remove
  Tear the rules down again instead of adding them.
#>
[CmdletBinding()]
param(
    [int[]] $Ports = @(4200, 8000, 8080),
    [switch] $Remove
)

$ErrorActionPreference = 'Stop'

if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()
        ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'This needs an elevated PowerShell — right-click PowerShell and Run as administrator.'
}

# Always clear first, so re-running after a WSL restart replaces a stale address.
foreach ($port in $Ports) {
    netsh interface portproxy delete v4tov4 listenport=$port listenaddress=0.0.0.0 2>$null | Out-Null
    Get-NetFirewallRule -DisplayName "Moss Todo $port" -ErrorAction SilentlyContinue |
        Remove-NetFirewallRule
}

if ($Remove) {
    Write-Host 'Removed the Moss Todo port-forward and firewall rules.'
    return
}

$wslIp = (wsl.exe -- hostname -I).Trim().Split(' ')[0]
if (-not $wslIp) { throw 'Could not determine the WSL IP address. Is the distro running?' }

foreach ($port in $Ports) {
    netsh interface portproxy add v4tov4 `
        listenport=$port listenaddress=0.0.0.0 `
        connectport=$port connectaddress=$wslIp | Out-Null
    New-NetFirewallRule -DisplayName "Moss Todo $port" -Direction Inbound `
        -Protocol TCP -LocalPort $port -Action Allow -Profile Private | Out-Null
}

Write-Host "Forwarding ports $($Ports -join ', ') to WSL at $wslIp"
Write-Host ''
Write-Host 'Open the app from your phone at:' -NoNewline
Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -notlike '127.*' -and $_.PrefixOrigin -ne 'WellKnown' } |
    ForEach-Object { Write-Host "  http://$($_.IPAddress):$($Ports[0])" }
Write-Host ''
Write-Host 'The phone must be on the same Wi-Fi network as this machine.'
