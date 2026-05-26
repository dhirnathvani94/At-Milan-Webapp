const fs = require('fs');
const path = require('path');

const adminDir = path.join(__dirname, 'src', 'pages', 'admin');
const files = fs.readdirSync(adminDir).filter(f => f.endsWith('.tsx'));

const mappings = {
  'AdminAnalytics.tsx': 'AdminDashboardSkeleton',
  'AdminContacts.tsx': 'AdminTableSkeleton',
  'AdminContentCMS.tsx': 'PageSkeleton',
  'AdminFinancials.tsx': 'AdminTableSkeleton',
  'AdminLegalPages.tsx': 'PageSkeleton',
  'AdminNotifications.tsx': 'PageSkeleton',
  'AdminReports.tsx': 'AdminTableSkeleton',
  'AdminSEOMarketing.tsx': 'PageSkeleton',
  'AdminSettings.tsx': 'PageSkeleton',
  'AdminSuccessStories.tsx': 'AdminTableSkeleton',
  'AdminUnblockRequests.tsx': 'AdminTableSkeleton',
  'AdminUserDetail.tsx': 'ProfileDetailSkeleton',
  'AdminVerificationPage.tsx': 'AdminTableSkeleton'
};

for (const file of files) {
  if (!mappings[file]) continue;
  
  const skeletonName = mappings[file];
  const filePath = path.join(adminDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  const originalContent = content;
  
  // Replace full-page loading spinners with the skeleton
  const regex1 = /<div className="[^"]*(min-h-\[\w+\]|py-20|py-16|py-12|py-6|flex justify-center|flex items-center justify-center)[^"]*">\s*<Spinner size="(lg|md)" \/>\s*<\/div>/g;
  
  // Table colspans
  const regexTable = /<tr>\s*<td colSpan={([0-9]+)}\s*className="[^"]*">\s*<Spinner size="(lg|md)" \/>\s*<\/td>\s*<\/tr>/g;
  
  // Return statements
  const regexReturn = /return\s+<Spinner size="(lg|md)" \/>/g;
  const regexReturnDiv = /return\s+<div[^>]*>\s*<Spinner size="(lg|md)" \/>\s*<\/div>\s*;/g;
  
  content = content.replace(regex1, `<${skeletonName} />`);
  content = content.replace(regexTable, `<tr><td colSpan={$1} className="p-0"><${skeletonName} /></td></tr>`);
  content = content.replace(regexReturn, `return <${skeletonName} />`);
  content = content.replace(regexReturnDiv, `return <${skeletonName} />;`);
  
  // special case for AdminUnblockRequests inline usage
  content = content.replace(/{loading \? <Spinner size="lg" \/> : /g, `{loading ? <${skeletonName} /> : `);

  if (content !== originalContent) {
    // Add import if not present
    if (!content.includes(skeletonName)) {
      const importStmt = `import { ${skeletonName} } from '../../components/ui/Skeletons';\n`;
      const lastImportIndex = content.lastIndexOf('import ');
      if (lastImportIndex !== -1) {
        const endOfImport = content.indexOf('\n', lastImportIndex);
        content = content.substring(0, endOfImport + 1) + importStmt + content.substring(endOfImport + 1);
      } else {
        content = importStmt + content;
      }
    }
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${file}`);
  }
}
