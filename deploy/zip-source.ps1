# Compress-Archive helper: zip-source -> 5 upload packs for BaoTa manual upload
# Run in Windows PowerShell 5.1+ (Windows built-in):
#   cd D:\tongcheng\companion-play-app
#   powershell -ExecutionPolicy Bypass -File deploy\zip-source.ps1 [-SkipAppSource]
param(
  [string]$ProjectRoot = '',
  [string]$OutDir      = '',
  [switch]$SkipAppSource
)
$ErrorActionPreference = 'Stop'

# Fallback when running in an environment where $PSScriptRoot is empty or unset.
if([string]::IsNullOrEmpty($ProjectRoot)){
  $here = if($PSScriptRoot){ $PSScriptRoot } else { (Get-Location).Path }
  $ProjectRoot = [System.IO.Path]::GetDirectoryName($here)
}
if([string]::IsNullOrEmpty($OutDir)){
  $here = if($PSScriptRoot){ $PSScriptRoot } else { (Get-Location).Path }
  $OutDir = [System.IO.Path]::Combine($here, 'artifacts')
}

function Tell([string]$m){ Write-Host ("[ZIP] {0:HH:mm:ss} - {1}" -f (Get-Date), $m) -ForegroundColor Cyan }
function EnsureDir([string]$d){ if(-not (Test-Path $d)){ [void](New-Item -ItemType Directory -Path $d -Force) } }
function SafeRemove([string]$p){ if(Test-Path $p){ Remove-Item -LiteralPath $p -Recurse -Force -ErrorAction Stop } }
function NewTempDir([string]$root){
  $name = '__zip_' + [guid]::NewGuid().ToString('N')
  $full = Join-Path $root $name
  [void](New-Item -ItemType Directory -Path $full -Force)
  return $full
}

# Recursively copy files under $From to $To, excluding directory names and file patterns.
function Copy-Filtered {
  param(
    [string]$From = '',
    [string]$To   = '',
    [string[]]$ExcludeDir  = @(),
    [string[]]$ExcludeFile = @(),
    [switch]$Recurse
  )
  if(-not (Test-Path -LiteralPath $From)){ Write-Warning ("Source missing: " + $From); return }
  EnsureDir $To
  $dirExSet = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
  foreach ($e in $ExcludeDir) { [void]$dirExSet.Add($e) }
  $depth = if($Recurse){ 9999 } else { 0 }
  $files = Get-ChildItem -LiteralPath $From -File -Recurse:$Recurse -Force -ErrorAction SilentlyContinue
  foreach ($f in $files) {
    $rel = $f.FullName.Substring($From.Length).TrimStart('\','/')
    $parts = $rel -split '[\\/]'
    $drop = $false
    # check any dir segment
    for($i = 0; $i -lt $parts.Length - 1; $i++){
      if($dirExSet.Contains($parts[$i])){ $drop = $true; break }
    }
    if(-not $drop){
      $leaf = $parts[$parts.Length - 1]
      foreach ($pat in $ExcludeFile) {
        if($leaf -like $pat){ $drop = $true; break }
      }
    }
    if($drop){ continue }
    $dest = Join-Path $To $rel
    EnsureDir ([System.IO.Path]::GetDirectoryName($dest))
    Copy-Item -LiteralPath $f.FullName -Destination $dest -Force
  }
}

# -------- 0. Prepare output --------
EnsureDir $OutDir
Get-ChildItem -LiteralPath $OutDir -Filter 'baiye-*.zip' -File -ErrorAction SilentlyContinue | Remove-Item -Force
Tell ("Output dir: " + $OutDir)

function Build-Zip([string]$Name, [scriptblock]$FillStaging){
  $stage = NewTempDir $OutDir
  try {
    & $FillStaging $stage
    $dest = Join-Path $OutDir $Name
    Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $dest -CompressionLevel Optimal -Force
    Tell ("Done: " + $Name)
  } finally {
    SafeRemove $stage
  }
}

# -------- 1. baiye-root.zip --------
Build-Zip 'baiye-root.zip' {
  param($s)
  $rootKeepFiles = @('README.md','LICENSE','.editorconfig','.npmrc','.gitattributes')
  foreach ($n in $rootKeepFiles) {
    $p = Join-Path $ProjectRoot $n
    if(Test-Path -LiteralPath $p){ Copy-Item -LiteralPath $p (Join-Path $s $n) -Force }
  }
  foreach ($d in @('docs','deploy','sucai','pages','scripts')) {
    $src = Join-Path $ProjectRoot $d
    if(Test-Path -LiteralPath $src){
      $dst = Join-Path $s $d
      $exclDir  = @('node_modules','.cache','.git','__pycache__')
      $exclFile = @('*.zip','*.log','*.tmp','*.pyc')
      Copy-Filtered -From $src -To $dst -Recurse -ExcludeDir $exclDir -ExcludeFile $exclFile
    }
  }
  $envEx = Join-Path $ProjectRoot 'server\.env.example'
  if(Test-Path -LiteralPath $envEx){
    $d = Join-Path $s 'server'
    EnsureDir $d
    Copy-Item -LiteralPath $envEx (Join-Path $d '.env.example') -Force
  }
}

# -------- 2. baiye-server-src.zip --------
Build-Zip 'baiye-server-src.zip' {
  param($s)
  $root = Join-Path $ProjectRoot 'server'
  if(-not (Test-Path -LiteralPath $root)){ throw ("server dir not found: " + $root) }
  $keepDirs = @('src','scripts','test','config','middleware','models','routes','utils','store')
  $dirExcl = @('node_modules','logs','coverage','.cache','.vscode','uploads')
  $fileExcl= @('*.log','*.zip','*.key','*.pem','*.crt','*.p12','.DS_Store','Thumbs.db','.env')
  foreach ($d in $keepDirs) {
    $f = Join-Path $root $d
    if(-not (Test-Path -LiteralPath $f)){ continue }
    $t = Join-Path $s $d
    Copy-Filtered -From $f -To $t -Recurse -ExcludeDir $dirExcl -ExcludeFile $fileExcl
  }
  # Create empty uploads/sucai (real pictures in another zip)
  EnsureDir (Join-Path $s 'uploads\sucai')
  $keepFiles = @('package.json','package-lock.json','ecosystem.config.js',
    '.env.example','seed.js','jest.config.js','babel.config.js','.npmrc','jsconfig.json',
    'tsconfig.json','index.js','app.js')
  foreach ($n in $keepFiles) {
    $f = Join-Path $root $n
    if(Test-Path -LiteralPath $f){ Copy-Item -LiteralPath $f (Join-Path $s $n) -Force }
  }
  # Never upload .env to the server; use .env.example to regenerate
  $bad = Join-Path $s '.env'
  if(Test-Path -LiteralPath $bad){ Remove-Item -LiteralPath $bad -Force }
}

# -------- 3. baiye-admin-src.zip --------
Build-Zip 'baiye-admin-src.zip' {
  param($s)
  $root = Join-Path $ProjectRoot 'admin'
  if(Test-Path -LiteralPath $root){
    $dEx  = @('node_modules','dist','.vite','.vscode','coverage','.cache','.husky')
    $fEx  = @('*.log','.env.local','.env.development.local','.DS_Store','Thumbs.db','*.zip')
    Copy-Filtered -From $root -To $s -Recurse -ExcludeDir $dEx -ExcludeFile $fEx
    $dotEnv = Join-Path $s '.env'
    if(Test-Path -LiteralPath $dotEnv){ Remove-Item -LiteralPath $dotEnv -Force }
  }
}

# -------- 4. baiye-app-src.zip --------
if($SkipAppSource){
  Tell "SkipAppSource set; mobile app source not packed."
} else {
  Build-Zip 'baiye-app-src.zip' {
    param($s)
    $root = Join-Path $ProjectRoot 'app'
    if(Test-Path -LiteralPath $root){
      $dEx  = @('node_modules','dist','.hbuilderx','unpackage','.vscode','.cache')
      $fEx  = @('*.log','*.apk','*.aab','*.ipa','*.wgt',
                'project.private.config.json','.DS_Store','Thumbs.db')
      Copy-Filtered -From $root -To $s -Recurse -ExcludeDir $dEx -ExcludeFile $fEx
    }
  }
}

# -------- 5. baiye-sucai-uploads.zip (OPTIONAL) --------
Build-Zip 'baiye-sucai-uploads.zip' {
  param($s)
  $local = Join-Path $ProjectRoot 'server\uploads\sucai'
  if(Test-Path -LiteralPath $local){
    Copy-Filtered -From $local -To $s -Recurse -ExcludeFile @('*.log','*.tmp')
  } else {
    Write-Warning "server\uploads\sucai not found; you can skip this zip on the server."
  }
}

# -------- 6. Summary --------
Write-Host ""
Write-Host "============================ Pack OK ============================" -ForegroundColor Green
$items = @(Get-ChildItem -LiteralPath $OutDir -Filter 'baiye-*.zip' -File | Sort-Object Name)
$total = 0L
foreach ($f in $items) {
  $kb = [math]::Round($f.Length / 1KB, 1)
  $total += $f.Length
  Write-Host ("  {0,-30} {1,10} KB" -f $f.Name, $kb)
}
$mb = [math]::Round($total / 1MB, 1)
Write-Host ("  {0,-30} {1,10} MB" -f 'TOTAL', $mb)
Write-Host ("  ZIP count: " + $items.Count)
Write-Host "  Next: upload each ZIP to its target path on BaoTa server."
Write-Host "  Checklist: deploy/MANUAL-UPLOAD.md"
Write-Host "====================================================================" -ForegroundColor Green
