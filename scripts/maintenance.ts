import Database from 'better-sqlite3';

const DAY = 86_400_000;
const source = process.env.DATABASE_PATH;
const now = Number(process.env.MAINTENANCE_NOW || Date.now());
const retentionDays = Number(process.env.SESSION_RETENTION_DAYS || 180);

if (!source || !Number.isSafeInteger(now) || !Number.isInteger(retentionDays) || retentionDays < 0) {
	console.error('Maintenance failed. Check DATABASE_PATH, MAINTENANCE_NOW and SESSION_RETENTION_DAYS.');
	process.exitCode = 1;
} else {
	const db = new Database(source, { fileMustExist: true });
	try {
		db.pragma('foreign_keys = ON');
		const cutoff = now - retentionDays * DAY;
		const result = db.transaction(() => {
			const expired = db
				.prepare("SELECT id, activity_id FROM live_sessions WHERE state = 'ended' AND ended_at <= ?")
				.all(cutoff) as Array<{ id: string; activity_id: string }>;
			const sessionIds = expired.map((row) => row.id);
			const activityIds = [...new Set(expired.map((row) => row.activity_id))];
			if (sessionIds.length) {
				const marks = sessionIds.map(() => '?').join(',');
				db.prepare(`DELETE FROM poll_response_options WHERE response_id IN (SELECT id FROM poll_responses WHERE session_id IN (${marks}))`).run(...sessionIds);
				db.prepare(`DELETE FROM poll_responses WHERE session_id IN (${marks})`).run(...sessionIds);
				db.prepare(`DELETE FROM participants WHERE session_id IN (${marks})`).run(...sessionIds);
				db.prepare(`DELETE FROM live_sessions WHERE id IN (${marks})`).run(...sessionIds);
			}
			const removableActivities = activityIds.filter(
				(id) => !db.prepare('SELECT 1 FROM live_sessions WHERE activity_id = ?').get(id)
			);
			if (removableActivities.length) {
				const marks = removableActivities.map(() => '?').join(',');
				db.prepare(`DELETE FROM poll_response_options WHERE response_id IN (SELECT id FROM poll_responses WHERE question_id IN (SELECT id FROM poll_questions WHERE activity_id IN (${marks})))`).run(...removableActivities);
				db.prepare(`DELETE FROM poll_responses WHERE question_id IN (SELECT id FROM poll_questions WHERE activity_id IN (${marks}))`).run(...removableActivities);
				db.prepare(`DELETE FROM poll_options WHERE question_id IN (SELECT id FROM poll_questions WHERE activity_id IN (${marks}))`).run(...removableActivities);
				db.prepare(`DELETE FROM poll_questions WHERE activity_id IN (${marks})`).run(...removableActivities);
				db.prepare(`DELETE FROM activities WHERE id IN (${marks})`).run(...removableActivities);
			}
			const adminSessions = db.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?').run(now).changes;
			const participants = db
				.prepare('DELETE FROM participants WHERE expires_at <= ? AND NOT EXISTS (SELECT 1 FROM poll_responses WHERE poll_responses.participant_id = participants.id)')
				.run(now).changes;
			return { adminSessions, participants, sessions: sessionIds.length };
		})();
		console.log(`Maintenance complete. admin_sessions=${result.adminSessions} participants=${result.participants} sessions=${result.sessions}`);
	} catch {
		console.error('Maintenance failed. Check database access and schema version.');
		process.exitCode = 1;
	} finally {
		db.close();
	}
}
