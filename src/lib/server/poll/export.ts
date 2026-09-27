import type { Store } from '../db/client';

export function choiceExportRows(store: Store, sessionId: string) {
	const rows = store.sqlite
		.prepare(
			`SELECT p.display_name AS participant, q.prompt AS prompt,
				COALESCE(GROUP_CONCAT(DISTINCT selected.label), fallback.label, '') AS answer,
				r.points AS points, r.is_correct AS is_correct
			 FROM poll_responses r
			 JOIN participants p ON p.id = r.participant_id
			 JOIN poll_questions q ON q.id = r.question_id
			 JOIN poll_options fallback ON fallback.id = r.option_id
			 LEFT JOIN poll_response_options pro ON pro.response_id = r.id
			 LEFT JOIN poll_options selected ON selected.id = pro.option_id
			 WHERE r.session_id = ?
			 GROUP BY r.id, p.display_name, q.prompt, fallback.label, r.points, r.is_correct
			 ORDER BY p.display_name COLLATE NOCASE, q.position, r.created_at`
		)
		.all(sessionId) as {
		participant: string;
		prompt: string;
		answer: string;
		points: number;
		is_correct: number;
	}[];

	return [
		['Peserta', 'Soal', 'Jawaban', 'Poin', 'Benar'],
		...rows.map((row) => [
			row.participant,
			row.prompt,
			row.answer,
			Number(row.points),
			row.is_correct ? 'Ya' : 'Tidak'
		])
	];
}
