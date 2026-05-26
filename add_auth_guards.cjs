const fs = require('fs');
const path = require('path');

// Pages that use user?.id from authStore and need a loading guard
const pagesToFix = [
  'src/pages/dashboard/DashboardPage.tsx',
  'src/pages/dashboard/MessagesPage.tsx',
  'src/pages/dashboard/SearchPage.tsx',
  'src/pages/dashboard/MatchesPage.tsx',
  'src/pages/dashboard/InterestsPage.tsx',
  'src/pages/dashboard/ShortlistPage.tsx',
  'src/pages/dashboard/WhoViewedMePage.tsx',
  'src/pages/dashboard/MyProfilePage.tsx',
  'src/pages/dashboard/SettingsPage.tsx',
  'src/pages/dashboard/ViewProfilePage.tsx',
  'src/pages/dashboard/CompleteProfilePage.tsx',
  'src/pages/PendingApprovalPage.tsx',
];

const baseDir = 'c:/Users/ADMIN/OneDrive/Pictures/New Shubh Milan App/New Shubh Milan App';

pagesToFix.forEach(rel => {
  const filePath = path.join(baseDir, rel);
  if (!fs.existsSync(filePath)) {
    console.log('SKIP (not found): ' + rel);
    return;
  }
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Check if file already has the auth guard
  if (content.includes('authLoading') || content.includes('if (!user) return')) {
    console.log('SKIP (already has guard): ' + rel);
    return;
  }

  // Find the useAuthStore destructure line and add authLoading
  // Pattern: const { user, ... } = useAuthStore()
  // or const { user, profile, ... } = useAuthStore()
  const authStoreMatch = content.match(/const\s*\{([^}]+)\}\s*=\s*useAuthStore\(\)/);
  if (!authStoreMatch) {
    console.log('SKIP (no useAuthStore): ' + rel);
    return;
  }

  const destructured = authStoreMatch[1];
  
  // Check if 'loading' is already destructured
  if (destructured.includes('loading')) {
    // Rename loading to authLoading if it's the auth store loading
    content = content.replace(
      /const\s*\{([^}]*)\bloading\b([^}]*)\}\s*=\s*useAuthStore\(\)/,
      (match, before, after) => {
        return `const {${before}loading: authLoading${after}} = useAuthStore()`;
      }
    );
  } else {
    // Add authLoading to the destructure
    content = content.replace(
      /const\s*\{([^}]+)\}\s*=\s*useAuthStore\(\)/,
      `const {$1, loading: authLoading} = useAuthStore()`
    );
  }

  // Now find the first return statement (the component's render) and add a guard before it
  // We look for the pattern: if (loading) return ... OR just the first JSX return
  // Insert guard after all the useState/useEffect hooks but before first conditional return or main return
  
  // Strategy: find "  if (loading" or "  return (" in the component body, insert before it
  // but only if we haven't already added the guard
  
  // Add guard after useAuthStore line
  const guardCode = `
  // Guard: wait for auth to be ready before rendering
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
      </div>
    )
  }
  if (!user) return null
`;

  // Find a good insertion point: after all the hook declarations, before first return or if(loading)
  // Look for the first "  return (" or "  if (loading" that is in the main function body
  const insertAfterPattern = /(\n  \/\/ .*\n  if \(loading)/;
  const simpleReturnPattern = /(\n  if \(loading\b)/;
  
  if (simpleReturnPattern.test(content)) {
    content = content.replace(simpleReturnPattern, guardCode + '$1');
    console.log('PATCHED (before loading check): ' + rel);
  } else {
    // Insert before the final return statement in the component
    // Find "  return (" that is not inside a nested function
    const returnMatch = content.match(/\n  return \(\n/);
    if (returnMatch) {
      content = content.replace(/(\n  return \(\n)/, guardCode + '$1');
      console.log('PATCHED (before return): ' + rel);
    } else {
      console.log('SKIP (cannot find insertion point): ' + rel);
    }
  }

  fs.writeFileSync(filePath, content);
});

console.log('\nAll done!');
