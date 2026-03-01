import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const SEED = {
	people: [
		{ id: 'per_001', name: 'Sarah Chen', rel: 'design lead at Canopy', createdAt: '2026-02-10T09:00:00Z' },
		{ id: 'per_002', name: 'Mike Owens', rel: 'co-founder', createdAt: '2026-02-10T09:00:00Z' },
		{ id: 'per_003', name: 'Priya Sharma', rel: 'client, Aurum project', createdAt: '2026-02-14T11:00:00Z' }
	],
	projects: [
		{ id: 'proj_001', name: 'Aurum', color: '#a0714a', emoji: null, archived: 0, createdAt: '2026-02-10T09:00:00Z' },
		{ id: 'proj_002', name: 'Site Relaunch', color: '#6e63a0', emoji: null, archived: 0, createdAt: '2026-02-12T10:00:00Z' }
	],
	loops: [
		{ id: 'loop_001', title: "Review Sarah's brand explorations", body: '', state: 'open', closedReason: null, energy: 'active', priority: 'P1', deadline: '2026-03-05', projectId: 'proj_001', parentId: null, tags: '', createdAt: '2026-02-20T10:00:00Z', closedAt: null, archivedAt: null, updatedAt: '2026-02-27T14:00:00Z' },
		{ id: 'loop_002', title: "Get Sarah's feedback on pricing page", body: '', state: 'open', closedReason: null, energy: 'waiting', priority: 'P1', deadline: '2026-03-07', projectId: 'proj_002', parentId: null, tags: '', createdAt: '2026-02-22T11:00:00Z', closedAt: null, archivedAt: null, updatedAt: '2026-02-26T09:00:00Z' },
		{ id: 'loop_003', title: 'Finalize investor deck with Mike', body: '', state: 'open', closedReason: null, energy: 'active', priority: 'P0', deadline: '2026-03-03', projectId: null, parentId: null, tags: '', createdAt: '2026-02-18T08:00:00Z', closedAt: null, archivedAt: null, updatedAt: '2026-02-28T16:00:00Z' },
		{ id: 'loop_004', title: 'Mike to set up analytics dashboard', body: '', state: 'open', closedReason: null, energy: 'waiting', priority: 'P2', deadline: null, projectId: 'proj_002', parentId: null, tags: '', createdAt: '2026-02-24T14:00:00Z', closedAt: null, archivedAt: null, updatedAt: '2026-02-24T14:00:00Z' },
		{ id: 'loop_005', title: 'Sync with Mike on hiring plan', body: '', state: 'open', closedReason: null, energy: 'active', priority: 'P1', deadline: '2026-03-10', projectId: null, parentId: null, tags: '', createdAt: '2026-02-15T09:00:00Z', closedAt: null, archivedAt: null, updatedAt: '2026-02-25T11:00:00Z' },
		{ id: 'loop_006', title: 'Send Priya the revised scope document', body: '', state: 'open', closedReason: null, energy: 'active', priority: 'P0', deadline: '2026-03-02', projectId: 'proj_001', parentId: null, tags: '', createdAt: '2026-02-25T10:00:00Z', closedAt: null, archivedAt: null, updatedAt: '2026-02-28T12:00:00Z' },
		{ id: 'loop_007', title: 'Schedule Priya walkthrough for milestone 2', body: '', state: 'open', closedReason: null, energy: 'someday', priority: 'P2', deadline: null, projectId: 'proj_001', parentId: null, tags: '', createdAt: '2026-02-26T15:00:00Z', closedAt: null, archivedAt: null, updatedAt: '2026-02-26T15:00:00Z' },
		{ id: 'loop_008', title: 'Set up Aurum Figma workspace', body: '', state: 'closed', closedReason: 'done', energy: 'active', priority: 'P1', deadline: null, projectId: 'proj_001', parentId: null, tags: '', createdAt: '2026-02-11T09:00:00Z', closedAt: '2026-02-19T17:00:00Z', archivedAt: null, updatedAt: '2026-02-19T17:00:00Z' },
		{ id: 'loop_009', title: 'Book conference travel', body: '', state: 'closed', closedReason: 'dropped', energy: 'active', priority: 'P2', deadline: '2026-02-20', projectId: null, parentId: null, tags: '', createdAt: '2026-02-13T10:00:00Z', closedAt: '2026-02-18T08:00:00Z', archivedAt: null, updatedAt: '2026-02-18T08:00:00Z' }
	],
	loopPeople: [
		{ loopId: 'loop_001', personId: 'per_001' },
		{ loopId: 'loop_002', personId: 'per_001' },
		{ loopId: 'loop_003', personId: 'per_002' },
		{ loopId: 'loop_004', personId: 'per_002' },
		{ loopId: 'loop_005', personId: 'per_002' },
		{ loopId: 'loop_006', personId: 'per_003' },
		{ loopId: 'loop_007', personId: 'per_003' }
	],
	events: [
		{ id: 'evt_001', loopId: 'loop_001', kind: 'created', body: null, meta: null, sequence: 1, dumpId: null, createdAt: '2026-02-20T10:00:00Z' },
		{ id: 'evt_002', loopId: 'loop_001', kind: 'noted', body: 'Sarah shared 3 directions — earthy palette looks strongest', meta: null, sequence: 2, dumpId: null, createdAt: '2026-02-24T15:00:00Z' },
		{ id: 'evt_003', loopId: 'loop_001', kind: 'noted', body: 'Narrowed down to 2 options, waiting on final assets', meta: null, sequence: 3, dumpId: null, createdAt: '2026-02-27T14:00:00Z' },
		{ id: 'evt_004', loopId: 'loop_002', kind: 'created', body: null, meta: null, sequence: 1, dumpId: null, createdAt: '2026-02-22T11:00:00Z' },
		{ id: 'evt_005', loopId: 'loop_002', kind: 'noted', body: 'Sent pricing page mockup to Sarah for review', meta: null, sequence: 2, dumpId: null, createdAt: '2026-02-26T09:00:00Z' },
		{ id: 'evt_006', loopId: 'loop_003', kind: 'created', body: null, meta: null, sequence: 1, dumpId: null, createdAt: '2026-02-18T08:00:00Z' },
		{ id: 'evt_007', loopId: 'loop_003', kind: 'noted', body: 'First draft done — 18 slides, needs financials section', meta: null, sequence: 2, dumpId: null, createdAt: '2026-02-23T10:00:00Z' },
		{ id: 'evt_008', loopId: 'loop_003', kind: 'noted', body: 'Mike added revenue projections, reviewing tonight', meta: null, sequence: 3, dumpId: null, createdAt: '2026-02-28T16:00:00Z' },
		{ id: 'evt_009', loopId: 'loop_005', kind: 'created', body: null, meta: null, sequence: 1, dumpId: null, createdAt: '2026-02-15T09:00:00Z' },
		{ id: 'evt_010', loopId: 'loop_005', kind: 'noted', body: 'Agreed to hire 2 engineers, need to post roles', meta: null, sequence: 2, dumpId: null, createdAt: '2026-02-25T11:00:00Z' },
		{ id: 'evt_011', loopId: 'loop_006', kind: 'created', body: null, meta: null, sequence: 1, dumpId: null, createdAt: '2026-02-25T10:00:00Z' },
		{ id: 'evt_012', loopId: 'loop_006', kind: 'noted', body: 'Scope mostly done, need to add payment terms section', meta: null, sequence: 2, dumpId: null, createdAt: '2026-02-28T12:00:00Z' },
		{ id: 'evt_013', loopId: 'loop_008', kind: 'created', body: null, meta: null, sequence: 1, dumpId: null, createdAt: '2026-02-11T09:00:00Z' },
		{ id: 'evt_014', loopId: 'loop_008', kind: 'closed', body: 'Workspace set up, shared with team', meta: null, sequence: 2, dumpId: null, createdAt: '2026-02-19T17:00:00Z' },
		{ id: 'evt_015', loopId: 'loop_009', kind: 'created', body: null, meta: null, sequence: 1, dumpId: null, createdAt: '2026-02-13T10:00:00Z' },
		{ id: 'evt_016', loopId: 'loop_009', kind: 'closed', body: 'Conference cancelled', meta: null, sequence: 2, dumpId: null, createdAt: '2026-02-18T08:00:00Z' }
	],
	loopNotes: [
		{ id: 'ln_001', loopId: 'loop_001', body: 'Sarah shared 3 directions — earthy palette looks strongest', createdAt: '2026-02-24T15:00:00Z', updatedAt: '2026-02-24T15:00:00Z' },
		{ id: 'ln_002', loopId: 'loop_001', body: 'Narrowed down to 2 options, waiting on final assets', createdAt: '2026-02-27T14:00:00Z', updatedAt: '2026-02-27T14:00:00Z' },
		{ id: 'ln_003', loopId: 'loop_003', body: 'First draft done — 18 slides, needs financials section', createdAt: '2026-02-23T10:00:00Z', updatedAt: '2026-02-23T10:00:00Z' },
		{ id: 'ln_004', loopId: 'loop_003', body: 'Mike added revenue projections, reviewing tonight', createdAt: '2026-02-28T16:00:00Z', updatedAt: '2026-02-28T16:00:00Z' },
		{ id: 'ln_005', loopId: 'loop_005', body: 'Agreed to hire 2 engineers, need to post roles', createdAt: '2026-02-25T11:00:00Z', updatedAt: '2026-02-25T11:00:00Z' },
		{ id: 'ln_006', loopId: 'loop_006', body: 'Scope mostly done, need to add payment terms section', createdAt: '2026-02-28T12:00:00Z', updatedAt: '2026-02-28T12:00:00Z' },
		{ id: 'ln_007', loopId: 'loop_002', body: 'Sent pricing page mockup to Sarah for review', createdAt: '2026-02-26T09:00:00Z', updatedAt: '2026-02-26T09:00:00Z' }
	]
};

export const GET: RequestHandler = async () => {
	return json(SEED);
};
