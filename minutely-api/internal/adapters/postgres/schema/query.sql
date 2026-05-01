-- name: GetProfile :one
SELECT * FROM public.profiles
WHERE id = $1 LIMIT 1;

-- name: UpdateProfile :exec
UPDATE public.profiles
SET full_name = $2, avatar_url = $3, updated_at = now()
WHERE id = $1;

-- name: CreateMeeting :one
INSERT INTO public.meetings (
    user_id, team_id, title, description, scheduled_for
) VALUES (
    $1, $2, $3, $4, $5
)
RETURNING *;

-- name: GetMeeting :one
SELECT * FROM public.meetings
WHERE id = $1 LIMIT 1;

-- name: ListUserMeetings :many
SELECT * FROM public.meetings
WHERE user_id = $1
ORDER BY created_at DESC;

-- name: UpdateMeeting :exec
UPDATE public.meetings
SET title = $2, description = $3, status = $4, scheduled_for = $5, is_archived = $6, updated_at = now()
WHERE id = $1;
