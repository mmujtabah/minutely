-- Add the dashboard stats RPC function

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

-- View to easily query action items by meeting owner
CREATE OR REPLACE VIEW public.user_action_items_view AS
SELECT ai.*, m.user_id as meeting_owner_id
FROM public.action_items ai
JOIN public.meetings m ON m.id = ai.meeting_id;
