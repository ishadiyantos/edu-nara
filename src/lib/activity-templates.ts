export type LibraryType = 'choice' | 'wordcloud' | 'board' | 'crossword';
export const activityTypes: Record<LibraryType, { label: string; description: string }> = {
	choice: {
		label: 'Quiz',
		description: 'Check understanding with interactive questions and answer choices.'
	},
	wordcloud: {
		label: 'Word Cloud',
		description: 'Collect short responses and reveal the ideas your class shares.'
	},
	board: {
		label: 'Board',
		description: 'Bring ideas, questions, and resources together on a shared board.'
	},
	crossword: {
		label: 'Crossword',
		description: 'Build a manual crossword puzzle with clues for your class.'
	}
};
type Template = {
	id: string;
	type: LibraryType;
	title: string;
	description: string;
	questions?: {
		prompt: string;
		options?: string[];
		correctOptions?: number[];
		timeLimit?: number;
		wordLimit?: number;
	}[];
	columns?: string[];
};
export const activityTemplates: Template[] = [
	{
		id: 'quiz-understanding',
		type: 'choice',
		title: 'Check understanding',
		description: 'Two sample questions about evidence and explanations. Edit for your lesson.',
		questions: [
			{
				prompt: 'Which approach best checks whether a claim is reliable?',
				options: [
					'Look for supporting evidence',
					'Choose the most popular opinion',
					'Accept the first answer'
				],
				correctOptions: [0],
				timeLimit: 30
			},
			{
				prompt: 'Which actions help explain a new idea? Select all that apply.',
				options: [
					'Give an example',
					'Connect it to prior knowledge',
					'Repeat it without explanation'
				],
				correctOptions: [0, 1],
				timeLimit: 30
			}
		]
	},
	{
		id: 'quiz-evaluation',
		type: 'choice',
		title: 'Quick evaluation',
		description: 'Two sample questions on learning strategies, with answer keys and timers.',
		questions: [
			{
				prompt: 'Which study strategy helps you check what you remember?',
				options: [
					'Recall ideas without looking at notes',
					'Only reread highlighted text',
					'Skip difficult topics'
				],
				correctOptions: [0],
				timeLimit: 20
			},
			{
				prompt: 'What is a useful next step after receiving feedback?',
				options: ['Revise your work using the feedback', 'Ignore the feedback', 'Stop practicing'],
				correctOptions: [0],
				timeLimit: 20
			}
		]
	},
	{
		id: 'cloud-icebreaker',
		type: 'wordcloud',
		title: 'Icebreaker',
		description: 'Start a conversation with two short prompts. Moderation enabled.',
		questions: [
			{ prompt: 'In one word, how are you feeling today?', wordLimit: 1 },
			{ prompt: 'What comes to mind when you think about today’s topic?', wordLimit: 3 }
		]
	},
	{
		id: 'cloud-reflection',
		type: 'wordcloud',
		title: 'Lesson reflection',
		description: 'Collect key takeaways and questions after a lesson. Moderation enabled.',
		questions: [
			{ prompt: 'What is your biggest takeaway from today’s lesson?', wordLimit: 3 },
			{ prompt: 'What would you like to explore further?', wordLimit: 3 }
		]
	},
	{
		id: 'board-ideas',
		type: 'board',
		title: 'Ideas, Questions, Conclusions',
		description: 'Three columns to collect ideas, clarify questions, and summarize learning.',
		columns: ['Ideas', 'Questions', 'Conclusions']
	},
	{
		id: 'board-debate',
		type: 'board',
		title: 'Pros, Cons, Conclusions',
		description: 'Three columns for a balanced discussion. Student cards start in moderation.',
		columns: ['Pros', 'Cons', 'Conclusions']
	}
];
export function editorPath(activity: { id: string; type: string }) {
	return `/admin/activities/${activity.id}/${activity.type === 'choice' ? 'poll' : activity.type}`;
}
