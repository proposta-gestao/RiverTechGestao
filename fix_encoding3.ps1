$dict = [ordered]@{
    "Ã§Ã£o" = "ção"
    "Ã§Ãµes" = "ções"
    "Ã£o" = "ão"
    "Ã£" = "ã"
    "Ã§" = "ç"
    "Ã¡" = "á"
    "Ã©" = "é"
    "Ã³" = "ó"
    "Ãº" = "ú"
    "Ãª" = "ê"
    "Ã¢" = "â"
    "Ãµ" = "õ"
    "Ã´" = "ô"
    "Ã€" = "À"
    "Ã " = "à"
    "Ã‰" = "É"
    "Ã " = "Á"
    "Ã“" = "Ó"
    "Ãš" = "Ú"
    "ÃŠ" = "Ê"
    "Ã‚" = "Â"
    "Ã•" = "Õ"
    "Ã”" = "Ô"
    "Ã‡" = "Ç"
    "Âº" = "º"
    "Âª" = "ª"
    "Ã¼" = "ü"
    "Ã­" = "í"
    "Ã " = "Í"
}

$files = Get-ChildItem -Path . -Recurse -Include *.html,*.js,*.md,*.css -Exclude *node_modules*,*.git*,*.gemini*

$utf8NoBom = New-Object System.Text.UTF8Encoding $false

foreach ($file in $files) {
    if ($file.DirectoryName -match "node_modules" -or $file.DirectoryName -match ".gemini" -or $file.DirectoryName -match ".git") { continue }
    
    $content = [System.IO.File]::ReadAllText($file.FullName, $utf8NoBom)
    $original = $content
    
    foreach ($key in $dict.Keys) {
        $content = $content.Replace($key, $dict[$key])
    }
    
    if ($content -cne $original) {
        [System.IO.File]::WriteAllText($file.FullName, $content, $utf8NoBom)
        Write-Host "Corrigido: $($file.Name)"
    }
}
