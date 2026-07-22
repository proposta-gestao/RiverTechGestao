$utf8NoBom = New-Object System.Text.UTF8Encoding $false
$files = @(
    'admin-saas-empresa.js',
    'admin-saas-empresa.html',
    'admin-modules\admin-loja.js',
    'STATUS_FINAL.md',
    'MAPA_VISUAL.md',
    'INDICE_COMPLETO.md',
    'ENTREGAVEIS.md',
    'CHEAT_SHEET.md'
)

foreach ($f in $files) {
    if (Test-Path $f) {
        $content = [System.IO.File]::ReadAllText($f, $utf8NoBom)
        $original = $content
        
        $content = $content.Replace("Ã§Ã£o", "ção")
        $content = $content.Replace("Ã§Ãµes", "ções")
        $content = $content.Replace("Ã£o", "ão")
        $content = $content.Replace("Ã£", "ã")
        $content = $content.Replace("Ã§", "ç")
        $content = $content.Replace("Ã¡", "á")
        $content = $content.Replace("Ã©", "é")
        $content = $content.Replace("Ã³", "ó")
        $content = $content.Replace("Ãº", "ú")
        $content = $content.Replace("Ãª", "ê")
        $content = $content.Replace("Ã¢", "â")
        $content = $content.Replace("Ãµ", "õ")
        $content = $content.Replace("Ã´", "ô")
        $content = $content.Replace("Ã€", "À")
        $content = $content.Replace("Ã ", "à")
        $content = $content.Replace("Ã‰", "É")
        $content = $content.Replace("Ã ", "Á")
        $content = $content.Replace("Ã“", "Ó")
        $content = $content.Replace("Ãš", "Ú")
        $content = $content.Replace("ÃŠ", "Ê")
        $content = $content.Replace("Ã‚", "Â")
        $content = $content.Replace("Ã•", "Õ")
        $content = $content.Replace("Ã”", "Ô")
        $content = $content.Replace("Ã‡", "Ç")
        $content = $content.Replace("Âº", "º")
        $content = $content.Replace("Âª", "ª")
        $content = $content.Replace("Ã¼", "ü")
        $content = $content.Replace("Ã\xad", "í")
        $content = $content.Replace("Ã­", "í")
        
        if ($content -cne $original) {
            [System.IO.File]::WriteAllText($f, $content, $utf8NoBom)
            Write-Host "Forced write: $f"
        }
    }
}
