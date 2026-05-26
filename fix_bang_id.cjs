const fs = require('fs');

// Fix AdminUserDetail.tsx - adminUser!.id and id!
const f1 = 'c:/Users/ADMIN/OneDrive/Pictures/New Shubh Milan App/New Shubh Milan App/src/pages/admin/AdminUserDetail.tsx';
let c1 = fs.readFileSync(f1, 'utf8');
c1 = c1.replace(/adminUser!\.id/g, "(adminUser?.id || '')");
c1 = c1.replace(/\bid!\b/g, "(id || '')");
fs.writeFileSync(f1, c1);
console.log('Fixed AdminUserDetail.tsx');

// Fix InterestsPage.tsx - myProfile!.first_name
const f2 = 'c:/Users/ADMIN/OneDrive/Pictures/New Shubh Milan App/New Shubh Milan App/src/pages/dashboard/InterestsPage.tsx';
let c2 = fs.readFileSync(f2, 'utf8');
c2 = c2.replace(/myProfile!\.first_name/g, "(myProfile?.first_name || '')");
fs.writeFileSync(f2, c2);
console.log('Fixed InterestsPage.tsx');

console.log('Done!');
