'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'

export const SelectNav = ({ teams }: { teams: any[] }) => {
  const router = useRouter()
  const pathname = usePathname()
  const activeTeam = pathname.split('/team/').pop()
  if (!teams) return null

  const handleClick = (event: any) => {
    event.preventDefault()
    const teamId = event.target.value
    router.push(`/team/${teamId}`)
  }

  return (
    <select className="text-black px-2 py-1" onChange={handleClick} value={activeTeam}>
      {teams.map((team: any) => (
        <option key={team.id} value={team.id}>
          {team.name}
        </option>
      ))}
    </select>
  )
}