$lines = [System.IO.File]::ReadAllLines('admin-saas-empresa.js', [System.Text.Encoding]::UTF8)
$line = $lines[252]
$chars = $line.ToCharArray()
$out = ""
foreach ($c in $chars) {
    $out += "[" + [int]$c + "]"
}
Write-Host $out
