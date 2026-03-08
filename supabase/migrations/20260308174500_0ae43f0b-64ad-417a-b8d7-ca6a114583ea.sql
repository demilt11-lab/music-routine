INSERT INTO public.activity_types (name, description, icon)
VALUES ('meditation', 'Mindfulness and meditation music for inner peace', 'brain')
ON CONFLICT DO NOTHING;