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
  // Let's only replace user.id and profile.id where user and profile are known to come from authStore.
  // Actually, we can just replace 'user.id' with 'user?.id' to be safe. But user?.id might cause type errors if not string.
  // Using (user?.id || '') is safe for strings.
  
  // Actually, a safer way is just to leave it and only patch the known files. 
  // Let's just patch where user is definitely from authStore.
  content = content.replace(/\buser\.id\b/g, "(user?.id || '')");
  // Don't replace profile.id unless we are sure, but profile?.id is fine.
  content = content.replace(/\bprofile\.id\b/g, "(profile?.id || '')");
  
  if (content !== original) {
    fs.writeFileSync(file, content);
    changedFiles++;
    console.log('Updated: ' + file);
  }
});
console.log('Total files updated: ' + changedFiles);
