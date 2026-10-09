export function evaluateRepeatability(attempts, currentVerdict, objectiveHash, repairCount) {
  const previous = attempts.at(-1);
  const isSameObjectiveReplay = previous?.kind === 'kane' && previous.objectiveHash === objectiveHash;
  const inconsistent = currentVerdict === 'passed' && isSameObjectiveReplay && previous.verdict === 'failed' && repairCount === 0;
  const reproduced = currentVerdict === 'failed' && isSameObjectiveReplay && previous.verdict === 'failed';
  const actionable = currentVerdict === 'failed' && (repairCount > 0 || reproduced);
  return {
    inconsistent,
    reproduced,
    actionable,
    label: inconsistent ? 'inconsistent_with_previous_failure' : (reproduced ? 'failure_reproduced' : (currentVerdict === 'failed' && repairCount === 0 ? 'single_failure_needs_replay' : 'not_applicable')),
  };
}
