import type { ComponentProps } from 'react'
import { Stamp } from '../art'
import type { BywaySummary } from '../../lib/types'
import { useStory } from '../../lib/data'

/** Keep the passport's stamp artwork consistent with its road's postcard. */
export function BywayStamp({ byway, ...props }: { byway?: BywaySummary } & ComponentProps<typeof Stamp>) {
  const { story } = useStory(byway?.id)
  return <Stamp {...props} family={byway?.scene} seed={byway?.seed} region={byway?.region} motifs={story?.motifs} />
}
