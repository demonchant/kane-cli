export function canReadRun(run, userId) {
  return Boolean(run) && typeof userId === 'string' && run.ownerId === userId;
}
