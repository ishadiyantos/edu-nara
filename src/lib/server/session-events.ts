import type { Store } from './db/client';
import { snapshot } from './sessions';
import { choiceTally, getChoiceQuestion } from './poll/choice';
import { getWordcloudQuestionsByActivity, wordcloudSnapshot } from './poll/wordcloud';

export function sessionEventSnapshot(
	store: Store,
	id: string,
	activityType: string,
	activityId: string,
	isOwner: boolean
) {
	const base = snapshot(store, id);
	const question = base.activeQuestionId ? getChoiceQuestion(store, base.activeQuestionId) : null;
	if (activityType === 'wordcloud')
		return {
			...base,
			wordcloud: getWordcloudQuestionsByActivity(store, activityId).map((q) => ({
				questionId: q.id,
				words: wordcloudSnapshot(store, id, q.id)
			}))
		};
	if (isOwner)
		return { ...base, question, tally: question ? choiceTally(store, id, question.id) : null };
	// Participants never receive tallies, answer keys, or owner-only question details over SSE.
	return base;
}
