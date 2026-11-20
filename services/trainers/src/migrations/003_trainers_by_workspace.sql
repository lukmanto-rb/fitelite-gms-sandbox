-- FIT-941: lists read one workspace's trainers in creation order (interim order while OQ-003 is open).
-- One statement per migration file: the in-memory test database runs each file as one statement.
CREATE INDEX trainers_by_workspace ON trainers (workspace_id, id);
