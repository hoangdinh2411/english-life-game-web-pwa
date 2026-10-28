-- Common global/role scripts now load from versioned content JSON on the server.
-- Conversation history and current node identifiers are preserved.
DELETE FROM public.dialogue_nodes WHERE scope IN ('global', 'role');
ALTER TABLE public.dialogue_nodes ADD CONSTRAINT dialogue_npc_only CHECK (scope = 'npc');
