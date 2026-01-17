/**
 * User-friendly guidance for conflicts
 * This is kept separate from server-side code to allow client component usage
 */
export function getConflictGuidance(): {
  title: string;
  message: string;
  steps: string[];
  cta: string;
} {
  return {
    title: 'Changes cannot be applied automatically',
    message: 'Someone else has made changes to the same files since you started editing. This needs to be resolved before your proposal can be accepted.',
    steps: [
      'Open the proposal on GitHub using the button below',
      'Follow GitHub\'s instructions to resolve the overlapping changes',
      'Once resolved, your proposal can be reviewed and accepted',
    ],
    cta: 'View on GitHub',
  };
}
