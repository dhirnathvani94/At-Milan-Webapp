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
  
  if (!content.includes(`import { ${skeletonName} }`)) {
    const importStmt = `import { ${skeletonName} } from '../../components/ui/Skeletons';\n`;
    const lastImportIndex = content.lastIndexOf('import ');
    if (lastImportIndex !== -1) {
      const endOfImport = content.indexOf('\n', lastImportIndex);
      content = content.substring(0, endOfImport + 1) + importStmt + content.substring(endOfImport + 1);
    } else {
      content = importStmt + content;
    }
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Added import to ${file}`);
  }
}
