const fs = require('fs');
const path = require('path');
function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      results.push(file);
    }
  });
  return results;
}
const files = walk('c:/Users/ADMIN/OneDrive/Pictures/New Shubh Milan App/New Shubh Milan App/src');
let changedFiles = 0;
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  const original = content;
  content = content.replace(/user!\.id/g, "(user?.id || '')");
  content = content.replace(/profile!\.id/g, "(profile?.id || '')");
  if (content !== original) {
    fs.writeFileSync(file, content);
    changedFiles++;
    console.log('Updated: ' + file);
  }
});
console.log('Total files updated: ' + changedFiles);
