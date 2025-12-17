# Quick Setup: Theme & Profile Photo

## 1. Install Package
```bash
cd client
npm install @theme-toggles/react
```

## 2. Add Environment Variable
File: `client/.env.local`
```
NEXT_PUBLIC_SUPABASE_USER_PROFILE=userprofile
```

## 3. Create Supabase Storage Bucket
- Dashboard → Storage → New bucket
- Name: `userprofile`
- Make public
- Create

## 4. Set RLS Policy
- Storage → userprofile → Policies → New Policy
- Name: "Users can upload their own photos"
- Operations: SELECT, INSERT, UPDATE, DELETE
- USING: `auth.uid()::text = (storage.foldername(name))[1]`
- WITH CHECK: `auth.uid()::text = (storage.foldername(name))[1]`

## 5. Database Migration
Run in Supabase SQL Editor:
```sql
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS profile_photo VARCHAR(500);

ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS theme VARCHAR(20) DEFAULT 'system';

CREATE INDEX IF NOT EXISTS idx_user_profile_theme ON public.user_profiles(theme);
```

## 6. Restart & Clear Cache
```bash
# Terminal 1: Backend
npm run dev

# Terminal 2: Frontend
cd client && npm run dev

# Clear cache
rm -rf client/.next
# Browser: Ctrl+Shift+Delete then Ctrl+Shift+R
```

## 7. Test
1. Open Profile modal
2. Upload a photo (top of form)
3. Toggle theme with Classic switch
4. Save profile
5. Refresh page - theme and photo should persist

## Files Changed
- ✅ `ProfileSettingsModal.tsx` - Photo upload moved to top, Classic theme toggle
- ✅ `ThemeProvider.tsx` - New global theme manager
- ✅ `layout.tsx` - Added ThemeProvider wrapper
- ✅ `schema.prisma` - Added profilePhoto and theme fields
- ✅ `user.ts` - Updated API endpoints

## Features
- 📸 Profile photo upload to Supabase Storage
- 🌓 Dark/Light theme toggle with smooth animation
- 💾 Theme persists in localStorage and database
- 🎨 Global theme application via ThemeProvider
- ⚡ 750ms smooth animation on toggle

---

**Status:** Ready to implement
