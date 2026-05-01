-- Enums
CREATE TYPE meeting_status AS ENUM ('scheduled', 'in_progress', 'completed', 'canceled');
CREATE TYPE participant_role AS ENUM ('host', 'co-host', 'participant');
CREATE TYPE team_role AS ENUM ('owner', 'admin', 'member');
CREATE TYPE action_status AS ENUM ('pending', 'completed');
CREATE TYPE theme_preference AS ENUM ('light', 'dark', 'system');

-- =========================================
-- TABLES
-- =========================================

-- Public Profiles
CREATE TABLE public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name text,
    avatar_url text,
    created_at timestamptz DEFAULT timezone('utc', now()),
    updated_at timestamptz DEFAULT timezone('utc', now())
);

-- Teams
CREATE TABLE public.teams (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT timezone('utc', now())
);

-- Team Members
CREATE TABLE public.team_members (
    team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role team_role DEFAULT 'member',
    joined_at timestamptz DEFAULT timezone('utc', now()),
    PRIMARY KEY (team_id, user_id)
);

-- Meetings
CREATE TABLE public.meetings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, -- Host
    team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
    title text NOT NULL,
    description text,
    status meeting_status DEFAULT 'scheduled',
    scheduled_for timestamptz,
    is_archived boolean DEFAULT false,
    created_at timestamptz DEFAULT timezone('utc', now()),
    updated_at timestamptz DEFAULT timezone('utc', now())
);

-- Meeting Participants
CREATE TABLE public.meeting_participants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    email text NOT NULL, -- For guest participants without an account
    role participant_role DEFAULT 'participant',
    added_at timestamptz DEFAULT timezone('utc', now()),
    UNIQUE (meeting_id, email) -- Prevent duplicate invites
);

-- Meeting Metadata (Notes, Actions, Transcripts)
CREATE TABLE public.meeting_notes (
    meeting_id uuid PRIMARY KEY REFERENCES public.meetings(id) ON DELETE CASCADE,
    summary text,
    key_points jsonb,
    is_approved boolean DEFAULT false,
    created_at timestamptz DEFAULT timezone('utc', now()),
    updated_at timestamptz DEFAULT timezone('utc', now())
);

CREATE TABLE public.action_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
    description text NOT NULL,
    owner_email text,
    due_date timestamptz,
    status action_status DEFAULT 'pending',
    created_at timestamptz DEFAULT timezone('utc', now())
);

CREATE TABLE public.transcripts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
    speaker_name text,
    content text NOT NULL,
    start_time double precision,
    end_time double precision,
    created_at timestamptz DEFAULT timezone('utc', now())
);

-- User Preferences & Notifications
CREATE TABLE public.preferences (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    theme theme_preference DEFAULT 'system',
    default_mic text,
    default_camera text,
    default_speaker text,
    join_muted boolean DEFAULT false,
    enable_captions boolean DEFAULT true,
    updated_at timestamptz DEFAULT timezone('utc', now())
);

CREATE TABLE public.notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title text NOT NULL,
    message text NOT NULL,
    action_url text,
    is_read boolean DEFAULT false,
    created_at timestamptz DEFAULT timezone('utc', now())
);

-- =========================================
-- INDEXES & RLS ENABLERS
-- =========================================

CREATE INDEX idx_team_members_user_id ON public.team_members(user_id);
CREATE INDEX idx_meetings_team_id ON public.meetings(team_id);
CREATE INDEX idx_meetings_user_id ON public.meetings(user_id);
CREATE INDEX idx_meeting_participants_meeting_id ON public.meeting_participants(meeting_id);
CREATE INDEX idx_action_items_meeting_id ON public.action_items(meeting_id);
CREATE INDEX idx_transcripts_meeting_id ON public.transcripts(meeting_id);
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- =========================================
-- POLICIES
-- =========================================

-- Profiles
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Teams
CREATE POLICY "Team members can view teams" ON public.teams FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.team_members WHERE team_id = teams.id AND user_id = auth.uid())
);
CREATE POLICY "Users can create teams" ON public.teams FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Team owners can update teams" ON public.teams FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.team_members WHERE team_id = teams.id AND user_id = auth.uid() AND role = 'owner')
);

-- Team Members
CREATE POLICY "Team members can view members" ON public.team_members FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.team_id = team_members.team_id AND tm.user_id = auth.uid())
);
CREATE POLICY "Team admins can manage members" ON public.team_members FOR ALL USING (
    EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.team_id = team_members.team_id AND tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin'))
);

-- Meetings
CREATE POLICY "Users can view their own or team meetings" ON public.meetings FOR SELECT USING (
    auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM public.team_members WHERE team_id = meetings.team_id AND user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.meeting_participants WHERE meeting_id = meetings.id AND user_id = auth.uid())
);
CREATE POLICY "Users can create meetings" ON public.meetings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Hosts can update meetings" ON public.meetings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Hosts can delete meetings" ON public.meetings FOR DELETE USING (auth.uid() = user_id);

-- Meeting Participants
CREATE POLICY "Participants can view other participants" ON public.meeting_participants FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.meeting_participants mp WHERE mp.meeting_id = meeting_participants.meeting_id AND mp.user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.meetings m WHERE m.id = meeting_participants.meeting_id AND m.user_id = auth.uid())
);
CREATE POLICY "Hosts can manage participants" ON public.meeting_participants FOR ALL USING (
    EXISTS (SELECT 1 FROM public.meetings m WHERE m.id = meeting_participants.meeting_id AND m.user_id = auth.uid())
);

-- Meeting Notes
CREATE POLICY "Participants can view notes" ON public.meeting_notes FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.meeting_participants WHERE meeting_id = meeting_notes.meeting_id AND user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.meetings m WHERE m.id = meeting_notes.meeting_id AND m.user_id = auth.uid())
);

-- Action Items
CREATE POLICY "Participants can view action items" ON public.action_items FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.meeting_participants WHERE meeting_id = action_items.meeting_id AND user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.meetings m WHERE m.id = action_items.meeting_id AND m.user_id = auth.uid())
);

-- Transcripts
CREATE POLICY "Participants can view transcripts" ON public.transcripts FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.meeting_participants WHERE meeting_id = transcripts.meeting_id AND user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.meetings m WHERE m.id = transcripts.meeting_id AND m.user_id = auth.uid())
);

-- Preferences
CREATE POLICY "Users can manage own preferences" ON public.preferences FOR ALL USING (auth.uid() = user_id);

-- Notifications
CREATE POLICY "Users can manage own notifications" ON public.notifications FOR ALL USING (auth.uid() = user_id);
