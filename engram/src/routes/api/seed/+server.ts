import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const SEED = {
	tagTypes: [
		{ id: 'tt_deadline', slug: 'deadline', name: 'Deadline', valueKind: 'date', multi: 0, system: 1, createdAt: '2026-03-04T08:00:00Z' },
		{ id: 'tt_person', slug: 'person', name: 'Person', valueKind: 'text', multi: 1, system: 1, createdAt: '2026-03-04T08:00:00Z' },
		{ id: 'tt_priority', slug: 'priority', name: 'Priority', valueKind: 'text', multi: 0, system: 1, createdAt: '2026-03-04T08:00:00Z' },
		{ id: 'tt_project', slug: 'project', name: 'Project', valueKind: 'text', multi: 0, system: 1, createdAt: '2026-03-04T08:00:00Z' }
	],
	loops: [
		{ id: 'loop_001', title: 'Launch homepage refresh', content: 'Coordinate design, copy, and QA signoff before launch.', openedAt: '2026-03-04T09:00:00Z', closedAt: null, updatedAt: '2026-03-05T10:20:00Z' },
		{ id: 'loop_002', title: 'Finalize recruiting sprint plan', content: 'Prepare interview panel and timeline for backend role.', openedAt: '2026-03-04T11:30:00Z', closedAt: null, updatedAt: '2026-03-05T09:35:00Z' }
	],
	tags: [
		{ id: 'tag_001', loopId: 'loop_001', tagTypeId: 'tt_priority', valueText: 'P0', valueNumber: null, valueDate: null, valueJson: null, createdAt: '2026-03-04T09:00:00Z', updatedAt: '2026-03-04T09:00:00Z' },
		{ id: 'tag_002', loopId: 'loop_001', tagTypeId: 'tt_deadline', valueText: null, valueNumber: null, valueDate: '2026-03-12', valueJson: null, createdAt: '2026-03-04T09:00:00Z', updatedAt: '2026-03-04T09:00:00Z' },
		{ id: 'tag_003', loopId: 'loop_001', tagTypeId: 'tt_project', valueText: 'Website Revamp', valueNumber: null, valueDate: null, valueJson: null, createdAt: '2026-03-04T09:00:00Z', updatedAt: '2026-03-04T09:00:00Z' },
		{ id: 'tag_004', loopId: 'loop_001', tagTypeId: 'tt_person', valueText: 'Avery Kim', valueNumber: null, valueDate: null, valueJson: null, createdAt: '2026-03-04T09:00:00Z', updatedAt: '2026-03-04T09:00:00Z' },
		{ id: 'tag_005', loopId: 'loop_001', tagTypeId: 'tt_person', valueText: 'Noah Patel', valueNumber: null, valueDate: null, valueJson: null, createdAt: '2026-03-04T09:01:00Z', updatedAt: '2026-03-04T09:01:00Z' },
		{ id: 'tag_006', loopId: 'loop_002', tagTypeId: 'tt_priority', valueText: 'P1', valueNumber: null, valueDate: null, valueJson: null, createdAt: '2026-03-04T11:30:00Z', updatedAt: '2026-03-04T11:30:00Z' },
		{ id: 'tag_007', loopId: 'loop_002', tagTypeId: 'tt_deadline', valueText: null, valueNumber: null, valueDate: '2026-03-18', valueJson: null, createdAt: '2026-03-04T11:30:00Z', updatedAt: '2026-03-04T11:30:00Z' },
		{ id: 'tag_008', loopId: 'loop_002', tagTypeId: 'tt_project', valueText: 'Hiring Q2', valueNumber: null, valueDate: null, valueJson: null, createdAt: '2026-03-04T11:30:00Z', updatedAt: '2026-03-04T11:30:00Z' },
		{ id: 'tag_009', loopId: 'loop_002', tagTypeId: 'tt_person', valueText: 'Maya Singh', valueNumber: null, valueDate: null, valueJson: null, createdAt: '2026-03-04T11:30:00Z', updatedAt: '2026-03-04T11:30:00Z' }
	],
	events: [
		{ id: 'evt_001', loopId: 'loop_001', kind: 'created', body: null, meta: null, sequence: 1, dumpId: null, createdAt: '2026-03-04T09:00:00Z' },
		{ id: 'evt_002', loopId: 'loop_001', kind: 'noted', body: 'Draft hero copy pending final review.', meta: null, sequence: 2, dumpId: null, createdAt: '2026-03-05T10:20:00Z' },
		{ id: 'evt_003', loopId: 'loop_002', kind: 'created', body: null, meta: null, sequence: 1, dumpId: null, createdAt: '2026-03-04T11:30:00Z' },
		{ id: 'evt_004', loopId: 'loop_002', kind: 'noted', body: 'Need interview rubric aligned by Friday.', meta: null, sequence: 2, dumpId: null, createdAt: '2026-03-05T09:35:00Z' }
	],
	loopNotes: [
		{ id: 'ln_001', loopId: 'loop_001', body: 'Sync with design after homepage analytics baseline is captured.', createdAt: '2026-03-05T10:10:00Z', updatedAt: '2026-03-05T10:10:00Z' },
		{ id: 'ln_002', loopId: 'loop_002', body: 'Collect interviewer availability in one shared sheet.', createdAt: '2026-03-05T09:30:00Z', updatedAt: '2026-03-05T09:30:00Z' }
	]
};

export const GET: RequestHandler = async () => {
	return json(SEED);
};
