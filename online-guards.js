/**
 * Network-only safety guards. No game rules, database writes or UI rendering.
 * Each room listener owns one gate; retiring it prevents callbacks from an
 * older subscription overwriting a newer subscription to the same room code.
 */
export function createRoomSnapshotGate(code, currentCode) {
  let retired = false;
  let revision = -1;
  let version = null;
  return {
    accept(room) {
      if (retired || currentCode() !== code) return false;
      if (!room) { version = null; return true; } // Allow same-revision recovery after a transient empty snapshot.
      const nextRevision = room.revision ?? 0;
      if (!Number.isSafeInteger(nextRevision) || nextRevision < 0 || nextRevision < revision) return false;
      // Metadata can change at the same revision on older saved rooms.
      const nextVersion = `${nextRevision}:${room.status ?? ''}:${room.draft?.round ?? ''}`;
      if (nextVersion === version) return false;
      revision = nextRevision;
      version = nextVersion;
      return true;
    },
    retire() { retired = true; },
  };
}

/** An in-flight action must not be replayed after leaving its originating room. */
export function actionScopeIsCurrent(session, ui) {
  return !ui.demo && ui.roomCode === session.code && ui.uid === session.uid &&
    ui.networkConnected === true && ui.connectionEpoch === session.epoch;
}

/** Reject a different room that reused the same short room code. */
export function matchesOriginalRoom(initial, current) {
  if (!initial || !current) return false;
  const getPlayers = r => Array.isArray(r.players) ? r.players : [r.players?.[0], r.players?.[1]];
  const originalHost = getPlayers(initial)[0]?.uid;
  const actualHost = getPlayers(current)[0]?.uid;
  return !!originalHost && originalHost === actualHost &&
    (initial.createdAt == null || initial.createdAt === current.createdAt);
}
