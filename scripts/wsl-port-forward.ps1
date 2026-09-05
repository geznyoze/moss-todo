<#
.SYNOPSIS
  Makes the Moss Todo stack reachable from other devices on your LAN.

.DESCRIPTION
  WSL2 in NAT mode puts the containers on a private network that only Windows can
  reach. This forwards the published ports from every Windows interface into the WSL
  VM, and opens the firewall for them.

  WSL's IP usually changes when it restarts, so re-run this after `wsl --shutdown`
  or a reboot. It looks the address up each time and replaces any previous rules.

  It re-launches itself elevated if needed, so you can just run:
      powershell -ExecutionPolicy Bypass -File .\wsl-port-forward.ps1

.PARAMETER Remove
  Tear the rules down again instead of adding them.
#>
[CmdletBinding()]
param(
    [int[]] $Ports = @(80, 443),
    [switch] $Remove
)

$ErrorActionPreference = 'Stop'

# Re-launch elevated rather than failing: netsh portproxy and firewall rules both
# need admin, and a bare `throw` here just closes the window before it can be read.
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()
    ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host 'Needs administrator rights — accept the prompt.'
    $argList = @('-ExecutionPolicy', 'Bypass', '-NoExit', '-File', "`"$PSCommandPath`"")
    if ($Remove) { $argList += '-Remove' }
    Start-Process powershell.exe -Verb RunAs -ArgumentList $argList
    return
}

foreach ($port in $Ports) {
    # Always clear first, so re-running after a WSL restart replaces a stale address.
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

# The LAN address other devices will use: the DHCP-assigned one, which skips
# VirtualBox/Hyper-V host adapters (static) and link-local 169.254.* addresses.
$lan = Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -notlike '127.*' -and $_.PrefixOrigin -eq 'Dhcp' } |
    Select-Object -First 1
if (-not $lan) { throw 'No DHCP IPv4 address found — are you connected to Wi-Fi?' }
$lanIp = $lan.IPAddress

# A network Windows calls "Public" blocks inbound connections regardless of any rule
# added for the Private profile. Home Wi-Fi belongs in Private — note this is NOT the
# same setting as WPA2-Personal, which is the Wi-Fi encryption type. Only the
# interface serving the LAN address is touched.
$profile = Get-NetConnectionProfile -InterfaceIndex $lan.InterfaceIndex
if ($profile.NetworkCategory -eq 'Public') {
    Set-NetConnectionProfile -InterfaceIndex $lan.InterfaceIndex -NetworkCategory Private
    Write-Host "Set network '$($profile.Name)' from Public to Private."
    Write-Host "  Undo with: Set-NetConnectionProfile -InterfaceIndex $($lan.InterfaceIndex) -NetworkCategory Public"
}

foreach ($port in $Ports) {
    netsh interface portproxy add v4tov4 `
        listenport=$port listenaddress=0.0.0.0 `
        connectport=$port connectaddress=$wslIp | Out-Null
    New-NetFirewallRule -DisplayName "Moss Todo $port" -Direction Inbound `
        -Protocol TCP -LocalPort $port -Action Allow -Profile Private | Out-Null
}
Write-Host "Forwarding ports $($Ports -join ', ') to WSL at $wslIp"

Write-Host ''
foreach ($port in $Ports) {
    $ok = Test-NetConnection -ComputerName $lanIp -Port $port -InformationLevel Quiet -WarningAction SilentlyContinue
    Write-Host ("  {0}:{1} {2}" -f $lanIp, $port, $(if ($ok) { 'reachable' } else { 'NOT REACHABLE' }))
}

Write-Host ''
Write-Host "Open this on your phone:  https://${lanIp}"
Write-Host 'The certificate is self-signed, so tap through the browser warning once.'
Write-Host 'It must be on the same Wi-Fi network as this machine.'
Write-Host 'If a port says NOT REACHABLE, another firewall (antivirus suite) is likely blocking it.'
