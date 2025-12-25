-- Create Feedbacks Table
create table public.feedbacks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  title text not null,
  description text not null,
  category text not null check (category in ('feature', 'bug', 'general', 'content', 'docs')),
  status text not null default 'open' check (status in ('open', 'planned', 'in_progress', 'completed', 'closed')),
  votes int not null default 0,
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.feedbacks enable row level security;

-- Policies
create policy "Feedbacks are viewable by everyone" 
  on public.feedbacks for select 
  using (true);

create policy "Users can create feedbacks" 
  on public.feedbacks for insert 
  with check (auth.uid() = user_id);

create policy "Users can update their own feedbacks" 
  on public.feedbacks for update 
  using (auth.uid() = user_id);

-- Create Votes Table
create table public.feedback_votes (
  feedback_id uuid references public.feedbacks(id) on delete cascade not null,
  user_id uuid references auth.users(id) not null,
  created_at timestamptz default now(),
  primary key (feedback_id, user_id)
);

-- Enable RLS
alter table public.feedback_votes enable row level security;

-- Policies
create policy "Votes are viewable by everyone" 
  on public.feedback_votes for select 
  using (true);

create policy "Users can check their own votes"
  on public.feedback_votes for select
  using (auth.uid() = user_id);

create policy "Users can insert their own vote" 
  on public.feedback_votes for insert 
  with check (auth.uid() = user_id);

create policy "Users can delete their own vote" 
  on public.feedback_votes for delete 
  using (auth.uid() = user_id);

-- Simple RPC to handle voting atomically (Optional but recommended, or do client-side optimistic)
-- For simplicity, we can trust the client to call insert/delete, but a trigger is better for the count.

-- Trigger to update vote count
create or replace function public.handle_new_vote() 
returns trigger as $$
begin
  update public.feedbacks 
  set votes = votes + 1 
  where id = new.feedback_id;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_vote_added
  after insert on public.feedback_votes
  for each row execute procedure public.handle_new_vote();

create or replace function public.handle_vote_removed() 
returns trigger as $$
begin
  update public.feedbacks 
  set votes = votes - 1 
  where id = old.feedback_id;
  return old;
end;
$$ language plpgsql security definer;

create trigger on_vote_removed
  after delete on public.feedback_votes
  for each row execute procedure public.handle_vote_removed();
