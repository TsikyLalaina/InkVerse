# Deployment Commands - Theme & Profile Photo

## Step 1: Install Dependencies

```bash
cd /home/lalaina/InkVerse/client
npm install @theme-toggles/react
```

## Step 2: Update Environment Variables

Edit `/home/lalaina/InkVerse/client/.env.local` and add:
```
NEXT_PUBLIC_SUPABASE_USER_PROFILE=userprofile
```

## Step 3: Supabase Setup

### 3a. Create Storage Bucket
Go to Supabase Dashboard → Storage → New Bucket
- Name: `userprofile`
- Public: Toggle ON
- Click "Create bucket"

### 3b. Set RLS Policy
Go to Storage → userprofile → Policies → New Policy
```
Policy Name: Users can upload their own photos
Allowed operations: SELECT, INSERT, UPDATE, DELETE
USING: auth.uid()::text = (storage.foldername(name))[1]
WITH CHECK: auth.uid()::text = (storage.foldername(name))[1]
```

### 3c. Run SQL Migrations
Go to Supabase Dashboard → SQL Editor → New Query

Copy and paste:
```sql
-- Add profile_photo column
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS profile_photo VARCHAR(500);

-- Add theme column
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS theme VARCHAR(20) DEFAULT 'system';

-- Create index for theme queries
CREATE INDEX IF NOT EXISTS idx_user_profile_theme 
ON public.user_profiles(theme);

-- Add comments for documentation
COMMENT ON COLUMN public.user_profiles.profile_photo IS 'URL to profile photo stored in Supabase Storage';
COMMENT ON COLUMN public.user_profiles.theme IS 'User theme preference: light or dark';
```

Then click "Run"

## Step 4: Restart Services

### Terminal 1 - Backend
```bash
cd /home/lalaina/InkVerse
npm run dev
```

### Terminal 2 - Frontend
```bash
cd /home/lalaina/InkVerse/client
npm run dev
```

## Step 5: Clear Cache

```bash
# Clear Next.js build cache
rm -rf /home/lalaina/InkVerse/client/.next

# Clear browser cache
# Chrome/Edge: Ctrl+Shift+Delete
# Mac: Cmd+Shift+Delete
# Select "All time"
# Check "Cookies and other site data" and "Cached images and files"
# Click "Clear data"

# Hard refresh browser
# Chrome/Edge: Ctrl+Shift+R
# Mac: Cmd+Shift+R
```

## Step 6: Verify Installation

1. Open browser to `http://localhost:3000/dashboard`
2. Click on user avatar (top right)
3. Click "Profile"
4. Verify:
   - [ ] Profile photo upload field at top
   - [ ] Classic theme toggle visible
   - [ ] Upload button works
   - [ ] Theme toggle animates smoothly
   - [ ] Can save profile
   - [ ] Theme persists on refresh

## Step 7: Test Features

### Test Profile Photo Upload
```
1. Click "Upload Photo" button
2. Select an image file (JPG, PNG, GIF, WebP)
3. Verify preview updates
4. Click "Save Profile"
5. Refresh page
6. Verify photo is still there
```

### Test Theme Toggle
```
1. Click the Classic theme toggle
2. Verify smooth 750ms animation
3. Verify page theme changes
4. Refresh page
5. Verify theme persists
6. Check localStorage (F12 → Application → Local Storage)
7. Verify "theme" key exists
```

### Test Database Persistence
```
1. Go to Supabase Dashboard
2. SQL Editor → New Query
3. Run: SELECT * FROM user_profiles WHERE user_id = 'your-user-id';
4. Verify profile_photo and theme columns have values
```

## Troubleshooting Commands

### Check if package is installed
```bash
cd /home/lalaina/InkVerse/client
npm list @theme-toggles/react
```

### Check environment variables
```bash
cd /home/lalaina/InkVerse/client
cat .env.local | grep NEXT_PUBLIC_SUPABASE_USER_PROFILE
```

### Check database schema
```sql
-- Run in Supabase SQL Editor
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
ORDER BY ordinal_position;
```

### Check storage bucket
```sql
-- Run in Supabase SQL Editor
SELECT * FROM storage.buckets WHERE name = 'userprofile';
```

### Check RLS policies
```sql
-- Run in Supabase SQL Editor
SELECT * FROM storage.policies 
WHERE bucket_id = (SELECT id FROM storage.buckets WHERE name = 'userprofile');
```

### Clear all caches (nuclear option)
```bash
# Clear Next.js cache
rm -rf /home/lalaina/InkVerse/client/.next

# Clear node_modules and reinstall (if needed)
cd /home/lalaina/InkVerse/client
rm -rf node_modules package-lock.json
npm install

# Clear browser cache (manual)
# Ctrl+Shift+Delete → Select all → Clear
```

## Production Deployment

### Deploy Backend to Railway
```bash
cd /home/lalaina/InkVerse
git add .
git commit -m "Add profile photo and theme support"
git push origin main
# Railway auto-deploys on push
```

### Deploy Frontend to Vercel
```bash
cd /home/lalaina/InkVerse/client
git add .
git commit -m "Add profile photo and theme support"
git push origin main
# Vercel auto-deploys on push
```

### Verify Production Environment Variables
1. Go to Vercel Dashboard
2. Project Settings → Environment Variables
3. Verify `NEXT_PUBLIC_SUPABASE_USER_PROFILE=userprofile` is set
4. Redeploy if needed

## Rollback (if needed)

### Rollback Database
```sql
-- Run in Supabase SQL Editor
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS profile_photo;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS theme;
DROP INDEX IF EXISTS idx_user_profile_theme;
```

### Rollback Code
```bash
git revert HEAD
git push origin main
```

## Success Criteria

✅ All of the following should be true:

1. Package installed: `npm list @theme-toggles/react` shows the package
2. Env var set: `.env.local` contains `NEXT_PUBLIC_SUPABASE_USER_PROFILE=userprofile`
3. Bucket created: Supabase Storage shows `userprofile` bucket
4. RLS policy set: Storage policies show the upload policy
5. Database updated: `user_profiles` table has `profile_photo` and `theme` columns
6. Services running: Backend and frontend both running without errors
7. UI works: Profile modal shows photo upload and theme toggle
8. Photo uploads: Can upload and see preview
9. Theme toggles: Can toggle theme and see animation
10. Data persists: Refresh page and data is still there

## Support

If you encounter issues:

1. Check the troubleshooting commands above
2. Review error messages in browser console (F12)
3. Check backend logs in terminal
4. Verify all steps were completed
5. Try clearing cache and restarting services
6. Check documentation files:
   - `THEME_IMPLEMENTATION_SETUP.md`
   - `QUICK_SETUP_THEME_PHOTO.md`
   - `IMPLEMENTATION_COMPLETE.md`

---

**Last Updated:** December 17, 2025
**Status:** Ready to Deploy
