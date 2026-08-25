import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useSoroban } from '../context/useSoroban';
import { DEMO_PROGRAMME_ID } from '../context/sorobanStore';

/**
 * The programme a screen is looking at.
 *
 * Programmes are separate contracts, so every screen needs an address. Four
 * places had already hardcoded one, and with twenty-odd screens still to build
 * that becomes twenty hardcoded addresses and no way to view a second
 * programme.
 *
 * The address comes from the route (`/programme/:programmeId`), falling back to
 * the seeded testnet programme so pages still render something real while
 * listings do not yet exist.
 */
export function useProgramme() {
  const { programmeId } = useParams<{ programmeId?: string }>();
  const { programmeAt } = useSoroban();

  const id = programmeId ?? DEMO_PROGRAMME_ID;

  return useMemo(
    () => ({
      id,
      client: programmeAt(id),
      /** True when falling back rather than showing a programme that was asked for. */
      isDefault: !programmeId,
    }),
    [id, programmeId, programmeAt],
  );
}
