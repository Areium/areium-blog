$ErrorActionPreference = 'Stop'
$architecture = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString().ToLowerInvariant()
if ($architecture -notin @('x64', 'arm64')) { throw "Unsupported architecture: $architecture" }
$programRoot = Join-Path $env:LOCALAPPDATA 'Programs'
$installRoot = Join-Path $programRoot 'Nodejs24'
$toolsRoot = Join-Path $programRoot 'nodejs-tools'
$downloadRoot = Join-Path $env:TEMP ('fieldnotes-node-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $installRoot,$toolsRoot,$downloadRoot | Out-Null
$manifest = (Invoke-WebRequest -Uri 'https://nodejs.org/dist/latest-v24.x/SHASUMS256.txt' -UseBasicParsing).Content
if ($manifest -is [byte[]]) { $manifest = [Text.Encoding]::UTF8.GetString($manifest) }
$pattern = '(?m)^([a-f0-9]{64})\s+(node-v24\.\d+\.\d+-win-' + $architecture + '\.zip)\s*$'
$archiveMatch = [regex]::Match([string]$manifest, $pattern)
if (-not $archiveMatch.Success) { throw 'Official Node.js 24 archive not found in checksum manifest.' }
$expectedHash = $archiveMatch.Groups[1].Value
$archiveName = $archiveMatch.Groups[2].Value
$nodeDirectory = Join-Path $installRoot ([IO.Path]::GetFileNameWithoutExtension($archiveName))
$nodeExecutable = Join-Path $nodeDirectory 'node.exe'
if (-not (Test-Path -LiteralPath $nodeExecutable)) {
    $archivePath = Join-Path $downloadRoot $archiveName
    Write-Output "Downloading official $archiveName"
    Invoke-WebRequest -Uri ('https://nodejs.org/dist/latest-v24.x/' + $archiveName) -OutFile $archivePath -UseBasicParsing
    $actualHash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash
    if ($actualHash -ine $expectedHash) { throw 'Node archive checksum mismatch.' }
    Expand-Archive -LiteralPath $archivePath -DestinationPath $installRoot
}
$originalPath = [Environment]::GetEnvironmentVariable('Path','User')
$backupPath = Join-Path $installRoot 'path-before-setup.txt'
if (-not (Test-Path -LiteralPath $backupPath)) { [IO.File]::WriteAllText($backupPath, [string]$originalPath) }
$env:Path = "$nodeDirectory;$toolsRoot;" + $env:Path
$npmScript = Join-Path $nodeDirectory 'node_modules/npm/bin/npm-cli.js'
& $nodeExecutable $npmScript config set prefix $toolsRoot --location=user
if ($LASTEXITCODE -ne 0) { throw 'npm global prefix configuration failed.' }
& $nodeExecutable $npmScript install --global pnpm@11.25.0 --prefix $toolsRoot --registry https://registry.npmjs.org
if ($LASTEXITCODE -ne 0) { throw 'pnpm installation failed.' }
$pathEntries = @($nodeDirectory, $toolsRoot) + @($originalPath -split ';' | Where-Object { $_ -and $_ -ne $nodeDirectory -and $_ -ne $toolsRoot })
[Environment]::SetEnvironmentVariable('Path', ($pathEntries -join ';'), 'User')
# Notify Explorer and other applications that the user environment changed.
Add-Type -Namespace Fieldnotes -Name EnvironmentNotification -MemberDefinition '[System.Runtime.InteropServices.DllImport("user32.dll", CharSet = System.Runtime.InteropServices.CharSet.Unicode, SetLastError = true)] public static extern System.IntPtr SendMessageTimeout(System.IntPtr hWnd, uint Msg, System.IntPtr wParam, string lParam, uint flags, uint timeout, out System.IntPtr result);'
$notificationResult = [IntPtr]::Zero
[void][Fieldnotes.EnvironmentNotification]::SendMessageTimeout([IntPtr]0xffff, 0x1A, [IntPtr]::Zero, 'Environment', 2, 5000, [ref]$notificationResult)
Write-Output "Node directory: $nodeDirectory"
Write-Output "Tools directory: $toolsRoot"
& $nodeExecutable --version
& $nodeExecutable $npmScript --version
& (Join-Path $toolsRoot 'pnpm.cmd') --version
if ($LASTEXITCODE -ne 0) { throw 'Tool verification failed.' }
Write-Output 'User PATH configured. Reopen your terminal or VS Code to load it.'
