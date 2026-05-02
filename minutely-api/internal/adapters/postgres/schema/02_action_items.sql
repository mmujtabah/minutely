-- Create Action Items table
CREATE TABLE IF NOT EXISTS public.action_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
    transcript_id UUID REFERENCES public.transcripts(id) ON DELETE CASCADE,
    task TEXT NOT NULL,
    assignee_name TEXT,
    assignee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'open',
    due_date TIMESTAMPTZ,
    segment_ref UUID REFERENCES public.transcript_segments(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.action_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can see action items if they have access to the meeting (assuming meeting RLS allows access)
CREATE POLICY "Users can view action items for their meetings"
    ON public.action_items FOR SELECT
    USING (
        meeting_id IN (
            SELECT id FROM public.meetings WHERE user_id = auth.uid()
        )
    );

-- Users can create/update action items for their meetings
CREATE POLICY "Users can manage action items for their meetings"
    ON public.action_items FOR ALL
    USING (
        meeting_id IN (
            SELECT id FROM public.meetings WHERE user_id = auth.uid()
        )
    );

-- Create meeting summaries view for the dashboard
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
