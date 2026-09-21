<#
.SYNOPSIS
  SİLVAN CEBİMDE market köprüsü — ürün listesini otomatik gönderir.

.DESCRIPTION
  Market programınızın dışa aktardığı ürün listesi dosyasını izler ve
  değiştiğinde SİLVAN CEBİMDE'ye gönderir. Fiyat ve stok otomatik güncellenir.

  Neden bu yöntem: markette sabit IP yok ve kasadaki bilgisayara internetten
  port açmak kabul edilemez. Bu betik DIŞARI doğru bağlanır — modem ayarı,
  sabit IP, güvenlik duvarı kuralı gerekmez.

  Windows'ta ek program kurulumu gerektirmez.

.PARAMETER Token
  Panelden alınan senkron jetonu (scb_ ile başlar).

.PARAMETER Path
  İzlenecek klasör ya da doğrudan dosya yolu.

.PARAMETER Filter
  Klasör izleniyorsa hangi dosyalar (varsayılan: *.xlsx ve *.csv).

.PARAMETER IntervalMinutes
  Kaç dakikada bir bakılacağı (varsayılan 15). Sunucu saatte 6 gönderime
  izin veriyor, bu yüzden 10 dakikanın altına inmeyin.

.PARAMETER Once
  Bir kez gönder ve çık (zamanlanmış görevle kullanmak için).

.EXAMPLE
  .\silvan-kopru.ps1 -Token scb_xxx -Path "C:\Wolvox\Aktarim" -Once

.EXAMPLE
  .\silvan-kopru.ps1 -Token scb_xxx -Path "C:\Mikro\stok.xlsx" -IntervalMinutes 15
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$Token,
  [Parameter(Mandatory = $true)][string]$Path,
  [string[]]$Filter = @('*.xlsx', '*.csv'),
  [int]$IntervalMinutes = 15,
  [switch]$Once,
  [string]$ApiUrl = 'https://uygulamamcebimde.online/api/sync/products',
  [string]$StateFile,
  [string]$LogFile
)

$ErrorActionPreference = 'Stop'
# TLS 1.2: eski Windows kurulumlarında varsayılan hâlâ TLS 1.0 olabiliyor ve
# bağlantı sebebi anlaşılmaz şekilde düşüyor.
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# LOCALAPPDATA her zaman dolu degil (zamanlanmis gorev bir servis hesabiyla
# calisiyorsa bos gelebiliyor); once kontrol et, sonra birlestir.
$appData = $env:LOCALAPPDATA
if ([string]::IsNullOrWhiteSpace($appData)) { $appData = [IO.Path]::GetTempPath() }
$baseDir = Join-Path $appData 'SilvanCebimde'
if (-not (Test-Path $baseDir)) { New-Item -ItemType Directory -Path $baseDir -Force | Out-Null }
if (-not $StateFile) { $StateFile = Join-Path $baseDir 'son-gonderim.txt' }
if (-not $LogFile) { $LogFile = Join-Path $baseDir 'kopru.log' }

function Write-Log {
  param([string]$Message, [string]$Level = 'BILGI')
  $line = '{0} [{1}] {2}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Level, $Message
  Write-Host $line
  try { Add-Content -Path $LogFile -Value $line -Encoding UTF8 } catch { }
}

# En son DEĞİŞEN dosyayı seçiyoruz: market programları çoğu zaman her gün
# tarihli yeni bir dosya üretiyor (stok_2026_09_21.xlsx gibi).
function Get-TargetFile {
  if (Test-Path -LiteralPath $Path -PathType Leaf) { return Get-Item -LiteralPath $Path }
  if (-not (Test-Path -LiteralPath $Path)) { throw "Yol bulunamadı: $Path" }
  $candidates = foreach ($pattern in $Filter) {
    Get-ChildItem -LiteralPath $Path -Filter $pattern -File -ErrorAction SilentlyContinue
  }
  if (-not $candidates) { return $null }
  return $candidates | Sort-Object LastWriteTime -Descending | Select-Object -First 1
}

# Dosya hâlâ yazılıyor olabilir (program dışa aktarımı bitirmemiş). Yarım
# dosyayı göndermek katalogda eksik ürün demek: boyut sabitlenene kadar bekle.
function Wait-FileReady {
  param([IO.FileInfo]$File)
  $previous = -1
  for ($i = 0; $i -lt 10; $i++) {
    $current = (Get-Item -LiteralPath $File.FullName).Length
    if ($current -gt 0 -and $current -eq $previous) { return $true }
    $previous = $current
    Start-Sleep -Seconds 2
  }
  return $false
}

function Get-FileHashHex {
  param([string]$FullName)
  return (Get-FileHash -LiteralPath $FullName -Algorithm SHA256).Hash
}

function Send-ProductList {
  param([IO.FileInfo]$File)

  $bytes = [IO.File]::ReadAllBytes($File.FullName)
  $headers = @{
    'Authorization'    = "Bearer $Token"
    'X-Sync-File-Name' = $File.Name
  }
  # -SkipHttpErrorCheck: 422/401 gövdesindeki Türkçe açıklamayı okuyabilmek
  # için. Aksi halde PowerShell istisna atıp mesajı yutuyor.
  $response = Invoke-WebRequest -Uri $ApiUrl -Method Post -Headers $headers `
    -ContentType 'application/octet-stream' -Body $bytes `
    -TimeoutSec 300 -SkipHttpErrorCheck

  $body = $null
  try { $body = $response.Content | ConvertFrom-Json } catch { }

  if ($response.StatusCode -eq 200) {
    Write-Log ("Gönderildi: {0} — {1} yeni, {2} güncellendi, {3} atlandı" -f `
      $File.Name, $body.created, $body.updated, $body.skipped)
    return $true
  }

  $reason = if ($body -and $body.error) { $body.error } else { "HTTP $($response.StatusCode)" }
  if ($response.StatusCode -eq 401) {
    Write-Log "Jeton geçersiz veya iptal edilmiş. Panelden yeni jeton alın." 'HATA'
  } elseif ($response.StatusCode -eq 429) {
    Write-Log "Çok sık gönderim; bu tur atlandı. ($reason)" 'UYARI'
  } elseif ($response.StatusCode -eq 422) {
    Write-Log "Dosya kabul edilmedi: $reason" 'HATA'
  } else {
    Write-Log "Gönderilemedi: $reason" 'HATA'
  }
  return $false
}

function Invoke-SyncOnce {
  $file = Get-TargetFile
  if (-not $file) {
    Write-Log "İzlenen yerde gönderilecek dosya yok: $Path" 'UYARI'
    return
  }
  if (-not (Wait-FileReady -File $file)) {
    Write-Log "$($file.Name) hâlâ yazılıyor görünüyor; sonraki tura bırakıldı." 'UYARI'
    return
  }

  $hash = Get-FileHashHex -FullName $file.FullName
  $lastHash = if (Test-Path -LiteralPath $StateFile) { (Get-Content -LiteralPath $StateFile -Raw).Trim() } else { '' }
  # Aynı dosyayı tekrar göndermek zararsız (sunucu kopya üretmiyor) ama
  # gereksiz: hem hız sınırını hem marketin internetini boşa harcar.
  if ($hash -eq $lastHash) {
    Write-Log "$($file.Name) değişmemiş; gönderilmedi."
    return
  }

  if (Send-ProductList -File $file) {
    Set-Content -LiteralPath $StateFile -Value $hash -Encoding ASCII
  }
}

Write-Log "Köprü başladı. İzlenen: $Path — aralık: $IntervalMinutes dk — günlük: $LogFile"

if ($Once) {
  # Zamanlanmis gorev bu dalı kullanıyor: hata çıktısı okunabilir olmalı ve
  # çıkış kodu hatayı yansıtmalı, aksi halde Görev Zamanlayıcı her şeyi
  # "başarılı" sayar ve kimse bozulduğunu fark etmez.
  try {
    Invoke-SyncOnce
  } catch {
    Write-Log $_.Exception.Message 'HATA'
    exit 1
  }
  exit 0
}

if ($IntervalMinutes -lt 10) {
  Write-Log "Aralık 10 dakikanın altında olamaz; 10 dakikaya çekildi." 'UYARI'
  $IntervalMinutes = 10
}

while ($true) {
  try {
    Invoke-SyncOnce
  } catch {
    # Tek bir hata köprüyü öldürmemeli: market kapanıp açılırken ağ gider,
    # dosya kilitlenir. Bir sonraki turda yeniden denenir.
    Write-Log "Beklenmeyen hata: $($_.Exception.Message)" 'HATA'
  }
  Start-Sleep -Seconds ($IntervalMinutes * 60)
}
