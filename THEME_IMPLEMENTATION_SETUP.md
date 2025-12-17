# Theme & Profile Photo Implementation - Setup Guide

## Overview
Implemented dark/light theme toggle with the `@theme-toggles/react` Classic component and profile photo upload to Supabase Storage.

## Installation Steps

### Step 1: Install Theme Toggle Package

```bash
cd client
npm install @theme-toggles/react
```

### Step 2: Update Environment Variables

Add to `/home/lalaina/InkVerse/client/.env.local`:
```
NEXT_PUBLIC_SUPABASE_USER_PROFILE=userprofile
```

### Step 3: Create Supabase Storage Bucket

1. Go to Supabase Dashboard → Storage
2. Click "New bucket"
3. Name: `userprofile`
4. Make it public
5. Click "Create bucket"

### Step 4: Set Storage RLS Policies

Go to Storage → userprofile → Policies and create:

**Policy Name:** "Users can upload their own photos"
- **Allowed operations:** SELECT, INSERT, UPDATE, DELETE
- **USING:** `auth.uid()::text = (storage.foldername(name))[1]`
- **WITH CHECK:** `auth.uid()::text = (storage.foldername(name))[1]`

### Step 5: Update Database Schema

Run in Supabase SQL Editor:

```sql
-- Add profile_photo column
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS profile_photo VARCHAR(500);

-- Add theme column
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS theme VARCHAR(20) DEFAULT 'system';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_profile_theme ON public.user_profiles(theme);
```

### Step 6: Restart Services

```bash
# Backend
npm run dev

# Frontend (in another terminal)
cd client && npm run dev
```

### Step 7: Clear Cache

```bash
# Clear Next.js build
rm -rf client/.next

# Clear browser cache (Ctrl+Shift+Delete)
# Hard refresh (Ctrl+Shift+R)
```

## Features Implemented

### Profile Photo Upload
- **Location:** Profile tab at the top
- **Storage:** Supabase Storage (userprofile bucket)
- **Max size:** 5MB
- **Formats:** JPG, PNG, GIF, WebP
- **Preview:** Circular 64x64px thumbnail
- **Upload status:** Shows uploading/uploaded/error states

### Theme Toggle
- **Component:** @theme-toggles/react Classic toggle
- **Options:** Light and Dark modes
- **Duration:** 750ms smooth animation
- **Storage:** Persisted in database and localStorage
- **Global:** Applies to entire application via ThemeProvider

## File Changes

### New Files Created
1. `/home/lalaina/InkVerse/client/src/components/providers/ThemeProvider.tsx`
   - Manages theme state globally
   - Applies theme class to document
   - Syncs with localStorage
   - Listens for system theme changes

### Modified Files
1. `/home/lalaina/InkVerse/client/src/components/ProfileSettingsModal.tsx`
   - Profile photo upload moved to top
   - Theme toggle using Classic component
   - Integrates with global ThemeProvider
   - Uses NEXT_PUBLIC_SUPABASE_USER_PROFILE env var

2. `/home/lalaina/InkVerse/client/src/app/layout.tsx`
   - Added ThemeProvider wrapper
   - Added suppressHydrationWarning to html tag
   - Added dark mode CSS classes to body

3. `/home/lalaina/InkVerse/prisma/schema.prisma`
   - Added profilePhoto field to UserProfile
   - Added theme field to UserProfile

4. `/home/lalaina/InkVerse/src/routes/user.ts`
   - Updated GET /api/user/profile to return profilePhoto and theme
   - Updated PATCH /api/user/profile to accept profilePhoto and theme

## How It Works

### Theme Application Flow
1. **On App Load:**
   - ThemeProvider checks localStorage for saved theme
   - If not found, defaults to "system"
   - Applies appropriate class to document root

2. **User Toggles Theme:**
   - Classic component changes state
   - Global theme is updated via setGlobalTheme()
   - Document class is updated (adds/removes "dark" class)
   - Theme is saved to localStorage
   - Theme is saved to database on profile save

3. **System Theme Changes:**
   - If theme is "system", listens for OS preference changes
   - Automatically updates when user changes OS theme

### Photo Upload Flow
1. **User selects image:**
   - File is validated (type and size)
   - Uploaded to Supabase Storage (userprofile bucket)
   - Public URL is generated
   - Preview is updated immediately

2. **User saves profile:**
   - Photo URL is sent to backend
   - Stored in database
   - Persisted across sessions

## CSS Dark Mode Support

The application uses Tailwind's dark mode with class strategy:

```html
<!-- Light mode (default) -->
<html lang="en">
  <body class="bg-slate-950 text-slate-100">

<!-- Dark mode -->
<html lang="en" class="dark">
  <body class="dark:bg-slate-950 dark:text-slate-100">
```

To use dark mode classes in your components:
```jsx
<div className="bg-white dark:bg-slate-900 text-black dark:text-white">
  Content
</div>
```

## API Endpoints

### GET /api/user/profile
Returns:
```json
{
  "userId": "...",
  "email": "user@example.com",
  "username": "john_doe",
  "profilePhoto": "https://...",
  "theme": "dark"
}
```

### PATCH /api/user/profile
Accepts:
```json
{
  "username": "john_doe",
  "profilePhoto": "https://...",
  "theme": "dark"
}
```

## Testing Checklist

- [ ] Install @theme-toggles/react package
- [ ] Add NEXT_PUBLIC_SUPABASE_USER_PROFILE to .env.local
- [ ] Create userprofile bucket in Supabase
- [ ] Set RLS policies on bucket
- [ ] Run database migrations
- [ ] Restart services
- [ ] Clear cache
- [ ] Upload profile photo
- [ ] Toggle theme (should animate smoothly)
- [ ] Refresh page (theme should persist)
- [ ] Check localStorage (should have theme key)
- [ ] Check database (should have profilePhoto and theme)
- [ ] Test on different OS theme settings

## Troubleshooting

### Photo upload fails
- Check bucket exists and is public
- Verify RLS policies are correct
- Check browser console for errors
- Verify NEXT_PUBLIC_SUPABASE_USER_PROFILE env var

### Theme not applying
- Check ThemeProvider is in layout
- Verify suppressHydrationWarning is on html tag
- Check browser console for errors
- Clear localStorage and try again

### Classic toggle not showing
- Install @theme-toggles/react package
- Check CSS import is present
- Verify component is imported correctly

### Theme not persisting
- Check localStorage is enabled
- Check database has theme column
- Verify PATCH endpoint is working

## Color Scheme Customization

To customize the Classic toggle colors, you can override the CSS:

```css
/* In your globals.css */
.tt--classic {
  --toggle-bg: #your-color;
  --toggle-dot: #your-color;
}

.tt--classic:hover {
  --toggle-bg: #your-hover-color;
}
```

## Performance Notes

- Theme is applied synchronously on mount to prevent flash
- localStorage is used for instant persistence
- Database sync happens on profile save
- No additional API calls for theme application

## Future Enhancements

1. **System Theme Sync:** Auto-detect and apply OS theme
2. **Theme Scheduling:** Set theme based on time of day
3. **Custom Themes:** Allow users to create custom color schemes
4. **Theme Preview:** Show preview before saving
5. **Accessibility:** High contrast theme option

---

**Implementation Date:** December 17, 2025
**Status:** Ready for Testing
