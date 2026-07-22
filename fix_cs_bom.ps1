$code = @"
using System;
using System.IO;
using System.Text;

public class Fixer {
    public static void Run() {
        string dir = @".";
        string[] files = Directory.GetFiles(dir, "*.*", SearchOption.AllDirectories);
        foreach (string f in files) {
            if (f.Contains("node_modules") || f.Contains(".gemini") || f.Contains(".git")) continue;
            if (!f.EndsWith(".html") && !f.EndsWith(".js") && !f.EndsWith(".md") && !f.EndsWith(".css")) continue;
            
            string content = File.ReadAllText(f, new UTF8Encoding(false));
            string orig = content;
            
            content = content.Replace("Ã§Ã£o", "ção");
            content = content.Replace("Ã§Ãµes", "ções");
            content = content.Replace("Ã£o", "ão");
            content = content.Replace("Ã£", "ã");
            content = content.Replace("Ã§", "ç");
            content = content.Replace("Ã¡", "á");
            content = content.Replace("Ã©", "é");
            content = content.Replace("Ã³", "ó");
            content = content.Replace("Ãº", "ú");
            content = content.Replace("Ãª", "ê");
            content = content.Replace("Ã¢", "â");
            content = content.Replace("Ãµ", "õ");
            content = content.Replace("Ã´", "ô");
            content = content.Replace("Ã€", "À");
            content = content.Replace("Ã ", "à");
            content = content.Replace("Ã‰", "É");
            content = content.Replace("Ã ", "Á");
            content = content.Replace("Ã“", "Ó");
            content = content.Replace("Ãš", "Ú");
            content = content.Replace("ÃŠ", "Ê");
            content = content.Replace("Ã‚", "Â");
            content = content.Replace("Ã•", "Õ");
            content = content.Replace("Ã”", "Ô");
            content = content.Replace("Ã‡", "Ç");
            content = content.Replace("Âº", "º");
            content = content.Replace("Âª", "ª");
            content = content.Replace("Ã¼", "ü");
            content = content.Replace("Ã\xad", "í");
            content = content.Replace("Ã­", "í");
            
            if (content != orig) {
                File.WriteAllText(f, content, new UTF8Encoding(false));
                Console.WriteLine("Corrigido: " + f);
            }
        }
    }
}
"@
Add-Type -TypeDefinition $code -Language CSharp
[Fixer]::Run()
