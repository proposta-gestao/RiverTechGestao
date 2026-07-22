# 100% ASCII Powershell script
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
$files = Get-ChildItem -Path . -Recurse -Include *.html,*.js,*.md,*.css -Exclude *node_modules*,*.git*,*.gemini*

foreach ($f in $files) {
    if ($f.DirectoryName -match "node_modules" -or $f.DirectoryName -match ".gemini" -or $f.DirectoryName -match ".git") { continue }
    
    $content = [System.IO.File]::ReadAllText($f.FullName, $utf8NoBom)
    $original = $content
    
    $c1 = [char]195; $c2 = [char]167; $c3 = [char]163; $c4 = [char]181;
    $c5 = [char]161; $c6 = [char]169; $c7 = [char]173; $c8 = [char]179;
    $c9 = [char]186; $c10 = [char]170; $c11 = [char]162; $c12 = [char]180;
    
    # cao (231, 227)
    $content = $content.Replace("$c1$c2$c1$c3" + "o", "$([char]231)$([char]227)o")
    # coes (231, 245)
    $content = $content.Replace("$c1$c2$c1$c4" + "es", "$([char]231)$([char]245)es")
    # ao (227)
    $content = $content.Replace("$c1$c3" + "o", "$([char]227)o")
    # a (227)
    $content = $content.Replace("$c1$c3", "$([char]227)")
    # c (231)
    $content = $content.Replace("$c1$c2", "$([char]231)")
    # a (225)
    $content = $content.Replace("$c1$c5", "$([char]225)")
    # e (233)
    $content = $content.Replace("$c1$c6", "$([char]233)")
    # i (237)
    $content = $content.Replace("$c1$c7", "$([char]237)")
    # o (243)
    $content = $content.Replace("$c1$c8", "$([char]243)")
    # u (250)
    $content = $content.Replace("$c1$c9", "$([char]250)")
    # e (234)
    $content = $content.Replace("$c1$c10", "$([char]234)")
    # a (226)
    $content = $content.Replace("$c1$c11", "$([char]226)")
    # o (245)
    $content = $content.Replace("$c1$c4", "$([char]245)")
    # o (244)
    $content = $content.Replace("$c1$c12", "$([char]244)")
    
    # A (192)
    $content = $content.Replace("$c1$([char]128)", "$([char]192)")
    # a (224)
    $content = $content.Replace("$c1$([char]160)", "$([char]224)")
    # E (201)
    $content = $content.Replace("$c1$([char]137)", "$([char]201)")
    # A (193)
    $content = $content.Replace("$c1$([char]129)", "$([char]193)")
    # O (211)
    $content = $content.Replace("$c1$([char]147)", "$([char]211)")
    # U (218)
    $content = $content.Replace("$c1$([char]154)", "$([char]218)")
    # E (202)
    $content = $content.Replace("$c1$([char]138)", "$([char]202)")
    # A (194)
    $content = $content.Replace("$c1$([char]130)", "$([char]194)")
    # O (213)
    $content = $content.Replace("$c1$([char]149)", "$([char]213)")
    # O (212)
    $content = $content.Replace("$c1$([char]148)", "$([char]212)")
    # C (199)
    $content = $content.Replace("$c1$([char]135)", "$([char]199)")
    
    # deg (186)
    $content = $content.Replace("$([char]194)$([char]186)", "$([char]186)")
    # a (170)
    $content = $content.Replace("$([char]194)$([char]170)", "$([char]170)")
    # u (252)
    $content = $content.Replace("$c1$([char]188)", "$([char]252)")
    # I (205)
    $content = $content.Replace("$c1$([char]141)", "$([char]205)")
    
    # Another common bug:
    $content = $content.Replace("$([char]194)$([char]186)", "$([char]186)")
    
    if ($content.Length -ne $original.Length -or $content -cne $original) {
        [System.IO.File]::WriteAllText($f.FullName, $content, $utf8NoBom)
        Write-Host "Corrigido: $($f.Name)"
    }
}
Remove-Item .\fix_encoding_brute.ps1 -ErrorAction SilentlyContinue
Remove-Item .\fix_encoding_final.ps1 -ErrorAction SilentlyContinue
