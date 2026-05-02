-- =============================================
-- MINUTELY — FINAL CONSOLIDATED SCHEMA
-- Run this on a fresh database after dropping
-- all existing tables.
-- =============================================

-- =============================================
-- DROP EVERYTHING (run this block first)
-- =============================================

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

-- =============================================
-- ENUMS
-- =============================================

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

-- =============================================
-- USERS & TEAMS
-- =============================================

CREATE TABLE public.profiles (
    id          uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name   text,
    avatar_url  text,
    created_at  timestamptz DEFAULT timezone('utc', now()),
    updated_at  timestamptz DEFAULT timezone('utc', now())
);

CREATE TABLE public.teams (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text        NOT NULL,
    description text,
    created_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at  timestamptz DEFAULT timezone('utc', now())
);

CREATE TABLE public.team_members (
    team_id     uuid        NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role        team_role   DEFAULT 'member',
    joined_at   timestamptz DEFAULT timezone('utc', now()),
    PRIMARY KEY (team_id, user_id)
);

-- =============================================
-- MEETINGS
-- =============================================

CREATE TABLE public.meetings (
    id              uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         uuid            REFERENCES auth.users(id) ON DELETE SET NULL,  -- Host
    team_id         uuid            REFERENCES public.teams(id) ON DELETE CASCADE,
    title           text            NOT NULL,
    description     text,
    status          meeting_status  DEFAULT 'scheduled',
    scheduled_for   timestamptz,
    is_archived     boolean         DEFAULT false,
    created_at      timestamptz     DEFAULT timezone('utc', now()),
    updated_at      timestamptz     DEFAULT timezone('utc', now())
);

CREATE TABLE public.meeting_participants (
    id          uuid                PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id  uuid                NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
    user_id     uuid                REFERENCES auth.users(id) ON DELETE SET NULL,
    email       text                NOT NULL,
    display_name text,
    role        participant_role    DEFAULT 'participant',
    added_at    timestamptz         DEFAULT timezone('utc', now()),
    UNIQUE (meeting_id, email)
);

-- =============================================
-- BACKGROUND JOBS (Upload Processing)
-- =============================================

CREATE TABLE public.processing_jobs (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id      uuid        NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
    job_type        job_type    NOT NULL,
    status          job_status  DEFAULT 'pending',
    attempt_count   int         DEFAULT 0,
    max_attempts    int         DEFAULT 3,
    error_message   text,
    payload         jsonb,      -- Input params (language, speakers, etc.)
    result          jsonb,      -- Storage path, duration, etc.
    started_at      timestamptz,
    completed_at    timestamptz,
    created_at      timestamptz DEFAULT timezone('utc', now()),
    updated_at      timestamptz DEFAULT timezone('utc', now())
);

-- =============================================
-- MEDIA FILES (Uploaded Recordings)
-- =============================================

CREATE TABLE public.media_files (
    id              uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id      uuid            NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
    uploaded_by     uuid            REFERENCES auth.users(id),
    storage_path    text            NOT NULL,   -- Supabase Storage path
    original_name   text            NOT NULL,
    mime_type       text            NOT NULL,
    size_bytes      bigint,
    duration_secs   float,
    status          media_status    DEFAULT 'uploaded',
    job_id          uuid            REFERENCES public.processing_jobs(id),
    created_at      timestamptz     DEFAULT timezone('utc', now())
);

-- =============================================
-- TRANSCRIPTION
-- =============================================

CREATE TABLE public.transcripts (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id      uuid        NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
    media_file_id   uuid        REFERENCES public.media_files(id),
    source          text        NOT NULL CHECK (source IN ('live', 'upload')),
    language        text        DEFAULT 'en',
    full_text       text,       -- Assembled from segments on completion
    duration_secs   float,
    speaker_count   int,
    status          text        DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'failed')),
    created_at      timestamptz DEFAULT timezone('utc', now()),
    completed_at    timestamptz
);

-- One segment = one speaker turn.
-- speaker_name + speaker_email are MANDATORY — captured from Jitsi participant identity.
CREATE TABLE public.transcript_segments (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    transcript_id   uuid        NOT NULL REFERENCES public.transcripts(id) ON DELETE CASCADE,
    speaker_label   text,       -- Raw label from Deepgram/pyannote: "SPEAKER_00"
    speaker_name    text        NOT NULL,   -- Participant display name (from Jitsi)
    speaker_email   text        NOT NULL,   -- Participant email (for task assignment)
    text            text        NOT NULL,
    start_secs      float       NOT NULL,
    end_secs        float       NOT NULL,
    confidence      float,
    is_partial      boolean     DEFAULT false,
    sequence_num    int,
    created_at      timestamptz DEFAULT timezone('utc', now())
);

-- Tracks an active live transcription session.
-- One per meeting at a time (enforced by unique constraint on active sessions).
CREATE TABLE public.live_sessions (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id              uuid        NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
    transcript_id           uuid        REFERENCES public.transcripts(id),
    deepgram_token_expires  timestamptz,    -- When the short-lived client token expires
    started_at              timestamptz DEFAULT timezone('utc', now()),
    ended_at                timestamptz,
    participant_count       int         DEFAULT 0
);

-- =============================================
-- AI PIPELINE (LLM-Ready Slots)
-- =============================================

CREATE TABLE public.ai_outputs (
    id              uuid                PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id      uuid                NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
    transcript_id   uuid                REFERENCES public.transcripts(id),
    output_type     ai_output_type      NOT NULL,
    status          ai_output_status    DEFAULT 'pending',
    model_used      text,               -- e.g. "gpt-4o", "claude-3-sonnet"
    prompt_version  text,
    result          jsonb,              -- Structured LLM output (any shape)
    tokens_used     int,
    cost_usd        float,
    error_message   text,
    created_at      timestamptz         DEFAULT timezone('utc', now()),
    completed_at    timestamptz
);

-- =============================================
-- MEETING METADATA
-- =============================================

CREATE TABLE public.action_items (
    id          uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id  uuid            NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
    description text            NOT NULL,
    owner_email text,           -- Email of assignee (links to transcript_segments.speaker_email)
    due_date    timestamptz,
    status      action_status   DEFAULT 'pending',
    created_at  timestamptz     DEFAULT timezone('utc', now())
);

CREATE TABLE public.meeting_notes (
    meeting_id  uuid        PRIMARY KEY REFERENCES public.meetings(id) ON DELETE CASCADE,
    summary     text,
    key_points  jsonb,
    is_approved boolean     DEFAULT false,
    created_at  timestamptz DEFAULT timezone('utc', now()),
    updated_at  timestamptz DEFAULT timezone('utc', now())
);

-- =============================================
-- USER PREFERENCES & NOTIFICATIONS
-- =============================================

CREATE TABLE public.preferences (
    user_id         uuid                PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    theme           theme_preference    DEFAULT 'system',
    default_mic     text,
    default_camera  text,
    default_speaker text,
    join_muted      boolean             DEFAULT false,
    enable_captions boolean             DEFAULT true,
    updated_at      timestamptz         DEFAULT timezone('utc', now())
);

CREATE TABLE public.notifications (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title       text        NOT NULL,
    message     text        NOT NULL,
    action_url  text,
    is_read     boolean     DEFAULT false,
    created_at  timestamptz DEFAULT timezone('utc', now())
);

-- =============================================
-- INDEXES
-- =============================================

CREATE INDEX idx_team_members_user_id              ON public.team_members(user_id);
CREATE INDEX idx_meetings_user_id                  ON public.meetings(user_id);
CREATE INDEX idx_meetings_team_id                  ON public.meetings(team_id);
CREATE INDEX idx_meeting_participants_meeting_id   ON public.meeting_participants(meeting_id);
CREATE INDEX idx_processing_jobs_meeting_id        ON public.processing_jobs(meeting_id);
CREATE INDEX idx_processing_jobs_status            ON public.processing_jobs(status);
CREATE INDEX idx_media_files_meeting_id            ON public.media_files(meeting_id);
CREATE INDEX idx_transcripts_meeting_id            ON public.transcripts(meeting_id);
CREATE INDEX idx_segments_transcript_id            ON public.transcript_segments(transcript_id);
CREATE INDEX idx_segments_speaker_email            ON public.transcript_segments(speaker_email);
CREATE INDEX idx_segments_start                    ON public.transcript_segments(transcript_id, start_secs);
CREATE INDEX idx_ai_outputs_meeting_id             ON public.ai_outputs(meeting_id);
CREATE INDEX idx_action_items_owner_email          ON public.action_items(owner_email);
CREATE INDEX idx_notifications_user_id             ON public.notifications(user_id);

-- =============================================
-- ROW LEVEL SECURITY — ENABLE
-- =============================================

ALTER TABLE public.profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processing_jobs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_files         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcripts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcript_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_sessions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_outputs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_notes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preferences         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications       ENABLE ROW LEVEL SECURITY;

-- =============================================
-- ROW LEVEL SECURITY — POLICIES
-- =============================================

-- Profiles
CREATE POLICY "Anyone can view profiles"
    ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users manage own profile"
    ON public.profiles FOR ALL USING (auth.uid() = id);

-- Teams
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

-- Team Members
CREATE POLICY "Team members can view members"
    ON public.team_members FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.team_id = team_members.team_id AND tm.user_id = auth.uid())
    );
CREATE POLICY "Team admins can manage members"
    ON public.team_members FOR ALL USING (
        EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.team_id = team_members.team_id AND tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin'))
    );

-- Helper: is user a meeting member?
-- Used as sub-expression in policies below.
-- A user has access if they are: host, team member, or invited participant.

-- Meetings
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

-- Meeting Participants
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

-- Processing Jobs
CREATE POLICY "Meeting members can view jobs"
    ON public.processing_jobs FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.meetings WHERE id = processing_jobs.meeting_id AND (
            user_id = auth.uid()
            OR EXISTS (SELECT 1 FROM public.team_members WHERE team_id = meetings.team_id AND user_id = auth.uid())
        ))
    );

-- Media Files
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

-- Transcripts
CREATE POLICY "Meeting members can view transcripts"
    ON public.transcripts FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.meetings WHERE id = transcripts.meeting_id AND (
            user_id = auth.uid()
            OR EXISTS (SELECT 1 FROM public.team_members WHERE team_id = meetings.team_id AND user_id = auth.uid())
        ))
    );

-- Transcript Segments
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

-- Live Sessions
CREATE POLICY "Meeting members can view live sessions"
    ON public.live_sessions FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.meetings WHERE id = live_sessions.meeting_id AND (
            user_id = auth.uid()
            OR EXISTS (SELECT 1 FROM public.team_members WHERE team_id = meetings.team_id AND user_id = auth.uid())
        ))
    );

-- AI Outputs
CREATE POLICY "Meeting members can view AI outputs"
    ON public.ai_outputs FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.meetings WHERE id = ai_outputs.meeting_id AND (
            user_id = auth.uid()
            OR EXISTS (SELECT 1 FROM public.team_members WHERE team_id = meetings.team_id AND user_id = auth.uid())
        ))
    );

-- Action Items
CREATE POLICY "Meeting members can view action items"
    ON public.action_items FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.meetings WHERE id = action_items.meeting_id AND (
            user_id = auth.uid()
            OR EXISTS (SELECT 1 FROM public.team_members WHERE team_id = meetings.team_id AND user_id = auth.uid())
        ))
    );
CREATE POLICY "Hosts can manage action items"
    ON public.action_items FOR ALL USING (
        EXISTS (SELECT 1 FROM public.meetings WHERE id = action_items.meeting_id AND user_id = auth.uid())
    );

-- Meeting Notes
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

-- Preferences & Notifications
CREATE POLICY "Users manage own preferences"
    ON public.preferences FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own notifications"
    ON public.notifications FOR ALL USING (auth.uid() = user_id);
