-- =============================================
-- MINUTELY — FULL RESET (AUTHORITATIVE)
-- Drops everything and recreates latest schema.
-- =============================================

-- ---------------------------------------------
-- DROP: views/functions first
-- ---------------------------------------------
DROP VIEW IF EXISTS public.meeting_summaries CASCADE;
DROP VIEW IF EXISTS public.user_action_items_view CASCADE;
DROP FUNCTION IF EXISTS public.get_dashboard_stats(uuid) CASCADE;

-- ---------------------------------------------
-- DROP: tables
-- ---------------------------------------------
DROP TABLE IF EXISTS public.message_reads CASCADE;
DROP TABLE IF EXISTS public.chat_messages CASCADE;
DROP TABLE IF EXISTS public.channel_members CASCADE;
DROP TABLE IF EXISTS public.team_channels CASCADE;
DROP TABLE IF EXISTS public.meeting_invites CASCADE;
DROP TABLE IF EXISTS public.ai_outputs CASCADE;
DROP TABLE IF EXISTS public.live_sessions CASCADE;
DROP TABLE IF EXISTS public.transcript_segments CASCADE;
DROP TABLE IF EXISTS public.transcripts CASCADE;
DROP TABLE IF EXISTS public.media_files CASCADE;
DROP TABLE IF EXISTS public.processing_jobs CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.preferences CASCADE;
DROP TABLE IF EXISTS public.action_items CASCADE;
DROP TABLE IF EXISTS public.meeting_notes CASCADE;
DROP TABLE IF EXISTS public.meeting_participants CASCADE;
DROP TABLE IF EXISTS public.meetings CASCADE;
DROP TABLE IF EXISTS public.team_members CASCADE;
DROP TABLE IF EXISTS public.teams CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- ---------------------------------------------
-- DROP: enums/types
-- ---------------------------------------------
DROP TYPE IF EXISTS invite_status CASCADE;
DROP TYPE IF EXISTS meeting_status CASCADE;
DROP TYPE IF EXISTS participant_role CASCADE;
DROP TYPE IF EXISTS team_role CASCADE;
DROP TYPE IF EXISTS action_status CASCADE;
DROP TYPE IF EXISTS theme_preference CASCADE;
DROP TYPE IF EXISTS job_status CASCADE;
DROP TYPE IF EXISTS job_type CASCADE;
DROP TYPE IF EXISTS media_status CASCADE;
DROP TYPE IF EXISTS ai_output_type CASCADE;
DROP TYPE IF EXISTS ai_output_status CASCADE;

-- ---------------------------------------------
-- ENUMS
-- ---------------------------------------------
CREATE TYPE meeting_status    AS ENUM ('scheduled', 'in_progress', 'completed', 'canceled');
CREATE TYPE participant_role  AS ENUM ('host', 'co-host', 'participant');
CREATE TYPE team_role         AS ENUM ('owner', 'admin', 'member');
CREATE TYPE action_status     AS ENUM ('pending', 'completed');
CREATE TYPE theme_preference  AS ENUM ('light', 'dark', 'system');
CREATE TYPE job_status        AS ENUM ('pending', 'processing', 'completed', 'failed', 'retrying');
CREATE TYPE job_type          AS ENUM ('live_transcription', 'file_transcription', 'ai_processing');
CREATE TYPE media_status      AS ENUM ('uploaded', 'processing', 'ready', 'error');
CREATE TYPE ai_output_type    AS ENUM ('summary', 'action_items', 'key_topics', 'sentiment', 'tasks', 'custom');
CREATE TYPE ai_output_status  AS ENUM ('pending', 'processing', 'completed', 'failed');
CREATE TYPE invite_status     AS ENUM ('pending', 'sent', 'failed', 'accepted', 'declined');

-- ---------------------------------------------
-- USERS & TEAMS
-- ---------------------------------------------
CREATE TABLE public.profiles (
    id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name   text,
    avatar_url  text,
    created_at  timestamptz DEFAULT timezone('utc', now()),
    updated_at  timestamptz DEFAULT timezone('utc', now())
);

CREATE TABLE public.teams (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text NOT NULL,
    description text,
    created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at  timestamptz DEFAULT timezone('utc', now())
);

CREATE TABLE public.team_members (
    team_id     uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role        team_role DEFAULT 'member',
    joined_at   timestamptz DEFAULT timezone('utc', now()),
    PRIMARY KEY (team_id, user_id)
);

CREATE TABLE public.team_channels (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id     uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    name        text NOT NULL,
    description text,
    is_private  boolean NOT NULL DEFAULT false,
    created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at  timestamptz DEFAULT timezone('utc', now()),
    UNIQUE (team_id, name)
);

CREATE TABLE public.channel_members (
    channel_id  uuid NOT NULL REFERENCES public.team_channels(id) ON DELETE CASCADE,
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    added_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    joined_at   timestamptz DEFAULT timezone('utc', now()),
    PRIMARY KEY (channel_id, user_id)
);

CREATE TABLE public.chat_messages (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id     uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    channel_id  uuid NOT NULL REFERENCES public.team_channels(id) ON DELETE CASCADE,
    sender_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    sender_name text,
    sender_email text,
    body        text NOT NULL,
    metadata    jsonb,
    created_at  timestamptz DEFAULT timezone('utc', now()),
    edited_at   timestamptz
);

CREATE TABLE public.message_reads (
    message_id  uuid NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    read_at     timestamptz DEFAULT timezone('utc', now()),
    PRIMARY KEY (message_id, user_id)
);

-- ---------------------------------------------
-- MEETINGS
-- ---------------------------------------------
CREATE TABLE public.meetings (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    team_id         uuid REFERENCES public.teams(id) ON DELETE CASCADE,
    title           text NOT NULL,
    description     text,
    status          meeting_status DEFAULT 'scheduled',
    scheduled_for   timestamptz,
    is_archived     boolean DEFAULT false,
    created_at      timestamptz DEFAULT timezone('utc', now()),
    updated_at      timestamptz DEFAULT timezone('utc', now())
);

CREATE TABLE public.meeting_participants (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id   uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
    user_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    email        text NOT NULL,
    display_name text,
    role         participant_role DEFAULT 'participant',
    added_at     timestamptz DEFAULT timezone('utc', now()),
    UNIQUE (meeting_id, email)
);

CREATE TABLE public.meeting_invites (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id    uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
    invited_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    invitee_email text NOT NULL,
    invitee_name  text,
    status        invite_status NOT NULL DEFAULT 'pending',
    invite_token  uuid NOT NULL DEFAULT gen_random_uuid(),
    sent_at       timestamptz,
    responded_at  timestamptz,
    created_at    timestamptz DEFAULT timezone('utc', now()),
    UNIQUE (meeting_id, invitee_email)
);

-- ---------------------------------------------
-- JOBS / MEDIA / TRANSCRIPTS
-- ---------------------------------------------
CREATE TABLE public.processing_jobs (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id      uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
    job_type        job_type NOT NULL,
    status          job_status DEFAULT 'pending',
    attempt_count   int DEFAULT 0,
    max_attempts    int DEFAULT 3,
    error_message   text,
    payload         jsonb,
    result          jsonb,
    started_at      timestamptz,
    completed_at    timestamptz,
    created_at      timestamptz DEFAULT timezone('utc', now()),
    updated_at      timestamptz DEFAULT timezone('utc', now())
);

CREATE TABLE public.media_files (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id      uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
    uploaded_by     uuid REFERENCES auth.users(id),
    storage_path    text NOT NULL,
    original_name   text NOT NULL,
    mime_type       text NOT NULL,
    size_bytes      bigint,
    duration_secs   float,
    status          media_status DEFAULT 'uploaded',
    job_id          uuid REFERENCES public.processing_jobs(id),
    created_at      timestamptz DEFAULT timezone('utc', now())
);

CREATE TABLE public.transcripts (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id      uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
    media_file_id   uuid REFERENCES public.media_files(id),
    source          text NOT NULL CHECK (source IN ('live', 'upload')),
    language        text DEFAULT 'en',
    full_text       text,
    duration_secs   float,
    speaker_count   int,
    status          text DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'failed')),
    created_at      timestamptz DEFAULT timezone('utc', now()),
    completed_at    timestamptz
);

CREATE TABLE public.transcript_segments (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    transcript_id   uuid NOT NULL REFERENCES public.transcripts(id) ON DELETE CASCADE,
    speaker_label   text,
    speaker_name    text NOT NULL,
    speaker_email   text NOT NULL,
    text            text NOT NULL,
    start_secs      float NOT NULL,
    end_secs        float NOT NULL,
    confidence      float,
    is_partial      boolean DEFAULT false,
    sequence_num    int,
    created_at      timestamptz DEFAULT timezone('utc', now())
);

CREATE TABLE public.live_sessions (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id              uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
    transcript_id           uuid REFERENCES public.transcripts(id),
    deepgram_token_expires  timestamptz,
    started_at              timestamptz DEFAULT timezone('utc', now()),
    ended_at                timestamptz,
    participant_count       int DEFAULT 0
);

-- ---------------------------------------------
-- AI + ACTION ITEMS + NOTES
-- ---------------------------------------------
CREATE TABLE public.ai_outputs (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id      uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
    transcript_id   uuid REFERENCES public.transcripts(id),
    output_type     ai_output_type NOT NULL,
    status          ai_output_status DEFAULT 'pending',
    model_used      text,
    prompt_version  text,
    result          jsonb,
    tokens_used     int,
    cost_usd        float,
    error_message   text,
    created_at      timestamptz DEFAULT timezone('utc', now()),
    completed_at    timestamptz
);

CREATE TABLE public.action_items (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id    uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
    transcript_id uuid REFERENCES public.transcripts(id) ON DELETE CASCADE,
    task          text NOT NULL,
    assignee_name text,
    assignee_id   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    status        text DEFAULT 'open',
    due_date      timestamptz,
    segment_ref   uuid REFERENCES public.transcript_segments(id) ON DELETE SET NULL,
    created_at    timestamptz DEFAULT now(),
    updated_at    timestamptz DEFAULT now()
);

CREATE TABLE public.meeting_notes (
    meeting_id   uuid PRIMARY KEY REFERENCES public.meetings(id) ON DELETE CASCADE,
    summary      text,
    key_points   jsonb,
    is_approved  boolean DEFAULT false,
    created_at   timestamptz DEFAULT timezone('utc', now()),
    updated_at   timestamptz DEFAULT timezone('utc', now())
);

-- ---------------------------------------------
-- PREFERENCES / NOTIFICATIONS
-- ---------------------------------------------
CREATE TABLE public.preferences (
    user_id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    theme           theme_preference DEFAULT 'system',
    default_mic     text,
    default_camera  text,
    default_speaker text,
    join_muted      boolean DEFAULT false,
    enable_captions boolean DEFAULT true,
    updated_at      timestamptz DEFAULT timezone('utc', now())
);

CREATE TABLE public.notifications (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title       text NOT NULL,
    message     text NOT NULL,
    action_url  text,
    is_read     boolean DEFAULT false,
    created_at  timestamptz DEFAULT timezone('utc', now())
);

-- ---------------------------------------------
-- INDEXES
-- ---------------------------------------------
CREATE INDEX idx_team_members_user_id ON public.team_members(user_id);
CREATE INDEX idx_team_channels_team_id ON public.team_channels(team_id);
CREATE INDEX idx_channel_members_user_id ON public.channel_members(user_id);
CREATE INDEX idx_chat_messages_team_channel_created ON public.chat_messages(team_id, channel_id, created_at DESC);
CREATE INDEX idx_message_reads_user_id ON public.message_reads(user_id);
CREATE INDEX idx_meetings_user_id ON public.meetings(user_id);
CREATE INDEX idx_meetings_team_id ON public.meetings(team_id);
CREATE INDEX idx_meeting_participants_meeting_id ON public.meeting_participants(meeting_id);
CREATE INDEX idx_meeting_invites_meeting_id ON public.meeting_invites(meeting_id);
CREATE INDEX idx_meeting_invites_email ON public.meeting_invites(invitee_email);
CREATE INDEX idx_processing_jobs_meeting_id ON public.processing_jobs(meeting_id);
CREATE INDEX idx_processing_jobs_status ON public.processing_jobs(status);
CREATE INDEX idx_media_files_meeting_id ON public.media_files(meeting_id);
CREATE INDEX idx_transcripts_meeting_id ON public.transcripts(meeting_id);
CREATE INDEX idx_segments_transcript_id ON public.transcript_segments(transcript_id);
CREATE INDEX idx_segments_speaker_email ON public.transcript_segments(speaker_email);
CREATE INDEX idx_segments_start ON public.transcript_segments(transcript_id, start_secs);
CREATE INDEX idx_ai_outputs_meeting_id ON public.ai_outputs(meeting_id);
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);

-- ---------------------------------------------
-- RLS ENABLE
-- ---------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcript_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------
-- RLS POLICIES
-- ---------------------------------------------
CREATE POLICY "Anyone can view profiles"
    ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users manage own profile"
    ON public.profiles FOR ALL USING (auth.uid() = id);

CREATE POLICY "Team members can view teams"
    ON public.teams FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.team_members WHERE team_id = teams.id AND user_id = auth.uid())
    );
CREATE POLICY "Users can create teams"
    ON public.teams FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Team owners can update teams"
    ON public.teams FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.team_members WHERE team_id = teams.id AND user_id = auth.uid() AND role = 'owner')
    );

CREATE POLICY "Team members can view members"
    ON public.team_members FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.team_id = team_members.team_id AND tm.user_id = auth.uid())
    );
CREATE POLICY "Team admins can manage members"
    ON public.team_members FOR ALL USING (
        EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.team_id = team_members.team_id AND tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin'))
    );

CREATE POLICY "Team members can view channels"
    ON public.team_channels FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.team_id = team_channels.team_id AND tm.user_id = auth.uid())
    );
CREATE POLICY "Team admins can create channels"
    ON public.team_channels FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.team_id = team_channels.team_id AND tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin'))
    );

CREATE POLICY "Team members can view channel membership"
    ON public.channel_members FOR SELECT USING (
        EXISTS (
            SELECT 1
            FROM public.team_channels c
            JOIN public.team_members tm ON tm.team_id = c.team_id
            WHERE c.id = channel_members.channel_id AND tm.user_id = auth.uid()
        )
    );

CREATE POLICY "Team members can send messages"
    ON public.chat_messages FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.team_id = chat_messages.team_id AND tm.user_id = auth.uid())
    );
CREATE POLICY "Team members can view messages"
    ON public.chat_messages FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.team_id = chat_messages.team_id AND tm.user_id = auth.uid())
    );
CREATE POLICY "Users can manage their read markers"
    ON public.message_reads FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view accessible meetings"
    ON public.meetings FOR SELECT USING (
        auth.uid() = user_id
        OR EXISTS (SELECT 1 FROM public.team_members WHERE team_id = meetings.team_id AND user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.meeting_participants WHERE meeting_id = meetings.id AND user_id = auth.uid())
    );
CREATE POLICY "Users can create meetings"
    ON public.meetings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Hosts can update meetings"
    ON public.meetings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Hosts can delete meetings"
    ON public.meetings FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Participants can view other participants"
    ON public.meeting_participants FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.meetings WHERE id = meeting_participants.meeting_id AND (
            user_id = auth.uid()
            OR EXISTS (SELECT 1 FROM public.meeting_participants mp WHERE mp.meeting_id = meeting_participants.meeting_id AND mp.user_id = auth.uid())
        ))
    );
CREATE POLICY "Hosts can manage participants"
    ON public.meeting_participants FOR ALL USING (
        EXISTS (SELECT 1 FROM public.meetings WHERE id = meeting_participants.meeting_id AND user_id = auth.uid())
    );

CREATE POLICY "Team members can view meeting invites"
    ON public.meeting_invites FOR SELECT USING (
        EXISTS (
            SELECT 1
            FROM public.meetings m
            JOIN public.team_members tm ON tm.team_id = m.team_id
            WHERE m.id = meeting_invites.meeting_id AND tm.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.meetings m
            WHERE m.id = meeting_invites.meeting_id AND m.user_id = auth.uid()
        )
    );
CREATE POLICY "Meeting hosts can create invites"
    ON public.meeting_invites FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.meetings m
            WHERE m.id = meeting_invites.meeting_id AND m.user_id = auth.uid()
        )
    );

CREATE POLICY "Meeting members can view jobs"
    ON public.processing_jobs FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.meetings WHERE id = processing_jobs.meeting_id AND (
            user_id = auth.uid()
            OR EXISTS (SELECT 1 FROM public.team_members WHERE team_id = meetings.team_id AND user_id = auth.uid())
        ))
    );

CREATE POLICY "Meeting members can view media"
    ON public.media_files FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.meetings WHERE id = media_files.meeting_id AND (
            user_id = auth.uid()
            OR EXISTS (SELECT 1 FROM public.team_members WHERE team_id = meetings.team_id AND user_id = auth.uid())
        ))
    );
CREATE POLICY "Meeting members can upload media"
    ON public.media_files FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.meetings WHERE id = media_files.meeting_id AND (
            user_id = auth.uid()
            OR EXISTS (SELECT 1 FROM public.team_members WHERE team_id = meetings.team_id AND user_id = auth.uid())
        ))
    );

CREATE POLICY "Meeting members can view transcripts"
    ON public.transcripts FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.meetings WHERE id = transcripts.meeting_id AND (
            user_id = auth.uid()
            OR EXISTS (SELECT 1 FROM public.team_members WHERE team_id = meetings.team_id AND user_id = auth.uid())
        ))
    );

CREATE POLICY "Meeting members can view segments"
    ON public.transcript_segments FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.transcripts t
            JOIN public.meetings m ON t.meeting_id = m.id
            WHERE t.id = transcript_segments.transcript_id AND (
                m.user_id = auth.uid()
                OR EXISTS (SELECT 1 FROM public.team_members WHERE team_id = m.team_id AND user_id = auth.uid())
            )
        )
    );

CREATE POLICY "Meeting members can view live sessions"
    ON public.live_sessions FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.meetings WHERE id = live_sessions.meeting_id AND (
            user_id = auth.uid()
            OR EXISTS (SELECT 1 FROM public.team_members WHERE team_id = meetings.team_id AND user_id = auth.uid())
        ))
    );

CREATE POLICY "Meeting members can view AI outputs"
    ON public.ai_outputs FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.meetings WHERE id = ai_outputs.meeting_id AND (
            user_id = auth.uid()
            OR EXISTS (SELECT 1 FROM public.team_members WHERE team_id = meetings.team_id AND user_id = auth.uid())
        ))
    );

CREATE POLICY "Users can view action items for their meetings"
    ON public.action_items FOR SELECT
    USING (
        meeting_id IN (SELECT id FROM public.meetings WHERE user_id = auth.uid())
    );
CREATE POLICY "Users can manage action items for their meetings"
    ON public.action_items FOR ALL
    USING (
        meeting_id IN (SELECT id FROM public.meetings WHERE user_id = auth.uid())
    );

CREATE POLICY "Meeting members can view notes"
    ON public.meeting_notes FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.meetings WHERE id = meeting_notes.meeting_id AND (
            user_id = auth.uid()
            OR EXISTS (SELECT 1 FROM public.team_members WHERE team_id = meetings.team_id AND user_id = auth.uid())
        ))
    );
CREATE POLICY "Hosts can manage notes"
    ON public.meeting_notes FOR ALL USING (
        EXISTS (SELECT 1 FROM public.meetings WHERE id = meeting_notes.meeting_id AND user_id = auth.uid())
    );

CREATE POLICY "Users manage own preferences"
    ON public.preferences FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own notifications"
    ON public.notifications FOR ALL USING (auth.uid() = user_id);

-- ---------------------------------------------
-- VIEWS + RPC
-- ---------------------------------------------
CREATE OR REPLACE VIEW public.meeting_summaries AS
SELECT
    m.*,
    t.duration_secs,
    t.speaker_count,
    t.status as transcript_status,
    (
        SELECT result->>'executive_summary'
        FROM public.ai_outputs
        WHERE meeting_id = m.id AND output_type = 'summary'
        ORDER BY created_at DESC
        LIMIT 1
    ) as summary_snippet,
    (
        SELECT COUNT(*)
        FROM public.action_items
        WHERE meeting_id = m.id AND status = 'open'
    ) as open_action_items
FROM public.meetings m
LEFT JOIN public.transcripts t ON t.meeting_id = m.id;

CREATE OR REPLACE FUNCTION public.get_dashboard_stats(p_user_id UUID)
RETURNS JSON AS $$
  SELECT json_build_object(
    'total_meetings',    COUNT(DISTINCT m.id),
    'hours_transcribed', COALESCE(SUM(t.duration_secs) / 3600.0, 0),
    'open_action_items', COUNT(DISTINCT ai.id) FILTER (WHERE ai.status = 'open'),
    'people_met',        COUNT(DISTINCT ts.speaker_email)
  )
  FROM public.meetings m
  LEFT JOIN public.transcripts t ON t.meeting_id = m.id
  LEFT JOIN public.action_items ai ON ai.meeting_id = m.id
  LEFT JOIN public.transcript_segments ts ON ts.transcript_id = t.id
  WHERE m.user_id = p_user_id;
$$ LANGUAGE SQL STABLE;

CREATE OR REPLACE VIEW public.user_action_items_view AS
SELECT ai.*, m.user_id as meeting_owner_id
FROM public.action_items ai
JOIN public.meetings m ON m.id = ai.meeting_id;
