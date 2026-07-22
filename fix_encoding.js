const fs = require('fs');
const path = require('path');

const dir = 'c:/Users/x17198829/Documents/GitHub/RiverTechGestao';

const map = {
    'ção': 'ção',
    'ções': 'ções',
    'ão': 'ão',
    'ã': 'ã',
    'ç': 'ç',
    'á': 'á',
    'é': 'é',
    'ó': 'ó',
    'ú': 'ú',
    'ê': 'ê',
    'â': 'â',
    'õ': 'õ',
    'ô': 'ô',
    'À': 'À',
    'à': 'à',
    'É': 'É',
    'à': 'Á',
    'Ó': 'Ó',
    'Ú': 'Ú',
    'Ê': 'Ê',
    'Â': 'Â',
    'Õ': 'Õ',
    'Ô': 'Ô',
    'Ç': 'Ç',
    'º': 'º',
    'ª': 'ª',
    'ü': 'ü',
    'Ã\\xad': 'í',
    'Ã\\x8d': 'Í',
    'í': 'í'
};

function processDirectory(directory) {
    const files = fs.readdirSync(directory);
    for (const file of files) {
        const fullPath = path.join(directory, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory() && !fullPath.includes('.git') && !fullPath.includes('node_modules')) {
            processDirectory(fullPath);
        } else if (stat.isFile() && (fullPath.endsWith('.html') || fullPath.endsWith('.js') || fullPath.endsWith('.md') || fullPath.endsWith('.css'))) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let originalContent = content;
            for (const [bad, good] of Object.entries(map)) {
                content = content.split(bad).join(good);
            }
            if (content !== originalContent) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log('Fixed:', fullPath);
            }
        }
    }
}
processDirectory(dir);
console.log('Done');
