$ErrorActionPreference = 'Stop'
$version = (Get-Content package.json | ConvertFrom-Json).version
$root = Join-Path $env:RUNNER_TEMP 'prop-package-qa'
$install = Join-Path $root 'installed'
New-Item -ItemType Directory -Path $root -Force | Out-Null
$setup = (Resolve-Path "dist/PT2VHF-Prop-Tool-$version-x64-setup.exe").Path
$portable = (Resolve-Path "dist/PT2VHF-Prop-Tool-$version-x64-portable.exe").Path
$script = (Resolve-Path 'desktop/apply-update.ps1').Path
function Run-CheckedProcess([string]$Exe,[string]$Arguments,[string]$Label,[int]$Seconds=120) {
  Write-Host "Starting package check: $Label"
  $stdout = Join-Path $root ($Label + '-stdout.log')
  $stderr = Join-Path $root ($Label + '-stderr.log')
  $p = Start-Process -FilePath $Exe -ArgumentList $Arguments -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
  if (-not $p.WaitForExit($Seconds * 1000)) {
    & "$env:SystemRoot\System32\taskkill.exe" /PID $p.Id /T /F 2>$null | Out-Null
    Get-Content $stdout,$stderr -ErrorAction SilentlyContinue | Write-Host
    throw "Package check timed out: $Label"
  }
  $p.WaitForExit()
  Get-Content $stdout,$stderr -ErrorAction SilentlyContinue | Write-Host
  return $p
}
$errors = $null; $tokens = $null
[System.Management.Automation.Language.Parser]::ParseFile($script,[ref]$tokens,[ref]$errors) | Out-Null
if ($errors.Count -gt 0) { throw ($errors | Out-String) }
$p = Run-CheckedProcess $setup "/S /D=$install" "install"
if ($p.ExitCode -ne 0 -or -not (Test-Path "$install/PT2VHF Prop Tool.exe")) { throw 'Installer failed' }
$p = Run-CheckedProcess "$install/PT2VHF Prop Tool.exe" "--smoke-test" "installed-startup"
if ($p.ExitCode -ne 0) { throw 'Installed application smoke failed' }
$sentinel = Join-Path $install 'keep-user-file.txt'; 'preserve unrelated files' | Set-Content $sentinel
$p = Run-CheckedProcess "$install/Uninstall.exe" "/S" "uninstall"
for ($i=0;$i -lt 40 -and (Test-Path "$install/PT2VHF Prop Tool.exe");$i++) { Start-Sleep -Milliseconds 250 }
if (Test-Path "$install/PT2VHF Prop Tool.exe") { throw 'Uninstall failed' }
if (-not (Test-Path $sentinel)) { throw 'Uninstall deleted unrelated file' }
$directFolder = Join-Path $root 'portable-direct'; New-Item -ItemType Directory -Path $directFolder -Force | Out-Null
$direct = Join-Path $directFolder 'portable.exe'; Copy-Item $portable $direct
$p = Run-CheckedProcess $direct "--smoke-test" "portable-startup"
if ($p.ExitCode -ne 0 -or -not (Test-Path "$directFolder/data/state.json")) { throw 'Portable smoke or data persistence failed' }
foreach ($scenario in @('success','rollback')) {
  $dir = Join-Path $root $scenario; $updates = Join-Path $dir 'data/updates'; New-Item -ItemType Directory -Path $updates -Force | Out-Null
  $original = Join-Path $dir 'previous-portable.exe'; Copy-Item $portable $original
  $candidate = Join-Path $root 'candidate.exe'; Copy-Item $portable $candidate -Force
  $target = Join-Path $dir "PT2VHF-Prop-Tool-$version-x64-portable.exe"
  $stateFile = Join-Path $dir 'data/state.json'
  $initial = @{schemaVersion=2;settings=@{callsign='PT2VHF';lat=-15.8;lon=-47.9;power=50;visible=@('20 m');alertBands=@();antennas=@{'20 m'=@{type='Yagi'}};language='pt-BR';theme='light';updateMinutes=30};spots=@()}
  $initial | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $stateFile -Encoding UTF8
  $originalState = Get-Content -LiteralPath $stateFile -Raw
  $manifest = Join-Path $updates 'apply-update.json'
  $expected = if ($scenario -eq 'success') { $version } else { '999.0.0' }
  @{Mode='portable';Candidate=$candidate;Sha256=(Get-FileHash $candidate -Algorithm SHA256).Hash.ToLower();ExpectedVersion=$expected;AppPid=0;LauncherPid=0;Original=$original;Target=$target;StateFile=$stateFile;ReadyFile=(Join-Path $updates 'update-ready.json');Smoke=$true} | ConvertTo-Json | Set-Content -LiteralPath $manifest -Encoding UTF8
  $worker = Run-CheckedProcess "powershell.exe" "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$script`" -Manifest `"$manifest`"" "portable-$scenario" 150
  $result = Get-Content (Join-Path $updates 'update-result.json') -Raw | ConvertFrom-Json
  if ($scenario -eq 'success') {
    if ($worker.ExitCode -ne 0 -or $result.status -ne 'ok' -or -not (Test-Path $target) -or -not (Test-Path "$original.previous")) { throw 'Portable update handoff failed' }
    $saved = Get-Content $stateFile -Raw | ConvertFrom-Json
    if ($saved.settings.power -ne 50 -or $saved.settings.antennas.'20 m'.type -ne 'Yagi') { throw 'Portable update lost settings' }
    # The native smoke child must complete before the next test uses the single-instance lock.
    for ($i=0;$i -lt 80;$i++) { $running = Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -eq $target }; if (-not $running) { break }; Start-Sleep -Milliseconds 250 }
  } else {
    if ($worker.ExitCode -eq 0 -or $result.status -ne 'error' -or -not (Test-Path $original) -or (Test-Path $target)) { throw 'Portable rollback failed' }
    if ((Get-Content $stateFile -Raw) -ne $originalState) { throw 'Rollback did not restore settings' }
  }
}
Write-Host 'Windows package QA: installation, native installed/portable startup, safe uninstall, portable handoff and rollback OK'
