# Profile Photo & Theme Implementation Guide

## Overview
Added profile photo upload and dark/light theme toggle to the user profile modal.

## Changes Made

### 1. Database Schema (Prisma)
**File:** `/home/lalaina/InkVerse/prisma/schema.prisma`

Added two new fields to `UserProfile` model:
```prisma
profilePhoto String?   @map("profile_photo")  // URL to profile photo
theme        String    @default("system")     // "light", "dark", or "system"
```

### 2. Backend API Updates
**File:** `/home/lalaina/InkVerse/src/routes/user.ts`

#### GET /api/user/profile
Returns profile data including new fields:
```json
{
  "userId": "...",
  "email": "user@example.com",
  "username": "john_doe",
  "profilePhoto": "https://...",
  "theme": "dark"
}
```

#### PATCH /api/user/profile
Now accepts profilePhoto and theme:
```json
{
  "username": "john_doe",
  "profilePhoto": "https://...",
  "theme": "dark"
}
```

### 3. Frontend Components
**File:** `/home/lalaina/InkVerse/client/src/components/ProfileSettingsModal.tsx`

#### New State Variables:
- `profilePhoto` - Stores profile photo URL
- `theme` - Stores theme preference (light/dark/system)
- `uploadingPhoto` - Loading state for photo upload

#### New Functions:
- `handlePhotoUpload()` - Uploads photo to Supabase Storage
- Updated `loadProfile()` - Fetches profilePhoto and theme
- Updated `handleSaveProfile()` - Saves all fields

#### New UI Elements:
- Profile photo preview (circular 64x64px)
- Upload button with file input
- Theme toggle buttons (Light/Dark/System)

## Setup Instructions

### Step 1: Update Database Schema

**Option A: Using Prisma Migration (Recommended)**
```bash
npx prisma migrate dev --name add_profile_photo_theme
```

**Option B: Direct SQL in Supabase**
1. Go to Supabase Dashboard → SQL Editor
2. Create new query
3. Copy and paste contents of `SQL_PROFILE_PHOTO_THEME.sql`
4. Execute

### Step 2: Create Storage Bucket

1. Go to Supabase Dashboard → Storage
2. Click "New bucket"
3. Name: `profile-photos`
4. Make it public
5. Click "Create bucket"

### Step 3: Set Storage Policies

1. Go to Storage → profile-photos → Policies
2. Create new policy:
   - **Name:** "Users can upload their own photos"
   - **Allowed operations:** SELECT, INSERT, UPDATE, DELETE
   - **USING:** `auth.uid() = (storage.foldername(name))[1]::uuid`
   - **WITH CHECK:** `auth.uid() = (storage.uid())`

### Step 4: Restart Services

```bash
# Backend
npm run dev

# Frontend (in another terminal)
cd client && npm run dev
```

### Step 5: Clear Cache

- Clear browser cache (Ctrl+Shift+Delete)
- Hard refresh (Ctrl+Shift+R)
- Clear Next.js build: `rm -rf client/.next`

## Features

### Profile Photo Upload
- **Max size:** 5MB
- **Formats:** JPG, PNG, GIF, WebP
- **Storage:** Supabase Storage (profile-photos bucket)
- **Preview:** Shows circular 64x64px thumbnail
- **Validation:** File type and size checked before upload

### Theme Toggle
- **Options:** Light, Dark, System
- **Default:** System (follows OS preference)
- **Storage:** Saved in database
- **UI:** Three toggle buttons with icons (Sun, Moon, Computer)

## API Responses

### Profile Photo
- Stored as URL in `profile_photo` column
- Uploaded to `profile-photos` bucket in Supabase Storage
- Public URL returned for display
- Filename format: `{userId}-{timestamp}.jpg`

### Theme
- Stored as string: "light", "dark", or "system"
- Default value: "system"
- Validated on backend (only accepts valid values)

## Frontend Flow

1. **User opens Profile modal**
   - Profile data loaded (including profilePhoto and theme)
   - Photo preview displayed (or placeholder)
   - Theme buttons show current selection

2. **User uploads photo**
   - File validated (type and size)
   - Uploaded to Supabase Storage
   - Public URL stored in state
   - Preview updated immediately

3. **User selects theme**
   - Theme state updated
   - Button highlights selected option

4. **User clicks "Save Profile"**
   - All fields sent to backend (username, profilePhoto, theme)
   - Backend validates and saves
   - Success message shown

## Error Handling

### Photo Upload Errors:
- "Please select an image file" - Wrong file type
- "Image must be less than 5MB" - File too large
- "Failed to upload photo" - Storage error
- "User not authenticated" - Auth issue

### Profile Save Errors:
- Username validation errors
- Theme validation errors
- Backend errors

## Database Queries

### Get user's profile photo
```sql
SELECT profile_photo FROM user_profiles WHERE user_id = 'user-uuid';
```

### Get users by theme
```sql
SELECT * FROM user_profiles WHERE theme = 'dark';
```

### Update profile photo
```sql
UPDATE user_profiles SET profile_photo = 'url' WHERE user_id = 'user-uuid';
```

## File Locations

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | Updated UserProfile model |
| `src/routes/user.ts` | Updated API endpoints |
| `client/src/components/ProfileSettingsModal.tsx` | Updated modal UI |
| `SQL_PROFILE_PHOTO_THEME.sql` | SQL commands for Supabase |

## Testing Checklist

- [ ] Upload profile photo (valid image)
- [ ] Try uploading non-image file (should error)
- [ ] Try uploading >5MB file (should error)
- [ ] Photo preview updates after upload
- [ ] Toggle between Light/Dark/System themes
- [ ] Save profile with all fields
- [ ] Refresh page and verify data persists
- [ ] Check Supabase Storage for uploaded files
- [ ] Verify database has correct values

## Troubleshooting

### Photo upload fails
- Check Supabase Storage bucket exists and is public
- Verify RLS policies are set correctly
- Check browser console for errors
- Verify Supabase credentials in .env

### Theme not saving
- Check backend is running
- Verify theme value is valid (light/dark/system)
- Check database for errors in logs

### Photo URL not displaying
- Verify bucket is public
- Check URL format in database
- Try accessing URL directly in browser

## Future Enhancements

1. **Photo Cropping:** Add image cropping before upload
2. **Photo Filters:** Add filters/effects
3. **Multiple Photos:** Support multiple profile photos
4. **Theme Sync:** Sync theme across devices
5. **Custom Themes:** Allow custom color schemes
6. **Photo Gallery:** Show photo upload history

---

**Implementation Date:** December 17, 2025
**Status:** Complete and Ready for Testing
