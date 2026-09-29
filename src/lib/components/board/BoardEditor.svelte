<script lang="ts">
	import BoardView from './BoardView.svelte';
	import {
		SAMPLE_COLUMNS,
		SAMPLE_POSTS,
		type BoardColumn,
		type BoardPost,
		type PostStatus
	} from '$lib/board/posts';
	import type { PostDraft } from './PostComposer.svelte';
	let {
		columns = SAMPLE_COLUMNS,
		posts = SAMPLE_POSTS,
		loading = false,
		error = null,
		onmoderate,
		onreorder,
		onaddpost
	}: {
		columns?: BoardColumn[];
		posts?: BoardPost[];
		loading?: boolean;
		error?: string | null;
		onmoderate?: (payload: { postId: string; status: PostStatus }) => void | Promise<void>;
		onreorder?: (payload: { columnId: string; posts: BoardPost[] }) => void | Promise<void>;
		onaddpost?: (payload: PostDraft) => void | Promise<void>;
	} = $props();
</script>

<div data-testid="board-editor">
	<BoardView
		{columns}
		{posts}
		{loading}
		{error}
		{onmoderate}
		{onreorder}
		onpost={onaddpost}
		admin
	/>
</div>
