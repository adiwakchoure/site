import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const SEED = {
	tagTypes: [
		{ id: 'tt_state', slug: 'state', name: 'State', valueKind: 'text', multi: 0, system: 1, createdAt: '2026-02-10T09:00:00Z' },
		{ id: 'tt_deadline', slug: 'deadline', name: 'Deadline', valueKind: 'date', multi: 0, system: 1, createdAt: '2026-02-10T09:00:00Z' },
		{ id: 'tt_priority', slug: 'priority', name: 'Priority', valueKind: 'text', multi: 0, system: 1, createdAt: '2026-02-10T09:00:00Z' },
		{ id: 'tt_energy', slug: 'energy', name: 'Energy', valueKind: 'text', multi: 0, system: 1, createdAt: '2026-02-10T09:00:00Z' },
		{ id: 'tt_project', slug: 'project', name: 'Project', valueKind: 'text', multi: 0, system: 1, createdAt: '2026-02-10T09:00:00Z' },
		{ id: 'tt_person', slug: 'person', name: 'Person', valueKind: 'text', multi: 1, system: 1, createdAt: '2026-02-10T09:00:00Z' },
		{ id: 'tt_parent', slug: 'parent', name: 'Parent', valueKind: 'text', multi: 0, system: 1, createdAt: '2026-02-10T09:00:00Z' },
		{ id: 'tt_closed_reason', slug: 'closed_reason', name: 'Closed reason', valueKind: 'text', multi: 0, system: 1, createdAt: '2026-02-10T09:00:00Z' },
		{ id: 'tt_area', slug: 'area', name: 'Area', valueKind: 'text', multi: 0, system: 0, createdAt: '2026-02-10T09:00:00Z' },
		{ id: 'tt_effort', slug: 'effort', name: 'Effort', valueKind: 'number', multi: 0, system: 0, createdAt: '2026-02-10T09:00:00Z' },
		{ id: 'tt_context', slug: 'context', name: 'Context', valueKind: 'json', multi: 0, system: 0, createdAt: '2026-02-10T09:00:00Z' },
		{ id: 'tt_channel', slug: 'channel', name: 'Channel', valueKind: 'text', multi: 1, system: 0, createdAt: '2026-02-10T09:00:00Z' }
	],
	loops: [
		{ id: 'loop_001', title: 'Q2 launch readiness', content: 'Umbrella loop for launch-critical work.', openedAt: '2026-03-01T09:00:00Z', closedAt: null, updatedAt: '2026-03-04T10:30:00Z' },
		{ id: 'loop_002', title: 'Ship onboarding flow v2', content: 'Polish first-run experience and metrics.', openedAt: '2026-03-02T11:00:00Z', closedAt: null, updatedAt: '2026-03-04T11:20:00Z' },
		{ id: 'loop_003', title: 'Get legal approval for pricing copy', content: null, openedAt: '2026-03-02T15:10:00Z', closedAt: null, updatedAt: '2026-03-04T09:15:00Z' },
		{ id: 'loop_004', title: 'Plan iOS PWA viewport QA matrix', content: 'Safari bars, standalone, rotation, notch devices.', openedAt: '2026-03-03T08:45:00Z', closedAt: null, updatedAt: '2026-03-04T08:50:00Z' },
		{ id: 'loop_005', title: 'Investigate speech model options', content: 'Compare cost, latency, and transcript quality.', openedAt: '2026-03-01T14:10:00Z', closedAt: null, updatedAt: '2026-03-03T18:00:00Z' },
		{ id: 'loop_006', title: 'Migrate old project relations', content: null, openedAt: '2026-02-27T13:00:00Z', closedAt: '2026-03-03T16:20:00Z', updatedAt: '2026-03-03T16:20:00Z' },
		{ id: 'loop_007', title: 'Conference sponsorship follow-up', content: null, openedAt: '2026-02-25T12:00:00Z', closedAt: '2026-03-01T12:30:00Z', updatedAt: '2026-03-01T12:30:00Z' },
		{ id: 'loop_008', title: 'Clean up stale experiments', content: 'Archive old prototype branches and notes.', openedAt: '2026-03-01T18:00:00Z', closedAt: null, updatedAt: '2026-03-04T07:40:00Z' }
	],
	tags: [
		{ id: 'tag_001', loopId: 'loop_001', tagTypeId: 'tt_state', valueText: 'open', valueNumber: null, valueDate: null, valueJson: null, createdAt: '2026-03-01T09:00:00Z', updatedAt: '2026-03-01T09:00:00Z' },
		{ id: 'tag_002', loopId: 'loop_001', tagTypeId: 'tt_priority', valueText: 'P0', valueNumber: null, valueDate: null, valueJson: null, createdAt: '2026-03-01T09:00:00Z', updatedAt: '2026-03-01T09:00:00Z' },
		{ id: 'tag_003', loopId: 'loop_001', tagTypeId: 'tt_energy', valueText: 'active', valueNumber: null, valueDate: null, valueJson: null, createdAt: '2026-03-01T09:00:00Z', updatedAt: '2026-03-01T09:00:00Z' },
		{ id: 'tag_004', loopId: 'loop_001', tagTypeId: 'tt_project', valueText: 'Launch', valueNumber: null, valueDate: null, valueJson: null, createdAt: '2026-03-01T09:00:00Z', updatedAt: '2026-03-01T09:00:00Z' },

		{ id: 'tag_005', loopId: 'loop_002', tagTypeId: 'tt_state', valueText: 'open', valueNumber: null, valueDate: null, valueJson: null, createdAt: '2026-03-02T11:00:00Z', updatedAt: '2026-03-02T11:00:00Z' },
		{ id: 'tag_006', loopId: 'loop_002', tagTypeId: 'tt_parent', valueText: 'loop_001', valueNumber: null, valueDate: null, valueJson: null, createdAt: '2026-03-02T11:00:00Z', updatedAt: '2026-03-02T11:00:00Z' },
		{ id: 'tag_007', loopId: 'loop_002', tagTypeId: 'tt_deadline', valueText: null, valueNumber: null, valueDate: '2026-03-08', valueJson: null, createdAt: '2026-03-02T11:00:00Z', updatedAt: '2026-03-02T11:00:00Z' },
		{ id: 'tag_008', loopId: 'loop_002', tagTypeId: 'tt_person', valueText: 'Sarah Chen', valueNumber: null, valueDate: null, valueJson: null, createdAt: '2026-03-02T11:00:00Z', updatedAt: '2026-03-02T11:00:00Z' },
		{ id: 'tag_009', loopId: 'loop_002', tagTypeId: 'tt_person', valueText: 'Mike Owens', valueNumber: null, valueDate: null, valueJson: null, createdAt: '2026-03-02T11:01:00Z', updatedAt: '2026-03-02T11:01:00Z' },
		{ id: 'tag_010', loopId: 'loop_002', tagTypeId: 'tt_channel', valueText: 'mobile', valueNumber: null, valueDate: null, valueJson: null, createdAt: '2026-03-02T11:02:00Z', updatedAt: '2026-03-02T11:02:00Z' },
		{ id: 'tag_011', loopId: 'loop_002', tagTypeId: 'tt_channel', valueText: 'growth', valueNumber: null, valueDate: null, valueJson: null, createdAt: '2026-03-02T11:03:00Z', updatedAt: '2026-03-02T11:03:00Z' },

		{ id: 'tag_012', loopId: 'loop_003', tagTypeId: 'tt_state', valueText: 'open', valueNumber: null, valueDate: null, valueJson: null, createdAt: '2026-03-02T15:10:00Z', updatedAt: '2026-03-02T15:10:00Z' },
		{ id: 'tag_013', loopId: 'loop_003', tagTypeId: 'tt_priority', valueText: 'P1', valueNumber: null, valueDate: null, valueJson: null, createdAt: '2026-03-02T15:10:00Z', updatedAt: '2026-03-02T15:10:00Z' },
		{ id: 'tag_014', loopId: 'loop_003', tagTypeId: 'tt_energy', valueText: 'waiting', valueNumber: null, valueDate: null, valueJson: null, createdAt: '2026-03-02T15:10:00Z', updatedAt: '2026-03-02T15:10:00Z' },
		{ id: 'tag_015', loopId: 'loop_003', tagTypeId: 'tt_person', valueText: 'Priya Sharma', valueNumber: null, valueDate: null, valueJson: null, createdAt: '2026-03-02T15:10:00Z', updatedAt: '2026-03-02T15:10:00Z' },
		{ id: 'tag_016', loopId: 'loop_003', tagTypeId: 'tt_deadline', valueText: null, valueNumber: null, valueDate: '2026-03-06', valueJson: null, createdAt: '2026-03-02T15:10:00Z', updatedAt: '2026-03-02T15:10:00Z' },

		{ id: 'tag_017', loopId: 'loop_004', tagTypeId: 'tt_state', valueText: 'open', valueNumber: null, valueDate: null, valueJson: null, createdAt: '2026-03-03T08:45:00Z', updatedAt: '2026-03-03T08:45:00Z' },
		{ id: 'tag_018', loopId: 'loop_004', tagTypeId: 'tt_project', valueText: 'Launch', valueNumber: null, valueDate: null, valueJson: null, createdAt: '2026-03-03T08:45:00Z', updatedAt: '2026-03-03T08:45:00Z' },
		{ id: 'tag_019', loopId: 'loop_004', tagTypeId: 'tt_area', valueText: 'QA', valueNumber: null, valueDate: null, valueJson: null, createdAt: '2026-03-03T08:45:00Z', updatedAt: '2026-03-03T08:45:00Z' },
		{ id: 'tag_020', loopId: 'loop_004', tagTypeId: 'tt_effort', valueText: null, valueNumber: 5, valueDate: null, valueJson: null, createdAt: '2026-03-03T08:45:00Z', updatedAt: '2026-03-03T08:45:00Z' },
		{ id: 'tag_021', loopId: 'loop_004', tagTypeId: 'tt_context', valueText: null, valueNumber: null, valueDate: null, valueJson: '{"devices":["iPhone13","iPhone15Pro"],"orientation":"both","mode":"safari+pwa"}', createdAt: '2026-03-03T08:45:00Z', updatedAt: '2026-03-03T08:45:00Z' },

		{ id: 'tag_022', loopId: 'loop_005', tagTypeId: 'tt_state', valueText: 'open', valueNumber: null, valueDate: null, valueJson: null, createdAt: '2026-03-01T14:10:00Z', updatedAt: '2026-03-01T14:10:00Z' },
		{ id: 'tag_023', loopId: 'loop_005', tagTypeId: 'tt_energy', valueText: 'someday', valueNumber: null, valueDate: null, valueJson: null, createdAt: '2026-03-01T14:10:00Z', updatedAt: '2026-03-01T14:10:00Z' },
		{ id: 'tag_024', loopId: 'loop_005', tagTypeId: 'tt_priority', valueText: 'P2', valueNumber: null, valueDate: null, valueJson: null, createdAt: '2026-03-01T14:10:00Z', updatedAt: '2026-03-01T14:10:00Z' },
		{ id: 'tag_025', loopId: 'loop_005', tagTypeId: 'tt_area', valueText: 'R&D', valueNumber: null, valueDate: null, valueJson: null, createdAt: '2026-03-01T14:10:00Z', updatedAt: '2026-03-01T14:10:00Z' },
		{ id: 'tag_026', loopId: 'loop_005', tagTypeId: 'tt_effort', valueText: null, valueNumber: 3, valueDate: null, valueJson: null, createdAt: '2026-03-01T14:10:00Z', updatedAt: '2026-03-01T14:10:00Z' },

		{ id: 'tag_027', loopId: 'loop_006', tagTypeId: 'tt_state', valueText: 'closed', valueNumber: null, valueDate: null, valueJson: null, createdAt: '2026-02-27T13:00:00Z', updatedAt: '2026-03-03T16:20:00Z' },
		{ id: 'tag_028', loopId: 'loop_006', tagTypeId: 'tt_closed_reason', valueText: 'done', valueNumber: null, valueDate: null, valueJson: null, createdAt: '2026-03-03T16:20:00Z', updatedAt: '2026-03-03T16:20:00Z' },

		{ id: 'tag_029', loopId: 'loop_007', tagTypeId: 'tt_state', valueText: 'closed', valueNumber: null, valueDate: null, valueJson: null, createdAt: '2026-02-25T12:00:00Z', updatedAt: '2026-03-01T12:30:00Z' },
		{ id: 'tag_030', loopId: 'loop_007', tagTypeId: 'tt_closed_reason', valueText: 'dropped', valueNumber: null, valueDate: null, valueJson: null, createdAt: '2026-03-01T12:30:00Z', updatedAt: '2026-03-01T12:30:00Z' },
		{ id: 'tag_031', loopId: 'loop_007', tagTypeId: 'tt_person', valueText: 'Alex Rivera', valueNumber: null, valueDate: null, valueJson: null, createdAt: '2026-02-25T12:00:00Z', updatedAt: '2026-02-25T12:00:00Z' },

		{ id: 'tag_032', loopId: 'loop_008', tagTypeId: 'tt_state', valueText: 'open', valueNumber: null, valueDate: null, valueJson: null, createdAt: '2026-03-01T18:00:00Z', updatedAt: '2026-03-01T18:00:00Z' },
		{ id: 'tag_033', loopId: 'loop_008', tagTypeId: 'tt_priority', valueText: 'P2', valueNumber: null, valueDate: null, valueJson: null, createdAt: '2026-03-01T18:00:00Z', updatedAt: '2026-03-01T18:00:00Z' },
		{ id: 'tag_034', loopId: 'loop_008', tagTypeId: 'tt_area', valueText: 'Infra', valueNumber: null, valueDate: null, valueJson: null, createdAt: '2026-03-01T18:00:00Z', updatedAt: '2026-03-01T18:00:00Z' }
	],
	events: [
		{ id: 'evt_001', loopId: 'loop_001', kind: 'created', body: null, meta: null, sequence: 1, dumpId: null, createdAt: '2026-03-01T09:00:00Z' },
		{ id: 'evt_002', loopId: 'loop_001', kind: 'noted', body: 'Split launch readiness into concrete child loops.', meta: null, sequence: 2, dumpId: null, createdAt: '2026-03-03T09:00:00Z' },
		{ id: 'evt_003', loopId: 'loop_002', kind: 'created', body: null, meta: null, sequence: 1, dumpId: null, createdAt: '2026-03-02T11:00:00Z' },
		{ id: 'evt_004', loopId: 'loop_002', kind: 'updated', body: 'deadline -> 2026-03-08', meta: null, sequence: 2, dumpId: null, createdAt: '2026-03-03T10:20:00Z' },
		{ id: 'evt_005', loopId: 'loop_003', kind: 'created', body: null, meta: null, sequence: 1, dumpId: null, createdAt: '2026-03-02T15:10:00Z' },
		{ id: 'evt_006', loopId: 'loop_004', kind: 'created', body: null, meta: null, sequence: 1, dumpId: null, createdAt: '2026-03-03T08:45:00Z' },
		{ id: 'evt_007', loopId: 'loop_005', kind: 'created', body: null, meta: null, sequence: 1, dumpId: null, createdAt: '2026-03-01T14:10:00Z' },
		{ id: 'evt_008', loopId: 'loop_006', kind: 'closed', body: 'Migration complete and verified.', meta: null, sequence: 2, dumpId: null, createdAt: '2026-03-03T16:20:00Z' },
		{ id: 'evt_009', loopId: 'loop_007', kind: 'closed', body: 'Sponsorship no longer relevant.', meta: null, sequence: 2, dumpId: null, createdAt: '2026-03-01T12:30:00Z' }
	],
	loopNotes: [
		{ id: 'ln_001', loopId: 'loop_002', body: 'Using phased rollout with feature flags.', createdAt: '2026-03-03T12:15:00Z', updatedAt: '2026-03-03T12:15:00Z' },
		{ id: 'ln_002', loopId: 'loop_003', body: 'Waiting on legal redlines from Priya.', createdAt: '2026-03-04T09:15:00Z', updatedAt: '2026-03-04T09:15:00Z' },
		{ id: 'ln_003', loopId: 'loop_004', body: 'Need to verify bottom-sheet behavior with Safari bars.', createdAt: '2026-03-04T08:52:00Z', updatedAt: '2026-03-04T08:52:00Z' }
	]
};

export const GET: RequestHandler = async () => {
	return json(SEED);
};
