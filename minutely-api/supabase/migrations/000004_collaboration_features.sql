-- Collaboration feature expansion:
-- 1) Meeting invites with delivery + RSVP state
-- 2) Team channels + persistent team chat

CREATE TYPE invite_status AS ENUM ('pending', 'sent', 'failed', 'accepted', 'declined');

CREATE TABLE IF NOT EXISTS public.meeting_invites (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id      uuid NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
    invited_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    invitee_email   text NOT NULL,
    invitee_name    text,
    status          invite_status NOT NULL DEFAULT 'pending',
    invite_token    uuid NOT NULL DEFAULT gen_random_uuid(),
    sent_at         timestamptz,
    responded_at    timestamptz,
    created_at      timestamptz DEFAULT timezone('utc', now()),
    UNIQUE (meeting_id, invitee_email)
);

CREATE TABLE IF NOT EXISTS public.team_channels (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id         uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    name            text NOT NULL,
    description     text,
    is_private      boolean NOT NULL DEFAULT false,
    created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at      timestamptz DEFAULT timezone('utc', now()),
    UNIQUE (team_id, name)
);

CREATE TABLE IF NOT EXISTS public.channel_members (
    channel_id      uuid NOT NULL REFERENCES public.team_channels(id) ON DELETE CASCADE,
    user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    added_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    joined_at       timestamptz DEFAULT timezone('utc', now()),
    PRIMARY KEY (channel_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id         uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    channel_id      uuid NOT NULL REFERENCES public.team_channels(id) ON DELETE CASCADE,
    sender_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    sender_name     text,
    sender_email    text,
    body            text NOT NULL,
    metadata        jsonb,
    created_at      timestamptz DEFAULT timezone('utc', now()),
    edited_at       timestamptz
);

CREATE TABLE IF NOT EXISTS public.message_reads (
    message_id      uuid NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
    user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    read_at         timestamptz DEFAULT timezone('utc', now()),
    PRIMARY KEY (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_meeting_invites_meeting_id ON public.meeting_invites(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_invites_email ON public.meeting_invites(invitee_email);
CREATE INDEX IF NOT EXISTS idx_team_channels_team_id ON public.team_channels(team_id);
CREATE INDEX IF NOT EXISTS idx_channel_members_user_id ON public.channel_members(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_team_channel_created ON public.chat_messages(team_id, channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_reads_user_id ON public.message_reads(user_id);

ALTER TABLE public.meeting_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY "Team members can view channels"
    ON public.team_channels FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.team_members tm
            WHERE tm.team_id = team_channels.team_id AND tm.user_id = auth.uid()
        )
    );

CREATE POLICY "Team admins can create channels"
    ON public.team_channels FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.team_members tm
            WHERE tm.team_id = team_channels.team_id
              AND tm.user_id = auth.uid()
              AND tm.role IN ('owner', 'admin')
        )
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
        EXISTS (
            SELECT 1 FROM public.team_members tm
            WHERE tm.team_id = chat_messages.team_id AND tm.user_id = auth.uid()
        )
    );

CREATE POLICY "Team members can view messages"
    ON public.chat_messages FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.team_members tm
            WHERE tm.team_id = chat_messages.team_id AND tm.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can manage their read markers"
    ON public.message_reads FOR ALL USING (auth.uid() = user_id);
