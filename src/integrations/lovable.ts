// Small Lovable integration surface (placeholder)

export async function suggestStudyPlan(prompt: string) {
  // This function is a client-side placeholder. Real Lovable integration must
  // proxy requests through a server that holds the LOVABLE_API_KEY secret.
  // See AGENTS.md for setup instructions.
  const res = await fetch('/api/lovable/suggest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt })
  })
  if(!res.ok) throw new Error('Lovable request failed')
  return res.json()
}
