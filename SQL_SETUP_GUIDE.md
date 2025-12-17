# SQL Setup Guide for Supabase

## Direct SQL Implementation (Without Prisma)

If you prefer to set up the database directly in Supabase without using Prisma migrations, follow these steps:

### Step 1: Open Supabase SQL Editor

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your InkVerse project
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**

### Step 2: Copy and Paste SQL Commands

Copy the entire SQL block below and paste it into the SQL Editor:

```sql
-- ============================================================================
-- InkVerse: User Profile Table Creation
-- ============================================================================

-- Create the user_profiles table
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  username VARCHAR(20) NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_profile_user_id ON public.user_profiles(user_id);

-- Create index on username for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_profile_username ON public.user_profiles(username);

-- Enable Row Level Security (RLS) for security
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policy: Users can view their own profile
CREATE POLICY "Users can view their own profile" ON public.user_profiles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create RLS policy: Users can update their own profile
CREATE POLICY "Users can update their own profile" ON public.user_profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create RLS policy: Users can insert their own profile
CREATE POLICY "Users can insert their own profile" ON public.user_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create RLS policy: Allow public read access to usernames (for future public profiles)
CREATE POLICY "Public can view usernames" ON public.user_profiles
  FOR SELECT
  USING (true);

-- Create trigger function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_user_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_profiles_updated_at();
```

### Step 3: Execute the Query

Click the **Run** button (or press `Ctrl+Enter` / `Cmd+Enter`)

You should see:
```
Query executed successfully
```

### Step 4: Verify the Setup

Run these verification queries one by one:

#### Check if table exists:
```sql
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'user_profiles'
);
```
Expected result: `true`

#### Check table structure:
```sql
\d public.user_profiles
```
Expected columns: `id`, `user_id`, `username`, `created_at`, `updated_at`

#### Check indexes:
```sql
SELECT indexname FROM pg_indexes WHERE tablename = 'user_profiles';
```
Expected indexes: `user_profiles_pkey`, `idx_user_profile_user_id`, `idx_user_profile_username`

#### Check RLS policies:
```sql
SELECT policyname, permissive, roles, qual, with_check 
FROM pg_policies 
WHERE tablename = 'user_profiles';
```
Expected policies: 4 policies (select, update, insert, public select)

## Alternative: Using Prisma Migration

If you prefer using Prisma (recommended for version control):

```bash
# Generate migration
npx prisma migrate dev --name add_user_profile

# This will:
# 1. Create the migration file
# 2. Apply it to your database
# 3. Generate Prisma client
```

## Troubleshooting

### Error: "relation 'user_profiles' already exists"
- The table already exists
- Either drop it first or use `CREATE TABLE IF NOT EXISTS` (already in script)

### Error: "permission denied for schema public"
- Check your Supabase role has proper permissions
- Use service role key if needed

### Error: "function 'update_user_profiles_updated_at' already exists"
- Use `CREATE OR REPLACE FUNCTION` (already in script)
- Or drop and recreate

### RLS policies not working
- Verify RLS is enabled: `ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;`
- Check policies are created: Query `pg_policies`
- Verify user is authenticated when testing

## Rollback (If Needed)

To remove the table and all related objects:

```sql
-- Drop trigger first
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;

-- Drop function
DROP FUNCTION IF EXISTS public.update_user_profiles_updated_at();

-- Drop table (this also drops indexes and policies)
DROP TABLE IF EXISTS public.user_profiles;
```

## What Gets Created

| Object | Type | Purpose |
|--------|------|---------|
| `user_profiles` | Table | Stores username and user_id |
| `idx_user_profile_user_id` | Index | Fast lookup by user_id |
| `idx_user_profile_username` | Index | Fast lookup by username |
| `update_user_profiles_updated_at` | Function | Auto-updates timestamp |
| `update_user_profiles_updated_at` | Trigger | Calls function on update |
| 4x RLS Policies | Policies | Control data access |

## Testing the Setup

After setup, test with these SQL queries:

### Insert a test user profile:
```sql
INSERT INTO public.user_profiles (user_id, username)
VALUES ('550e8400-e29b-41d4-a716-446655440000', 'testuser')
RETURNING *;
```

### Query the profile:
```sql
SELECT * FROM public.user_profiles 
WHERE username = 'testuser';
```

### Update the profile:
```sql
UPDATE public.user_profiles 
SET username = 'testuser_updated'
WHERE username = 'testuser'
RETURNING *;
```

### Check updated_at was updated:
```sql
SELECT username, updated_at FROM public.user_profiles 
WHERE username = 'testuser_updated';
```

### Try to insert duplicate username (should fail):
```sql
INSERT INTO public.user_profiles (user_id, username)
VALUES ('550e8400-e29b-41d4-a716-446655440001', 'testuser_updated');
```
Expected error: `duplicate key value violates unique constraint`

### Clean up test data:
```sql
DELETE FROM public.user_profiles 
WHERE username LIKE 'testuser%';
```

## Next Steps

1. ✅ Run the SQL commands above
2. ✅ Verify the setup with verification queries
3. ✅ Restart your backend server
4. ✅ Test the Profile modal in your app
5. ✅ Create your first username!

## Support

If you encounter issues:

1. Check Supabase logs: Dashboard → Logs
2. Verify table exists: `\dt public.user_profiles`
3. Check RLS is enabled: `SELECT relrowsecurity FROM pg_class WHERE relname = 'user_profiles';`
4. Review this guide for troubleshooting section

---

**Last Updated:** December 17, 2025
