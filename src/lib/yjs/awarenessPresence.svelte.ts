/**
 * Adapter that exposes a y-protocols Awareness instance through the
 * editor's `PresenceAdapter` interface.
 *
 * Awareness state shape (per peer):
 *   { user: { id, name, color }, focus?: { clauseId } }
 */

import type { Awareness } from 'y-protocols/awareness';
import type { PresenceAdapter, PresenceInfo, PresenceUser } from '../store/types';

export interface AwarenessPresenceOptions {
	user?: PresenceUser;
	awareness: Awareness;
}

export function createAwarenessPresence(opts: AwarenessPresenceOptions): PresenceAdapter {
	const { awareness, user } = opts;

	if (user) {
		awareness.setLocalStateField('user', user);
	}

	let revision = $state(0);
	const onChange = () => {
		revision++;
	};
	awareness.on('change', onChange);

	function getAll(): PresenceInfo[] {
		// Read `revision` to subscribe.
		void revision;
		const states = awareness.getStates();
		const list: PresenceInfo[] = [];
		const selfId = awareness.clientID;
		states.forEach((state, clientId) => {
			if (clientId === selfId) return;
			const u = state.user as PresenceUser | undefined;
			if (!u) return;
			const focus = state.focus as { clauseId?: string } | undefined;
			list.push({ user: u, clauseId: focus?.clauseId });
		});
		return list;
	}

	function editorsFor(clauseOrSubClauseId: string): PresenceInfo[] {
		return getAll().filter((p) => p.clauseId === clauseOrSubClauseId);
	}

	function setFocus(clauseId: string | undefined) {
		if (clauseId) awareness.setLocalStateField('focus', { clauseId });
		else awareness.setLocalStateField('focus', null);
	}

	return {
		self: user,
		getAll,
		editorsFor,
		setFocus
	};
}
